/**
 * Tổng quan hôm nay (cần cookie quản trị) — Claude 3, GĐ3.
 *
 * GET /api/admin/overview → AdminOverview
 *   - Mốc hiện tại + đếm: đã nộp / đang làm / chưa làm (học sinh đang học)
 *   - Danh sách đang nợ bài: mỗi em một dòng, bài nợ cũ nhất, số ngày trễ, % nếu nộp hôm nay / ngày mai
 *   - Bộ từ nháp / chờ duyệt, đề xuất đang chờ, câu báo lỗi
 *
 * Chỉ ĐỌC. Trạng thái bài tính bằng shared/lateness.ts (cùng cách với sheet.ts của sếp).
 */
import type { Config } from '@netlify/functions';
import type { Assignment, Milestone } from '../../shared/types';
import { buildOverview, type AdminOverview } from '../../src/admin/lib/overview';
import { requireAdmin } from '../lib/auth';
import { errorResponse, HttpError, json } from '../lib/http';
import { db, must } from '../lib/supabase';
import { loadExtensions } from '../lib/extensions';

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = must((await q(from, from + 999)) as never) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export default async (req: Request): Promise<Response> => {
  try {
    requireAdmin(req);
    if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
    const now = new Date().toISOString();
    const [stR, msR, as, lsR, sgR, flR, ext] = await Promise.all([
      db().from('students').select('id,code,name,created_at,class_id').eq('active', true).order('code'),
      db().from('milestones').select('*').order('date'),
      all<Pick<Assignment, 'student_id' | 'milestone_id' | 'status' | 'answered_count'>>((f, t) =>
        db().from('assignments').select('student_id,milestone_id,status,answered_count').range(f, t)),
      db().from('lessons').select('status').neq('status', 'published'),
      db().from('suggestions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db().from('answers').select('id', { count: 'exact', head: true }).eq('flagged', true),
      loadExtensions(),
    ]);
    const lessons = { draft: 0, processing: 0, review: 0 };
    for (const l of must(lsR) as { status: keyof typeof lessons }[]) if (l.status in lessons) lessons[l.status]++;
    const out: AdminOverview = {
      now,
      ...buildOverview(now, must(stR) as never, must(msR) as Milestone[], as, ext),
      lessons,
      suggestionsPending: sgR.count ?? 0,
      flagsTotal: flR.count ?? 0,
    };
    return json(out);
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = { path: '/api/admin/overview' };
