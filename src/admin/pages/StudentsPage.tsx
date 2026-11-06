import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ClassesResponse, Student } from '@shared/types';
import { adminApi, type StudentCard } from '../lib/adminApi';
import { setPrintCards } from '../lib/printStore';
import { Badge, Button, Card, ErrorBox, PageHeader, inputCls, selectCls } from '../ui';

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
  const [classes, setClasses] = useState<ClassesResponse['classes']>([]);
  const [params, setParams] = useSearchParams();
  const filter = params.get('lop') ?? 'all'; // all | none | <class id>
  const [moveTo, setMoveTo] = useState('');
  const [addClassId, setAddClassId] = useState('');

  const load = () =>
    Promise.all([adminApi.students(), adminApi.classes()]).then(([s, c]) => {
      setStudents(s.students);
      setClasses(c.classes);
    }, setError);
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    setSelected(new Set());
    setAddClassId(filter !== 'all' && filter !== 'none' ? filter : '');
  }, [filter]);

  const className = new Map(classes.map((c) => [c.id, c.name]));
  const openClasses = classes.filter((c) => c.active);
  const inFilter = (s: Student) => (filter === 'all' ? true : filter === 'none' ? !s.class_id : s.class_id === filter);
  const scoped = useMemo(() => (students ?? []).filter(inFilter), [students, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = useMemo(() => scoped.filter((s) => showLocked || s.active), [scoped, showLocked]);
  const activeCount = scoped.filter((s) => s.active).length;
  const lockedCount = scoped.length - activeCount;
  const unassignedCount = (students ?? []).filter((s) => s.active && !s.class_id).length;
  const filterLabel = filter === 'all' ? '' : filter === 'none' ? 'chưa xếp lớp' : `lớp ${className.get(filter) ?? ''}`;
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
      const { created } = await adminApi.addStudents(names, addClassId || null);
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

  const setBirth = (s: Student) => {
    const v = prompt(`Mã học sinh của ${s.name} (2–8 chữ/số, thường là ngày + tháng sinh: 24/02 → 2402).\nMã đăng nhập = mã lớp + mã học sinh.`, s.birth ?? '')?.trim();
    if (!v) return;
    if (!/^[A-Za-z0-9/.\- ]{2,12}$/.test(v)) { alert('Mã học sinh 2–8 chữ hoặc số'); return; }
    run(async () => { const { student } = await adminApi.updateStudent(s.id, { birth: v }); alert(`Mã mới của ${s.name}: ${student.code}`); await load(); });
  };

  const remove = (ids: string[], label: string) => {
    if (!ids.length) return;
    const typed = prompt(`XOÁ HẲN ${label} cùng toàn bộ bài làm, điểm, XP, báo cáo. KHÔNG khôi phục được.\n\nGõ chữ XOA để xác nhận:`);
    if (typed?.trim().toUpperCase() !== 'XOA') return;
    run(async () => { await adminApi.deleteStudents(ids); setSelected(new Set()); await load(); });
  };

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

  const move = () => {
    if (!selected.size || !moveTo) return;
    const target = moveTo === 'none' ? null : moveTo;
    run(async () => {
      const r = await adminApi.moveStudents([...selected], target);
      setSelected(new Set());
      setMoveTo('');
      await load();
      setError(null);
      alertMoved(r.moved, target ? className.get(target) ?? '' : null);
    });
  };
  const [moved, setMoved] = useState('');
  const alertMoved = (n: number, to: string | null) => setMoved(to ? `Đã chuyển ${n} học sinh sang lớp ${to}.` : `Đã bỏ ${n} học sinh khỏi lớp.`);

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
        sub={students ? `${filterLabel ? `${filterLabel[0]!.toUpperCase()}${filterLabel.slice(1)}: ` : ''}${activeCount} đang học${lockedCount ? ` · ${lockedCount} đã khoá` : ''}` : undefined}
        actions={
          <>
            <Button variant="secondary" disabled={busy || !activeCount} onClick={() => printCards(scoped.filter((s) => s.active).map((s) => s.id))}>
              {filterLabel ? `In thẻ ${filterLabel}` : 'In thẻ tất cả'}
            </Button>
            <Button onClick={() => setAdding(true)} disabled={adding}>+ Thêm học sinh</Button>
          </>
        }
      />
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {[{ id: 'all', name: 'Tất cả' }, ...openClasses.map((c) => ({ id: c.id, name: c.name })), ...(unassignedCount ? [{ id: 'none', name: `Chưa xếp lớp (${unassignedCount})` }] : [])].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setParams(f.id === 'all' ? {} : { lop: f.id }, { replace: true })}
              className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${filter === f.id ? 'bg-teal-700 text-white ring-teal-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'}`}
            >
              {f.name}
            </button>
          ))}
        </div>
        <ErrorBox error={error} />
        {moved && <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900 ring-1 ring-teal-200" onClick={() => setMoved('')}>{moved}</p>}

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
            <p className="mt-1 text-sm text-slate-500">Mỗi dòng: tên, dấu phẩy, mã học sinh (thường là ngày + tháng sinh, có thể có chữ). Ví dụ <span className="font-mono">Nguyễn Minh Anh, 2402</span>. Mã đăng nhập = mã lớp + mã học sinh (vd <span className="font-mono">GB072402</span>); 2 em trùng ngày sinh trong lớp thì em sau tự thêm số 2 (2402 → 24022).</p>
            <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
              Vào lớp
              <select className={selectCls} value={addClassId} onChange={(e) => setAddClassId(e.target.value)}>
                <option value="">— Chưa xếp lớp —</option>
                {openClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <textarea
              autoFocus
              rows={5}
              className={`${inputCls} mt-3 font-normal`}
              placeholder={'Nguyễn Minh Anh, 2402\nTrần Gia Bảo, 0211'}
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
              {selected.size > 0 && openClasses.length + (classes.length ? 1 : 0) > 0 && (
                <span className="flex items-center gap-1">
                  <select aria-label="Chuyển sang lớp" className={`${selectCls} py-1.5`} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                    <option value="">Chuyển lớp…</option>
                    {openClasses.map((c) => <option key={c.id} value={c.id}>→ {c.name}</option>)}
                    <option value="none">Bỏ khỏi lớp</option>
                  </select>
                  <Button variant="secondary" disabled={busy || !moveTo} onClick={move}>Chuyển ({selected.size})</Button>
                </span>
              )}
              <Button variant="ghost" disabled={busy || !selected.size} onClick={() => remove([...selected], `${selected.size} học sinh đã chọn`)}>
                <span className="text-red-700">Xoá ({selected.size})</span>
              </Button>
              <Button variant="secondary" disabled={busy || !selected.size} onClick={() => printCards([...selected])}>
                In thẻ ({selected.size})
              </Button>
            </div>
          </div>
          {!students ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Đang tải…</p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">{filter === 'all' ? 'Chưa có học sinh. Bấm “Thêm học sinh” để bắt đầu.' : 'Không có học sinh nào ở mục này.'}</p>
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
                  {filter === 'all' && editId !== s.id && (s.class_id && className.get(s.class_id) ? <Badge tone="blue">{className.get(s.class_id)}</Badge> : <Badge tone="amber">Chưa xếp lớp</Badge>)}
                  {!s.active && <Badge>Đã khoá</Badge>}
                  {editId !== s.id && (
                    <div className="ml-auto flex gap-1">
                      <Button variant="ghost" onClick={() => { setEditId(s.id); setEditName(s.name); }}>Sửa tên</Button>
                      <Button variant="ghost" disabled={busy} onClick={() => setBirth(s)}>Mã HS</Button>
                      <Button variant="ghost" disabled={busy} onClick={() => remove([s.id], `${s.name} (${s.code})`)}>
                        <span className="text-red-700">Xoá</span>
                      </Button>
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
