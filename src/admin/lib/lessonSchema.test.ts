import { describe, expect, it } from 'vitest';
import { containsExact, gridPlan, parseLessonJson } from './lessonSchema';
import { nextCodes } from '../../../netlify/functions/admin-students';

const good = {
  word: 'Environment',
  pos: 'n',
  meaning_vi: 'môi trường',
  ipa: '/ɪnˈvaɪrənmənt/',
  syllables: 'en·VI·ron·ment',
  example: 'Plastic waste is a serious threat to the environment.',
  word_family: [{ form: 'environmental', pos: 'adj', sentence: 'The project had a huge ___ impact.' }],
  image_hint: 'a green forest with a clear river',
};

describe('parseLessonJson', () => {
  it('nhận JSON đúng mẫu, chuẩn hoá từ về chữ thường', () => {
    const r = parseLessonJson(JSON.stringify({ words: [good] }));
    expect(r.ok).toBe(true);
    expect(r.words[0]!.word).toBe('environment');
    expect(r.issues).toEqual([]);
  });

  it('chấp nhận khối ```json', () => {
    expect(parseLessonJson('```json\n' + JSON.stringify({ words: [good] }) + '\n```').ok).toBe(true);
  });

  it('báo lỗi cú pháp', () => {
    const r = parseLessonJson('{ "words": [ ');
    expect(r.ok).toBe(false);
    expect(r.issues[0]!.field).toBe('(JSON)');
  });

  it('báo đúng từ, đúng trường', () => {
    const bad = { ...good, word: 'pollution', pos: 'noun', example: 'The air is dirty.', word_family: [{ form: 'pollute', pos: 'v', sentence: 'Factories ___ ___ rivers.' }] };
    const r = parseLessonJson(JSON.stringify({ words: [good, bad] }));
    expect(r.ok).toBe(false);
    const fields = r.issues.filter((i) => i.level === 'error').map((i) => `${i.index}:${i.word}:${i.field}`);
    expect(fields).toEqual(['1:pollution:pos', '1:pollution:example', '1:pollution:word_family[1].sentence']);
  });

  it('phát hiện từ trùng', () => {
    const r = parseLessonJson(JSON.stringify({ words: [good, { ...good, word: 'environment ' }] }));
    expect(r.issues.some((i) => i.index === 1 && i.message.includes('Trùng'))).toBe(true);
  });

  it('thiếu ipa/ví dụ chỉ là cảnh báo', () => {
    const r = parseLessonJson(JSON.stringify({ words: [{ ...good, ipa: '', example: null }] }));
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.field)).toEqual(['ipa', 'example']);
  });
});

describe('containsExact', () => {
  it('khớp theo ranh giới từ', () => {
    expect(containsExact('Take care of the environment.', 'environment')).toBe(true);
    expect(containsExact('Environmental damage', 'environment')).toBe(false);
    expect(containsExact('She gave up smoking.', 'give up')).toBe(false);
  });
});

describe('gridPlan', () => {
  it('chia lưới theo số từ', () => {
    expect(gridPlan(18)).toEqual([{ cols: 4, rows: 5, count: 18 }]);
    expect(gridPlan(23)).toEqual([{ cols: 5, rows: 5, count: 23 }]);
    expect(gridPlan(30).map((g) => g.count)).toEqual([15, 15]);
    expect(gridPlan(48).map((g) => `${g.cols}x${g.rows}:${g.count}`)).toEqual(['5x5:24', '5x5:24']);
  });
});

describe('nextCodes', () => {
  it('nối tiếp số lớn nhất', () => {
    expect(nextCodes([], 2)).toEqual(['HS01', 'HS02']);
    expect(nextCodes(['HS03', 'HS11', 'X'], 1)).toEqual(['HS12']);
  });
});
