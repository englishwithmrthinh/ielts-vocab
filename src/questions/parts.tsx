// Khối dùng chung cho 13 dạng câu.
import { Check, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AnswerResult, Option } from '@shared/types';
import type { QuickResult } from './index';
import { Button, cx } from '../student/components/ui';

export function Instruction({ children }: { children: ReactNode }) {
  return <p className="label-caps mb-4 text-ink-3">{children}</p>;
}

export function CheckButton({ disabled, onClick, label = 'Kiểm tra' }: { disabled?: boolean; onClick: () => void; label?: string }) {
  return (
    <Button block size="lg" className="mt-5" disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  );
}

/** Câu có "___": thay chỗ trống bằng `blank` (mặc định là gạch chân trống) */
export function Sentence({ text, blank, className }: { text: string; blank?: ReactNode; className?: string }) {
  const [a, b] = text.split('___');
  return (
    <p className={cx('font-serif text-[22px] font-medium leading-[1.45] text-ink', className)}>
      {a}
      {blank ?? <span className="mx-1 inline-block w-20 border-b-2 border-brand align-baseline" aria-label="chỗ trống" />}
      {b}
    </p>
  );
}

/** Danh sách đáp án chọn 1 (A, B, C, E, J). Chọn → bấm Kiểm tra. */
export function ChoiceList({
  options,
  onSubmit,
  disabled,
  result,
  quick,
  big,
}: {
  options: Option[];
  onSubmit: (optionId: string) => void;
  disabled?: boolean;
  result?: AnswerResult;
  quick?: QuickResult;
  big?: boolean;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const done = !!result || !!quick;
  return (
    <>
      <div className="grid gap-2.5" role="radiogroup">
        {options.map((o, i) => {
          const isSel = sel === o.id;
          // Có kết quả server: tô ô đúng theo correctOptionId. Mới chấm nhanh: chỉ biết ô đã chọn đúng hay sai.
          const isRight = result
            ? result.correctOptionId
              ? o.id === result.correctOptionId
              : o.text === result.expected
            : !!quick && isSel && quick.correct;
          const correct = result ? result.correct : quick?.correct;
          const isWrong = done && isSel && correct === false;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={isSel}
              disabled={disabled || done}
              onClick={() => setSel(o.id)}
              className={cx(
                'flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left font-medium transition',
                big ? 'font-serif text-[22px] font-semibold' : 'text-base',
                !done && (isSel ? 'border-brand bg-brand-tint ring-1 ring-brand' : 'border-line bg-surface-2 active:border-brand'),
                isRight && 'border-ok bg-ok-bg text-ok-ink ring-1 ring-ok',
                isWrong && 'border-bad bg-bad-bg text-bad-ink ring-1 ring-bad',
                done && !isRight && !isWrong && 'border-line bg-surface-2 opacity-60',
              )}
            >
              <span
                className={cx(
                  'flex size-7 shrink-0 items-center justify-center rounded-full font-sans text-xs font-bold',
                  isRight ? 'bg-ok text-white' : isWrong ? 'bg-bad text-white' : isSel ? 'bg-primary text-white' : 'bg-surface text-ink-2 ring-1 ring-line',
                )}
              >
                {isRight ? <Check className="size-4" aria-hidden /> : isWrong ? <X className="size-4" aria-hidden /> : 'ABCD'[i]}
              </span>
              <span>{o.text}</span>
            </button>
          );
        })}
      </div>
      {!done && <CheckButton disabled={!sel || disabled} onClick={() => sel && onSubmit(sel)} />}
    </>
  );
}

/** Ô gõ chuẩn cho iPhone: tắt tự sửa/viết hoa/chính tả, chữ ≥16px, Enter = nộp */
export function TypeBox({
  onSubmit,
  disabled,
  done,
  placeholder = 'Gõ từ vào đây',
  prefix,
  autoFocus = true,
  tone,
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  done?: boolean;
  /** đúng/sai sau khi chấm → viền xanh/đỏ */
  tone?: boolean;
  placeholder?: string;
  prefix?: string;
  autoFocus?: boolean;
}) {
  const [v, setV] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  const submit = () => {
    if (v.trim() && !disabled && !done) onSubmit(v);
  };
  return (
    <>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-ink-3" aria-hidden>
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled || done}
          placeholder={placeholder}
          aria-label="Câu trả lời"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
          inputMode="text"
          className={cx(
            'h-14 w-full rounded-xl border bg-surface-2 px-4',
            tone === true ? 'border-ok ring-2 ring-ok/30' : tone === false ? 'border-bad ring-2 ring-bad/30' : 'border-line',
            'font-serif text-[24px] font-semibold text-ink outline-none transition placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-ink-3/80 focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:opacity-70',
          )}
          style={{ fontSize: 24 }}
        />
      </div>
      {!done && <CheckButton disabled={!v.trim() || disabled} onClick={submit} />}
    </>
  );
}

export function Picture({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt="Ảnh gợi ý"
      className="mx-auto aspect-[5/4] w-full max-w-xs rounded-lg bg-brand-tint object-cover p-1 ring-1 ring-gold/60 [box-shadow:0_0_0_6px_var(--color-surface),0_0_0_7px_var(--color-line)]"
      draggable={false}
    />
  );
}
