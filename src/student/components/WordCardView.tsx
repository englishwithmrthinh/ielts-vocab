import type { PartOfSpeech, WordCard } from '@shared/types';
import { AudioButton } from './AudioButton';
import { cx } from './ui';

export const POS_VI: Record<PartOfSpeech, string> = {
  n: 'danh từ', v: 'động từ', adj: 'tính từ', adv: 'trạng từ', prep: 'giới từ', conj: 'liên từ', phr: 'cụm từ',
};

/** "en·VI·ron·ment" → âm tiết in hoa là âm nhấn, tô đậm + màu */
export function Syllables({ text }: { text: string }) {
  const parts = text.split(/(·|\s+)/);
  return (
    <span aria-label={`Âm tiết: ${text.toLowerCase()}`}>
      {parts.map((p, i) => {
        if (p === '·') return <span key={i} className="px-0.5 text-ink-3">·</span>;
        if (/^\s+$/.test(p)) return <span key={i}> </span>;
        const stressed = /[A-Z]/.test(p) && p === p.toUpperCase();
        return (
          <span key={i} className={stressed ? 'font-bold text-brand-ink underline decoration-brand decoration-2 underline-offset-4' : ''}>
            {p.toLowerCase()}
          </span>
        );
      })}
    </span>
  );
}

/** Tô đậm từ trong câu ví dụ */
export function Highlight({ sentence, word }: { sentence: string; word: string }) {
  const i = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, i)}
      <b className="font-semibold text-brand-ink">{sentence.slice(i, i + word.length)}</b>
      {sentence.slice(i + word.length)}
    </>
  );
}

/** Thẻ từ. big = màn xem trước; mặc định = thẻ gọn sau mỗi câu */
export function WordCardView({ card, big, className }: { card: WordCard; big?: boolean; className?: string }) {
  return (
    <div className={cx('overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]', className)}>
      {card.imageUrl && big && (
        <img src={card.imageUrl} alt="" className="aspect-[5/4] w-full bg-brand-tint object-cover" draggable={false} />
      )}
      <div className={big ? 'p-5' : 'p-4'}>
        <div className="flex items-start gap-3">
          {card.imageUrl && !big && (
            <img src={card.imageUrl} alt="" className="size-14 shrink-0 rounded-xl bg-brand-tint object-cover" draggable={false} />
          )}
          <div className="min-w-0 flex-1">
            <p className={cx('font-bold leading-tight', big ? 'text-3xl' : 'text-xl')}>{card.word}</p>
            <p className="mt-1 text-sm text-ink-2">
              {card.ipa && <span className="mr-2">{card.ipa}</span>}
              <span className="rounded-md bg-brand-tint px-1.5 py-0.5 text-xs font-semibold text-brand-ink">{POS_VI[card.pos]}</span>
            </p>
          </div>
          <AudioButton url={card.audioUrl ?? `tts:${card.word}`} label={`Nghe từ ${card.word}`} />
        </div>
        {card.syllables && (
          <p className={cx('mt-3 tracking-wide', big ? 'text-xl' : 'text-base')}>
            <Syllables text={card.syllables} />
          </p>
        )}
        <p className={cx('mt-2 font-semibold', big ? 'text-xl' : 'text-base')}>{card.meaningVi}</p>
        {card.example && (
          <p className={cx('mt-2 text-ink-2', big ? 'text-base' : 'text-sm')}>
            <Highlight sentence={card.example} word={card.word} />
          </p>
        )}
        {card.wordFamily.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {card.wordFamily.map((f) => (
              <span key={f.form} className="rounded-lg bg-surface-2 px-2 py-1 text-sm ring-1 ring-line">
                <b className="font-semibold">{f.form}</b> <span className="text-ink-3">({f.pos})</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
