/** Định dạng ngày giờ theo giờ Việt Nam (UTC+7) cho khu quản trị. */

const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

/** Date dịch sang giờ VN: đọc bằng getUTC*() */
function vn(iso: string): Date {
  return new Date(Date.parse(iso) + 7 * 3600_000);
}
const p2 = (n: number) => String(n).padStart(2, '0');

/** "T3 10/11 23:59" */
export function vnDue(iso: string): string {
  const d = vn(iso);
  return `${WD[d.getUTCDay()]} ${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
}

/** "T3 10/11" (không giờ) */
export function vnDueDay(iso: string): string {
  const d = vn(iso);
  return `${WD[d.getUTCDay()]} ${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}`;
}

/** Ngày "YYYY-MM-DD" → "T6 06/11" */
export function dateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WD[wd]} ${p2(d)}/${p2(m)}`;
}

/** "HH:mm dd/mm" */
export function vnClock(iso: string): string {
  const d = vn(iso);
  return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} ${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}`;
}

/** Số ngày lịch (giờ VN) đã quá hạn; 0 = còn hạn */
export function overdueDays(iso: string, now = Date.now()): number {
  if (now <= Date.parse(iso)) return 0;
  const day = (t: number) => Math.floor((t + 7 * 3600_000) / 86400_000);
  return Math.max(1, day(now) - day(Date.parse(iso)));
}
