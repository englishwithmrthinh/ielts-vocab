// Khối dùng chung cho 13 dạng câu.
import { Check, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AnswerResult, Option } from '@shared/types';
import { Button, cx } from '../student/components/ui';

export function Instruction({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-sm font-semibold text-ink-2">{children}</p>;
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
    <p className={cx('text-lg leading-relaxed', className)}>
      {a}
      {blank ?? <span className="mx-1 inline-block w-20 border-b-2 border-ink-3 align-baseline" aria-label="chỗ trống" />}
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
  big,
}: {
  options: Option[];
  onSubmit: (optionId: string) => void;
  disabled?: boolean;
  result?: AnswerResult;
  big?: boolean;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const done = !!result;
  return (
    <>
      <div className="grid gap-2.5" role="radiogroup">
        {options.map((o, i) => {
          const isSel = sel === o.id;
          const isRight = done && o.text === result.expected;
          const isWrong = done && isSel && !result.correct;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={isSel}
              disabled={disabled || done}
              onClick={() => setSel(o.id)}
              className={cx(
                'flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 bg-surface px-4 py-3 text-left font-medium transition',
                big ? 'text-lg' : 'text-base',
                !done && (isSel ? 'border-brand bg-brand-wash' : 'border-line active:bg-brand-wash'),
                isRight && 'border-ok bg-ok-bg text-ok-ink',
                isWrong && 'border-bad bg-bad-bg text-bad-ink',
                done && !isRight && !isWrong && 'border-line opacity-60',
              )}
            >
              <span
                className={cx(
                  'flex size-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                  isRight ? 'bg-ok text-white' : isWrong ? 'bg-bad text-white' : isSel ? 'bg-primary text-white' : 'bg-surface-2 text-ink-2 ring-1 ring-line',
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
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  done?: boolean;
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
          className="h-14 w-full rounded-2xl border-2 border-line bg-surface px-4 text-lg font-medium text-ink outline-none transition placeholder:text-ink-3/70 focus:border-brand disabled:opacity-70"
          style={{ fontSize: 18 }}
        />
      </div>
      {!done && <CheckButton disabled={!v.trim() || disabled} onClick={submit} />}
    </>
  );
}

export function Picture({ url }: { url?: string }) {
  if (!url) return null;
  return <img src={url} alt="Ảnh gợi ý" className="mx-auto aspect-[5/4] w-full max-w-xs rounded-2xl bg-brand-tint object-cover" draggable={false} />;
}
