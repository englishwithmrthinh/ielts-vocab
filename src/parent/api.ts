// API trang phụ huynh: GET /api/report/:token (không cần đăng nhập — token trong link).
// Kiểu trả về là GIẢ ĐỊNH của Claude 2 (shared/types chưa có) — xem "Câu hỏi cho sếp" GĐ3.
import type { ISODateTime, MonthKey, MonthlyStats } from '@shared/types';
import { api } from '../lib/api';
import { mockReport } from './mock';

export interface ParentReportResponse {
  student: { name: string };
  month: MonthKey;
  status: 'draft' | 'final';
  finalized_at: ISODateTime | null;
  stats: MonthlyStats;
  ai_comment: string | null;
  teacher_comment: string | null;
}

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export async function fetchReport(token: string): Promise<ParentReportResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return mockReport(new URLSearchParams(location.search).get('mock') === 'final' ? 'final' : 'draft');
  }
  return api<ParentReportResponse>('GET', `/api/report/${encodeURIComponent(token)}`);
}
