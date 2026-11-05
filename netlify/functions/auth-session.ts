/**
 * GET  /api/me      → học sinh đang đăng nhập (401 nếu chưa)
 * POST /api/logout  → xoá cookie học sinh
 */
import type { Config, Context } from '@netlify/functions';
import { clearCookie, requireStudent } from '../lib/auth';
import { errorResponse, HttpError, json } from '../lib/http';
import { db, must } from '../lib/supabase';

export default async (req: Request, _ctx: Context): Promise<Response> => {
  try {
    const path = new URL(req.url).pathname;
    if (path === '/api/logout' && req.method === 'POST') {
      return json({ ok: true }, 200, { 'set-cookie': clearCookie('student') });
    }
    if (path === '/api/me' && req.method === 'GET') {
      const id = requireStudent(req);
      const s = must(await db().from('students').select('name,code,active').eq('id', id).single()) as
        { name: string; code: string; active: boolean };
      if (!s.active) throw new HttpError(401, 'inactive', 'Tài khoản đã bị khoá');
      return json({ student: { name: s.name, code: s.code } });
    }
    throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = { path: ['/api/me', '/api/logout'] };
