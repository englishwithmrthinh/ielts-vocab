import { describe, expect, it } from 'vitest';
import { beforeFirst, firstIdxOf } from '../first-due';

describe('chưa có từ thì chưa có bài', () => {
  it('mốc đầu tiên = nhỏ nhất của bài đã có và hạn từ chưa làm', () => {
    expect(firstIdxOf([], [12, 12, 13])).toBe(12);
    expect(firstIdxOf([9, null], [12])).toBe(9);
    expect(firstIdxOf([], [])).toBeNull();
  });
  it('thầy dời mọi bộ từ sang 10/11 (idx 12): mốc 06/11 (10), 08/11 (11) không tính; 10/11 tính', () => {
    const f = firstIdxOf([], [12]);
    expect(beforeFirst({ idx: 10 }, f)).toBe(true);
    expect(beforeFirst({ idx: 11 }, f)).toBe(true);
    expect(beforeFirst({ idx: 12 }, f)).toBe(false);
    expect(beforeFirst({ idx: 13 }, f)).toBe(false);
  });
  it('chưa được giao từ nào: chưa có bài nào; mốc nghỉ không xét', () => {
    expect(beforeFirst({ idx: 5 }, null)).toBe(true);
    expect(beforeFirst({ idx: null }, null)).toBe(false);
  });
});

describe('bài rỗng (0 câu) chưa nộp không tính là đã có bài', () => {
  it('countsAsStarted', async () => {
    const { countsAsStarted } = await import('../first-due');
    expect(countsAsStarted({ required_count: 0, status: 'open' })).toBe(false);
    expect(countsAsStarted({ required_count: null, status: 'open' })).toBe(false);
    expect(countsAsStarted({ required_count: 0, status: 'submitted' })).toBe(true);
    expect(countsAsStarted({ required_count: 15, status: 'open' })).toBe(true);
  });
});
