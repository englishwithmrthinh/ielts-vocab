/**
 * Sinh câu hỏi và chấm. Hàm thuần — không đụng database.
 * Server giữ `key` (đáp án), chỉ gửi `payload` xuống trình duyệt.
 */
import type { AnswerSubmission, Box, Option, PartOfSpeech, QType, Question, TypingHint, UUID, WordFamilyItem } from './types';
import {
  DRAG_BLANKS_MAX, FIX_QTYPES, FORCED_TYPING_QTYPES, MATCH_PAIRS, MULTI_WORD_MIN, MULTI_WORD_QTYPES,
  QTYPES_BY_BOX, SPELLING_MASK_RATIO, TYPING_QTYPES,
} from './question-config';
import { gradeTyping } from './grading';

export interface QuizWord {
  id: UUID;
  word: string;
  pos: PartOfSpeech;
  meaning_vi: string;
  example: string | null;
  word_family: WordFamilyItem[];
  image_url: string | null;
  audio_url: string | null;
  box: Box;
  typed_ok: boolean;
}

export type AnswerKey =
  | { kind: 'option'; wordId: UUID; correctOptionId: string; expected: string }
  | { kind: 'text'; wordId: UUID; expected: string }
  | { kind: 'match'; pairs: Record<UUID, string>; expected: string };

export type QuestionPayload = Omit<Question, 'qid' | 'mode' | 'progress'>;

export interface BuiltQuestion {
  type: QType;
  wordIds: UUID[];
  payload: QuestionPayload;
  key: AnswerKey;
}

export type Rng = () => number;

// ---------------- tiện ích ----------------
export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Thay lần xuất hiện đầu tiên của từ (nguyên dạng, theo ranh giới từ) bằng ___ ; null nếu không thấy */
export function blankSentence(sentence: string | null, word: string): string | null {
  if (!sentence) return null;
  const re = new RegExp(`(^|[^A-Za-z])(${escapeRe(word)})(?=[^A-Za-z]|$)`, 'i');
  if (!re.test(sentence)) return null;
  return sentence.replace(re, (_m, pre: string) => `${pre}___`);
}

export const isTypingType = (t: QType) => TYPING_QTYPES.includes(t);
const OPTION_TYPES: QType[] = ['A', 'B', 'C', 'E', 'J'];

/** Từ này có đủ dữ liệu cho dạng câu này không */
export function supports(w: QuizWord, t: QType, poolSize: number): boolean {
  if ((OPTION_TYPES.includes(t) || t === 'D') && poolSize < 4) return false;
  switch (t) {
    case 'B': case 'I': return !!w.image_url;
    case 'C': case 'H': return !!w.audio_url;
    case 'J': case 'K': case 'L': return blankSentence(w.example, w.word) !== null;
    case 'M': return w.word_family.length > 0;
    case 'F': return !/\s/.test(w.word) && w.word.length >= 3;
    default: return true;
  }
}

export function chooseType(w: QuizWord, prev: QType | null, poolSize: number, rng: Rng, exclude: QType[] = []): QType {
  const base = w.box === 5 && !w.typed_ok ? FORCED_TYPING_QTYPES : QTYPES_BY_BOX[w.box];
  let cands = base.filter((t) => !exclude.includes(t) && supports(w, t, poolSize));
  if (!cands.length) cands = (['A', 'E', 'G'] as QType[]).filter((t) => supports(w, t, poolSize));
  if (!cands.length) cands = ['G'];
  if (cands.length > 1 && prev) cands = cands.filter((t) => t !== prev);
  return cands[Math.floor(rng() * cands.length)]!;
}

/**
 * Lên kế hoạch câu tiếp theo từ danh sách từ còn lại (đã xếp ưu tiên).
 * D, L gom 4–5 từ cùng hộp; không đủ thì đổi dạng khác.
 */
export function planNext(
  remaining: QuizWord[], prev: QType | null, poolSize: number, rng: Rng,
): { type: QType; words: QuizWord[] } {
  const first = remaining[0]!;
  let type = chooseType(first, prev, poolSize, rng);
  if (MULTI_WORD_QTYPES.includes(type)) {
    const max = type === 'D' ? MATCH_PAIRS : DRAG_BLANKS_MAX;
    const group = remaining.filter((w) => w.box === first.box && supports(w, type, poolSize)).slice(0, max);
    if (group.length >= MULTI_WORD_MIN && group[0]!.id === first.id) return { type, words: group };
    type = chooseType(first, prev, poolSize, rng, MULTI_WORD_QTYPES);
  }
  return { type, words: [first] };
}

export function chooseFixType(w: QuizWord, poolSize: number, rng: Rng): QType {
  const c = FIX_QTYPES.filter((t) => supports(w, t, poolSize));
  return c.length ? c[Math.floor(rng() * c.length)]! : 'G';
}

// ---------------- dựng câu ----------------
function distractors(target: QuizWord, pool: QuizWord[], n: number, field: 'word' | 'meaning_vi', rng: Rng): string[] {
  const seen = new Set([target[field].toLowerCase()]);
  const pick = (list: QuizWord[]) => {
    const out: string[] = [];
    for (const w of shuffle(list, rng)) {
      const v = w[field];
      if (w.id === target.id || seen.has(v.toLowerCase())) continue;
      seen.add(v.toLowerCase());
      out.push(v);
      if (out.length >= n) break;
    }
    return out;
  };
  const same = pick(pool.filter((w) => w.pos === target.pos));
  return same.length >= n ? same : [...same, ...pick(pool.filter((w) => w.pos !== target.pos))].slice(0, n);
}

function optionQuestion(
  target: QuizWord, correct: string, others: string[], rng: Rng,
): { options: Option[]; correctOptionId: string } {
  const texts = shuffle([correct, ...others], rng);
  const options = texts.map((text, i) => ({ id: `o${i + 1}`, text }));
  return { options, correctOptionId: options.find((o) => o.text === correct)!.id };
}

export function maskWord(word: string, rng: Rng): string {
  const idxs = [...word].map((c, i) => (i > 0 && /[A-Za-z]/.test(c) ? i : -1)).filter((i) => i >= 0);
  const n = Math.max(1, Math.round(idxs.length * SPELLING_MASK_RATIO));
  const hide = new Set(shuffle(idxs, rng).slice(0, n));
  return [...word].map((c, i) => (hide.has(i) ? '_' : c)).join('');
}

function scramble(word: string, rng: Rng): string[] {
  const letters = [...word];
  for (let k = 0; k < 5; k++) {
    const s = shuffle(letters, rng);
    if (s.join('') !== word) return s;
  }
  return [...letters].reverse();
}

export function buildQuestion(type: QType, words: QuizWord[], pool: QuizWord[], rng: Rng): BuiltQuestion {
  const w = words[0]!;
  const one = (payload: QuestionPayload, key: AnswerKey): BuiltQuestion => ({ type, wordIds: [w.id], payload, key });
  const text = (expected: string): AnswerKey => ({ kind: 'text', wordId: w.id, expected });

  switch (type) {
    case 'A': {
      const o = optionQuestion(w, w.meaning_vi, distractors(w, pool, 3, 'meaning_vi', rng), rng);
      return one({ type, prompt: { word: w.word, pos: w.pos, audioUrl: w.audio_url ?? undefined }, options: o.options },
        { kind: 'option', wordId: w.id, correctOptionId: o.correctOptionId, expected: w.meaning_vi });
    }
    case 'B': case 'C': case 'E': case 'J': {
      const o = optionQuestion(w, w.word, distractors(w, pool, 3, 'word', rng), rng);
      const prompt: Question['prompt'] =
        type === 'B' ? { imageUrl: w.image_url!, pos: w.pos }
        : type === 'C' ? { audioUrl: w.audio_url! }
        : type === 'E' ? { meaningVi: w.meaning_vi, pos: w.pos }
        : { sentence: blankSentence(w.example, w.word)!, pos: w.pos };
      return one({ type, prompt, options: o.options },
        { kind: 'option', wordId: w.id, correctOptionId: o.correctOptionId, expected: w.word });
    }
    case 'D': {
      const right = shuffle(words.map((x) => x.meaning_vi), rng).map((t, i) => ({ id: `r${i + 1}`, text: t }));
      const pairs: Record<UUID, string> = {};
      for (const x of words) pairs[x.id] = right.find((r) => r.text === x.meaning_vi)!.id;
      return {
        type, wordIds: words.map((x) => x.id),
        payload: { type, prompt: {}, pairs: { left: shuffle(words.map((x) => ({ id: x.id, text: x.word })), rng), right } },
        key: { kind: 'match', pairs, expected: words.map((x) => `${x.word} – ${x.meaning_vi}`).join('; ') },
      };
    }
    case 'L': {
      const bank = shuffle(words.map((x) => x.word), rng).map((t, i) => ({ id: `b${i + 1}`, text: t }));
      const pairs: Record<UUID, string> = {};
      for (const x of words) pairs[x.id] = bank.find((b) => b.text === x.word)!.id;
      return {
        type, wordIds: words.map((x) => x.id),
        payload: { type, prompt: {}, blanks: words.map((x) => ({ id: x.id, sentence: blankSentence(x.example, x.word)! })), bank },
        key: { kind: 'match', pairs, expected: words.map((x) => x.word).join(', ') },
      };
    }
    case 'F':
      return one({ type, prompt: { meaningVi: w.meaning_vi, pos: w.pos, letters: scramble(w.word, rng) } }, text(w.word));
    case 'G':
      return one({ type, prompt: { meaningVi: w.meaning_vi, pos: w.pos, masked: maskWord(w.word, rng) } }, text(w.word));
    case 'H':
      return one({ type, prompt: { audioUrl: w.audio_url! } }, text(w.word));
    case 'I':
      return one({ type, prompt: { imageUrl: w.image_url!, pos: w.pos } }, text(w.word));
    case 'K':
      return one({ type, prompt: { sentence: blankSentence(w.example, w.word)!, firstLetter: w.word[0]!, pos: w.pos } }, text(w.word));
    case 'M': {
      const f = w.word_family[Math.floor(rng() * w.word_family.length)]!;
      return one({ type, prompt: { sentence: f.sentence, baseWord: w.word, pos: f.pos } }, text(f.form));
    }
  }
}

// ---------------- chấm ----------------
export interface GradeOutcome {
  correct: boolean;
  perWord: { wordId: UUID; correct: boolean }[];
  expected: string;
  correctOptionId?: string;
  hint?: TypingHint;
  diff?: { char: string; ok: boolean }[];
  given: string;
}

export function grade(key: AnswerKey, sub: AnswerSubmission): GradeOutcome {
  if (key.kind === 'option') {
    const correct = sub.optionId === key.correctOptionId;
    return { correct, perWord: [{ wordId: key.wordId, correct }], expected: key.expected, correctOptionId: key.correctOptionId, given: sub.optionId ?? '' };
  }
  if (key.kind === 'text') {
    const g = gradeTyping(sub.text ?? '', key.expected);
    return { correct: g.correct, perWord: [{ wordId: key.wordId, correct: g.correct }], expected: key.expected, hint: g.hint, diff: g.diff, given: sub.text ?? '' };
  }
  const perWord = Object.entries(key.pairs).map(([wordId, target]) => ({ wordId, correct: sub.matches?.[wordId] === target }));
  return { correct: perWord.every((p) => p.correct), perWord, expected: key.expected, given: JSON.stringify(sub.matches ?? {}) };
}
