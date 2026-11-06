// I · Ảnh – gõ (Nhớ lại): nhìn ảnh + loại từ, gõ từ
import type { QuestionProps } from './index';
import { POS_VI } from '../student/components/WordCardView';
import { Instruction, Picture, TypeBox } from './parts';

export default function I({ question: q, onSubmit, disabled, result }: QuestionProps) {
  return (
    <div>
      <Instruction>Nhìn ảnh, gõ từ tiếng Anh</Instruction>
      <div className="mb-3">
        <Picture url={q.prompt.imageUrl} />
      </div>
      {q.prompt.pos && (
        <p className="mb-4 text-center text-sm text-ink-2">
          Loại từ: <b className="font-semibold text-brand-ink">{POS_VI[q.prompt.pos]}</b>
        </p>
      )}
      <TypeBox key={q.qid} done={!!result} disabled={disabled} onSubmit={(text) => onSubmit({ qid: q.qid, text })} />
    </div>
  );
}
