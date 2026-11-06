/**
 * Job tự động 07:05 giờ VN mỗi ngày (00:05 UTC). Chủ sở hữu: Sếp.
 * Ngày 1: tạo bản tạm tính báo cáo tháng trước. Ngày 8: chốt báo cáo tháng trước.
 * Việc nặng (gọi Gemini) chạy ở monthly-reports-background.
 */
import type { Config } from '@netlify/functions';
import { monthKey, vnDate } from '../../shared/time';
import { envOptional } from '../lib/env';
import { jobKey } from '../lib/monthly';

function prevMonth(m: string): string {
  const [y, mm] = m.split('-').map(Number) as [number, number];
  return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`;
}

export default async (): Promise<Response> => {
  const today = vnDate(new Date());
  const day = Number(today.slice(8, 10));
  if (day !== 1 && day !== 8) return new Response('skip');
  const month = prevMonth(monthKey(today));
  const site = envOptional('URL') ?? envOptional('PUBLIC_SITE_URL') ?? 'https://hoctuvung-mrthinhclass.netlify.app';
  const r = await fetch(`${site}/api/jobs/monthly`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-job-key': jobKey() },
    body: JSON.stringify({ month, final: day === 8 }),
  });
  console.log(`cron-monthly: ${month} final=${day === 8} → ${r.status}`);
  return new Response('ok');
};

export const config: Config = { schedule: '5 0 * * *' };
