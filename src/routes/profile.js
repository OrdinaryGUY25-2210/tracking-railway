import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows } = await query('select * from profile where user_id = $1', [req.user.id]);
  res.json(rows[0] || null);
});

// upsert — halaman "Profil Saya" simpan semuanya sekali jalan
router.put('/', async (req, res) => {
  const { fullName, tagline, email, phone, location, summary, skills, experience, education, projects } = req.body;
  const { rows } = await query(
    `insert into profile (user_id, full_name, tagline, email, phone, location, summary, skills, experience, education, projects)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     on conflict (user_id) do update set
       full_name = excluded.full_name, tagline = excluded.tagline, email = excluded.email,
       phone = excluded.phone, location = excluded.location, summary = excluded.summary,
       skills = excluded.skills, experience = excluded.experience,
       education = excluded.education, projects = excluded.projects
     returning *`,
    [
      req.user.id, fullName, tagline, email, phone, location, summary,
      JSON.stringify(skills || []), JSON.stringify(experience || []),
      JSON.stringify(education || []), JSON.stringify(projects || []),
    ]
  );
  res.json(rows[0]);
});

export default router;
