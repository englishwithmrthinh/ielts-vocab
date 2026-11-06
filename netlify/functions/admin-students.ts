/**
 * Quản lý học sinh (cần cookie quản trị) — Claude 3.
 *
 * GET  /api/admin/students[?classId=…|none] → { students: Student[] }   (none = chưa xếp lớp)
 * POST /api/admin/students        { names: string[], classId? }
 *      → { created: StudentCard[] }  (tự sinh mã HSxx + PIN; PIN chỉ trả về một lần)
 * POST /api/admin/students/update { id, name?, active? } → { student }
 * POST /api/admin/students/reset-pins { ids: string[] }
 *      → { cards: StudentCard[] }  (cấp PIN mới để in thẻ; PIN cũ hết hiệu lực)
 *
 * PIN chỉ lưu dạng hash nên không đọc lại được: muốn in thẻ là phải cấp PIN mới.
 */
import type { Config } from '@netlify/functions';
import type { Student } from '../../shared/types';
import { hashPin, randomPin, requireAdmin } from '../lib/auth';
import { errorResponse, HttpError, json, readJson } from '../lib/http';
import { db, must } from '../lib/supabase';

export interface StudentCard {
  id: string;
  code: string;
  name: string;
  pin: string;
}

const COLS = 'id,code,name,active,class_id,created_at';
const MAX_NAME = 60;

function cleanName(v: unknown): string {
  const name = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (!name) throw new HttpError(400, 'bad_name', 'Tên học sinh không được để trống');
  if (name.length > MAX_NAME) throw new HttpError(400, 'bad_name', `Tên tối đa ${MAX_NAME} ký tự`);
  return name;
}

/** HS01, HS02… — lấy số lớn nhất hiện có rồi cộng tiếp (không dùng lại mã đã khoá) */
export function nextCodes(existing: string[], count: number): string[] {
  let max = 0;
  for (const c of existing) {
    const m = /^HS(\d+)$/i.exec(c);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Array.from({ length: count }, (_, i) => 'HS' + String(max + 1 + i).padStart(2, '0'));
}

async function listStudents(classId?: string | null): Promise<Student[]> {
  let q = db().from('students').select(COLS).order('code');
  if (classId === 'none') q = q.is('class_id', null);
  else if (classId) q = q.eq('class_id', classId);
  return must(await q) as Student[];
}

async function createStudents(names: string[], classId: string | null = null): Promise<StudentCard[]> {
  const clean = names.map(cleanName);
  if (!clean.length) throw new HttpError(400, 'bad_input', 'Chưa nhập tên học sinh');
  if (clean.length > 60) throw new HttpError(400, 'bad_input', 'Mỗi lần thêm tối đa 60 học sinh');

  // Thử lại khi hai lần thêm chạy cùng lúc làm trùng mã
  for (let attempt = 0; attempt < 3; attempt++) {
    const codes = nextCodes((await listStudents()).map((s) => s.code), clean.length);
    const pins = clean.map(() => randomPin());
    const rows = await Promise.all(
      clean.map(async (name, i) => ({ name, code: codes[i]!, pin_hash: await hashPin(pins[i]!), class_id: classId })),
    );
    const res = await db().from('students').insert(rows).select(COLS);
    if (res.error?.message.includes('duplicate')) continue;
    const created = must(res) as Student[];
    return created.map((s) => ({ id: s.id, code: s.code, name: s.name, pin: pins[codes.indexOf(s.code)]! }));
  }
  throw new HttpError(409, 'code_conflict', 'Trùng mã học sinh, thử lại');
}

async function updateStudent(body: { id?: string; name?: unknown; active?: unknown }): Promise<Student> {
  if (!body.id) throw new HttpError(400, 'bad_input', 'Thiếu id');
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = cleanName(body.name);
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') throw new HttpError(400, 'bad_input', 'active phải là true/false');
    patch.active = body.active;
  }
  if (!Object.keys(patch).length) throw new HttpError(400, 'bad_input', 'Không có gì để sửa');
  const rows = must(await db().from('students').update(patch).eq('id', body.id).select(COLS)) as Student[];
  if (!rows[0]) throw new HttpError(404, 'not_found', 'Không tìm thấy học sinh');
  return rows[0];
}

async function resetPins(ids: unknown): Promise<StudentCard[]> {
  if (!Array.isArray(ids) || !ids.length || !ids.every((x) => typeof x === 'string')) {
    throw new HttpError(400, 'bad_input', 'Cần danh sách ids');
  }
  const students = must(await db().from('students').select(COLS).in('id', ids)) as Student[];
  const cards: StudentCard[] = [];
  for (const s of students) {
    const pin = randomPin();
    must(await db().from('students').update({ pin_hash: await hashPin(pin) }).eq('id', s.id));
    cards.push({ id: s.id, code: s.code, name: s.name, pin });
  }
  return cards.sort((a, b) => a.code.localeCompare(b.code));
}

export default async (req: Request): Promise<Response> => {
  try {
    requireAdmin(req);
    const path = new URL(req.url).pathname;
    if (path === '/api/admin/students' && req.method === 'GET') {
      return json({ students: await listStudents(new URL(req.url).searchParams.get('classId')) });
    }
    if (path === '/api/admin/students' && req.method === 'POST') {
      const { names, classId } = await readJson<{ names?: unknown; classId?: unknown }>(req);
      if (!Array.isArray(names)) throw new HttpError(400, 'bad_input', 'Cần danh sách names');
      if (classId !== undefined && classId !== null && typeof classId !== 'string') throw new HttpError(400, 'bad_input', 'classId không hợp lệ');
      if (classId) {
        const c = must(await db().from('classes').select('id').eq('id', classId).maybeSingle());
        if (!c) throw new HttpError(404, 'not_found', 'Không tìm thấy lớp');
      }
      return json({ created: await createStudents(names, (classId as string | null | undefined) ?? null) });
    }
    if (path === '/api/admin/students/update' && req.method === 'POST') {
      return json({ student: await updateStudent(await readJson(req)) });
    }
    if (path === '/api/admin/students/reset-pins' && req.method === 'POST') {
      const { ids } = await readJson<{ ids?: unknown }>(req);
      return json({ cards: await resetPins(ids) });
    }
    throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = {
  path: ['/api/admin/students', '/api/admin/students/update', '/api/admin/students/reset-pins'],
};
