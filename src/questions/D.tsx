// D · Nối (Nhớ): nối 5 cặp từ – nghĩa. Kéo nghĩa vào từ, hoặc chạm nghĩa rồi chạm từ.
// Giả định: left[].id = wordId (để tô đúng/sai theo result.perWord).
import type { QuestionProps } from './index';
import { Bank, Slot, useAssign } from './assign';
import { CheckButton, Instruction } from './parts';

export default function D({ question: q, onSubmit, disabled, result, quick }: QuestionProps) {
  const left = q.pairs?.left ?? [];
  const right = q.pairs?.right ?? [];
  const a = useAssign(right, left.map((l) => l.id), disabled || !!result || !!quick);
  const state = (id: string) => {
    const p = (result?.perWord ?? quick?.perWord)?.find((x) => x.wordId === id);
    return p ? (p.correct ? 'ok' : 'bad') : undefined;
  };

  return (
    <div>
      <Instruction>Nối mỗi từ với nghĩa đúng</Instruction>
      <div className="space-y-2">
        {left.map((l) => (
          <div key={l.id} className="flex items-center gap-2 rounded-xl bg-surface-2/60 p-2 pl-3 ring-1 ring-line">
            <span className="w-[42%] shrink-0 font-serif text-[20px] font-bold">{l.text}</span>
            <Slot id={l.id} a={a} state={state(l.id)} placeholder="nghĩa…" className="flex-1" />
          </div>
        ))}
      </div>
      {!result && !quick && <Bank bank={right} a={a} disabled={disabled} />}
      {!result && !quick && (
        <CheckButton disabled={!a.complete || disabled} onClick={() => onSubmit({ qid: q.qid, matches: a.assign })} />
      )}
    </div>
  );
}
