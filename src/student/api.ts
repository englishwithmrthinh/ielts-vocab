// Lớp gọi API khu học sinh. Phiên đăng nhập = cookie httpOnly (server đặt), không lưu token ở trình duyệt.
// VITE_USE_MOCK=true → dùng dữ liệu giả trong ./mock, không cần backend.
import type {
  AddWordResponse, AnswerResult, AnswerSubmission, HomeResponse, MyWordsResponse, NextQuestionResponse, PreviewResponse,
  ProgressResponse, StartAssignmentResponse, SubmitResponse,
} from '@shared/types';
import { api, ApiCallError } from '../lib/api';
import { COPY } from './lib/copy';
import { mockHome } from './mock/home';
import { mockLesson, mockPractice } from './mock/lesson';
import { mockAddWord, mockMyWords, mockProgress } from './mock/progress';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export interface Me {
  name: string;
  code: string;
}

// ---- Giả lập cookie phiên khi chạy mock (chỉ để thử giao diện) ----
const MOCK_KEY = 'ielts.mock.session';
const mockStore = {
  get(): Me | null {
    try {
      const v = sessionStorage.getItem(MOCK_KEY);
      return v ? (JSON.parse(v) as Me) : null;
    } catch {
      return null;
    }
  },
  set(me: Me | null) {
    try {
      if (me) sessionStorage.setItem(MOCK_KEY, JSON.stringify(me));
      else sessionStorage.removeItem(MOCK_KEY);
    } catch {
      /* trình duyệt chặn storage: bỏ qua */
    }
  },
};
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const mockScenario = () => new URLSearchParams(location.search).get('mock') ?? 'owing';
let mockFails = 0;

export const studentApi = {
  async login(code: string, pin: string): Promise<Me> {
    if (USE_MOCK) {
      await delay(400);
      if (mockFails >= 10) throw new ApiCallError(429, 'too_many_attempts', 'Sai quá nhiều lần. Đợi 15 phút rồi thử lại nhé.');
      // Mã thử: HS01 / PIN 1234
      if (code.trim().toUpperCase() === 'HS01' && (pin === '' || pin === '1234')) {
        mockFails = 0;
        const me = { name: 'Minh Anh', code: 'HS01' };
        mockStore.set(me);
        return me;
      }
      mockFails++;
      throw new ApiCallError(401, 'wrong_credentials', 'Mã chưa đúng');
    }
    const r = await api<{ student: Me }>('POST', '/api/login', pin ? { code: code.trim(), pin } : { code: code.trim() });
    return r.student;
  },

  /** null = chưa đăng nhập */
  async me(): Promise<Me | null> {
    if (USE_MOCK) {
      await delay(100);
      return mockStore.get();
    }
    try {
      const r = await api<{ student: Me }>('GET', '/api/me');
      return r.student;
    } catch (e) {
      if (e instanceof ApiCallError && e.status === 401) return null;
      throw e;
    }
  },

  async logout(): Promise<void> {
    if (USE_MOCK) {
      mockStore.set(null);
      return;
    }
    await api('POST', '/api/logout');
  },

  async home(): Promise<HomeResponse> {
    if (USE_MOCK) {
      await delay();
      return mockHome(mockScenario());
    }
    return api<HomeResponse>('GET', '/api/home');
  },

  // ---- Làm bài — theo hợp đồng API sếp chốt 06/11 ----
  /** Các từ mới chưa xem. milestoneId chỉ dùng cho dữ liệu giả. */
  async preview(milestoneId: string): Promise<PreviewResponse> {
    if (USE_MOCK) {
      await delay(200);
      return mockLesson.preview(milestoneId);
    }
    return api<PreviewResponse>('GET', '/api/preview');
  },

  async start(milestoneId: string): Promise<StartAssignmentResponse> {
    if (USE_MOCK) {
      await delay(200);
      return mockLesson.start(milestoneId);
    }
    return api<StartAssignmentResponse>('POST', '/api/assignment/start', { milestoneId });
  },

  async next(assignmentId: string, extra = false): Promise<NextQuestionResponse> {
    if (USE_MOCK) {
      await delay(150);
      return mockLesson.next(assignmentId, extra);
    }
    const q = `assignmentId=${encodeURIComponent(assignmentId)}${extra ? '&extra=1' : ''}`;
    return api<NextQuestionResponse>('GET', `/api/assignment/next?${q}`);
  },

  async answer(assignmentId: string, a: AnswerSubmission): Promise<AnswerResult> {
    if (USE_MOCK) {
      await delay(250);
      return mockLesson.answer(assignmentId, a);
    }
    return api<AnswerResult>('POST', '/api/answer', { assignmentId, ...a });
  },

  async submit(assignmentId: string): Promise<SubmitResponse> {
    if (USE_MOCK) {
      await delay(400);
      return mockLesson.submit(assignmentId);
    }
    return api<SubmitResponse>('POST', '/api/assignment/submit', { assignmentId });
  },

  // ---- Giai đoạn 3 ----
  async progress(): Promise<ProgressResponse> {
    if (USE_MOCK) {
      await delay();
      return mockProgress();
    }
    return api<ProgressResponse>('GET', '/api/progress');
  },

  async myWords(): Promise<MyWordsResponse> {
    if (USE_MOCK) {
      await delay();
      return mockMyWords();
    }
    return api<MyWordsResponse>('GET', '/api/my-words');
  },

  /** Thêm từ: có trong kho tổng → 'linked' (gán luôn); chưa có → 'pending' (Chờ duyệt). */
  async addWord(text: string, note: string | null): Promise<AddWordResponse> {
    if (USE_MOCK) {
      await delay(400);
      return mockAddWord(text, note);
    }
    return api<AddWordResponse>('POST', '/api/my-words', { text: text.trim(), note: note ?? undefined });
  },

  // ---- Luyện thêm: không đổi hộp, không tính điểm, câu đúng +2 XP ----
  async practiceNext(): Promise<NextQuestionResponse> {
    if (USE_MOCK) {
      await delay(150);
      return mockPractice.next();
    }
    return api<NextQuestionResponse>('GET', '/api/practice/next');
  },

  /** Trả lời câu luyện thêm: dùng chung POST /api/answer, không gửi assignmentId */
  async practiceAnswer(a: AnswerSubmission): Promise<AnswerResult> {
    if (USE_MOCK) {
      await delay(200);
      return mockPractice.answer(a);
    }
    return api<AnswerResult>('POST', '/api/answer', a);
  },

  /** Nút "Câu này có 2 đáp án đúng" */
  async flag(qid: string): Promise<void> {
    if (USE_MOCK) {
      await delay(200);
      return;
    }
    await api('POST', '/api/flag', { qid });
  },
};

/** Câu báo lỗi cho học sinh: ưu tiên câu server trả về */
export function errorText(e: unknown): string {
  if (e instanceof ApiCallError) {
    if (e.status === 401 && e.code !== 'wrong_credentials') return COPY.errors.session_expired;
    if (e.status >= 500) return COPY.errors.server;
    return e.message;
  }
  return COPY.errors.offline;
}
