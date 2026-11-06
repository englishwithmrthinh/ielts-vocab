/** Lớp: thêm, đổi tên, ẩn/hiện, xem sĩ số, bấm vào để xem học sinh của lớp. */
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ClassesResponse } from '@shared/types';
import { adminApi } from '../lib/adminApi';
import { Badge, Button, Card, ErrorBox, PageHeader, inputCls } from '../ui';

type Row = ClassesResponse['classes'][number];

export default function ClassesPage() {
  const [classes, setClasses] = useState<Row[] | null>(null);
  const [unassigned, setUnassigned] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  const load = async () => {
    try {
      const [c, s] = await Promise.all([adminApi.classes(), adminApi.students()]);
      setClasses(c.classes);
      setUnassigned(s.students.filter((x) => x.active && !x.class_id).length);
    } catch (e) {
      setError(e);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    run(async () => {
      await adminApi.addClass(name.trim());
      setName('');
    });
  };

  const visible = (classes ?? []).filter((c) => showHidden || c.active);
  const hiddenCount = (classes ?? []).filter((c) => !c.active).length;
  const total = (classes ?? []).filter((c) => c.active).reduce((n, c) => n + c.studentCount, 0);

  return (
    <>
      <PageHeader
        title="Lớp"
        sub={classes ? `${classes.filter((c) => c.active).length} lớp · ${total} học sinh đã xếp lớp${unassigned ? ` · ${unassigned} bạn chưa xếp lớp` : ''}` : undefined}
      />
      <div className="space-y-4">
        <ErrorBox error={error} />
        <Card>
          <form onSubmit={add} className="flex flex-wrap gap-2">
            <input className={`${inputCls} max-w-xs flex-1`} placeholder="Gõ tên lớp mới…" value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" disabled={busy || !name.trim()}>+ Thêm lớp</Button>
          </form>
        </Card>

        {unassigned > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            {unassigned} học sinh chưa xếp lớp.{' '}
            <Link to="/admin/hoc-sinh?lop=none" className="font-medium underline">Xếp lớp ngay</Link>
          </p>
        )}

        <Card className="p-0 sm:p-0">
          {hiddenCount > 0 && (
            <div className="flex justify-end border-b border-slate-200 px-4 py-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
                Hiện lớp đã ẩn ({hiddenCount})
              </label>
            </div>
          )}
          {!classes ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Đang tải…</p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">Chưa có lớp nào. Thêm lớp đầu tiên ở trên.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((c) => (
                <li key={c.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${c.active ? '' : 'bg-slate-50 text-slate-400'}`}>
                  {editId === c.id ? (
                    <form
                      className="flex flex-1 gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(async () => {
                          if (editName.trim() && editName.trim() !== c.name) await adminApi.updateClass(c.id, { name: editName.trim() });
                          setEditId(null);
                        });
                      }}
                    >
                      <input autoFocus className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <Button type="submit" disabled={busy}>Lưu</Button>
                      <Button variant="ghost" onClick={() => setEditId(null)}>Huỷ</Button>
                    </form>
                  ) : (
                    <>
                      <Link to={`/admin/hoc-sinh?lop=${c.id}`} className="min-w-[10rem] flex-1 hover:underline">
                        <span className="font-semibold text-slate-900">{c.name}</span>
                        {c.code && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">Mã {c.code}</span>}
                        <span className="ml-2 text-sm text-slate-500">{c.studentCount} học sinh</span>
                      </Link>
                      {!c.active && <Badge>Đã ẩn</Badge>}
                      <div className="ml-auto flex gap-1">
                        <Link to={`/admin/hoc-sinh?lop=${c.id}`}><Button variant="ghost">Xem học sinh</Button></Link>
                        <Button variant="ghost" onClick={() => { setEditId(c.id); setEditName(c.name); }}>Đổi tên</Button>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            const v = prompt(`Mã lớp "${c.name}" (2–6 chữ hoặc số, ví dụ GB07). Mã của mọi học sinh có ngày sinh trong lớp sẽ đổi theo.`, c.code ?? '')?.trim().toUpperCase();
                            if (!v) return;
                            if (!/^[A-Z0-9]{2,6}$/.test(v)) { alert('Mã lớp 2–6 chữ hoặc số, không dấu, ví dụ GB07'); return; }
                            run(() => adminApi.updateClass(c.id, { code: v }));
                          }}
                        >
                          Đổi mã
                        </Button>
                        <Button
                          variant={c.active ? 'ghost' : 'secondary'}
                          disabled={busy}
                          onClick={() => {
                            if (c.active && !confirm(`Ẩn lớp "${c.name}"? Học sinh vẫn giữ nguyên, chỉ không hiện lớp này khi giao từ.`)) return;
                            run(() => adminApi.updateClass(c.id, { active: !c.active }));
                          }}
                        >
                          {c.active ? 'Ẩn' : 'Hiện lại'}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            if (!confirm(`Xoá lớp "${c.name}"? ${c.studentCount} học sinh trong lớp sẽ chuyển thành "Chưa xếp lớp" (không mất dữ liệu học).`)) return;
                            run(() => adminApi.deleteClass(c.id));
                          }}
                        >
                          <span className="text-red-700">Xoá</span>
                        </Button>
                      </div>
                    </>
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
