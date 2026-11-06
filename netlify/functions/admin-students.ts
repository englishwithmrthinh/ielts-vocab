/**
 * Quản lý học sinh (cần cookie quản trị) — Claude 3.
 *
 * GET  /api/admin/students[?classId=…|none] → { students: Student[] }   (none = chưa xếp lớp)
 * POST /api/admin/students        { names: string[], classId? }   mỗi dòng "Tên, ngày sinh" (vd 2402 = 24/02) → mã = mã lớp + ngày sinh
 *      → { created: StudentCard[] }  (tự sinh mã HSxx + PIN; PIN chỉ trả về một lần)
 * POST /api/admin/students/update { id, name?, active?, pin?, birth? } → { student }  (đổi ngày sinh → đổi mã)
 * POST /api/admin/students/reset-pins { ids: string[] }
 *      → { cards: StudentCard[] }  (cấp PIN mới để in thẻ; PIN cũ hết hiệu lực)
 *
 * PIN chỉ lưu dạng hash nên không đọc lại được: muốn in thẻ là phải cấp PIN mới.
 */
import type { Config } from '@netlify/functions';
import type { Student } from '../../shared/types';
import { isValidPin, hashPin, randomPin, requireAdmin } from '../lib/auth';
import { errorResponse, HttpError, json, readJson } from '../lib/http';
import { db, must } from '../lib/supabase';
import { cleanBirth, recomputeCodes } from '../lib/codes';

export interface StudentCard {
  id: string;
  code: string;
  name: string;
  pin: string;
}

const COLS = 'id,code,name,active,class_id,birth,created_at';
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

function rowsIds(res: { data: unknown }): string[] {
  return ((res.data as { id: string }[] | null) ?? []).map((r) => r.id); // thứ tự trả về = thứ tự insert
}

async function listStudents(classId?: string | null): Promise<Student[]> {
  let q = db().from('students').select(COLS).order('code');
  if (classId === 'none') q = q.is('class_id', null);
  else if (classId) q = q.eq('class_id', classId);
  return must(await q) as Student[];
}

async function createStudents(names: string[], classId: string | null = null): Promise<StudentCard[]> {
  // Mỗi dòng có thể kèm ngày sinh: "Nguyễn Minh Anh, 2402" (ngày+tháng; gõ 24/02 cũng được)
  const parsed = names.map((n) => {
    const m = /^(.*?)[,;\t]+\s*([\d/.\- ]{4,12})\s*$/.exec(String(n ?? ''));
    const birth = m ? cleanBirth(m[2]) : null;
    return birth ? { name: m![1]!, birth } : { name: String(n ?? ''), birth: null as string | null };
  });
  const clean = parsed.map((x) => cleanName(x.name));
  if (!clean.length) throw new HttpError(400, 'bad_input', 'Chưa nhập tên học sinh');
  if (clean.length > 60) throw new HttpError(400, 'bad_input', 'Mỗi lần thêm tối đa 60 học sinh');

  // Thử lại khi hai lần thêm chạy cùng lúc làm trùng mã
  for (let attempt = 0; attempt < 3; attempt++) {
    const codes = nextCodes((await listStudents()).map((s) => s.code), clean.length);
    const pins = clean.map(() => randomPin()); // có ngày sinh thì đăng nhập chỉ cần mã; PIN vẫn giữ cho tương thích
    const rows = await Promise.all(
      clean.map(async (name, i) => ({ name, code: codes[i]!, pin_hash: await hashPin(pins[i]!), class_id: classId, birth: parsed[i]!.birth })),
    );
    const res = await db().from('students').insert(rows).select(COLS);
    if (res.error?.message.includes('duplicate')) continue;
    let created = must(res) as Student[];
    const withBirth = created.filter((x) => (x as Student & { birth?: string | null }).birth).map((x) => x.id);
    if (withBirth.length) {
      await recomputeCodes(withBirth);
      created = must(await db().from('students').select(COLS).in('id', created.map((x) => x.id))) as Student[];
    }
    const pinOf = new Map(rowsIds(res).map((id, i) => [id, pins[i]!]));
    return created.map((s) => ({ id: s.id, code: s.code, name: s.name, pin: pinOf.get(s.id) ?? '' }));
  }
  throw new HttpError(409, 'code_conflict', 'Trùng mã học sinh, thử lại');
}

async function updateStudent(body: { id?: string; name?: unknown; active?: unknown; pin?: unknown; birth?: unknown }): Promise<Student> {
  if (!body.id) throw new HttpError(400, 'bad_input', 'Thiếu id');
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = cleanName(body.name);
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') throw new HttpError(400, 'bad_input', 'active phải là true/false');
    patch.active = body.active;
  }
  let birthChanged = false;
  if (body.birth !== undefined) {
    const b = cleanBirth(body.birth);
    if (!b) throw new HttpError(400, 'bad_birth', 'Ngày tháng sinh dạng 2402 (sinh 24/02)');
    patch.birth = b;
    birthChanged = true;
  }
  if (body.pin !== undefined) {
    if (!isValidPin(body.pin)) throw new HttpError(400, 'bad_pin', 'PIN phải đúng 4 chữ số');
    patch.pin_hash = await hashPin(body.pin);
  }
  if (!Object.keys(patch).length) throw new HttpError(400, 'bad_input', 'Không có gì để sửa');
  const rows = must(await db().from('students').update(patch).eq('id', body.id).select(COLS)) as Student[];
  if (!rows[0]) throw new HttpError(404, 'not_found', 'Không tìm thấy học sinh');
  if (!birthChanged) return rows[0];
  await recomputeCodes([body.id]);
  return (must(await db().from('students').select(COLS).eq('id', body.id).single()) as Student);
}

/** Xoá hẳn học sinh và TOÀN BỘ dữ liệu (bài, câu trả lời, XP, báo cáo). Không hoàn tác được. */
async function deleteStudents(ids: unknown): Promise<number> {
  if (!Array.isArray(ids) || !ids.length || !ids.every((x) => typeof x === 'string')) throw new HttpError(400, 'bad_input', 'Cần danh sách ids');
  const rows = must(await db().from('students').delete().in('id', ids).select('id')) as unknown[];
  return rows.length;
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
    if (path === '/api/admin/students/delete' && req.method === 'POST') {
      const { ids } = await readJson<{ ids?: unknown }>(req);
      return json({ deleted: await deleteStudents(ids) });
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
  path: ['/api/admin/students', '/api/admin/students/update', '/api/admin/students/reset-pins', '/api/admin/students/delete'],
};
