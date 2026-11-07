/**
 * Xoá một bộ từ. Chủ sở hữu: Sếp. Cần cookie admin.
 * POST /api/admin/lessons/delete { id } → { ok, removedWords, affectedStudents }
 *
 * - Từ CHỈ thuộc bộ này: gỡ khỏi kho từ của các học sinh được giao bộ này, gỡ khỏi các bài chưa nộp
 *   (giảm số câu bắt buộc tương ứng), rồi xoá hẳn từ nếu chưa ai trả lời.
 * - Từ cũng nằm trong bộ khác: giữ nguyên.
 * - Bài đã nộp, điểm, XP giữ nguyên.
 */
import type { Config } from '@netlify/functions';
import { requireAdmin } from '../lib/auth';
import { errorResponse, HttpError, json, readJson } from '../lib/http';
import { db, must } from '../lib/supabase';

async function removeLesson(id: string) {
  const [lwR, attR] = await Promise.all([
    db().from('lesson_words').select('word_id').eq('lesson_id', id),
    db().from('attendance').select('student_id').eq('lesson_id', id),
  ]);
  const wordIds = (must(lwR) as { word_id: string }[]).map((r) => r.word_id);
  const studentIds = (must(attR) as { student_id: string }[]).map((r) => r.student_id);
  const exists = must(await db().from('lessons').select('id').eq('id', id).maybeSingle());
  if (!exists) throw new HttpError(404, 'not_found', 'Không tìm thấy bộ từ');

  // Từ nằm trong bộ khác thì giữ
  const shared = wordIds.length
    ? new Set((must(await db().from('lesson_words').select('word_id').in('word_id', wordIds).neq('lesson_id', id)) as { word_id: string }[]).map((r) => r.word_id))
    : new Set<string>();
  const only = wordIds.filter((w) => !shared.has(w));

  if (only.length && studentIds.length) {
    // Gỡ khỏi các bài chưa nộp
    const open = must(await db().from('assignments').select('id,word_ids,required_count').in('student_id', studentIds).neq('status', 'submitted')) as
      { id: string; word_ids: string[]; required_count: number | null }[];
    const drop = new Set(only);
    await Promise.all(open.filter((a) => a.word_ids.some((w) => drop.has(w))).map((a) => {
      const keep = a.word_ids.filter((w) => !drop.has(w));
      const removed = a.word_ids.length - keep.length;
      return db().from('assignments').update({ word_ids: keep, required_count: Math.max(0, (a.required_count ?? 0) - removed) }).eq('id', a.id).then(must);
    }));
    must(await db().from('pending_questions').delete().in('student_id', studentIds));
    must(await db().from('student_words').delete().in('student_id', studentIds).in('word_id', only));
  }

  must(await db().from('lessons').delete().eq('id', id)); // lesson_words, attendance xoá theo

  // Xoá hẳn từ chưa ai trả lời (còn câu trả lời thì giữ để không mất lịch sử)
  let removedWords = 0;
  if (only.length) {
    const answered = new Set((must(await db().from('answers').select('word_id').in('word_id', only)) as { word_id: string }[]).map((r) => r.word_id));
    const free = only.filter((w) => !answered.has(w));
    if (free.length) {
      await db().from('student_words').delete().in('word_id', free);
      const r = await db().from('words').delete().in('id', free).select('id');
      removedWords = (r.data ?? []).length;
    }
  }
  return { ok: true, removedWords, affectedStudents: studentIds.length };
}

export default async (req: Request): Promise<Response> => {
  try {
    requireAdmin(req);
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
    const { id } = await readJson<{ id?: string }>(req);
    if (!id) throw new HttpError(400, 'bad_input', 'Thiếu id');
    return json(await removeLesson(id));
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = { path: '/api/admin/lessons/delete' };
