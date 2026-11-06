// Hiệu ứng chúc mừng. Tôn trọng "giảm chuyển động" của máy: khi bật thì không bắn pháo giấy.
import confetti from 'canvas-confetti';

const COLORS = ['#c9a24a', '#1f4e52', '#7b2d34', '#f3e9d2', '#2f6b6f'];

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** small = Pass từ · medium = nộp đúng hạn / huy hiệu mới · big = tuần hoàn hảo */
export function celebrate(level: 'small' | 'medium' | 'big' = 'small') {
  if (reducedMotion()) return;
  if (level === 'small') {
    void confetti({ particleCount: 60, spread: 70, startVelocity: 35, origin: { y: 0.7 }, colors: COLORS, disableForReducedMotion: true });
    return;
  }
  if (level === 'medium') {
    void confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors: COLORS, disableForReducedMotion: true });
    return;
  }
  const end = Date.now() + 1800;
  const frame = () => {
    void confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0 }, colors: COLORS, disableForReducedMotion: true });
    void confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 }, colors: COLORS, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
