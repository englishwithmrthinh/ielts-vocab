/**
 * Chọn học sinh được giao: chip lớp / "Tất cả học sinh" để tick nhanh, rồi bỏ tick từng bạn.
 * Dùng ở Thêm bộ từ và hộp Phát hành. Kết quả vẫn là danh sách student id.
 */
import type { Class, Student } from '@shared/types';

export interface StudentPickerProps {
  students: Student[];           // chỉ học sinh đang học
  classes: Class[];              // lớp đang mở
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Ghi chú cạnh tên (ví dụ "chưa chọn") */
  note?: (s: Student) => string | undefined;
  maxHeight?: string;
}

const NONE = '__none__';

export default function StudentPicker({ students, classes, selected, onChange, note, maxHeight = 'max-h-72' }: StudentPickerProps) {
  const groups = [
    ...classes.map((c) => ({ id: c.id, name: c.name, list: students.filter((s) => s.class_id === c.id) })),
    { id: NONE, name: 'Chưa xếp lớp', list: students.filter((s) => !s.class_id || !classes.some((c) => c.id === s.class_id)) },
  ].filter((g) => g.list.length > 0);

  const allOn = (list: Student[]) => list.length > 0 && list.every((s) => selected.has(s.id));
  const someOn = (list: Student[]) => list.some((s) => selected.has(s.id));

  const toggleGroup = (list: Student[]) => {
    const next = new Set(selected);
    if (allOn(list)) list.forEach((s) => next.delete(s.id));
    else list.forEach((s) => next.add(s.id));
    onChange(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const chip = (active: boolean, partial: boolean) =>
    `inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
      active ? 'bg-teal-700 text-white ring-teal-700' : partial ? 'bg-teal-50 text-teal-800 ring-teal-300' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
    }`;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={chip(allOn(students), someOn(students) && !allOn(students))} onClick={() => toggleGroup(students)}>
          Tất cả học sinh <span className="opacity-70">{students.length}</span>
        </button>
        {groups.map((g) => (
          <button key={g.id} type="button" className={chip(allOn(g.list), someOn(g.list) && !allOn(g.list))} onClick={() => toggleGroup(g.list)}>
            {g.name} <span className="opacity-70">{g.list.filter((s) => selected.has(s.id)).length}/{g.list.length}</span>
          </button>
        ))}
        {selected.size > 0 && (
          <button type="button" className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800" onClick={() => onChange(new Set())}>
            Bỏ chọn hết
          </button>
        )}
      </div>

      <div className={`mt-3 ${maxHeight} space-y-3 overflow-y-auto pr-1`}>
        {groups.map((g) => (
          <div key={g.id}>
            {groups.length > 1 && <p className="mb-0.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.name}</p>}
            <ul className="space-y-0.5">
              {g.list.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} />
                    <span className="w-10 font-mono text-xs text-slate-500">{s.code}</span>
                    <span className="min-w-0 truncate">{s.name}</span>
                    {note?.(s) && <span className="ml-auto shrink-0 text-xs text-slate-400">{note(s)}</span>}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!students.length && <p className="text-sm text-slate-500">Chưa có học sinh.</p>}
      </div>
    </div>
  );
}
