-- 003 · Mã học sinh = mã lớp + ngày sinh (06/11/2026). Chạy MỘT lần trong Supabase → SQL Editor. Chạy lại cũng không lỗi.
alter table classes  add column if not exists code  text;   -- 2 chữ in hoa, giáo viên sửa được
alter table students add column if not exists birth text;   -- chuỗi số ngày sinh, ví dụ 15032008
