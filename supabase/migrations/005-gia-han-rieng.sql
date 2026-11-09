-- 005 · Gia hạn riêng từng học sinh (09/11/2026). Chạy MỘT lần trong Supabase → SQL Editor. Chạy lại cũng không lỗi.
-- Mỗi dòng: học sinh X được nộp bài của mốc Y tới deadline_at (thay cho hạn chung của mốc, chỉ khi muộn hơn).
-- Để bảng riêng (không thêm cột vào assignments) vì bài chỉ có dòng assignments khi học sinh bấm Bắt đầu.
create table if not exists deadline_extensions (
  student_id   uuid not null references students(id) on delete cascade,
  milestone_id uuid not null references milestones(id) on delete cascade,
  deadline_at  timestamptz not null,
  created_at   timestamptz not null default now(),
  primary key (student_id, milestone_id)
);
create index if not exists deadline_extensions_milestone_idx on deadline_extensions (milestone_id);
alter table deadline_extensions enable row level security; -- chỉ server (service key) đọc/ghi
