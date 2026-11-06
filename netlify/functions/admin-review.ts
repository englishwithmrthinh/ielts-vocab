/**
 * Màn Duyệt (cần cookie quản trị) — Claude 3, giai đoạn 2.
 *
 * GET  /api/admin/lessons/detail?id=…  → { lesson, words: Word[] (theo thứ tự ô), studentIds }
 * POST /api/admin/words/update  { id, patch }  → { word }   sửa text tại chỗ
 * POST /api/admin/words/drop-image { id }      → { word }   bỏ ảnh (câu dạng B, I sẽ tự đổi dạng)
 * GET  /api/admin/words/get?id=…                → { word }   (trang Câu báo lỗi mở thẻ để sửa)
 *
 * Sửa từ = sửa trong KHO TỔNG: buổi khác dùng chung từ này cũng thấy bản mới.
 * Không cho sửa chính "word" (đổi từ thì phải tạo lại audio, ảnh — tạo từ mới thì hơn).
 */
import type { Config } from '@netlify/functions';
import type { Lesson, Word } from '../../shared/types';
import { parseLessonJson } from '../../src/admin/lib/lessonSchema';
import { requireAdmin } from '../lib/auth';
import { errorResponse, HttpError, json, readJson } from '../lib/http';
import { db, must } from '../lib/supabase';

const EDITABLE = ['pos', 'meaning_vi', 'ipa', 'syllables', 'example', 'word_family', 'image_hint'] as const;

async function detail(id: string) {
  const lesson = must(await db().from('lessons').select('*').eq('id', id).single()) as Lesson;
  const rows = must(await db().from('lesson_words').select('position, words(*)').eq('lesson_id', id).order('position')) as unknown as { words: Word }[];
  const att = must(await db().from('attendance').select('student_id').eq('lesson_id', id)) as { student_id: string }[];
  return { lesson, words: rows.map((r) => r.words), studentIds: att.map((a) => a.student_id) };
}

async function update(body: { id?: string; patch?: Record<string, unknown> }): Promise<Word> {
  if (!body.id || !body.patch || typeof body.patch !== 'object') throw new HttpError(400, 'bad_input', 'Cần id và patch');
  const current = must(await db().from('words').select('*').eq('id', body.id).single()) as Word;
  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body.patch) patch[k] = body.patch[k];
  if (!Object.keys(patch).length) throw new HttpError(400, 'bad_input', 'Không có trường nào sửa được');

  // Kiểm tra lại bằng đúng bộ luật của Tạo buổi
  const merged = { ...current, ...patch };
  const check = parseLessonJson(JSON.stringify({ words: [merged] }));
  const err = check.issues.find((i) => i.level === 'error');
  if (err) throw new HttpError(400, 'bad_word', `${err.field}: ${err.message}`);
  const clean = check.words[0]!;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(patch) as (typeof EDITABLE)[number][]) out[k] = clean[k];
  if ('ipa' in patch && clean.ipa !== current.ipa) out.ipa_source = 'ai'; // giáo viên sửa tay

  const rows = must(await db().from('words').update(out).eq('id', body.id).select('*')) as Word[];
  return rows[0]!;
}

export default async (req: Request): Promise<Response> => {
  try {
    requireAdmin(req);
    const url = new URL(req.url);
    if (url.pathname === '/api/admin/lessons/detail' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) throw new HttpError(400, 'bad_input', 'Thiếu id');
      return json(await detail(id));
    }
    if (url.pathname === '/api/admin/words/get' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) throw new HttpError(400, 'bad_input', 'Thiếu id');
      const w = must(await db().from('words').select('*').eq('id', id).maybeSingle()) as Word | null;
      if (!w) throw new HttpError(404, 'not_found', 'Không tìm thấy từ');
      return json({ word: w });
    }
    if (url.pathname === '/api/admin/words/update' && req.method === 'POST') {
      return json({ word: await update(await readJson(req)) });
    }
    if (url.pathname === '/api/admin/words/drop-image' && req.method === 'POST') {
      const { id } = await readJson<{ id?: string }>(req);
      if (!id) throw new HttpError(400, 'bad_input', 'Thiếu id');
      const rows = must(await db().from('words').update({ image_url: null }).eq('id', id).select('*')) as Word[];
      return json({ word: rows[0] });
    }
    throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = { path: ['/api/admin/lessons/detail', '/api/admin/words/get', '/api/admin/words/update', '/api/admin/words/drop-image'] };
