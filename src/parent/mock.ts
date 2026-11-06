// Dữ liệu giả cho trang phụ huynh (tháng hiện tại).
import { monthKey } from '@shared/time';
import { todayVN } from '../student/lib/format';
import { mockCalendar } from '../student/mock/progress';
import type { ParentReportResponse } from './api';

export function mockReport(status: 'draft' | 'final'): ParentReportResponse {
  const month = monthKey(todayVN());
  // Bản "đã chốt" giả định cả tháng đã qua: lấy ngày cuối tháng làm "hôm nay"
  const cells = mockCalendar(month, status === 'final' ? `${month}-30` : todayVN());
  const done = cells.filter((c) => c.status === 'submitted');
  const late = done.filter((c) => (c.days_late ?? 0) > 0);
  const counted = cells.filter((c) => !['off', 'locked', 'open'].includes(c.status));
  const totalLate = late.reduce((s, c) => s + (c.days_late ?? 0), 0);
  return {
    student: { name: 'Nguyễn Minh Anh' },
    month,
    status,
    finalized_at: status === 'final' ? new Date().toISOString() : null,
    stats: {
      month,
      total: counted.length,
      submitted: done.length,
      on_time: done.length - late.length,
      late: late.length,
      abandoned: cells.filter((c) => c.status === 'abandoned').length,
      owing: cells.filter((c) => c.status === 'owing').length,
      total_days_late: totalLate,
      avg_days_late: late.length ? Math.round((totalLate / late.length) * 10) / 10 : 0,
      attendance_pct: counted.length ? Math.round(counted.reduce((s, c) => s + (c.score_pct ?? 0), 0) / counted.length) : 0,
      words_assigned: 60,
      words_passed: 16,
      words_learning: 44,
      accuracy_pct: 82,
      passed_by_week: [
        { week_start: `${month}-02`, passed_total: 3 },
        { week_start: `${month}-09`, passed_total: 7 },
        { week_start: `${month}-16`, passed_total: 12 },
        { week_start: `${month}-23`, passed_total: 16 },
      ],
      cells: cells.map((c) => ({ milestone_date: c.date, kind: c.kind, status: c.status, score_pct: c.score_pct, days_late: c.days_late })),
    },
    ai_comment:
      'Minh Anh duy trì việc ôn bài khá đều trong tháng, phần lớn các bài nộp đúng hạn. Em ghi nhớ tốt các từ về chủ đề môi trường và giao thông. Tháng tới em nên chú ý nộp bài đúng hạn hơn vào các ngày Chủ nhật và luyện thêm phần gõ chính tả.',
    teacher_comment: null,
  };
}
