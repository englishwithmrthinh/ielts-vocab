/** POST /api/login  { code, pin? } → cookie phiên học sinh. Giáo viên chọn: chỉ cần gõ MÃ (mã lớp + ngày sinh) là vào; có gửi PIN thì kiểm PIN. */
import type { Config } from '@netlify/functions';
import { checkPin, createToken, isValidPin, sessionCookie } from '../lib/auth';
import { handler, HttpError, json, readJson } from '../lib/http';
import { db, must } from '../lib/supabase';

const MAX_FAILS = 10;
const WINDOW_MIN = 15;

export default handler(['POST'], async (req) => {
  const { code, pin } = await readJson<{ code?: string; pin?: string }>(req);
  const c = String(code ?? '').trim().toUpperCase();
  const withPin = pin !== undefined && pin !== null && pin !== '';
  if (!c || (withPin && !isValidPin(pin))) throw new HttpError(400, 'bad_input', 'Nhập mã học sinh');

  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const { count } = await db()
    .from('login_attempts').select('id', { count: 'exact', head: true })
    .eq('code', c).eq('success', false).gte('attempted_at', since);
  if ((count ?? 0) >= MAX_FAILS) {
    throw new HttpError(429, 'too_many_attempts', `Sai quá nhiều lần. Đợi ${WINDOW_MIN} phút rồi thử lại.`);
  }

  type Row = { id: string; name: string; code: string; pin_hash: string; active: boolean };
  const rows = must(await db().from('students').select('id,name,code,pin_hash,active').eq('code', c).limit(1)) as Row[];
  let s: Row | undefined = rows[0];
  if (!s) {
    // Dự phòng: mã lưu chưa kịp cập nhật (đổi mã lớp / mã HS sau) → so trực tiếp mã lớp hiện tại + mã HS
    const all = must(await db().from('students').select('id,name,code,pin_hash,active,birth,c:classes(code)').not('birth', 'is', null)) as unknown as
      (Row & { birth: string; c: { code: string | null } | null })[];
    s = all.find((x) => `${(x.c?.code || 'HS').toUpperCase()}${x.birth.toUpperCase()}` === c);
    if (s) await db().from('students').update({ code: c }).eq('id', s.id); // sửa luôn mã lưu cho lần sau
  }
  const ok = !!s && s.active && (!withPin || (await checkPin(pin as string, s.pin_hash)));
  await db().from('login_attempts').insert({ code: c, success: ok });
  if (!ok || !s) throw new HttpError(401, 'wrong_credentials', 'Mã lớp hoặc ngày sinh chưa đúng');

  return json({ student: { name: s.name, code: s.code } }, 200, {
    'set-cookie': sessionCookie('student', createToken('student', s.id)),
  });
});

export const config: Config = { path: '/api/login' };
