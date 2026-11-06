/**
 * Chọn từ cho một bài. Hàm thuần — không đụng database.
 *
 * - graded: từ đến hạn (due_idx <= idx của bài), quá hạn lâu nhất trước, rồi hộp thấp trước.
 *   Tối đa ASSIGNMENT_LIMITS.maxRequired. Phần dư = "Làm tiếp" (extra).
 * - Bài có ít hơn minRequired từ đến hạn: bù bằng câu ôn (filler) các từ hộp thấp nhất,
 *   KHÔNG đổi hộp.
 */
import type { Box, UUID } from './types';
import { ASSIGNMENT_LIMITS } from './question-config';

export interface StudentWordLite {
  word_id: UUID;
  box: Box;
  due_idx: number;
  introduced: boolean;
  typed_ok: boolean;
}

export interface WordSelection {
  graded: UUID[];
  extra: UUID[];
  filler: UUID[];
}

const byPriority = (a: StudentWordLite, b: StudentWordLite) =>
  a.due_idx - b.due_idx || a.box - b.box || (a.word_id < b.word_id ? -1 : 1);

export function dueWords<T extends StudentWordLite>(words: T[], idx: number): T[] {
  return words.filter((w) => w.due_idx <= idx).sort(byPriority);
}

export function selectWords(words: StudentWordLite[], idx: number): WordSelection {
  const due = dueWords(words, idx);
  const graded = due.slice(0, ASSIGNMENT_LIMITS.maxRequired).map((w) => w.word_id);
  const extra = due.slice(ASSIGNMENT_LIMITS.maxRequired).map((w) => w.word_id);
  return { graded, extra, filler: fillerWords(words, graded, idx) };
}

/** Câu ôn bù cho đủ minRequired: từ chưa đến hạn, hộp thấp nhất trước */
export function fillerWords(words: StudentWordLite[], exclude: UUID[], _idx: number): UUID[] {
  const need = ASSIGNMENT_LIMITS.minRequired - exclude.length;
  if (need <= 0) return [];
  const skip = new Set(exclude);
  return words
    .filter((w) => !skip.has(w.word_id))
    .sort((a, b) => a.box - b.box || a.due_idx - b.due_idx || (a.word_id < b.word_id ? -1 : 1))
    .slice(0, need)
    .map((w) => w.word_id);
}
