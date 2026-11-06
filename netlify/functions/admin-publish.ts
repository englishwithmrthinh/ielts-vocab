/**
 * Phát hành buổi (cần cookie quản trị) — Claude 3.
 * POST /api/admin/lessons/publish { lesson_id, student_ids } → { assigned, skipped, dueIdx, students }
 * Gọi publishLesson của sếp (netlify/lib/publish.ts). Chạy lại an toàn: dùng cả để
 * thêm học sinh vào buổi đã phát hành.
 */
import type { Config } from '@netlify/functions';
import { requireAdmin } from '../lib/auth';
import { handler, HttpError, json, readJson } from '../lib/http';
import { publishLesson } from '../lib/publish';

export default handler(['POST'], async (req) => {
  requireAdmin(req);
  const { lesson_id, student_ids } = await readJson<{ lesson_id?: string; student_ids?: unknown }>(req);
  if (!lesson_id) throw new HttpError(400, 'bad_input', 'Thiếu lesson_id');
  if (!Array.isArray(student_ids) || !student_ids.every((s) => typeof s === 'string')) {
    throw new HttpError(400, 'bad_input', 'Danh sách học sinh không hợp lệ');
  }
  const ids = [...new Set(student_ids as string[])];
  const r = await publishLesson(lesson_id, ids);
  return json({ ...r, students: ids.length });
});

export const config: Config = { path: '/api/admin/lessons/publish' };
