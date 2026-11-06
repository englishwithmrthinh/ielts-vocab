import { describe, expect, it } from 'vitest';
import { countdown, ddmm, dowName, lessonTitle } from './format';

describe('format', () => {
  it('đếm ngược gọn', () => {
    const now = Date.parse('2026-11-06T03:00:00Z');
    expect(countdown('2026-11-06T16:59:59.999Z', now)).toBe('13g 59p');
    expect(countdown('2026-11-08T16:59:59.999Z', now)).toBe('2n 13g');
    expect(countdown('2026-11-06T03:12:30Z', now)).toBe('12 phút');
    expect(countdown('2026-11-06T02:00:00Z', now)).toBe('Đã đến hạn');
  });
  it('tên thứ và tiêu đề bài', () => {
    expect(dowName('2026-11-10')).toBe('Thứ 3');
    expect(dowName('2026-11-08')).toBe('Chủ nhật');
    expect(ddmm('2026-11-03')).toBe('03/11');
    expect(lessonTitle('2026-11-06')).toBe('Bài Thứ 6 · 06/11');
  });
});
