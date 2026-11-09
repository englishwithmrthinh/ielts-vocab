import { describe, expect, it } from 'vitest';
import { extKey, toExtensionMap, withExtension } from '../deadlines';
import { daysLate, scoreIfSubmittedAt, unsubmittedStatus } from '../lateness';
import { vnDate } from '../time';

// Mốc Thứ 3 03/11/2026, hạn 23:59 VN
const m = { id: 'm1', date: '2026-11-03', opens_at: '2026-11-01T17:00:00Z', deadline_at: '2026-11-03T16:59:59Z', is_off: false };

describe('gia hạn riêng', () => {
  const ext = toExtensionMap([{ student_id: 's1', milestone_id: 'm1', deadline_at: '2026-11-07T16:59:59Z' }]);

  it('em được gia hạn: bài đang nợ trở lại đang mở, nộp trước hạn mới được 100%', () => {
    const now = '2026-11-05T03:00:00Z'; // Thứ 5, quá hạn chung 2 ngày
    expect(unsubmittedStatus(m, now)).toBe('owing');
    const em = withExtension(m, ext.get(extKey('s1', 'm1')));
    expect(unsubmittedStatus(em, now)).toBe('open');
    expect(scoreIfSubmittedAt(vnDate(em.deadline_at), now)).toBe(100);
  });

  it('nộp sau hạn mới thì trễ tính theo ngày của hạn mới', () => {
    const em = withExtension(m, ext.get(extKey('s1', 'm1')));
    expect(daysLate(vnDate(em.deadline_at), '2026-11-09T03:00:00Z')).toBe(2);
  });

  it('em khác không bị ảnh hưởng', () => {
    expect(withExtension(m, ext.get(extKey('s2', 'm1')))).toBe(m);
  });

  it('hạn riêng sớm hơn hạn chung (vd. mốc đã được gia hạn cả mốc sau đó) thì bỏ qua', () => {
    const later = { ...m, deadline_at: '2026-11-10T16:59:59Z' };
    expect(withExtension(later, '2026-11-07T16:59:59Z').deadline_at).toBe('2026-11-10T16:59:59Z');
  });

  it('bài đã quá 7 ngày (bỏ bài) được gia hạn thì mở lại', () => {
    const now = '2026-11-12T03:00:00Z';
    expect(unsubmittedStatus(m, now)).toBe('abandoned');
    expect(unsubmittedStatus(withExtension(m, '2026-11-13T16:59:59Z'), now)).toBe('open');
  });
});
