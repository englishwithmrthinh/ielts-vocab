/** Panel chi tiết 1 học sinh: đang nợ, bỏ bài, đang mở, nộp gần đây, bộ từ đã nhận, link lịch tháng.
 *  Máy tính: trượt từ bên phải. Điện thoại: toàn màn hình. Esc hoặc ✕ để đóng. */
import { useEffect, useState, type ReactNode } from 'react';
import { adminApi, type StudentDetail, type StudentDetailItem } from '../lib/adminApi';
import { dateLabel, overdueDays, vnDue, vnDueDay } from '../lib/vnTime';
import { Badge, Button, ErrorBox } from '../ui';

type LessonState = StudentDetail['lessons'][number]['state'];

const LESSON_STATE: Record<NonNullable<LessonState> | 'none', { label: string; tone: 'slate' | 'amber' | 'blue' | 'teal' | 'red' }> = {
  submitted: { label: 'Đã nộp', tone: 'teal' },
  open: { label: 'Đang mở', tone: 'blue' },
  owing: { label: 'Đang nợ', tone: 'red' },
  abandoned: { label: 'Bỏ bài', tone: 'slate' },
  locked: { label: 'Chưa mở', tone: 'slate' },
  off: { label: 'Nghỉ', tone: 'slate' },
  none: { label: 'Chưa tính', tone: 'slate' },
};

const progress = (it: StudentDetailItem) => (it.required ? `${it.answered}/${it.required} câu` : it.answered ? `${it.answered} câu` : 'chưa làm');
const lateDays = (it: StudentDetailItem) => it.days_late ?? overdueDays(it.deadline_at);

export function StudentDetailPanel({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const [data, setData] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    adminApi.studentDetail(studentId).then(setData, setError);
  }, [studentId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // không cuộn trang phía sau
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const s = data?.student;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Đóng" tabIndex={-1} className="absolute inset-0 hidden bg-slate-900/20 lg:block" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={s ? `Chi tiết ${s.name}` : 'Chi tiết học sinh'}
        className="relative flex h-full w-full flex-col bg-white shadow-xl lg:w-[460px] lg:border-l lg:border-slate-200"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            {s ? (
              <>
                <h2 className="truncate text-lg font-semibold text-slate-900">{s.name}</h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
                  <span className="font-mono">{s.code}</span>
                  <span>·</span>
                  {s.class_name ? <span>{s.class_name}</span> : <Badge tone="amber">Chưa xếp lớp</Badge>}
                  {!s.active && <Badge>Đã khoá</Badge>}
                </p>
              </>
            ) : <h2 className="text-lg font-semibold text-slate-900">Học sinh</h2>}
          </div>
          <Button autoFocus variant="ghost" onClick={onClose} aria-label="Đóng panel">✕</Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <ErrorBox error={error} />
          {!data && !error && <p className="py-8 text-center text-sm text-slate-500">Đang tải…</p>}
          {data && (
            <>
              <Section title="Đang nợ" count={data.owing.length} tone="red" empty="Không nợ bài nào.">
                {data.owing.map((it) => (
                  <Row key={it.milestone_id}>
                    <span className="font-medium text-slate-900">{dateLabel(it.date)}</span>
                    <Dot /><span className="font-medium text-red-700">trễ {lateDays(it)} ngày</span>
                    <Dot /><span className="text-slate-600">{progress(it)}</span>
                    {it.extended && <Badge tone="amber">gia hạn riêng</Badge>}
                  </Row>
                ))}
              </Section>

              {data.abandoned.length > 0 && (
                <Section title="Bỏ bài" count={data.abandoned.length} tone="slate" hint="Quá 7 ngày, tính 0 điểm.">
                  {data.abandoned.map((it) => (
                    <Row key={it.milestone_id}>
                      <span className="font-medium text-slate-700">{dateLabel(it.date)}</span>
                      <Dot /><span className="text-slate-500">hạn {vnDue(it.deadline_at)}</span>
                      <Dot /><span className="text-slate-500">{progress(it)}</span>
                    </Row>
                  ))}
                </Section>
              )}

              <Section title="Đang mở" count={data.open.length} tone="blue" empty="Không có bài đang mở.">
                {data.open.map((it) => (
                  <Row key={it.milestone_id}>
                    <span className="font-medium text-slate-900">{dateLabel(it.date)}</span>
                    <Dot /><span className="text-slate-600">hạn {vnDue(it.deadline_at)}</span>
                    <Dot /><span className="text-slate-600">{progress(it)}</span>
                    {it.extended && <Badge tone="amber">gia hạn riêng</Badge>}
                  </Row>
                ))}
              </Section>

              <Section title="Đã nộp gần đây" count={data.recent.length} tone="teal" empty="Chưa nộp bài nào.">
                {data.recent.map((it) => (
                  <Row key={it.milestone_id}>
                    <span className="font-medium text-slate-900">{dateLabel(it.date)}</span>
                    <Dot /><span className="font-semibold tabular-nums text-slate-800">{it.score_pct ?? 0}%</span>
                    <Dot />
                    {it.days_late ? <span className="text-amber-700">trễ {it.days_late} ngày</span> : <span className="text-teal-700">đúng hạn</span>}
                  </Row>
                ))}
              </Section>

              <Section title="Bộ từ đã nhận" count={data.lessons.length} tone="slate" empty="Chưa nhận bộ từ nào.">
                {data.lessons.map((l) => {
                  const st = LESSON_STATE[l.state ?? 'none'];
                  return (
                    <Row key={l.id}>
                      <span className="font-medium text-slate-900">Bộ {l.number}</span>
                      {l.title && <><Dot /><span className="text-slate-700">{l.title}</span></>}
                      <Dot /><span className="text-slate-600">{l.due ? `hạn ${vnDueDay(l.due.deadline_at)}` : 'chưa có hạn'}</span>
                      <span className="ml-auto"><Badge tone={st.tone}>{st.label}{l.state === 'submitted' && l.score_pct !== null ? ` ${l.score_pct}%` : ''}</Badge></span>
                    </Row>
                  );
                })}
              </Section>

              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Gia hạn cho em này: vào <b>Bộ từ → Hạn nộp</b> (tick riêng em) hoặc <b>Lịch mốc</b>.
              </p>
            </>
          )}
        </div>

        {data && (
          <footer className="border-t border-slate-200 px-5 py-3">
            <a href={data.calendar_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-teal-700 hover:underline">
              Xem lịch tháng ↗
            </a>
            <span className="ml-2 text-xs text-slate-400">mở tab mới · cần đăng nhập admin</span>
          </footer>
        )}
      </aside>
    </div>
  );
}

function Section({ title, count, tone, empty, hint, children }: {
  title: string; count: number; tone: 'red' | 'blue' | 'teal' | 'slate'; empty?: string; hint?: string; children: ReactNode;
}) {
  const head = { red: 'text-red-700', blue: 'text-sky-800', teal: 'text-teal-800', slate: 'text-slate-700' }[tone];
  return (
    <section>
      <h3 className={`mb-1.5 flex items-baseline gap-2 text-sm font-semibold ${head}`}>
        {title}
        <span className="text-xs font-normal text-slate-400">{count}</span>
        {hint && <span className="text-xs font-normal text-slate-400">· {hint}</span>}
      </h3>
      {count === 0 ? <p className="text-sm text-slate-400">{empty}</p> : <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">{children}</ul>}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <li className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-3 py-2 text-sm">{children}</li>;
}
const Dot = () => <span className="text-slate-300">·</span>;
