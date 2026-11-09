/**
 * Buổi học (cần cookie quản trị) — Claude 3, giai đoạn 1.
 *
 * GET  /api/admin/lessons              → { lessons: LessonSummary[] (TẤT CẢ bộ; kèm class_names, class_ids, unassigned_count,
 *                                          submitted_count, owing_count, overdue), nextNumber }
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
import { allRows, db, must } from '../lib/supabase';
import { loadExtensions } from '../lib/extensions';
import { loadFirstIdx } from '../lib/first-due';
import { extKey, withExtension } from '../../shared/deadlines';
import { beforeFirst } from '../../shared/first-due';
import { unsubmittedStatus } from '../../shared/lateness';

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
  const now = new Date().toISOString();
  // Không giới hạn số bộ; đọc theo trang để không bị cắt ở 1000 dòng
  const [lessons, words, att, stuR, clsR, ext] = await Promise.all([
    allRows((f, t) => db().from('lessons').select('id,number,taught_on,status,published_at,created_at,title,due_milestone_id,dm:milestones(date,kind,deadline_at,opens_at,idx,is_off)')
      .order('taught_on', { ascending: false }).order('number', { ascending: false }).range(f, t)) as unknown as Promise<(Pick<Lesson, 'id' | 'number' | 'taught_on' | 'status' | 'published_at' | 'created_at'> & {
        title: string | null; due_milestone_id: string | null;
        dm: { date: string; kind: string; deadline_at: string; opens_at: string; idx: number | null; is_off: boolean } | null;
      })[]>,
    allRows<{ lesson_id: string }>((f, t) => db().from('lesson_words').select('lesson_id').range(f, t)),
    allRows<{ lesson_id: string; student_id: string }>((f, t) => db().from('attendance').select('lesson_id,student_id').range(f, t)),
    db().from('students').select('id,class_id,active'),
    db().from('classes').select('id,name'),
    loadExtensions(),
  ]);
  const wordCount = new Map<string, number>();
  for (const w of words) wordCount.set(w.lesson_id, (wordCount.get(w.lesson_id) ?? 0) + 1);
  const attBy = new Map<string, string[]>();
  for (const a of att) (attBy.get(a.lesson_id) ?? attBy.set(a.lesson_id, []).get(a.lesson_id)!).push(a.student_id);
  const nextNumber = lessons.reduce((m, l) => Math.max(m, l.number), 0) + 1;

  const classOf = new Map((must(stuR) as { id: string; class_id: string | null }[]).map((s) => [s.id, s.class_id]));
  const className = new Map((must(clsR) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  // Trạng thái nộp ở mốc hạn của từng bộ đã phát hành (hạn riêng + "chưa có từ thì chưa có bài")
  const dueIds = [...new Set(lessons.filter((l) => l.status === 'published' && l.due_milestone_id).map((l) => l.due_milestone_id!))];
  const [asg, first] = await Promise.all([
    dueIds.length
      ? allRows<{ student_id: string; milestone_id: string; status: string }>((f, t) => db().from('assignments').select('student_id,milestone_id,status').in('milestone_id', dueIds).range(f, t))
      : Promise.resolve([]),
    dueIds.length ? loadFirstIdx() : Promise.resolve(new Map<string, number>()),
  ]);
  const submitted = new Set(asg.filter((a) => a.status === 'submitted').map((a) => `${a.student_id}|${a.milestone_id}`));

  return {
    lessons: lessons.map(({ dm, ...l }) => {
      const sids = attBy.get(l.id) ?? [];
      const names = new Set<string>();
      const cids = new Set<string>();
      let unassigned = 0;
      for (const sid of sids) {
        const cid = classOf.get(sid);
        const name = cid ? className.get(cid) : undefined;
        if (cid && name) { names.add(name); cids.add(cid); } else unassigned++;
      }
      let submittedCount = 0;
      let owingCount = 0;
      if (l.status === 'published' && dm && l.due_milestone_id) {
        const m = { id: l.due_milestone_id, ...dm };
        for (const sid of sids) {
          if (submitted.has(`${sid}|${m.id}`)) { submittedCount++; continue; }
          if (beforeFirst(m, first.get(sid))) continue;
          const st = unsubmittedStatus(withExtension(m, ext.get(extKey(sid, m.id))), now);
          if (st === 'owing' || st === 'abandoned') owingCount++;
        }
      }
      return {
        ...l,
        due: dm ? { date: dm.date, kind: dm.kind, deadline_at: dm.deadline_at } : null,
        word_count: wordCount.get(l.id) ?? 0,
        student_count: sids.length,
        class_names: [...names].sort((a, b) => a.localeCompare(b, 'vi')),
        class_ids: [...cids],
        unassigned_count: unassigned,
        submitted_count: submittedCount,
        owing_count: owingCount,
        overdue: owingCount > 0,
      };
    }),
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
