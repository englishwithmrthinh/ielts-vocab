// Quyển sách vẽ bằng CSS/SVG (không dùng ảnh): mỗi quyển là một nhóm từ (theo hộp ôn).
// Nội dung bìa tự nghĩ, không chép bìa sách thật.
import { Leaf, Moon, Star4 } from './Art';
import { cx } from './ui';

export type BookTone = 'teal' | 'wine' | 'navy' | 'moss' | 'gold';

const TONE: Record<BookTone, { bg: string; ink: string; frame: string }> = {
  teal: { bg: '#1f4e52', ink: '#f3e9d2', frame: 'var(--color-gold)' },
  wine: { bg: '#7b2d34', ink: '#f3e9d2', frame: 'var(--color-gold)' },
  navy: { bg: '#1e2f4a', ink: '#f3e9d2', frame: 'var(--color-gold)' },
  moss: { bg: '#2f4a3a', ink: '#f3e9d2', frame: 'var(--color-gold)' },
  gold: { bg: '#c9a24a', ink: '#3b2a10', frame: '#3b2a10' },
};

const EMBLEM = { star: Star4, moon: Moon, leaf: Leaf };

/** Góc hoa văn nhỏ của khung */
function Corner({ className, color }: { className: string; color: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className={cx('absolute size-3', className)} style={{ color }}>
      <path d="M1 6 A5 5 0 0 1 6 1 M1 11 V6 M11 1 H6" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="3.2" cy="3.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function BookCover({
  title,
  subtitle,
  tone = 'teal',
  emblem = 'star',
  progress,
  small,
  onClick,
  label,
  className,
}: {
  title: string;
  subtitle?: string;
  tone?: BookTone;
  emblem?: keyof typeof EMBLEM;
  /** 0..1 — vạch mảnh dưới đáy bìa */
  progress?: number;
  small?: boolean;
  onClick?: () => void;
  /** nhãn đọc màn hình */
  label?: string;
  className?: string;
}) {
  const t = TONE[tone];
  const Icon = EMBLEM[emblem];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={label ?? (subtitle ? `${title}, ${subtitle}` : title)}
      className={cx(
        'group relative block aspect-[2/3] shrink-0 overflow-hidden rounded-[4px] text-left transition duration-200',
        'shadow-[2px_3px_0_rgb(0_0_0/0.12),0_6px_14px_rgb(43_38_34/0.18)]',
        onClick && 'hover:-translate-y-0.5 hover:shadow-[2px_4px_0_rgb(0_0_0/0.14),0_10px_20px_rgb(43_38_34/0.24)] active:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
        small ? 'w-14' : 'w-full',
        className,
      )}
      style={{
        backgroundColor: t.bg,
        // vải bìa: hai lớp chuyển màu rất nhẹ
        backgroundImage:
          'linear-gradient(115deg, rgb(255 255 255 / 0.07), transparent 45%, rgb(0 0 0 / 0.1)), repeating-linear-gradient(45deg, rgb(255 255 255 / 0.025) 0 2px, transparent 2px 4px)',
        color: t.ink,
      }}
    >
      {/* gáy sách */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-2 bg-black/25" />
      <span aria-hidden className="absolute inset-y-0 left-2 w-px bg-white/10" />
      {/* khung vàng kim */}
      {!small && (
        <span aria-hidden className="absolute inset-[6px] left-[14px] rounded-[2px] border" style={{ borderColor: t.frame, opacity: 0.85 }}>
          <Corner className="-left-px -top-px" color={t.frame} />
          <Corner className="-right-px -top-px rotate-90" color={t.frame} />
          <Corner className="-bottom-px -right-px rotate-180" color={t.frame} />
          <Corner className="-bottom-px -left-px -rotate-90" color={t.frame} />
        </span>
      )}
      <span className={cx('absolute inset-0 flex flex-col items-center justify-center text-center', small ? 'pl-2' : 'px-4 pl-5')}>
        <Icon className={cx(small ? 'mb-0.5 size-3' : 'mb-2 size-5')} style={{ color: tone === 'gold' ? t.ink : 'var(--color-gold)' }} />
        <span className={cx('font-display leading-tight', small ? 'text-[9px]' : 'text-[15px]')}>{title}</span>
        {subtitle && !small && <span className="mt-1.5 text-[11px] font-medium opacity-85">{subtitle}</span>}
      </span>
      {progress != null && (
        <span aria-hidden className={cx('absolute h-[3px] overflow-hidden rounded-full bg-white/20', small ? 'inset-x-2.5 bottom-1.5' : 'inset-x-5 bottom-3')}>
          <span className="block h-full rounded-full" style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`, background: tone === 'gold' ? t.ink : 'var(--color-gold)' }} />
        </span>
      )}
    </Tag>
  );
}

/** 6 quyển theo hộp: H1 → H5 và PASS (vàng kim) */
export const SHELF: { key: '1' | '2' | '3' | '4' | '5' | 'pass'; box: 1 | 2 | 3 | 4 | 5 | 6; title: string; tone: BookTone; emblem: keyof typeof EMBLEM }[] = [
  { key: '1', box: 1, title: 'Hộp 1', tone: 'wine', emblem: 'leaf' },
  { key: '2', box: 2, title: 'Hộp 2', tone: 'teal', emblem: 'star' },
  { key: '3', box: 3, title: 'Hộp 3', tone: 'navy', emblem: 'moon' },
  { key: '4', box: 4, title: 'Hộp 4', tone: 'moss', emblem: 'leaf' },
  { key: '5', box: 5, title: 'Hộp 5', tone: 'wine', emblem: 'star' },
  { key: 'pass', box: 6, title: 'Đã thuộc', tone: 'gold', emblem: 'star' },
];
