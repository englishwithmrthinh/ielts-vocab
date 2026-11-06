import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Student } from '@shared/types';
import { adminApi, type StudentCard } from '../lib/adminApi';
import { setPrintCards } from '../lib/printStore';
import { Badge, Button, Card, ErrorBox, PageHeader, inputCls } from '../ui';

export default function StudentsPage() {
  const nav = useNavigate();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [adding, setAdding] = useState(false);
  const [namesText, setNamesText] = useState('');
  const [busy, setBusy] = useState(false);
  const [justCreated, setJustCreated] = useState<StudentCard[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showLocked, setShowLocked] = useState(false);

  const load = () => adminApi.students().then((r) => setStudents(r.students), setError);
  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => (students ?? []).filter((s) => showLocked || s.active), [students, showLocked]);
  const activeCount = (students ?? []).filter((s) => s.active).length;
  const lockedCount = (students ?? []).length - activeCount;
  const names = namesText.split('\n').map((n) => n.trim()).filter(Boolean);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const add = () =>
    run(async () => {
      const { created } = await adminApi.addStudents(names);
      setJustCreated(created);
      setNamesText('');
      setAdding(false);
      await load();
    });

  const saveName = (s: Student) =>
    run(async () => {
      const name = editName.trim();
      if (name && name !== s.name) await adminApi.updateStudent(s.id, { name });
      setEditId(null);
      await load();
    });

  const toggleActive = (s: Student) =>
    run(async () => {
      if (s.active && !confirm(`Khoá ${s.name} (${s.code})? Học sinh sẽ không đăng nhập được, dữ liệu vẫn giữ nguyên.`)) return;
      await adminApi.updateStudent(s.id, { active: !s.active });
      await load();
    });

  const printCards = (ids: string[]) => {
    if (!ids.length) return;
    const msg =
      `Cấp PIN mới cho ${ids.length} học sinh để in thẻ?\n\n` +
      'PIN cũ sẽ hết hiệu lực ngay. Học sinh dùng PIN trên thẻ mới để đăng nhập.';
    if (!confirm(msg)) return;
    run(async () => {
      const { cards } = await adminApi.resetPins(ids);
      setPrintCards(cards);
      nav('/admin/in-the');
    });
  };

  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.id));

  return (
    <>
      <PageHeader
        title="Học sinh"
        sub={students ? `${activeCount} đang học${lockedCount ? ` · ${lockedCount} đã khoá` : ''}` : undefined}
        actions={
          <>
            <Button variant="secondary" disabled={busy || !activeCount} onClick={() => printCards((students ?? []).filter((s) => s.active).map((s) => s.id))}>
              In thẻ cả lớp
            </Button>
            <Button onClick={() => setAdding(true)} disabled={adding}>+ Thêm học sinh</Button>
          </>
        }
      />
      <div className="space-y-4">
        <ErrorBox error={error} />

        {justCreated.length > 0 && (
          <Card className="bg-teal-50/60 ring-teal-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-teal-900">Đã thêm {justCreated.length} học sinh</h2>
                <p className="mt-1 text-sm text-teal-900/80">PIN chỉ hiện một lần. In thẻ ngay, hoặc chép lại trước khi rời trang.</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => { setPrintCards(justCreated); nav('/admin/in-the'); }}>In thẻ các bạn này</Button>
                <Button variant="ghost" onClick={() => setJustCreated([])}>Đóng</Button>
              </div>
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {justCreated.map((c) => (
                <li key={c.id} className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-teal-200">
                  <span className="font-medium">{c.name}</span>
                  <span className="mt-0.5 block font-mono text-slate-600">{c.code} · PIN {c.pin}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {adding && (
          <Card>
            <h2 className="font-semibold text-slate-900">Thêm học sinh</h2>
            <p className="mt-1 text-sm text-slate-500">Mỗi dòng một tên. Mã (HS..) và PIN 4 số được tạo tự động.</p>
            <textarea
              autoFocus
              rows={5}
              className={`${inputCls} mt-3 font-normal`}
              placeholder={'Nguyễn Minh Anh\nTrần Gia Bảo'}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <Button onClick={add} disabled={busy || !names.length}>{busy ? 'Đang thêm…' : `Thêm ${names.length || ''} học sinh`}</Button>
              <Button variant="ghost" onClick={() => { setAdding(false); setNamesText(''); }}>Huỷ</Button>
            </div>
          </Card>
        )}

        <Card className="p-0 sm:p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((s) => s.id)))} />
              Chọn tất cả
            </label>
            <div className="flex items-center gap-3">
              {lockedCount > 0 && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} />
                  Hiện bạn đã khoá
                </label>
              )}
              <Button variant="secondary" disabled={busy || !selected.size} onClick={() => printCards([...selected])}>
                In thẻ ({selected.size})
              </Button>
            </div>
          </div>
          {!students ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Đang tải…</p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Chưa có học sinh. Bấm “Thêm học sinh” để bắt đầu.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((s) => (
                <li key={s.id} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${s.active ? '' : 'bg-slate-50 text-slate-400'}`}>
                  <input type="checkbox" aria-label={`Chọn ${s.name}`} checked={selected.has(s.id)} onChange={() => toggleSel(s.id)} />
                  <span className="w-12 font-mono text-sm text-slate-500">{s.code}</span>
                  <div className="min-w-[9rem] flex-1">
                    {editId === s.id ? (
                      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); saveName(s); }}>
                        <input autoFocus className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} />
                        <Button type="submit" disabled={busy}>Lưu</Button>
                        <Button variant="ghost" onClick={() => setEditId(null)}>Huỷ</Button>
                      </form>
                    ) : (
                      <span className="font-medium">{s.name}</span>
                    )}
                  </div>
                  {!s.active && <Badge>Đã khoá</Badge>}
                  {editId !== s.id && (
                    <div className="ml-auto flex gap-1">
                      <Button variant="ghost" onClick={() => { setEditId(s.id); setEditName(s.name); }}>Sửa tên</Button>
                      <Button variant={s.active ? 'ghost' : 'secondary'} disabled={busy} onClick={() => toggleActive(s)}>
                        {s.active ? 'Khoá' : 'Mở khoá'}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
