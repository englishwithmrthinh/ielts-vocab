import { ArrowLeft, Hammer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui';

export default function Placeholder({ title, stage, back }: { title: string; stage: number; back?: boolean }) {
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-md px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      {back && (
        <button onClick={() => nav('/hoc')} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-ink">
          <ArrowLeft className="size-4" aria-hidden /> Trang chủ
        </button>
      )}
      <h1 className="mb-4 text-[22px] font-bold">{title}</h1>
      <Card className="flex items-center gap-3 text-ink-2">
        <Hammer className="size-5 text-brand" aria-hidden />
        Màn này sẽ làm ở giai đoạn {stage}.
      </Card>
    </div>
  );
}
