// K · Gõ từ vào câu (Vận dụng): câu ví dụ khuyết, gợi ý chữ cái đầu, tự gõ
import type { QuestionProps } from './index';
import { Instruction, Sentence, TypeBox } from './parts';

export default function K({ question: q, onSubmit, disabled, result, quick }: QuestionProps) {
  const first = q.prompt.firstLetter ?? '';
  return (
    <div>
      <Instruction>Gõ từ còn thiếu (gõ cả từ)</Instruction>
      <div className="mb-5 rounded-xl border-l-4 border-gold/70 bg-surface-2/60 p-4">
        <Sentence
          text={q.prompt.sentence ?? ''}
          blank={
            <span className="mx-1 inline-block min-w-20 border-b-2 border-brand px-1 font-bold text-brand-ink">
              {first}
              <span className="text-ink-3">…</span>
            </span>
          }
        />
      </div>
      <TypeBox
        key={q.qid}
        done={!!result || !!quick} tone={result ? result.correct : quick?.correct}
        disabled={disabled}
        placeholder={first ? `Bắt đầu bằng "${first}"` : 'Gõ từ vào đây'}
        onSubmit={(text) => onSubmit({ qid: q.qid, text })}
      />
    </div>
  );
}
