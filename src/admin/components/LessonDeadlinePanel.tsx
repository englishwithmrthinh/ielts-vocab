/**
 * Hạn nộp của một bộ từ: mốc hạn, trạng thái, đếm học sinh, nút Gia hạn (cả mốc / riêng từng em).
 * Dùng ở trang Bộ từ (mở rộng dưới dòng) và trang chi tiết bộ từ. API: /api/admin/lessons/deadline (Sếp).
 */
import { useEffect, useMemo, useState } from 'react';
import { adminApi, type LessonDeadline, type LessonDeadlineStudent } from '../lib/adminApi';
import { Badge, Button, ErrorBox, inputCls, selectCls } from '../ui';

const ST: Record<LessonDeadlineStudent['status'], { label: string; tone: 'slate' | 'amber' | 'blue' | 'teal' | 'red' }> = {
  submitted: { label: 'Đã nộp', tone: 'teal' },
  doing: { label: 'Đang làm', tone: 'blue' },
  not_started: { label: 'Chưa làm', tone: 'slate' },
  owing: { label: 'Đang nợ', tone: 'red' },
  abandoned: { label: 'Bỏ bài', tone: 'red' },
  off: { label: 'Nghỉ', tone: 'slate' },
};

/** ISO → { d: 'Thứ 6 06/11', hm: '23:59', local: 'YYYY-MM-DDTHH:mm' } theo giờ VN */
function vn(iso: string) {
  const s = new Date(Date.parse(iso) + 7 * 3600_000).toISOString();
  const wd = new Date(`${s.slice(0, 10)}T00:00:00Z`).getUTCDay();
  const day = wd === 0 ? 'CN' : `Thứ ${wd + 1}`;
  return { d: `${day} ${s.slice(8, 10)}/${s.slice(5, 7)}`, hm: s.slice(11, 16), local: s.slice(0, 16) };
}

/** Gợi ý hạn mới: 23:59 của (hôm nay hoặc hạn cũ, cái nào muộn hơn) + 2 ngày */
function suggest(deadlineIso: string): string {
  const base = Math.max(Date.now(), Date.parse(deadlineIso));
  return `${vn(new Date(base + 2 * 86400_000).toISOString()).local.slice(0, 10)}T23:59`;
}

export function LessonDeadlinePanel({ lessonId, onChanged }: { lessonId: string; onChanged?: () => void }) {
  const [data, setData] = useState<LessonDeadline | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [when, setWhen] = useState('');
  const [cls, setCls] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());

  const load = () =>
    adminApi.lessonDeadline(lessonId).then((d) => {
      setData(d);
      if (d.milestone) setWhen((w) => w || suggest(d.milestone!.deadline_at));
      // Mặc định chọn các em chưa nộp
      setSel(new Set(d.students.filter((s) => s.status !== 'submitted' && s.status !== 'off').map((s) => s.id)));
    }, setError);
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lessonId]);

  const classes = useMemo(() => [...new Set((data?.students ?? []).map((s) => s.class_name))].sort((a, b) => a.localeCompare(b, 'vi')), [data]);
  const shown = (data?.students ?? []).filter((s) => !cls || s.class_name === cls);
  const pick = shown.filter((s) => sel.has(s.id));

  if (error && !data) return <ErrorBox error={error} />;
  if (!data) return <p className="text-sm text-slate-500">Đang tải hạn nộp…</p>;
  const m = data.milestone;
  if (!m) {
    return (
      <p className="text-sm text-slate-600">
        {data.lesson.status === 'published' ? 'Bộ từ này chưa có mốc hạn. Bấm “Sửa” để chọn mốc làm lần đầu.' : 'Chưa phát hành, chưa có hạn nộp. Chọn mốc khi bấm Phát hành.'}
      </p>
    );
  }
  const dl = vn(m.deadline_at);
  const c = data.counts;

  const run = async (scope: 'all' | 'students') => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) { setError(new Error('Chọn ngày giờ hạn mới')); return; }
    const nv = vn(new Date(Date.parse(`${when}:59+07:00`)).toISOString());
    if (scope === 'all' && !confirm(
      `Đổi hạn CẢ MỐC ${vn(`${m.date}T05:00:00Z`).d} thành ${nv.d} ${nv.hm}?\n\n` +
      'Áp dụng cho MỌI học sinh ở MỌI lớp có bài mốc này (kể cả lớp không học bộ từ này). Bài đã nộp giữ nguyên điểm.',
    )) return;
    if (scope === 'students' && !pick.length) { setError(new Error('Tick ít nhất một em')); return; }
    setBusy(true); setError(null); setMsg(null);
    try {
      const r = await adminApi.extendLesson(lessonId, when, scope, pick.map((s) => s.id));
      setMsg(scope === 'all' ? `Đã đổi hạn cả mốc thành ${nv.d} ${nv.hm}.` : `Đã gia hạn riêng cho ${r.count} em tới ${nv.d} ${nv.hm}.`);
      await load(); onChanged?.();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const clear = async (s: LessonDeadlineStudent) => {
    setBusy(true); setError(null); setMsg(null);
    try { await adminApi.clearExtension(lessonId, [s.id]); setMsg(`Đã bỏ hạn riêng của ${s.name}.`); await load(); onChanged?.(); }
    catch (e) { setError(e); } finally { setBusy(false); }
  };
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = shown.length > 0 && shown.every((s) => sel.has(s.id));

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-600">Mốc hạn:</span>
        <span className="font-semibold text-slate-900">
          {vn(`${m.date}T05:00:00Z`).d}
          {vn(m.deadline_at).local.slice(0, 10) === m.date ? ` · hạn ${dl.hm}` : ` · hạn đã dời tới ${dl.d} ${dl.hm}`}
        </span>
        {data.state === 'overdue' && <Badge tone="red">Đã quá hạn {data.daysOverdue} ngày</Badge>}
        {data.state === 'open' && <Badge tone="teal">Còn hạn</Badge>}
        {data.state === 'locked' && <Badge tone="slate">Chưa mở (mở {vn(m.opens_at).d})</Badge>}
        {data.state === 'off' && <Badge tone="amber">Mốc nghỉ</Badge>}
        {data.inferred && <span className="text-xs text-slate-500">(bộ cũ chưa đặt mốc, lấy theo bài sớm nhất có từ của bộ)</span>}
      </div>
      <p className="text-slate-700">
        <b>{c.submitted}</b> đã nộp · <b>{c.doing}</b> đang làm · <b>{c.notStarted}</b> chưa làm ·{' '}
        <b className={c.owing ? 'text-red-700' : ''}>{c.owing}</b> đang nợ{c.abandoned ? <> · <b className="text-red-700">{c.abandoned}</b> bỏ bài</> : null}
        <span className="text-slate-400"> / {c.total} học sinh</span>
      </p>
      {data.spillCount > 0 && (
        <p className="text-xs text-amber-800">{data.spillCount} em có từ của bộ này dư sang bài sau (bài quá 40 câu). Phần dư theo hạn của bài sau.</p>
      )}

      <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
        <p className="mb-2 font-medium text-slate-800">Gia hạn</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-xs text-slate-500">Hạn mới (giờ Việt Nam)</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls.replace('w-full', 'w-auto')} />
          </label>
          <Button onClick={() => run('students')} disabled={busy || !data.extensionsReady || !pick.length}>
            Gia hạn riêng {pick.length} em đã tick
          </Button>
          <Button variant="secondary" onClick={() => run('all')} disabled={busy}>Gia hạn cả mốc (mọi lớp)</Button>
        </div>
        {!data.extensionsReady && <p className="mt-1 text-xs text-amber-800">Gia hạn riêng cần chạy file SQL 005 trong Supabase trước. Hiện chỉ gia hạn cả mốc được.</p>}
        <p className="mt-1 text-xs text-slate-500">Gia hạn xong, bài đang nợ trở lại “đang mở”; nộp trước hạn mới được 100%. Bài đã nộp giữ nguyên điểm.</p>
      </div>
      {msg && <p className="rounded-lg bg-teal-50 px-3 py-2 text-teal-900 ring-1 ring-teal-200">{msg}</p>}
      <ErrorBox error={error} />

      {data.students.length > 0 && (
        <div className="overflow-x-auto rounded-lg bg-white ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-3 py-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={allOn} onChange={() => setSel((p) => { const n = new Set(p); shown.forEach((s) => (allOn ? n.delete(s.id) : n.add(s.id))); return n; })} />
              <span>Chọn tất cả</span>
            </label>
            <button type="button" className="text-xs text-teal-800 underline" onClick={() => setSel(new Set(shown.filter((s) => s.status === 'owing' || s.status === 'abandoned').map((s) => s.id)))}>Chỉ em đang nợ</button>
            {classes.length > 1 && (
              <select value={cls} onChange={(e) => setCls(e.target.value)} className={selectCls}>
                <option value="">Mọi lớp</option>
                {classes.map((x) => <option key={x} value={x}>{x || 'Chưa xếp lớp'}</option>)}
              </select>
            )}
          </div>
          <table className="w-full text-left">
            <thead className="text-xs text-slate-500">
              <tr><th className="w-8 px-3 py-1.5" /><th className="px-2 py-1.5">Học sinh</th><th className="px-2 py-1.5">Lớp</th><th className="px-2 py-1.5">Trạng thái</th><th className="px-2 py-1.5">Tiến độ</th><th className="px-2 py-1.5">Hạn của em</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((s) => {
                const h = vn(s.deadline_at);
                return (
                  <tr key={s.id} className={s.active ? '' : 'opacity-50'}>
                    <td className="px-3 py-1.5"><input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Chọn ${s.name}`} /></td>
                    <td className="px-2 py-1.5"><span className="font-medium text-slate-900">{s.name}</span> <span className="text-xs text-slate-400">{s.code}</span></td>
                    <td className="px-2 py-1.5 text-slate-600">{s.class_name || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <Badge tone={ST[s.status].tone}>{s.status === 'owing' && s.days_late ? `Nợ · trễ ${s.days_late} ngày` : ST[s.status].label}</Badge>
                      {s.spill && <span className="ml-1 text-xs text-amber-700" title="Có từ của bộ này dư sang bài sau">+dư</span>}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">
                      {s.status === 'submitted' ? `${s.score_pct ?? ''}%${s.days_late ? ` (trễ ${s.days_late} ngày)` : ''}` : s.required ? `${s.answered}/${s.required} câu` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">
                      {h.d} {h.hm}
                      {s.extended_to && (
                        <>
                          {' '}<Badge tone="amber">riêng</Badge>{' '}
                          <button type="button" disabled={busy} onClick={() => clear(s)} className="text-xs text-slate-500 underline">bỏ</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
