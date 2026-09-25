import jwt from 'jsonwebtoken';
import { query } from '../db.js';

// Wajib login. Membaca "Authorization: Bearer <token>", isi req.user.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Belum login.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query(
      'select id, email, full_name, avatar_url, subscription_tier, status, is_admin from users where id = $1',
      [payload.sub]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Akun tidak ditemukan.' });
    if (rows[0].status !== 'aktif') return res.status(403).json({ error: 'Akun tidak aktif.' });

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa.' });
  }
}

// Dipasang SETELAH requireAuth. Menolak kalau bukan admin.
export function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Khusus admin.' });
  next();
}
