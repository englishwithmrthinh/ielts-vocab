// J · Chọn từ điền câu (Hiểu): câu ví dụ khuyết, chọn 1 trong 4
import type { QuestionProps } from './index';
import { ChoiceList, Instruction, Sentence } from './parts';

export default function J({ question: q, onSubmit, disabled, result, quick }: QuestionProps) {
  return (
    <div>
      <Instruction>Chọn từ điền vào chỗ trống</Instruction>
      <div className="mb-6 rounded-xl border-l-4 border-gold/70 bg-surface-2/60 p-4">
        <Sentence
          text={q.prompt.sentence ?? ''}
          blank={
            result ? (
              <b className="rounded bg-ok-bg px-1 text-ok-ink">{result.expected}</b>
            ) : undefined
          }
        />
      </div>
      <ChoiceList big options={q.options ?? []} disabled={disabled} result={result} quick={quick} onSubmit={(optionId) => onSubmit({ qid: q.qid, optionId })} />
    </div>
  );
}
