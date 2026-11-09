/**
 * Admin — báo cáo tháng, đề xuất từ, câu báo lỗi. Chủ sở hữu: Sếp. Cần cookie admin.
 *
 * GET  /api/admin/reports?month=YYYY-MM  → AdminReportsResponse
 * POST /api/admin/reports/update { id, teacher_comment?, ai_comment? } → { ok }
 * POST /api/admin/reports/finalize { id } → { ok }   (chốt sớm từng em; phụ huynh thấy nhận xét ngay)
 * POST /api/admin/reports/recompute { id, rewrite_ai? } → { report }  (tính lại số liệu 1 em, bản tạm tính; ~5–15 giây)
 * Tính lại cả tháng: POST /api/jobs/monthly { month, final: false, rewrite_ai? } (chạy nền, xem computedAt để biết đã xong)
 * Tạo/chốt hàng loạt: POST /api/jobs/monthly { month, final } (background, trả 202)
 *
 * GET  /api/admin/suggestions?status=pending → AdminSuggestionsResponse
 * POST /api/admin/suggestions/update { id, status: 'rejected' | 'added', word_id? } → { ok }
 * GET  /api/admin/flags                  → AdminFlagsResponse (câu học sinh báo "có 2 đáp án đúng")
 */
import type { Config } from '@netlify/functions';
import type { AdminFlagsResponse, AdminReportsResponse, AdminSuggestionsResponse, MonthlyStats } from '../../shared/types';
import { monthKey, vnDate } from '../../shared/time';
import { requireAdmin } from '../lib/auth';
import { errorResponse, HttpError, json, readJson } from '../lib/http';
import { db, must } from '../lib/supabase';
import { runMonthly } from '../lib/monthly';

export default async (req: Request): Promise<Response> => {
  try {
    requireAdmin(req);
    const url = new URL(req.url);
    const p = url.pathname;
    const site = `${url.protocol}//${url.host}`;

    if (p === '/api/admin/reports' && req.method === 'GET') {
      const qm = url.searchParams.get('month');
      const month = qm && /^\d{4}-\d{2}$/.test(qm) ? qm : monthKey(vnDate(new Date()));
      const rows = must(await db().from('monthly_reports')
        .select('id,month,token,stats,ai_comment,teacher_comment,status,finalized_at,s:students(id,code,name,class_id)')
        .eq('month', month)) as unknown as
        { id: string; month: string; token: string; stats: MonthlyStats; ai_comment: string | null; teacher_comment: string | null;
          status: 'draft' | 'final'; finalized_at: string | null; s: { id: string; code: string; name: string; class_id: string | null } | null }[];
      const out: AdminReportsResponse = {
        month,
        reports: rows.filter((r) => r.s).map((r) => ({
          id: r.id, studentId: r.s!.id, code: r.s!.code, name: r.s!.name, classId: r.s!.class_id,
          status: r.status, finalizedAt: r.finalized_at, link: `${site}/bao-cao/${r.token}`,
          aiComment: r.ai_comment, teacherComment: r.teacher_comment, stats: r.stats, computedAt: r.stats?.computed_at ?? null,
        })).sort((a, b) => a.code.localeCompare(b.code)),
      };
      return json(out);
    }
    if (p === '/api/admin/reports/update' && req.method === 'POST') {
      const b = await readJson<{ id?: string; teacher_comment?: string | null; ai_comment?: string | null }>(req);
      if (!b.id) throw new HttpError(400, 'bad_input', 'Thiếu id');
      const patch: Record<string, string | null> = {};
      if (b.teacher_comment !== undefined) patch.teacher_comment = b.teacher_comment?.slice(0, 2000) || null;
      if (b.ai_comment !== undefined) patch.ai_comment = b.ai_comment?.slice(0, 2000) || null;
      must(await db().from('monthly_reports').update(patch).eq('id', b.id));
      return json({ ok: true });
    }
    if (p === '/api/admin/reports/recompute' && req.method === 'POST') {
      const b = await readJson<{ id?: string; rewrite_ai?: boolean }>(req);
      if (!b.id) throw new HttpError(400, 'bad_input', 'Thiếu id');
      const r0 = must(await db().from('monthly_reports').select('student_id,month,status').eq('id', b.id).maybeSingle()) as { student_id: string; month: string; status: string } | null;
      if (!r0) throw new HttpError(404, 'not_found', 'Không tìm thấy báo cáo');
      if (r0.status === 'final') throw new HttpError(409, 'final', 'Báo cáo đã chốt, không tính lại được');
      await runMonthly(r0.month, false, new Date().toISOString(), { rewriteAi: !!b.rewrite_ai, studentIds: [r0.student_id] });
      const r = must(await db().from('monthly_reports').select('id,stats,ai_comment,teacher_comment,status,finalized_at').eq('id', b.id).single()) as
        { id: string; stats: MonthlyStats; ai_comment: string | null; teacher_comment: string | null; status: string; finalized_at: string | null };
      return json({ report: { id: r.id, stats: r.stats, aiComment: r.ai_comment, teacherComment: r.teacher_comment, status: r.status, finalizedAt: r.finalized_at, computedAt: r.stats.computed_at ?? null } });
    }
    if (p === '/api/admin/reports/finalize' && req.method === 'POST') {
      const { id } = await readJson<{ id?: string }>(req);
      if (!id) throw new HttpError(400, 'bad_input', 'Thiếu id');
      must(await db().from('monthly_reports').update({ status: 'final', finalized_at: new Date().toISOString() }).eq('id', id));
      return json({ ok: true });
    }

    if (p === '/api/admin/suggestions' && req.method === 'GET') {
      const status = url.searchParams.get('status') ?? 'pending';
      const rows = must(await db().from('suggestions').select('id,text,note,status,created_at,s:students(code,name)')
        .eq('status', status).order('created_at', { ascending: false }).limit(500)) as unknown as
        { id: string; text: string; note: string | null; status: string; created_at: string; s: { code: string; name: string } | null }[];
      const out: AdminSuggestionsResponse = {
        suggestions: rows.map((r) => ({ id: r.id, text: r.text, note: r.note, status: r.status as never, createdAt: r.created_at, code: r.s?.code ?? '', name: r.s?.name ?? '' })),
      };
      return json(out);
    }
    if (p === '/api/admin/suggestions/update' && req.method === 'POST') {
      const b = await readJson<{ id?: string; status?: string; word_id?: string }>(req);
      if (!b.id || (b.status !== 'rejected' && b.status !== 'added')) throw new HttpError(400, 'bad_input', 'Cần id và status rejected | added');
      must(await db().from('suggestions').update({ status: b.status, word_id: b.word_id ?? null }).eq('id', b.id));
      return json({ ok: true });
    }
    if (p === '/api/admin/flags' && req.method === 'GET') {
      const rows = must(await db().from('answers').select('id,created_at,qtype,given,s:students(code,name),w:words(id,word,meaning_vi)')
        .eq('flagged', true).order('created_at', { ascending: false }).limit(300)) as unknown as
        { id: string; created_at: string; qtype: string; given: string | null; s: { code: string; name: string } | null; w: { id: string; word: string; meaning_vi: string } | null }[];
      const out: AdminFlagsResponse = {
        flags: rows.map((r) => ({ id: r.id, createdAt: r.created_at, qtype: r.qtype as never, given: r.given, code: r.s?.code ?? '', name: r.s?.name ?? '', wordId: r.w?.id ?? '', word: r.w?.word ?? '', meaningVi: r.w?.meaning_vi ?? '' })),
      };
      return json(out);
    }
    throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = {
  path: ['/api/admin/reports', '/api/admin/reports/update', '/api/admin/reports/finalize', '/api/admin/reports/recompute',
    '/api/admin/suggestions', '/api/admin/suggestions/update', '/api/admin/flags'],
};
