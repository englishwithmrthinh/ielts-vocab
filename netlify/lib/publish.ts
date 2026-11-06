/**
 * Phát hành một buổi: gán từ của buổi cho học sinh, vào H1, đến hạn ở bài kế tiếp.
 * Chủ sở hữu: Sếp. Claude 3 gọi từ function admin-publish.
 *
 *   const r = await publishLesson(lessonId, studentIds);
 *   // r = { assigned, skipped, dueIdx }
 *
 * - Chạy lại an toàn: học sinh đã có từ đó thì bỏ qua (giữ nguyên tiến độ cũ), tính vào `skipped`.
 * - Gọi lại để thêm học sinh vào một buổi đã phát hành cũng được.
 * - Học sinh được thêm vào attendance nếu chưa có.
 */
import { HttpError } from './http';
import { db, must } from './supabase';

export interface PublishResult {
  /** Số cặp (học sinh, từ) mới được gán */
  assigned: number;
  /** Số cặp đã có từ trước nên bỏ qua */
  skipped: number;
  /** idx mốc mà từ mới sẽ đến hạn */
  dueIdx: number;
}

/** idx của bài kế tiếp: mốc không-nghỉ đầu tiên chưa hết hạn */
export async function nextMilestoneIdx(nowIso = new Date().toISOString()): Promise<number> {
  const rows = must(
    await db().from('milestones').select('idx').eq('is_off', false).gte('deadline_at', nowIso)
      .order('deadline_at', { ascending: true }).limit(1),
  ) as { idx: number }[];
  if (!rows[0]) throw new HttpError(409, 'no_milestone', 'Chưa có mốc sắp tới. Mở Lịch mốc để tạo tháng mới.');
  return rows[0].idx;
}

export async function publishLesson(lessonId: string, studentIds: string[]): Promise<PublishResult> {
  if (!studentIds.length) throw new HttpError(400, 'no_students', 'Chưa chọn học sinh nhận từ');

  const lesson = must(await db().from('lessons').select('id,status,published_at').eq('id', lessonId).maybeSingle()) as
    { id: string; status: string; published_at: string | null } | null;
  if (!lesson) throw new HttpError(404, 'not_found', 'Không tìm thấy buổi học');
  if (lesson.status === 'processing') {
    throw new HttpError(409, 'still_processing', 'Buổi đang tạo audio/ảnh. Đợi chạy xong rồi phát hành.');
  }

  const wordRows = must(await db().from('lesson_words').select('word_id').eq('lesson_id', lessonId)) as { word_id: string }[];
  if (!wordRows.length) throw new HttpError(409, 'empty_lesson', 'Buổi này chưa có từ nào');

  const dueIdx = await nextMilestoneIdx();
  const pairs = studentIds.flatMap((student_id) =>
    wordRows.map(({ word_id }) => ({ student_id, word_id, box: 1, due_idx: dueIdx })),
  );

  const inserted = must(
    await db().from('student_words')
      .upsert(pairs, { onConflict: 'student_id,word_id', ignoreDuplicates: true })
      .select('word_id'),
  ) as { word_id: string }[];

  must(
    await db().from('attendance')
      .upsert(studentIds.map((student_id) => ({ lesson_id: lessonId, student_id })), {
        onConflict: 'lesson_id,student_id', ignoreDuplicates: true,
      }),
  );

  must(
    await db().from('lessons')
      .update({ status: 'published', published_at: lesson.published_at ?? new Date().toISOString() })
      .eq('id', lessonId),
  );

  return { assigned: inserted.length, skipped: pairs.length - inserted.length, dueIdx };
}
