import { Delete } from 'lucide-react';
import { useEffect } from 'react';
import { cx } from './ui';

/** Bàn phím số cho PIN 4 số. Hỗ trợ cả bàn phím thật (số, Backspace). */
export function PinPad({
  value,
  onChange,
  length = 4,
  disabled,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  disabled?: boolean;
  error?: boolean;
}) {
  const press = (k: string) => {
    if (disabled) return;
    if (k === 'del') onChange(value.slice(0, -1));
    else if (value.length < length) onChange(value + k);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className={cx('flex gap-4', error && 'animate-shake')} aria-label={`Đã nhập ${value.length} trên ${length} số`}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cx(
              'size-4 rounded-full transition',
              error ? 'bg-bad' : i < value.length ? 'bg-primary scale-110' : 'bg-brand-tint',
            )}
          />
        ))}
      </div>
      <div className="grid w-full max-w-[300px] grid-cols-3 gap-3">
        {keys.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => press(k)}
              aria-label={k === 'del' ? 'Xoá' : k}
              className={cx(
                'flex h-16 items-center justify-center rounded-2xl text-2xl font-semibold transition select-none',
                'active:scale-95 disabled:opacity-50',
                k === 'del' ? 'text-ink-2 active:bg-brand-wash' : 'bg-surface text-ink shadow-[var(--shadow-card)] active:bg-brand-wash',
              )}
            >
              {k === 'del' ? <Delete className="size-7" aria-hidden /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
