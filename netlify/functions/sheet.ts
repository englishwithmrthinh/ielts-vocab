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
import { extKey, withExtension } from '../../shared/deadlines';
import { loadExtensions } from '../lib/extensions';
import { beforeFirst } from '../../shared/first-due';
import { loadFirstIdx } from '../lib/first-due';
import { addDays, isoWeekday, monthKey, nextMonth, vnDate, vnStartOfDay, weekStart } from '../../shared/time';
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

function html(month: string, tabs: [string, (string | number | null | undefined)[][]][]): Response {
  const e = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const color = (v: string) => /Nợ|Bỏ/.test(v) ? 'bad' : /Trễ|Đang làm|Chưa làm/.test(v) ? 'mid' : /^✓|Đã nộp/.test(v) ? 'ok' : '';
  const body = tabs.map(([name, rows], i) => {
    const hasNote = name === 'Hôm nay';
    const head = hasNote ? rows.slice(0, 1) : [];
    const t = hasNote ? rows.slice(1) : rows;
    const [h, ...r] = t;
    const csvRows = rows.map((x) => x.map((v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
    return `<section id="t${i}" class="tab${i ? '' : ' on'}">
      ${head.map((x) => `<p class="note">${x.map(e).join(' · ')}</p>`).join('')}
      <p><button onclick="dl(${i})">⬇ Tải file mở bằng Excel / Google Sheets</button> <span class="cnt">${r.length} dòng</span></p>
      <div class="wrap"><table><thead><tr>${(h ?? []).map((x) => `<th>${e(x)}</th>`).join('')}</tr></thead>
      <tbody>${r.length ? r.map((x) => {
        const ci = (h ?? []).indexOf('Mã');
        const code = ci >= 0 ? String(x[ci] ?? '') : '';
        return `<tr>${x.map((v, j) => {
          const txt = e(v);
          const link = code && (j === ci || (h ?? [])[j] === 'Tên') ? `<a class="hs" href="?hs=${encodeURIComponent(code)}&m=${month}">${txt}</a>` : txt;
          return `<td class="${color(String(v ?? ''))}">${link}</td>`;
        }).join('')}</tr>`;
      }).join('') : `<tr><td colspan="${(h ?? []).length || 1}">Chưa có dữ liệu</td></tr>`}</tbody></table></div>
      <textarea hidden id="csv${i}">${e(csvRows)}</textarea></section>`;
  }).join('');
  const nav = tabs.map(([n], i) => `<a href="#" data-i="${i}" class="${i ? '' : 'on'}">${e(n)}</a>`).join('');
  const page = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Báo cáo lớp</title><style>
:root{--bg:#f6f2ea;--card:#fbf9f4;--ink:#2b2622;--line:#e2d9cb;--teal:#1f4e52;--ok:#e2ecdf;--mid:#f5e9cc;--bad:#f2dcdc}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,sans-serif}
header{background:var(--teal);color:#f3e9d2;padding:16px}h1{margin:0;font:600 22px Georgia,serif;letter-spacing:.04em}
nav{display:flex;gap:6px;flex-wrap:wrap;padding:12px 16px}nav a{padding:6px 12px;border-radius:99px;background:var(--card);border:1px solid var(--line);color:var(--ink);text-decoration:none}
nav a.on{background:var(--teal);color:#fff;border-color:var(--teal)}
.tab{display:none;padding:0 16px 24px}.tab.on{display:block}.note{color:#5c534b}
.wrap{overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:12px;max-height:75vh}
table{border-collapse:collapse;width:100%;white-space:nowrap}th,td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:left}
th{position:sticky;top:0;background:#efe9de;font-weight:600}td.ok{background:var(--ok)}td.mid{background:var(--mid)}td.bad{background:var(--bad)}
a.hs{color:var(--teal);font-weight:600;text-decoration:underline;text-underline-offset:2px}
button{background:var(--teal);color:#fff;border:0;border-radius:8px;padding:8px 12px;font:inherit;cursor:pointer}.cnt{color:#7a7067;margin-left:8px}
form{display:inline;margin-left:8px}input{font:inherit;padding:4px 6px;border-radius:6px;border:1px solid var(--line)}
</style></head><body><header><h1>BÁO CÁO LỚP</h1><div>Mở lại trang để cập nhật · <form><label>Tháng <input type="month" name="m" value="${e(month)}" onchange="this.form.submit()"></label></form></div></header>
<p style="padding:0 16px;margin:10px 0 0;color:#5c534b">Bấm vào <b>mã</b> hoặc <b>tên</b> một học sinh để xem lịch cả tháng của em đó.</p><nav>${nav}</nav>${body}
<script>
document.querySelectorAll('nav a').forEach(a=>a.onclick=ev=>{ev.preventDefault();document.querySelectorAll('nav a,.tab').forEach(x=>x.classList.remove('on'));a.classList.add('on');document.getElementById('t'+a.dataset.i).classList.add('on')});
function dl(i){const t=document.getElementById("csv"+i).value;const b=new Blob(['\ufeff'+t],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(b);const l=document.createElement('a');l.href=u;l.download=document.querySelectorAll('nav a')[i].textContent+'.csv';l.click();URL.revokeObjectURL(u)}
</script></body></html>`;
  return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

/** Lịch tháng của MỘT học sinh: mỗi mốc ghi Đúng hạn / Trễ N ngày / Đang làm x/y / Nợ / Bỏ / Nghỉ (không ghi điểm) */
async function studentCalendar(code: string, month: string, now: string): Promise<Response> {
  const e = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const st = must(await db().from('students').select('id,code,name,created_at,class_id').eq('code', code).maybeSingle()) as
    { id: string; code: string; name: string; created_at: string; class_id: string | null } | null;
  if (!st) return new Response('Không tìm thấy học sinh', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const [msR, asR, clR, ext, firstIdx] = await Promise.all([
    db().from('milestones').select('*').eq('month', month).order('date'),
    db().from('assignments').select('*').eq('student_id', st.id),
    st.class_id ? db().from('classes').select('name').eq('id', st.class_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    loadExtensions({ studentIds: [st.id] }),
    loadFirstIdx([st.id]),
  ]);
  const ms = (must(msR) as Milestone[]).map((m) => withExtension(m, ext.get(extKey(st.id, m.id))));
  const byM = new Map((must(asR) as Assignment[]).map((a) => [a.milestone_id, a]));
  const cls = (clR.data as { name: string } | null)?.name ?? 'Chưa xếp lớp';
  const vnDM = (iso: string) => { const d = new Date(Date.parse(iso) + 7 * 3600_000).toISOString(); return `${d.slice(8, 10)}/${d.slice(5, 7)}`; };
  const vnHM = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(11, 16);
  const cnt = { ok: 0, late: 0, owing: 0, ab: 0, open: 0 };
  const cell = new Map<string, { cls: string; title: string; sub: string }>();
  for (const m of ms) {
    if (m.is_off) { cell.set(m.date, { cls: 'off', title: 'Nghỉ', sub: '' }); continue; }
    if (Date.parse(m.deadline_at) < Date.parse(st.created_at)) { cell.set(m.date, { cls: 'off', title: '—', sub: 'chưa vào lớp' }); continue; }
    if (beforeFirst(m, firstIdx.get(st.id))) { cell.set(m.date, { cls: 'off', title: '—', sub: 'chưa có từ' }); continue; }
    const a = byM.get(m.id);
    const prog = a ? `làm ${Math.min(a.answered_count, a.required_count ?? a.answered_count)}/${a.required_count ?? '?'} câu` : 'chưa làm câu nào';
    if (a?.status === 'submitted') {
      if (a.days_late) { cnt.late++; cell.set(m.date, { cls: 'mid', title: `Trễ ${a.days_late} ngày`, sub: `nộp ${a.submitted_at ? vnDM(a.submitted_at) : ''} · xong` }); }
      else { cnt.ok++; cell.set(m.date, { cls: 'ok', title: '✓ Đúng hạn', sub: `nộp ${a.submitted_at ? vnDM(a.submitted_at) + ' ' + vnHM(a.submitted_at) : ''}` }); }
      continue;
    }
    const s = unsubmittedStatus(m, now);
    if (s === 'locked') cell.set(m.date, { cls: '', title: 'Chưa mở', sub: `hạn ${vnDM(m.deadline_at)} ${vnHM(m.deadline_at)}` });
    else if (s === 'open') { cnt.open++; cell.set(m.date, { cls: 'open', title: a ? 'Đang làm' : 'Chưa làm', sub: `${prog} · hạn ${vnHM(m.deadline_at)}` }); }
    else if (s === 'owing') { cnt.owing++; cell.set(m.date, { cls: 'bad', title: `Nợ · trễ ${daysLate(vnDate(m.deadline_at), now)} ngày`, sub: prog }); }
    else if (s === 'abandoned') { cnt.ab++; cell.set(m.date, { cls: 'bad', title: 'Bỏ bài', sub: 'quá 7 ngày không nộp' }); }
  }
  // Lưới lịch Thứ 2 → CN
  const first = `${month}-01`;
  const days: string[] = [];
  for (let d = weekStart(first); d < `${nextMonth(month)}-01` || isoWeekday(d) !== 1; d = addDays(d, 1)) days.push(d);
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const td = (d: string) => {
    const c = cell.get(d);
    const inM = d.startsWith(month);
    return `<td class="${inM ? '' : 'out'}"><div class="dn">${Number(d.slice(8))}</div>${c ? `<div class="st ${c.cls}"><b>${e(c.title)}</b><span>${e(c.sub)}</span></div>` : ''}</td>`;
  };
  const prev = (() => { const [y, mm] = month.split('-').map(Number) as [number, number]; return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`; })();
  const page = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(st.name)} · ${month}</title><style>
:root{--bg:#f6f2ea;--card:#fbf9f4;--ink:#2b2622;--line:#e2d9cb;--teal:#1f4e52}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.4 system-ui,sans-serif}
header{background:var(--teal);color:#f3e9d2;padding:14px 16px}h1{margin:0;font:600 22px Georgia,serif}
header a{color:#f3e9d2}.wrap{padding:12px 16px 28px;max-width:1100px}
.sum{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 14px}.sum span{background:var(--card);border:1px solid var(--line);border-radius:99px;padding:5px 12px}
table{width:100%;border-collapse:separate;border-spacing:6px;table-layout:fixed}th{font-weight:600;color:#5c534b;text-align:left;padding:0 4px}
td{background:var(--card);border:1px solid var(--line);border-radius:10px;vertical-align:top;height:92px;padding:6px}td.out{opacity:.45}
.dn{font-size:12px;color:#7a7067}.st{margin-top:4px;border-radius:8px;padding:5px 6px}.st b{display:block;font-size:13px}.st span{display:block;font-size:11.5px;color:#5c534b;margin-top:2px}
.ok{background:#e2ecdf}.mid{background:#f5e9cc}.bad{background:#f2dcdc}.open{background:#e3ece9}.off{background:#ece7df;color:#7a7067}
@media(max-width:640px){td{height:auto;min-height:70px;padding:4px}.st b{font-size:11.5px}.st span{font-size:10.5px}}
.nav a{color:var(--teal);font-weight:600}
</style></head><body><header><div><a href="/bao-cao-lop?m=${month}">← Bảng báo cáo lớp</a></div><h1>${e(st.name)}</h1><div>${e(st.code)} · ${e(cls)}</div></header>
<div class="wrap"><p class="nav"><a href="?hs=${encodeURIComponent(st.code)}&m=${prev}">‹ Tháng trước</a> &nbsp; <b>Tháng ${month.slice(5)}/${month.slice(0, 4)}</b> &nbsp; <a href="?hs=${encodeURIComponent(st.code)}&m=${nextMonth(month)}">Tháng sau ›</a></p>
<div class="sum"><span>✓ Đúng hạn: <b>${cnt.ok}</b></span><span>Trễ: <b>${cnt.late}</b></span><span>Đang mở: <b>${cnt.open}</b></span><span>Đang nợ: <b>${cnt.owing}</b></span><span>Bỏ bài: <b>${cnt.ab}</b></span></div>
<table><thead><tr><th>T2</th><th>T3</th><th>T4</th><th>T5</th><th>T6</th><th>T7</th><th>CN</th></tr></thead>
<tbody>${weeks.map((w) => `<tr>${w.map(td).join('')}</tr>`).join('')}</tbody></table></div></body></html>`;
  return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
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

interface Stu { id: string; code: string; name: string; created_at: string; class_id: string | null; cls: string }

async function base() {
  const [stR, msR, as, clR, ext, first] = await Promise.all([
    db().from('students').select('id,code,name,created_at,class_id').eq('active', true).order('code'),
    db().from('milestones').select('*').order('date'),
    all<Assignment>((f, t) => db().from('assignments').select('*').range(f, t)),
    db().from('classes').select('id,name'),
    loadExtensions(),
    loadFirstIdx(),
  ]);
  const clsName = new Map((must(clR) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  // Một tab cho tất cả, có cột Lớp, sắp theo lớp rồi theo mã (chưa xếp lớp ở cuối)
  const students = (must(stR) as Omit<Stu, 'cls'>[])
    .map((s) => ({ ...s, cls: (s.class_id && clsName.get(s.class_id)) || '' }))
    .sort((a, b) => (a.cls ? 0 : 1) - (b.cls ? 0 : 1) || a.cls.localeCompare(b.cls, 'vi') || a.code.localeCompare(b.code));
  const milestones = must(msR) as Milestone[];
  const byKey = new Map(as.map((a) => [`${a.student_id}|${a.milestone_id}`, a]));
  /** Mốc với hạn hiệu lực của học sinh s (có gia hạn riêng thì dùng hạn riêng) */
  const eff = (s: Stu, m: Milestone): Milestone => withExtension(m, ext.get(extKey(s.id, m.id)));
  const statusOf = (s: Stu, m0: Milestone, now: string): AssignmentStatus | null => {
    const m = eff(s, m0);
    if (m.is_off) return 'off';
    if (Date.parse(m.deadline_at) < Date.parse(s.created_at)) return null; // trước khi học sinh vào lớp
    if (beforeFirst(m, first.get(s.id))) return null; // chưa có từ thì chưa có bài
    const a = byKey.get(`${s.id}|${m.id}`);
    return a?.status === 'submitted' ? 'submitted' : unsubmittedStatus(m, now);
  };
  return { students, milestones, byKey, statusOf, eff };
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
  const { students, milestones, byKey, statusOf, eff } = await base();
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
  ], ['Lớp', 'Mã', 'Tên', 'Trạng thái mốc', 'Tiến độ', 'Điểm', 'Câu hôm nay', 'Đúng hôm nay %', 'Số bài đang nợ', 'Từ đã Pass']];
  for (const s of students) {
    const a = m ? byKey.get(`${s.id}|${m.id}`) : undefined;
    const st = m ? statusOf(s, m, now) : null;
    const mine = ans.filter((x) => x.student_id === s.id);
    const owing = milestones.filter((x) => statusOf(s, x, now) === 'owing').length;
    rows.push([
      s.cls, s.code, s.name, st ? STATUS_VI[st] : '',
      a ? `${a.answered_count}/${a.required_count ?? '?'}` : '',
      a?.score_pct ?? (st === 'owing' && m ? `nếu nộp giờ: ${scoreIfSubmittedAt(vnDate(eff(s, m).deadline_at), now)}%` : ''),
      mine.length, mine.length ? Math.round((100 * mine.filter((x) => x.correct).length) / mine.length) : '',
      owing, pass.filter((x) => x.student_id === s.id).length,
    ]);
  }
  return rows;
}

async function chuaLam(now: string) {
  const { students, milestones, byKey, statusOf, eff } = await base();
  const rows: (string | number | null)[][] = [['Lớp', 'Mã', 'Tên', 'Mốc', 'Hạn', 'Trạng thái', 'Đã làm', 'Trễ (ngày)', 'Điểm nếu nộp hôm nay']];
  for (const s of students) {
    for (const m0 of milestones) {
      const st = statusOf(s, m0, now);
      if (st !== 'open' && st !== 'owing') continue;
      const m = eff(s, m0);
      const a = byKey.get(`${s.id}|${m.id}`);
      rows.push([
        s.cls, s.code, s.name, `${KIND[m.kind]} ${m.date}`,
        new Date(m.deadline_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        STATUS_VI[st], a ? `${a.answered_count}/${a.required_count ?? '?'}` : '0',
        daysLate(vnDate(m.deadline_at), now), scoreIfSubmittedAt(vnDate(m.deadline_at), now),
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
    'Lớp', 'Mã', 'Tên', ...ms.map((m) => `${KIND[m.kind]} ${m.date.slice(8)}/${m.date.slice(5, 7)}`),
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
      s.cls, s.code, s.name, ...cells, sub, onTime, late, ab, owing,
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
    if (p === '/bao-cao-lop') {
      try { requireAdmin(req); } catch { return Response.redirect(`${url.protocol}//${url.host}/admin`, 302); }
      const qm = url.searchParams.get('m');
      const month = qm && /^\d{4}-\d{2}$/.test(qm) ? qm : monthKey(vnDate(now));
      const hs = url.searchParams.get('hs');
      if (hs) return studentCalendar(hs.trim().toUpperCase(), month, now);
      const [a, b, c, d, e] = await Promise.all([homNay(now), chuaLam(now), thang(now, month), deXuat(), baoLoi()]);
      return html(month, [['Hôm nay', a], ['Chưa làm', b], [`Tháng ${month}`, c], ['Từ HS đề xuất', d], ['Câu báo lỗi', e]]);
    }
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

export const config: Config = { path: ['/bao-cao-lop', '/api/admin/sheet-links', '/api/sheet/:file'] };

