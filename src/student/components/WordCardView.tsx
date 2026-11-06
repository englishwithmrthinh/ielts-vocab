import type { PartOfSpeech, WordCard } from '@shared/types';
import { Star4 } from './Art';
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
          <span key={i} className={stressed ? 'font-bold text-brand-ink underline decoration-gold decoration-2 underline-offset-4' : ''}>
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
      <b className="font-bold not-italic text-brand-ink">{sentence.slice(i, i + word.length)}</b>
      {sentence.slice(i + word.length)}
    </>
  );
}

/** Thẻ từ — trình bày như một mục từ điển. big = màn xem trước; mặc định = thẻ gọn sau mỗi câu */
export function WordCardView({
  card,
  big,
  variant,
  className,
}: {
  card: WordCard;
  big?: boolean;
  /** 'detail' = thẻ chi tiết ở Kho từ: gọn, ảnh vuông bên trái cạnh từ */
  variant?: 'detail';
  className?: string;
}) {
  if (variant === 'detail') return <DetailCard card={card} className={className} />;
  return (
    <article className={cx('overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)] ring-1 ring-line', className)}>
      {card.imageUrl && big && (
        <div className="bg-surface-2 p-3">
          <img src={card.imageUrl} alt="" className="aspect-[5/4] w-full rounded-md object-cover ring-1 ring-gold/50" draggable={false} />
        </div>
      )}
      <div className={big ? 'p-5' : 'p-4'}>
        <div className="flex items-start gap-3">
          {card.imageUrl && !big && (
            <img src={card.imageUrl} alt="" className="size-14 shrink-0 rounded-md object-cover ring-1 ring-gold/50" draggable={false} />
          )}
          <div className="min-w-0 flex-1">
            <h3 className={cx('font-serif font-bold leading-[1.05] text-ink', big ? 'text-[40px]' : 'text-[30px]')}>{card.word}</h3>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-ink-2">
              {card.ipa && <span className="text-sm">{card.ipa}</span>}
              <span className="font-serif text-[17px] italic text-accent">{POS_VI[card.pos]}</span>
            </p>
          </div>
          <AudioButton url={card.audioUrl ?? `tts:${card.word}`} label={`Nghe từ ${card.word}`} />
        </div>
        {card.syllables && (
          <p className={cx('mt-2 tracking-wide text-ink-2', big ? 'text-lg' : 'text-base')}>
            <Syllables text={card.syllables} />
          </p>
        )}
        <div className="mt-3 border-t border-line pt-3">
          <p className={cx('font-semibold text-ink', big ? 'text-xl' : 'text-[17px]')}>
            <Star4 className="mr-1.5 inline size-3.5 align-[-1px] text-gold" />
            {card.meaningVi}
          </p>
          {card.example && (
            <p className={cx('mt-2 font-serif italic leading-snug text-ink-2', big ? 'text-[20px]' : 'text-[18px]')}>
              “<Highlight sentence={card.example} word={card.word} />”
            </p>
          )}
        </div>
        {card.wordFamily.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="label-caps self-center text-ink-3">Họ từ</span>
            {card.wordFamily.map((f) => (
              <span key={f.form} className="rounded-full bg-blush px-2.5 py-0.5 text-sm text-blush-ink">
                <b className="font-semibold">{f.form}</b> <i className="font-serif">{f.pos}</i>
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

/** Thẻ chi tiết gọn: ảnh, từ, nghĩa, ví dụ đặt sát nhau */
function DetailCard({ card, className }: { card: WordCard; className?: string }) {
  return (
    <article className={cx('rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-line', className)}>
      <div className="flex items-start gap-4">
        {card.imageUrl && (
          <img src={card.imageUrl} alt="" className="size-28 shrink-0 rounded-lg object-cover ring-1 ring-gold/50 sm:size-32" draggable={false} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="break-words font-serif text-[32px] font-bold leading-[1.05] text-ink">{card.word}</h3>
            <AudioButton url={card.audioUrl ?? `tts:${card.word}`} label={`Nghe từ ${card.word}`} />
          </div>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-ink-2">
            {card.ipa && <span className="text-sm">{card.ipa}</span>}
            <span className="font-serif text-[16px] italic text-accent">{POS_VI[card.pos]}</span>
          </p>
          {card.syllables && (
            <p className="mt-0.5 text-[15px] tracking-wide text-ink-2">
              <Syllables text={card.syllables} />
            </p>
          )}
          <p className="mt-2 text-[18px] font-semibold leading-snug text-ink">
            <Star4 className="mr-1.5 inline size-3.5 align-[-1px] text-gold" />
            {card.meaningVi}
          </p>
        </div>
      </div>
      {card.example && (
        <p className="mt-3 border-t border-line pt-3 font-serif text-[19px] italic leading-snug text-ink-2">
          “<Highlight sentence={card.example} word={card.word} />”
        </p>
      )}
      {card.wordFamily.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="label-caps self-center text-ink-3">Họ từ</span>
          {card.wordFamily.map((f) => (
            <span key={f.form} className="rounded-full bg-blush px-2.5 py-0.5 text-sm text-blush-ink">
              <b className="font-semibold">{f.form}</b> <i className="font-serif">{f.pos}</i>
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
