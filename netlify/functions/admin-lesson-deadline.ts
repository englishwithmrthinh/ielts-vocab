/**
 * Hạn nộp của một bộ từ (cần cookie admin). Chủ sở hữu: Sếp.
 *
 * GET  /api/admin/lessons/deadline?id=… → LessonDeadline (src/admin/lib/adminApi.ts)
 *      Bài của bộ từ = bài của MỐC LÀM LẦN ĐẦU (lessons.due_milestone_id). Bộ cũ chưa có mốc thì suy ra
 *      từ bài sớm nhất có chứa từ của bộ. Kèm trạng thái từng học sinh được giao bộ này.
 * POST /api/admin/lessons/deadline { id, deadline: 'YYYY-MM-DDTHH:mm' (giờ VN), scope: 'all' | 'students', student_ids? }
 *      all:      đổi hạn chung của mốc (mọi học sinh mọi lớp có bài mốc đó) — như trang Lịch mốc.
 *      students: hạn riêng cho các em chọn (bảng deadline_extensions, migration 005). Phải muộn hơn hạn chung.
 * POST /api/admin/lessons/deadline/clear { id, student_ids } → bỏ hạn riêng, về hạn chung.
 *
 * Trạng thái bài (đang mở / nợ / bỏ) luôn tính lại theo hạn hiệu lực, nên gia hạn xong là bài "đang nợ" thành
 * "đang mở" ngay; nộp trước hạn mới thì 100%. Bài đã nộp giữ nguyên điểm.
 */
import type { Config } from '@netlify/functions';
import type { Assignment, Milestone } from '../../shared/types';
import { daysLate, unsubmittedStatus } from '../../shared/lateness';
import { extKey, withExtension } from '../../shared/deadlines';
import { vnDate } from '../../shared/time';
import type { LessonDeadline, LessonDeadlineStudent } from '../../src/admin/lib/adminApi';
import { requireAdmin } from '../lib/auth';
import { loadExtensions, missingTable } from '../lib/extensions';
import { errorResponse, HttpError, json, readJson } from '../lib/http';
import { parseVnDeadline, setMilestoneDeadline } from '../lib/milestones-db';
import { db, must } from '../lib/supabase';

interface Ctx {
  lesson: { id: string; number: number; title: string | null; status: string; due_milestone_id: string | null };
  wordIds: string[];
  studentIds: string[];
  milestone: Milestone | null;
  inferred: boolean;
}

async function context(id: string): Promise<Ctx> {
  const lesson = must(await db().from('lessons').select('id,number,title,status,due_milestone_id').eq('id', id).maybeSingle()) as Ctx['lesson'] | null;
  if (!lesson) throw new HttpError(404, 'not_found', 'Không tìm thấy bộ từ');
  const [lwR, attR] = await Promise.all([
    db().from('lesson_words').select('word_id').eq('lesson_id', id),
    db().from('attendance').select('student_id').eq('lesson_id', id),
  ]);
  const wordIds = (must(lwR) as { word_id: string }[]).map((r) => r.word_id);
  const studentIds = (must(attR) as { student_id: string }[]).map((r) => r.student_id);

  let milestone: Milestone | null = null;
  let inferred = false;
  if (lesson.due_milestone_id) {
    milestone = must(await db().from('milestones').select('*').eq('id', lesson.due_milestone_id).maybeSingle()) as Milestone | null;
  }
  if (!milestone && lesson.status === 'published' && wordIds.length && studentIds.length) {
    // Bộ cũ (phát hành trước khi có mốc hạn): bài sớm nhất có chứa từ của bộ; chưa ai làm thì mốc đến hạn sớm nhất của từ
    inferred = true;
    const asg = must(await db().from('assignments').select('word_ids,m:milestones!inner(*)').in('student_id', studentIds).overlaps('word_ids', wordIds)) as unknown as { m: Milestone }[];
    milestone = asg.map((a) => a.m).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    if (!milestone) {
      const sw = must(await db().from('student_words').select('due_idx').in('student_id', studentIds).in('word_id', wordIds).order('due_idx').limit(1)) as { due_idx: number }[];
      if (sw[0]) milestone = must(await db().from('milestones').select('*').eq('idx', sw[0].due_idx).maybeSingle()) as Milestone | null;
    }
  }
  return { lesson, wordIds, studentIds, milestone, inferred };
}

async function getDeadline(id: string): Promise<LessonDeadline> {
  const now = new Date().toISOString();
  const c = await context(id);
  const base: LessonDeadline = {
    lesson: { id: c.lesson.id, number: c.lesson.number, title: c.lesson.title, status: c.lesson.status },
    milestone: null, inferred: c.inferred, state: 'none', daysOverdue: 0,
    counts: { total: c.studentIds.length, submitted: 0, doing: 0, notStarted: 0, owing: 0, abandoned: 0 },
    students: [], spillCount: 0, extensionsReady: true,
  };
  const m = c.milestone;
  if (!m) return base;
  const t = Date.parse(now);
  base.milestone = { id: m.id, date: m.date, kind: m.kind, opens_at: m.opens_at, deadline_at: m.deadline_at, is_off: m.is_off };
  base.state = m.is_off ? 'off' : t < Date.parse(m.opens_at) ? 'locked' : t <= Date.parse(m.deadline_at) ? 'open' : 'overdue';
  base.daysOverdue = base.state === 'overdue' ? daysLate(vnDate(m.deadline_at), now) : 0;
  if (!c.studentIds.length) return base;

  const [stR, clR, asR, swR, extProbe] = await Promise.all([
    db().from('students').select('id,code,name,class_id,active,created_at').in('id', c.studentIds),
    db().from('classes').select('id,name'),
    db().from('assignments').select('*').eq('milestone_id', m.id).in('student_id', c.studentIds),
    c.wordIds.length
      ? db().from('student_words').select('student_id,word_id,last_answered_at').in('student_id', c.studentIds).in('word_id', c.wordIds).is('last_answered_at', null)
      : Promise.resolve({ data: [], error: null }),
    db().from('deadline_extensions').select('student_id').limit(1),
  ]);
  base.extensionsReady = !missingTable(extProbe.error as { code?: string; message?: string } | null);
  const ext = base.extensionsReady ? await loadExtensions({ studentIds: c.studentIds, milestoneIds: [m.id] }) : new Map<string, string>();
  const clsName = new Map((must(clR) as { id: string; name: string }[]).map((x) => [x.id, x.name]));
  const asBy = new Map((must(asR) as Assignment[]).map((a) => [a.student_id, a]));
  const unanswered = new Map<string, Set<string>>();
  for (const r of (must(swR as never) as { student_id: string; word_id: string }[])) {
    if (!unanswered.has(r.student_id)) unanswered.set(r.student_id, new Set());
    unanswered.get(r.student_id)!.add(r.word_id);
  }

  const students: LessonDeadlineStudent[] = [];
  for (const s of must(stR) as { id: string; code: string; name: string; class_id: string | null; active: boolean; created_at: string }[]) {
    const own = ext.get(extKey(s.id, m.id)) ?? null;
    const em = withExtension(m, own);
    const a = asBy.get(s.id);
    let status: LessonDeadlineStudent['status'];
    if (a?.status === 'submitted') status = 'submitted';
    else {
      const u = unsubmittedStatus(em, now);
      status = u === 'owing' ? 'owing' : u === 'abandoned' ? 'abandoned' : u === 'off' ? 'off' : a && a.answered_count > 0 ? 'doing' : 'not_started';
    }
    // Từ của bộ chưa làm lần nào mà không nằm trong bài này (bài đã chốt danh sách từ) → dư sang bài sau
    const left = unanswered.get(s.id);
    const spill = !!a && !!left && [...left].some((w) => !a.word_ids.includes(w));
    students.push({
      id: s.id, code: s.code, name: s.name, class_name: (s.class_id && clsName.get(s.class_id)) || '', active: s.active,
      status, deadline_at: em.deadline_at, extended_to: own && Date.parse(own) > Date.parse(m.deadline_at) ? own : null,
      days_late: status === 'owing' ? daysLate(vnDate(em.deadline_at), now) : a?.days_late ?? null,
      score_pct: a?.score_pct ?? null, answered: a ? Math.min(a.answered_count, a.required_count ?? a.answered_count) : 0,
      required: a?.required_count ?? null, spill,
    });
    if (status === 'submitted') base.counts.submitted++;
    else if (status === 'doing') base.counts.doing++;
    else if (status === 'not_started') base.counts.notStarted++;
    else if (status === 'owing') base.counts.owing++;
    else if (status === 'abandoned') base.counts.abandoned++;
    if (spill) base.spillCount++;
  }
  const order = { owing: 0, abandoned: 1, not_started: 2, doing: 3, off: 4, submitted: 5 } as const;
  students.sort((p, q) => order[p.status] - order[q.status] || p.class_name.localeCompare(q.class_name, 'vi') || p.code.localeCompare(q.code));
  base.students = students;
  return base;
}

async function extend(b: { id?: string; deadline?: string; scope?: string; student_ids?: unknown }) {
  if (!b.id) throw new HttpError(400, 'bad_input', 'Thiếu id');
  const c = await context(b.id);
  if (!c.milestone) throw new HttpError(409, 'no_milestone', 'Bộ từ này chưa có mốc hạn. Bấm "Sửa" để chọn mốc.');
  const m = c.milestone;
  if (b.scope === 'all') {
    const at = await setMilestoneDeadline(m.id, b.deadline);
    return { ok: true, scope: 'all', deadline_at: at, count: null };
  }
  if (b.scope !== 'students') throw new HttpError(400, 'bad_input', 'scope phải là all hoặc students');
  const ids = Array.isArray(b.student_ids) ? b.student_ids.filter((x): x is string => typeof x === 'string') : [];
  const allowed = new Set(c.studentIds);
  const pick = [...new Set(ids)].filter((x) => allowed.has(x));
  if (!pick.length) throw new HttpError(400, 'no_students', 'Chưa chọn học sinh nào (của bộ từ này)');
  const at = parseVnDeadline(b.deadline);
  if (Date.parse(at) <= Date.parse(m.deadline_at)) {
    throw new HttpError(400, 'not_later', 'Hạn riêng phải muộn hơn hạn chung của mốc. Muốn rút ngắn thì đổi hạn cả mốc.');
  }
  const r = await db().from('deadline_extensions').upsert(
    pick.map((student_id) => ({ student_id, milestone_id: m.id, deadline_at: at })),
    { onConflict: 'student_id,milestone_id' },
  );
  if (missingTable(r.error as { code?: string; message?: string } | null)) {
    throw new HttpError(409, 'need_migration', 'Chưa chạy file SQL 005 trong Supabase, nên chưa gia hạn riêng được. Dùng "Gia hạn cả mốc" hoặc chạy file 005.');
  }
  must(r);
  return { ok: true, scope: 'students', deadline_at: at, count: pick.length };
}

async function clear(b: { id?: string; student_ids?: unknown }) {
  if (!b.id) throw new HttpError(400, 'bad_input', 'Thiếu id');
  const c = await context(b.id);
  if (!c.milestone) return { ok: true, count: 0 };
  const ids = Array.isArray(b.student_ids) ? b.student_ids.filter((x): x is string => typeof x === 'string') : [];
  if (!ids.length) throw new HttpError(400, 'no_students', 'Chưa chọn học sinh nào');
  const r = await db().from('deadline_extensions').delete().eq('milestone_id', c.milestone.id).in('student_id', ids).select('student_id');
  if (missingTable(r.error as { code?: string; message?: string } | null)) return { ok: true, count: 0 };
  return { ok: true, count: (must(r) as unknown[]).length };
}

export default async (req: Request): Promise<Response> => {
  try {
    requireAdmin(req);
    const url = new URL(req.url);
    if (url.pathname === '/api/admin/lessons/deadline' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) throw new HttpError(400, 'bad_input', 'Thiếu id');
      return json(await getDeadline(id));
    }
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
    if (url.pathname === '/api/admin/lessons/deadline/clear') return json(await clear(await readJson(req)));
    return json(await extend(await readJson(req)));
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = { path: ['/api/admin/lessons/deadline', '/api/admin/lessons/deadline/clear'] };
