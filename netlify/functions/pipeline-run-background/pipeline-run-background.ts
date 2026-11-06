/**
 * Background Function (chạy tối đa 15 phút, Netlify trả 202 ngay) — Claude 3.
 * POST /api/admin/pipeline/run  { lesson_id }
 * Tiến trình ghi vào lessons.pipeline_log; màn admin đọc lại để hiện thanh tiến trình.
 */
import type { Config } from '@netlify/functions';
import { requireAdmin } from '../../lib/auth';
import { readJson } from '../../lib/http';
import { db } from '../../lib/supabase';
import { ttsFromEnv } from './lib';
import { realDeps, runPipeline, SkipRun } from './run';

export default async (req: Request): Promise<void> => {
  let lessonId = '';
  try {
    requireAdmin(req);
    ({ lesson_id: lessonId = '' } = await readJson<{ lesson_id?: string }>(req));
    if (!lessonId) return;
    const started = Date.now();
    const sum = await runPipeline(lessonId, realDeps(ttsFromEnv()));
    console.log('pipeline xong', lessonId, `${Math.round((Date.now() - started) / 1000)}s`, JSON.stringify(sum));
  } catch (e) {
    if (e instanceof SkipRun) {
      console.log('pipeline bỏ qua', lessonId, e.message);
      return;
    }
    console.error('pipeline lỗi', lessonId, e);
    if (lessonId) {
      // không để buổi kẹt ở "processing": trả về draft kèm lỗi để chạy lại
      const row = await db().from('lessons').select('pipeline_log').eq('id', lessonId).single();
      const log = Array.isArray(row.data?.pipeline_log) ? row.data.pipeline_log : [];
      await db()
        .from('lessons')
        .update({ status: 'draft', pipeline_log: [...log, { at: new Date().toISOString(), step: 'error', message: `Dừng: ${(e as Error).message}` }] })
        .eq('id', lessonId)
        .neq('status', 'published');
    }
  }
};

// Tên thư mục/file kết thúc bằng "-background" → Netlify chạy dạng Background Function.
export const config: Config = { path: '/api/admin/pipeline/run' };
