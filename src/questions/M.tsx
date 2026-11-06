// M · Chia dạng từ (Vận dụng): câu có chỗ trống + từ gốc, gõ đúng dạng
import type { QuestionProps } from './index';
import { Instruction, Sentence, TypeBox } from './parts';

export default function M({ question: q, onSubmit, disabled, result }: QuestionProps) {
  return (
    <div>
      <Instruction>Viết dạng đúng của từ trong ngoặc</Instruction>
      <div className="mb-5 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
        <Sentence text={q.prompt.sentence ?? ''} />
        <p className="mt-3 text-sm text-ink-2">
          Từ gốc: <b className="text-base font-bold text-brand-ink">({q.prompt.baseWord})</b>
        </p>
      </div>
      <TypeBox key={q.qid} done={!!result} disabled={disabled} onSubmit={(text) => onSubmit({ qid: q.qid, text })} />
    </div>
  );
}
