// Luyện thêm (/hoc/luyen-them): khi không có bài mở. Không đổi hộp, không tính điểm, mỗi câu đúng +2 XP.
// API: GET /api/practice/next → NextQuestionResponse (mode 'practice'); trả lời qua POST /api/answer (không có assignmentId).
import { Dumbbell, Home, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnswerSubmission, NextQuestionResponse } from '@shared/types';
import { quickGrade } from '@shared/check';
import { feedback, primeAudio } from '../lib/feedback';
import { prefetch, type Prefetch } from './flow';
import { ApiCallError } from '../../lib/api';
import { errorText, studentApi } from '../api';
import { Button, Card, Spinner } from '../components/ui';
import { ART, Spot } from '../components/Art';
import { QuestionView, type Stage } from './LessonPage';

export default function PracticePage() {
  const nav = useNavigate();
  const [stage, setStage] = useState<Stage>({ k: 'loading' });
  const [xp, setXp] = useState(0);
  const [count, setCount] = useState(0);
  const fail = (e: unknown) => setStage({ k: 'error', msg: errorText(e) });

  const pre = useRef<Prefetch | null>(null);

  const show = useCallback((r: NextQuestionResponse) => {
    if (!r.question || r.phase === 'done') setStage({ k: 'summary' });
    else setStage({ k: 'question', q: r.question, phase: r.phase });
  }, []);

  const loadNext = useCallback(async () => {
    const p = pre.current;
    pre.current = null;
    if (p?.value) return show(p.value); // đã tải trước → hiện ngay
    setStage({ k: 'loading' });
    if (p && !p.failed) {
      try {
        return show(await p.promise);
      } catch {
        /* tải lại bên dưới */
      }
    }
    show(await studentApi.practiceNext());
  }, [show]);

  useEffect(() => {
    loadNext().catch(fail);
  }, [loadNext]);

  const submit = async (a: AnswerSubmission) => {
    if (stage.k !== 'question' || stage.result || stage.sending || stage.quick) return;
    const qid = stage.q.qid;
    const same = (cur: Stage) => cur.k === 'question' && cur.q.qid === qid;
    setStage({ ...stage, sending: true });
    primeAudio();
    let quickDone = false;
    quickGrade(stage.q.check, a)
      .then((quick) => {
        if (!quick) return;
        quickDone = true;
        feedback(quick.correct);
        setStage((cur) => (same(cur) && cur.k === 'question' && !cur.result ? { ...cur, quick } : cur));
      })
      .catch(() => undefined);
    try {
      const result = await studentApi.practiceAnswer(a);
      if (!quickDone) feedback(result.correct);
      setStage((cur) => (same(cur) && cur.k === 'question' ? { ...cur, sending: false, result } : cur));
      pre.current = prefetch(() => studentApi.practiceNext());
      setXp((v) => v + result.xp);
      setCount((v) => v + 1);
    } catch (e) {
      if (e instanceof ApiCallError && e.status === 410) {
        pre.current = null;
        loadNext().catch(fail);
      }
      else fail(e);
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-6">
      <div className="sticky top-0 z-10 -mx-4 mb-4 bg-accent pt-[env(safe-area-inset-top)] text-cream">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <button type="button" onClick={() => nav('/hoc')} aria-label="Thoát" className="-ml-2 rounded-full p-2 text-cream/90 hover:bg-white/10">
            <X className="size-6" strokeWidth={1.6} aria-hidden />
          </button>
          <p className="label-caps flex-1 text-cream">
            <Dumbbell className="mr-1.5 inline size-4 align-[-3px]" aria-hidden />
            Luyện thêm · không tính điểm
          </p>
          <span className="flex items-center gap-1 text-sm font-semibold text-cream">
            <Zap className="size-4" aria-hidden />+{xp}
          </span>
        </div>
      </div>

      {stage.k === 'loading' && (
        <div className="flex min-h-[60dvh] items-center justify-center">
          <Spinner />
        </div>
      )}
      {stage.k === 'error' && (
        <Card className="mt-6 text-center">
          <p className="text-bad-ink">{stage.msg}</p>
          <Button className="mt-4" onClick={() => nav('/hoc')}>
            Về trang chủ
          </Button>
        </Card>
      )}
      {stage.k === 'question' && <QuestionView stage={stage} onSubmit={submit} onNext={() => loadNext().catch(fail)} />}
      {stage.k === 'summary' && (
        <div className="paper mx-auto mt-2 flex max-w-md flex-col items-center rounded-[var(--radius-card)] px-6 pb-8 pt-8 text-center shadow-[var(--shadow-card)] ring-1 ring-line animate-[fadeIn_.25s_ease-out]">
          <Spot src={count ? ART.bookGlasses : ART.emptyShelf} className="w-28" />
          <h1 className="font-display mt-3 text-[24px]">{count ? 'Luyện xong rồi' : 'Chưa có từ để luyện'}</h1>
          <p className="mt-1 text-ink-2">{count ? `Bạn đã luyện ${count} câu, được +${xp} XP.` : 'Từ sẽ có sau buổi học đầu tiên.'}</p>
          <Button block size="lg" className="mt-6" onClick={() => nav('/hoc')}>
            <Home className="size-5" aria-hidden /> Về trang chủ
          </Button>
        </div>
      )}
    </div>
  );
}
