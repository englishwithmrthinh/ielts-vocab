// API trang phụ huynh: GET /api/report/:token (không cần đăng nhập — token trong link).
import type { ParentReportResponse } from '@shared/types';
import { api } from '../lib/api';
import { mockReport } from './mock';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export async function fetchReport(token: string): Promise<ParentReportResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return mockReport(new URLSearchParams(location.search).get('mock') === 'final' ? 'final' : 'draft');
  }
  return api<ParentReportResponse>('GET', `/api/report/${encodeURIComponent(token)}`);
}
