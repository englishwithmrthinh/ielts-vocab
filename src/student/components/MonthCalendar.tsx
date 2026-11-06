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

/** Màu chấm trạng thái dưới số ngày */
const DOT: Record<Tone, string> = {
  ok: 'bg-ok',
  mid: 'bg-mid',
  low: 'bg-low',
  bad: 'bg-bad',
  off: 'bg-off',
  pending: 'bg-transparent ring-[1.5px] ring-inset ring-brand',
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
      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW.map((d) => (
          <span key={d} className="label-caps !text-[10px] text-ink-3">
            {d}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => (
          <span key={`x${i}`} />
        ))}
        {days.map((d) => {
          const c = byDate.get(d);
          const n = Number(d.slice(8));
          const tone = c ? cellTone(c) : null;
          return (
            <span
              key={d}
              title={c ? `${n}: ${cellLabel(c)}` : undefined}
              aria-label={c ? `Ngày ${n}: ${cellLabel(c)}` : `Ngày ${n}`}
              className={cx(
                'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md tabular-nums',
                compact ? 'text-xs' : 'text-sm',
                c ? 'bg-surface-2 font-semibold text-ink ring-1 ring-line' : 'text-ink-3',
                d === today && 'ring-2 ring-gold',
              )}
            >
              {n}
              {tone && <span aria-hidden className={cx('size-2 rounded-full', DOT[tone])} />}
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
          <span className={cx('size-2.5 rounded-full', DOT[t])} />
          {l}
        </span>
      ))}
    </div>
  );
}
