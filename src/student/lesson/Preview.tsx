// Xem trước từ mới: thẻ lớn, "Từ tiếp theo", vuốt trái/phải, "Bắt đầu làm bài" luôn bấm được.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import type { WordCard } from '@shared/types';
import { Button, cx } from '../components/ui';
import { WordCardView } from '../components/WordCardView';

export function Preview({ cards, onStart, busy }: { cards: WordCard[]; onStart: () => void; busy?: boolean }) {
  const [i, setI] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const last = i === cards.length - 1;
  const go = (d: number) => setI((v) => Math.max(0, Math.min(cards.length - 1, v + d)));
  const card = cards[i]!;

  return (
    <div className="flex min-h-[calc(100dvh-64px)] flex-col">
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-sm font-semibold text-ink-2">
          Từ mới hôm nay · <span className="text-brand-ink">{i + 1}/{cards.length}</span>
        </p>
        <div className="flex gap-1" aria-hidden>
          {cards.map((_, k) => (
            <span key={k} className={cx('h-1.5 rounded-full transition-all', k === i ? 'w-5 bg-brand' : 'w-1.5 bg-brand-tint')} />
          ))}
        </div>
      </div>

      <div
        className="relative flex-1"
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) touch.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const s = touch.current;
          const t = e.changedTouches[0];
          touch.current = null;
          if (!s || !t) return;
          const dx = t.clientX - s.x;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(t.clientY - s.y)) go(dx < 0 ? 1 : -1);
        }}
      >
        <WordCardView key={card.wordId} card={card} big className="animate-[fadeIn_.2s_ease-out]" />
        {i > 0 && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Từ trước"
            className="absolute left-2 top-[30%] flex size-10 items-center justify-center rounded-full bg-surface/90 text-ink shadow-[var(--shadow-card)]"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-4 space-y-2 bg-page/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        {!last && (
          <Button variant="secondary" block onClick={() => go(1)}>
            Từ tiếp theo <ChevronRight className="size-5" aria-hidden />
          </Button>
        )}
        <Button block size="lg" onClick={onStart} disabled={busy}>
          Bắt đầu làm bài
        </Button>
      </div>
    </div>
  );
}
