// Component cơ bản dùng chung cho khu học sinh + phụ huynh.
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnVariant = 'primary' | 'secondary' | 'ghost';
const BTN: Record<BtnVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover shadow-[0_3px_0_var(--color-primary-edge)] active:shadow-none active:translate-y-[3px]',
  secondary: 'bg-surface text-brand-ink ring-2 ring-inset ring-brand hover:bg-brand-wash',
  ghost: 'text-brand-ink hover:bg-brand-wash',
};

export function Button({
  variant = 'primary',
  block,
  size = 'md',
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; block?: boolean; size?: 'md' | 'lg' }) {
  return (
    <button
      type="button"
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition select-none',
        'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        size === 'lg' ? 'h-14 px-6 text-[17px]' : 'h-12 px-5 text-base',
        block && 'w-full',
        BTN[variant],
        className,
      )}
    />
  );
}

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cx('rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]', className)} />;
}

type Tone = 'ok' | 'mid' | 'low' | 'bad' | 'off' | 'brand';

const BAR_FILL: Record<Tone, string> = {
  ok: 'bg-ok', mid: 'bg-mid', low: 'bg-low', bad: 'bg-bad', off: 'bg-off', brand: 'bg-brand',
};
const BAR_TRACK: Record<Tone, string> = {
  ok: 'bg-ok-bg', mid: 'bg-mid-bg', low: 'bg-low-bg', bad: 'bg-bad-bg', off: 'bg-off-bg', brand: 'bg-brand-tint',
};

export function ProgressBar({
  value,
  max = 100,
  tone = 'brand',
  className,
  label,
}: { value: number; max?: number; tone?: Tone; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cx('h-2.5 w-full overflow-hidden rounded-full', BAR_TRACK[tone], className)}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-500', BAR_FILL[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

const TAG: Record<Tone, string> = {
  ok: 'bg-ok-bg text-ok-ink',
  mid: 'bg-mid-bg text-mid-ink',
  low: 'bg-low-bg text-low-ink',
  bad: 'bg-bad-bg text-bad-ink',
  off: 'bg-off-bg text-off-ink',
  brand: 'bg-brand-tint text-brand-ink',
};
export function Tag({ tone = 'brand', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold', TAG[tone], className)}>
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Đang tải"
      className={cx('inline-block size-6 animate-spin rounded-full border-[3px] border-brand-tint border-t-brand', className)}
    />
  );
}

/** Màu trạng thái theo % điểm (đặc tả mục 6): 100 xanh, 50–90 vàng, 30–40 cam, nợ/bỏ đỏ, nghỉ xám */
export function toneForPct(pct: number | null | undefined): Tone {
  if (pct == null) return 'off';
  if (pct >= 100) return 'ok';
  if (pct >= 50) return 'mid';
  if (pct >= 30) return 'low';
  return 'bad';
}
