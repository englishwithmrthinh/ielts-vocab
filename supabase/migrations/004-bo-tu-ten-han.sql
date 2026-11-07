-- 004 · Tên bộ từ + mốc hạn khi phát hành (08/11/2026). Chạy MỘT lần trong Supabase → SQL Editor. Chạy lại cũng không lỗi.
alter table lessons add column if not exists title text;                                                  -- tên bộ từ (để trống = "Bộ từ N")
alter table lessons add column if not exists due_milestone_id uuid references milestones(id) on delete set null; -- mốc đầu tiên từ mới phải làm
