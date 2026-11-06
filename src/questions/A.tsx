// A · Từ → nghĩa (Nhớ): chọn nghĩa tiếng Việt
import type { QuestionProps } from './index';
import { POS_VI } from '../student/components/WordCardView';
import { ChoiceList, Instruction } from './parts';

export default function A({ question: q, onSubmit, disabled, result }: QuestionProps) {
  return (
    <div>
      <Instruction>Chọn nghĩa đúng của từ</Instruction>
      <div className="mb-6 text-center">
        <p className="text-3xl font-bold">{q.prompt.word}</p>
        {q.prompt.pos && <p className="mt-1 text-sm text-ink-3">{POS_VI[q.prompt.pos]}</p>}
      </div>
      <ChoiceList options={q.options ?? []} disabled={disabled} result={result} onSubmit={(optionId) => onSubmit({ qid: q.qid, optionId })} />
    </div>
  );
}
