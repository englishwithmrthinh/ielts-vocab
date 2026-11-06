import { Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cx } from './ui';

/** iPhone/iPad (kể cả iPad báo là Mac): trình duyệt chỉ cho phát sau khi người dùng chạm */
export const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** Dữ liệu giả dùng "tts:<từ>" → đọc bằng giọng máy của trình duyệt */
function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* trình duyệt không hỗ trợ */
  }
}

/**
 * Nút nghe. Tải trước audio khi hiện. autoPlay chỉ thử trên máy không phải iOS;
 * trên iOS học sinh phải chạm nút (yêu cầu của Safari).
 */
export function AudioButton({
  url,
  autoPlay,
  size = 'md',
  label = 'Nghe',
  className,
}: {
  url: string | null | undefined;
  autoPlay?: boolean;
  size?: 'md' | 'lg';
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const tts = url?.startsWith('tts:') ? url.slice(4) : null;

  useEffect(() => {
    if (!url || tts) return;
    const a = new Audio(url);
    a.preload = 'auto';
    a.onplay = () => setPlaying(true);
    a.onended = a.onpause = () => setPlaying(false);
    ref.current = a;
    return () => {
      a.pause();
      ref.current = null;
    };
  }, [url, tts]);

  const play = () => {
    if (tts) {
      setPlaying(true);
      speak(tts);
      setTimeout(() => setPlaying(false), 900);
      return;
    }
    const a = ref.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => setPlaying(false));
  };

  useEffect(() => {
    if (!autoPlay || IS_IOS || !url) return;
    const t = setTimeout(() => {
      if (tts) return; // không tự đọc giọng máy
      ref.current?.play().catch(() => {
        /* trình duyệt chặn tự phát — học sinh bấm nút */
      });
    }, 250);
    return () => clearTimeout(t);
  }, [autoPlay, url, tts]);

  if (!url) return null;
  const big = size === 'lg';
  return (
    <button
      type="button"
      onClick={play}
      aria-label={label}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-95',
        big ? 'h-20 w-20 bg-primary text-white shadow-[0_4px_0_var(--color-primary-edge)]' : 'h-10 w-10 bg-brand-tint text-brand-ink',
        playing && 'ring-4 ring-brand-soft/60',
        className,
      )}
    >
      <Volume2 className={big ? 'size-9' : 'size-5'} aria-hidden />
    </button>
  );
}
