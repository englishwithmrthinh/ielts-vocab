// K · Gõ từ vào câu (Vận dụng): câu ví dụ khuyết, gợi ý chữ cái đầu, tự gõ
import type { QuestionProps } from './index';
import { Instruction, Sentence, TypeBox } from './parts';

export default function K({ question: q, onSubmit, disabled, result }: QuestionProps) {
  const first = q.prompt.firstLetter ?? '';
  return (
    <div>
      <Instruction>Gõ từ còn thiếu (gõ cả từ)</Instruction>
      <div className="mb-5 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
        <Sentence
          text={q.prompt.sentence ?? ''}
          blank={
            <span className="mx-1 inline-block min-w-20 border-b-2 border-brand px-1 font-semibold text-brand-ink">
              {first}
              <span className="text-ink-3">…</span>
            </span>
          }
        />
      </div>
      <TypeBox
        key={q.qid}
        done={!!result}
        disabled={disabled}
        placeholder={first ? `Bắt đầu bằng "${first}"` : 'Gõ từ vào đây'}
        onSubmit={(text) => onSubmit({ qid: q.qid, text })}
      />
    </div>
  );
}
