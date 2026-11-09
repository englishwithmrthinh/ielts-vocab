/**
 * Background Function (tối đa 15 phút) — tạo/chốt báo cáo tháng. Chủ sở hữu: Sếp.
 * POST /api/jobs/monthly { month: "YYYY-MM", final: boolean, rewrite_ai?: boolean }
 *   final=false = "Tính lại số liệu" bản tạm tính cho cả tháng; rewrite_ai = viết lại nhận xét AI. Trả 202 ngay, chạy nền ~1–3 phút.
 * Gọi bởi cron-monthly (header x-job-key) hoặc giáo viên (cookie admin, qua nút trong admin).
 */
import type { Config } from '@netlify/functions';
import { timingSafeEqual } from 'node:crypto';
import { requireAdmin } from '../lib/auth';
import { readJson } from '../lib/http';
import { jobKey, runMonthly } from '../lib/monthly';

function isJob(req: Request): boolean {
  const a = Buffer.from(req.headers.get('x-job-key') ?? '');
  const b = Buffer.from(jobKey());
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async (req: Request): Promise<void> => {
  try {
    if (!isJob(req)) requireAdmin(req);
    const { month = '', final = false, rewrite_ai = false } = await readJson<{ month?: string; final?: boolean; rewrite_ai?: boolean }>(req);
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    const t = Date.now();
    const r = await runMonthly(month, !!final, undefined, { rewriteAi: !!rewrite_ai && !final });
    console.log(`monthly ${month} final=${final}: ${r.reports} báo cáo, ${r.comments} nhận xét AI, ${Math.round((Date.now() - t) / 1000)}s`);
  } catch (e) {
    console.error('monthly lỗi', e);
  }
};

export const config: Config = { path: '/api/jobs/monthly' };
