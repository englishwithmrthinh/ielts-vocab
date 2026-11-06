/**
 * Ảnh minh hoạ vẽ tay (giáo viên vẽ bằng app Gemini, tải lên) — Claude 3.
 *
 * GET  /api/admin/images/prompts?lesson_id=…   → { grids: GridTask[] }   prompt lưới đã điền sẵn
 * GET  /api/admin/images/single-prompt?word_id=… → { prompt }
 * POST /api/admin/images/grid   { lesson_id, index, image }  → { updated, layout }  hoặc 422 nếu cắt không được
 * POST /api/admin/images/single { word_id, image }           → { word }
 *
 * `image` là data URL / base64 (trình duyệt đã thu cạnh dài ≤2048px để dưới giới hạn ~6 MB của Functions).
 * Cắt bằng grid.ts: tìm rãnh trắng thật, chấp nhận lưới xoay (5×4 thay vì 4×5). Cắt được mới ghi.
 */
import type { Config } from '@netlify/functions';
import type { Word } from '../../shared/types';
import { gridPlan } from '../../src/admin/lib/lessonSchema';
import { requireAdmin } from '../lib/auth';
import { errorResponse, HttpError, json, readJson } from '../lib/http';
import { db, must } from '../lib/supabase';
import { cutCells, detectGrid, toCell, toInfographic } from './pipeline-run-background/grid';
import { gridPrompt, mapLimit, singlePrompt, upload } from './pipeline-run-background/lib';

const MAX_BYTES = 8 * 1024 * 1024;

type W = Pick<Word, 'id' | 'word' | 'meaning_vi' | 'image_hint' | 'image_url'>;

async function lessonWords(lessonId: string): Promise<W[]> {
  const rows = must(
    await db().from('lesson_words').select('position, words(id,word,meaning_vi,image_hint,image_url)').eq('lesson_id', lessonId).order('position'),
  ) as unknown as { words: W }[];
  if (!rows.length) throw new HttpError(404, 'not_found', 'Buổi không có từ nào');
  return rows.map((r) => r.words);
}

function groups(words: W[]) {
  let offset = 0;
  return gridPlan(words.length).map((p, index) => {
    const g = words.slice(offset, offset + p.count);
    offset += p.count;
    return { index, cols: p.cols, rows: p.rows, words: g };
  });
}

function decodeImage(v: unknown): Buffer {
  if (typeof v !== 'string' || !v) throw new HttpError(400, 'no_image', 'Chưa có ảnh');
  const b64 = v.includes(',') ? v.slice(v.indexOf(',') + 1) : v;
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 1000) throw new HttpError(400, 'bad_image', 'Không đọc được ảnh');
  if (buf.length > MAX_BYTES) throw new HttpError(413, 'too_big', 'Ảnh quá lớn, chọn ảnh dưới 8 MB');
  return buf;
}

export default async (req: Request): Promise<Response> => {
  try {
    requireAdmin(req);
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/api/admin/images/prompts' && req.method === 'GET') {
      const lessonId = url.searchParams.get('lesson_id');
      if (!lessonId) throw new HttpError(400, 'bad_input', 'Thiếu lesson_id');
      const grids = groups(await lessonWords(lessonId)).map((g) => ({
        index: g.index,
        cols: g.cols,
        rows: g.rows,
        count: g.words.length,
        wordIds: g.words.map((w) => w.id),
        missing: g.words.filter((w) => !w.image_url).length,
        prompt: gridPrompt(g.words, g.cols, g.rows),
      }));
      return json({ grids });
    }

    if (path === '/api/admin/images/single-prompt' && req.method === 'GET') {
      const id = url.searchParams.get('word_id');
      if (!id) throw new HttpError(400, 'bad_input', 'Thiếu word_id');
      const w = must(await db().from('words').select('word,image_hint').eq('id', id).single()) as Pick<Word, 'word' | 'image_hint'>;
      return json({ prompt: singlePrompt(w) });
    }

    if (path === '/api/admin/images/grid' && req.method === 'POST') {
      const body = await readJson<{ lesson_id?: string; index?: number; image?: unknown }>(req);
      if (!body.lesson_id || typeof body.index !== 'number') throw new HttpError(400, 'bad_input', 'Thiếu lesson_id hoặc index');
      const img = decodeImage(body.image);
      const g = groups(await lessonWords(body.lesson_id))[body.index];
      if (!g) throw new HttpError(400, 'bad_input', 'Không có lưới số này');

      const grid = await detectGrid(img, { cols: g.cols, rows: g.rows });
      if (!grid.ok) {
        const found = grid.foundCols && grid.foundRows ? `Ảnh có ${grid.foundCols}×${grid.foundRows} ô` : 'Không thấy rãnh trắng giữa các ô';
        const extra = grid.foundCols && grid.foundRows && grid.foundCols * grid.foundRows === g.cols * g.rows ? ` (${grid.reason.toLowerCase()})` : '';
        throw new HttpError(422, 'grid_not_found', `${found}${extra}, cần ${g.cols}×${g.rows} = ${g.cols * g.rows} ô. Vẽ lại hoặc tải ảnh khác.`);
      }
      const cells = await cutCells(img, grid, g.words.length);
      // Ghi ảnh gốc trước; ảnh từng từ ghi song song có giới hạn
      const infographic = await upload(`infographic/${body.lesson_id}-${g.index + 1}.webp`, await toInfographic(img), 'image/webp');
      await mapLimit(g.words, 5, async (w, i) => {
        const imageUrl = await upload(`images/${w.id}.webp`, cells[i]!, 'image/webp');
        must(await db().from('words').update({ image_url: imageUrl }).eq('id', w.id));
      });
      const lesson = must(await db().from('lessons').select('infographic_urls').eq('id', body.lesson_id).single()) as { infographic_urls: string[] };
      const urls = [...(lesson.infographic_urls ?? [])];
      urls[g.index] = infographic;
      must(await db().from('lessons').update({ infographic_urls: urls.map((u) => u ?? '') }).eq('id', body.lesson_id));
      return json({ updated: g.words.length, layout: `${grid.cols.length}×${grid.rows.length}` });
    }

    if (path === '/api/admin/images/single' && req.method === 'POST') {
      const body = await readJson<{ word_id?: string; image?: unknown }>(req);
      if (!body.word_id) throw new HttpError(400, 'bad_input', 'Thiếu word_id');
      const imageUrl = await upload(`images/${body.word_id}.webp`, await toCell(decodeImage(body.image)), 'image/webp');
      const rows = must(await db().from('words').update({ image_url: imageUrl }).eq('id', body.word_id).select('*')) as Word[];
      return json({ word: rows[0] });
    }

    throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = {
  path: ['/api/admin/images/prompts', '/api/admin/images/single-prompt', '/api/admin/images/grid', '/api/admin/images/single'],
};
