-- =====================================================================
-- Web ôn từ vựng IELTS — schema Supabase (Postgres)
-- Chủ sở hữu: Sếp (Claude 1). Người khác chỉ đọc; muốn đổi thì ghi
-- "Câu hỏi cho sếp" trong báo cáo.
--
-- Mọi truy cập đi qua Netlify Functions bằng service key.
-- RLS bật trên mọi bảng và KHÔNG có policy nào => trình duyệt (anon key)
-- không đọc/ghi được gì trực tiếp.
--
-- Thời gian lưu dạng timestamptz (UTC). Ngày lịch (date) luôn hiểu theo
-- giờ Việt Nam (Asia/Ho_Chi_Minh).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Học sinh ----------
create table if not exists students (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,              -- ví dụ HS07
  pin_hash    text not null,                     -- bcrypt
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- Kho từ tổng ----------
create table if not exists words (
  id          uuid primary key default gen_random_uuid(),
  word        text not null,                     -- luôn chữ thường
  pos         text not null check (pos in ('n','v','adj','adv','prep','conj','phr')),
  meaning_vi  text not null,
  ipa         text,
  ipa_source  text check (ipa_source in ('dict','ai')),
  syllables   text,                              -- en·VI·ron·ment
  example     text,
  word_family jsonb not null default '[]'::jsonb,-- [{form,pos,sentence}]
  image_url   text,
  audio_url   text,
  image_hint  text,
  origin      text not null default 'teacher' check (origin in ('teacher','student')),
  created_at  timestamptz not null default now()
);
create unique index if not exists words_word_pos_uq on words (lower(word), pos);

-- ---------- Buổi học ----------
create table if not exists lessons (
  id               uuid primary key default gen_random_uuid(),
  number           int not null,
  taught_on        date not null,
  status           text not null default 'draft'
                   check (status in ('draft','processing','review','published')),
  infographic_urls text[] not null default '{}',
  pipeline_log     jsonb not null default '[]'::jsonb,
  published_at     timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists lesson_words (
  lesson_id uuid not null references lessons(id) on delete cascade,
  word_id   uuid not null references words(id) on delete restrict,
  position  int  not null default 0,             -- thứ tự ô trong lưới ảnh
  primary key (lesson_id, word_id)
);

create table if not exists attendance (
  lesson_id  uuid not null references lessons(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  primary key (lesson_id, student_id)
);

-- ---------- Mốc (Thứ 3 / Thứ 6 / Chủ nhật) ----------
create table if not exists milestones (
  id          uuid primary key default gen_random_uuid(),
  idx         int unique,                        -- null khi is_off
  date        date not null unique,              -- ngày mốc (giờ VN)
  kind        text not null check (kind in ('tue','fri','sun')),
  opens_at    timestamptz not null,              -- 00:00 VN ngày sau mốc trước
  deadline_at timestamptz not null,              -- 23:59:59.999 VN ngày mốc
  month       text not null,                     -- 'YYYY-MM'
  is_off      boolean not null default false,
  check ((is_off and idx is null) or (not is_off and idx is not null))
);
create index if not exists milestones_month_idx on milestones (month);

-- ---------- Bài (mỗi học sinh × mỗi mốc) ----------
create table if not exists assignments (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students(id) on delete cascade,
  milestone_id   uuid not null references milestones(id) on delete cascade,
  status         text not null default 'locked'
                 check (status in ('locked','open','submitted','owing','abandoned','off')),
  started_at     timestamptz,
  submitted_at   timestamptz,
  days_late      int,                            -- chỉ có khi submitted
  score_pct      int,                            -- 100..30, 0 khi abandoned
  required_count int,                            -- số câu bắt buộc, chốt khi start
  answered_count int not null default 0,
  word_ids       uuid[] not null default '{}',   -- danh sách từ chốt lúc start
  unique (student_id, milestone_id)
);
create index if not exists assignments_student_idx on assignments (student_id, status);

-- ---------- Trạng thái ôn của từng từ với từng học sinh ----------
create table if not exists student_words (
  student_id       uuid not null references students(id) on delete cascade,
  word_id          uuid not null references words(id) on delete cascade,
  box              int  not null default 1 check (box between 1 and 6), -- 6 = Pass
  due_idx          int  not null,                -- đến hạn ở bài có idx <= due_idx
  introduced       boolean not null default false, -- đã qua phần xem trước
  typed_ok         boolean not null default false, -- đã từng gõ đúng
  wrong_count      int  not null default 0,
  last_answered_at timestamptz,
  assigned_at      timestamptz not null default now(),
  primary key (student_id, word_id)
);
create index if not exists student_words_due_idx on student_words (student_id, due_idx);

-- ---------- Từng câu trả lời ----------
create table if not exists answers (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  assignment_id uuid references assignments(id) on delete set null, -- null: luyện thêm
  word_id       uuid not null references words(id) on delete cascade,
  qtype         text not null check (qtype ~ '^[A-M]$'),
  mode          text not null check (mode in ('graded','fix','practice','retry')),
  given         text,
  correct       boolean not null,
  hint_code     text check (hint_code in ('extra_space','missing_space','one_letter','swapped')),
  box_before    int,
  box_after     int,
  flagged       boolean not null default false,  -- "Câu này có 2 đáp án đúng"
  created_at    timestamptz not null default now()
);
create index if not exists answers_student_time_idx on answers (student_id, created_at);
create index if not exists answers_assignment_idx on answers (assignment_id);

-- ---------- Câu hỏi đang phát (server giữ đáp án) ----------
create table if not exists pending_questions (
  qid           uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  assignment_id uuid references assignments(id) on delete cascade,
  payload       jsonb not null,                  -- Question gửi xuống
  answer_key    jsonb not null,                  -- đáp án, KHÔNG gửi xuống
  created_at    timestamptz not null default now()
);

-- ---------- Từ học sinh đề xuất ----------
create table if not exists suggestions (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  text       text not null,
  note       text,
  status     text not null default 'pending'
             check (status in ('pending','linked','added','rejected')),
  word_id    uuid references words(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Báo cáo tháng ----------
create table if not exists monthly_reports (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete cascade,
  month           text not null,                 -- 'YYYY-MM'
  token           text not null unique,          -- link phụ huynh
  stats           jsonb not null,
  ai_comment      text,
  teacher_comment text,
  status          text not null default 'draft' check (status in ('draft','final')),
  finalized_at    timestamptz,
  unique (student_id, month)
);

-- ---------- XP & huy hiệu ----------
create table if not exists xp_events (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  amount     int  not null,
  reason     text not null,
  created_at timestamptz not null default now()
);
create index if not exists xp_student_time_idx on xp_events (student_id, created_at);

create table if not exists badges (
  student_id uuid not null references students(id) on delete cascade,
  code       text not null,
  earned_at  timestamptz not null default now(),
  primary key (student_id, code)
);

-- ---------- Chống dò PIN ----------
create table if not exists login_attempts (
  id           bigint generated always as identity primary key,
  code         text not null,
  success      boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_code_time_idx on login_attempts (code, attempted_at);

-- ---------- RLS: bật hết, không policy ----------
do $$
declare t text;
begin
  foreach t in array array[
    'students','words','lessons','lesson_words','attendance','milestones',
    'assignments','student_words','answers','pending_questions','suggestions',
    'monthly_reports','xp_events','badges','login_attempts'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------- Storage ----------
-- Bucket công khai chỉ đọc cho audio/ảnh (ghi bằng service key).
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- ---------- Bổ sung 06/11/2026 ----------
-- Số buổi không được trùng (trả lời câu hỏi của Claude 3). Chạy lại cả file vẫn an toàn.
create unique index if not exists lessons_number_uq on lessons (number);

-- ---------- Lớp (migration 002) ----------
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

-- ---------- Mã theo ngày sinh (migration 003) ----------
alter table classes  add column if not exists code  text;
alter table students add column if not exists birth text;

-- ---------- Tên bộ từ + mốc hạn (migration 004) ----------
alter table lessons add column if not exists title text;
alter table lessons add column if not exists due_milestone_id uuid references milestones(id) on delete set null;
