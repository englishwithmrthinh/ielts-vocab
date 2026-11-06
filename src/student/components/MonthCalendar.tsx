// Lịch tháng tô màu mốc — dùng ở trang Tiến độ và trang phụ huynh.
// Màu theo quy ước chung: 100 xanh · 50–90 vàng · 30–40 cam · nợ/bỏ đỏ · nghỉ xám.
import type { AssignmentStatus, ISODate, MonthKey } from '@shared/types';
import { daysInMonth, isoWeekday } from '@shared/time';
import { cx, toneForPct } from './ui';

export interface CalendarCell {
  date: ISODate;
  status: AssignmentStatus;
  score_pct: number | null;
  days_late?: number | null;
}

type Tone = 'ok' | 'mid' | 'low' | 'bad' | 'off' | 'pending';

export function cellTone(c: CalendarCell): Tone {
  if (c.status === 'off') return 'off';
  if (c.status === 'owing' || c.status === 'abandoned') return 'bad';
  if (c.status === 'submitted') return toneForPct(c.score_pct) as Tone;
  return 'pending'; // locked / open: chưa đến hạn
}

const TONE: Record<Tone, string> = {
  ok: 'bg-ok text-white',
  mid: 'bg-mid text-white',
  low: 'bg-low text-white',
  bad: 'bg-bad text-white',
  off: 'bg-off-bg text-off-ink',
  pending: 'bg-surface text-brand-ink ring-2 ring-inset ring-brand',
};

export function cellLabel(c: CalendarCell): string {
  if (c.status === 'off') return 'Nghỉ';
  if (c.status === 'abandoned') return 'Bỏ bài';
  if (c.status === 'owing') return 'Đang nợ';
  if (c.status === 'submitted') return c.days_late ? `${c.score_pct}% (trễ ${c.days_late} ngày)` : `${c.score_pct}% đúng hạn`;
  return c.status === 'open' ? 'Đang mở' : 'Chưa mở';
}

const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function MonthCalendar({ month, cells, today, compact }: { month: MonthKey; cells: CalendarCell[]; today?: ISODate; compact?: boolean }) {
  const days = daysInMonth(month);
  const lead = isoWeekday(days[0]!) - 1;
  const byDate = new Map(cells.map((c) => [c.date, c]));
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-ink-3">
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => (
          <span key={`x${i}`} />
        ))}
        {days.map((d) => {
          const c = byDate.get(d);
          const n = Number(d.slice(8));
          return (
            <span
              key={d}
              title={c ? `${n}: ${cellLabel(c)}` : undefined}
              aria-label={c ? `Ngày ${n}: ${cellLabel(c)}` : `Ngày ${n}`}
              className={cx(
                'flex aspect-square items-center justify-center rounded-lg font-semibold tabular-nums',
                compact ? 'text-xs' : 'text-sm',
                c ? TONE[cellTone(c)] : 'text-ink-3',
                d === today && !c && 'ring-1 ring-ink-3',
              )}
            >
              {n}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarLegend() {
  const items: [Tone, string][] = [
    ['ok', 'Đúng hạn'],
    ['mid', 'Trễ 1–5 ngày'],
    ['low', 'Trễ 6–7 ngày'],
    ['bad', 'Nợ / Bỏ'],
    ['off', 'Nghỉ'],
    ['pending', 'Sắp tới'],
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-ink-2">
      {items.map(([t, l]) => (
        <span key={t} className="inline-flex items-center gap-1">
          <span className={cx('size-3 rounded', TONE[t])} />
          {l}
        </span>
      ))}
    </div>
  );
}
