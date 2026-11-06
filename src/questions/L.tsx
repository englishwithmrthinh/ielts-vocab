// L · Kéo thả nhiều câu (Vận dụng): 4–5 câu khuyết, kéo 4–5 từ vào.
// Giả định: blanks[].id = wordId (để tô đúng/sai theo result.perWord).
import type { QuestionProps } from './index';
import { Bank, Slot, useAssign } from './assign';
import { CheckButton, Instruction } from './parts';

export default function L({ question: q, onSubmit, disabled, result, quick }: QuestionProps) {
  const blanks = q.blanks ?? [];
  const bank = q.bank ?? [];
  const a = useAssign(bank, blanks.map((b) => b.id), disabled || !!result || !!quick);
  const state = (id: string) => {
    const p = (result?.perWord ?? quick?.perWord)?.find((x) => x.wordId === id);
    return p ? (p.correct ? 'ok' : 'bad') : undefined;
  };

  return (
    <div>
      <Instruction>Kéo từ vào đúng câu</Instruction>
      <ol className="space-y-2">
        {blanks.map((b, i) => {
          const [x, y] = b.sentence.split('___');
          return (
            <li key={b.id} className="rounded-xl bg-surface-2/60 p-3 font-serif text-[19px] leading-loose ring-1 ring-line">
              <span className="mr-1 text-sm font-semibold text-ink-3">{i + 1}.</span>
              {x}
              <Slot id={b.id} a={a} state={state(b.id)} placeholder="……" className="mx-1 align-middle" />
              {y}
            </li>
          );
        })}
      </ol>
      {!result && !quick && <Bank bank={bank} a={a} disabled={disabled} />}
      {!result && !quick && (
        <CheckButton disabled={!a.complete || disabled} onClick={() => onSubmit({ qid: q.qid, matches: a.assign })} />
      )}
    </div>
  );
}
