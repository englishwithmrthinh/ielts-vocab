import { describe, expect, it } from 'vitest';
import { gridPrompt, singlePrompt } from './lib';

describe('prompt điền sẵn từ prompts/*.md', () => {
  it('lưới: thay hết biến, giữ đúng thứ tự từ', () => {
    const words = [
      { word: 'environment', image_hint: 'a green forest with a clear river', meaning_vi: 'môi trường' },
      { word: 'emission', image_hint: 'smoke from a factory chimney', meaning_vi: 'khí thải' },
      { word: 'recycle', image_hint: 'hands sorting bottles into bins', meaning_vi: 'tái chế' },
    ];
    const p = gridPrompt(words, 4, 1);
    expect(p).not.toMatch(/\{\{\w+\}\}/);
    expect(p).toContain('exactly 4 columns and 1 rows');
    expect(p).toContain('1. a green forest with a clear river\n2. smoke from a factory chimney');
    expect(p).toContain('The last 1 cell(s) stay empty');
    expect(p).not.toContain('# Prompt'); // chỉ lấy khối ```text```
  });

  it('ảnh lẻ: có từ và gợi ý', () => {
    const p = singlePrompt({ word: 'drought', image_hint: 'cracked dry earth under a hot sun' });
    expect(p).not.toMatch(/\{\{\w+\}\}/);
    expect(p).toContain('"drought"');
    expect(p).toContain('Scene: cracked dry earth under a hot sun');
  });
});
