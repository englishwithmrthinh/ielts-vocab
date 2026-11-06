/**
 * API học sinh — giai đoạn 3. Chủ sở hữu: Sếp.
 *
 * GET  /api/progress        → ProgressResponse            (cần cookie học sinh)
 * GET  /api/my-words        → MyWordsResponse             (cần cookie học sinh)
 * POST /api/my-words        {text, note?} → AddWordResponse
 * GET  /api/practice/next   → NextQuestionResponse (mode 'practice'; trả lời bằng POST /api/answer)
 * GET  /api/report/:token   → ParentReportResponse        (KHÔNG cần đăng nhập; 404 nếu token sai)
 */
import type { Config } from '@netlify/functions';
import type {
  AddWordResponse, BadgeCode, Box, MonthlyReport, MyWordsResponse, NextQuestionResponse, ParentReportResponse, ProgressResponse,
} from '../../shared/types';
import { PASS_BOX } from '../../shared/types';
import { buildQuestion, chooseType } from '../../shared/questions';
import { monthKey, vnDate, vnStartOfDay, weekStart } from '../../shared/time';
import { makeCheck } from '../../shared/check';
import { requireStudent } from '../lib/auth';
import { errorResponse, HttpError, json, readJson } from '../lib/http';
import { db, must } from '../lib/supabase';
import { loadPlan, loadStudentWords, poolWords, streakOf, toCard, toQuiz, withPool } from '../lib/learn';
import { nextMilestoneIdx } from '../lib/publish';

const ALL_BADGES: BadgeCode[] = [
  'first_submit', 'perfect_week', 'perfect_month', 'all_sundays_month',
  'pass_10', 'pass_50', 'pass_100', 'pass_300', 'streak_6', 'streak_12', 'streak_24',
];

async function progress(studentId: string): Promise<ProgressResponse> {
  const t = new Date().toISOString();
  const since = vnStartOfDay(weekStart(vnDate(t)));
  const [words, plan, xpRes, badgeRes, wkRes] = await Promise.all([
    loadStudentWords(studentId), loadPlan(studentId, t),
    db().from('xp_events').select('amount').eq('student_id', studentId),
    db().from('badges').select('code,earned_at').eq('student_id', studentId),
    db().from('xp_events').select('student_id,amount, s:students(name)').gte('created_at', since),
  ]);
  const wordsByBox: ProgressResponse['wordsByBox'] = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, pass: 0 };
  for (const w of words) wordsByBox[w.box === PASS_BOX ? 'pass' : (String(w.box) as '1')]++;

  const month = monthKey(vnDate(t));
  const calendar = plan.milestones.filter((m) => m.month === month).map((m) => ({
    date: m.date, kind: m.kind, status: plan.status.get(m.id)!, score_pct: plan.assignments.get(m.id)?.score_pct ?? null,
  }));

  const xpTotal = (must(xpRes) as { amount: number }[]).reduce((n, x) => n + x.amount, 0);
  const earned = new Map((must(badgeRes) as { code: BadgeCode; earned_at: string }[]).map((b) => [b.code, b.earned_at]));

  // Top 5 tuần (Thứ 2 → nay), chỉ học sinh đang hoạt động
  const wk = must(wkRes) as unknown as { student_id: string; amount: number; s: { name: string } | null }[];
  const sums = new Map<string, number>();
  const names = new Map<string, string>();
  for (const x of wk) {
    sums.set(x.student_id, (sums.get(x.student_id) ?? 0) + x.amount);
    if (x.s) names.set(x.student_id, x.s.name);
  }
  const top = [...sums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return {
    wordsByBox, wordsTotal: words.length, streak: streakOf(plan), xpTotal, calendar,
    badges: ALL_BADGES.map((code) => ({ code, earned_at: earned.get(code) ?? null })),
    weeklyTop5: top.map(([id, xp]) => ({ name: names.get(id) ?? 'Học sinh', xp, isMe: id === studentId })),
  };
}

async function myWords(studentId: string): Promise<MyWordsResponse> {
  const [words, pendR] = await Promise.all([
    loadStudentWords(studentId),
    db().from('suggestions').select('id,text,note,created_at').eq('student_id', studentId).eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ]);
  const ids = words.map((w) => w.word_id);
  const lw = ids.length
    ? (must(await db().from('lesson_words').select('word_id,l:lessons(number,status)').in('word_id', ids)) as unknown as
        { word_id: string; l: { number: number; status: string } | null }[])
    : [];
  const lessonOf = new Map<string, number>();
  for (const r of lw) {
    if (!r.l || r.l.status !== 'published') continue;
    const cur = lessonOf.get(r.word_id);
    if (cur === undefined || r.l.number < cur) lessonOf.set(r.word_id, r.l.number);
  }
  const pending = must(pendR) as MyWordsResponse['pending'];
  return {
    words: words
      .filter((w) => w.introduced || w.box > 1)
      .map((w) => ({ ...toCard(w.w), box: w.box as Box, lessonNumber: lessonOf.get(w.word_id) ?? null }))
      .sort((a, b) => a.word.localeCompare(b.word)),
    pending,
  };
}

async function addWord(studentId: string, text: string, note?: string): Promise<AddWordResponse> {
  const clean = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!clean || clean.length > 60) throw new HttpError(400, 'bad_word', 'Nhập một từ hoặc cụm từ (tối đa 60 ký tự)');
  const found = must(await db().from('words').select('id').ilike('word', clean).limit(1)) as { id: string }[];
  if (found[0]) {
    const dueIdx = await nextMilestoneIdx();
    must(await db().from('student_words').upsert(
      { student_id: studentId, word_id: found[0].id, box: 1, due_idx: dueIdx },
      { onConflict: 'student_id,word_id', ignoreDuplicates: true },
    ));
    must(await db().from('suggestions').insert({ student_id: studentId, text: clean, note: note?.slice(0, 300) ?? null, status: 'linked', word_id: found[0].id }));
    return { status: 'linked' };
  }
  must(await db().from('suggestions').insert({ student_id: studentId, text: clean, note: note?.slice(0, 300) ?? null, status: 'pending' }));
  return { status: 'pending' };
}

async function practiceNext(studentId: string): Promise<NextQuestionResponse> {
  // Xoá câu luyện thêm còn treo (không gắn bài) để không tồn đọng
  const [, all, extra] = await Promise.all([
    db().from('pending_questions').delete().eq('student_id', studentId).is('assignment_id', null).then(must),
    loadStudentWords(studentId),
    poolWords(),
  ]);
  const words = all.filter((w) => w.introduced || w.box > 1);
  if (!words.length) return { question: null, phase: 'done' };
  const sorted = [...words].sort((a, b) => a.box - b.box || (a.last_answered_at ?? '').localeCompare(b.last_answered_at ?? ''));
  const pick = sorted[Math.floor(Math.random() * Math.min(10, sorted.length))]!;
  const pool = withPool(words.map(toQuiz), extra);
  const w = toQuiz(pick);
  const type = chooseType(w, null, pool.length, Math.random, ['D', 'L']);
  const built = buildQuestion(type, [w], pool, Math.random);
  const check = await makeCheck(built.key);
  const row = must(
    await db().from('pending_questions').insert({
      student_id: studentId, assignment_id: null, payload: { ...built.payload, check, mode: 'practice', wordIds: built.wordIds }, answer_key: built.key,
    }).select('qid').single(),
  ) as { qid: string };
  return { question: { ...built.payload, check, qid: row.qid, mode: 'practice', progress: { done: 0, required: 0, extra: 0 } }, phase: 'graded' };
}

async function report(token: string): Promise<ParentReportResponse> {
  const r = must(await db().from('monthly_reports').select('*').eq('token', token).maybeSingle()) as MonthlyReport | null;
  if (!r) throw new HttpError(404, 'not_found', 'Link báo cáo không đúng hoặc đã hết hạn');
  const s = must(await db().from('students').select('name').eq('id', r.student_id).single()) as { name: string };
  return {
    student: { name: s.name }, month: r.month, status: r.status, finalized_at: r.finalized_at, stats: r.stats,
    ai_comment: r.status === 'final' ? r.ai_comment : null,
    teacher_comment: r.status === 'final' ? r.teacher_comment : null,
  };
}

export default async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const p = url.pathname;
    if (p.startsWith('/api/report/') && req.method === 'GET') {
      const token = decodeURIComponent(p.slice('/api/report/'.length));
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) throw new HttpError(404, 'not_found', 'Link báo cáo không đúng hoặc đã hết hạn');
      return json(await report(token));
    }
    const studentId = requireStudent(req);
    if (p === '/api/progress' && req.method === 'GET') return json(await progress(studentId));
    if (p === '/api/my-words' && req.method === 'GET') return json(await myWords(studentId));
    if (p === '/api/my-words' && req.method === 'POST') {
      const { text, note } = await readJson<{ text?: string; note?: string }>(req);
      return json(await addWord(studentId, text ?? '', note));
    }
    if (p === '/api/practice/next' && req.method === 'GET') return json(await practiceNext(studentId));
    throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = {
  path: ['/api/progress', '/api/my-words', '/api/practice/next', '/api/report/:token'],
};
