// Phần hiện sau mỗi câu: Đúng/Sai, đáp án, dòng nhắc (hint), tô đỏ chữ sai (diff), thẻ từ, nút báo 2 đáp án.
import { Check, Flag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AnswerResult, Question } from '@shared/types';
import { HINT_TEXT } from '@shared/grading';
import { errorText, studentApi } from '../api';
import { cx } from '../components/ui';
import { PassStamp } from '../components/PassStamp';
import { WordCardView } from '../components/WordCardView';
import { COPY, pick } from '../lib/copy';

const CHOICE_TYPES = ['A', 'B', 'C', 'E', 'J'];

export function ResultPanel({ question, result }: { question: Question; result: AnswerResult }) {
  const ref = useRef<HTMLDivElement>(null);
  const [flag, setFlag] = useState<'idle' | 'sending' | 'sent' | string>('idle');
  const isChoice = CHOICE_TYPES.includes(question.type);
  const cards = result.wordCards?.length ? result.wordCards : [result.wordCard];
  const scored = question.mode === 'graded' || question.mode === 'retry';

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const sendFlag = async () => {
    setFlag('sending');
    try {
      await studentApi.flag(question.qid);
      setFlag('sent');
    } catch (e) {
      setFlag(errorText(e));
    }
  };

  return (
    <div ref={ref} className="mt-5 scroll-mt-20 space-y-3 animate-[fadeIn_.2s_ease-out]">
      <div className={cx('rounded-[var(--radius-card)] p-4 ring-1', result.correct ? 'bg-ok-bg ring-ok/30' : 'bg-bad-bg ring-bad/30')} role="status" aria-live="polite">
        <div className="flex items-center justify-between gap-2">
          <p className={cx('flex items-center gap-2.5 text-lg font-bold', result.correct ? 'text-ok-ink' : 'text-bad-ink')}>
            <span className={cx('flex size-7 items-center justify-center rounded-full text-white', result.correct ? 'bg-ok' : 'bg-bad')}>
              {result.correct ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <X className="size-4" strokeWidth={3} aria-hidden />}
            </span>
            {result.perWord && !result.correct
              ? `Đúng ${result.perWord.filter((p) => p.correct).length}/${result.perWord.length}`
              : pick(result.correct ? COPY.correct : COPY.wrong, question.qid)}
          </p>
          {result.xp > 0 && <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-sm font-bold text-gold-ink ring-1 ring-gold/40">+{result.xp} XP</span>}
        </div>

        {result.passed && (
          <div className="mt-3 flex items-center gap-3">
            <PassStamp />
            <p className="font-serif text-lg font-semibold italic text-ok-ink">{pick(COPY.word_passed, question.qid)}</p>
          </div>
        )}

        {!result.correct && (
          <div className="mt-2 space-y-1.5 text-ink">
            {result.diff && result.diff.length > 0 && (
              <p className="text-base">
                <span className="text-ink-2">Bạn gõ: </span>
                <span className="font-serif text-[22px] font-semibold tracking-wide">
                  {result.diff.map((d, i) => (
                    <span key={i} className={d.ok ? '' : 'rounded bg-bad/20 font-bold text-bad-ink underline decoration-bad decoration-2'}>
                      {d.char === ' ' ? ' ' : d.char}
                    </span>
                  ))}
                </span>
              </p>
            )}
            <p className="text-base">
              <span className="text-ink-2">Đáp án: </span>
              <b className="font-serif text-[24px] font-bold">{result.expected}</b>
            </p>
            {result.hint && <p className="text-sm font-medium text-bad-ink">{HINT_TEXT[result.hint]}</p>}
          </div>
        )}
        {!scored && <p className="mt-2 text-xs text-ink-2">Câu này không tính điểm.</p>}
      </div>

      <div className="space-y-2">
        {cards.map((c) => (
          <WordCardView key={c.wordId} card={c} />
        ))}
      </div>

      {isChoice && !result.correct && scored && (
        <div className="text-center">
          {flag === 'sent' ? (
            <p className="text-sm text-ink-2">Đã gửi thầy xem lại. Câu này sẽ không tính sai nếu thầy đồng ý.</p>
          ) : (
            <button
              type="button"
              onClick={sendFlag}
              disabled={flag === 'sending'}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink-2"
            >
              <Flag className="size-3.5" aria-hidden /> Câu này có 2 đáp án đúng
            </button>
          )}
          {flag !== 'idle' && flag !== 'sending' && flag !== 'sent' && <p className="text-xs text-bad-ink">{flag}</p>}
        </div>
      )}
    </div>
  );
}
