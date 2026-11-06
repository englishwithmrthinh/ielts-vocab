// Trang Tiến độ (/hoc/tien-do): vòng tròn % từ đã thuộc, số từ theo hộp, lịch tháng, chuỗi, huy hiệu, top 5 tuần.
import { Flame, Trophy, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ProgressResponse } from '@shared/types';
import { monthKey } from '@shared/time';
import { errorText, studentApi } from '../api';
import { CalendarLegend, MonthCalendar } from '../components/MonthCalendar';
import { Button, Card, Spinner, cx } from '../components/ui';
import { BADGE_ICON, BADGE_VI } from '../lib/badges';
import { todayVN } from '../lib/format';
import { badgeDesc, COPY } from '../lib/copy';

export function Ring({ value, max, size = 132, label }: { value: number; max: number; size?: number; label?: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? `${pct}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="12" className="stroke-brand-tint" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          className="stroke-brand transition-[stroke-dashoffset] duration-700"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{pct}%</span>
        <span className="text-xs text-ink-2">đã thuộc</span>
      </div>
    </div>
  );
}

const BOX_ROWS: { key: keyof ProgressResponse['wordsByBox']; label: string }[] = [
  { key: '1', label: 'Hộp 1' },
  { key: '2', label: 'Hộp 2' },
  { key: '3', label: 'Hộp 3' },
  { key: '4', label: 'Hộp 4' },
  { key: '5', label: 'Hộp 5' },
  { key: 'pass', label: 'Đã thuộc' },
];

export default function Progress() {
  const [d, setD] = useState<ProgressResponse | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    studentApi.progress().then(setD).catch((e: unknown) => setErr(errorText(e)));
  }, []);

  if (err)
    return (
      <div className="p-6 text-center">
        <p className="text-bad-ink">{err}</p>
        <Button variant="secondary" className="mt-4" onClick={() => location.reload()}>
          Tải lại
        </Button>
      </div>
    );
  if (!d)
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Spinner />
      </div>
    );

  const today = todayVN();
  const month = monthKey(today);
  const maxBox = Math.max(1, ...BOX_ROWS.map((b) => d.wordsByBox[b.key]));
  const earned = d.badges.filter((b) => b.earned_at).length;

  return (
    <div className="space-y-3 px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <h1 className="text-[22px] font-bold">Tiến độ</h1>

      <Card className="flex items-center gap-4">
        <Ring value={d.wordsByBox.pass} max={d.wordsTotal} label={`Đã thuộc ${d.wordsByBox.pass} trên ${d.wordsTotal} từ`} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-ink-2">
            Thuộc <b className="text-base font-bold text-ink">{d.wordsByBox.pass}</b> / {d.wordsTotal} từ
          </p>
          <div className="flex items-center gap-2 rounded-xl bg-low-bg px-3 py-2 text-low-ink">
            <Flame className="size-5" aria-hidden />
            <span className="text-sm">
              Chuỗi <b className="text-base font-bold">{d.streak}</b> mốc đúng hạn
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-brand-tint px-3 py-2 text-brand-ink">
            <Zap className="size-5" aria-hidden />
            <span className="text-sm">
              <b className="text-base font-bold">{d.xpTotal.toLocaleString('vi-VN')}</b> XP
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-bold">Từ theo hộp ôn</h2>
        <div className="space-y-2">
          {BOX_ROWS.map(({ key, label }) => {
            const n = d.wordsByBox[key];
            return (
              <div key={key} className="flex items-center gap-3 text-sm">
                <span className={cx('w-16 shrink-0', key === 'pass' ? 'font-semibold text-ok-ink' : 'text-ink-2')}>{label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cx('h-full rounded-full', key === 'pass' ? 'bg-ok' : 'bg-brand')}
                    style={{ width: `${(n / maxBox) * 100}%`, opacity: key === 'pass' ? 1 : 0.45 + Number(key) * 0.11 }}
                  />
                </div>
                <span className="w-7 text-right font-semibold tabular-nums">{n}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-ink-3">Hộp càng cao thì càng lâu mới phải ôn lại. Qua Hộp 5 là thuộc.</p>
      </Card>

      <Card>
        <h2 className="mb-3 font-bold">Tháng {Number(month.slice(5))}/{month.slice(0, 4)}</h2>
        <MonthCalendar month={month} cells={d.calendar} today={today} />
        <CalendarLegend />
      </Card>

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-bold">Huy hiệu</h2>
          <span className="text-sm text-ink-2">
            {earned}/{d.badges.length}
          </span>
        </div>
        {earned === 0 && <p className="mb-3 text-sm text-ink-2">{COPY.empty.no_badges_yet}</p>}
        <div className="grid grid-cols-3 gap-2">
          {d.badges.map((b) => {
            const Icon = BADGE_ICON[b.code];
            const on = !!b.earned_at;
            return (
              <div
                key={b.code}
                className={cx('flex flex-col items-center rounded-2xl px-1 py-3 text-center', on ? 'bg-mid-bg' : 'bg-surface-2')}
                title={badgeDesc(b.code)}
                aria-label={`${BADGE_VI[b.code]}: ${badgeDesc(b.code)}${on ? ' (đã có)' : ' (chưa có)'}`}
              >
                <span
                  className={cx(
                    'flex size-11 items-center justify-center rounded-full',
                    on ? 'bg-mid text-white shadow-[0_3px_0_var(--color-mid-ink)]' : 'bg-off-bg text-off opacity-60',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className={cx('mt-1.5 text-[11px] font-semibold leading-tight', on ? 'text-mid-ink' : 'text-ink-3')}>{BADGE_VI[b.code]}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          <Trophy className="size-5 text-mid" aria-hidden /> Top 5 tuần này
        </h2>
        <ol className="space-y-1.5">
          {d.weeklyTop5.map((p, i) => (
            <li
              key={p.name + i}
              className={cx('flex items-center gap-3 rounded-xl px-3 py-2', p.isMe ? 'bg-brand-tint font-semibold text-brand-ink' : 'bg-surface-2')}
            >
              <span
                className={cx(
                  'flex size-7 items-center justify-center rounded-full text-sm font-bold',
                  i === 0 ? 'bg-mid text-white' : i === 1 ? 'bg-off text-white' : i === 2 ? 'bg-low text-white' : 'text-ink-3',
                )}
              >
                {i + 1}
              </span>
              <span className="flex-1">
                {p.name}
                {p.isMe && ' (bạn)'}
              </span>
              <span className="tabular-nums">{p.xp} XP</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
