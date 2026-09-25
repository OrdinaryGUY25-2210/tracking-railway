// Jalankan sekali: npm run migrate
// Membaca schema/schema.sql lalu mengeksekusinya ke DATABASE_URL Railway.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema', 'schema.sql'), 'utf-8');
  console.log('Menjalankan schema.sql ke database...');
  await pool.query(sql);
  console.log('Selesai. Tabel sudah dibuat.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migrasi gagal:', err.message);
  process.exit(1);
});
