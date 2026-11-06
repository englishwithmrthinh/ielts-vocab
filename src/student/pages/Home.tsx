// Trang chủ (/hoc) — phong cách "Thư viện cổ điển".
// ĐANG LÀM (khối vàng đào) · TIẾN ĐỘ (ô hồng phấn) · KỆ SÁCH CỦA TÔI · LỊCH BÀI · lối tắt.
import { Lock, LogOut } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AssignmentCard, HomeResponse, ProgressResponse } from '@shared/types';
import { vnDate } from '@shared/time';
import { errorText, studentApi } from '../api';
import { ART, Banner, Spot } from '../components/Art';
import { BookCover, SHELF } from '../components/BookCover';
import { Button, Card, ProgressBar, SectionTitle, Spinner, Tag, cx } from '../components/ui';
import { COPY, fill } from '../lib/copy';
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
  return fill(COPY.home.blocked, { date: `${dowName(oldest.date)} (${ddmm(oldest.date)})` });
}

/** Tải song song /api/home và /api/progress (kệ sách + lịch bài). Tiến độ lỗi không chặn trang chủ. */
function useHomeData() {
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    studentApi.home().then(setHome).catch((e: unknown) => setError(errorText(e)));
    studentApi.progress().then(setProgress).catch(() => setProgress(null));
  }, []);
  return { home, progress, error };
}

function Loading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Spinner />
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="p-6 text-center">
      <p className="text-bad-ink">{msg}</p>
      <Button variant="secondary" className="mt-4" onClick={() => location.reload()}>
        Tải lại
      </Button>
    </div>
  );
}

export default function Home() {
  const { home: data, progress, error } = useHomeData();
  const { logout } = useSession();
  const nav = useNavigate();

  if (error) return <ErrorBox msg={error} />;
  if (!data) return <Loading />;

  const today = todayVN();
  const firstOpen = data.assignments.find((a) => !a.blocked);

  return (
    <div>
      <Banner className="lg:rounded-[var(--radius-card)]">
        <div className="flex items-start justify-between px-5 pb-6 pt-[max(1.1rem,env(safe-area-inset-top))] lg:px-7 lg:pt-6">
          <div>
            <p className="label-caps text-cream/80">{longDate(today)}</p>
            <h1 className="mt-1 font-serif text-[32px] font-semibold leading-none text-cream">Chào {data.student.name}</h1>
          </div>
          <button type="button" onClick={logout} aria-label="Đăng xuất" className="-mr-1 rounded-full bg-primary-edge/70 p-2 text-cream ring-1 ring-cream/20 backdrop-blur hover:bg-primary-edge">
            <LogOut className="size-5" strokeWidth={1.6} aria-hidden />
          </button>
        </div>
      </Banner>

      <main className="grid gap-4 px-4 pt-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:px-0 lg:pt-5">
        <DoingNow data={data} today={today} />

        <Card className="self-start">
          <SectionTitle>Tiến độ</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Chuỗi mốc" value={String(data.streak)} />
            <Stat label="XP tuần này" value={String(data.xpThisWeek)} />
            <Stat label="Tổng XP" value={data.xpTotal.toLocaleString('vi-VN')} />
          </div>
          {progress && (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="label-caps text-ink-3">Từ đã thuộc</span>
                <span className="font-semibold tabular-nums">
                  {progress.wordsByBox.pass}/{progress.wordsTotal}
                </span>
              </div>
              <ProgressBar value={progress.wordsByBox.pass} max={progress.wordsTotal || 1} label="Từ đã thuộc" />
            </div>
          )}
        </Card>

        {progress && (
          <Card className="lg:col-span-2">
            <SectionTitle aside="Chạm để xem từ">Kệ sách của tôi</SectionTitle>
            <Shelf counts={progress.wordsByBox} onOpen={(box) => nav(`/hoc/kho-tu?hop=${box}`)} />
          </Card>
        )}

        {progress && progress.calendar.length > 0 && (
          <Card className="self-start">
            <SectionTitle>Lịch bài</SectionTitle>
            <Schedule cells={progress.calendar} today={today} />
          </Card>
        )}

        <Card className="self-start">
          <SectionTitle>Lối tắt</SectionTitle>
          <div className="grid gap-2">
            {firstOpen && data.newWordsToPreview > 0 && (
              <QuickLink tone="teal" onClick={() => nav(`/hoc/bai/${firstOpen.milestoneId}`)}>
                Xem trước từ mới · {data.newWordsToPreview}
              </QuickLink>
            )}
            <QuickLink tone="wine" onClick={() => nav('/hoc/luyen-them')}>
              Luyện thêm
            </QuickLink>
            <QuickLink tone="teal" onClick={() => nav('/hoc/kho-tu')}>
              Kho từ
            </QuickLink>
            <QuickLink tone="wine" onClick={() => nav('/hoc/kho-tu?them=1')}>
              Thêm từ mới
            </QuickLink>
          </div>
        </Card>
      </main>
    </div>
  );
}

/** Trang "Bài cần làm" (thanh bên máy tính): chỉ khối ĐANG LÀM + LỊCH BÀI */
export function Assignments() {
  const { home: data, progress, error } = useHomeData();
  if (error) return <ErrorBox msg={error} />;
  if (!data) return <Loading />;
  const today = todayVN();
  return (
    <div className="grid gap-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:px-0">
      <SectionTitle as="h1" className="lg:col-span-2">
        Bài cần làm
      </SectionTitle>
      <DoingNow data={data} today={today} />
      {progress && progress.calendar.length > 0 && (
        <Card className="self-start">
          <SectionTitle>Lịch bài</SectionTitle>
          <Schedule cells={progress.calendar} today={today} />
        </Card>
      )}
    </div>
  );
}

function DoingNow({ data, today }: { data: HomeResponse; today: string }) {
  const nav = useNavigate();
  const now = useNow();
  const reason = blockedReason(data.assignments);
  return (
    <section id="dang-lam" className="self-start rounded-[var(--radius-card)] bg-highlight p-4 ring-1 ring-highlight-line">
      <SectionTitle aside={data.nextDeadlineAt ? `Còn ${countdown(data.nextDeadlineAt, now)} · hạn ${dowShort(vnDate(data.nextDeadlineAt))}` : undefined}>
        Đang làm
      </SectionTitle>
      {data.assignments.length === 0 ? (
        <div className="flex items-center gap-4">
          <Spot src={ART.emptyShelf} className="w-24 shrink-0" />
          <div>
            <p className="text-sm text-ink-2">{COPY.home.no_assignment}</p>
            <Button variant="accent" className="mt-3" onClick={() => nav('/hoc/luyen-them')}>
              Luyện thêm
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {data.assignments.map((a, i) => (
            <AssignmentItem key={a.milestoneId} a={a} today={today} reason={reason} newWords={i === 0 ? data.newWordsToPreview : 0} />
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-blush px-2 py-3 text-center">
      <p className="text-[22px] font-bold leading-none tabular-nums text-ink">{value}</p>
      <p className="label-caps mt-1.5 !text-[10px] !tracking-[0.05em] leading-tight text-blush-ink">{label}</p>
    </div>
  );
}

function QuickLink({ tone, onClick, children }: { tone: 'teal' | 'wine'; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'h-11 w-full rounded-full px-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition active:scale-[0.99]',
        tone === 'teal' ? 'bg-primary hover:bg-primary-hover' : 'bg-accent hover:bg-accent-hover',
      )}
    >
      {children}
    </button>
  );
}

function Shelf({ counts, onOpen }: { counts: ProgressResponse['wordsByBox']; onOpen: (box: number) => void }) {
  const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {SHELF.map((b) => (
        <div key={b.key}>
          <BookCover
            title={b.title}
            subtitle={`${counts[b.key]} từ`}
            tone={b.tone}
            emblem={b.emblem}
            progress={counts[b.key] / total}
            onClick={() => onOpen(b.box)}
            label={`${b.title}: ${counts[b.key]} từ. Mở kho từ`}
          />
        </div>
      ))}
    </div>
  );
}

const KIND_SHORT = { tue: 'T3', fri: 'T6', sun: 'CN' } as const;

function statusChip(c: ProgressResponse['calendar'][number]): { tone: 'ok' | 'mid' | 'low' | 'bad' | 'off' | 'brand' | 'blush'; text: string } {
  if (c.status === 'off') return { tone: 'off', text: 'Nghỉ' };
  if (c.status === 'abandoned') return { tone: 'bad', text: 'Bỏ bài' };
  if (c.status === 'owing') return { tone: 'bad', text: 'Đang nợ' };
  if (c.status === 'open') return { tone: 'brand', text: 'Đang mở' };
  if (c.status === 'locked') return { tone: 'blush', text: 'Chưa mở' };
  const p = c.score_pct ?? 0;
  return { tone: p >= 100 ? 'ok' : p >= 50 ? 'mid' : p >= 30 ? 'low' : 'bad', text: p >= 100 ? 'Đúng hạn' : 'Nộp trễ' };
}

function Schedule({ cells, today }: { cells: ProgressResponse['calendar']; today: string }) {
  // gần hôm nay nhất lên trước: 2 mốc sắp tới + các mốc đã qua
  const upcoming = cells.filter((c) => c.date >= today).slice(0, 2);
  const past = cells.filter((c) => c.date < today).reverse();
  const rows = [...upcoming.reverse(), ...past].slice(0, 8);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left">
          <th className="label-caps pb-2 font-semibold text-ink-3">Ngày</th>
          <th className="label-caps pb-2 font-semibold text-ink-3">Mốc</th>
          <th className="label-caps pb-2 font-semibold text-ink-3">Trạng thái</th>
          <th className="label-caps pb-2 text-right font-semibold text-ink-3">Điểm</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => {
          const chip = statusChip(c);
          return (
            <tr key={c.date} className="border-b border-line/70 last:border-0">
              <td className="py-2 tabular-nums">{ddmm(c.date)}</td>
              <td className="py-2 text-ink-2">{KIND_SHORT[c.kind]}</td>
              <td className="py-2">
                <Tag tone={chip.tone}>{chip.text}</Tag>
              </td>
              <td className="py-2 text-right font-semibold tabular-nums">{c.score_pct != null ? `${c.score_pct}%` : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AssignmentItem({ a, today, reason, newWords }: { a: AssignmentCard; today: string; reason: string; newWords: number }) {
  const nav = useNavigate();
  const { done, required } = a.progress;
  const owing = a.status === 'owing';
  const title = lessonTitle(a.date);

  if (a.blocked) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-surface/70 p-3 ring-1 ring-line">
        <BookCover small title="Chờ" tone="navy" emblem="moon" label={`${title} — bị khoá`} className="opacity-60" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold text-ink-2">
            <Lock className="size-3.5" aria-hidden /> {title}
          </p>
          <p className="mt-0.5 text-sm text-ink-3">{reason}</p>
        </div>
      </div>
    );
  }

  const isToday = a.date === today;
  const dropsTomorrow = a.tomorrowPct < a.currentPct;

  return (
    <div className={cx('rounded-xl bg-surface p-3 shadow-[var(--shadow-card)] ring-1', owing ? 'ring-bad/50' : 'ring-line')}>
      <div className="flex gap-3">
        <BookCover small title={dowShort(a.date)} tone={owing ? 'wine' : 'teal'} emblem="star" progress={required ? done / required : 0} label={title} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {owing ? <Tag tone="bad">Đang nợ · trễ {a.daysLateNow} ngày</Tag> : <Tag tone="brand">Hạn 23:59 {isToday ? 'hôm nay' : ddmm(a.date)}</Tag>}
            {newWords > 0 && <Tag tone="blush">+{newWords} từ mới</Tag>}
          </div>
          <h3 className="mt-1.5 font-serif text-[21px] font-bold leading-tight">{title}</h3>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <ProgressBar value={done} max={required ?? 1} tone={owing ? 'bad' : 'brand'} className="flex-1" label="Tiến độ bài" />
            <span className="shrink-0 font-semibold tabular-nums text-ink-2">{required ? `${done}/${required} câu` : 'Chưa bắt đầu'}</span>
          </div>
        </div>
      </div>

      {(owing || dropsTomorrow) && (
        <div className={cx('mt-3 flex items-end justify-between rounded-lg px-3 py-2', owing ? 'bg-bad-bg' : 'bg-brand-tint')}>
          <div>
            <p className="label-caps !text-[10px] text-ink-2">Nộp hôm nay được</p>
            <p className={cx('text-[22px] font-bold leading-none tabular-nums', owing ? 'text-bad-ink' : 'text-brand-ink')}>{a.currentPct}%</p>
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

      <Button block className="mt-3" onClick={() => nav(`/hoc/bai/${a.milestoneId}`)}>
        {done > 0 ? 'Làm tiếp' : 'Bắt đầu làm bài'}
      </Button>
    </div>
  );
}
