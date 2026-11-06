import { BookMarked, ChartPie, House } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cx } from './ui';

const ITEMS = [
  { to: '/hoc', end: true, label: 'Trang chủ', Icon: House },
  { to: '/hoc/tien-do', end: false, label: 'Tiến độ', Icon: ChartPie },
  { to: '/hoc/kho-tu', end: false, label: 'Kho từ', Icon: BookMarked },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-md">
        {ITEMS.map(({ to, end, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition',
                isActive ? 'text-brand-ink' : 'text-ink-3',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cx('flex h-7 w-14 items-center justify-center rounded-full transition', isActive && 'bg-brand-tint')}>
                  <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
