/** Danh sách bộ từ (DB: lessons): bảng gọn, tìm + lọc phía trình duyệt, nhóm theo tháng, 20 bộ gần nhất + "Xem thêm". */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ClassesResponse } from '@shared/types';
import { adminApi, type LessonSummary } from '../lib/adminApi';
import { overdueDays, vnDue } from '../lib/vnTime';
import { Badge, Button, Card, ErrorBox, PageHeader, inputCls, selectCls } from '../ui';
import { MilestonePicker, vnDeadline } from '../components/MilestonePicker';
import { LessonDeadlinePanel } from '../components/LessonDeadlinePanel';

const STATUS: Record<LessonSummary['status'], { label: string; tone: 'slate' | 'amber' | 'blue' | 'teal' }> = {
  draft: { label: 'Nháp', tone: 'slate' },
  processing: { label: 'Đang tạo media', tone: 'amber' },
  review: { label: 'Chờ duyệt', tone: 'blue' },
  published: { label: 'Đã phát hành', tone: 'teal' },
};

type StatusFilter = 'all' | 'draft' | 'review' | 'published' | 'overdue';
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'draft', label: 'Nháp' },
  { id: 'review', label: 'Chờ duyệt' },
  { id: 'published', label: 'Đã phát hành' },
  { id: 'overdue', label: 'Quá hạn' },
];

const PAGE = 20;

function fmtDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
const monthTitle = (d: string) => `Tháng ${Number(d.slice(5, 7))}/${d.slice(0, 4)}`;
/** Bỏ dấu + chữ thường để tìm "giao duc" ra "Giáo dục" */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();

function matchStatus(l: LessonSummary, f: StatusFilter): boolean {
  if (f === 'all') return true;
  if (f === 'draft') return l.status === 'draft' || l.status === 'processing';
  if (f === 'overdue') return !!l.overdue;
  return l.status === f;
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [classes, setClasses] = useState<ClassesResponse['classes']>([]);
  const [error, setError] = useState<unknown>(null);

  const [q, setQ] = useState('');
  const [classF, setClassF] = useState('all'); // all | none | <class id>
  const [statusF, setStatusF] = useState<StatusFilter>('all');
  const [limit, setLimit] = useState(PAGE);

  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [dlId, setDlId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [mid, setMid] = useState<string | null>(null);

  const reload = () => adminApi.lessons().then((r) => setLessons(r.lessons), setError);
  useEffect(() => {
    reload();
    adminApi.classes().then((r) => setClasses(r.classes), () => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = (l: LessonSummary) => { setDlId(null); setEditId(l.id); setTitle(l.title ?? ''); setMid(null); };
  const save = async (l: LessonSummary) => {
    setBusy(true); setError(null);
    try {
      const r = await adminApi.updateLesson(l.id, { title, ...(mid && mid !== l.due_milestone_id ? { milestone_id: mid } : {}) });
      if (mid && mid !== l.due_milestone_id && l.status === 'published') alert(`Đã dời ${r.moved} lượt từ chưa làm sang mốc mới.`);
      setEditId(null); await reload();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const remove = async (l: LessonSummary) => {
    const typed = prompt(
      `XOÁ "Bộ từ ${l.number}" (${l.word_count} từ, đã giao ${l.student_count} học sinh)?\n\n` +
      'Các từ chỉ có trong bộ này sẽ bị gỡ khỏi kho từ và khỏi các bài CHƯA nộp của học sinh. Bài đã nộp, điểm, XP giữ nguyên. Không khôi phục được.\n\nGõ chữ XOA để xác nhận:',
    );
    if (typed?.trim().toUpperCase() !== 'XOA') return;
    setBusy(true); setError(null);
    try { await adminApi.deleteLesson(l.id); await reload(); } catch (e) { setError(e); } finally { setBusy(false); }
  };

  const sorted = useMemo(
    () => [...(lessons ?? [])].sort((a, b) => b.taught_on.localeCompare(a.taught_on) || b.number - a.number),
    [lessons],
  );
  const filtering = q.trim() !== '' || classF !== 'all' || statusF !== 'all';
  const matched = useMemo(() => {
    const needle = fold(q.trim());
    return sorted.filter((l) => {
      if (needle && !(String(l.number) === needle.replace(/^(#|bo tu|bo)\s*/, '') || fold(l.title ?? '').includes(needle))) return false;
      if (classF === 'none' && !(l.unassigned_count && l.unassigned_count > 0)) return false;
      if (classF !== 'all' && classF !== 'none' && !(l.class_ids ?? []).includes(classF)) return false;
      return matchStatus(l, statusF);
    });
  }, [sorted, q, classF, statusF]);
  const shown = filtering ? matched : matched.slice(0, limit);
  const groups = useMemo(() => {
    const out: { key: string; items: LessonSummary[] }[] = [];
    for (const l of shown) {
      const key = l.taught_on.slice(0, 7);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(l);
      else out.push({ key, items: [l] });
    }
    return out;
  }, [shown]);
  const overdueTotal = sorted.filter((l) => l.overdue).length;
  const COLS = 9;

  return (
    <>
      <PageHeader
        title="Bộ từ"
        sub={lessons ? `${lessons.length} bộ${overdueTotal ? ` · ${overdueTotal} bộ còn em nợ bài` : ''}. Học sinh vẫn làm 3 bài/tuần; từ mới tự vào bài kế tiếp.` : 'Mỗi bộ từ là một lô từ được giao.'}
        actions={<Link to="/admin/them-bo-tu"><Button>+ Thêm bộ từ</Button></Link>}
      />
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            className={`${inputCls} sm:w-64`}
            placeholder="Tìm số bộ hoặc tên bộ"
            aria-label="Tìm bộ từ"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className={selectCls} value={classF} onChange={(e) => setClassF(e.target.value)} aria-label="Lọc theo lớp">
            <option value="all">Tất cả lớp</option>
            {classes.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="none">Chưa xếp lớp</option>
          </select>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc trạng thái">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={statusF === f.id}
                onClick={() => setStatusF(f.id)}
                className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${statusF === f.id
                  ? f.id === 'overdue' ? 'bg-red-700 text-white ring-red-700' : 'bg-teal-700 text-white ring-teal-700'
                  : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'}`}
              >
                {f.label}{f.id === 'overdue' && overdueTotal ? ` (${overdueTotal})` : ''}
              </button>
            ))}
          </div>
          {filtering && (
            <span className="text-sm text-slate-500">
              {matched.length} bộ khớp ·{' '}
              <button type="button" className="text-teal-700 hover:underline" onClick={() => { setQ(''); setClassF('all'); setStatusF('all'); }}>Bỏ lọc</button>
            </span>
          )}
        </div>

        <ErrorBox error={error} />

        <Card className="p-0 sm:p-0">
          {!lessons ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Đang tải…</p>
          ) : lessons.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">Chưa có bộ từ nào. Bấm “Thêm bộ từ” để dán bộ từ đầu tiên.</p>
          ) : matched.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">Không có bộ từ nào khớp.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Bộ</th>
                    <th className="px-2 py-2 font-medium">Ngày dạy</th>
                    <th className="px-2 py-2 font-medium">Lớp</th>
                    <th className="px-2 py-2 text-right font-medium">Từ</th>
                    <th className="px-2 py-2 text-right font-medium">HS</th>
                    <th className="px-2 py-2 font-medium">Mốc hạn</th>
                    <th className="px-2 py-2 font-medium">Nộp/Nợ</th>
                    <th className="px-2 py-2 font-medium">Trạng thái</th>
                    <th className="px-4 py-2 text-right font-medium">Thao tác</th>
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g.key} className="divide-y divide-slate-100 border-t border-slate-200">
                    <tr className="bg-slate-50/70">
                      <th colSpan={COLS} scope="colgroup" className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {monthTitle(g.items[0]!.taught_on)} <span className="font-normal normal-case text-slate-400">· {g.items.length} bộ</span>
                      </th>
                    </tr>
                    {g.items.map((l) => {
                      const late = l.due && l.status === 'published' ? overdueDays(l.due.deadline_at) : 0;
                      // "Quá hạn N ngày" chỉ khi còn em nợ (bộ cũ / API cũ chưa có owing_count thì theo hạn chung)
                      const showLate = late > 0 && (l.owing_count === undefined || l.owing_count > 0);
                      const open = dlId === l.id || editId === l.id;
                      return (
                        <Fragment key={l.id}>
                          <tr className={open ? 'bg-teal-50/40' : 'hover:bg-slate-50'}>
                            <td className="px-4 py-2">
                              <Link to={`/admin/bo-tu/${l.id}`} className="group block">
                                <span className="mr-1.5 font-mono text-xs text-slate-500">#{l.number}</span>
                                <span className="font-semibold text-slate-900 group-hover:text-teal-800 group-hover:underline">{l.title || `Bộ từ ${l.number}`}</span>
                              </Link>
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-slate-600">{fmtDate(l.taught_on)}</td>
                            <td className="max-w-[15rem] px-2 py-2 text-xs leading-snug text-slate-600">
                              {l.class_names?.length ? l.class_names.join(', ') : !l.student_count ? <span className="text-slate-400">chưa giao</span> : null}
                              {l.unassigned_count ? <span className="text-amber-700">{l.class_names?.length ? ' + ' : ''}{l.unassigned_count} chưa xếp lớp</span> : null}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums text-slate-700">{l.word_count}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-slate-700">{l.student_count}</td>
                            <td className="whitespace-nowrap px-2 py-2 text-slate-700">{l.due ? vnDue(l.due.deadline_at) : <span className="text-slate-400">—</span>}</td>
                            <td className="whitespace-nowrap px-2 py-2">
                              {l.status === 'published' && l.due && l.submitted_count !== undefined ? (
                                <>
                                  <span className="text-slate-700">{l.submitted_count} nộp</span>
                                  <span className="text-slate-400"> · </span>
                                  <span className={l.owing_count ? 'font-semibold text-red-700' : 'text-slate-500'}>{l.owing_count ?? 0} nợ</span>
                                </>
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex flex-wrap gap-1">
                                <Badge tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Badge>
                                {showLate && <span className="whitespace-nowrap"><Badge tone="red">Quá hạn {late} ngày</Badge></span>}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-2 py-1 text-right">
                              {l.status === 'published' && (
                                <Button variant="ghost" className="px-2" disabled={busy} onClick={() => { setEditId(null); setDlId(dlId === l.id ? null : l.id); }} aria-expanded={dlId === l.id}>
                                  <span className="text-teal-800">Hạn nộp</span>
                                </Button>
                              )}
                              <Button variant="ghost" className="px-2" disabled={busy} onClick={() => (editId === l.id ? setEditId(null) : startEdit(l))} aria-expanded={editId === l.id}>Sửa</Button>
                              <Link to={`/admin/bo-tu/${l.id}`} className="inline-flex rounded-lg px-2 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Mở</Link>
                              <Button variant="ghost" className="px-2" disabled={busy} onClick={() => remove(l)} aria-label={`Xoá bộ từ ${l.number}`}>
                                <span className="text-red-700">Xoá</span>
                              </Button>
                            </td>
                          </tr>
                          {dlId === l.id && (
                            <tr>
                              <td colSpan={COLS} className="bg-slate-50 px-4 py-3">
                                <LessonDeadlinePanel lessonId={l.id} onChanged={reload} />
                              </td>
                            </tr>
                          )}
                          {editId === l.id && (
                            <tr>
                              <td colSpan={COLS} className="space-y-3 bg-slate-50 px-4 py-3">
                                <label className="block max-w-xl text-sm">
                                  <span className="font-medium text-slate-800">Tên bộ từ</span>
                                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Bộ từ ${l.number}`} maxLength={80}
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                                </label>
                                <div>
                                  <p className="mb-2 text-sm font-medium text-slate-800">Hạn làm lần đầu {l.due ? `(đang: ${vnDeadline(l.due.deadline_at)})` : ''}</p>
                                  <MilestonePicker value={mid ?? l.due_milestone_id ?? null} onChange={setMid} autoSelect={false} />
                                  {l.status === 'published' && <p className="mt-1 text-xs text-slate-500">Đổi hạn: chỉ những từ học sinh CHƯA làm lần nào được dời sang mốc mới; từ đã làm giữ lịch ôn.</p>}
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" onClick={() => setEditId(null)} disabled={busy}>Huỷ</Button>
                                  <Button onClick={() => save(l)} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</Button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          )}
          {!filtering && matched.length > shown.length && (
            <div className="border-t border-slate-200 px-4 py-3 text-center">
              <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE)}>
                Xem thêm (còn {matched.length - shown.length} bộ)
              </Button>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
