/**
 * Mốc: mỗi Thứ 3, Thứ 6, Chủ nhật là một mốc, hạn 23:59 giờ VN.
 * Bài của mốc mở lúc 00:00 ngày sau mốc trước (theo lịch, kể cả mốc Nghỉ).
 * idx đánh liên tục, bỏ qua mốc Nghỉ.
 * Hàm thuần — không đụng database.
 */
import type { ISODate, MilestoneKind, MonthKey } from './types';
import { addDays, daysInMonth, isoWeekday, monthKey, vnEndOfDay, vnStartOfDay } from './time';

export interface MilestoneDraft {
  idx: number | null;
  date: ISODate;
  kind: MilestoneKind;
  opens_at: string;
  deadline_at: string;
  month: MonthKey;
  is_off: boolean;
}

const KIND_BY_WEEKDAY: Record<number, MilestoneKind | undefined> = { 2: 'tue', 5: 'fri', 7: 'sun' };
/** Khoảng cách tới mốc liền trước: Thứ 3 ← CN (2 ngày), Thứ 6 ← Thứ 3 (3), CN ← Thứ 6 (2) */
const GAP_TO_PREVIOUS: Record<MilestoneKind, number> = { tue: 2, fri: 3, sun: 2 };

export function kindOf(date: ISODate): MilestoneKind | null {
  return KIND_BY_WEEKDAY[isoWeekday(date)] ?? null;
}

/** Ngày mốc liền trước theo lịch */
export function previousMilestoneDate(date: ISODate): ISODate {
  const kind = kindOf(date);
  if (!kind) throw new Error(`${date} không phải ngày mốc`);
  return addDays(date, -GAP_TO_PREVIOUS[kind]);
}

/** Mốc của một tháng (chưa đánh idx, chưa có Nghỉ) */
export function milestonesOfMonth(month: MonthKey): MilestoneDraft[] {
  return daysInMonth(month).flatMap((date) => {
    const kind = kindOf(date);
    if (!kind) return [];
    return [{
      idx: null,
      date,
      kind,
      opens_at: vnStartOfDay(addDays(previousMilestoneDate(date), 1)),
      deadline_at: vnEndOfDay(date),
      month: monthKey(date),
      is_off: false,
    }];
  });
}

/**
 * Đánh lại idx cho một dãy mốc (mọi tháng), theo ngày tăng dần.
 * Mốc Nghỉ: idx = null. Gọi lại mỗi khi giáo viên bật/tắt Nghỉ.
 * `startIdx` là idx của mốc không-nghỉ đầu tiên (mặc định 1).
 */
export function assignIdx<T extends { date: ISODate; is_off: boolean; idx: number | null }>(
  list: T[],
  startIdx = 1,
): T[] {
  let next = startIdx;
  return [...list]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((m) => ({ ...m, idx: m.is_off ? null : next++ }));
}

/** Mốc đang mở hoặc sắp tới tại một thời điểm (mốc đầu tiên có hạn >= now) */
export function currentMilestone<T extends { deadline_at: string; is_off: boolean }>(
  list: T[],
  nowIso: string,
): T | null {
  const now = Date.parse(nowIso);
  return list
    .filter((m) => !m.is_off && Date.parse(m.deadline_at) >= now)
    .sort((a, b) => Date.parse(a.deadline_at) - Date.parse(b.deadline_at))[0] ?? null;
}
