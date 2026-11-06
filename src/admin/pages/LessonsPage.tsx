/** Danh sách buổi học. Giai đoạn 2 sẽ thêm nút chạy pipeline, Duyệt, Phát hành. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type LessonSummary } from '../lib/adminApi';
import { Badge, Button, Card, ErrorBox, PageHeader } from '../ui';

const STATUS: Record<LessonSummary['status'], { label: string; tone: 'slate' | 'amber' | 'blue' | 'teal' }> = {
  draft: { label: 'Nháp', tone: 'slate' },
  processing: { label: 'Đang tạo media', tone: 'amber' },
  review: { label: 'Chờ duyệt', tone: 'blue' },
  published: { label: 'Đã phát hành', tone: 'teal' },
};

function fmtDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    adminApi.lessons().then((r) => setLessons(r.lessons), setError);
  }, []);

  return (
    <>
      <PageHeader title="Buổi học" actions={<Link to="/admin/tao-buoi"><Button>+ Tạo buổi</Button></Link>} />
      <ErrorBox error={error} />
      <Card className="p-0 sm:p-0">
        {!lessons ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Đang tải…</p>
        ) : lessons.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Chưa có buổi nào. Bấm “Tạo buổi” để dán từ vựng buổi đầu tiên.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lessons.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="w-20 font-semibold text-slate-900">Buổi {l.number}</span>
                <span className="w-24 text-sm text-slate-600">{fmtDate(l.taught_on)}</span>
                <span className="text-sm text-slate-600">{l.word_count} từ · {l.student_count} học sinh</span>
                <span className="ml-auto"><Badge tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Badge></span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
