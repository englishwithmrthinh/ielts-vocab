-- 002 · Chia học sinh theo lớp (06/11/2026). Chạy MỘT lần trong Supabase → SQL Editor. Chạy lại cũng không lỗi.
create table if not exists classes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists classes_name_uq on classes (lower(name));
alter table classes enable row level security;

alter table students add column if not exists class_id uuid references classes(id) on delete set null;
create index if not exists students_class_idx on students (class_id);
