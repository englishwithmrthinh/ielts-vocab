/**
 * Nộp muộn: đúng hạn 100%, mỗi ngày lịch trễ trừ 10%, tối đa 7 ngày (30%).
 * Ngày thứ 8 trở đi chưa nộp → Bỏ bài (0%).
 * Hàm thuần — không đụng database.
 */
import type { AssignmentStatus, ISODate, ISODateTime } from './types';
import { LATENESS } from './question-config';
import { daysBetween, vnDate } from './time';

/** Số ngày trễ khi nộp vào `at`. Truyền NGÀY HẠN (vnDate(m.deadline_at)) để hạn đã gia hạn được tính đúng. */
export function daysLate(milestoneDate: ISODate, at: ISODateTime): number {
  return Math.max(0, daysBetween(milestoneDate, vnDate(at)));
}

/** Điểm % theo số ngày trễ; null nghĩa là đã quá hạn bù (Bỏ bài) */
export function scoreForDaysLate(days: number): number | null {
  if (days > LATENESS.maxLateDays) return null;
  return 100 - LATENESS.penaltyPerDay * days;
}

/** Điểm nếu nộp ngay lúc `at` (0 nếu đã quá hạn bù) */
export function scoreIfSubmittedAt(milestoneDate: ISODate, at: ISODateTime): number {
  return scoreForDaysLate(daysLate(milestoneDate, at)) ?? 0;
}

/**
 * Trạng thái của một bài CHƯA nộp tại thời điểm `now`.
 * (Bài đã nộp luôn là 'submitted'; bài của mốc Nghỉ là 'off'.)
 */
export function unsubmittedStatus(
  m: { date: ISODate; opens_at: ISODateTime; deadline_at: ISODateTime; is_off: boolean },
  now: ISODateTime,
): AssignmentStatus {
  if (m.is_off) return 'off';
  const t = Date.parse(now);
  if (t < Date.parse(m.opens_at)) return 'locked';
  if (t <= Date.parse(m.deadline_at)) return 'open';
  return daysLate(vnDate(m.deadline_at), now) > LATENESS.maxLateDays ? 'abandoned' : 'owing';
}
