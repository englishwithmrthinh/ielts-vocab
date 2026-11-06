// M · Chia dạng từ (Vận dụng): câu có chỗ trống + từ gốc, gõ đúng dạng
import type { QuestionProps } from './index';
import { POS_VI } from '../student/components/WordCardView';
import { Instruction, Sentence, TypeBox } from './parts';

export default function M({ question: q, onSubmit, disabled, result, quick }: QuestionProps) {
  return (
    <div>
      <Instruction>Viết dạng đúng của từ trong ngoặc</Instruction>
      <div className="mb-5 rounded-xl border-l-4 border-gold/70 bg-surface-2/60 p-4">
        <Sentence text={q.prompt.sentence ?? ''} />
        <p className="mt-3 text-sm text-ink-2">
          Từ gốc: <b className="text-base font-bold text-brand-ink">({q.prompt.baseWord})</b>
          {q.prompt.pos && (
            <span className="ml-2 rounded-md bg-brand-tint px-1.5 py-0.5 text-xs font-semibold text-brand-ink" title="Loại từ cần điền">
              cần {POS_VI[q.prompt.pos]} ({q.prompt.pos})
            </span>
          )}
        </p>
      </div>
      <TypeBox key={q.qid} done={!!result || !!quick} tone={result ? result.correct : quick?.correct} disabled={disabled} onSubmit={(text) => onSubmit({ qid: q.qid, text })} />
    </div>
  );
}
