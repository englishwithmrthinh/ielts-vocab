import { describe, expect, it } from 'vitest';
import { blankSentence, buildQuestion, chooseType, grade, planNext, type QuizWord } from '../questions';
import { selectWords } from '../assignment';
import type { Box, QType } from '../types';

let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const mk = (i: number, box: Box = 1, extra: Partial<QuizWord> = {}): QuizWord => ({
  id: `w${i}`, word: `word${String.fromCharCode(97 + i)}x`, pos: 'n', meaning_vi: `nghĩa ${i}`,
  example: `The students discussed word${String.fromCharCode(97 + i)}x during the long seminar today.`,
  word_family: [{ form: `word${i}ful`, pos: 'adj', sentence: `It was a very ___ day for everyone.` }],
  image_url: `https://img/${i}.webp`, audio_url: `https://aud/${i}.mp3`, box, typed_ok: false, ...extra,
});
const pool = Array.from({ length: 12 }, (_, i) => mk(i));

describe('blankSentence', () => {
  it('che đúng nguyên từ, không che trong từ dài hơn', () => {
    expect(blankSentence('Emissions and emission levels rose.', 'emission')).toBe('Emissions and ___ levels rose.');
    expect(blankSentence('Nothing here.', 'emission')).toBeNull();
  });
});

describe('chooseType', () => {
  it('H5 chưa gõ đúng thì luôn ra dạng gõ', () => {
    for (let k = 0; k < 30; k++) {
      const t = chooseType(mk(1, 5), null, 12, rng);
      expect(['H', 'I', 'K', 'M']).toContain(t);
    }
  });
  it('không có ảnh thì không ra B', () => {
    for (let k = 0; k < 30; k++) expect(chooseType(mk(1, 2, { image_url: null }), null, 12, rng)).not.toBe('B');
  });
  it('kho ít hơn 4 từ thì không ra dạng chọn', () => {
    for (let k = 0; k < 30; k++) expect(['A', 'B', 'C', 'D', 'E', 'J']).not.toContain(chooseType(mk(1, 2), null, 2, rng));
  });
});

describe('buildQuestion + grade', () => {
  const all: QType[] = ['A', 'B', 'C', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'M'];
  it.each(all)('dạng %s: payload không lộ đáp án, chấm đúng', (t) => {
    const w = mk(3, 3);
    const q = buildQuestion(t, [w], pool, rng);
    expect(q.type).toBe(t);
    if (q.key.kind === 'option') {
      expect(q.payload.options).toHaveLength(4);
      expect(grade(q.key, { qid: 'x', optionId: q.key.correctOptionId }).correct).toBe(true);
      expect(grade(q.key, { qid: 'x', optionId: 'zz' }).correct).toBe(false);
    } else if (q.key.kind === 'text') {
      expect(JSON.stringify(q.payload)).not.toContain(`"${q.key.expected}"`);
      expect(grade(q.key, { qid: 'x', text: ` ${q.key.expected.toUpperCase()} ` }).correct).toBe(true);
    }
  });
  it('D và L chấm riêng từng từ', () => {
    const ws = [mk(1, 1), mk(2, 1), mk(3, 1), mk(4, 1)];
    for (const t of ['D', 'L'] as QType[]) {
      const q = buildQuestion(t, ws, pool, rng);
      if (q.key.kind !== 'match') throw new Error('kind');
      const m = { ...q.key.pairs };
      m['w1'] = 'nope';
      const g = grade(q.key, { qid: 'x', matches: m });
      expect(g.correct).toBe(false);
      expect(g.perWord.filter((p) => p.correct)).toHaveLength(3);
    }
  });
  it('planNext gom 4–5 từ cùng hộp cho D/L, nếu không thì 1 từ', () => {
    for (let k = 0; k < 40; k++) {
      const p = planNext([mk(1, 1), mk(2, 1), mk(3, 1), mk(4, 1), mk(5, 1), mk(6, 1)], null, 12, rng);
      if (p.type === 'D' || p.type === 'L') expect(p.words.length).toBeGreaterThanOrEqual(4);
      else expect(p.words).toHaveLength(1);
    }
  });
});

describe('selectWords', () => {
  const sw = (i: number, due: number, box: Box = 1) => ({ word_id: `w${i}`, box, due_idx: due, introduced: true, typed_ok: false });
  it('lấy từ đến hạn, quá hạn lâu nhất trước, tối đa 40', () => {
    const list = Array.from({ length: 50 }, (_, i) => sw(i, i % 5));
    const s = selectWords(list, 10);
    expect(s.graded).toHaveLength(40);
    expect(s.extra).toHaveLength(10);
    expect(s.filler).toHaveLength(0);
  });
  it('ít hơn 15 từ đến hạn thì bù câu ôn', () => {
    const list = [sw(1, 3), sw(2, 3), ...Array.from({ length: 20 }, (_, i) => sw(10 + i, 20, ((i % 5) + 1) as Box))];
    const s = selectWords(list, 3);
    expect(s.graded).toEqual(['w1', 'w2']);
    expect(s.filler).toHaveLength(13);
  });
});
