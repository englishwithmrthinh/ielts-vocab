import { describe, expect, it } from 'vitest';
import { applyAnswer, initialState } from '../srs';
import { gradeTyping } from '../grading';
import type { Box } from '../types';

describe('applyAnswer', () => {
  it('từ đúng liên tục: Pass ở bài 12, kiểm tra lại ở bài 21', () => {
    let s = { ...initialState(1) };
    let idx = s.due_idx;
    const path: [number, Box][] = [];
    while (s.box !== 6) {
      const typing = s.box >= 4; // giả lập: từ H4 trở đi ra dạng gõ
      const r = applyAnswer(s, true, typing, idx);
      path.push([idx, r.box]);
      s = { ...s, ...r };
      idx = r.due_idx;
    }
    expect(path).toEqual([[1, 2], [2, 3], [4, 4], [7, 5], [12, 6]]);
    expect(s.due_idx).toBe(21);
  });

  it('sai ở H4 về H2, hạn +1', () => {
    const r = applyAnswer({ box: 4, typed_ok: true, wrong_count: 0 }, false, true, 10);
    expect(r).toMatchObject({ box: 2, due_idx: 11, wrong_count: 1, passed: false });
  });

  it('sai khi kiểm tra Pass về H3, hạn +2', () => {
    const r = applyAnswer({ box: 6, typed_ok: true, wrong_count: 2 }, false, true, 30);
    expect(r).toMatchObject({ box: 3, due_idx: 32, wrong_count: 3 });
  });

  it('H5 đúng nhưng chưa từng gõ đúng: chưa Pass, hẹn mốc sau', () => {
    const r = applyAnswer({ box: 5, typed_ok: false, wrong_count: 0 }, true, false, 12);
    expect(r).toMatchObject({ box: 5, due_idx: 13, passed: false });
  });

  it('H5 gõ đúng lần đầu thì Pass luôn', () => {
    const r = applyAnswer({ box: 5, typed_ok: false, wrong_count: 0 }, true, true, 12);
    expect(r).toMatchObject({ box: 6, typed_ok: true, passed: true, due_idx: 21 });
  });

  it('Pass kiểm tra lại đúng thì giữ Pass, hẹn thêm 9 mốc', () => {
    const r = applyAnswer({ box: 6, typed_ok: true, wrong_count: 0 }, true, true, 21);
    expect(r).toMatchObject({ box: 6, due_idx: 30, passed: false });
  });
});

describe('gradeTyping', () => {
  it('đúng tuyệt đối, không phân biệt hoa thường, bỏ khoảng trắng đầu cuối', () => {
    expect(gradeTyping('  Environment ', 'environment').correct).toBe(true);
  });
  it('sai 1 chữ', () => {
    const g = gradeTyping('enviroment', 'environment');
    expect(g).toMatchObject({ correct: false, hint: 'one_letter' });
  });
  it('thừa dấu cách ở giữa', () => {
    expect(gradeTyping('environ ment', 'environment')).toMatchObject({ correct: false, hint: 'extra_space' });
  });
  it('thiếu dấu cách trong cụm từ', () => {
    expect(gradeTyping('carbonfootprint', 'carbon footprint')).toMatchObject({ correct: false, hint: 'missing_space' });
  });
  it('đảo 2 chữ cạnh nhau', () => {
    expect(gradeTyping('enviornment', 'environment')).toMatchObject({ correct: false, hint: 'swapped' });
  });
  it('sai nhiều thì không có hint, diff tô đúng chỗ sai', () => {
    const g = gradeTyping('envxronmant', 'environment');
    expect(g.hint).toBeUndefined();
    expect(g.diff.filter((d) => !d.ok).map((d) => d.char)).toEqual(['x', 'a']);
  });
});
