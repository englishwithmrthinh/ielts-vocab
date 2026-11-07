/**
 * API mốc cho trang quản trị (cần cookie quản trị):
 * GET  /api/admin/milestones?month=2026-11   → { milestones: Milestone[] }  (tự tạo tháng nếu chưa có)
 * POST /api/admin/milestones/off  { id, off } → bật/tắt Nghỉ (chỉ mốc từ hôm nay trở đi)
 * POST /api/admin/milestones/deadline { id, deadline: 'YYYY-MM-DDTHH:mm' (giờ VN) } → đổi hạn nộp (gia hạn / rút ngắn)
 *      Điểm trễ tính theo NGÀY của hạn mới. Bài đã nộp trước đó giữ nguyên điểm.
 */
import type { Config } from '@netlify/functions';
import type { Milestone } from '../../shared/types';
import { requireAdmin } from '../lib/auth';
import { errorResponse, HttpError, json, readJson } from '../lib/http';
import { ensureMonth, setOff } from '../lib/milestones-db';
import { db, must } from '../lib/supabase';

export default async (req: Request): Promise<Response> => {
  try {
    requireAdmin(req);
    const url = new URL(req.url);
    if (url.pathname === '/api/admin/milestones' && req.method === 'GET') {
      const month = url.searchParams.get('month') ?? '';
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, 'bad_month', 'Tháng dạng YYYY-MM');
      await ensureMonth(month);
      const rows = must(await db().from('milestones').select('*').eq('month', month).order('date')) as Milestone[];
      return json({ milestones: rows });
    }
    if (url.pathname === '/api/admin/milestones/off' && req.method === 'POST') {
      const { id, off } = await readJson<{ id?: string; off?: boolean }>(req);
      if (!id || typeof off !== 'boolean') throw new HttpError(400, 'bad_input', 'Cần id và off');
      await setOff(id, off);
      return json({ ok: true });
    }
    if (url.pathname === '/api/admin/milestones/deadline' && req.method === 'POST') {
      const { id, deadline } = await readJson<{ id?: string; deadline?: string }>(req);
      if (!id || !deadline || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline)) throw new HttpError(400, 'bad_input', 'Cần id và hạn dạng YYYY-MM-DDTHH:mm');
      const m = must(await db().from('milestones').select('*').eq('id', id).maybeSingle()) as Milestone | null;
      if (!m) throw new HttpError(404, 'not_found', 'Không tìm thấy mốc');
      const t = Date.parse(`${deadline}:59+07:00`);
      if (!Number.isFinite(t)) throw new HttpError(400, 'bad_input', 'Hạn không hợp lệ');
      if (t <= Date.parse(m.opens_at)) throw new HttpError(400, 'too_early', 'Hạn phải sau giờ mở bài');
      const at = new Date(t).toISOString();
      must(await db().from('milestones').update({ deadline_at: at }).eq('id', id));
      return json({ ok: true, deadline_at: at });
    }
    throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = { path: ['/api/admin/milestones', '/api/admin/milestones/off', '/api/admin/milestones/deadline'] };
