// J · Chọn từ điền câu (Hiểu): câu ví dụ khuyết, chọn 1 trong 4
import type { QuestionProps } from './index';
import { ChoiceList, Instruction, Sentence } from './parts';

export default function J({ question: q, onSubmit, disabled, result }: QuestionProps) {
  return (
    <div>
      <Instruction>Chọn từ điền vào chỗ trống</Instruction>
      <div className="mb-6 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
        <Sentence
          text={q.prompt.sentence ?? ''}
          blank={
            result ? (
              <b className="rounded bg-ok-bg px-1 text-ok-ink">{result.expected}</b>
            ) : undefined
          }
        />
      </div>
      <ChoiceList big options={q.options ?? []} disabled={disabled} result={result} onSubmit={(optionId) => onSubmit({ qid: q.qid, optionId })} />
    </div>
  );
}
