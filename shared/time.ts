/**
 * Mọi phép tính ngày giờ của dự án đi qua file này. Giờ Việt Nam.
 * Dùng Intl (có sẵn trong trình duyệt và Node), không cần thư viện ngoài.
 * Ngày lịch ("YYYY-MM-DD") được tính toán thuần theo lịch (UTC làm nền),
 * chỉ khi đổi sang/từ thời điểm thật mới dùng múi giờ.
 */
import type { ISODate, ISODateTime, MonthKey } from './types';

export const TZ = 'Asia/Ho_Chi_Minh';

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});
const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
});

function toDate(at: ISODateTime | Date): Date {
  return typeof at === 'string' ? new Date(at) : at;
}

/** Độ lệch (ms) của giờ VN so với UTC tại một thời điểm */
function tzOffsetMs(instant: number): number {
  const p: Record<string, number> = {};
  for (const { type, value } of partsFmt.formatToParts(new Date(instant))) {
    if (type !== 'literal') p[type] = Number(value);
  }
  const asUTC = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asUTC - Math.floor(instant / 1000) * 1000;
}

function parseDate(date: ISODate): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Ngày không hợp lệ: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function calendarUTC(date: ISODate): number {
  const [y, mo, d] = parseDate(date);
  return Date.UTC(y, mo - 1, d);
}

function fromCalendarUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Thời điểm UTC ứng với một giờ địa phương VN */
function vnLocalToInstant(date: ISODate, h: number, mi: number, s: number, ms: number): number {
  const [y, mo, d] = parseDate(date);
  const guess = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  const first = guess - tzOffsetMs(guess);
  // lặp một lần nữa cho đúng nếu độ lệch đổi giữa chừng (an toàn với múi giờ có DST)
  return guess - tzOffsetMs(first);
}

/** Ngày lịch VN (YYYY-MM-DD) của một thời điểm */
export function vnDate(at: ISODateTime | Date): ISODate {
  return dateFmt.format(toDate(at));
}

/** 00:00:00.000 giờ VN của một ngày, trả về ISO UTC */
export function vnStartOfDay(date: ISODate): ISODateTime {
  return new Date(vnLocalToInstant(date, 0, 0, 0, 0)).toISOString();
}

/** 23:59:59.999 giờ VN của một ngày, trả về ISO UTC */
export function vnEndOfDay(date: ISODate): ISODateTime {
  return new Date(vnLocalToInstant(date, 23, 59, 59, 999)).toISOString();
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromCalendarUTC(calendarUTC(date) + n * 86_400_000);
}

/** Số ngày lịch từ a đến b (b − a) */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((calendarUTC(b) - calendarUTC(a)) / 86_400_000);
}

/** 1 = Thứ 2 … 7 = Chủ nhật (ISO) */
export function isoWeekday(date: ISODate): number {
  const d = new Date(calendarUTC(date)).getUTCDay();
  return d === 0 ? 7 : d;
}

export function monthKey(date: ISODate): MonthKey {
  return date.slice(0, 7);
}

export function daysInMonth(month: MonthKey): ISODate[] {
  const out: ISODate[] = [];
  for (let d = month + '-01'; monthKey(d) === month; d = addDays(d, 1)) out.push(d);
  return out;
}

export function nextMonth(month: MonthKey): MonthKey {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Thứ 2 của tuần chứa ngày này (tuần tính Thứ 2 → CN) */
export function weekStart(date: ISODate): ISODate {
  return addDays(date, 1 - isoWeekday(date));
}

export function nowISO(): ISODateTime {
  return new Date().toISOString();
}
