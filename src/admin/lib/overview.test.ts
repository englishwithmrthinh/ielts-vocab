import { describe, expect, it } from 'vitest';
import type { Milestone } from '../../../shared/types';
import { buildOverview } from './overview';

// Mốc giả: hạn 23:59 giờ VN (16:59Z) ngày mốc, mở 00:00 VN (17:00Z hôm trước) sau hạn mốc trước
const ms = (id: string, date: string, opens: string, is_off = false): Milestone => ({
  id, idx: 1, date, kind: 'tue', opens_at: opens, deadline_at: `${date}T16:59:59Z`, month: date.slice(0, 7), is_off,
} as Milestone);

const milestones = [
  ms('m1', '2026-11-01', '2026-10-28T17:00:00Z'),
  ms('m2', '2026-11-03', '2026-11-01T17:00:00Z'),
  ms('m3', '2026-11-06', '2026-11-03T17:00:00Z'),
  ms('m4', '2026-11-08', '2026-11-06T17:00:00Z'),
];
const students = [
  { id: 'a', code: 'HS01', name: 'An', created_at: '2026-10-20T00:00:00Z', class_id: 'c1' },
  { id: 'b', code: 'HS02', name: 'Bình', created_at: '2026-10-20T00:00:00Z', class_id: null },
  { id: 'c', code: 'HS03', name: 'Chi', created_at: '2026-11-05T00:00:00Z', class_id: 'c1' }, // vào lớp sau m1, m2
];

describe('buildOverview', () => {
  const now = '2026-11-05T03:00:00Z'; // 10:00 Thứ 5 giờ VN, mốc m3 (Thứ 6) đang mở
  const r = buildOverview(now, students, milestones, [
    { student_id: 'a', milestone_id: 'm1', status: 'submitted', answered_count: 20 },
    { student_id: 'a', milestone_id: 'm3', status: 'open', answered_count: 5 },
    { student_id: 'b', milestone_id: 'm3', status: 'submitted', answered_count: 20 },
  ]);

  it('mốc hiện tại và đếm hôm nay', () => {
    expect(r.milestone?.id).toBe('m3');
    expect(r.today).toEqual({ submitted: 1, doing: 1, notStarted: 1, total: 3 });
  });

  it('đang nợ: bài cũ nhất, ngày trễ, % hôm nay / ngày mai; bỏ qua mốc trước khi vào lớp', () => {
    expect(r.owing.map((o) => o.code)).toEqual(['HS02', 'HS01']);
    const b = r.owing[0]!;
    expect(b).toMatchObject({ count: 2, oldestDate: '2026-11-01', daysLate: 4, pctNow: 60, pctTomorrow: 50 });
    expect(r.owing[1]).toMatchObject({ count: 1, oldestDate: '2026-11-03', daysLate: 2, pctNow: 80, pctTomorrow: 70 });
  });
});

describe('buildOverview · gia hạn riêng', () => {
  const now = '2026-11-05T03:00:00Z';
  const base = buildOverview(now, students.slice(0, 1), milestones, []);
  const ext = new Map([['a|m1', '2026-11-10T16:59:59Z'], ['a|m2', '2026-11-10T16:59:59Z']]);
  const r = buildOverview(now, students.slice(0, 1), milestones, [], ext);
  it('em được gia hạn không còn trong danh sách nợ', () => {
    expect(base.owing.map((o) => o.studentId)).toEqual(['a']);
    expect(r.owing).toEqual([]);
  });
});

describe('buildOverview · chưa có từ thì chưa có bài', () => {
  const now = '2026-11-05T03:00:00Z'; // m3 đang mở; m1, m2 đã qua
  const idx = milestones.map((m, i) => ({ ...m, idx: i + 1 }));
  it('em có từ đầu tiên ở m3 (idx 3) không nợ m1, m2', () => {
    const base = buildOverview(now, students.slice(0, 1), idx, []);
    const r = buildOverview(now, students.slice(0, 1), idx, [], new Map(), new Map([['a', 3]]));
    expect(base.owing.map((o) => o.count)).toEqual([2]);
    expect(r.owing).toEqual([]);
    expect(r.today.total).toBe(1);
  });
  it('em chưa được giao từ nào: không nợ, không tính vào mốc hôm nay', () => {
    const r = buildOverview(now, students.slice(0, 1), idx, [], new Map(), new Map());
    expect(r.owing).toEqual([]);
    expect(r.today.total).toBe(0);
  });
});
