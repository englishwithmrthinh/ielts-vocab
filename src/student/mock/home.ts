// Dữ liệu giả cho GET /api/home — đúng kiểu HomeResponse.
import type { AssignmentCard, HomeResponse, ISODate, MilestoneKind } from '@shared/types';
import { addDays, daysBetween, isoWeekday, vnEndOfDay } from '@shared/time';
import { scoreForDaysLate } from '@shared/lateness';
import { todayVN } from '../lib/format';

const KIND: Partial<Record<number, MilestoneKind>> = { 2: 'tue', 5: 'fri', 7: 'sun' };

function nextMilestone(from: ISODate): ISODate {
  let d = from;
  while (!KIND[isoWeekday(d)]) d = addDays(d, 1);
  return d;
}
function prevMilestone(before: ISODate): ISODate {
  let d = addDays(before, -1);
  while (!KIND[isoWeekday(d)]) d = addDays(d, -1);
  return d;
}

function card(date: ISODate, over: Partial<AssignmentCard>): AssignmentCard {
  return {
    assignmentId: null,
    milestoneId: `ms-${date}`,
    date,
    kind: KIND[isoWeekday(date)]!,
    status: 'open',
    deadlineAt: vnEndOfDay(date),
    currentPct: 100,
    tomorrowPct: 100,
    daysLateNow: 0,
    blocked: false,
    progress: { done: 0, required: null },
    ...over,
  };
}

/**
 * Kịch bản, chọn bằng ?mock=... trên URL:
 *  owing (mặc định): 1 bài nợ + bài hiện tại bị khoá
 *  open: chỉ có bài đang mở, đã làm dở
 *  done: không còn bài mở → nút Luyện thêm
 */
export function mockHome(scenario: string): HomeResponse {
  const today = todayVN();
  const cur = nextMilestone(today);
  const prev = prevMilestone(today);
  const late = daysBetween(prev, today);
  const curIsToday = cur === today;

  const owing = card(prev, {
    assignmentId: 'as-prev',
    status: 'owing',
    daysLateNow: late,
    currentPct: scoreForDaysLate(late) ?? 0,
    tomorrowPct: scoreForDaysLate(late + 1) ?? 0,
    progress: { done: 11, required: 32 },
  });
  const current = card(cur, {
    assignmentId: scenario === 'open' ? 'as-cur' : null,
    blocked: scenario === 'owing',
    // Bài đang mở: nếu hôm nay là ngày hạn thì ngày mai bị trừ 10%
    tomorrowPct: curIsToday ? 90 : 100,
    progress: scenario === 'open' ? { done: 9, required: 28 } : { done: 0, required: null },
  });

  const after = nextMilestone(addDays(cur, 1));
  return {
    student: { name: 'Minh Anh', code: 'HS01' },
    assignments: scenario === 'done' ? [] : scenario === 'open' ? [current] : [owing, current],
    newWordsToPreview: scenario === 'done' ? 0 : 6,
    nextDeadlineAt: vnEndOfDay(scenario === 'done' ? after : cur),
    streak: scenario === 'owing' ? 0 : 7,
    xpTotal: 1240,
    xpThisWeek: 185,
    canPractice: scenario === 'done',
  };
}
