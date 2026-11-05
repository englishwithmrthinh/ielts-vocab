import { describe, expect, it } from 'vitest';
import { assignIdx, currentMilestone, milestonesOfMonth, previousMilestoneDate } from '../milestones';
import { daysLate, scoreForDaysLate, scoreIfSubmittedAt, unsubmittedStatus } from '../lateness';

describe('milestonesOfMonth', () => {
  it('tháng 11/2026 có 13 mốc, từ CN 1/11 đến CN 29/11', () => {
    const m = milestonesOfMonth('2026-11');
    expect(m).toHaveLength(13);
    expect(m[0]).toMatchObject({ date: '2026-11-01', kind: 'sun' });
    expect(m.at(-1)).toMatchObject({ date: '2026-11-29', kind: 'sun' });
    expect(m.filter((x) => x.kind === 'tue').map((x) => x.date.slice(8))).toEqual(['03', '10', '17', '24']);
    expect(m.filter((x) => x.kind === 'fri').map((x) => x.date.slice(8))).toEqual(['06', '13', '20', '27']);
  });

  it('tháng 12/2026 có 13 mốc', () => {
    const m = milestonesOfMonth('2026-12');
    expect(m).toHaveLength(13);
    expect(m.filter((x) => x.kind === 'tue').map((x) => x.date.slice(8))).toEqual(['01', '08', '15', '22', '29']);
  });

  it('hạn là 23:59:59.999 giờ VN (16:59:59.999Z)', () => {
    const tue = milestonesOfMonth('2026-11').find((x) => x.date === '2026-11-10')!;
    expect(tue.deadline_at).toBe('2026-11-10T16:59:59.999Z');
  });

  it('bài mở lúc 00:00 VN ngày sau mốc trước', () => {
    const m = milestonesOfMonth('2026-11');
    const fri13 = m.find((x) => x.date === '2026-11-13')!; // trước là Thứ 3 10/11 → mở Thứ 4 11/11
    expect(fri13.opens_at).toBe('2026-11-10T17:00:00.000Z');
    const tue10 = m.find((x) => x.date === '2026-11-10')!; // trước là CN 8/11 → mở Thứ 2 9/11
    expect(tue10.opens_at).toBe('2026-11-08T17:00:00.000Z');
    const sun1 = m[0]!; // trước là Thứ 6 30/10 → mở Thứ 7 31/10
    expect(previousMilestoneDate('2026-11-01')).toBe('2026-10-30');
    expect(sun1.opens_at).toBe('2026-10-30T17:00:00.000Z');
  });
});

describe('assignIdx', () => {
  it('đánh số liên tục, mốc Nghỉ không có idx', () => {
    const list = milestonesOfMonth('2026-11').map((m) => ({ ...m, is_off: m.date === '2026-11-06' }));
    const out = assignIdx(list);
    expect(out.find((m) => m.date === '2026-11-03')!.idx).toBe(2);
    expect(out.find((m) => m.date === '2026-11-06')!.idx).toBeNull();
    expect(out.find((m) => m.date === '2026-11-08')!.idx).toBe(3);
    expect(out.at(-1)!.idx).toBe(12);
  });

  it('nối tiếp sang tháng sau', () => {
    const all = assignIdx([...milestonesOfMonth('2026-12'), ...milestonesOfMonth('2026-11')]);
    expect(all.find((m) => m.date === '2026-12-01')!.idx).toBe(14);
  });
});

describe('currentMilestone', () => {
  it('lấy mốc có hạn gần nhất chưa qua', () => {
    const list = milestonesOfMonth('2026-11');
    expect(currentMilestone(list, '2026-11-11T03:00:00Z')!.date).toBe('2026-11-13');
    expect(currentMilestone(list, '2026-11-10T16:59:00Z')!.date).toBe('2026-11-10');
  });
});

describe('lateness', () => {
  it('nộp 23:59:59 Thứ 3 = đúng hạn', () => {
    expect(daysLate('2026-11-10', '2026-11-10T16:59:59Z')).toBe(0);
    expect(scoreIfSubmittedAt('2026-11-10', '2026-11-10T16:59:59Z')).toBe(100);
  });
  it('00:00:30 Thứ 4 = trễ 1 ngày, 90%', () => {
    expect(daysLate('2026-11-10', '2026-11-10T17:00:30Z')).toBe(1);
    expect(scoreIfSubmittedAt('2026-11-10', '2026-11-10T17:00:30Z')).toBe(90);
  });
  it('bài Thứ 3 10/11 nộp Thứ 5 12/11 = 80%', () => {
    expect(scoreIfSubmittedAt('2026-11-10', '2026-11-12T05:00:00Z')).toBe(80);
  });
  it('trễ 7 ngày = 30%, ngày thứ 8 = Bỏ bài', () => {
    expect(scoreForDaysLate(7)).toBe(30);
    expect(scoreForDaysLate(8)).toBeNull();
  });
  it('trạng thái bài chưa nộp theo thời gian', () => {
    const m = milestonesOfMonth('2026-11').find((x) => x.date === '2026-11-10')!;
    expect(unsubmittedStatus(m, '2026-11-08T10:00:00Z')).toBe('locked');
    expect(unsubmittedStatus(m, '2026-11-09T01:00:00Z')).toBe('open');
    expect(unsubmittedStatus(m, '2026-11-11T01:00:00Z')).toBe('owing');
    expect(unsubmittedStatus(m, '2026-11-17T10:00:00Z')).toBe('owing'); // 7 ngày
    expect(unsubmittedStatus(m, '2026-11-17T17:00:00Z')).toBe('abandoned'); // sang ngày 18/11 VN
    expect(unsubmittedStatus({ ...m, is_off: true }, '2026-11-11T01:00:00Z')).toBe('off');
  });
});
