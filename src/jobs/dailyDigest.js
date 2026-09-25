// Pengganti Edge Function "daily-digest". Di Supabase ini dipicu Cron Jobs
// bawaan dashboard; di Railway, buat SERVICE BARU di project yang sama,
// pilih "Cron Job", start command: node src/jobs/dailyDigest.js
// jadwal mis. tiap jam 7 pagi: 0 7 * * *
import 'dotenv/config';
import nodemailer from 'nodemailer';
import { pool, query } from '../db.js';

async function run() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, DIGEST_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !DIGEST_TO) {
    console.error('SMTP_HOST/SMTP_USER/SMTP_PASS/DIGEST_TO belum lengkap di env.');
    process.exit(1);
  }

  const { rows } = await query(`
    select u.email as user_email, a.company, a.position, a.status, a.applied_at
    from applications a join users u on u.id = a.user_id
    where a.applied_at >= now() - interval '1 day'
    order by u.email, a.applied_at desc
  `);

  if (!rows.length) {
    console.log('Tidak ada lamaran baru dalam 24 jam terakhir, tidak kirim digest.');
    await pool.end();
    return;
  }

  const isi = rows
    .map((r) => `- ${r.company} — ${r.position} (${r.status}) oleh ${r.user_email}`)
    .join('\n');

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 465),
    secure: Number(SMTP_PORT || 465) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: SMTP_USER,
    to: DIGEST_TO,
    subject: `Ringkasan Lamaran Harian — ${rows.length} lamaran baru`,
    text: `Ringkasan lamaran 24 jam terakhir:\n\n${isi}`,
  });

  console.log(`Digest terkirim (${rows.length} lamaran).`);
  await pool.end();
}

run().catch((err) => {
  console.error('Gagal kirim digest:', err.message);
  process.exit(1);
});
