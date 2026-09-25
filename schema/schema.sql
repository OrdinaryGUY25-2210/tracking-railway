-- ============================================================
--  Skema Postgres untuk Railway — job-tracking-main
--  Build baru, BUKAN migrasi dari Supabase. Beda utama dari versi
--  Supabase:
--    - Tidak ada "auth.users" — tabel "users" di sini adalah satu-
--      satunya sumber identitas, dikelola sendiri oleh backend
--      (password di-hash pakai bcrypt, bukan Supabase Auth).
--    - Tidak ada Row Level Security. Otorisasi "user cuma boleh
--      lihat datanya sendiri" sekarang ditegakkan di kode backend
--      (setiap query difilter WHERE user_id = req.user.id), bukan
--      di level database. Koneksi Postgres dari Railway dipercaya
--      penuh (setara service role key di Supabase) karena hanya
--      backend yang boleh connect ke sini, browser tidak pernah
--      connect langsung ke database ini.
--    - Tabel "profiles" (mirror auth.users di versi Supabase) sudah
--      digabung ke tabel "users" langsung — tidak perlu tabel
--      bayangan lagi karena kita yang punya penuh tabel users.
--  Jalankan file ini SEKALI di database Postgres Railway yang baru
--  (kosong). extension pgcrypto dibutuhkan untuk gen_random_uuid().
-- ============================================================

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- users — identitas + status langganan (dulu "auth.users" + "profiles")
-- ------------------------------------------------------------
create table users (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null unique,
  password_hash      text not null,
  full_name          text,
  avatar_url         text,
  subscription_tier  text not null default 'free'
                        check (subscription_tier in ('free', 'pro', 'supreme')),
  status             text not null default 'aktif'
                        check (status in ('aktif', 'nonaktif', 'suspended')),
  is_admin           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index users_subscription_tier_idx on users (subscription_tier);
create index users_created_at_idx on users (created_at desc);

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- capos_activity_logs — log signup & perubahan tier (dashboard caPOS)
-- ------------------------------------------------------------
create table capos_activity_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete cascade,
  full_name    text,
  email        text,
  action_type  text not null default 'other'
                 check (action_type in ('signup', 'upgrade', 'downgrade', 'cancel', 'other')),
  description  text,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index capos_activity_logs_created_at_idx on capos_activity_logs (created_at desc);
create index capos_activity_logs_is_read_idx on capos_activity_logs (is_read);

create or replace function log_capos_tier_change()
returns trigger
language plpgsql
as $$
declare
  v_action text;
  v_rank_old int;
  v_rank_new int;
begin
  if new.subscription_tier = old.subscription_tier then
    return new;
  end if;
  v_rank_old := case old.subscription_tier when 'free' then 0 when 'pro' then 1 when 'supreme' then 2 end;
  v_rank_new := case new.subscription_tier when 'free' then 0 when 'pro' then 1 when 'supreme' then 2 end;
  v_action := case when v_rank_new > v_rank_old then 'upgrade' else 'downgrade' end;

  insert into capos_activity_logs (user_id, full_name, email, action_type, description)
  values (new.id, new.full_name, new.email, v_action,
          format('Berpindah dari tier %s ke %s', initcap(old.subscription_tier), initcap(new.subscription_tier)));
  return new;
end;
$$;

create trigger users_log_tier_change
  after update of subscription_tier on users
  for each row execute function log_capos_tier_change();

create or replace function log_capos_signup()
returns trigger
language plpgsql
as $$
begin
  insert into capos_activity_logs (user_id, full_name, email, action_type, description)
  values (new.id, new.full_name, new.email, 'signup', 'Mendaftar sebagai pengguna baru (Free tier)');
  return new;
end;
$$;

create trigger users_log_signup
  after insert on users
  for each row execute function log_capos_signup();

-- ------------------------------------------------------------
-- applications — data lamaran kerja
-- ------------------------------------------------------------
create table applications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  company          text not null,
  position         text not null,
  status           text not null default 'applied'
                      check (status in ('applied', 'interview', 'offer', 'rejected', 'accepted')),
  job_description  text,
  cover_letter     text,
  cv_data          jsonb,
  applied_at       timestamptz not null default now(),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index applications_user_id_idx on applications (user_id);
create index applications_status_idx on applications (status);

create trigger applications_set_updated_at
  before update on applications
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- profile — data CV / portofolio pengguna (satu baris per user)
-- ------------------------------------------------------------
create table profile (
  user_id      uuid primary key references users(id) on delete cascade,
  full_name    text,
  tagline      text,
  email        text,
  phone        text,
  location     text,
  summary      text,
  skills       jsonb default '[]',
  experience   jsonb default '[]',
  education    jsonb default '[]',
  projects     jsonb default '[]',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profile_set_updated_at
  before update on profile
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- interview_sessions & transcript_entries
-- ------------------------------------------------------------
create table interview_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  title       text,
  language    text default 'id',
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  created_at  timestamptz not null default now()
);

create index interview_sessions_user_id_idx on interview_sessions (user_id);

create table transcript_entries (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references interview_sessions(id) on delete cascade,
  speaker      text,
  text         text not null,
  ai_response  text,
  created_at   timestamptz not null default now()
);

create index transcript_entries_session_id_idx on transcript_entries (session_id);

-- ------------------------------------------------------------
-- finance_* — pembukuan keuangan pribadi pengguna
-- ------------------------------------------------------------
create table finance_accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null,
  type        text default 'cash',
  balance     numeric(14,2) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index finance_accounts_user_id_idx on finance_accounts (user_id);

create trigger finance_accounts_set_updated_at
  before update on finance_accounts
  for each row execute function set_updated_at();

create table finance_expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  account_id  uuid references finance_accounts(id) on delete set null,
  category    text,
  amount      numeric(14,2) not null,
  note        text,
  spent_at    timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index finance_expenses_user_id_idx on finance_expenses (user_id);
create index finance_expenses_spent_at_idx on finance_expenses (spent_at desc);

create table finance_targets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  category     text,
  monthly_cap  numeric(14,2) not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index finance_targets_user_id_idx on finance_targets (user_id);

create trigger finance_targets_set_updated_at
  before update on finance_targets
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Jadikan dirimu admin pertama (jalankan manual sekali, ganti email).
-- ------------------------------------------------------------
-- update users set is_admin = true where email = 'emailkamu@gmail.com';

-- ============================================================
--  Selesai. 8 tabel siap dipakai oleh backend Express di src/.
-- ============================================================
