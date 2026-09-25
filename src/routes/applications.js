import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth); // semua route di bawah wajib login

router.get('/', async (req, res) => {
  const { rows } = await query(
    'select * from applications where user_id = $1 order by applied_at desc',
    [req.user.id]
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await query(
    'select * from applications where id = $1 and user_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Tidak ditemukan.' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { company, position, status, jobDescription, coverLetter, cvData, appliedAt, notes } = req.body;
  if (!company || !position) return res.status(400).json({ error: 'company dan position wajib diisi.' });

  const { rows } = await query(
    `insert into applications (user_id, company, position, status, job_description, cover_letter, cv_data, applied_at, notes)
     values ($1,$2,$3,coalesce($4,'applied'),$5,$6,$7,coalesce($8, now()),$9) returning *`,
    [req.user.id, company, position, status, jobDescription, coverLetter, cvData ? JSON.stringify(cvData) : null, appliedAt, notes]
  );
  res.status(201).json(rows[0]);
});

router.patch('/:id', async (req, res) => {
  const fields = ['company', 'position', 'status', 'job_description', 'cover_letter', 'cv_data', 'applied_at', 'notes'];
  const bodyMap = {
    company: req.body.company, position: req.body.position, status: req.body.status,
    job_description: req.body.jobDescription, cover_letter: req.body.coverLetter,
    cv_data: req.body.cvData !== undefined ? JSON.stringify(req.body.cvData) : undefined,
    applied_at: req.body.appliedAt, notes: req.body.notes,
  };

  const sets = [];
  const values = [];
  fields.forEach((f) => {
    if (bodyMap[f] !== undefined) {
      values.push(bodyMap[f]);
      sets.push(`${f} = $${values.length}`);
    }
  });
  if (!sets.length) return res.status(400).json({ error: 'Tidak ada field untuk diupdate.' });

  values.push(req.params.id, req.user.id);
  const { rows } = await query(
    `update applications set ${sets.join(', ')} where id = $${values.length - 1} and user_id = $${values.length} returning *`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: 'Tidak ditemukan.' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { rows } = await query(
    'delete from applications where id = $1 and user_id = $2 returning id',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Tidak ditemukan.' });
  res.json({ ok: true });
});

export default router;
