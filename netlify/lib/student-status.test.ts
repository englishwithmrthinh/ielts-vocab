import { describe, expect, it } from 'vitest';
import type { Assignment, Milestone } from '../../shared/types';
import { statesOf } from './student-status';

const ms = (id: string, idx: number, date: string): Milestone => ({
  id, idx, date, kind: 'tue', month: date.slice(0, 7), is_off: false,
  opens_at: "2026-11-01T00:00:00Z", deadline_at: `${date}T16:59:59Z`,
} as unknown as Milestone);
const M = [ms('m10', 10, '2026-11-06'), ms('m11', 11, '2026-11-08'), ms('m12', 12, '2026-11-10')];
const st = { id: 's', created_at: '2026-10-01T00:00:00Z' };
const now = '2026-11-09T06:00:00Z';
const asg = (mid: string, p: Partial<Assignment>) => [`s|${mid}`, { id: mid, student_id: 's', milestone_id: mid, status: 'open', started_at: null, submitted_at: null, days_late: null, score_pct: null, required_count: 20, answered_count: 0, word_ids: [], ...p } as Assignment] as const;

describe('statesOf (trang Học sinh)', () => {
  it('đã nộp 06/11, nợ 08/11, 10/11 đang mở', () => {
    const r = statesOf(st, M, new Map([asg('m10', { status: 'submitted', submitted_at: '2026-11-07T01:00:00Z' })]), new Map(), 10, now);
    expect(r.map((x) => [x.m.id, x.status])).toEqual([['m10', 'submitted'], ['m11', 'owing'], ['m12', 'open']]);
  });
  it('gia hạn riêng 08/11 → đang mở, có cờ extended', () => {
    const r = statesOf(st, M, new Map(), new Map([['s|m11', '2026-11-10T16:59:59Z']]), 10, now);
    const m11 = r.find((x) => x.m.id === 'm11')!;
    expect(m11.status).toBe('open');
    expect(m11.extended).toBe(true);
  });
  it('chưa có từ trước 10/11 → chỉ còn bài 10/11', () => {
    expect(statesOf(st, M, new Map(), new Map(), 12, now).map((x) => x.m.id)).toEqual(['m12']);
  });
});
