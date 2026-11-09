/** Báo cáo tháng: bảng theo tháng/lớp, khung bên phải để sửa nhận xét, chốt, copy link + tin nhắn Zalo. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AdminReportsResponse, ClassesResponse } from '@shared/types';
import { monthKey, vnDate } from '@shared/time';
import { adminApi } from '../lib/adminApi';
import { copyText } from '../lib/imageFile';
import { vnClock } from '../lib/vnTime';
import { Badge, Button, Card, ErrorBox, PageHeader, inputCls, selectCls } from '../ui';

type Report = AdminReportsResponse['reports'][number];

function shiftMonth(m: string, d: number): string {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  const t = y * 12 + (mo - 1) + d;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

/** Ngày 1–8: mặc định tháng trước (đang trong tuần sửa nhận xét) */
export function defaultMonth(today = vnDate(new Date())): string {
  const m = monthKey(today);
  return Number(today.slice(8, 10)) <= 8 ? shiftMonth(m, -1) : m;
}

const monthLabel = (m: string) => `Tháng ${Number(m.slice(5))}/${m.slice(0, 4)}`;

/** "Số liệu tính lúc HH:mm dd/mm" (giờ VN) */
export const computedLine = (iso: string | null) => (iso ? `Số liệu tính lúc ${vnClock(iso)}` : 'Số liệu tính lúc: chưa rõ (bản cũ)');

const REWRITE_CONFIRM = 'Viết lại nhận xét AI: nhận xét AI hiện tại sẽ bị THAY bằng bản mới (nhận xét của giáo viên giữ nguyên).\n\nTiếp tục?';
const POLL_MS = 20_000;
const POLL_MAX_MS = 5 * 60_000;

/** Ô tick "Viết lại nhận xét AI" (mặc định không tick) */
function RewriteAiBox({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-slate-700">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      Viết lại nhận xét AI
    </label>
  );
}

export function zaloMessage(r: Report, month: string): string {
  const mm = Number(month.slice(5));
  return [
    `Kính gửi Quý phụ huynh em ${r.name},`,
    '',
    `Thầy gửi gia đình báo cáo học tập tháng ${mm} của con trên web ôn từ vựng IELTS: số bài đúng hạn, số bài trễ, số từ con đã thuộc và nhận xét của thầy.`,
    '',
    `Xem báo cáo tại: ${r.link}`,
    '',
    'Mong gia đình tiếp tục nhắc con làm bài đúng hạn vào Thứ 3, Thứ 6 và Chủ nhật. Cảm ơn gia đình đã đồng hành cùng thầy!',
  ].join('\n');
}

export default function ReportsPage() {
  const [month, setMonth] = useState(defaultMonth());
  const [data, setData] = useState<AdminReportsResponse | null>(null);
  const [classes, setClasses] = useState<ClassesResponse['classes']>([]);
  const [classFilter, setClassFilter] = useState('all');
  const [error, setError] = useState<unknown>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [rewriteAll, setRewriteAll] = useState(false);
  /** Đang chờ "Tính lại cả tháng": giờ tính cũ của từng bản tạm tính lúc bấm */
  const [recalc, setRecalc] = useState<{ month: string; startedAt: number; before: Map<string, string | null> } | null>(null);
  const pollRef = useRef<number | null>(null);

  const load = () => adminApi.reports(month).then((r) => { setData(r); return r; }, (e) => { setError(e); return null; });
  useEffect(() => {
    setData(null);
    setOpenId(null);
    load();
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tự tải lại mỗi 20 giây cho tới khi mọi bản tạm tính có giờ tính mới hơn lúc bấm (tối đa 5 phút).
  // So với giờ tính CŨ của từng em (không so với đồng hồ máy) để khỏi lệch giờ giữa máy và server.
  useEffect(() => {
    if (!recalc) return;
    const tick = async () => {
      const r = await adminApi.reports(recalc.month).catch(() => null);
      if (!r) return;
      if (recalc.month === month) setData(r);
      const drafts = r.reports.filter((x) => x.status !== 'final' && recalc.before.has(x.id));
      const done = drafts.every((x) => x.computedAt && x.computedAt !== recalc.before.get(x.id) && (!recalc.before.get(x.id) || x.computedAt > recalc.before.get(x.id)!));
      if (done) {
        setRecalc(null);
        setNotice(`Đã tính lại xong số liệu ${monthLabel(recalc.month).toLowerCase()} ✓`);
      } else if (Date.now() - recalc.startedAt > POLL_MAX_MS) {
        setRecalc(null);
        const n = drafts.filter((x) => x.computedAt === recalc.before.get(x.id)).length;
        setNotice(`Sau 5 phút vẫn còn ${n} em chưa cập nhật. Bấm "Tải lại" sau ít phút, hoặc tính lại riêng từng em.`);
      }
    };
    pollRef.current = window.setInterval(tick, POLL_MS);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [recalc]); // eslint-disable-line react-hooks/exhaustive-deps

  const recomputeAll = async () => {
    if (!data) return;
    if (rewriteAll && !confirm(REWRITE_CONFIRM)) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.recomputeMonth(month, rewriteAll);
      const before = new Map(data.reports.filter((r) => r.status !== 'final').map((r) => [r.id, r.computedAt] as const));
      setRecalc({ month, startedAt: Date.now(), before });
      setNotice('');
      setRewriteAll(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    adminApi.classes().then((r) => setClasses(r.classes), () => undefined);
  }, []);

  const className = new Map(classes.map((c) => [c.id, c.name]));
  const rows = useMemo(
    () => (data?.reports ?? []).filter((r) => classFilter === 'all' || (classFilter === 'none' ? !r.classId : r.classId === classFilter)),
    [data, classFilter],
  );
  const finalCount = rows.filter((r) => r.status === 'final').length;
  const draftCount = (data?.reports ?? []).filter((r) => r.status !== 'final').length;
  const latestComputed = (data?.reports ?? []).reduce<string | null>((m, r) => (r.computedAt && (!m || r.computedAt > m) ? r.computedAt : m), null);
  const unknownComputed = (data?.reports ?? []).filter((r) => r.status !== 'final' && !r.computedAt).length;
  const open = data?.reports.find((r) => r.id === openId) ?? null;

  const runJob = async (final: boolean) => {
    if (final && !confirm(`Chốt báo cáo ${monthLabel(month).toLowerCase()} cho tất cả học sinh?\n\nPhụ huynh sẽ thấy bản đã chốt và nhận xét. Hãy chắc chắn đã sửa xong nhận xét.`)) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.runMonthly(month, final);
      setNotice(`Đang ${final ? 'chốt' : 'tạo bản tạm tính'}… Tải lại sau khoảng 1 phút.`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Báo cáo tháng"
        sub="Tự động: 07:05 sáng ngày 1 tạo bản tạm tính, 07:05 sáng ngày 8 tự chốt. Thầy có 1 tuần để sửa nhận xét."
        actions={
          <>
            {data && !data.reports.length && <Button variant="secondary" disabled={busy} onClick={() => runJob(false)}>Tạo bản tạm tính ngay</Button>}
            <Button disabled={busy || !draftCount || !!recalc} onClick={() => runJob(true)}>Chốt cả tháng</Button>
          </>
        }
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="secondary" aria-label="Tháng trước" onClick={() => setMonth(shiftMonth(month, -1))}>‹</Button>
            <span className="min-w-32 text-center font-semibold text-slate-900">{monthLabel(month)}</span>
            <Button variant="secondary" aria-label="Tháng sau" onClick={() => setMonth(shiftMonth(month, 1))}>›</Button>
          </div>
          <select className={selectCls} value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Lọc theo lớp">
            <option value="all">Tất cả lớp</option>
            {classes.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="none">Chưa xếp lớp</option>
          </select>
          {data && rows.length > 0 && <span className="text-sm text-slate-500">{rows.length} học sinh · {finalCount} đã chốt</span>}
          <Button variant="ghost" className="ml-auto" onClick={load}>Tải lại</Button>
        </div>

        {data && draftCount > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
            <div className="min-w-0 text-sm">
              <p className="font-medium text-slate-800">{latestComputed ? computedLine(latestComputed) : computedLine(null)}</p>
              <p className="text-xs text-slate-500">
                {draftCount} bản tạm tính{unknownComputed ? ` · ${unknownComputed} bản chưa rõ giờ tính (bản cũ)` : ''}. Bản đã chốt không tính lại.
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <RewriteAiBox checked={rewriteAll} onChange={setRewriteAll} disabled={busy || !!recalc} />
              <Button variant="secondary" disabled={busy || !!recalc} onClick={recomputeAll}>
                {recalc ? 'Đang tính lại…' : 'Tính lại số liệu cả tháng'}
              </Button>
            </div>
            {recalc && (
              <p role="status" className="w-full rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
                Đang tính lại… (khoảng 1–3 phút). Trang tự tải lại mỗi 20 giây, không cần bấm gì.
              </p>
            )}
          </div>
        )}

        <ErrorBox error={error} />
        {notice && <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-200">{notice}</p>}

        <div className={`grid gap-4 ${open ? 'lg:grid-cols-[1fr_400px]' : ''}`}>
          <Card className="min-w-0 p-0 sm:p-0">
            {!data ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Đang tải…</p>
            ) : data.reports.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm text-slate-600">{monthLabel(month)} chưa có báo cáo nào.</p>
                <Button className="mt-3" disabled={busy} onClick={() => runJob(false)}>Tạo bản tạm tính</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className={`w-full text-left text-sm ${open ? 'min-w-[560px]' : 'min-w-[720px]'}`}>
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Mã</th>
                      <th className="px-2 py-2 font-medium">Tên</th>
                      {!open && <th className="px-2 py-2 font-medium">Lớp</th>}
                      <th className="px-2 py-2 font-medium">Trạng thái</th>
                      <th className="px-2 py-2 text-right font-medium">Chuyên cần</th>
                      <th className="px-2 py-2 text-right font-medium">Đã nộp</th>
                      <th className="px-2 py-2 text-right font-medium">Đã thuộc</th>
                      <th className="px-4 py-2 text-right font-medium">Đúng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={r.id} onClick={() => setOpenId(r.id)} className={`cursor-pointer hover:bg-slate-50 ${openId === r.id ? 'bg-teal-50/60' : ''}`}>
                        <td className="px-4 py-2 font-mono text-xs text-slate-500">{r.code}</td>
                        <td className="px-2 py-2 font-medium text-slate-900">{r.name}</td>
                        {!open && <td className="px-2 py-2 text-slate-600">{r.classId ? className.get(r.classId) ?? '—' : '—'}</td>}
                        <td className="px-2 py-2">{r.status === 'final' ? <Badge tone="teal">Đã chốt</Badge> : <Badge tone="amber">Tạm tính</Badge>}</td>
                        <td className={`px-2 py-2 text-right font-medium ${pctTone(r.stats.attendance_pct)}`}>{Math.round(r.stats.attendance_pct)}%</td>
                        <td className="px-2 py-2 text-right text-slate-700">{r.stats.submitted}/{r.stats.total}</td>
                        <td className="px-2 py-2 text-right text-slate-700">{r.stats.words_passed}/{r.stats.words_assigned}</td>
                        <td className="px-4 py-2 text-right text-slate-700">{Math.round(r.stats.accuracy_pct)}%</td>
                      </tr>
                    ))}
                    {!rows.length && (
                      <tr><td colSpan={open ? 7 : 8} className="px-4 py-8 text-center text-slate-500">Không có học sinh nào ở lớp này.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {open && <ReportPanel key={open.id} report={open} month={month} className={open.classId ? className.get(open.classId) : undefined} onClose={() => setOpenId(null)} onSaved={load} />}
        </div>
      </div>
    </>
  );
}

function pctTone(p: number) {
  if (p >= 95) return 'text-teal-700';
  if (p >= 50) return 'text-amber-700';
  return 'text-red-700';
}

function ReportPanel({ report: r, month, className, onClose, onSaved }: { report: Report; month: string; className?: string; onClose: () => void; onSaved: () => void }) {
  const [rewrite, setRewrite] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [ai, setAi] = useState(r.aiComment ?? '');
  const [teacher, setTeacher] = useState(r.teacherComment ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [flash, setFlash] = useState('');
  const dirty = ai !== (r.aiComment ?? '') || teacher !== (r.teacherComment ?? '');
  const st = r.stats;

  const say = (t: string) => {
    setFlash(t);
    setTimeout(() => setFlash(''), 2500);
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await adminApi.updateReport(r.id, { ai_comment: ai, teacher_comment: teacher });
      say('Đã lưu ✓');
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (!confirm(`Chốt báo cáo của ${r.name}? Phụ huynh sẽ thấy ngay nhận xét.`)) return;
    setBusy(true);
    setErr(null);
    try {
      if (dirty) await adminApi.updateReport(r.id, { ai_comment: ai, teacher_comment: teacher });
      await adminApi.finalizeReport(r.id);
      say('Đã chốt ✓');
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const recompute = async () => {
    if (rewrite && !confirm(REWRITE_CONFIRM)) return;
    setBusy(true);
    setRecomputing(true);
    setErr(null);
    try {
      // còn sửa dở thì lưu trước, để không mất chữ của thầy
      if (dirty) await adminApi.updateReport(r.id, { ai_comment: ai, teacher_comment: teacher });
      const res = await adminApi.recomputeReport(r.id, rewrite);
      setAi(res.report.aiComment ?? '');
      setTeacher(res.report.teacherComment ?? '');
      setRewrite(false);
      say(`Đã tính lại ✓${rewrite ? ' (nhận xét AI mới)' : ''}`);
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
      setRecomputing(false);
    }
  };

  const copy = async (text: string, label: string) => say((await copyText(text)) ? `Đã copy ${label} ✓` : 'Trình duyệt chặn copy — chọn và copy tay');

  return (
    <Card className="h-fit lg:sticky lg:top-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-slate-500">{r.code}{className ? ` · ${className}` : ''}</p>
          <h2 className="text-lg font-semibold text-slate-900">{r.name}</h2>
          <p className="mt-0.5">{r.status === 'final' ? <Badge tone="teal">Đã chốt</Badge> : <Badge tone="amber">Tạm tính</Badge>}</p>
          <p className="mt-1 text-xs text-slate-500">{computedLine(r.computedAt)}</p>
        </div>
        <Button variant="ghost" onClick={onClose} aria-label="Đóng">✕</Button>
      </div>

      {r.status !== 'final' && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
          <Button variant="secondary" disabled={busy} onClick={recompute}>{recomputing ? 'Đang tính… (5–15 giây)' : 'Tính lại số liệu'}</Button>
          <RewriteAiBox checked={rewrite} onChange={setRewrite} disabled={busy} />
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Stat label="Hoàn thành" value={`${st.submitted}/${st.total} bài`} />
        <Stat label="Chuyên cần" value={`${Math.round(st.attendance_pct)}%`} />
        <Stat label="Đúng hạn" value={`${st.on_time}`} />
        <Stat label="Trễ" value={`${st.late}${st.late ? ` (TB ${st.avg_days_late.toFixed(1)} ngày)` : ''}`} />
        <Stat label="Bỏ / còn nợ" value={`${st.abandoned} / ${st.owing}`} />
        <Stat label="Độ chính xác" value={`${Math.round(st.accuracy_pct)}%`} />
        <Stat label="Từ đã thuộc" value={`${st.words_passed}/${st.words_assigned}`} />
        <Stat label="Đang học" value={`${st.words_learning}`} />
      </dl>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Nhận xét AI (nháp)
        <textarea rows={5} className={`${inputCls} mt-1`} value={ai} onChange={(e) => setAi(e.target.value)} placeholder="Chưa có nhận xét AI" />
      </label>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        Nhận xét của giáo viên
        <textarea rows={4} className={`${inputCls} mt-1`} value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="Viết thêm vài câu riêng cho em này (tuỳ chọn)" />
      </label>

      <div className="mt-3"><ErrorBox error={err} /></div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy || !dirty}>Lưu</Button>
        {r.status !== 'final' && <Button variant="secondary" onClick={finalize} disabled={busy}>Chốt em này</Button>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <Button variant="secondary" onClick={() => copy(r.link, 'link')}>Copy link phụ huynh</Button>
        <Button variant="secondary" onClick={() => copy(zaloMessage(r, month), 'tin nhắn')}>Copy tin nhắn Zalo</Button>
        <a href={r.link} target="_blank" rel="noreferrer" className="self-center text-sm text-teal-700 hover:underline">Xem trang phụ huynh ↗</a>
      </div>
      {flash && <p className="mt-2 text-sm text-teal-700">{flash}</p>}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
