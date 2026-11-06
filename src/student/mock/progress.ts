// Dữ liệu giả cho GET /api/progress và GET|POST /api/my-words.
import type { AssignmentStatus, Box, MilestoneKind, MyWordsResponse, ProgressResponse } from '@shared/types';
import { daysBetween, daysInMonth, isoWeekday, monthKey } from '@shared/time';
import { scoreForDaysLate } from '@shared/lateness';
import { todayVN } from '../lib/format';
import { MOCK_WORDS } from './words';

const KIND: Partial<Record<number, MilestoneKind>> = { 2: 'tue', 5: 'fri', 7: 'sun' };

/** Lịch tháng hiện tại: mốc đã qua có đủ kiểu trạng thái để thử màu */
export function mockCalendar(month = monthKey(todayVN()), today = todayVN()) {
  const pattern: [AssignmentStatus, number][] = [
    ['submitted', 0], ['submitted', 0], ['submitted', 2], ['off', 0], ['submitted', 0],
    ['submitted', 6], ['submitted', 0], ['abandoned', 0], ['submitted', 1], ['submitted', 0],
  ];
  let k = 0;
  return daysInMonth(month)
    .filter((d) => KIND[isoWeekday(d)])
    .map((date) => {
      const diff = daysBetween(date, today);
      let status: AssignmentStatus;
      let late = 0;
      if (diff < 0) status = diff >= -2 ? 'open' : 'locked';
      else if (diff === 0) status = 'open';
      else if (diff <= 3 && k > 3) status = 'owing';
      else [status, late] = pattern[k++ % pattern.length]!;
      return {
        date,
        kind: KIND[isoWeekday(date)]!,
        status,
        score_pct: status === 'submitted' ? (scoreForDaysLate(late) ?? 0) : status === 'abandoned' ? 0 : null,
        days_late: status === 'submitted' ? late : null,
      };
    });
}

export function mockProgress(): ProgressResponse {
  return {
    wordsByBox: { '1': 14, '2': 11, '3': 9, '4': 6, '5': 4, pass: 16 },
    wordsTotal: 60,
    streak: 4,
    xpTotal: 1240,
    calendar: mockCalendar().map(({ days_late: _, ...c }) => c),
    badges: [
      { code: 'first_submit', earned_at: '2026-11-01T10:00:00Z' },
      { code: 'pass_10', earned_at: '2026-11-04T12:00:00Z' },
      { code: 'perfect_week', earned_at: null },
      { code: 'perfect_month', earned_at: null },
      { code: 'all_sundays_month', earned_at: null },
      { code: 'pass_50', earned_at: null },
      { code: 'pass_100', earned_at: null },
      { code: 'pass_300', earned_at: null },
      { code: 'streak_6', earned_at: null },
      { code: 'streak_12', earned_at: null },
      { code: 'streak_24', earned_at: null },
    ],
    weeklyTop5: [
      { name: 'Hà My', xp: 420 },
      { name: 'Minh Anh', xp: 385, isMe: true },
      { name: 'Đức Huy', xp: 360 },
      { name: 'Bảo Ngọc', xp: 310 },
      { name: 'Quang Minh', xp: 255 },
    ].map((x) => ({ isMe: false, ...x })),
  };
}

// ---- Kho từ ----
const boxes: Box[] = [6, 1, 2, 3, 6, 4, 5, 1, 2, 6, 3, 1];
let pending: MyWordsResponse['pending'] = [
  { id: 'sg1', text: 'sustainable', note: 'thấy trong bài đọc', created_at: '2026-11-05T09:00:00Z' },
];

export function mockMyWords(): MyWordsResponse {
  return {
    words: MOCK_WORDS.map((w, i) => ({ ...w, box: boxes[i]!, lessonNumber: i < 6 ? 1 : 2 })),
    pending,
  };
}

/** Từ đã có trong kho tổng → gán luôn; từ mới → Chờ duyệt */
export function mockAddWord(text: string, note: string | null): { status: 'linked' | 'pending' } {
  const t = text.trim().toLowerCase();
  if (MOCK_WORDS.some((w) => w.word.toLowerCase() === t)) return { status: 'linked' };
  pending = [{ id: `sg${Date.now()}`, text: text.trim(), note, created_at: new Date().toISOString() }, ...pending];
  return { status: 'pending' };
}
