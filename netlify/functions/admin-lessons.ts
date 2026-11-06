/**
 * Buổi học (cần cookie quản trị) — Claude 3, giai đoạn 1.
 *
 * GET  /api/admin/lessons              → { lessons: LessonSummary[] (kèm class_names, unassigned_count), nextNumber }
 * POST /api/admin/lessons/check  { words: {word,pos}[] }
 *      → { existing: { word, pos, id, has_audio, has_image }[] }   (từ đã có trong kho tổng)
 * POST /api/admin/lessons        { number, taught_on, student_ids, json }
 *      → { lesson, reused, created }   tạo buổi ở trạng thái draft
 *
 * Kiểm tra JSON bằng cùng bộ luật với trình duyệt (src/admin/lib/lessonSchema.ts).
 * Từ đã có (cùng từ + loại từ) thì dùng lại, không ghi đè, không tạo lại media.
 */
import type { Config } from '@netlify/functions';
import type { Lesson, PartOfSpeech } from '../../shared/types';
import { parseLessonJson, normWord, type LessonWordInput } from '../../src/admin/lib/lessonSchema';
import { requireAdmin } from '../lib/auth';
import { errorResponse, HttpError, json, readJson } from '../lib/http';
import { db, must } from '../lib/supabase';

interface WordRow { id: string; word: string; pos: PartOfSpeech; audio_url: string | null; image_url: string | null }

async function findExisting(items: { word: string; pos: string }[]): Promise<Map<string, WordRow>> {
  const out = new Map<string, WordRow>();
  const texts = [...new Set(items.map((i) => normWord(i.word)))];
  if (!texts.length) return out;
  const rows = must(await db().from('words').select('id,word,pos,audio_url,image_url').in('word', texts)) as WordRow[];
  for (const r of rows) out.set(`${normWord(r.word)}|${r.pos}`, r);
  return out;
}

async function listLessons() {
  const lessons = must(
    await db().from('lessons').select('id,number,taught_on,status,published_at,created_at').order('taught_on', { ascending: false }).limit(200),
  ) as Pick<Lesson, 'id' | 'number' | 'taught_on' | 'status' | 'published_at' | 'created_at'>[];
  const ids = lessons.map((l) => l.id);
  const words = ids.length ? (must(await db().from('lesson_words').select('lesson_id').in('lesson_id', ids)) as { lesson_id: string }[]) : [];
  const att = ids.length ? (must(await db().from('attendance').select('lesson_id,student_id').in('lesson_id', ids)) as { lesson_id: string; student_id: string }[]) : [];
  const count = (rows: { lesson_id: string }[], id: string) => rows.filter((r) => r.lesson_id === id).length;
  const nextNumber = lessons.reduce((m, l) => Math.max(m, l.number), 0) + 1;

  // "Giao cho: Lớp A, Lớp B" — lớp hiện tại của các học sinh được giao
  const [stuR, clsR] = await Promise.all([db().from('students').select('id,class_id'), db().from('classes').select('id,name')]);
  const classOf = new Map((must(stuR) as { id: string; class_id: string | null }[]).map((s) => [s.id, s.class_id]));
  const className = new Map((must(clsR) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const classesFor = (lessonId: string) => {
    const names = new Set<string>();
    let unassigned = 0;
    for (const a of att) {
      if (a.lesson_id !== lessonId) continue;
      const cid = classOf.get(a.student_id);
      const name = cid ? className.get(cid) : undefined;
      if (name) names.add(name);
      else unassigned++;
    }
    return { class_names: [...names].sort((a, b) => a.localeCompare(b, 'vi')), unassigned_count: unassigned };
  };
  return {
    lessons: lessons.map((l) => ({ ...l, word_count: count(words, l.id), student_count: count(att, l.id), ...classesFor(l.id) })),
    nextNumber,
  };
}

async function createLesson(body: { number?: unknown; taught_on?: unknown; student_ids?: unknown; json?: unknown }) {
  const number = Number(body.number);
  if (!Number.isInteger(number) || number < 1 || number > 9999) throw new HttpError(400, 'bad_number', 'Số buổi phải là số nguyên dương');
  const taughtOn = String(body.taught_on ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(taughtOn)) throw new HttpError(400, 'bad_date', 'Ngày dạy dạng YYYY-MM-DD');
  const studentIds = body.student_ids;
  if (!Array.isArray(studentIds) || !studentIds.every((s) => typeof s === 'string')) {
    throw new HttpError(400, 'bad_input', 'Danh sách học sinh không hợp lệ');
  }
  if (!studentIds.length) throw new HttpError(400, 'no_students', 'Chưa tick học sinh có mặt');

  const parsed = parseLessonJson(typeof body.json === 'string' ? body.json : JSON.stringify(body.json ?? ''));
  if (!parsed.ok) {
    const first = parsed.issues.find((i) => i.level === 'error')!;
    throw new HttpError(400, 'bad_json', `${first.word ? `"${first.word}" · ` : ''}${first.field}: ${first.message}`);
  }

  const taken = must(await db().from('lessons').select('id').eq('number', number).limit(1)) as { id: string }[];
  if (taken.length) throw new HttpError(409, 'lesson_number_taken', `Buổi số ${number} đã có. Chọn số khác.`);

  const existing = await findExisting(parsed.words);
  const toInsert: LessonWordInput[] = parsed.words.filter((w) => !existing.has(`${w.word}|${w.pos}`));
  if (toInsert.length) {
    const rows = must(
      await db()
        .from('words')
        .insert(toInsert.map((w) => ({ ...w, ipa_source: w.ipa ? 'ai' : null, origin: 'teacher' })))
        .select('id,word,pos,audio_url,image_url'),
    ) as WordRow[];
    for (const r of rows) existing.set(`${normWord(r.word)}|${r.pos}`, r);
  }

  const ins = await db().from('lessons').insert({ number, taught_on: taughtOn, status: 'draft' }).select('*').single();
  if ((ins.error as { code?: string } | null)?.code === '23505') {
    throw new HttpError(409, 'lesson_number_taken', `Buổi số ${number} đã có. Chọn số khác.`);
  }
  const lesson = must(ins) as Lesson;
  try {
    must(
      await db().from('lesson_words').insert(
        parsed.words.map((w, position) => ({ lesson_id: lesson.id, word_id: existing.get(`${w.word}|${w.pos}`)!.id, position })),
      ),
    );
    must(await db().from('attendance').insert(studentIds.map((student_id) => ({ lesson_id: lesson.id, student_id }))));
  } catch (e) {
    // Không để lại buổi dở dang (từ mới vẫn nằm trong kho, lần sau dùng lại được)
    await db().from('lessons').delete().eq('id', lesson.id);
    throw e;
  }
  return { lesson, reused: parsed.words.length - toInsert.length, created: toInsert.length };
}

export default async (req: Request): Promise<Response> => {
  try {
    requireAdmin(req);
    const path = new URL(req.url).pathname;
    if (path === '/api/admin/lessons' && req.method === 'GET') return json(await listLessons());
    if (path === '/api/admin/lessons' && req.method === 'POST') return json(await createLesson(await readJson(req)));
    if (path === '/api/admin/lessons/check' && req.method === 'POST') {
      const { words } = await readJson<{ words?: { word: string; pos: string }[] }>(req);
      if (!Array.isArray(words)) throw new HttpError(400, 'bad_input', 'Cần danh sách words');
      const found = await findExisting(words.filter((w) => typeof w?.word === 'string').slice(0, 100));
      return json({
        existing: [...found.values()].map((r) => ({ word: r.word, pos: r.pos, id: r.id, has_audio: !!r.audio_url, has_image: !!r.image_url })),
      });
    }
    throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = { path: ['/api/admin/lessons', '/api/admin/lessons/check'] };
