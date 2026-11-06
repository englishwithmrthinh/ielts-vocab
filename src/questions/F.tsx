// F · Xếp chữ cái (Nhớ lại): kéo thả chữ cái thành từ, có nghĩa gợi ý.
// Chạm chữ ở khay = thêm vào cuối; chạm chữ đã xếp = trả về; kéo chữ vào ô bất kỳ = chèn vào vị trí đó.
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { QuestionProps } from './index';
import { cx } from '../student/components/ui';
import { useDragDrop } from './drag';
import { CheckButton, Instruction } from './parts';

export default function F({ question: q, onSubmit, disabled, result }: QuestionProps) {
  const letters = q.prompt.letters ?? [];
  /** thứ tự chỉ số chữ cái học sinh đã xếp */
  const [seq, setSeq] = useState<number[]>([]);
  const lock = disabled || !!result;

  const dd = useDragDrop({
    disabled: lock,
    onTap: (id) => {
      const [kind, n] = id.split(':');
      const i = Number(n);
      if (kind === 'b') setSeq((s) => [...s, i]);
      else setSeq((s) => s.filter((x) => x !== i));
    },
    onDrop: (id, drop) => {
      const i = Number(id.split(':')[1]);
      setSeq((s) => {
        const rest = s.filter((x) => x !== i);
        if (drop === 'bank') return rest;
        if (drop === 'end') return [...rest, i];
        const pos = Number(drop.split(':')[1]);
        const at = Math.min(pos, rest.length);
        return [...rest.slice(0, at), i, ...rest.slice(at)];
      });
    },
  });

  const free = letters.map((c, i) => ({ c, i })).filter((x) => !seq.includes(x.i));
  const tone = result ? (result.correct ? 'ok' : 'bad') : null;

  return (
    <div>
      <Instruction>Xếp các chữ cái thành từ có nghĩa:</Instruction>
      <p className="mb-5 text-center text-2xl font-bold">{q.prompt.meaningVi}</p>

      <div
        data-drop="end"
        className={cx(
          'flex min-h-16 flex-wrap items-center justify-center gap-1.5 rounded-2xl border-2 p-2',
          tone === 'ok' ? 'border-ok bg-ok-bg' : tone === 'bad' ? 'border-bad bg-bad-bg' : 'border-dashed border-brand bg-brand-tint/40',
        )}
        aria-label="Từ đang xếp"
      >
        {seq.length === 0 && <span className="text-sm text-ink-3">Chạm hoặc kéo chữ cái vào đây</span>}
        {seq.map((i, pos) => (
          <span key={i} data-drop={`s:${pos}`} className="inline-flex">
            <button
              type="button"
              disabled={lock}
              {...dd.dragProps(`a:${i}`, letters[i])}
              className={cx(
                'size-11 rounded-lg bg-surface font-serif text-[26px] font-bold shadow-[var(--shadow-card)] ring-1 ring-line transition',
                dd.draggingId === `a:${i}` && 'opacity-30',
                dd.overId === `s:${pos}` && 'ring-2 ring-brand',
              )}
            >
              {letters[i]}
            </button>
          </span>
        ))}
      </div>

      {!result && (
        <>
          <div data-drop="bank" className="mt-4 flex min-h-14 flex-wrap justify-center gap-2">
            {free.map(({ c, i }) => (
              <button
                key={i}
                type="button"
                disabled={lock}
                {...dd.dragProps(`b:${i}`, c)}
                className={cx(
                  'size-12 rounded-lg bg-surface-2 font-serif text-[28px] font-bold text-ink shadow-[0_3px_0_var(--color-line)] ring-1 ring-line transition active:translate-y-[2px] active:shadow-none',
                  dd.draggingId === `b:${i}` && 'opacity-30',
                )}
              >
                {c}
              </button>
            ))}
          </div>
          {seq.length > 0 && (
            <div className="mt-3 text-center">
              <button type="button" onClick={() => setSeq([])} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-brand-ink">
                <RotateCcw className="size-4" aria-hidden /> Xếp lại
              </button>
            </div>
          )}
          <CheckButton
            disabled={seq.length !== letters.length || disabled}
            onClick={() => onSubmit({ qid: q.qid, text: seq.map((i) => letters[i]).join('') })}
          />
        </>
      )}
      {dd.overlay}
    </div>
  );
}
