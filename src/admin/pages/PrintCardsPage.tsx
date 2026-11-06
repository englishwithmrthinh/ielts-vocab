/** Trang in thẻ mã + PIN: lưới thẻ cắt được, khổ A4 dọc, 10 thẻ/trang. */
import { Link } from 'react-router-dom';
import { takePrintCards } from '../lib/printStore';
import { Button } from '../ui';

export default function PrintCardsPage() {
  const cards = takePrintCards();
  const site = typeof window !== 'undefined' ? window.location.host : '';

  return (
    <div className="min-h-dvh bg-slate-100 print:bg-white">
      <style>{'@page { size: A4 portrait; margin: 10mm; }'}</style>
      <div className="mx-auto flex max-w-[190mm] flex-wrap items-center justify-between gap-3 px-4 py-4 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">In thẻ đăng nhập · {cards.length} thẻ</h1>
          <p className="text-sm text-slate-500">Cắt theo đường viền. Sau khi in xong, PIN không xem lại được.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/hoc-sinh"><Button variant="secondary">Quay lại</Button></Link>
          <Button disabled={!cards.length} onClick={() => window.print()}>In</Button>
        </div>
      </div>
      {cards.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-slate-500">
          Chưa có thẻ nào chờ in. Vào <Link className="text-teal-700 underline" to="/admin/hoc-sinh">Học sinh</Link> và bấm “In thẻ”.
        </p>
      ) : (
        <div className="mx-auto grid max-w-[190mm] grid-cols-2 gap-0 bg-white p-0 shadow print:shadow-none">
          {cards.map((c) => (
            <div key={c.id} className="break-inside-avoid border border-dashed border-slate-400 p-[6mm]" style={{ height: '54mm' }}>
              <p className="text-[9pt] font-medium uppercase tracking-wider text-teal-700">IELTS Vocab · Thẻ đăng nhập</p>
              <p className="mt-1 truncate text-[13pt] font-semibold text-slate-900">{c.name}</p>
              <div className="mt-3 flex gap-6">
                <div>
                  <p className="text-[8pt] uppercase text-slate-500">Mã</p>
                  <p className="font-mono text-[20pt] font-bold leading-none tracking-wider">{c.code}</p>
                </div>
                <div>
                  <p className="text-[8pt] uppercase text-slate-500">PIN</p>
                  <p className="font-mono text-[20pt] font-bold leading-none tracking-[0.2em]">{c.pin}</p>
                </div>
              </div>
              <p className="mt-3 text-[8pt] text-slate-500">Vào {site}/hoc · Giữ kín PIN, không cho bạn khác mượn.</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
