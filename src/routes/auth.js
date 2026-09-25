import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

const PUBLIC_FIELDS = 'id, email, full_name, avatar_url, subscription_tier, status, is_admin, created_at';

router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter.' });

    const existing = await query('select id from users where email = $1', [email.toLowerCase()]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Email sudah terdaftar.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `insert into users (email, password_hash, full_name) values ($1, $2, $3) returning ${PUBLIC_FIELDS}`,
      [email.toLowerCase(), passwordHash, fullName || null]
    );

    const token = signToken(rows[0].id);
    res.status(201).json({ user: rows[0], token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mendaftar.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi.' });

    const { rows } = await query('select * from users where email = $1', [email.toLowerCase()]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Email atau password salah.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email atau password salah.' });
    if (user.status !== 'aktif') return res.status(403).json({ error: 'Akun tidak aktif.' });

    const token = signToken(user.id);
    delete user.password_hash;
    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal login.' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password baru minimal 8 karakter.' });
    }
    const { rows } = await query('select password_hash from users where id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword || '', rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Password lama salah.' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('update users set password_hash = $1 where id = $2', [newHash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal ganti password.' });
  }
});

export default router;
