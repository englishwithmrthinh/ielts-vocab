// Trang Tiến độ (/hoc/tien-do): vòng tròn % từ đã thuộc, số từ theo hộp, lịch tháng, chuỗi, huy hiệu, top 5 tuần.
import { Flame, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { ProgressResponse } from '@shared/types';
import { monthKey } from '@shared/time';
import { errorText, studentApi } from '../api';
import { CalendarLegend, MonthCalendar } from '../components/MonthCalendar';
import { BookCover, SHELF } from '../components/BookCover';
import { Button, Card, SectionTitle, Spinner, cx } from '../components/ui';
import { WaxSeal } from '../components/WaxSeal';
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="10" className="stroke-brand-tint" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-brand transition-[stroke-dashoffset] duration-700"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] font-bold tabular-nums">{pct}%</span>
        <span className="label-caps !text-[10px] text-ink-3">đã thuộc</span>
      </div>
    </div>
  );
}

export default function Progress() {
  const nav = useNavigate();
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
  const earned = d.badges.filter((b) => b.earned_at).length;

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] lg:px-0">
      <SectionTitle as="h1">Tiến độ</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex items-center gap-4">
          <Ring value={d.wordsByBox.pass} max={d.wordsTotal} label={`Đã thuộc ${d.wordsByBox.pass} trên ${d.wordsTotal} từ`} />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm text-ink-2">
              Thuộc <b className="text-base font-bold text-ink">{d.wordsByBox.pass}</b> / {d.wordsTotal} từ
            </p>
            <div className="flex items-center gap-2 rounded-xl bg-blush px-3 py-2 text-blush-ink">
              <Flame className="size-5" strokeWidth={1.6} aria-hidden />
              <span className="text-sm">
                Chuỗi <b className="text-base font-bold">{d.streak}</b> mốc đúng hạn
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-highlight px-3 py-2 text-gold-ink">
              <Zap className="size-5" strokeWidth={1.6} aria-hidden />
              <span className="text-sm">
                <b className="text-base font-bold">{d.xpTotal.toLocaleString('vi-VN')}</b> XP
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle aside="Chạm để xem">Kệ sách</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            {SHELF.map((b) => (
              <BookCover
                key={b.key}
                title={b.title}
                subtitle={`${d.wordsByBox[b.key]} từ`}
                tone={b.tone}
                emblem={b.emblem}
                onClick={() => nav(`/hoc/kho-tu?hop=${b.box}`)}
                label={`${b.title}: ${d.wordsByBox[b.key]} từ`}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-3">Hộp càng cao thì càng lâu mới phải ôn lại. Qua Hộp 5 là thuộc.</p>
        </Card>

        <Card>
          <SectionTitle>
            Tháng {Number(month.slice(5))}/{month.slice(0, 4)}
          </SectionTitle>
          <MonthCalendar month={month} cells={d.calendar} today={today} />
          <CalendarLegend />
        </Card>

        <Card>
          <SectionTitle aside={`${earned}/${d.badges.length}`}>Huy hiệu</SectionTitle>
          {earned === 0 && <p className="mb-3 text-sm text-ink-2">{COPY.empty.no_badges_yet}</p>}
          <div className="grid grid-cols-3 gap-x-2 gap-y-4">
            {d.badges.map((b) => {
              const on = !!b.earned_at;
              return (
                <div
                  key={b.code}
                  className="flex flex-col items-center text-center"
                  title={badgeDesc(b.code)}
                  aria-label={`${BADGE_VI[b.code]}: ${badgeDesc(b.code)}${on ? ' (đã có)' : ' (chưa có)'}`}
                >
                  <WaxSeal icon={BADGE_ICON[b.code]} on={on} tone={b.code.startsWith('pass') || b.code === 'perfect_month' ? 'gold' : 'wine'} size={54} />
                  <span className={cx('mt-1.5 text-[11px] font-semibold leading-tight', on ? 'text-ink' : 'text-ink-3')}>{BADGE_VI[b.code]}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle>Top 5 tuần này</SectionTitle>
          <ol className="space-y-2">
            {d.weeklyTop5.map((p, i) => (
              <li key={p.name + i} className={cx('flex items-baseline', p.isMe && 'font-semibold text-brand-ink')}>
                <span className="w-7 shrink-0 font-serif text-[20px] font-bold text-gold-ink">{['I', 'II', 'III', 'IV', 'V'][i]}</span>
                <span className="font-serif text-[19px]">
                  {p.name}
                  {p.isMe && <span className="ml-1.5 align-middle text-xs font-semibold uppercase tracking-wider text-accent">bạn</span>}
                </span>
                <span aria-hidden className="leader" />
                <span className="shrink-0 tabular-nums">{p.xp} XP</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
