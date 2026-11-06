// Điều hướng: điện thoại = thanh dưới (3 mục); máy tính ≥1024px = thanh bên trái 220px.
import { BookMarked, ChartPie, Dumbbell, House, ListChecks, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { ART, Spot } from './Art';
import { cx } from './ui';

interface Item {
  to: string;
  end: boolean;
  label: string;
  Icon: LucideIcon;
}

const MOBILE: Item[] = [
  { to: '/hoc', end: true, label: 'Trang chủ', Icon: House },
  { to: '/hoc/tien-do', end: false, label: 'Tiến độ', Icon: ChartPie },
  { to: '/hoc/kho-tu', end: false, label: 'Kho từ', Icon: BookMarked },
];

const SIDE: Item[] = [
  { to: '/hoc', end: true, label: 'Trang chủ', Icon: House },
  { to: '/hoc/bai-can-lam', end: false, label: 'Bài cần làm', Icon: ListChecks },
  { to: '/hoc/kho-tu', end: false, label: 'Kho từ', Icon: BookMarked },
  { to: '/hoc/tien-do', end: false, label: 'Tiến độ', Icon: ChartPie },
  { to: '/hoc/luyen-them', end: false, label: 'Luyện thêm', Icon: Dumbbell },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface-2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-md">
        {MOBILE.map(({ to, end, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx('relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 transition', isActive ? 'text-brand-ink' : 'text-ink-3')
            }
          >
            {({ isActive }) => (
              <>
                <span aria-hidden className={cx('absolute inset-x-6 top-0 h-[3px] rounded-b-full transition', isActive ? 'bg-gold' : 'bg-transparent')} />
                <Icon className="size-5" strokeWidth={isActive ? 2 : 1.5} aria-hidden />
                <span className="label-caps !text-[10px]">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function SideNav() {
  return (
    <aside
      aria-label="Điều hướng chính"
      className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-line bg-surface-2 lg:flex"
    >
      <div className="px-5 pb-4 pt-6">
        <p className="font-display text-[17px] leading-tight text-ink">Học từ vựng</p>
        <p className="label-caps mt-0.5 text-ink-3">Mr Thinh Class</p>
      </div>
      <nav className="flex flex-col gap-0.5 px-3">
        {SIDE.map(({ to, end, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 transition',
                isActive ? 'bg-[color-mix(in_srgb,var(--color-surface-2)_70%,var(--color-ink)_10%)] text-ink' : 'text-ink-2 hover:bg-surface',
              )
            }
          >
            <Icon className="size-4" strokeWidth={1.5} aria-hidden />
            <span className="label-caps">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-6 px-6 pb-8">
        <Spot src={ART.bookGlasses} className="w-32 opacity-95" />
        <Spot src={ART.bookPen} className="w-28 opacity-95" />
      </div>
    </aside>
  );
}
