import { describe, expect, it } from 'vitest';
import { makeCheck, quickGrade } from '../check';

describe('quick check', () => {
  it('option', async () => {
    const c = await makeCheck({ kind: 'option', wordId: 'w', correctOptionId: 'o2', expected: 'x' });
    expect((await quickGrade(c, { qid: 'q', optionId: 'o2' }))!.correct).toBe(true);
    expect((await quickGrade(c, { qid: 'q', optionId: 'o1' }))!.correct).toBe(false);
    expect(JSON.stringify(c)).not.toContain('o2');
  });
  it('text ignores case and outer spaces, keeps inner', async () => {
    const c = await makeCheck({ kind: 'text', wordId: 'w', expected: 'climate change' });
    expect((await quickGrade(c, { qid: 'q', text: '  Climate Change ' }))!.correct).toBe(true);
    expect((await quickGrade(c, { qid: 'q', text: 'climatechange' }))!.correct).toBe(false);
  });
  it('match per word', async () => {
    const c = await makeCheck({ kind: 'match', pairs: { a: 'r1', b: 'r2' }, expected: '' });
    const r = await quickGrade(c, { qid: 'q', matches: { a: 'r1', b: 'r1' } });
    expect(r!.correct).toBe(false);
    expect(r!.perWord!.find((p) => p.wordId === 'a')!.correct).toBe(true);
  });
});
