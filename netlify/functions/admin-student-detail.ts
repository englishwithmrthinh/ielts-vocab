/**
 * Trang Học sinh (cần cookie admin). Chủ sở hữu: Sếp (backend); giao diện: Claude 3.
 *
 * GET /api/admin/students/owing → { owing: { [student_id]: number }, abandoned: { [student_id]: number } }
 *     Số bài đang nợ (còn làm bù được) và số bài đã bỏ (quá 7 ngày) của từng em — cho huy hiệu "Nợ N".
 * GET /api/admin/students/detail?id=… → StudentDetail (src/admin/lib/adminApi.ts)
 *     Bài đang nợ / đang mở, bài đã nộp gần đây, các bộ từ đã nhận (kèm trạng thái ở mốc hạn của bộ), link lịch tháng.
 * Luật trạng thái: netlify/lib/student-status.ts (hạn riêng, chưa vào lớp, chưa có từ thì chưa có bài).
 */
import type { Config } from '@netlify/functions';
import { daysLate } from '../../shared/lateness';
import { monthKey, vnDate } from '../../shared/time';
import type { StudentDetail, StudentDetailItem } from '../../src/admin/lib/adminApi';
import { requireAdmin } from '../lib/auth';
import { errorResponse, HttpError, json } from '../lib/http';
import { loadStates, type MilestoneState } from '../lib/student-status';
import { db, must } from '../lib/supabase';

function item(s: MilestoneState, now: string): StudentDetailItem {
  return {
    milestone_id: s.m.id, date: s.m.date, kind: s.m.kind, deadline_at: s.m.deadline_at, extended: s.extended,
    status: s.status,
    answered: s.a ? Math.min(s.a.answered_count, s.a.required_count ?? s.a.answered_count) : 0,
    required: s.a?.required_count ?? null,
    submitted_at: s.a?.submitted_at ?? null,
    score_pct: s.a?.score_pct ?? null,
    days_late: s.status === 'owing' ? daysLate(vnDate(s.m.deadline_at), now) : s.a?.days_late ?? null,
  };
}

async function owingCounts() {
  const now = new Date().toISOString();
  const { states } = await loadStates(now);
  const owing: Record<string, number> = {};
  const abandoned: Record<string, number> = {};
  for (const [id, list] of states) {
    const o = list.filter((s) => s.status === 'owing').length;
    const b = list.filter((s) => s.status === 'abandoned').length;
    if (o) owing[id] = o;
    if (b) abandoned[id] = b;
  }
  return { owing, abandoned };
}

async function detail(id: string): Promise<StudentDetail> {
  const now = new Date().toISOString();
  const { students, states } = await loadStates(now, [id]);
  const st = students[0];
  if (!st) throw new HttpError(404, 'not_found', 'Không tìm thấy học sinh');
  const list = states.get(id) ?? [];
  const [clR, attR] = await Promise.all([
    st.class_id ? db().from('classes').select('name').eq('id', st.class_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db().from('attendance').select('l:lessons(id,number,title,status,taught_on,due_milestone_id,dm:milestones(date,kind,deadline_at))').eq('student_id', id),
  ]);
  const cls = must(clR) as { name: string } | null;
  const lessons = (must(attR) as unknown as { l: { id: string; number: number; title: string | null; status: string; taught_on: string; due_milestone_id: string | null; dm: { date: string; kind: string; deadline_at: string } | null } | null }[])
    .map((r) => r.l).filter((l): l is NonNullable<typeof l> => !!l)
    .sort((a, b) => b.taught_on.localeCompare(a.taught_on) || b.number - a.number);
  const byMs = new Map(list.map((s) => [s.m.id, s]));

  const month = monthKey(vnDate(now));
  return {
    student: { id: st.id, code: st.code, name: st.name, active: st.active, class_name: cls?.name ?? null, created_at: st.created_at },
    owing: list.filter((s) => s.status === 'owing').map((s) => item(s, now)),
    abandoned: list.filter((s) => s.status === 'abandoned').map((s) => item(s, now)),
    open: list.filter((s) => s.status === 'open').map((s) => item(s, now)),
    recent: list.filter((s) => s.status === 'submitted')
      .sort((a, b) => (b.a?.submitted_at ?? '').localeCompare(a.a?.submitted_at ?? '')).slice(0, 8).map((s) => item(s, now)),
    lessons: lessons.map((l) => {
      const s = l.due_milestone_id ? byMs.get(l.due_milestone_id) : undefined;
      return {
        id: l.id, number: l.number, title: l.title, status: l.status, taught_on: l.taught_on,
        due: l.dm ? { date: l.dm.date, kind: l.dm.kind, deadline_at: s?.m.deadline_at ?? l.dm.deadline_at } : null,
        /** Trạng thái bài ở mốc hạn của bộ; null = chưa phát hành / chưa có mốc / mốc chưa tính cho em */
        state: s ? s.status : null,
        score_pct: s?.a?.score_pct ?? null,
      };
    }),
    calendar_url: `/bao-cao-lop?hs=${encodeURIComponent(st.code)}&m=${month}`,
  };
}

export default async (req: Request): Promise<Response> => {
  try {
    requireAdmin(req);
    if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
    const url = new URL(req.url);
    if (url.pathname === '/api/admin/students/owing') return json(await owingCounts());
    const id = url.searchParams.get('id');
    if (!id) throw new HttpError(400, 'bad_input', 'Thiếu id');
    return json(await detail(id));
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = { path: ['/api/admin/students/owing', '/api/admin/students/detail'] };
