// Con dấu sáp tròn: huy hiệu (đã có = wine/vàng kim, chưa có = nét đứt xám) và dấu PASS.
import type { LucideIcon } from 'lucide-react';
import { Star4 } from './Art';
import { cx } from './ui';

export function WaxSeal({
  icon: Icon,
  text,
  on = true,
  tone = 'wine',
  size = 56,
  className,
}: {
  icon?: LucideIcon;
  text?: string;
  on?: boolean;
  tone?: 'wine' | 'gold';
  size?: number;
  className?: string;
}) {
  if (!on) {
    return (
      <span
        aria-hidden
        className={cx('flex items-center justify-center rounded-full border-2 border-dashed border-off text-off', className)}
        style={{ width: size, height: size }}
      >
        {Icon && <Icon className="size-1/3" strokeWidth={1.6} />}
      </span>
    );
  }
  const bg = tone === 'wine' ? 'var(--color-accent)' : 'var(--color-gold)';
  const ink = tone === 'wine' ? 'var(--color-cream)' : '#3b2a10';
  return (
    <span aria-hidden className={cx('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      {/* mép sáp lượn sóng */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 drop-shadow-[0_2px_2px_rgb(0_0_0/0.25)]">
        <path
          fill={bg}
          d="M50 2c6 0 8 5 13 6s10-2 14 2 1 9 4 13 9 5 10 11-4 8-4 13 6 9 4 14-8 5-11 9-1 10-6 13-9-2-14-1-8 6-13 6-8-5-13-6-10 2-14-2-1-9-4-13-9-5-10-11 4-8 4-13-6-9-4-14 8-5 11-9 1-10 6-13 9 2 14 1 8-6 13-6Z"
        />
        <circle cx="50" cy="50" r="33" fill="none" stroke={ink} strokeOpacity=".45" strokeWidth="2" />
      </svg>
      <span className="relative flex flex-col items-center leading-none" style={{ color: ink }}>
        {Icon ? <Icon className="size-[34%] min-h-4 min-w-4" strokeWidth={1.8} /> : <Star4 className="size-4" />}
        {text && <span className="mt-0.5 font-display text-[11px] font-bold">{text}</span>}
      </span>
    </span>
  );
}
