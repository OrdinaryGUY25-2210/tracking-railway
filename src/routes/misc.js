import { Router } from 'express';
import nodemailer from 'nodemailer';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ---------- generate-token: token sementara AssemblyAI Streaming v3 ----------
router.post('/transcription-token', async (req, res) => {
  try {
    if (!process.env.ASSEMBLYAI_API_KEY) return res.status(500).json({ error: 'ASSEMBLYAI_API_KEY belum di-set di server.' });

    const r = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=60', {
      headers: { authorization: process.env.ASSEMBLYAI_API_KEY },
    });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal membuat token transkripsi.' });
  }
});

// ---------- send-application: kirim email lamaran via SMTP pengguna ----------
router.post('/send-application', async (req, res) => {
  try {
    const { to, subject, body, fromName, attachments } = req.body;
    if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject, body wajib diisi.' });
    if (!process.env.SMTP_HOST) return res.status(500).json({ error: 'SMTP belum dikonfigurasi di server.' });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: fromName ? `"${fromName}" <${process.env.SMTP_USER}>` : process.env.SMTP_USER,
      to,
      subject,
      text: body,
      attachments: (attachments || []).map((a) => ({ filename: a.filename, content: a.contentBase64, encoding: 'base64' })),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mengirim email.' });
  }
});

export default router;
