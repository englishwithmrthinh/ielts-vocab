/**
 * Mã học sinh = mã lớp (2–6 chữ/số, vd GB07) + ngày sinh, ví dụ GB072402. Chủ sở hữu: Sếp.
 * Trùng thì thêm 2, 3… vào cuối. Học sinh chưa có ngày sinh giữ mã cũ (HSxx).
 * Học sinh chưa xếp lớp dùng tiền tố "HS".
 */
import { db, must } from './supabase';

/** Phần mã riêng của học sinh: thường là ngày + tháng sinh (2402), có thể có chữ (AN2402). 2–8 ký tự chữ/số. */
export function cleanBirth(v: unknown): string | null {
  const raw = String(v ?? '').trim();
  const s = /^[\d/.\- ]+$/.test(raw) ? raw.replace(/\D/g, '') : raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length >= 2 && s.length <= 8 ? s : null;
}

export function cleanClassCode(v: unknown): string {
  const s = String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return s.slice(0, 6);
}

/** Gợi ý mã lớp từ tên: chữ đầu của 2 từ đầu, ví dụ "IELTS Foundation" → IF */
export function suggestClassCode(name: string): string {
  const words = name.split(/\s+/).map((w) => cleanClassCode(w).replace(/\d/g, '')).filter(Boolean);
  const c = words.length >= 2 ? words[0]![0]! + words[1]![0]! : (words[0] ?? 'LH').slice(0, 2);
  return c.padEnd(2, 'X');
}

/** Tính lại mã cho các học sinh (có ngày sinh) theo lớp hiện tại. Trả về số em đổi mã. */
export async function recomputeCodes(studentIds: string[]): Promise<number> {
  if (!studentIds.length) return 0;
  const [stR, clR, allR] = await Promise.all([
    db().from('students').select('id,code,birth,class_id').in('id', studentIds),
    db().from('classes').select('id,code'),
    db().from('students').select('id,code'),
  ]);
  const st = must(stR) as { id: string; code: string; birth: string | null; class_id: string | null }[];
  const clsCode = new Map((must(clR) as { id: string; code: string | null }[]).map((c) => [c.id, c.code]));
  const taken = new Map((must(allR) as { id: string; code: string }[]).map((s) => [s.code, s.id]));
  let changed = 0;
  for (const s of st) {
    if (!s.birth) continue;
    const prefix = (s.class_id && clsCode.get(s.class_id)) || 'HS';
    const base = `${prefix}${s.birth}`;
    let code = base;
    for (let n = 2; taken.has(code) && taken.get(code) !== s.id; n++) code = `${base}${n}`;
    if (code === s.code) continue;
    taken.delete(s.code);
    taken.set(code, s.id);
    must(await db().from('students').update({ code }).eq('id', s.id));
    changed++;
  }
  return changed;
}
