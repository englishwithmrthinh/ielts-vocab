// Định dạng ngày giờ cho giao diện. Phép tính ngày lấy từ @shared/time (giờ VN).
import type { ISODate, ISODateTime, MilestoneKind } from '@shared/types';
import { isoWeekday, vnDate } from '@shared/time';

const DOW = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const DOW_SHORT = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const dowName = (d: ISODate) => DOW[isoWeekday(d)] ?? '';
export const dowShort = (d: ISODate) => DOW_SHORT[isoWeekday(d)] ?? '';

export const KIND_NAME: Record<MilestoneKind, string> = { tue: 'Thứ 3', fri: 'Thứ 6', sun: 'Chủ nhật' };

/** '05/11' */
export function ddmm(d: ISODate): string {
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
}

/** 'Thứ 5, 05/11' */
export const longDate = (d: ISODate) => `${dowName(d)}, ${ddmm(d)}`;

/** 'Bài Thứ 3 · 03/11' */
export const lessonTitle = (d: ISODate) => `Bài ${dowName(d)} · ${ddmm(d)}`;

export const todayVN = () => vnDate(new Date());

/** Đếm ngược gọn: '1n 14g', '5g 20p', '12 phút' */
export function countdown(to: ISODateTime, now = Date.now()): string {
  const ms = Date.parse(to) - now;
  if (ms <= 0) return 'Đã đến hạn';
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d}n ${h}g`;
  if (h > 0) return `${h}g ${m}p`;
  return `${m} phút`;
}
