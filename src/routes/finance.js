import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ---------- accounts ----------
router.get('/accounts', async (req, res) => {
  const { rows } = await query('select * from finance_accounts where user_id = $1 order by created_at', [req.user.id]);
  res.json(rows);
});

router.post('/accounts', async (req, res) => {
  const { name, type, balance } = req.body;
  if (!name) return res.status(400).json({ error: 'name wajib diisi.' });
  const { rows } = await query(
    'insert into finance_accounts (user_id, name, type, balance) values ($1,$2,coalesce($3,\'cash\'),coalesce($4,0)) returning *',
    [req.user.id, name, type, balance]
  );
  res.status(201).json(rows[0]);
});

router.patch('/accounts/:id', async (req, res) => {
  const { name, type, balance } = req.body;
  const { rows } = await query(
    `update finance_accounts set name = coalesce($1,name), type = coalesce($2,type), balance = coalesce($3,balance)
     where id = $4 and user_id = $5 returning *`,
    [name, type, balance, req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Tidak ditemukan.' });
  res.json(rows[0]);
});

router.delete('/accounts/:id', async (req, res) => {
  const { rows } = await query('delete from finance_accounts where id = $1 and user_id = $2 returning id', [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Tidak ditemukan.' });
  res.json({ ok: true });
});

// ---------- expenses ----------
router.get('/expenses', async (req, res) => {
  const { rows } = await query('select * from finance_expenses where user_id = $1 order by spent_at desc', [req.user.id]);
  res.json(rows);
});

router.post('/expenses', async (req, res) => {
  const { accountId, category, amount, note, spentAt } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount wajib diisi.' });
  const { rows } = await query(
    `insert into finance_expenses (user_id, account_id, category, amount, note, spent_at)
     values ($1,$2,$3,$4,$5,coalesce($6, now())) returning *`,
    [req.user.id, accountId || null, category, amount, note, spentAt]
  );
  res.status(201).json(rows[0]);
});

router.delete('/expenses/:id', async (req, res) => {
  const { rows } = await query('delete from finance_expenses where id = $1 and user_id = $2 returning id', [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Tidak ditemukan.' });
  res.json({ ok: true });
});

// ---------- targets ----------
router.get('/targets', async (req, res) => {
  const { rows } = await query('select * from finance_targets where user_id = $1', [req.user.id]);
  res.json(rows);
});

router.post('/targets', async (req, res) => {
  const { category, monthlyCap } = req.body;
  if (!monthlyCap) return res.status(400).json({ error: 'monthlyCap wajib diisi.' });
  const { rows } = await query(
    'insert into finance_targets (user_id, category, monthly_cap) values ($1,$2,$3) returning *',
    [req.user.id, category, monthlyCap]
  );
  res.status(201).json(rows[0]);
});

router.delete('/targets/:id', async (req, res) => {
  const { rows } = await query('delete from finance_targets where id = $1 and user_id = $2 returning id', [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Tidak ditemukan.' });
  res.json({ ok: true });
});

export default router;
