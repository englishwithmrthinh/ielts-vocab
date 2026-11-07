/** Danh sách bộ từ (DB: lessons). Bấm vào để tạo audio, tải ảnh, Duyệt, Phát hành. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type LessonSummary } from '../lib/adminApi';
import { Badge, Button, Card, ErrorBox, PageHeader } from '../ui';
import { MilestonePicker, vnDeadline } from '../components/MilestonePicker';

const STATUS: Record<LessonSummary['status'], { label: string; tone: 'slate' | 'amber' | 'blue' | 'teal' }> = {
  draft: { label: 'Nháp', tone: 'slate' },
  processing: { label: 'Đang tạo media', tone: 'amber' },
  review: { label: 'Chờ duyệt', tone: 'blue' },
  published: { label: 'Đã phát hành', tone: 'teal' },
};

function fmtDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [mid, setMid] = useState<string | null>(null);
  const startEdit = (l: LessonSummary) => { setEditId(l.id); setTitle(l.title ?? ''); setMid(null); };
  const save = async (l: LessonSummary) => {
    setBusy(true); setError(null);
    try {
      const r = await adminApi.updateLesson(l.id, { title, ...(mid && mid !== l.due_milestone_id ? { milestone_id: mid } : {}) });
      if (mid && mid !== l.due_milestone_id && l.status === 'published') alert(`Đã dời ${r.moved} lượt từ chưa làm sang mốc mới.`);
      setEditId(null); await reload();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const reload = () => adminApi.lessons().then((r) => setLessons(r.lessons), setError);
  const remove = async (l: LessonSummary) => {
    const typed = prompt(
      `XOÁ "Bộ từ ${l.number}" (${l.word_count} từ, đã giao ${l.student_count} học sinh)?\n\n` +
      'Các từ chỉ có trong bộ này sẽ bị gỡ khỏi kho từ và khỏi các bài CHƯA nộp của học sinh. Bài đã nộp, điểm, XP giữ nguyên. Không khôi phục được.\n\nGõ chữ XOA để xác nhận:',
    );
    if (typed?.trim().toUpperCase() !== 'XOA') return;
    setBusy(true); setError(null);
    try { await adminApi.deleteLesson(l.id); await reload(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  useEffect(() => {
    adminApi.lessons().then((r) => setLessons(r.lessons), setError);
  }, []);

  return (
    <>
      <PageHeader
        title="Bộ từ"
        sub="Mỗi bộ từ là một lô từ được giao. Học sinh vẫn làm 3 bài/tuần; từ mới tự vào bài kế tiếp."
        actions={<Link to="/admin/them-bo-tu"><Button>+ Thêm bộ từ</Button></Link>}
      />
      <ErrorBox error={error} />
      <Card className="p-0 sm:p-0">
        {!lessons ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Đang tải…</p>
        ) : lessons.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Chưa có bộ từ nào. Bấm “Thêm bộ từ” để dán bộ từ đầu tiên.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lessons.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center">
                <Link to={`/admin/bo-tu/${l.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-sm hover:bg-slate-50">
                <span className="font-semibold text-slate-900">{l.title || `Bộ từ ${l.number}`}</span>
                {l.title && <span className="text-xs text-slate-400">(số {l.number})</span>}
                {l.due && <><span className="text-slate-400">·</span><span className="font-medium text-teal-800">Hạn {vnDeadline(l.due.deadline_at)}</span></>}
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">{l.word_count} từ</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">thêm {fmtDate(l.taught_on)}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">
                  Giao cho: {l.class_names?.length ? l.class_names.join(', ') : l.student_count ? '' : 'chưa ai'}
                  {l.unassigned_count ? `${l.class_names?.length ? ' + ' : ''}${l.unassigned_count} bạn chưa xếp lớp` : ''}
                  <span className="text-slate-400"> ({l.student_count} học sinh)</span>
                </span>
                <span className="ml-auto"><Badge tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Badge></span>
                </Link>
                <Button variant="ghost" disabled={busy} onClick={() => (editId === l.id ? setEditId(null) : startEdit(l))}>Sửa</Button>
                <Button variant="ghost" disabled={busy} onClick={() => remove(l)} aria-label={`Xoá bộ từ ${l.number}`}>
                  <span className="text-red-700">Xoá</span>
                </Button>
                {editId === l.id && (
                  <div className="w-full space-y-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
                    <label className="block text-sm">
                      <span className="font-medium text-slate-800">Tên bộ từ</span>
                      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Bộ từ ${l.number}`} maxLength={80}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <div>
                      <p className="mb-2 text-sm font-medium text-slate-800">Hạn làm lần đầu {l.due ? `(đang: ${vnDeadline(l.due.deadline_at)})` : ''}</p>
                      <MilestonePicker value={mid ?? l.due_milestone_id ?? null} onChange={setMid} />
                      {l.status === 'published' && <p className="mt-1 text-xs text-slate-500">Đổi hạn: chỉ những từ học sinh CHƯA làm lần nào được dời sang mốc mới; từ đã làm giữ lịch ôn.</p>}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setEditId(null)} disabled={busy}>Huỷ</Button>
                      <Button onClick={() => save(l)} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
