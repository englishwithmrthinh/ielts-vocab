/** Chọn mốc hạn (T3/T6/CN sắp tới) — dùng khi phát hành / đổi hạn bộ từ. */
import { useEffect, useState } from 'react';
import type { Milestone } from '@shared/types';
import { adminApi } from '../lib/adminApi';

const KIND: Record<string, string> = { tue: 'Thứ 3', fri: 'Thứ 6', sun: 'Chủ nhật' };

export function vnDeadline(iso: string): string {
  const d = new Date(Date.parse(iso) + 7 * 3600_000).toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)} ${d.slice(11, 16)}`;
}

export function MilestonePicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const [items, setItems] = useState<Milestone[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    adminApi.upcomingMilestones().then((r) => {
      setItems(r.milestones);
      if (!value && r.milestones[0]) onChange(r.milestones[0].id);
    }, () => setErr(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (err) return <p className="text-sm text-red-700">Không tải được lịch mốc.</p>;
  if (!items) return <p className="text-sm text-slate-500">Đang tải lịch…</p>;
  if (!items.length) return <p className="text-sm text-amber-800">Chưa có mốc sắp tới. Mở Lịch mốc để tạo tháng mới.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
      {items.map((m) => {
        const on = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(m.id)}
            className={`rounded-lg px-2 py-2 text-left text-sm ring-1 transition ${on ? 'bg-teal-700 text-white ring-teal-700' : 'bg-white text-slate-800 ring-slate-200 hover:bg-slate-50'}`}
          >
            <span className="block font-semibold">{KIND[m.kind]} {m.date.slice(8)}/{m.date.slice(5, 7)}</span>
            <span className={`block text-xs ${on ? 'text-teal-100' : 'text-slate-500'}`}>hạn {vnDeadline(m.deadline_at).slice(6)}</span>
          </button>
        );
      })}
    </div>
  );
}
