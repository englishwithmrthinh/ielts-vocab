/** Lịch mốc tháng: bật/tắt Nghỉ cho từng mốc hoặc cả tuần. */
import { useEffect, useState } from 'react';
import type { Milestone } from '@shared/types';
import { addDays, daysInMonth, isoWeekday, monthKey, nextMonth, vnDate } from '@shared/time';
import { adminApi } from '../lib/adminApi';
import { Button, Card, ErrorBox, PageHeader } from '../ui';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const KIND_LABEL = { tue: 'Thứ 3', fri: 'Thứ 6', sun: 'Chủ nhật' } as const;

function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
}

function monthTitle(m: string): string {
  const [y, mo] = m.split('-');
  return `Tháng ${Number(mo)}/${y}`;
}

/** Các tuần (T2→CN) phủ trọn tháng */
function weeksOf(month: string): string[][] {
  const days = daysInMonth(month);
  let start = addDays(days[0]!, -(isoWeekday(days[0]!) - 1));
  const last = days[days.length - 1]!;
  const weeks: string[][] = [];
  while (start <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
    start = addDays(start, 7);
  }
  return weeks;
}

export default function CalendarPage() {
  const today = vnDate(new Date());
  const [month, setMonth] = useState(monthKey(today));
  const [items, setItems] = useState<Milestone[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = (m = month) => adminApi.milestones(m).then((r) => setItems(r.milestones), setError);
  useEffect(() => {
    setItems(null);
    load(month);
  }, [month]);

  const byDate = new Map((items ?? []).map((m) => [m.date, m]));
  const editable = (m: Milestone) => m.date >= today;

  const setOff = async (list: Milestone[], off: boolean) => {
    setBusy(true);
    setError(null);
    try {
      for (const m of list) if (m.is_off !== off) await adminApi.setOff(m.id, off);
      await load();
    } catch (e) {
      setError(e);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const offCount = (items ?? []).filter((m) => m.is_off).length;
  const total = items?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Lịch mốc"
        sub="Mỗi Thứ 3, Thứ 6, Chủ nhật là một mốc. Mốc Nghỉ không có bài và không tính vào khoảng ôn."
      />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="secondary" aria-label="Tháng trước" onClick={() => setMonth(prevMonth(month))}>‹</Button>
            <h2 className="min-w-36 text-center text-lg font-semibold text-slate-900">{monthTitle(month)}</h2>
            <Button variant="secondary" aria-label="Tháng sau" onClick={() => setMonth(nextMonth(month))}>›</Button>
          </div>
          {items && <p className="text-sm text-slate-500">{total - offCount} mốc học · {offCount} mốc nghỉ</p>}
        </div>

        <div className="mt-4"><ErrorBox error={error} /></div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                {WEEKDAYS.map((d) => <th key={d} className="pb-1 text-xs font-medium text-slate-500">{d}</th>)}
                <th className="w-24 pb-1 text-xs font-medium text-slate-500">Cả tuần</th>
              </tr>
            </thead>
            <tbody>
              {weeksOf(month).map((week) => {
                const ms = week.map((d) => byDate.get(d)).filter((m): m is Milestone => !!m);
                const editableMs = ms.filter(editable);
                const allOff = editableMs.length > 0 && editableMs.every((m) => m.is_off);
                return (
                  <tr key={week[0]}>
                    {week.map((d) => {
                      const m = byDate.get(d);
                      const inMonth = monthKey(d) === month;
                      if (!m) {
                        return (
                          <td key={d} className={`h-20 rounded-lg p-2 align-top ${inMonth ? 'bg-slate-50' : ''}`}>
                            <span className={`text-xs ${inMonth ? 'text-slate-400' : 'text-slate-300'}`}>{Number(d.slice(8))}</span>
                          </td>
                        );
                      }
                      const past = !editable(m);
                      return (
                        <td key={d} className="h-20 align-top">
                          <button
                            type="button"
                            disabled={busy || past || !items}
                            onClick={() => setOff([m], !m.is_off)}
                            title={past ? 'Mốc đã qua, không đổi được' : m.is_off ? 'Bấm để bật lại mốc' : 'Bấm để đánh dấu Nghỉ'}
                            className={`flex h-full w-full flex-col items-start rounded-lg p-2 text-left ring-1 transition ${
                              m.is_off
                                ? 'bg-slate-100 text-slate-500 ring-slate-200'
                                : 'bg-teal-50 text-teal-900 ring-teal-200 hover:bg-teal-100'
                            } ${past ? 'cursor-default opacity-60' : ''} ${d === today ? 'outline-2 outline-teal-600' : ''}`}
                          >
                            <span className="text-xs font-semibold">{Number(d.slice(8))}</span>
                            <span className="mt-auto text-xs font-medium">{m.is_off ? 'Nghỉ' : `Mốc ${m.idx}`}</span>
                            <span className="text-[11px] opacity-70">{KIND_LABEL[m.kind]}</span>
                          </button>
                        </td>
                      );
                    })}
                    <td className="align-middle">
                      {editableMs.length > 0 && (
                        <Button variant="ghost" className="w-full text-xs" disabled={busy} onClick={() => setOff(editableMs, !allOff)}>
                          {allOff ? 'Bật lại tuần' : 'Nghỉ cả tuần'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">Mốc đã qua bị khoá để không làm lệch lịch ôn đã xếp. Bật/tắt Nghỉ sẽ đánh lại số mốc phía sau.</p>
      </Card>
    </>
  );
}
