# job-tracking-backend (Railway)

Backend baru pengganti Supabase — Express + Postgres, jalan di Railway.
Ini **build baru**, bukan migrasi data dari Supabase.

## 1. Deploy ke Railway

1. Buat project baru di Railway → **New Project**.
2. **Add plugin → PostgreSQL** di project itu (ini otomatis mengisi `DATABASE_URL`).
3. **New service → Deploy from GitHub repo** (push folder ini ke repo baru dulu), atau `railway up` dari CLI di folder ini.
4. Di tab **Variables** service backend, isi semua variabel dari `.env.example` (Railway akan otomatis menyambungkan `DATABASE_URL` dari plugin Postgres kalau kamu pakai fitur "Reference variable").
5. Jalankan migrasi sekali: dari Railway CLI, `railway run npm run migrate` (atau jalankan `schema/schema.sql` manual lewat tab **Data** di plugin Postgres).
6. Jadikan akun pertamamu admin: buka tab **Data** Postgres, jalankan
   `update users set is_admin = true where email = 'emailkamu@...';` setelah kamu register lewat app.
7. (Opsional) Buat service baru bertipe **Cron Job** di project yang sama untuk `daily-digest`: start command `node src/jobs/dailyDigest.js`, schedule `0 7 * * *`.

## 2. Jalan lokal

```bash
npm install
cp .env.example .env   # isi DATABASE_URL (boleh Postgres lokal) dan JWT_SECRET
npm run migrate
npm run dev
```

Server default di `http://localhost:8080`.

## 3. Yang masih perlu dikerjakan di frontend

Backend ini baru "separuh jalan" — frontend (`src/hooks/*`, `src/lib/supabaseClient.js`, `src/lib/capos.js`)
masih manggil `@supabase/supabase-js` langsung. Supaya app beneran jalan pakai backend ini, hook-hook itu perlu
ditulis ulang jadi manggil endpoint di bawah ini pakai `fetch`, dengan header `Authorization: Bearer <token>`
(token didapat dari `/auth/login` atau `/auth/register`, simpan di localStorage).

| Endpoint | Pengganti |
|---|---|
| `POST /auth/register`, `/auth/login`, `GET /auth/me` | `useAuth.js` |
| `GET/POST/PATCH/DELETE /applications` | `useApplications.js` |
| `GET/PUT /profile` | halaman Profil Saya |
| `GET/POST/DELETE /finance/accounts|expenses|targets` | `useFinance` (finance hooks) |
| `GET/POST /interview/sessions`, `/interview/sessions/:id/entries` | interview session hooks |
| `POST /misc/transcription-token` | `useLiveTranscription.js` (ganti `functions.invoke("generate-token")`) |
| `POST /ai/interview-response` | `useLiveTranscription.js` (ganti `get-ai-response`) |
| `POST /ai/tailor-cv`, `POST /ai/parse-profile` | halaman upload CV / tailor CV |
| `POST /misc/send-application` | tombol "Kirim Lamaran" |
| `GET /capos/summary`, `/capos/users`, `/capos/activity`, `/capos/trend` | `src/lib/capos.js`, `CaposApp.jsx` |

Google Login **tidak diikutkan** di build ini (sesuai kode lama, itu sudah cuma dipakai untuk transisi akun lama) —
kalau nanti dibutuhkan lagi, itu pekerjaan terpisah (OAuth2 flow manual, karena Railway tidak native seperti Supabase Auth).

Mau saya lanjutkan tulis ulang hook-hook frontend-nya juga supaya langsung nyambung ke backend ini?
