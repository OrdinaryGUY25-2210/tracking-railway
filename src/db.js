import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL belum di-set. Di Railway: tambahkan plugin PostgreSQL ke project ini, variabelnya otomatis muncul.');
}

// Railway Postgres butuh SSL tapi dengan certificate self-signed,
// jadi rejectUnauthorized harus false (bukan tanda database-nya tidak aman —
// ini standar untuk koneksi internal Railway).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

export function query(text, params) {
  return pool.query(text, params);
}
