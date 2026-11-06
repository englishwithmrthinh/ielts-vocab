// Màn làm bài /hoc/bai/:milestoneId
// Luồng: (xem trước từ mới) → câu tính điểm → vòng sửa sai → tổng kết + Nộp → kết quả (+ Làm tiếp).
// Mỗi câu lưu ngay trên máy chủ → thoát ra vào lại sẽ tiếp đúng câu đang dở.
import { Award, CalendarCheck, Clock, Home, Repeat, Trophy, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AnswerResult, AnswerSubmission, BadgeCode, NextQuestionResponse, Question, SubmitResponse, WordCard } from '@shared/types';
import { QUESTION_COMPONENTS } from '../../questions';
import { errorText, studentApi } from '../api';
import { Button, Card, ProgressBar, Spinner, cx } from '../components/ui';
import { celebrate } from '../lib/celebrate';
import { Preview } from './Preview';
import { ResultPanel } from './ResultPanel';

type Stage =
  | { k: 'loading' }
  | { k: 'error'; msg: string }
  | { k: 'preview'; cards: WordCard[] }
  | { k: 'question'; q: Question; phase: NextQuestionResponse['phase']; result?: AnswerResult; sending?: boolean }
  | { k: 'summary' }
  | { k: 'submitted'; r: SubmitResponse };

export const BADGE_VI: Record<BadgeCode, string> = {
  first_submit: 'Bài nộp đầu tiên',
  perfect_week: 'Tuần hoàn hảo',
  perfect_month: 'Tháng hoàn hảo',
  all_sundays_month: 'Đủ mọi Chủ nhật trong tháng',
  pass_10: 'Thuộc 10 từ',
  pass_50: 'Thuộc 50 từ',
  pass_100: 'Thuộc 100 từ',
  pass_300: 'Thuộc 300 từ',
  streak_6: 'Chuỗi 6 mốc',
  streak_12: 'Chuỗi 12 mốc',
  streak_24: 'Chuỗi 24 mốc',
};

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

  const loadNext = useCallback(async (aid: string, extra = false) => {
    const r = await studentApi.next(aid, extra);
    if (!r.question || r.phase === 'done') setStage({ k: 'summary' });
    else setStage({ k: 'question', q: r.question, phase: r.phase });
  }, []);

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
    if (stage.k !== 'question' || stage.result || stage.sending || !assignmentId) return;
    setStage({ ...stage, sending: true });
    try {
      const result = await studentApi.answer(assignmentId, a);
      setStage({ ...stage, sending: false, result });
      if (stage.q.mode === 'graded') {
        const n = result.perWord?.length ?? 1;
        const ok = result.perWord ? result.perWord.filter((p) => p.correct).length : result.correct ? 1 : 0;
        setTally((t) => ({ correct: t.correct + ok, total: t.total + n }));
      }
      if (result.passed) celebrate('small');
    } catch (e) {
      fail(e);
    }
  };

  const goNext = useCallback(() => {
    if (!assignmentId) return;
    setStage({ k: 'loading' });
    loadNext(assignmentId, stage.k === 'question' && stage.phase === 'extra').catch(fail);
  }, [assignmentId, loadNext, stage]);

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
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <TopBar stage={stage} onClose={() => nav('/hoc')} />

      {stage.k === 'loading' && (
        <div className="flex min-h-[60dvh] items-center justify-center">
          <Spinner />
        </div>
      )}

      {stage.k === 'error' && (
        <Card className="mt-6 text-center">
          <p className="text-bad-ink">{stage.msg}</p>
          <Button variant="secondary" className="mt-4" onClick={() => location.reload()}>
            Thử lại
          </Button>
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
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-4 bg-page/95 px-4 pb-2 pt-1 backdrop-blur">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onClose} aria-label="Thoát (tiến độ đã được lưu)" className="-ml-2 rounded-xl p-2 text-ink-2 hover:bg-surface-2">
          <X className="size-6" aria-hidden />
        </button>
        {q && phase === 'graded' && (
          <>
            <ProgressBar value={q.progress.done} max={q.progress.required} className="h-3 flex-1" label="Tiến độ phần bắt buộc" />
            <span className="text-sm font-semibold tabular-nums text-ink-2">
              {q.progress.done}/{q.progress.required}
            </span>
          </>
        )}
        {q && phase === 'fix' && (
          <p className="flex-1 rounded-xl bg-mid-bg px-3 py-1.5 text-sm font-semibold text-mid-ink">
            <Repeat className="mr-1 inline size-4 align-[-3px]" aria-hidden />
            Vòng sửa sai · không tính điểm
          </p>
        )}
        {q && phase === 'extra' && (
          <p className="flex-1 rounded-xl bg-brand-tint px-3 py-1.5 text-sm font-semibold text-brand-ink">
            Làm tiếp · câu thêm {q.progress.extra + 1}
          </p>
        )}
      </div>
    </div>
  );
}

function QuestionView({
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
    <div data-qtype={stage.q.type} className={cx('pb-24', !stage.result && 'animate-[fadeIn_.2s_ease-out]')}>
      {Comp ? (
        <Comp key={stage.q.qid} question={stage.q} onSubmit={onSubmit} disabled={stage.sending} result={stage.result} />
      ) : (
        <p className="text-bad-ink">Dạng câu {stage.q.type} chưa hỗ trợ.</p>
      )}
      {stage.sending && (
        <div className="mt-4 flex justify-center">
          <Spinner className="size-5" />
        </div>
      )}
      {stage.result && <ResultPanel question={stage.q} result={stage.result} />}
      {stage.result && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto max-w-md">
            <Button block size="lg" onClick={onNext} autoFocus>
              Tiếp tục
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ tally, onSubmit }: { tally: { correct: number; total: number }; onSubmit: () => void }) {
  return (
    <div className="flex flex-col items-center pt-6 text-center animate-[fadeIn_.25s_ease-out]">
      <span className="flex size-20 items-center justify-center rounded-3xl bg-brand-tint text-brand-ink animate-[popIn_.4s_ease-out]">
        <CalendarCheck className="size-10" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-bold">Xong phần bắt buộc!</h1>
      <p className="mt-1 text-ink-2">Bấm Nộp bài để được tính điểm chuyên cần.</p>
      {tally.total > 0 && (
        <Card className="mt-6 w-full">
          <p className="text-sm text-ink-2">Lần này bạn làm đúng</p>
          <p className="text-3xl font-bold text-brand-ink">
            {tally.correct}/{tally.total}
          </p>
        </Card>
      )}
      <Button block size="lg" className="mt-6" onClick={onSubmit}>
        Nộp bài
      </Button>
      <p className="mt-2 text-xs text-ink-3">Chỉ bài đã nộp mới được tính.</p>
    </div>
  );
}

function ExtraDone({ onHome }: { onHome: () => void }) {
  return (
    <div className="flex flex-col items-center pt-8 text-center animate-[fadeIn_.25s_ease-out]">
      <span className="flex size-20 items-center justify-center rounded-3xl bg-ok-bg text-ok-ink">
        <CalendarCheck className="size-10" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-bold">Hết từ cần ôn rồi!</h1>
      <p className="mt-1 text-ink-2">Hẹn gặp lại ở bài sau nhé.</p>
      <Button block size="lg" className="mt-6" onClick={onHome}>
        <Home className="size-5" aria-hidden /> Về trang chủ
      </Button>
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
    <div className="flex flex-col items-center pt-4 text-center animate-[fadeIn_.25s_ease-out]">
      <span
        className={cx(
          'flex size-20 items-center justify-center rounded-3xl animate-[popIn_.4s_ease-out]',
          onTime ? 'bg-ok-bg text-ok-ink' : 'bg-mid-bg text-mid-ink',
        )}
      >
        <Trophy className="size-10" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-bold">{r.perfectWeek ? 'Tuần hoàn hảo!' : 'Đã nộp bài'}</h1>
      <p className="mt-1 text-ink-2">
        {onTime ? 'Đúng hạn, giỏi lắm!' : `Nộp trễ ${r.daysLate} ngày. Lần sau cố gắng đúng hạn nhé.`}
      </p>

      <div className="mt-6 grid w-full grid-cols-3 gap-2">
        <Metric icon={<Clock className="size-4" aria-hidden />} value={`${r.scorePct}%`} label="chuyên cần" tone={onTime ? 'ok' : 'mid'} />
        <Metric icon={<CalendarCheck className="size-4" aria-hidden />} value={`${r.summary.correct}/${r.summary.total}`} label="câu đúng" />
        <Metric icon={<Zap className="size-4" aria-hidden />} value={`+${r.xpGained}`} label={r.xpGained ? 'XP nộp đúng hạn' : 'XP (chỉ khi đúng hạn)'} />
      </div>

      {r.summary.passedWords > 0 && (
        <p className="mt-4 rounded-xl bg-ok-bg px-3 py-2 text-sm font-semibold text-ok-ink">
          Bạn vừa thuộc hẳn {r.summary.passedWords} từ!
        </p>
      )}

      {r.newBadges.length > 0 && (
        <Card className="mt-4 w-full text-left">
          <p className="mb-2 text-sm font-semibold text-ink-2">Huy hiệu mới</p>
          <div className="flex flex-wrap gap-2">
            {r.newBadges.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5 rounded-xl bg-mid-bg px-3 py-1.5 text-sm font-semibold text-mid-ink animate-[popIn_.4s_ease-out]">
                <Award className="size-4" aria-hidden /> {BADGE_VI[b]}
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-6 w-full space-y-2">
        <Button block size="lg" onClick={onHome}>
          <Home className="size-5" aria-hidden /> Về trang chủ
        </Button>
        {canExtra && (
          <>
            <Button variant="secondary" block onClick={onExtra}>
              Làm tiếp
            </Button>
            <p className="text-xs text-ink-3">Ôn thêm các từ còn đến hạn. Không ảnh hưởng điểm bài đã nộp.</p>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, value, label, tone }: { icon: ReactNode; value: string; label: string; tone?: 'ok' | 'mid' }) {
  return (
    <div className={cx('rounded-2xl px-2 py-3', tone === 'ok' ? 'bg-ok-bg text-ok-ink' : tone === 'mid' ? 'bg-mid-bg text-mid-ink' : 'bg-surface text-ink shadow-[var(--shadow-card)]')}>
      <div className="flex items-center justify-center gap-1 text-lg font-bold">
        {icon}
        {value}
      </div>
      <div className="text-[11px] opacity-80">{label}</div>
    </div>
  );
}
