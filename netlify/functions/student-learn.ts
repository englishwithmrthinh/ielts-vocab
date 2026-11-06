/**
 * API làm bài của học sinh (cần cookie học sinh). Chủ sở hữu: Sếp.
 *
 * GET  /api/home                         → HomeResponse
 * GET  /api/preview                      → PreviewResponse (từ mới chưa xem)
 * POST /api/assignment/start  {milestoneId}                → StartAssignmentResponse
 * GET  /api/assignment/next   ?assignmentId=…[&extra=1]    → NextQuestionResponse
 * POST /api/answer            {assignmentId?, qid, optionId?|text?|matches?} → AnswerResult
 * POST /api/assignment/submit {assignmentId}               → SubmitResponse
 * POST /api/flag              {qid}                        → { ok }
 */
import { randomUUID } from 'node:crypto';
import type { Config } from '@netlify/functions';
import type {
  AnswerResult, AnswerSubmission, AssignmentCard, BadgeCode, Box, HomeResponse, Milestone, NextQuestionResponse,
  PreviewResponse, QType, Question, StartAssignmentResponse, SubmitResponse,
} from '../../shared/types';
import { PASS_BOX } from '../../shared/types';
import { BOX_INTERVAL, XP } from '../../shared/question-config';
import { applyAnswer } from '../../shared/srs';
import { dueWords, fillerWords, selectWords } from '../../shared/assignment';
import { buildQuestion, chooseFixType, chooseType, grade, isTypingType, planNext, type AnswerKey, type QuestionPayload } from '../../shared/questions';
import { daysLate, scoreForDaysLate, scoreIfSubmittedAt } from '../../shared/lateness';
import { vnDate, weekStart, addDays, vnStartOfDay } from '../../shared/time';
import { makeCheck } from '../../shared/check';
import { requireStudent } from '../lib/auth';
import { errorResponse, HttpError, json, readJson } from '../lib/http';
import { db, must } from '../lib/supabase';
import {
  addXp, answersOf, cardsOf, getAssignment, getWords, loadPlan, loadStudentWords, poolWords, streakOf, toCard, toQuiz, withPool,
} from '../lib/learn';

const rng = Math.random;
const now = () => new Date().toISOString();

// ---------------- home & preview ----------------
async function home(studentId: string): Promise<HomeResponse> {
  const t = now();
  const [plan, st, xp, fresh] = await Promise.all([
    loadPlan(studentId, t),
    db().from('students').select('name,code').eq('id', studentId).single(),
    db().from('xp_events').select('amount,created_at').eq('student_id', studentId),
    db().from('student_words').select('word_id', { count: 'exact', head: true }).eq('student_id', studentId).eq('introduced', false),
  ]);
  const { owing, open, next } = cardsOf(plan);
  const list = [...owing, ...(open ? [open] : [])];
  const tomorrow = new Date(Date.parse(t) + 86_400_000).toISOString();
  const assignments: AssignmentCard[] = list.map((m, i) => {
    const a = plan.assignments.get(m.id);
    return {
      assignmentId: a?.id ?? null, milestoneId: m.id, date: m.date, kind: m.kind, status: plan.status.get(m.id)!,
      deadlineAt: m.deadline_at, currentPct: scoreIfSubmittedAt(m.date, t), tomorrowPct: scoreIfSubmittedAt(m.date, tomorrow),
      daysLateNow: daysLate(m.date, t), blocked: i > 0 && owing.length > 0,
      progress: { done: Math.min(a?.answered_count ?? 0, a?.required_count ?? 0), required: a?.required_count ?? null },
    };
  });
  const s = must(st) as { name: string; code: string };
  const xps = (must(xp) as { amount: number; created_at: string }[]);
  const wk = vnStartOfDay(weekStart(vnDate(t)));
  return {
    student: s, assignments, newWordsToPreview: fresh.count ?? 0,
    nextDeadlineAt: (open ?? next)?.deadline_at ?? null, streak: streakOf(plan),
    xpTotal: xps.reduce((n, x) => n + x.amount, 0),
    xpThisWeek: xps.filter((x) => x.created_at >= wk).reduce((n, x) => n + x.amount, 0),
    canPractice: list.length === 0,
  };
}

async function preview(studentId: string): Promise<PreviewResponse> {
  const words = (await loadStudentWords(studentId)).filter((w) => !w.introduced);
  return { cards: words.map((w) => toCard(w.w)) };
}

// ---------------- start ----------------
async function start(studentId: string, milestoneId: string): Promise<StartAssignmentResponse> {
  const t = now();
  const [plan, words] = await Promise.all([loadPlan(studentId, t), loadStudentWords(studentId)]);
  const m = plan.milestones.find((x) => x.id === milestoneId);
  if (!m || m.idx === null) throw new HttpError(404, 'not_found', 'Không tìm thấy bài này');
  const status = plan.status.get(m.id)!;
  if (status === 'locked') throw new HttpError(409, 'not_open', 'Bài này chưa mở');
  if (status === 'abandoned') throw new HttpError(409, 'abandoned', 'Bài này đã quá 7 ngày, không làm được nữa');
  const existing = plan.assignments.get(m.id);
  if (existing) {
    return { assignmentId: existing.id, required: existing.required_count ?? 0, done: Math.min(existing.answered_count, existing.required_count ?? 0), canContinueExtra: false };
  }
  const older = plan.milestones.find((x) => x.date < m.date && plan.status.get(x.id) === 'owing');
  if (older) throw new HttpError(409, 'blocked_by_older', `Làm bù bài ngày ${older.date} trước`);

  const sel = selectWords(words, m.idx);
  const fresh = words.filter((w) => !w.introduced && sel.graded.includes(w.word_id)).map((w) => w.word_id);
  const [, ins] = await Promise.all([
    fresh.length
      ? db().from('student_words').update({ introduced: true }).eq('student_id', studentId).in('word_id', fresh).then(must)
      : Promise.resolve(null),
    db().from('assignments').insert({
      student_id: studentId, milestone_id: m.id, status, started_at: t,
      required_count: sel.graded.length + sel.filler.length, answered_count: 0, word_ids: sel.graded,
    }).select('id').single(),
  ]);
  if (ins.error?.code === '23505') return start(studentId, milestoneId); // bấm 2 lần cùng lúc
  const a = must(ins) as { id: string };
  return { assignmentId: a.id, required: sel.graded.length + sel.filler.length, done: 0, canContinueExtra: sel.extra.length > 0 };
}

// ---------------- next ----------------
/**
 * Sửa sai xen kẽ: từ làm sai (câu tính điểm, không bị báo lỗi) được hỏi lại sau ít nhất
 * RELEARN_GAP câu khác, cho đến khi đúng RELEARN_NEED lần liên tiếp. Sai ở lần sửa thì đếm lại.
 * Không đổi hộp. Phải sửa xong hết mới được Nộp.
 */
const RELEARN_GAP = 4;
const RELEARN_NEED = 2;
interface Relearn { id: string; streak: number; gap: number; lastIdx: number }
function relearnQueue(answers: { word_id: string; mode: string; correct: boolean; flagged: boolean }[], inBai: Set<string>): Relearn[] {
  const st = new Map<string, Relearn>();
  answers.forEach((x, i) => {
    if (!inBai.has(x.word_id)) return;
    if (x.mode === 'graded' && !x.correct && !x.flagged) st.set(x.word_id, { id: x.word_id, streak: 0, gap: 0, lastIdx: i });
    else if (x.mode === 'fix' && st.has(x.word_id)) {
      const r = st.get(x.word_id)!;
      r.streak = x.correct ? r.streak + 1 : 0;
      r.lastIdx = i;
    }
  });
  return [...st.values()]
    .filter((r) => r.streak < RELEARN_NEED)
    .map((r) => ({ ...r, gap: answers.length - 1 - r.lastIdx }))
    .sort((p, q) => p.lastIdx - q.lastIdx);
}

interface StoredPayload extends QuestionPayload { mode: Question['mode']; wordIds: string[] }

async function next(studentId: string, assignmentId: string, extra: boolean): Promise<NextQuestionResponse> {
  const [{ a, m }, answers, pendingR, words, extraPool] = await Promise.all([
    getAssignment(studentId, assignmentId),
    answersOf(assignmentId),
    db().from('pending_questions').select('qid,payload').eq('assignment_id', assignmentId).eq('student_id', studentId)
      .order('created_at', { ascending: false }).limit(1),
    loadStudentWords(studentId),
    poolWords(),
  ]);
  const inBai = new Set(a.word_ids);
  const gradedDone = new Set(answers.filter((x) => x.mode === 'graded').map((x) => x.word_id));
  const fillerDone = answers.filter((x) => x.mode === 'practice');
  const fillerTarget = (a.required_count ?? 0) - a.word_ids.length;
  const required = a.required_count ?? 0;
  const done = Math.min(required, a.word_ids.filter((id) => gradedDone.has(id)).length + Math.min(fillerDone.length, Math.max(0, fillerTarget)));
  const fixLeft = relearnQueue(answers, inBai).length;
  const progress = { done, required, extra: [...gradedDone].filter((id) => !inBai.has(id)).length, fixLeft };
  // Đồng bộ số câu đã làm (thẻ ngoài Trang chủ + Google Sheet) theo đúng số câu bắt buộc đã làm
  const sync = a.answered_count !== done
    ? db().from('assignments').update({ answered_count: done }).eq('id', a.id).then(must)
    : Promise.resolve(null);

  const pending = must(pendingR) as { qid: string; payload: StoredPayload }[];
  if (pending[0]) {
    await sync;
    const { mode, wordIds: _w, ...rest } = pending[0].payload;
    return { question: { ...rest, qid: pending[0].qid, mode, progress }, phase: mode === 'fix' ? 'fix' : mode === 'graded' && !inBai.has(_w[0]!) ? 'extra' : 'graded' };
  }

  const byId = new Map(words.map((w) => [w.word_id, w]));
  const pool = withPool(words.map(toQuiz), extraPool);
  const prev = (answers.at(-1)?.qtype as QType | undefined) ?? null;

  let plan: { type: QType; words: ReturnType<typeof toQuiz>[] } | null = null;
  let mode: Question['mode'] = 'graded';
  let phase: NextQuestionResponse['phase'] = 'graded';

  if (!extra) {
    const relearn = relearnQueue(answers, inBai).filter((r) => byId.has(r.id));
    const fixPlan = (r: Relearn) => {
      const w = toQuiz(byId.get(r.id)!);
      // Lần sửa đầu: dạng nhận diện dễ; lần sau: dạng theo hộp (thường là dạng gõ/khó hơn)
      const type = r.streak === 0 ? chooseFixType(w, pool.length, rng) : chooseType(w, prev, pool.length, rng, ['D', 'L']);
      plan = { type, words: [w] };
      mode = 'fix'; phase = 'fix';
    };
    const ready = relearn.find((r) => r.gap >= RELEARN_GAP);
    const remaining = a.word_ids.filter((id) => !gradedDone.has(id) && byId.has(id)).map((id) => toQuiz(byId.get(id)!));
    const used = new Set(fillerDone.map((x) => x.word_id));
    const fillerId = fillerDone.length < fillerTarget ? fillerWords(words, a.word_ids, m.idx ?? 0).find((x) => !used.has(x)) : undefined;

    if (ready) {
      fixPlan(ready);
    } else if (remaining.length) {
      plan = planNext(remaining, prev, pool.length, rng);
    } else if (fillerId) {
      const w = toQuiz(byId.get(fillerId)!);
      plan = { type: chooseType(w, prev, pool.length, rng, ['D', 'L']), words: [w] };
      mode = 'practice';
    } else if (relearn.length) {
      // Hết câu khác: hỏi từ chờ lâu nhất, tránh lặp ngay từ vừa làm nếu còn từ khác
      const lastWord = answers.at(-1)?.word_id;
      fixPlan(relearn.length > 1 && relearn[0]!.id === lastWord ? relearn[1]! : relearn[0]!);
    }
  } else {
    const ex = dueWords(words, m.idx ?? 0).filter((w) => !inBai.has(w.word_id) && !gradedDone.has(w.word_id)).map(toQuiz);
    if (ex.length) { plan = planNext(ex, prev, pool.length, rng); phase = 'extra'; }
  }

  if (!plan) { await sync; return { question: null, phase: 'done' }; }
  const built = buildQuestion(plan.type, plan.words, pool, rng);
  const stored: StoredPayload = { ...built.payload, check: await makeCheck(built.key), mode, wordIds: built.wordIds };
  const [insR] = await Promise.all([
    db().from('pending_questions').insert({ student_id: studentId, assignment_id: a.id, payload: stored, answer_key: built.key })
      .select('qid').single(),
    sync,
  ]);
  const row = must(insR) as { qid: string };
  const { mode: _m, wordIds: _ids, ...pub } = stored;
  return { question: { ...pub, qid: row.qid, mode, progress }, phase };
}

// ---------------- answer ----------------
async function answer(studentId: string, sub: AnswerSubmission): Promise<AnswerResult> {
  if (!sub.qid) throw new HttpError(400, 'bad_input', 'Thiếu qid');
  const del = must(
    await db().from('pending_questions').delete().eq('qid', sub.qid).eq('student_id', studentId)
      .select('assignment_id,payload,answer_key'),
  ) as { assignment_id: string | null; payload: StoredPayload; answer_key: AnswerKey }[];
  const p = del[0];
  if (!p) throw new HttpError(410, 'question_expired', 'Câu này đã được trả lời. Tải câu tiếp theo nhé.');

  // Luyện thêm: không gắn bài, không đổi hộp
  const [ctx, words, swsR] = await Promise.all([
    p.assignment_id ? getAssignment(studentId, p.assignment_id) : Promise.resolve(null),
    getWords(p.payload.wordIds),
    db().from('student_words').select('word_id,box,typed_ok,wrong_count').eq('student_id', studentId).in('word_id', p.payload.wordIds),
  ]);
  const a = ctx?.a ?? null;
  const m = ctx?.m ?? null;
  const out = grade(p.answer_key, sub);
  const type = p.payload.type;
  const mode = a ? p.payload.mode : 'practice';
  const sws = must(swsR) as { word_id: string; box: Box; typed_ok: boolean; wrong_count: number }[];
  const swBy = new Map(sws.map((s) => [s.word_id, s]));
  const t = now();

  let xp = 0;
  let passed = false;
  const rows = [];
  const writes: PromiseLike<unknown>[] = [];
  for (const [i, pw] of out.perWord.entries()) {
    const s = swBy.get(pw.wordId);
    let boxAfter: Box | null = s?.box ?? null;
    if (mode === 'graded' && s) {
      const r = applyAnswer(s, pw.correct, isTypingType(type), m?.idx ?? 0);
      boxAfter = r.box;
      passed ||= r.passed;
      writes.push(db().from('student_words').update({
        box: r.box, due_idx: r.due_idx, typed_ok: r.typed_ok, wrong_count: r.wrong_count, last_answered_at: t,
      }).eq('student_id', studentId).eq('word_id', pw.wordId).then(must));
      if (pw.correct) xp += isTypingType(type) ? XP.typingCorrect : XP.choiceCorrect;
      if (r.passed) xp += XP.wordPassed;
    } else if (s) {
      writes.push(db().from('student_words').update({ last_answered_at: t }).eq('student_id', studentId).eq('word_id', pw.wordId).then(must));
      if (mode === 'practice' && pw.correct) xp += XP.practiceCorrect;
    }
    rows.push({
      id: i === 0 ? sub.qid : randomUUID(), // mọi dòng đều có id: insert nhiều dòng thiếu cột sẽ bị gửi NULL
      student_id: studentId, assignment_id: a?.id ?? null, word_id: pw.wordId, qtype: type, mode,
      given: out.given.slice(0, 500), correct: pw.correct, hint_code: out.hint ?? null,
      box_before: s?.box ?? null, box_after: boxAfter,
    });
  }
  writes.push(db().from('answers').insert(rows).then(must));
  // answered_count được tính lại chính xác từ bảng answers ở lần gọi next() kế tiếp (không cộng dồn ở đây nữa)
  writes.push(addXp(studentId, xp, a ? `answer:${type}` : `practice:${type}`));
  await Promise.all(writes);

  const cards = p.payload.wordIds.map((id) => words.get(id)).filter((w) => !!w).map((w) => toCard(w!));
  return {
    correct: out.correct, perWord: out.perWord.length > 1 ? out.perWord : undefined, expected: out.expected,
    correctOptionId: out.correctOptionId, hint: out.hint, diff: out.diff,
    wordCard: cards[0]!, wordCards: cards.length > 1 ? cards : undefined, xp, passed: passed || undefined,
  };
}

// ---------------- submit ----------------
const PASS_BADGES: [number, BadgeCode][] = [[10, 'pass_10'], [50, 'pass_50'], [100, 'pass_100'], [300, 'pass_300']];
const STREAK_BADGES: [number, BadgeCode][] = [[6, 'streak_6'], [12, 'streak_12'], [24, 'streak_24']];

async function submit(studentId: string, assignmentId: string): Promise<SubmitResponse> {
  const [{ a, m }, answers] = await Promise.all([getAssignment(studentId, assignmentId), answersOf(assignmentId)]);
  if (a.status === 'submitted') throw new HttpError(409, 'already_submitted', 'Bài này đã nộp rồi');
  const gradedDone = new Set(answers.filter((x) => x.mode === 'graded').map((x) => x.word_id));
  const fillerDone = answers.filter((x) => x.mode === 'practice').length;
  const fillerTarget = (a.required_count ?? 0) - a.word_ids.length;
  if (a.word_ids.some((id) => !gradedDone.has(id)) || fillerDone < fillerTarget) {
    throw new HttpError(409, 'not_ready', 'Còn câu bắt buộc chưa làm');
  }
  if (relearnQueue(answers, new Set(a.word_ids)).length) {
    throw new HttpError(409, 'not_ready', 'Còn từ làm sai chưa làm đúng lại');
  }
  const t = now();
  const late = daysLate(m.date, t);
  const score = scoreForDaysLate(late);
  if (score === null) throw new HttpError(409, 'abandoned', 'Bài này đã quá 7 ngày, không nộp được nữa');
  const ws = weekStart(m.date);
  const pwReason = `perfect_week:${ws}`;
  // Ghi nộp bài trước, rồi đọc song song những thứ cần cho tuần hoàn hảo và huy hiệu
  must(await db().from('assignments').update({ status: 'submitted', submitted_at: t, days_late: late, score_pct: score }).eq('id', a.id));
  const [weekMsR, weekAsR, hadR, plan, passR] = await Promise.all([
    db().from('milestones').select('id').eq('is_off', false).gte('date', ws).lte('date', addDays(ws, 6)),
    db().from('assignments').select('milestone_id,status,days_late,m:milestones!inner(date,is_off)').eq('student_id', studentId)
      .gte('m.date', ws).lte('m.date', addDays(ws, 6)),
    db().from('xp_events').select('id').eq('student_id', studentId).eq('reason', pwReason).limit(1),
    loadPlan(studentId, t),
    db().from('student_words').select('word_id', { count: 'exact', head: true }).eq('student_id', studentId).eq('box', PASS_BOX),
  ]);
  const weekMs = must(weekMsR) as { id: string }[];
  const weekAs = must(weekAsR) as unknown as { milestone_id: string; status: string; days_late: number | null }[];
  const passCount = passR.count ?? 0;

  let xpGained = 0;
  const xpWrites: Promise<void>[] = [];
  if (late === 0) { xpGained += XP.onTimeSubmit; xpWrites.push(addXp(studentId, XP.onTimeSubmit, `submit:${a.id}`)); }
  // Tuần hoàn hảo: mọi mốc không nghỉ trong tuần (Thứ 2–CN) của bài này đều nộp đúng hạn
  const perfectWeek = weekMs.length > 0 && weekMs.every((x) => weekAs.some((y) => y.milestone_id === x.id && y.status === 'submitted' && y.days_late === 0));
  if (perfectWeek && !(must(hadR) as unknown[]).length) { xpGained += XP.perfectWeek; xpWrites.push(addXp(studentId, XP.perfectWeek, pwReason)); }

  // Huy hiệu
  const streak = streakOf(plan);
  const want: BadgeCode[] = [
    ...(late === 0 ? ['first_submit' as BadgeCode] : []),
    ...(perfectWeek ? ['perfect_week' as BadgeCode] : []),
    ...PASS_BADGES.filter(([n]) => passCount >= n).map(([, c]) => c),
    ...STREAK_BADGES.filter(([n]) => streak >= n).map(([, c]) => c),
  ];
  let newBadges: BadgeCode[] = [];
  if (want.length) {
    const ins = must(
      await db().from('badges').upsert(want.map((code) => ({ student_id: studentId, code })), { onConflict: 'student_id,code', ignoreDuplicates: true })
        .select('code'),
    ) as { code: BadgeCode }[];
    newBadges = ins.map((x) => x.code);
  }
  await Promise.all(xpWrites);

  const graded = answers.filter((x) => x.mode === 'graded' && a.word_ids.includes(x.word_id) && !x.flagged);
  return {
    daysLate: late, scorePct: score, xpGained, newBadges, perfectWeek,
    summary: {
      correct: graded.filter((x) => x.correct).length, total: graded.length,
      passedWords: answers.filter((x) => x.mode === 'graded' && x.box_after === PASS_BOX && (x.box_before ?? 0) < PASS_BOX).length,
    },
  };
}

// ---------------- flag ----------------
async function flag(studentId: string, qid: string): Promise<void> {
  const r = must(await db().from('answers').select('id,word_id,mode,correct,flagged,box_before,assignment_id').eq('id', qid).eq('student_id', studentId).maybeSingle()) as
    { id: string; word_id: string; mode: string; correct: boolean; flagged: boolean; box_before: number | null; assignment_id: string | null } | null;
  if (!r) throw new HttpError(404, 'not_found', 'Không tìm thấy câu này');
  if (r.flagged) return;
  must(await db().from('answers').update({ flagged: true }).eq('id', r.id));
  if (r.mode === 'graded' && !r.correct && r.box_before && r.assignment_id) {
    const { m } = await getAssignment(studentId, r.assignment_id);
    const sw = must(await db().from('student_words').select('wrong_count').eq('student_id', studentId).eq('word_id', r.word_id).single()) as { wrong_count: number };
    const box = r.box_before as Box;
    must(await db().from('student_words').update({
      box, due_idx: (m.idx ?? 0) + BOX_INTERVAL[box], wrong_count: Math.max(0, sw.wrong_count - 1),
    }).eq('student_id', studentId).eq('word_id', r.word_id));
  }
}

// ---------------- router ----------------
export default async (req: Request): Promise<Response> => {
  try {
    const studentId = requireStudent(req);
    const url = new URL(req.url);
    const p = url.pathname;
    if (p === '/api/home' && req.method === 'GET') return json(await home(studentId));
    if (p === '/api/preview' && req.method === 'GET') return json(await preview(studentId));
    if (p === '/api/assignment/start' && req.method === 'POST') {
      const { milestoneId } = await readJson<{ milestoneId?: string }>(req);
      if (!milestoneId) throw new HttpError(400, 'bad_input', 'Thiếu milestoneId');
      return json(await start(studentId, milestoneId));
    }
    if (p === '/api/assignment/next' && req.method === 'GET') {
      const id = url.searchParams.get('assignmentId');
      if (!id) throw new HttpError(400, 'bad_input', 'Thiếu assignmentId');
      return json(await next(studentId, id, url.searchParams.get('extra') === '1'));
    }
    if (p === '/api/answer' && req.method === 'POST') return json(await answer(studentId, await readJson<AnswerSubmission>(req)));
    if (p === '/api/assignment/submit' && req.method === 'POST') {
      const { assignmentId } = await readJson<{ assignmentId?: string }>(req);
      if (!assignmentId) throw new HttpError(400, 'bad_input', 'Thiếu assignmentId');
      return json(await submit(studentId, assignmentId));
    }
    if (p === '/api/flag' && req.method === 'POST') {
      const { qid } = await readJson<{ qid?: string }>(req);
      if (!qid) throw new HttpError(400, 'bad_input', 'Thiếu qid');
      await flag(studentId, qid);
      return json({ ok: true });
    }
    throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = {
  path: ['/api/home', '/api/preview', '/api/assignment/start', '/api/assignment/next', '/api/answer', '/api/assignment/submit', '/api/flag'],
};
