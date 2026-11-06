// H · Nghe – gõ (Nhớ lại): nghe, gõ cả từ
import type { QuestionProps } from './index';
import { AudioButton } from '../student/components/AudioButton';
import { Instruction, TypeBox } from './parts';

export default function H({ question: q, onSubmit, disabled, result }: QuestionProps) {
  return (
    <div>
      <Instruction>Nghe rồi gõ lại từ</Instruction>
      <div className="mb-6 flex flex-col items-center gap-2">
        <AudioButton url={q.prompt.audioUrl} autoPlay size="lg" label="Nghe lại" />
        <span className="text-xs text-ink-3">Chạm để nghe lại</span>
      </div>
      <TypeBox key={q.qid} done={!!result} disabled={disabled} onSubmit={(text) => onSubmit({ qid: q.qid, text })} />
    </div>
  );
}
