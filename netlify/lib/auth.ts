/**
 * Đăng nhập & phiên.
 * - Học sinh: mã + PIN 4 số (bcrypt) → cookie `sid`, 30 ngày.
 * - Giáo viên: mật khẩu ADMIN_PASSWORD → cookie `aid`, 7 ngày.
 * Token = base64url(payload).HMAC-SHA256(SESSION_SECRET). Không lưu phiên trong DB.
 *
 * Function khác dùng: requireStudent(req) / requireAdmin(req) / hashPin(pin).
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from './env';
import { HttpError } from './http';

type Role = 'student' | 'admin';
interface Session { role: Role; sub: string; exp: number }

const COOKIE: Record<Role, string> = { student: 'sid', admin: 'aid' };
const TTL_DAYS: Record<Role, number> = { student: 30, admin: 7 };

function b64url(s: string | Buffer): string {
  return Buffer.from(s).toString('base64url');
}

function sign(data: string): string {
  return createHmac('sha256', env('SESSION_SECRET')).update(data).digest('base64url');
}

export function createToken(role: Role, sub: string, now = Date.now()): string {
  const payload: Session = { role, sub, exp: now + TTL_DAYS[role] * 86_400_000 };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string | undefined, role: Role, now = Date.now()): Session | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString()) as Session;
    if (s.role !== role || typeof s.exp !== 'number' || s.exp < now) return null;
    return s;
  } catch {
    return null;
  }
}

export function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function sessionCookie(role: Role, token: string): string {
  const maxAge = TTL_DAYS[role] * 86_400;
  return `${COOKIE[role]}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie(role: Role): string {
  return `${COOKIE[role]}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

/** Trả về id học sinh, hoặc ném 401 */
export function requireStudent(req: Request): string {
  const s = verifyToken(readCookie(req, COOKIE.student), 'student');
  if (!s) throw new HttpError(401, 'not_logged_in', 'Bạn cần đăng nhập lại');
  return s.sub;
}

/** Ném 401 nếu không phải giáo viên */
export function requireAdmin(req: Request): void {
  const s = verifyToken(readCookie(req, COOKIE.admin), 'admin');
  if (!s) throw new HttpError(401, 'not_admin', 'Cần đăng nhập trang quản trị');
}

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new HttpError(400, 'bad_pin', 'PIN phải gồm đúng 4 chữ số');
  return bcrypt.hash(pin, 10);
}

export async function checkPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/** So sánh mật khẩu admin không lộ thời gian */
export function checkAdminPassword(given: string): boolean {
  const a = Buffer.from(sign('admin:' + given));
  const b = Buffer.from(sign('admin:' + env('ADMIN_PASSWORD')));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Sinh PIN ngẫu nhiên 4 số (cho Claude 3 dùng khi tạo học sinh) */
export function randomPin(): string {
  return String(randomInt(0, 10_000)).padStart(4, '0');
}
