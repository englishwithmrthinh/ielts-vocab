/** Mã QR vẽ ngay trên trình duyệt (SVG), không gọi dịch vụ ngoài. */
import qrcode from 'qrcode-generator';

export default function QrCode({ text, size = 96, className = '' }: { text: string; size?: number; className?: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} className={className} role="img" aria-label={`Mã QR: ${text}`} shapeRendering="crispEdges">
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
