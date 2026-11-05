/**
 * Job tự động: 00:00 ngày 25 giờ VN (= 17:00 UTC ngày 24) — tạo mốc tháng hiện tại
 * (nếu thiếu) và tháng sau. Chạy lại nhiều lần vẫn an toàn.
 */
import type { Config } from '@netlify/functions';
import { monthKey, nextMonth, vnDate } from '../../shared/time';
import { ensureMonth } from '../lib/milestones-db';

export default async (): Promise<Response> => {
  const thisMonth = monthKey(vnDate(new Date()));
  const a = await ensureMonth(thisMonth);
  const b = await ensureMonth(nextMonth(thisMonth));
  console.log(`cron-milestones: thêm ${a} mốc ${thisMonth}, ${b} mốc ${nextMonth(thisMonth)}`);
  return new Response('ok');
};

export const config: Config = { schedule: '0 17 24 * *' };
