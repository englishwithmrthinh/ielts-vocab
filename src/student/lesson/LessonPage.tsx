// Màn làm bài /hoc/bai/:milestoneId
// Luồng: (xem trước từ mới) → câu tính điểm → vòng sửa sai → tổng kết + Nộp → kết quả (+ Làm tiếp).
// Mỗi câu lưu ngay trên máy chủ → thoát ra vào lại sẽ tiếp đúng câu đang dở.
import { Home, Repeat, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AnswerResult, AnswerSubmission, NextQuestionResponse, Question, SubmitResponse, WordCard } from '@shared/types';
import { QUESTION_COMPONENTS } from '../../questions';
import { ApiCallError } from '../../lib/api';
import { errorText, studentApi } from '../api';
import { Button, Card, ProgressBar, Spinner, cx } from '../components/ui';
import { BADGE_ICON, BADGE_VI } from '../lib/badges';
import { ART, Spot, Star4 } from '../components/Art';
import { WaxSeal } from '../components/WaxSeal';
import { celebrate } from '../lib/celebrate';
import { COPY, fill, summaryLine } from '../lib/copy';
import { Preview } from './Preview';
import { ResultPanel } from './ResultPanel';
import { prefetch, preloadMedia, type Prefetch } from './flow';
import { quickGrade } from '@shared/check';
import { feedback, primeAudio } from '../lib/feedback';
import type { QuickResult } from '../../questions';

export type Stage =
  | { k: 'loading' }
  | { k: 'error'; msg: string }
  | { k: 'preview'; cards: WordCard[] }
  | {
      k: 'question';
      q: Question;
      phase: NextQuestionResponse['phase'];
      result?: AnswerResult;
      /** chấm nhanh trên máy — hiện ngay trước khi server trả `result` */
      quick?: QuickResult;
      sending?: boolean;
    }
  | { k: 'summary' }
  | { k: 'submitted'; r: SubmitResponse };

export default function LessonPage() {
  const { milestoneId = '' } = useParams();
  const nav = useNavigate();
  const [stage, setStage] = useState<Stage>({ k: 'loading' });
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [canExtra, setCanExtra] = useState(false);
  const [tally, setTally] = useState({ correct: 0, total: 0 });
  /** đã nộp trong lần vào này → hết "Làm tiếp" thì không hiện nút Nộp nữa */
  const submitted = useRef(false);

  const fail = (e: unknown) => setStage({ k: 'error', msg: errorText(e) });

  /** câu tiếp theo đã tải trước trong lúc học sinh đọc thẻ đáp án */
  const pre = useRef<Prefetch | null>(null);

  const show = useCallback((r: NextQuestionResponse) => {
    if (!r.question || r.phase === 'done') setStage({ k: 'summary' });
    else {
      preloadMedia(r.question);
      setStage({ k: 'question', q: r.question, phase: r.phase });
    }
  }, []);

  const loadNext = useCallback(
    async (aid: string, extra = false) => {
      pre.current = null;
      show(await studentApi.next(aid, extra));
    },
    [show],
  );

  const start = useCallback(async () => {
    const s = await studentApi.start(milestoneId);
    setAssignmentId(s.assignmentId);
    setCanExtra(s.canContinueExtra);
    await loadNext(s.assignmentId);
  }, [milestoneId, loadNext]);

  // Vào màn: có từ mới chưa xem → xem trước; không thì vào thẳng câu đang dở
  useEffect(() => {
    let off = false;
    studentApi
      .preview(milestoneId)
      .then((p) => {
        if (off) return;
        if (p.cards.length) setStage({ k: 'preview', cards: p.cards });
        else return start();
      })
      .catch(fail);
    return () => {
      off = true;
    };
  }, [milestoneId, start]);

  const submitAnswer = async (a: AnswerSubmission) => {
    if (stage.k !== 'question' || stage.result || stage.sending || stage.quick || !assignmentId) return;
    const { q, phase } = stage;
    const sameQ = (cur: Stage) => cur.k === 'question' && cur.q.qid === q.qid;
    setStage({ ...stage, sending: true });
    primeAudio();
    // Chấm nhanh trên máy (mã băm) → tô đúng/sai + âm báo ngay, không chờ mạng
    let quickDone = false;
    quickGrade(q.check, a)
      .then((quick) => {
        if (!quick) return;
        quickDone = true;
        feedback(quick.correct);
        setStage((cur) => (sameQ(cur) && cur.k === 'question' && !cur.result ? { ...cur, quick } : cur));
      })
      .catch(() => undefined);
    try {
      const result = await studentApi.answer(assignmentId, a);
      if (!quickDone) feedback(result.correct);
      setStage((cur) => (sameQ(cur) && cur.k === 'question' ? { ...cur, sending: false, result } : cur));
      // Tải trước câu sau trong lúc học sinh đọc thẻ đáp án
      pre.current = prefetch(() => studentApi.next(assignmentId, phase === 'extra'));
      if (stage.q.mode === 'graded') {
        const n = result.perWord?.length ?? 1;
        const ok = result.perWord ? result.perWord.filter((p) => p.correct).length : result.correct ? 1 : 0;
        setTally((t) => ({ correct: t.correct + ok, total: t.total + n }));
      }
    } catch (e) {
      // 410 question_expired: câu đã được trả lời (ví dụ mở 2 tab) → lấy câu tiếp theo
      if (e instanceof ApiCallError && e.status === 410) {
        setStage({ k: 'loading' });
        loadNext(assignmentId).catch(fail);
      } else fail(e);
    }
  };

  const goNext = useCallback(() => {
    if (!assignmentId || stage.k !== 'question' || !stage.result) return;
    const extra = stage.phase === 'extra';
    const p = pre.current;
    pre.current = null;
    if (p?.value) return show(p.value); // đã tải xong → hiện ngay
    setStage({ k: 'loading' });
    if (p && !p.failed) p.promise.then(show).catch(() => loadNext(assignmentId, extra).catch(fail));
    else loadNext(assignmentId, extra).catch(fail);
  }, [assignmentId, loadNext, show, stage]);

  // Enter = Tiếp tục (bàn phím máy tính)
  useEffect(() => {
    if (stage.k !== 'question' || !stage.result) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        goNext();
      }
    };
    const t = setTimeout(() => window.addEventListener('keydown', h), 150);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', h);
    };
  }, [stage, goNext]);

  const doSubmit = async () => {
    if (!assignmentId) return;
    setStage({ k: 'loading' });
    try {
      const r = await studentApi.submit(assignmentId);
      submitted.current = true;
      setStage({ k: 'submitted', r });
      if (r.perfectWeek) celebrate('big');
      else if (r.daysLate === 0 || r.newBadges.length) celebrate('medium');
    } catch (e) {
      fail(e);
    }
  };

  const extra = async () => {
    if (!assignmentId) return;
    setStage({ k: 'loading' });
    loadNext(assignmentId, true).catch(fail);
  };

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-6">
      <TopBar stage={stage} onClose={() => nav('/hoc')} />

      {stage.k === 'loading' && (
        <div className="flex min-h-[60dvh] items-center justify-center">
          <Spinner />
        </div>
      )}

      {stage.k === 'error' && (
        <Card className="mt-6 text-center">
          <p className="text-bad-ink">{stage.msg}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => location.reload()}>
              Thử lại
            </Button>
            <Button onClick={() => nav('/hoc')}>Về trang chủ</Button>
          </div>
        </Card>
      )}

      {stage.k === 'preview' && (
        <Preview
          cards={stage.cards}
          onStart={() => {
            setStage({ k: 'loading' });
            start().catch(fail);
          }}
        />
      )}

      {stage.k === 'question' && <QuestionView stage={stage} onSubmit={submitAnswer} onNext={goNext} />}

      {stage.k === 'summary' &&
        (submitted.current ? (
          <ExtraDone onHome={() => nav('/hoc')} />
        ) : (
          <Summary tally={tally} onSubmit={doSubmit} />
        ))}

      {stage.k === 'submitted' && (
        <Submitted r={stage.r} canExtra={canExtra} onHome={() => nav('/hoc')} onExtra={extra} />
      )}
    </div>
  );
}

function TopBar({ stage, onClose }: { stage: Stage; onClose: () => void }) {
  const q = stage.k === 'question' ? stage.q : null;
  const phase = stage.k === 'question' ? stage.phase : null;
  const pct = q && q.progress.required ? Math.min(100, (q.progress.done / q.progress.required) * 100) : 0;
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-4 bg-primary pt-[env(safe-area-inset-top)] text-cream shadow-[0_2px_0_var(--color-primary-edge)]">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
        <button type="button" onClick={onClose} aria-label="Thoát (tiến độ đã được lưu)" className="-ml-2 rounded-full p-2 text-cream/90 hover:bg-white/10">
          <X className="size-6" strokeWidth={1.6} aria-hidden />
        </button>
        {q && phase !== 'extra' && (
          <>
            <div
              role="progressbar"
              aria-label="Tiến độ phần bắt buộc"
              aria-valuemin={0}
              aria-valuemax={q.progress.required}
              aria-valuenow={q.progress.done}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"
            >
              <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-semibold tabular-nums text-cream/90">
              {q.progress.done}/{q.progress.required}
            </span>

          </>
        )}
        {q && phase === 'extra' && <p className="label-caps flex-1 text-cream/90">Làm tiếp · câu thêm {q.progress.extra + 1}</p>}
        {!q && <p className="font-display flex-1 text-[15px] text-cream/90">Học từ vựng</p>}
      </div>
      {q && phase !== 'extra' && q.progress.done >= q.progress.required && !!q.progress.fixLeft && (
        <p className="bg-primary-edge px-4 py-1.5 text-center text-xs font-medium text-cream" role="status">
          Còn {q.progress.fixLeft} từ cần làm đúng lại trước khi nộp
        </p>
      )}
    </div>
  );
}

export function QuestionView({
  stage,
  onSubmit,
  onNext,
}: {
  stage: Extract<Stage, { k: 'question' }>;
  onSubmit: (a: AnswerSubmission) => void;
  onNext: () => void;
}) {
  const Comp = QUESTION_COMPONENTS[stage.q.type];
  return (
    <div data-qtype={stage.q.type} data-qid={stage.q.qid} className={cx('pb-24', !stage.result && 'animate-[fadeIn_.2s_ease-out]')}>
      {stage.phase === 'fix' && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1 text-xs font-semibold text-blush-ink">
          <Repeat className="size-3.5" aria-hidden /> Ôn lại từ vừa sai · không tính điểm
        </p>
      )}
      <div className="paper rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-6">
        {Comp ? (
          <Comp key={stage.q.qid} question={stage.q} onSubmit={onSubmit} disabled={stage.sending} result={stage.result} quick={stage.quick} />
        ) : (
          <p className="text-bad-ink">Dạng câu {stage.q.type} chưa hỗ trợ.</p>
        )}
      </div>
      {stage.sending && !stage.quick && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-3" role="status">
          <Spinner className="size-5" /> Đang chấm…
        </div>
      )}
      {stage.quick && !stage.result && (
        // Chấm nhanh đã có, đang chờ server lưu + trả thẻ từ
        <div
          role="status"
          aria-live="polite"
          className={cx(
            'mt-5 flex items-center gap-2.5 rounded-[var(--radius-card)] p-4 text-lg font-bold ring-1 animate-[fadeIn_.15s_ease-out]',
            stage.quick.correct ? 'bg-ok-bg text-ok-ink ring-ok/30' : 'bg-bad-bg text-bad-ink ring-bad/30',
          )}
        >
          {stage.quick.correct ? 'Chính xác' : 'Chưa đúng'}
          <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-ink-3">
            <Spinner className="size-4" /> Đang tải thẻ từ…
          </span>
        </div>
      )}
      {stage.result && <ResultPanel question={stage.q} result={stage.result} />}
      {(stage.result || stage.quick) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto max-w-md">
            <Button block size="lg" onClick={onNext} autoFocus disabled={!stage.result} aria-busy={!stage.result}>
              {stage.result ? (
                'Tiếp tục'
              ) : (
                <>
                  <Spinner className="size-5 border-white/40 border-t-white" /> Đang lưu…
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ tally, onSubmit }: { tally: { correct: number; total: number }; onSubmit: () => void }) {
  return (
    <div className="paper mx-auto mt-2 max-w-md rounded-[var(--radius-card)] px-6 pb-8 pt-8 text-center shadow-[var(--shadow-card)] ring-1 ring-line animate-[fadeIn_.25s_ease-out]">
      <Spot src={ART.bookPen} className="mx-auto w-28" />
      <h1 className="font-display mt-3 text-[24px]">Xong phần bắt buộc</h1>
      <p className="mt-1 text-ink-2">Bấm Nộp bài để được tính điểm chuyên cần.</p>
      {tally.total > 0 && (
        <div className="mx-auto mt-5 w-fit rounded-xl bg-blush px-6 py-3">
          <p className="label-caps text-blush-ink">Lần này đúng</p>
          <p className="mt-1 text-[30px] font-bold leading-none tabular-nums">
            {tally.correct}/{tally.total}
          </p>
        </div>
      )}
      <Button block size="lg" className="mt-6" onClick={onSubmit}>
        Nộp bài
      </Button>
      <p className="mt-2 text-xs text-ink-3">Chỉ bài đã nộp mới được tính.</p>
    </div>
  );
}

function Submitted({
  r,
  canExtra,
  onHome,
  onExtra,
}: {
  r: SubmitResponse;
  canExtra: boolean;
  onHome: () => void;
  onExtra: () => void;
}) {
  const onTime = r.daysLate === 0;
  return (
    <div className="paper mx-auto mt-2 max-w-md rounded-[var(--radius-card)] px-6 pb-8 pt-7 text-center shadow-[var(--shadow-card)] ring-1 ring-line animate-[fadeIn_.25s_ease-out]">
      <p className="label-caps text-ink-3">{r.perfectWeek ? 'Tuần hoàn hảo' : 'Trang cuối'}</p>
      <h1 className="font-display mt-1 text-[26px]">Đã nộp bài</h1>
      <div className="my-4 flex items-center justify-center gap-3 text-gold" aria-hidden>
        <span className="h-px w-12 bg-gold/60" />
        <Star4 className="size-4" />
        <span className="h-px w-12 bg-gold/60" />
      </div>
      <p className={cx('text-[64px] font-bold leading-none tabular-nums', onTime ? 'text-ok-ink' : 'text-mid-ink')}>{r.scorePct}%</p>
      <p className="label-caps mt-1 text-ink-3">Chuyên cần bài này</p>
      <p className="mt-3 text-ink-2">
        {r.perfectWeek ? COPY.perfect_week : onTime ? COPY.submit.on_time : fill(COPY.submit.late, { days: r.daysLate, pct: r.scorePct })}
      </p>
      {r.summary.total > 0 && <p className="mt-1 font-serif text-lg italic text-ink-2">{summaryLine(r.summary.correct, r.summary.total, String(r.summary.correct))}</p>}

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Metric value={`${r.summary.correct}/${r.summary.total}`} label="Câu đúng" />
        <Metric value={`+${r.xpGained}`} label={r.xpGained ? 'XP đúng hạn' : 'XP (khi đúng hạn)'} />
        <Metric value={String(r.summary.passedWords)} label="Từ vừa thuộc" />
      </div>

      {r.newBadges.length > 0 && (
        <div className="mt-6">
          <p className="label-caps mb-3 text-ink-3">Huy hiệu mới</p>
          <div className="flex flex-wrap justify-center gap-4">
            {r.newBadges.map((b) => (
              <div key={b} className="flex w-24 flex-col items-center animate-[popIn_.4s_ease-out]">
                <WaxSeal icon={BADGE_ICON[b]} tone={b.startsWith('pass') || b === 'perfect_month' ? 'gold' : 'wine'} size={64} />
                <span className="mt-1.5 text-xs font-semibold leading-tight">{BADGE_VI[b]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-7 space-y-2">
        <Button block size="lg" onClick={onHome}>
          <Home className="size-5" aria-hidden /> Về trang chủ
        </Button>
        {canExtra && (
          <>
            <Button variant="accent" block onClick={onExtra}>
              Làm tiếp
            </Button>
            <p className="text-xs text-ink-3">Ôn thêm các từ còn đến hạn. Không ảnh hưởng điểm bài đã nộp.</p>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-blush px-2 py-3">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="label-caps mt-0.5 !text-[10px] !tracking-[0.04em] leading-tight text-blush-ink">{label}</div>
    </div>
  );
}

function ExtraDone({ onHome }: { onHome: () => void }) {
  return (
    <div className="paper mx-auto mt-2 max-w-md rounded-[var(--radius-card)] px-6 pb-8 pt-8 text-center shadow-[var(--shadow-card)] ring-1 ring-line animate-[fadeIn_.25s_ease-out]">
      <Spot src={ART.emptyShelf} className="mx-auto w-32" />
      <h1 className="font-display mt-3 text-[24px]">Hết từ cần ôn</h1>
      <p className="mt-1 text-ink-2">Hẹn gặp lại ở bài sau nhé.</p>
      <Button block size="lg" className="mt-6" onClick={onHome}>
        <Home className="size-5" aria-hidden /> Về trang chủ
      </Button>
    </div>
  );
}
