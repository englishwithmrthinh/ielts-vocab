/**
 * Báo cáo tháng gửi phụ huynh. Chủ sở hữu: Sếp.
 * - Ngày 1 (07:05 VN): tạo bản TẠM TÍNH cho tháng trước + nhận xét AI (phụ huynh chưa thấy nhận xét).
 * - Ngày 8 (07:05 VN): tính lại số liệu, CHỐT (status final). Nhận xét giáo viên đã sửa được giữ nguyên.
 * Giữa hai mốc, giáo viên sửa nhận xét trong admin.
 */
import { createHmac, randomBytes } from 'node:crypto';
import type { AssignmentStatus, BadgeCode, Milestone, MonthlyStats } from '../../shared/types';
import { PASS_BOX } from '../../shared/types';
import { unsubmittedStatus } from '../../shared/lateness';
import { extKey, withExtension } from '../../shared/deadlines';
import { loadExtensions } from './extensions';
import { beforeFirst } from '../../shared/first-due';
import { loadFirstIdx } from './first-due';
import { addDays, nextMonth, vnStartOfDay, weekStart } from '../../shared/time';
import { env, envOptional } from './env';
import { db, must } from './supabase';

export function jobKey(): string {
  return createHmac('sha256', env('SESSION_SECRET')).update('job-v1').digest('base64url');
}

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = must(await q(from, from + 999)) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

interface Stu { id: string; name: string; created_at: string }
interface Asg { student_id: string; milestone_id: string; status: string; days_late: number | null; score_pct: number | null }

/** Tính MonthlyStats cho mọi học sinh đang hoạt động (đọc theo lô, không gọi từng em) */
export async function computeMonth(month: string, now: string, isDraft: boolean): Promise<Map<string, { student: Stu; stats: MonthlyStats; badges: BadgeCode[] }>> {
  const from = vnStartOfDay(`${month}-01`);
  const to = vnStartOfDay(`${nextMonth(month)}-01`);
  const [stR, msR, as, sws, ans, passEv, ext, first] = await Promise.all([
    db().from('students').select('id,name,created_at').eq('active', true),
    db().from('milestones').select('*').eq('month', month).order('date'),
    all<Asg>((f, t) => db().from('assignments').select('student_id,milestone_id,status,days_late,score_pct').range(f, t)),
    all<{ student_id: string; box: number; assigned_at: string }>((f, t) =>
      db().from('student_words').select('student_id,box,assigned_at').lt('assigned_at', to).range(f, t)),
    all<{ student_id: string; correct: boolean }>((f, t) =>
      db().from('answers').select('student_id,correct').eq('mode', 'graded').eq('flagged', false)
        .gte('created_at', from).lt('created_at', to).range(f, t)),
    all<{ student_id: string; word_id: string; created_at: string }>((f, t) =>
      db().from('answers').select('student_id,word_id,created_at').eq('box_after', PASS_BOX).lt('box_before', PASS_BOX)
        .lt('created_at', to).order('created_at').range(f, t)),
    loadExtensions(),
    loadFirstIdx(),
  ]);
  const students = must(stR) as Stu[];
  const ms = must(msR) as Milestone[];
  const asBy = new Map(as.map((a) => [`${a.student_id}|${a.milestone_id}`, a]));

  // Các tuần (Thứ 2) chạm vào tháng
  const weeks: string[] = [];
  for (let d = weekStart(`${month}-01`); d < `${nextMonth(month)}-01`; d = addDays(d, 7)) weeks.push(d);

  const out = new Map<string, { student: Stu; stats: MonthlyStats; badges: BadgeCode[] }>();
  for (const s of students) {
    const cells: MonthlyStats['cells'] = [];
    let total = 0, submitted = 0, onTime = 0, late = 0, abandoned = 0, owing = 0, daysLateSum = 0, scoreSum = 0;
    let sundays = 0, sundaysOk = 0;
    for (const m0 of ms) {
      const m = withExtension(m0, ext.get(extKey(s.id, m0.id))); // gia hạn riêng
      if (!m.is_off && Date.parse(m.deadline_at) < Date.parse(s.created_at)) continue; // trước khi vào lớp
      if (beforeFirst(m, first.get(s.id))) continue; // chưa có từ thì chưa có bài
      const a = asBy.get(`${s.id}|${m.id}`);
      const st: AssignmentStatus = m.is_off ? 'off' : a?.status === 'submitted' ? 'submitted' : unsubmittedStatus(m, now);
      cells.push({ milestone_date: m.date, kind: m.kind, status: st, score_pct: a?.score_pct ?? null, days_late: a?.days_late ?? null });
      if (st === 'off' || st === 'locked' || st === 'open') continue;
      total++;
      if (m.kind === 'sun') sundays++;
      if (st === 'submitted') {
        submitted++;
        scoreSum += a?.score_pct ?? 0;
        if (a?.days_late) { late++; daysLateSum += a.days_late; } else { onTime++; if (m.kind === 'sun') sundaysOk++; }
      } else if (st === 'abandoned') abandoned++;
      else if (st === 'owing') owing++;
    }
    const myWords = sws.filter((w) => w.student_id === s.id);
    const passed = myWords.filter((w) => w.box === PASS_BOX).length;
    const myAns = ans.filter((x) => x.student_id === s.id);
    const firstPass = new Map<string, string>();
    for (const e of passEv) if (e.student_id === s.id && !firstPass.has(e.word_id)) firstPass.set(e.word_id, e.created_at);
    const passTimes = [...firstPass.values()];
    const stats: MonthlyStats = {
      month, total, submitted, on_time: onTime, late, abandoned, owing: isDraft ? owing : 0,
      total_days_late: daysLateSum, avg_days_late: late ? Math.round((daysLateSum / late) * 10) / 10 : 0,
      attendance_pct: total ? Math.round(scoreSum / total) : 0,
      words_assigned: myWords.length, words_passed: passed, words_learning: myWords.length - passed,
      accuracy_pct: myAns.length ? Math.round((100 * myAns.filter((x) => x.correct).length) / myAns.length) : 0,
      passed_by_week: weeks.map((w) => {
        const end = vnStartOfDay(addDays(w, 7));
        return { week_start: w, passed_total: passTimes.filter((t) => t < end).length };
      }),
      cells,
    };
    const badges: BadgeCode[] = [];
    if (total > 0 && onTime === total) badges.push('perfect_month');
    if (sundays > 0 && sundaysOk === sundays) badges.push('all_sundays_month');
    out.set(s.id, { student: s, stats, badges });
  }
  return out;
}

const PROMPT = `You are an IELTS teacher in Vietnam writing a short monthly comment to a student's parents. Write in Vietnamese.

Student: {{student_name}}
Month: {{month}}
Data (JSON):
{{stats_json}}

Meaning of the data fields:
- total: assignments in the month (excluding days off); submitted: assignments handed in; on_time: handed in on time; late: handed in late; abandoned: missed (not handed in within 7 days); owing: still overdue now
- avg_days_late: average days late among late assignments; attendance_pct: monthly attendance score (100 = always on time, minus 10 points per late day)
- words_assigned: words given so far; words_passed: words fully memorised; words_learning: words still being reviewed; accuracy_pct: percentage of correct answers this month

Rules:
1. Exactly 3–4 sentences, plain Vietnamese a parent understands. No greeting, no sign-off.
2. Pronouns: the teacher is "Thầy", the parents are "Gia đình", the student is "con" (you may use the student's first name once).
3. Mention at least two real numbers from the data (for example "11/13 bài", "45 từ đã thuộc", "2 bài nộp trễ").
4. Praise ONE genuine strength, then suggest ONE concrete improvement kindly. If there is nothing to improve, encourage the student to keep it up.
5. Never compare with other students, never blame, never use technical words such as "thuật toán", "hộp", "credit" or "dữ liệu".
6. Only use facts that are in the data. Do not invent reasons.

Output: the comment text only.`;

export async function aiComment(name: string, month: string, stats: MonthlyStats): Promise<string | null> {
  const key = envOptional('GEMINI_API_KEY');
  if (!key) return null;
  const { cells: _c, passed_by_week: _p, ...brief } = stats;
  const text = PROMPT.replace('{{student_name}}', name).replace('{{month}}', month).replace('{{stats_json}}', JSON.stringify(brief));
  const model = envOptional('GEMINI_TEXT_MODEL') ?? 'gemini-2.5-flash';
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { temperature: 0.6 } }),
    });
    if (r.ok) {
      const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const out = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
      if (out) return out;
    }
    await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
  }
  return null;
}

/**
 * Tạo/cập nhật báo cáo tháng.
 * final=false: tạo/tính lại bản tạm tính (không đụng bản đã chốt), viết nhận xét AI nếu chưa có.
 * final=true : tính lại số liệu, chốt, trao huy hiệu tháng. Nhận xét đã có (kể cả giáo viên sửa) giữ nguyên.
 * opts.rewriteAi: viết lại nhận xét AI (chỉ bản tạm tính; nhận xét của giáo viên không đụng).
 * opts.studentIds: chỉ tính lại các em này.
 * Mỗi lần tính ghi stats.computed_at = now.
 */
export async function runMonthly(
  month: string, final: boolean, now = new Date().toISOString(),
  opts: { rewriteAi?: boolean; studentIds?: string[] } = {},
): Promise<{ reports: number; comments: number }> {
  const all = await computeMonth(month, now, !final);
  const data = opts.studentIds ? new Map([...all].filter(([id]) => opts.studentIds!.includes(id))) : all;
  const existing = must(await db().from('monthly_reports').select('id,student_id,status,ai_comment').eq('month', month)) as
    { id: string; student_id: string; status: string; ai_comment: string | null }[];
  const exBy = new Map(existing.map((r) => [r.student_id, r]));
  let reports = 0, comments = 0;
  const list = [...data.values()];
  // 4 học sinh song song để Gemini không bị quá tải
  for (let i = 0; i < list.length; i += 4) {
    await Promise.all(list.slice(i, i + 4).map(async ({ student, stats: s0, badges }) => {
      const ex = exBy.get(student.id);
      if (ex?.status === 'final' && !final) return;
      const stats: MonthlyStats = { ...s0, computed_at: now };
      let ai = ex?.ai_comment ?? null;
      if ((!ai || (opts.rewriteAi && !final)) && stats.total > 0) {
        const fresh = await aiComment(student.name, month, stats);
        if (fresh) { ai = fresh; comments++; }
      }
      const row = {
        stats, ai_comment: ai,
        ...(final ? { status: 'final', finalized_at: now } : {}),
      };
      if (ex) must(await db().from('monthly_reports').update(row).eq('id', ex.id));
      else must(await db().from('monthly_reports').insert({ ...row, student_id: student.id, month, token: randomBytes(18).toString('base64url') }));
      if (final && badges.length) {
        must(await db().from('badges').upsert(badges.map((code) => ({ student_id: student.id, code })), { onConflict: 'student_id,code', ignoreDuplicates: true }));
      }
      reports++;
    }));
  }
  return { reports, comments };
}
