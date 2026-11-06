// Bộ máy bài làm GIẢ — chỉ để thử giao diện khi chưa có backend.
// Mỗi bài thử gồm đủ 13 dạng A–M, có vòng sửa sai và "Làm tiếp".
// Trạng thái lưu sessionStorage để thử "thoát giữa chừng rồi vào lại".
import type {
  AnswerResult, AnswerSubmission, NextQuestionResponse, Option, PreviewResponse, QType, Question,
  StartAssignmentResponse, SubmitResponse, WordCard,
} from '@shared/types';
import { daysBetween } from '@shared/time';
import { scoreForDaysLate } from '@shared/lateness';
import { todayVN } from '../lib/format';
import { gradeTyping } from '@shared/grading';
import { MOCK_WORDS, wordById } from './words';

type Key =
  | { kind: 'option'; correctId: string }
  | { kind: 'text'; expected: string }
  | { kind: 'matches'; key: Record<string, string>; expectedText: string };

interface Item {
  q: Question;
  key: Key;
  wordIds: string[];
}

interface State {
  assignmentId: string;
  milestoneId: string;
  graded: Item[];
  fix: Item[];
  extra: Item[];
  /** câu đang làm: index trong danh sách của phase */
  phase: 'graded' | 'fix' | 'extra' | 'done';
  idx: number;
  wrongWords: string[];
  correct: number;
  total: number;
  xp: number;
  passedWords: number;
  submitted: boolean;
}

const KEY = (m: string) => `ielts.mock.lesson.${m}`;
const load = (m: string): State | null => {
  try {
    const v = sessionStorage.getItem(KEY(m));
    return v ? (JSON.parse(v) as State) : null;
  } catch {
    return null;
  }
};
const save = (s: State) => {
  try {
    sessionStorage.setItem(KEY(s.milestoneId), JSON.stringify(s));
  } catch {
    /* bỏ qua */
  }
};
const byAssignment = (aid: string): State => {
  const m = aid.replace(/^as-/, '');
  const s = load(m);
  if (!s) throw new Error('Không tìm thấy bài (mock)');
  return s;
};

// ---------- tiện ích dựng câu ----------
let seed = 7;
const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [b[i], b[j]] = [b[j]!, b[i]!];
  }
  return b;
}
const blankOut = (sentence: string, word: string) =>
  sentence.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '___');

function distractors(w: WordCard, n = 3): WordCard[] {
  const same = MOCK_WORDS.filter((x) => x.wordId !== w.wordId && x.pos === w.pos);
  const other = MOCK_WORDS.filter((x) => x.wordId !== w.wordId && x.pos !== w.pos);
  return [...shuffle(same), ...shuffle(other)].slice(0, n);
}

let qn = 0;
const base = (type: QType, mode: Question['mode']): Question => ({
  qid: `q${++qn}-${type}`,
  type,
  mode,
  progress: { done: 0, required: 0, extra: 0 },
  prompt: {},
});

function choice(type: 'A' | 'B' | 'C' | 'E' | 'J', w: WordCard, mode: Question['mode'] = 'graded'): Item {
  const q = base(type, mode);
  const all = shuffle([w, ...distractors(w)]);
  const label = (x: WordCard) => (type === 'A' ? x.meaningVi : x.word);
  q.options = all.map((x, i) => ({ id: `o${i}`, text: label(x) }));
  const correctId = q.options[all.indexOf(w)]!.id;
  if (type === 'A') q.prompt = { word: w.word, pos: w.pos };
  if (type === 'B') q.prompt = { imageUrl: w.imageUrl ?? undefined };
  if (type === 'C') q.prompt = { audioUrl: w.audioUrl ?? `tts:${w.word}` };
  if (type === 'E') q.prompt = { meaningVi: w.meaningVi, pos: w.pos };
  if (type === 'J') q.prompt = { sentence: blankOut(w.example ?? '', w.word) };
  return { q, key: { kind: 'option', correctId }, wordIds: [w.wordId] };
}

function typing(type: 'F' | 'G' | 'H' | 'I' | 'K' | 'M', w: WordCard): Item {
  const q = base(type, 'graded');
  let expected = w.word;
  if (type === 'F') q.prompt = { meaningVi: w.meaningVi, letters: shuffle([...w.word.replace(/\s/g, '')]) };
  if (type === 'G') {
    const chars = [...w.word];
    const idx = shuffle(chars.map((_, i) => i).filter((i) => i > 0 && chars[i] !== ' ')).slice(0, Math.round(chars.length * 0.4));
    q.prompt = { meaningVi: w.meaningVi, masked: chars.map((c, i) => (idx.includes(i) ? '_' : c)).join('') };
  }
  if (type === 'H') q.prompt = { audioUrl: w.audioUrl ?? `tts:${w.word}` };
  if (type === 'I') q.prompt = { imageUrl: w.imageUrl ?? undefined, pos: w.pos };
  if (type === 'K') q.prompt = { sentence: blankOut(w.example ?? '', w.word), firstLetter: w.word[0] };
  if (type === 'M') {
    const f = w.wordFamily[0]!;
    q.prompt = { sentence: f.sentence, baseWord: w.word, pos: f.pos };
    expected = f.form;
  }
  return { q, key: { kind: 'text', expected }, wordIds: [w.wordId] };
}

function match(ws: WordCard[]): Item {
  const q = base('D', 'graded');
  const right = shuffle(ws).map((w, i) => ({ id: `r${i}`, text: w.meaningVi, wid: w.wordId }));
  q.pairs = {
    left: ws.map((w) => ({ id: w.wordId, text: w.word })),
    right: right.map(({ id, text }) => ({ id, text })),
  };
  const key = Object.fromEntries(ws.map((w) => [w.wordId, right.find((r) => r.wid === w.wordId)!.id]));
  return { q, key: { kind: 'matches', key, expectedText: ws.map((w) => `${w.word} = ${w.meaningVi}`).join(' · ') }, wordIds: ws.map((w) => w.wordId) };
}

function dragSentences(ws: WordCard[]): Item {
  const q = base('L', 'graded');
  q.blanks = ws.map((w) => ({ id: w.wordId, sentence: blankOut(w.example ?? '', w.word) }));
  const bank = shuffle(ws).map((w, i) => ({ id: `b${i}`, text: w.word, wid: w.wordId }));
  q.bank = bank.map(({ id, text }) => ({ id, text }));
  const key = Object.fromEntries(ws.map((w) => [w.wordId, bank.find((b) => b.wid === w.wordId)!.id]));
  return { q, key: { kind: 'matches', key, expectedText: ws.map((w) => w.word).join(' · ') }, wordIds: ws.map((w) => w.wordId) };
}

function buildGraded(): Item[] {
  seed = 7;
  const w = (i: number) => MOCK_WORDS[i - 1]!;
  return [
    choice('A', w(1)), choice('B', w(2)), choice('C', w(3)),
    match([w(4), w(5), w(6), w(7), w(8)]),
    choice('E', w(5)), typing('F', w(6)), typing('G', w(7)), typing('H', w(8)),
    typing('I', w(9)), choice('J', w(10)), typing('K', w(11)),
    dragSentences([w(1), w(3), w(6), w(8), w(12)]),
    typing('M', w(2)), choice('E', w(12)), choice('J', w(4)),
  ];
}

function withProgress(s: State, item: Item): Question {
  const answeredGraded = s.phase === 'graded' ? s.idx : s.graded.length;
  return {
    ...item.q,
    progress: { done: answeredGraded, required: s.graded.length, extra: s.phase === 'extra' ? s.idx : 0 },
  };
}

const listOf = (s: State) => (s.phase === 'graded' ? s.graded : s.phase === 'fix' ? s.fix : s.extra);

// ---------- API giả ----------
export const mockLesson = {
  preview(milestoneId: string): PreviewResponse {
    const s = load(milestoneId);
    if (s) return { cards: [] }; // đã bấm Bắt đầu → đã xem
    return { cards: MOCK_WORDS.slice(0, 6) };
  },

  start(milestoneId: string): StartAssignmentResponse {
    let s = load(milestoneId);
    if (!s) {
      s = {
        assignmentId: `as-${milestoneId}`, milestoneId, graded: buildGraded(), fix: [], extra: [],
        phase: 'graded', idx: 0, wrongWords: [], correct: 0, total: 0, xp: 0, passedWords: 0, submitted: false,
      };
      save(s);
    }
    return {
      assignmentId: s.assignmentId,
      required: s.graded.length,
      done: s.phase === 'graded' ? s.idx : s.graded.length,
      canContinueExtra: true,
    };
  },

  next(assignmentId: string, wantExtra = false): NextQuestionResponse {
    const s = byAssignment(assignmentId);
    if (s.phase === 'done' && wantExtra) {
      seed = 99;
      s.extra = [choice('A', MOCK_WORDS[6]!), typing('K', MOCK_WORDS[11]!), choice('E', MOCK_WORDS[8]!)].map((it) => ({
        ...it,
        q: { ...it.q, mode: 'graded' as const },
      }));
      s.phase = 'extra';
      s.idx = 0;
      save(s);
    }
    const list = listOf(s);
    const item = list[s.idx];
    if (s.phase === 'done' || !item) return { question: null, phase: 'done' };
    return { question: withProgress(s, item), phase: s.phase };
  },

  answer(assignmentId: string, a: AnswerSubmission): AnswerResult {
    const s = byAssignment(assignmentId);
    const list = listOf(s);
    const item = list[s.idx];
    if (!item || item.q.qid !== a.qid) throw new Error('Câu hỏi không khớp (mock)');
    const k = item.key;
    const cards = item.wordIds.map(wordById);
    let res: AnswerResult;
    const typingType = ['F', 'G', 'H', 'I', 'K', 'M'].includes(item.q.type);

    if (k.kind === 'option') {
      const correct = a.optionId === k.correctId;
      res = { correct, expected: item.q.options!.find((o: Option) => o.id === k.correctId)!.text, wordCard: cards[0]!, xp: 0 };
    } else if (k.kind === 'text') {
      const g = gradeTyping(a.text ?? '', k.expected);
      res = { correct: g.correct, hint: g.hint, diff: g.correct ? undefined : g.diff, expected: k.expected, wordCard: cards[0]!, xp: 0 };
    } else {
      const perWord = Object.entries(k.key).map(([wid, rid]) => ({ wordId: wid, correct: a.matches?.[wid] === rid }));
      res = {
        correct: perWord.every((p) => p.correct), perWord, expected: k.expectedText,
        wordCard: cards[0]!, wordCards: cards, xp: 0,
      };
    }

    const graded = item.q.mode === 'graded';
    if (graded) {
      const n = res.perWord?.filter((p) => p.correct).length ?? (res.correct ? 1 : 0);
      res.xp = n * (typingType ? 15 : 10);
      // Thử hiệu ứng: gõ đúng câu K thì coi như từ vừa Pass
      if (res.correct && item.q.type === 'K') {
        res.passed = true;
        res.xp += 50;
        s.passedWords++;
      }
      s.xp += res.xp;
      s.total += res.perWord?.length ?? 1;
      s.correct += n;
      const wrong = res.perWord ? res.perWord.filter((p) => !p.correct).map((p) => p.wordId) : res.correct ? [] : item.wordIds;
      if (s.phase === 'graded') s.wrongWords.push(...wrong);
    }

    s.idx++;
    if (s.phase === 'graded' && s.idx >= s.graded.length) {
      seed = 31;
      s.fix = [...new Set(s.wrongWords)].map((wid, i) => choice(i % 2 ? 'E' : 'A', wordById(wid), 'fix'));
      s.phase = s.fix.length ? 'fix' : 'done';
      s.idx = 0;
    } else if (s.phase === 'fix' && s.idx >= s.fix.length) {
      s.phase = 'done';
      s.idx = 0;
    } else if (s.phase === 'extra' && s.idx >= s.extra.length) {
      s.phase = 'done';
      s.idx = 0;
    }
    save(s);
    return res;
  },

  submit(assignmentId: string): SubmitResponse {
    const s = byAssignment(assignmentId);
    const date = s.milestoneId.replace(/^ms-/, '');
    const late = Math.max(0, daysBetween(date, todayVN()));
    const onTime = late === 0;
    const xpGained = onTime ? 30 : 0;
    s.submitted = true;
    save(s);
    return {
      daysLate: late,
      scorePct: scoreForDaysLate(late) ?? 0,
      xpGained,
      newBadges: ['first_submit'],
      perfectWeek: false,
      summary: { correct: s.correct, total: s.total, passedWords: s.passedWords },
    };
  },

  /** Xoá bài thử (nút "Làm lại từ đầu" chỉ có ở chế độ mock) */
  reset(milestoneId: string) {
    try {
      sessionStorage.removeItem(KEY(milestoneId));
    } catch {
      /* bỏ qua */
    }
  },
};
