import { CalendarClock, Clock, Dumbbell, Flame, Lock, LogOut, Sparkles, Zap } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AssignmentCard, HomeResponse } from '@shared/types';
import { vnDate } from '@shared/time';
import { errorText, studentApi } from '../api';
import { Button, Card, ProgressBar, Spinner, Tag, cx } from '../components/ui';
import { countdown, ddmm, dowName, dowShort, lessonTitle, longDate, todayVN } from '../lib/format';
import { useSession } from '../session';

function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Câu giải thích cho bài bị khoá — server không gửi lý do, giao diện tự sinh */
function blockedReason(cards: AssignmentCard[]): string {
  const oldest = cards.find((c) => !c.blocked && c.status === 'owing');
  if (!oldest) return 'Bài này chưa mở.';
  return `Làm bù bài ${dowName(oldest.date)} (${ddmm(oldest.date)}) trước nhé.`;
}

export default function Home() {
  const [data, setData] = useState<HomeResponse | null>(null);
  const [error, setError] = useState('');
  const now = useNow();
  const { logout } = useSession();

  useEffect(() => {
    studentApi.home().then(setData).catch((e: unknown) => setError(errorText(e)));
  }, []);

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-bad-ink">{error}</p>
        <Button variant="secondary" className="mt-4" onClick={() => location.reload()}>
          Tải lại
        </Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const today = todayVN();
  const first = data.assignments[0];
  const reason = blockedReason(data.assignments);

  return (
    <div>
      <header className="rounded-b-[28px] bg-primary px-5 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-white/90">{longDate(today)}</p>
            <h1 className="text-[22px] font-bold">Chào {data.student.name}</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Đăng xuất"
            className="-mr-2 rounded-xl p-2 text-white/90 hover:bg-white/10"
          >
            <LogOut className="size-5" aria-hidden />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat icon={<Flame className="size-4" aria-hidden />} value={String(data.streak)} label="chuỗi mốc" />
          <Stat icon={<Zap className="size-4" aria-hidden />} value={data.xpTotal.toLocaleString('vi-VN')} label="XP" />
          {data.nextDeadlineAt && (
            <Stat
              icon={<Clock className="size-4" aria-hidden />}
              value={countdown(data.nextDeadlineAt, now)}
              label={`còn đến hạn ${dowShort(vnDate(data.nextDeadlineAt))}`}
              small
            />
          )}
        </div>
      </header>

      <main className="space-y-3 px-4 pt-4">
        {!first ? (
          <EmptyState canPractice={data.canPractice} />
        ) : (
          <>
            <h2 className="px-1 pt-1 text-sm font-semibold text-ink-2">
              {first.status === 'owing' ? 'Làm bài nợ trước nhé' : 'Bài cần làm'}
            </h2>
            {data.assignments.map((a) => (
              <AssignmentItem
                key={a.milestoneId}
                a={a}
                today={today}
                reason={reason}
                newWords={a === first ? data.newWordsToPreview : 0}
              />
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ icon, value, label, small }: { icon: ReactNode; value: string; label: string; small?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/15 px-2 py-2.5 text-center">
      <div className={cx('flex items-center justify-center gap-1 font-bold', small ? 'text-[15px] leading-6' : 'text-lg leading-6')}>
        {icon}
        <span className="truncate">{value}</span>
      </div>
      <div className="mt-0.5 text-[11px] text-white/90">{label}</div>
    </div>
  );
}

function AssignmentItem({ a, today, reason, newWords }: { a: AssignmentCard; today: string; reason: string; newWords: number }) {
  const nav = useNavigate();
  const title = lessonTitle(a.date);
  const { done, required } = a.progress;

  if (a.blocked) {
    return (
      <Card className="shadow-none ring-1 ring-line">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-off-bg text-off-ink">
            <Lock className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-ink-2">{title}</p>
            <p className="mt-0.5 text-sm text-ink-3">{reason}</p>
          </div>
        </div>
      </Card>
    );
  }

  const owing = a.status === 'owing';
  const isToday = a.date === today;
  const dropsTomorrow = a.tomorrowPct < a.currentPct;

  return (
    <Card className={cx(owing && 'ring-2 ring-bad/40')}>
      <div className="flex items-center justify-between gap-2">
        {owing ? (
          <Tag tone="bad">Đang nợ · trễ {a.daysLateNow} ngày</Tag>
        ) : (
          <Tag tone="brand">
            <CalendarClock className="size-3.5" aria-hidden />
            Hạn 23:59 {isToday ? 'hôm nay' : `${dowName(a.date)} ${ddmm(a.date)}`}
          </Tag>
        )}
        {newWords > 0 && <span className="text-xs font-medium text-brand-ink">+{newWords} từ mới</span>}
      </div>

      <h3 className="mt-2 text-[17px] font-bold">{title}</h3>

      {(owing || dropsTomorrow) && (
        <div className={cx('mt-3 flex items-end justify-between rounded-2xl px-3 py-2.5', owing ? 'bg-bad-bg' : 'bg-brand-wash')}>
          <div>
            <p className="text-xs text-ink-2">Nộp hôm nay được</p>
            <p className={cx('text-2xl font-bold', owing ? 'text-bad-ink' : 'text-brand-ink')}>{a.currentPct}%</p>
          </div>
          <p className="text-right text-sm text-ink-2">
            {a.tomorrowPct === 0 ? (
              <>
                Ngày mai <b className="font-semibold text-bad-ink">khoá bài</b>
              </>
            ) : (
              <>
                Ngày mai còn <b className="font-semibold text-ink">{a.tomorrowPct}%</b>
              </>
            )}
          </p>
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="text-ink-2">Tiến độ</span>
          <span className="font-semibold">{required ? `${done}/${required} câu` : 'Chưa bắt đầu'}</span>
        </div>
        <ProgressBar value={done} max={required ?? 1} tone={owing ? 'bad' : 'brand'} label="Tiến độ bài" />
      </div>

      <Button block className="mt-4" onClick={() => nav(`/hoc/bai/${a.milestoneId}`)}>
        {done > 0 ? 'Làm tiếp' : 'Bắt đầu làm bài'}
      </Button>
    </Card>
  );
}

function EmptyState({ canPractice }: { canPractice: boolean }) {
  const nav = useNavigate();
  return (
    <Card className="flex flex-col items-center px-6 py-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-ok-bg text-ok-ink">
        <Sparkles className="size-7" aria-hidden />
      </span>
      <h2 className="mt-3 text-lg font-bold">Xong hết bài rồi!</h2>
      <p className="mt-1 text-sm text-ink-2">
        Bài tiếp theo mở sau hạn mốc này.
        {canPractice && ' Muốn ôn thêm thì vào Luyện thêm nhé (không tính điểm, vẫn được XP).'}
      </p>
      {canPractice && (
        <Button variant="secondary" className="mt-5" onClick={() => nav('/hoc/luyen-them')}>
          <Dumbbell className="size-5" aria-hidden /> Luyện thêm
        </Button>
      )}
    </Card>
  );
}
