import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import applicationRoutes from './routes/applications.js';
import profileRoutes from './routes/profile.js';
import financeRoutes from './routes/finance.js';
import interviewRoutes from './routes/interview.js';
import caposRoutes from './routes/capos.js';
import aiRoutes from './routes/ai.js';
import miscRoutes from './routes/misc.js';

const app = express();

const allowedOrigins = (process.env.FRONTEND_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // dinaikkan karena cvData/lampiran email bisa lumayan besar

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/applications', applicationRoutes);
app.use('/profile', profileRoutes);
app.use('/finance', financeRoutes);
app.use('/interview', interviewRoutes);
app.use('/capos', caposRoutes);
app.use('/ai', aiRoutes);
app.use('/misc', miscRoutes);

// Error handler terakhir — jaga-jaga supaya server tidak crash diam-diam
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server.' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Backend jalan di port ${PORT}`));
