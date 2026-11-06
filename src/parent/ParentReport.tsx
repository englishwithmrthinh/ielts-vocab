// TRANG PHỤ HUYNH /bao-cao/:token — Claude 2.
// Khổ dọc điện thoại, chụp màn hình gửi Zalo đẹp; có CSS in + nút In / Lưu PDF.
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import { BookOpenCheck, Printer } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { ApiCallError } from '../lib/api';
import { CalendarLegend, MonthCalendar } from '../student/components/MonthCalendar';
import { Button, Spinner, cx } from '../student/components/ui';
import { Ring } from '../student/pages/Progress';
import type { ParentReportResponse } from '@shared/types';
import { fetchReport } from './api';

const monthTitle = (m: string) => `Tháng ${Number(m.slice(5))}/${m.slice(0, 4)}`;

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx('print-avoid-break rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-line', className)}>
      <h2 className="mb-3 text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Big({ value, label, sub, tone }: { value: string; label: string; sub?: string; tone?: 'ok' | 'mid' | 'bad' | 'brand' }) {
  const t = { ok: 'bg-ok-bg text-ok-ink', mid: 'bg-mid-bg text-mid-ink', bad: 'bg-bad-bg text-bad-ink', brand: 'bg-brand-tint text-brand-ink' }[tone ?? 'brand'];
  return (
    <div className={cx('rounded-2xl px-3 py-3', t)}>
      <p className="text-[28px] font-bold leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 text-sm font-semibold">{label}</p>
      {sub && <p className="text-xs opacity-80">{sub}</p>}
    </div>
  );
}

export default function ParentReport() {
  const { token = '' } = useParams();
  const [d, setD] = useState<ParentReportResponse | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetchReport(token)
      .then((r) => {
        setD(r);
        document.title = `Báo cáo ${monthTitle(r.month)} — ${r.student.name}`;
      })
      .catch((e: unknown) =>
        setErr(e instanceof ApiCallError && e.status === 404 ? 'Link báo cáo không đúng hoặc đã hết hạn. Vui lòng liên hệ giáo viên.' : 'Không tải được báo cáo. Vui lòng thử lại sau.'),
      );
  }, [token]);

  return (
    <div className="student-root">
      <div className="mx-auto max-w-md px-4 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))] print:max-w-[125mm] print:p-0">
        {err && <p className="pt-20 text-center text-bad-ink">{err}</p>}
        {!d && !err && (
          <div className="flex min-h-[60dvh] items-center justify-center">
            <Spinner />
          </div>
        )}
        {d && <Report d={d} />}
      </div>
    </div>
  );
}

function Report({ d }: { d: ParentReportResponse }) {
  const s = d.stats;
  // Tạm tính: không hiện nhận xét. Đã chốt: teacher_comment, chưa có thì ai_comment.
  const comment = d.status === 'final' ? (d.teacher_comment ?? d.ai_comment) : null;
  const maxWeek = Math.max(1, ...s.passed_by_week.map((w) => w.passed_total));
  const attTone = s.attendance_pct >= 90 ? 'ok' : s.attendance_pct >= 50 ? 'mid' : 'bad';

  return (
    <div className="space-y-3">
      <header className="rounded-[var(--radius-card)] bg-primary p-5 text-white print-avoid-break">
        <div className="flex items-center gap-2 text-sm text-white/90">
          <BookOpenCheck className="size-5" aria-hidden /> Ôn từ vựng IELTS · Báo cáo phụ huynh
        </div>
        <h1 className="mt-2 text-2xl font-bold">{d.student.name}</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-lg">{monthTitle(d.month)}</span>
          <span
            className={cx(
              'rounded-lg px-2 py-0.5 text-xs font-bold',
              d.status === 'final' ? 'bg-white text-primary' : 'bg-mid-bg text-mid-ink',
            )}
          >
            {d.status === 'final' ? 'Đã chốt' : 'Tạm tính'}
          </span>
        </div>
        {d.status === 'draft' && <p className="mt-2 text-xs text-white/90">Số liệu đang cập nhật, sẽ chốt vào ngày 8 tháng sau.</p>}
      </header>

      <div className="grid grid-cols-2 gap-2 print-avoid-break">
        <Big value={`${s.submitted}/${s.total}`} label="Bài hoàn thành" />
        <Big value={String(s.on_time)} label="Nộp đúng hạn" tone="ok" />
        <Big
          value={String(s.late)}
          label="Nộp trễ"
          sub={s.late ? `TB ${s.avg_days_late} ngày/bài` : undefined}
          tone={s.late ? 'mid' : 'ok'}
        />
        <Big value={`${s.attendance_pct}%`} label="Chuyên cần" tone={attTone} />
      </div>
      {(s.abandoned > 0 || s.owing > 0) && (
        <p className="rounded-xl bg-bad-bg px-3 py-2 text-sm text-bad-ink">
          {s.abandoned > 0 && `Bỏ ${s.abandoned} bài (quá 7 ngày không nộp). `}
          {s.owing > 0 && `Đang nợ ${s.owing} bài.`}
        </p>
      )}

      <Section title="Lịch nộp bài trong tháng">
        <MonthCalendar month={d.month} cells={s.cells.map((c) => ({ date: c.milestone_date, status: c.status, score_pct: c.score_pct, days_late: c.days_late }))} />
        <CalendarLegend />
      </Section>

      <Section title="Từ vựng">
        <div className="flex items-center gap-4">
          <Ring value={s.words_passed} max={s.words_assigned} size={112} label={`Đã thuộc ${s.words_passed} trên ${s.words_assigned} từ`} />
          <dl className="flex-1 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-2">Đã thuộc</dt>
              <dd className="font-bold text-ok-ink">{s.words_passed}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Đang học</dt>
              <dd className="font-bold">{s.words_learning}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-1.5">
              <dt className="text-ink-2">Tổng số từ được giao</dt>
              <dd className="font-bold">{s.words_assigned}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Độ chính xác</dt>
              <dd className="font-bold text-brand-ink">{s.accuracy_pct}%</dd>
            </div>
          </dl>
        </div>

        {s.passed_by_week.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-ink-2">Số từ đã thuộc (cộng dồn theo tuần)</p>
            <div className="flex h-28 items-end gap-2" role="img" aria-label="Biểu đồ số từ đã thuộc theo tuần">
              {s.passed_by_week.map((w, i) => (
                <div key={w.week_start} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-bold tabular-nums">{w.passed_total}</span>
                  <div className="w-full rounded-t-lg bg-brand" style={{ height: `${(w.passed_total / maxWeek) * 72}px` }} />
                  <span className="text-[11px] text-ink-3">Tuần {i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Nhận xét của giáo viên">
        {comment ? (
          <p className="whitespace-pre-line leading-relaxed">{comment}</p>
        ) : (
          <p className="text-sm text-ink-3">Nhận xét của thầy sẽ có khi báo cáo được chốt.</p>
        )}
      </Section>

      <div className="no-print pt-2">
        <Button block size="lg" onClick={() => window.print()}>
          <Printer className="size-5" aria-hidden /> In / Lưu PDF
        </Button>
        <p className="mt-2 text-center text-xs text-ink-3">Trên điện thoại: chọn "Lưu dưới dạng PDF" trong hộp thoại in.</p>
      </div>
    </div>
  );
}
