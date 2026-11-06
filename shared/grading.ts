/**
 * Chấm dạng gõ (G, H, I, K, M). Hàm thuần — dùng được cả server lẫn trình duyệt.
 * Luật: đúng tuyệt đối, không phân biệt hoa thường, bỏ khoảng trắng đầu/cuối.
 * Sai vẫn là sai, nhưng trả gợi ý (hint) và đánh dấu từng ký tự (diff) để tô đỏ.
 */
import type { TypingHint } from './types';

export interface TypingGrade {
  correct: boolean;
  hint?: TypingHint;
  /** Ký tự học sinh đã gõ, ok=false là chỗ sai (để tô đỏ) */
  diff: { char: string; ok: boolean }[];
}

const norm = (s: string) => s.trim().toLowerCase();

/** Bảng khoảng cách Levenshtein (để vừa tính số lỗi vừa lần ngược ra chỗ sai) */
function editTable(a: string, b: string): number[][] {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
    }
  }
  return d;
}

export function levenshtein(a: string, b: string): number {
  return editTable(a, b)[a.length]![b.length]!;
}

/** Đánh dấu từng ký tự của `given` là khớp hay không so với `expected` */
function markGiven(given: string, expected: string): { char: string; ok: boolean }[] {
  const d = editTable(given, expected);
  const ok: boolean[] = new Array(given.length).fill(false);
  let i = given.length;
  let j = expected.length;
  while (i > 0 && j > 0) {
    if (given[i - 1] === expected[j - 1] && d[i]![j] === d[i - 1]![j - 1]) {
      ok[i - 1] = true;
      i--; j--;
    } else if (d[i]![j] === d[i - 1]![j - 1]! + 1) {
      i--; j--; // thay thế: ký tự này sai
    } else if (d[i]![j] === d[i - 1]![j]! + 1) {
      i--; // ký tự thừa: sai
    } else {
      j--; // thiếu ký tự ở đây
    }
  }
  return [...given].map((char, k) => ({ char, ok: ok[k]! }));
}

function isAdjacentSwap(a: string, b: string): boolean {
  if (a.length !== b.length || a === b) return false;
  const diffs: number[] = [];
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) diffs.push(k);
  return diffs.length === 2 && diffs[1] === diffs[0]! + 1 && a[diffs[0]!] === b[diffs[1]!] && a[diffs[1]!] === b[diffs[0]!];
}

export function gradeTyping(givenRaw: string, expectedRaw: string): TypingGrade {
  const givenTrim = givenRaw.trim();
  const given = norm(givenRaw);
  const expected = norm(expectedRaw);
  if (given === expected) return { correct: true, diff: [...givenTrim].map((char) => ({ char, ok: true })) };

  const diff = markGiven(given, expected).map((m, k) => ({ char: givenTrim[k] ?? m.char, ok: m.ok }));
  let hint: TypingHint | undefined;
  const noSpace = (s: string) => s.replace(/\s+/g, '');
  if (noSpace(given) === noSpace(expected)) {
    const spaces = (s: string) => (s.match(/\s/g) ?? []).length;
    hint = spaces(given) > spaces(expected) ? 'extra_space' : 'missing_space';
  } else if (isAdjacentSwap(given, expected)) {
    hint = 'swapped';
  } else if (levenshtein(given, expected) === 1) {
    hint = 'one_letter';
  }
  return { correct: false, hint, diff };
}

/** Câu nhắc tiếng Việt cho học sinh theo hint */
export const HINT_TEXT: Record<TypingHint, string> = {
  extra_space: 'Gần đúng! Bạn thừa một dấu cách.',
  missing_space: 'Gần đúng! Bạn thiếu một dấu cách.',
  one_letter: 'Gần đúng! Sai 1 chữ.',
  swapped: 'Gần đúng! Bạn đảo thứ tự 2 chữ.',
};
