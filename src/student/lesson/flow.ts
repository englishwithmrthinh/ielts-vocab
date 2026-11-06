// Tăng tốc màn làm bài: tải trước câu tiếp theo (prefetch) + ảnh/audio của câu đó.
import type { NextQuestionResponse, Question } from '@shared/types';

/** Giữ tham chiếu để trình duyệt không bỏ cache ảnh/audio vừa tải trước */
const keep: (HTMLImageElement | HTMLAudioElement)[] = [];

export function preloadMedia(q: Question | null | undefined) {
  if (!q) return;
  const urls = [q.prompt.imageUrl, q.prompt.audioUrl].filter((u): u is string => !!u && !u.startsWith('tts:'));
  for (const u of urls) {
    if (/\.(mp3|m4a|ogg|wav)(\?|$)/i.test(u) || u === q.prompt.audioUrl) {
      const a = new Audio();
      a.preload = 'auto';
      a.src = u;
      keep.push(a);
    } else {
      const img = new Image();
      img.decoding = 'async';
      img.src = u;
      keep.push(img);
    }
  }
  while (keep.length > 12) keep.shift();
}

/** Một câu "tải trước": bắt đầu gọi ngay, dùng khi học sinh bấm Tiếp tục */
export interface Prefetch {
  promise: Promise<NextQuestionResponse>;
  value?: NextQuestionResponse;
  failed?: boolean;
}

export function prefetch(fn: () => Promise<NextQuestionResponse>): Prefetch {
  const p: Prefetch = { promise: fn() };
  p.promise.then(
    (r) => {
      p.value = r;
      preloadMedia(r.question);
    },
    () => {
      p.failed = true;
    },
  );
  return p;
}
