/**
 * POST /api/admin/login   { password } → cookie quản trị
 * POST /api/admin/logout
 * GET  /api/admin/me      → 200 nếu đang đăng nhập quản trị
 */
import type { Config } from '@netlify/functions';
import { checkAdminPassword, clearCookie, createToken, requireAdmin, sessionCookie } from '../lib/auth';
import { errorResponse, HttpError, json, readJson } from '../lib/http';

export default async (req: Request): Promise<Response> => {
  try {
    const path = new URL(req.url).pathname;
    if (path === '/api/admin/login' && req.method === 'POST') {
      const { password } = await readJson<{ password?: string }>(req);
      if (!password || !checkAdminPassword(password)) {
        await new Promise((r) => setTimeout(r, 800)); // chậm lại khi sai
        throw new HttpError(401, 'wrong_password', 'Mật khẩu chưa đúng');
      }
      return json({ ok: true }, 200, { 'set-cookie': sessionCookie('admin', createToken('admin', 'teacher')) });
    }
    if (path === '/api/admin/logout' && req.method === 'POST') {
      return json({ ok: true }, 200, { 'set-cookie': clearCookie('admin') });
    }
    if (path === '/api/admin/me' && req.method === 'GET') {
      requireAdmin(req);
      return json({ ok: true });
    }
    throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = { path: ['/api/admin/login', '/api/admin/logout', '/api/admin/me'] };
