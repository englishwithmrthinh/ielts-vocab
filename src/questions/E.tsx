// E · Nghĩa → từ (Nhớ lại): nhìn nghĩa, chọn từ tiếng Anh
import type { QuestionProps } from './index';
import { POS_VI } from '../student/components/WordCardView';
import { ChoiceList, Instruction } from './parts';

export default function E({ question: q, onSubmit, disabled, result }: QuestionProps) {
  return (
    <div>
      <Instruction>Từ tiếng Anh nào có nghĩa này?</Instruction>
      <div className="mb-6 text-center">
        <p className="text-2xl font-bold">{q.prompt.meaningVi}</p>
        {q.prompt.pos && <p className="mt-1 text-sm text-ink-3">{POS_VI[q.prompt.pos]}</p>}
      </div>
      <ChoiceList big options={q.options ?? []} disabled={disabled} result={result} onSubmit={(optionId) => onSubmit({ qid: q.qid, optionId })} />
    </div>
  );
}
