// Minh hoạ trang trí: ảnh trong /public/art (Gemini vẽ) + vài hình SVG nét đơn giản.
// Tất cả chỉ để trang trí → alt="" / aria-hidden.
import type { ReactNode, SVGProps } from 'react';
import { cx } from './ui';

export const ART = {
  banner: '/art/banner.webp',
  bookGlasses: '/art/spot-book-glasses.webp',
  bookPen: '/art/spot-book-pen.webp',
  emptyShelf: '/art/empty-shelf.webp',
};

/** Ngôi sao bốn cánh */
export function Star4({ className, ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...p}>
      <path d="M12 1.5c.6 4.9 2.1 7.9 10.5 10.5C14.1 14.6 12.6 17.6 12 22.5 11.4 17.6 9.9 14.6 1.5 12 9.9 9.4 11.4 6.4 12 1.5Z" fill="currentColor" />
    </svg>
  );
}

/** Trăng tròn có quầng */
export function Moon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={className}>
      <circle cx="20" cy="20" r="19" fill="none" stroke="currentColor" strokeOpacity=".25" />
      <circle cx="20" cy="20" r="13" fill="currentColor" />
    </svg>
  );
}

/** Lá cành */
export function Leaf({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M5 19c8 0 14-6 14-14C11 5 5 11 5 19Z" />
      <path d="M5 19 14 10" />
    </svg>
  );
}

/** Dải đầu trang xanh cổ vịt có minh hoạ sách / kính / bút / trăng */
export function Banner({ children, thin, className }: { children?: ReactNode; thin?: boolean; className?: string }) {
  return (
    <div
      className={cx('relative overflow-hidden bg-primary text-cream', thin ? 'h-14' : 'min-h-[108px]', className)}
      style={thin ? undefined : { backgroundImage: `url(${ART.banner})`, backgroundSize: 'auto 100%', backgroundPosition: 'right center', backgroundRepeat: 'no-repeat' }}
    >
      {/* phủ chuyển màu bên trái để chữ luôn đọc rõ dù ảnh banner rộng/hẹp */}
      {!thin && <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-primary via-primary/85 to-transparent" />}
      <div className="relative">{children}</div>
    </div>
  );
}

/** Ảnh minh hoạ góc (sách + kính, sách + bút, kệ sách) */
export function Spot({ src, className }: { src: string; className?: string }) {
  return <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className={cx('pointer-events-none select-none', className)} />;
}
