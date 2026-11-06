// C · Nghe → từ (Nhớ): nghe, chọn từ
import type { QuestionProps } from './index';
import { AudioButton } from '../student/components/AudioButton';
import { ChoiceList, Instruction } from './parts';

export default function C({ question: q, onSubmit, disabled, result, quick }: QuestionProps) {
  return (
    <div>
      <Instruction>Nghe rồi chọn từ đúng</Instruction>
      <div className="mb-6 flex flex-col items-center gap-2">
        <AudioButton url={q.prompt.audioUrl} autoPlay size="lg" label="Nghe lại" />
        <span className="text-xs text-ink-3">Chạm để nghe lại</span>
      </div>
      <ChoiceList options={q.options ?? []} disabled={disabled} result={result} quick={quick} onSubmit={(optionId) => onSubmit({ qid: q.qid, optionId })} />
    </div>
  );
}
