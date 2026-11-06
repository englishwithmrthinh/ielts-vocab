// Lưới "bảng ảnh" ở Kho từ: ảnh vuông nhỏ bên trái, từ + nghĩa hiện ĐỦ (cho xuống dòng, không cắt "…").
// Thay cho Infographic ở khu học sinh vì ô Infographic dành ảnh lớn, chữ bị cắt khi xem trên điện thoại.
import type { MyWordsResponse } from '@shared/types';
import { POS_VI } from './WordCardView';
import { cx } from './ui';

type Word = MyWordsResponse['words'][number];

export function WordGrid({ words, hideMeaning, onOpen }: { words: Word[]; hideMeaning?: boolean; onOpen: (w: Word) => void }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {words.map((w) => (
        <li key={w.wordId}>
          <button
            type="button"
            onClick={() => onOpen(w)}
            className="flex h-full w-full items-start gap-3 rounded-xl bg-surface p-2.5 text-left shadow-[var(--shadow-card)] ring-1 ring-line transition hover:ring-brand-soft active:bg-brand-wash"
          >
            {w.imageUrl ? (
              <img src={w.imageUrl} alt="" loading="lazy" className="size-20 shrink-0 rounded-lg bg-surface-2 object-cover ring-1 ring-gold/40" />
            ) : (
              <span aria-hidden className="size-20 shrink-0 rounded-lg bg-surface-2 ring-1 ring-line" />
            )}
            <span className="min-w-0 flex-1 py-0.5">
              <span className="block break-words font-serif text-[21px] font-bold leading-tight text-ink">{w.word}</span>
              <span className="mt-0.5 block font-serif text-[14px] italic text-accent">{POS_VI[w.pos]}</span>
              <span
                className={cx(
                  'mt-1 block break-words text-[15px] leading-snug text-ink-2 transition',
                  hideMeaning && 'select-none rounded bg-surface-2 text-transparent',
                )}
              >
                {w.meaningVi}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
