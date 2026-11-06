// Hiệu ứng Pass một từ: con dấu sáp đỏ rượu "PASS" đóng xuống + vài ngôi sao vàng kim lấp lánh.
// Dưới 1,2 giây, chỉ CSS. Giảm chuyển động: animation bị tắt trong theme.css → dấu hiện yên.
import { Star4 } from './Art';
import { WaxSeal } from './WaxSeal';

const STARS = [
  { x: -18, y: -10, s: 14, d: 0.15 },
  { x: 62, y: -14, s: 10, d: 0.3 },
  { x: 70, y: 44, s: 13, d: 0.22 },
  { x: -14, y: 50, s: 9, d: 0.38 },
];

export function PassStamp() {
  return (
    <span className="relative inline-block size-[60px]" role="img" aria-label="Đã thuộc từ này">
      <span className="absolute inset-0 animate-[stamp_.55s_cubic-bezier(.2,.9,.3,1.2)_both]">
        <WaxSeal text="PASS" size={60} />
      </span>
      {STARS.map((st, i) => (
        <Star4
          key={i}
          className="absolute text-gold opacity-0 animate-[twinkle_.9s_ease-out_both]"
          style={{ left: st.x, top: st.y, width: st.s, height: st.s, animationDelay: `${st.d}s` }}
        />
      ))}
    </span>
  );
}
