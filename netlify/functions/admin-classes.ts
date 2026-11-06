/**
 * Lớp học. Chủ sở hữu: Sếp. Cần cookie admin.
 *
 * GET  /api/admin/classes                         → ClassesResponse (kèm sĩ số học sinh đang hoạt động)
 * POST /api/admin/classes          { name }        → { class }
 * POST /api/admin/classes/update   { id, name?, active? } → { class }   (ẩn lớp = active:false; học sinh vẫn giữ class_id)
 * POST /api/admin/classes/move     { studentIds: string[], classId: string | null } → { moved }
 *      Chuyển lớp hàng loạt (null = bỏ khỏi lớp). Tiến độ từ vựng giữ nguyên.
 */
import type { Config } from '@netlify/functions';
import type { Class, ClassesResponse } from '../../shared/types';
import { requireAdmin } from '../lib/auth';
import { errorResponse, HttpError, json, readJson } from '../lib/http';
import { db, must } from '../lib/supabase';

const COLS = 'id,name,active,created_at';

async function list(): Promise<ClassesResponse> {
  const [cR, sR] = await Promise.all([
    db().from('classes').select(COLS).order('name'),
    db().from('students').select('class_id').eq('active', true).not('class_id', 'is', null),
  ]);
  const count = new Map<string, number>();
  for (const s of must(sR) as { class_id: string }[]) count.set(s.class_id, (count.get(s.class_id) ?? 0) + 1);
  return { classes: (must(cR) as Class[]).map((c) => ({ ...c, studentCount: count.get(c.id) ?? 0 })) };
}

function cleanName(n: unknown): string {
  const name = String(n ?? '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 60) throw new HttpError(400, 'bad_name', 'Tên lớp 1–60 ký tự');
  return name;
}

function dup(e: { code?: string } | null) {
  if (e?.code === '23505') throw new HttpError(409, 'duplicate', 'Đã có lớp trùng tên');
}

export default async (req: Request): Promise<Response> => {
  try {
    requireAdmin(req);
    const p = new URL(req.url).pathname;
    if (p === '/api/admin/classes' && req.method === 'GET') return json(await list());
    if (p === '/api/admin/classes' && req.method === 'POST') {
      const { name } = await readJson<{ name?: string }>(req);
      const r = await db().from('classes').insert({ name: cleanName(name) }).select(COLS).single();
      dup(r.error);
      return json({ class: must(r) as Class });
    }
    if (p === '/api/admin/classes/update' && req.method === 'POST') {
      const b = await readJson<{ id?: string; name?: string; active?: boolean }>(req);
      if (!b.id) throw new HttpError(400, 'bad_input', 'Thiếu id');
      const patch: Partial<Class> = {};
      if (b.name !== undefined) patch.name = cleanName(b.name);
      if (typeof b.active === 'boolean') patch.active = b.active;
      const r = await db().from('classes').update(patch).eq('id', b.id).select(COLS).maybeSingle();
      dup(r.error);
      const c = must(r) as Class | null;
      if (!c) throw new HttpError(404, 'not_found', 'Không tìm thấy lớp');
      return json({ class: c });
    }
    if (p === '/api/admin/classes/move' && req.method === 'POST') {
      const b = await readJson<{ studentIds?: string[]; classId?: string | null }>(req);
      const ids = (b.studentIds ?? []).filter((x) => typeof x === 'string');
      if (!ids.length) throw new HttpError(400, 'bad_input', 'Chưa chọn học sinh');
      const rows = must(await db().from('students').update({ class_id: b.classId ?? null }).in('id', ids).select('id')) as unknown[];
      return json({ moved: rows.length });
    }
    throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = {
  path: ['/api/admin/classes', '/api/admin/classes/update', '/api/admin/classes/move'],
};
