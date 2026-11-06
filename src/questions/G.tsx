// G · Spelling khuyết (Nhớ lại): điền chữ thiếu (~40% bị ẩn), có nghĩa gợi ý.
// masked ví dụ "en_ir_nm_nt": mỗi "_" là một ô một chữ. Gõ là tự nhảy ô; Backspace ở ô trống lùi về ô trước.
// Gửi lên CẢ TỪ (chữ có sẵn + chữ học sinh điền) — server chấm text với cả từ.
import { useEffect, useRef, useState } from 'react';
import type { QuestionProps } from './index';
import { cx } from '../student/components/ui';
import { CheckButton, Instruction } from './parts';

export default function G({ question: q, onSubmit, disabled, result, quick }: QuestionProps) {
  const masked = q.prompt.masked ?? '';
  const chars = [...masked];
  const holes = chars.map((c, i) => (c === '_' ? i : -1)).filter((i) => i >= 0);
  const [fill, setFill] = useState<Record<number, string>>({});
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const lock = disabled || !!result || !!quick;

  useEffect(() => {
    refs.current[holes[0] ?? -1]?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.qid]);

  const focusHole = (k: number) => {
    const i = holes[k];
    if (i !== undefined) refs.current[i]?.focus();
  };
  const full = holes.every((i) => fill[i]);
  const text = chars.map((c, i) => (c === '_' ? (fill[i] ?? '') : c)).join('');
  const submit = () => full && !lock && onSubmit({ qid: q.qid, text });
  const verdict = result ? result.correct : quick?.correct;
  const tone = verdict === undefined ? null : verdict ? 'ok' : 'bad';
  // Ô co lại theo độ dài từ để vừa một dòng trên màn 360px
  const cell = chars.length > 10 ? 'w-7' : chars.length > 8 ? 'w-8' : 'w-9';

  return (
    <div>
      <Instruction>Điền các chữ còn thiếu:</Instruction>
      <p className="mb-5 text-center text-2xl font-bold">{q.prompt.meaningVi}</p>
      <div className="flex flex-wrap justify-center gap-0.5" aria-label="Từ cần điền">
        {chars.map((c, i) => {
          if (c === ' ') return <span key={i} className="w-3" />;
          if (c !== '_')
            return (
              <span key={i} className={cx('flex h-12 items-center justify-center font-serif text-[30px] font-bold text-ink-2', cell)}>
                {c}
              </span>
            );
          const k = holes.indexOf(i);
          return (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={fill[i] ?? ''}
              disabled={lock}
              maxLength={2}
              aria-label={`Chữ thứ ${i + 1}`}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint={k === holes.length - 1 ? 'done' : 'next'}
              onChange={(e) => {
                const v = e.target.value.slice(-1).toLowerCase();
                setFill((f) => ({ ...f, [i]: v }));
                if (v) focusHole(k + 1);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !fill[i]) {
                  e.preventDefault();
                  focusHole(k - 1);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
              className={cx(
                cell,
                'h-12 rounded-md border bg-surface-2 text-center font-serif text-[28px] font-bold text-brand-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25',
                tone === 'ok' ? 'border-ok' : tone === 'bad' ? 'border-bad' : 'border-line',
              )}
              style={{ fontSize: 28 }}
            />
          );
        })}
      </div>
      {!result && !quick && <CheckButton disabled={!full || disabled} onClick={submit} />}
    </div>
  );
}
