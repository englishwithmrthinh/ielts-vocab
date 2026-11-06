/**
 * Báo cáo cho Google Sheet bằng công thức IMPORTDATA (không cần Google Cloud, không cần cấp quyền).
 * Chủ sở hữu: Sếp.
 *
 * GET /api/admin/sheet-links           → (cần đăng nhập admin) các công thức để dán vào Sheet
 * GET /api/sheet/:tab.csv?key=…        → CSV. tab: hom-nay | chua-lam | thang | de-xuat | bao-loi
 *     thang nhận thêm ?m=YYYY-MM (mặc định tháng hiện tại)
 * key = HMAC(SESSION_SECRET) — đổi SESSION_SECRET là link cũ hết hiệu lực.
 */
import type { Config } from '@netlify/functions';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Assignment, AssignmentStatus, Milestone } from '../../shared/types';
import { PASS_BOX } from '../../shared/types';
import { daysLate, scoreIfSubmittedAt, unsubmittedStatus } from '../../shared/lateness';
import { monthKey, vnDate, vnStartOfDay, nextMonth } from '../../shared/time';
import { requireAdmin } from '../lib/auth';
import { env } from '../lib/env';
import { errorResponse, HttpError, json } from '../lib/http';
import { db, must } from '../lib/supabase';

const TABS = ['hom-nay', 'chua-lam', 'thang', 'de-xuat', 'bao-loi'] as const;
type Tab = (typeof TABS)[number];
const KIND: Record<string, string> = { tue: 'T3', fri: 'T6', sun: 'CN' };

function sheetKey(): string {
  return createHmac('sha256', env('SESSION_SECRET')).update('sheet-v1').digest('base64url').slice(0, 24);
}
function checkKey(k: string | null) {
  const a = Buffer.from(k ?? '');
  const b = Buffer.from(sheetKey());
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(404, 'not_found', 'Không tìm thấy');
}

function csv(rows: (string | number | null | undefined)[][]): Response {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return new Response('﻿' + rows.map((r) => r.map(esc).join(',')).join('\n'), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** PostgREST trả tối đa 1000 dòng mỗi lần → đọc theo trang */
async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await q(from, from + 999);
    const rows = must(r as never) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

interface Stu { id: string; code: string; name: string; created_at: string }

async function base() {
  const [stR, msR, as] = await Promise.all([
    db().from('students').select('id,code,name,created_at').eq('active', true).order('code'),
    db().from('milestones').select('*').order('date'),
    all<Assignment>((f, t) => db().from('assignments').select('*').range(f, t)),
  ]);
  const students = must(stR) as Stu[];
  const milestones = must(msR) as Milestone[];
  const byKey = new Map(as.map((a) => [`${a.student_id}|${a.milestone_id}`, a]));
  const statusOf = (s: Stu, m: Milestone, now: string): AssignmentStatus | null => {
    if (m.is_off) return 'off';
    if (Date.parse(m.deadline_at) < Date.parse(s.created_at)) return null; // trước khi học sinh vào lớp
    const a = byKey.get(`${s.id}|${m.id}`);
    return a?.status === 'submitted' ? 'submitted' : unsubmittedStatus(m, now);
  };
  return { students, milestones, byKey, statusOf };
}

const STATUS_VI: Record<AssignmentStatus, string> = {
  submitted: 'Đã nộp', open: 'Đang mở', owing: 'Đang nợ', abandoned: 'Bỏ bài', locked: 'Chưa mở', off: 'Nghỉ',
};

function cellText(st: AssignmentStatus | null, a: Assignment | undefined): string {
  if (!st || st === 'locked') return '';
  if (st === 'off') return 'Nghỉ';
  if (st === 'submitted') return a?.days_late ? `Trễ ${a.days_late}n · ${a.score_pct}%` : `✓ ${a?.score_pct ?? 100}%`;
  if (st === 'open') return a ? `Đang làm ${a.answered_count}/${a.required_count ?? '?'}` : 'Chưa làm';
  return STATUS_VI[st];
}

/** Mốc "hôm nay": mốc đang mở; không có thì mốc gần nhất đã qua */
function currentMilestone(ms: Milestone[], now: string): Milestone | null {
  const live = ms.filter((m) => !m.is_off);
  const t = Date.parse(now);
  return live.find((m) => Date.parse(m.opens_at) <= t && t <= Date.parse(m.deadline_at))
    ?? [...live].reverse().find((m) => Date.parse(m.deadline_at) < t) ?? null;
}

async function homNay(now: string) {
  const { students, milestones, byKey, statusOf } = await base();
  const m = currentMilestone(milestones, now);
  const since = vnStartOfDay(vnDate(now));
  const [ans, pass] = await Promise.all([
    all<{ student_id: string; correct: boolean }>((f, t) =>
      db().from('answers').select('student_id,correct').eq('mode', 'graded').gte('created_at', since).range(f, t)),
    all<{ student_id: string }>((f, t) => db().from('student_words').select('student_id').eq('box', PASS_BOX).range(f, t)),
  ]);
  const rows: (string | number | null)[][] = [[
    `Cập nhật ${new Date(now).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
    m ? `Mốc: ${KIND[m.kind]} ${m.date}` : 'Chưa có mốc',
  ], ['Mã', 'Tên', 'Trạng thái mốc', 'Tiến độ', 'Điểm', 'Câu hôm nay', 'Đúng hôm nay %', 'Số bài đang nợ', 'Từ đã Pass']];
  for (const s of students) {
    const a = m ? byKey.get(`${s.id}|${m.id}`) : undefined;
    const st = m ? statusOf(s, m, now) : null;
    const mine = ans.filter((x) => x.student_id === s.id);
    const owing = milestones.filter((x) => statusOf(s, x, now) === 'owing').length;
    rows.push([
      s.code, s.name, st ? STATUS_VI[st] : '',
      a ? `${a.answered_count}/${a.required_count ?? '?'}` : '',
      a?.score_pct ?? (st === 'owing' && m ? `nếu nộp giờ: ${scoreIfSubmittedAt(m.date, now)}%` : ''),
      mine.length, mine.length ? Math.round((100 * mine.filter((x) => x.correct).length) / mine.length) : '',
      owing, pass.filter((x) => x.student_id === s.id).length,
    ]);
  }
  return rows;
}

async function chuaLam(now: string) {
  const { students, milestones, byKey, statusOf } = await base();
  const rows: (string | number | null)[][] = [['Mã', 'Tên', 'Mốc', 'Hạn', 'Trạng thái', 'Đã làm', 'Trễ (ngày)', 'Điểm nếu nộp hôm nay']];
  for (const s of students) {
    for (const m of milestones) {
      const st = statusOf(s, m, now);
      if (st !== 'open' && st !== 'owing') continue;
      const a = byKey.get(`${s.id}|${m.id}`);
      rows.push([
        s.code, s.name, `${KIND[m.kind]} ${m.date}`,
        new Date(m.deadline_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        STATUS_VI[st], a ? `${a.answered_count}/${a.required_count ?? '?'}` : '0',
        daysLate(m.date, now), scoreIfSubmittedAt(m.date, now),
      ]);
    }
  }
  return rows;
}

async function thang(now: string, month: string) {
  const { students, milestones, byKey, statusOf } = await base();
  const ms = milestones.filter((m) => m.month === month);
  const from = vnStartOfDay(`${month}-01`);
  const to = vnStartOfDay(`${nextMonth(month)}-01`);
  const ans = await all<{ student_id: string; correct: boolean }>((f, t) =>
    db().from('answers').select('student_id,correct').eq('mode', 'graded').eq('flagged', false)
      .gte('created_at', from).lt('created_at', to).range(f, t));
  const rows: (string | number | null)[][] = [[
    'Mã', 'Tên', ...ms.map((m) => `${KIND[m.kind]} ${m.date.slice(8)}/${m.date.slice(5, 7)}`),
    'Đã nộp', 'Đúng hạn', 'Trễ', 'Bỏ', 'Đang nợ', 'Chuyên cần %', 'Đúng %',
  ]];
  for (const s of students) {
    const cells: string[] = [];
    let sub = 0, onTime = 0, late = 0, ab = 0, owing = 0, total = 0, scoreSum = 0;
    for (const m of ms) {
      const st = statusOf(s, m, now);
      const a = byKey.get(`${s.id}|${m.id}`);
      cells.push(cellText(st, a));
      if (!st || st === 'off' || st === 'locked' || st === 'open') continue;
      total++;
      if (st === 'submitted') { sub++; scoreSum += a?.score_pct ?? 0; if (a?.days_late) late++; else onTime++; }
      if (st === 'abandoned') ab++;
      if (st === 'owing') owing++;
    }
    const mine = ans.filter((x) => x.student_id === s.id);
    rows.push([
      s.code, s.name, ...cells, sub, onTime, late, ab, owing,
      total ? Math.round(scoreSum / total) : '',
      mine.length ? Math.round((100 * mine.filter((x) => x.correct).length) / mine.length) : '',
    ]);
  }
  return rows;
}

async function deXuat() {
  const r = must(await db().from('suggestions').select('text,note,status,created_at,s:students(code,name)')
    .order('created_at', { ascending: false }).limit(500)) as unknown as
    { text: string; note: string | null; status: string; created_at: string; s: { code: string; name: string } | null }[];
  const vi: Record<string, string> = { pending: 'Chờ duyệt', linked: 'Có sẵn trong kho', added: 'Đã thêm', rejected: 'Bỏ qua' };
  return [['Ngày', 'Mã', 'Tên', 'Từ', 'Ghi chú', 'Trạng thái'],
    ...r.map((x) => [vnDate(x.created_at), x.s?.code ?? '', x.s?.name ?? '', x.text, x.note ?? '', vi[x.status] ?? x.status])];
}

async function baoLoi() {
  const r = must(await db().from('answers').select('created_at,qtype,given,s:students(code,name),w:words(word,meaning_vi)')
    .eq('flagged', true).order('created_at', { ascending: false }).limit(500)) as unknown as
    { created_at: string; qtype: string; given: string | null; s: { code: string; name: string } | null; w: { word: string; meaning_vi: string } | null }[];
  return [['Ngày', 'Mã', 'Tên', 'Từ', 'Nghĩa', 'Dạng câu', 'Học sinh trả lời'],
    ...r.map((x) => [vnDate(x.created_at), x.s?.code ?? '', x.s?.name ?? '', x.w?.word ?? '', x.w?.meaning_vi ?? '', x.qtype, x.given ?? ''])];
}

export default async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const p = url.pathname;
    const now = new Date().toISOString();
    if (p === '/api/admin/sheet-links') {
      requireAdmin(req);
      const site = `${url.protocol}//${url.host}`;
      const k = sheetKey();
      const link = (tab: Tab, extra = '') => `${site}/api/sheet/${tab}.csv?key=${k}${extra}`;
      return json({
        huong_dan: 'Mỗi tab trong Google Sheet: bấm ô A1, dán đúng công thức tương ứng. Sheet tự cập nhật khoảng mỗi giờ.',
        'Hôm nay': `=IMPORTDATA("${link('hom-nay')}")`,
        'Chưa làm': `=IMPORTDATA("${link('chua-lam')}")`,
        [`Tháng ${monthKey(vnDate(now))}`]: `=IMPORTDATA("${link('thang')}")`,
        'Từ HS đề xuất': `=IMPORTDATA("${link('de-xuat')}")`,
        'Câu báo lỗi': `=IMPORTDATA("${link('bao-loi')}")`,
        thang_khac: `Muốn xem tháng khác: thêm &m=YYYY-MM vào cuối link tab Tháng, ví dụ ${link('thang', '&m=2026-12')}`,
      });
    }
    const mt = /^\/api\/sheet\/([a-z-]+)\.csv$/.exec(p);
    if (!mt || !TABS.includes(mt[1] as Tab)) throw new HttpError(404, 'not_found', 'Không tìm thấy');
    checkKey(url.searchParams.get('key'));
    const tab = mt[1] as Tab;
    if (tab === 'hom-nay') return csv(await homNay(now));
    if (tab === 'chua-lam') return csv(await chuaLam(now));
    if (tab === 'thang') {
      const m = url.searchParams.get('m');
      return csv(await thang(now, m && /^\d{4}-\d{2}$/.test(m) ? m : monthKey(vnDate(now))));
    }
    if (tab === 'de-xuat') return csv(await deXuat());
    return csv(await baoLoi());
  } catch (e) {
    return errorResponse(e);
  }
};

export const config: Config = { path: ['/api/admin/sheet-links', '/api/sheet/:file'] };

