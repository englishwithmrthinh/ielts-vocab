// B · Ảnh → từ (Nhớ): nhìn ảnh, chọn từ
import type { QuestionProps } from './index';
import { ChoiceList, Instruction, Picture } from './parts';

export default function B({ question: q, onSubmit, disabled, result }: QuestionProps) {
  return (
    <div>
      <Instruction>Ảnh này là từ nào?</Instruction>
      <div className="mb-5">
        <Picture url={q.prompt.imageUrl} />
      </div>
      <ChoiceList options={q.options ?? []} disabled={disabled} result={result} onSubmit={(optionId) => onSubmit({ qid: q.qid, optionId })} />
    </div>
  );
}
