// Luyện thêm (/hoc/luyen-them): khi không có bài mở. Không đổi hộp, không tính điểm, mỗi câu đúng +2 XP.
// API: GET /api/practice/next → NextQuestionResponse (mode 'practice'); trả lời qua POST /api/answer (không có assignmentId).
import { Dumbbell, Home, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnswerSubmission } from '@shared/types';
import { ApiCallError } from '../../lib/api';
import { errorText, studentApi } from '../api';
import { Button, Card, Spinner } from '../components/ui';
import { celebrate } from '../lib/celebrate';
import { QuestionView, type Stage } from './LessonPage';

export default function PracticePage() {
  const nav = useNavigate();
  const [stage, setStage] = useState<Stage>({ k: 'loading' });
  const [xp, setXp] = useState(0);
  const [count, setCount] = useState(0);
  const fail = (e: unknown) => setStage({ k: 'error', msg: errorText(e) });

  const loadNext = useCallback(async () => {
    setStage({ k: 'loading' });
    const r = await studentApi.practiceNext();
    if (!r.question || r.phase === 'done') setStage({ k: 'summary' });
    else setStage({ k: 'question', q: r.question, phase: r.phase });
  }, []);

  useEffect(() => {
    loadNext().catch(fail);
  }, [loadNext]);

  const submit = async (a: AnswerSubmission) => {
    if (stage.k !== 'question' || stage.result || stage.sending) return;
    setStage({ ...stage, sending: true });
    try {
      const result = await studentApi.practiceAnswer(a);
      setStage({ ...stage, sending: false, result });
      setXp((v) => v + result.xp);
      setCount((v) => v + 1);
      if (result.passed) celebrate('small');
    } catch (e) {
      if (e instanceof ApiCallError && e.status === 410) loadNext().catch(fail);
      else fail(e);
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 bg-page/95 px-4 pb-2 pt-1 backdrop-blur">
        <button type="button" onClick={() => nav('/hoc')} aria-label="Thoát" className="-ml-2 rounded-xl p-2 text-ink-2 hover:bg-surface-2">
          <X className="size-6" aria-hidden />
        </button>
        <p className="flex-1 rounded-xl bg-brand-tint px-3 py-1.5 text-sm font-semibold text-brand-ink">
          <Dumbbell className="mr-1 inline size-4 align-[-3px]" aria-hidden />
          Luyện thêm · không tính điểm
        </p>
        <span className="flex items-center gap-1 text-sm font-semibold text-brand-ink">
          <Zap className="size-4" aria-hidden />+{xp}
        </span>
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
        <div className="flex flex-col items-center pt-8 text-center animate-[fadeIn_.25s_ease-out]">
          <span className="flex size-20 items-center justify-center rounded-3xl bg-brand-tint text-brand-ink">
            <Dumbbell className="size-10" aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl font-bold">{count ? 'Luyện xong rồi!' : 'Chưa có từ để luyện'}</h1>
          <p className="mt-1 text-ink-2">{count ? `Bạn đã luyện ${count} câu, được +${xp} XP.` : 'Từ sẽ có sau buổi học đầu tiên.'}</p>
          <Button block size="lg" className="mt-6" onClick={() => nav('/hoc')}>
            <Home className="size-5" aria-hidden /> Về trang chủ
          </Button>
        </div>
      )}
    </div>
  );
}
