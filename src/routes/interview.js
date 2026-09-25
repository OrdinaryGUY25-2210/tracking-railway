import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/sessions', async (req, res) => {
  const { rows } = await query('select * from interview_sessions where user_id = $1 order by started_at desc', [req.user.id]);
  res.json(rows);
});

router.post('/sessions', async (req, res) => {
  const { title, language } = req.body;
  const { rows } = await query(
    'insert into interview_sessions (user_id, title, language) values ($1,$2,coalesce($3,\'id\')) returning *',
    [req.user.id, title, language]
  );
  res.status(201).json(rows[0]);
});

router.patch('/sessions/:id/end', async (req, res) => {
  const { rows } = await query(
    'update interview_sessions set ended_at = now() where id = $1 and user_id = $2 returning *',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Tidak ditemukan.' });
  res.json(rows[0]);
});

router.get('/sessions/:id/entries', async (req, res) => {
  const owns = await query('select id from interview_sessions where id = $1 and user_id = $2', [req.params.id, req.user.id]);
  if (!owns.rows[0]) return res.status(404).json({ error: 'Tidak ditemukan.' });
  const { rows } = await query('select * from transcript_entries where session_id = $1 order by created_at', [req.params.id]);
  res.json(rows);
});

router.post('/sessions/:id/entries', async (req, res) => {
  const owns = await query('select id from interview_sessions where id = $1 and user_id = $2', [req.params.id, req.user.id]);
  if (!owns.rows[0]) return res.status(404).json({ error: 'Tidak ditemukan.' });

  const { speaker, text, aiResponse } = req.body;
  if (!text) return res.status(400).json({ error: 'text wajib diisi.' });
  const { rows } = await query(
    'insert into transcript_entries (session_id, speaker, text, ai_response) values ($1,$2,$3,$4) returning *',
    [req.params.id, speaker, text, aiResponse]
  );
  res.status(201).json(rows[0]);
});

export default router;
