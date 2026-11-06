// Logic "gán thẻ vào ô" dùng chung cho D (nối) và L (kéo từ vào câu).
// Cách 1: kéo thẻ thả vào ô. Cách 2: chạm thẻ (chọn) rồi chạm ô. Chạm ô đã có thẻ = trả thẻ về.
import { useState } from 'react';
import type { Option } from '@shared/types';
import { cx } from '../student/components/ui';
import { useDragDrop } from './drag';

export function useAssign(bank: Option[], targetIds: string[], disabled?: boolean) {
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);

  const place = (bankId: string, targetId: string) => {
    setAssign((prev) => {
      const next: Record<string, string> = {};
      for (const [t, b] of Object.entries(prev)) if (b !== bankId && t !== targetId) next[t] = b;
      next[targetId] = bankId;
      return next;
    });
    setSelected(null);
  };

  const dd = useDragDrop({
    disabled,
    onTap: (bankId) => setSelected((s) => (s === bankId ? null : bankId)),
    onDrop: (bankId, dropId) => {
      if (dropId === 'bank') {
        setAssign((prev) => Object.fromEntries(Object.entries(prev).filter(([, b]) => b !== bankId)));
      } else if (targetIds.includes(dropId)) place(bankId, dropId);
    },
  });

  const tapTarget = (targetId: string) => {
    if (disabled) return;
    if (selected) place(selected, targetId);
    else if (assign[targetId]) setAssign(({ [targetId]: _, ...rest }) => rest);
  };

  const used = new Set(Object.values(assign));
  const label = (bankId: string | undefined) => bank.find((b) => b.id === bankId)?.text;
  const complete = targetIds.every((t) => assign[t]);

  return { assign, selected, setSelected, tapTarget, used, label, complete, ...dd };
}

/** Khay thẻ chưa dùng */
export function Bank({
  bank,
  a,
  disabled,
}: {
  bank: Option[];
  a: ReturnType<typeof useAssign>;
  disabled?: boolean;
}) {
  const free = bank.filter((b) => !a.used.has(b.id));
  return (
    <div data-drop="bank" className="mt-4 min-h-16 rounded-2xl border-2 border-dashed border-line p-2">
      {free.length === 0 ? (
        <p className="py-3 text-center text-sm text-ink-3">Đã dùng hết thẻ. Chạm vào ô để đổi.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {free.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={disabled}
              {...a.dragProps(b.id, b.text)}
              className={cx(
                'min-h-11 select-none rounded-xl bg-surface px-3 py-2 text-left font-medium shadow-[var(--shadow-card)] ring-2 transition',
                a.selected === b.id ? 'ring-brand bg-brand-wash' : 'ring-transparent',
                a.draggingId === b.id && 'opacity-30',
              )}
            >
              {b.text}
            </button>
          ))}
        </div>
      )}
      {a.overlay}
    </div>
  );
}

/** Ô nhận thẻ */
export function Slot({
  id,
  a,
  state,
  placeholder = 'Thả vào đây',
  className,
}: {
  id: string;
  a: ReturnType<typeof useAssign>;
  state?: 'ok' | 'bad';
  placeholder?: string;
  className?: string;
}) {
  const text = a.label(a.assign[id]);
  return (
    <button
      type="button"
      data-drop={id}
      onClick={() => a.tapTarget(id)}
      className={cx(
        'inline-flex min-h-10 min-w-24 items-center justify-center rounded-xl border-2 px-2.5 py-1 text-sm font-semibold transition',
        state === 'ok' && 'border-ok bg-ok-bg text-ok-ink',
        state === 'bad' && 'border-bad bg-bad-bg text-bad-ink',
        !state && (text ? 'border-brand bg-brand-wash text-brand-ink' : 'border-dashed border-ink-3/50 text-ink-3'),
        !state && a.overId === id && 'border-brand bg-brand-tint',
        !state && a.selected && !text && 'border-brand',
        className,
      )}
    >
      {text ?? placeholder}
    </button>
  );
}
