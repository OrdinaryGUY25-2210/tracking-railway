import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin); // seluruh route di file ini khusus admin

// Harga per tier (Rp/bulan) — sesuaikan dengan harga asli produkmu.
// CATATAN: ini estimasi MRR dari jumlah user per tier, BUKAN pendapatan
// riil. Untuk angka revenue yang benar-benar akurat (histori transaksi,
// refund, dll), perlu tabel "payments" tersendiri yang diisi lewat webhook
// payment gateway (Midtrans/Xendit/Stripe) — belum ada di build ini.
const HARGA_TIER = { free: 0, pro: 49000, supreme: 149000 };

router.get('/summary', async (req, res) => {
  const [{ rows: total }, { rows: byTier }, { rows: recentSignups }] = await Promise.all([
    query('select count(*)::int as total from users'),
    query('select subscription_tier, count(*)::int as jumlah from users group by subscription_tier'),
    query("select count(*)::int as jumlah from users where created_at >= now() - interval '30 days'"),
  ]);

  const estimasi_mrr = byTier.reduce((sum, t) => sum + t.jumlah * (HARGA_TIER[t.subscription_tier] || 0), 0);

  res.json({
    total_pengguna: total[0].total,
    per_tier: byTier,
    signup_30_hari: recentSignups[0].jumlah,
    estimasi_mrr,
  });
});

router.get('/users', async (req, res) => {
  const { rows } = await query(
    'select id, email, full_name, subscription_tier, status, created_at from users order by created_at desc'
  );
  res.json(rows);
});

router.get('/activity', async (req, res) => {
  const { rows } = await query('select * from capos_activity_logs order by created_at desc limit 100');
  res.json(rows);
});

router.patch('/activity/:id/read', async (req, res) => {
  const { rows } = await query('update capos_activity_logs set is_read = true where id = $1 returning *', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Tidak ditemukan.' });
  res.json(rows[0]);
});

// Tren signup & upgrade per bulan — buat grafik dashboard
router.get('/trend', async (req, res) => {
  const { rows } = await query(`
    select to_char(date_trunc('month', created_at), 'YYYY-MM') as bulan,
           count(*) filter (where action_type = 'signup')::int as signup_baru,
           count(*) filter (where action_type = 'upgrade')::int as upgrade,
           count(*) filter (where action_type = 'downgrade')::int as downgrade
    from capos_activity_logs
    group by 1 order by 1 desc limit 12
  `);
  res.json(rows);
});

export default router;
