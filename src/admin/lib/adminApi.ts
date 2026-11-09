/**
 * Mọi lời gọi API của khu quản trị đi qua đây.
 * Chế độ demo (?demo=1 trên URL): dùng dữ liệu giả trong trình duyệt, không cần
 * máy chủ — để xem giao diện và chụp màn hình khi chưa có Supabase/Netlify.
 */
import type { AdminFlagsResponse, AdminReportsResponse, AdminSuggestionsResponse, Class, ClassesResponse, Lesson, Milestone, Student, Word } from '@shared/types';
import { api } from '../../lib/api';
import { mockApi } from './mock';
import type { AdminOverview } from './overview';

export interface StudentCard { id: string; code: string; name: string; pin: string }

export interface LessonSummary {
  id: string;
  number: number;
  taught_on: string;
  status: 'draft' | 'processing' | 'review' | 'published';
  published_at: string | null;
  created_at: string;
  word_count: number;
  student_count: number;
  class_names?: string[];
  unassigned_count?: number;
  /** Tên bộ từ; null = "Bộ từ N" */
  title?: string | null;
  due_milestone_id?: string | null;
  /** Mốc đầu tiên từ mới phải làm */
  due?: { date: string; kind: string; deadline_at: string } | null;
}

/** Một học sinh trong bảng hạn nộp của bộ từ */
export interface LessonDeadlineStudent {
  id: string; code: string; name: string; class_name: string; active: boolean;
  status: 'submitted' | 'doing' | 'not_started' | 'owing' | 'abandoned' | 'off';
  /** Hạn hiệu lực của em này (có gia hạn riêng thì là hạn riêng) */
  deadline_at: string;
  /** Hạn riêng nếu đang được gia hạn riêng, không thì null */
  extended_to: string | null;
  days_late: number | null; score_pct: number | null; answered: number; required: number | null;
  /** Có từ của bộ này dư sang bài sau */
  spill: boolean;
}

/** GET /api/admin/lessons/deadline?id= */
export interface LessonDeadline {
  lesson: { id: string; number: number; title: string | null; status: string };
  /** Mốc làm lần đầu của bộ từ (bài chính) */
  milestone: { id: string; date: string; kind: string; opens_at: string; deadline_at: string; is_off: boolean } | null;
  /** true: bộ cũ chưa đặt mốc, mốc được suy ra từ bài sớm nhất có từ của bộ */
  inferred: boolean;
  state: 'none' | 'locked' | 'open' | 'overdue' | 'off';
  daysOverdue: number;
  counts: { total: number; submitted: number; doing: number; notStarted: number; owing: number; abandoned: number };
  students: LessonDeadlineStudent[];
  spillCount: number;
  /** false: chưa chạy migration 005 → chưa gia hạn riêng được */
  extensionsReady: boolean;
}

export interface ExistingWord { word: string; pos: string; id: string; has_audio: boolean; has_image: boolean }

type Method = 'GET' | 'POST';

function readDemoFlag(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('demo');
    if (q === '1') sessionStorage.setItem('admin-demo', '1');
    if (q === '0') sessionStorage.removeItem('admin-demo');
    return sessionStorage.getItem('admin-demo') === '1';
  } catch {
    return new URLSearchParams(window.location.search).get('demo') === '1';
  }
}

export const DEMO = typeof window !== 'undefined' && readDemoFlag();

function call<T>(method: Method, path: string, body?: unknown): Promise<T> {
  return DEMO ? mockApi<T>(method, path, body) : api<T>(method, path, body);
}

export const adminApi = {
  me: () => call<{ ok: true }>('GET', '/api/admin/me'),
  login: (password: string) => call<{ ok: true }>('POST', '/api/admin/login', { password }),
  logout: () => call<{ ok: true }>('POST', '/api/admin/logout'),

  students: () => call<{ students: Student[] }>('GET', '/api/admin/students'),
  addStudents: (names: string[], classId: string | null = null) => call<{ created: StudentCard[] }>('POST', '/api/admin/students', { names, classId }),

  classes: () => call<ClassesResponse>('GET', '/api/admin/classes'),
  addClass: (name: string) => call<{ class: Class }>('POST', '/api/admin/classes', { name }),
  updateClass: (id: string, patch: { name?: string; active?: boolean; code?: string }) => call<{ class: Class }>('POST', '/api/admin/classes/update', { id, ...patch }),
  deleteClass: (id: string) => call<{ ok: true }>('POST', '/api/admin/classes/delete', { id }),
  deleteStudents: (ids: string[]) => call<{ deleted: number }>('POST', '/api/admin/students/delete', { ids }),
  moveStudents: (studentIds: string[], classId: string | null) => call<{ moved: number }>('POST', '/api/admin/classes/move', { studentIds, classId }),
  updateStudent: (id: string, patch: { name?: string; active?: boolean; pin?: string; birth?: string }) =>
    call<{ student: Student }>('POST', '/api/admin/students/update', { id, ...patch }),
  resetPins: (ids: string[]) => call<{ cards: StudentCard[] }>('POST', '/api/admin/students/reset-pins', { ids }),

  milestones: (month: string) => call<{ milestones: Milestone[] }>('GET', `/api/admin/milestones?month=${month}`),
  setOff: (id: string, off: boolean) => call<{ ok: true }>('POST', '/api/admin/milestones/off', { id, off }),
  setDeadline: (id: string, deadline: string) => call<{ ok: true; deadline_at: string }>('POST', '/api/admin/milestones/deadline', { id, deadline }),
  deleteLesson: (id: string) => call<{ ok: true; removedWords: number; affectedStudents: number }>('POST', '/api/admin/lessons/delete', { id }),

  lessons: () => call<{ lessons: LessonSummary[]; nextNumber: number }>('GET', '/api/admin/lessons'),
  checkWords: (words: { word: string; pos: string }[]) =>
    call<{ existing: ExistingWord[] }>('POST', '/api/admin/lessons/check', { words }),
  createLesson: (body: { number: number; taught_on: string; student_ids: string[]; json: string }) =>
    call<{ lesson: { id: string; number: number }; reused: number; created: number }>('POST', '/api/admin/lessons', body),

  lessonDetail: (id: string) => call<LessonDetail>('GET', `/api/admin/lessons/detail?id=${id}`),
  runPipeline: (lessonId: string) => call<unknown>('POST', '/api/admin/pipeline/run', { lesson_id: lessonId }),
  redoWord: (wordId: string, what: 'audio' | 'image') => call<unknown>('POST', '/api/admin/pipeline/word', { word_id: wordId, what }),
  updateWord: (id: string, patch: Partial<Word>) => call<{ word: Word }>('POST', '/api/admin/words/update', { id, patch }),
  dropImage: (id: string) => call<{ word: Word }>('POST', '/api/admin/words/drop-image', { id }),
  imagePrompts: (lessonId: string) => call<{ grids: GridTask[] }>('GET', `/api/admin/images/prompts?lesson_id=${lessonId}`),
  singlePrompt: (wordId: string) => call<{ prompt: string }>('GET', `/api/admin/images/single-prompt?word_id=${wordId}`),
  uploadGrid: (lessonId: string, index: number, image: string) =>
    call<{ updated: number; kept: number; layout: string; ms: number }>('POST', '/api/admin/images/grid', { lesson_id: lessonId, index, image }),
  uploadSingle: (wordId: string, image: string) => call<{ word: Word }>('POST', '/api/admin/images/single', { word_id: wordId, image }),
  overview: () => call<AdminOverview>('GET', '/api/admin/overview'),
  getWord: (id: string) => call<{ word: Word }>('GET', `/api/admin/words/get?id=${id}`),

  reports: (month: string) => call<AdminReportsResponse>('GET', `/api/admin/reports?month=${month}`),
  updateReport: (id: string, patch: { teacher_comment?: string | null; ai_comment?: string | null }) =>
    call<{ ok: true }>('POST', '/api/admin/reports/update', { id, ...patch }),
  finalizeReport: (id: string) => call<{ ok: true }>('POST', '/api/admin/reports/finalize', { id }),
  runMonthly: (month: string, final: boolean) => call<unknown>('POST', '/api/jobs/monthly', { month, final }),

  suggestions: (status = 'pending') => call<AdminSuggestionsResponse>('GET', `/api/admin/suggestions?status=${status}`),
  updateSuggestion: (id: string, status: 'added' | 'rejected', wordId?: string) =>
    call<{ ok: true }>('POST', '/api/admin/suggestions/update', { id, status, ...(wordId ? { word_id: wordId } : {}) }),
  flags: () => call<AdminFlagsResponse>('GET', '/api/admin/flags'),

  publish: (lessonId: string, studentIds: string[], milestoneId?: string | null) =>
    call<PublishResult>('POST', '/api/admin/lessons/publish', { lesson_id: lessonId, student_ids: studentIds, ...(milestoneId ? { milestone_id: milestoneId } : {}) }),
  upcomingMilestones: () => call<{ milestones: Milestone[] }>('GET', '/api/admin/milestones/upcoming'),
  lessonDeadline: (id: string) => call<LessonDeadline>('GET', `/api/admin/lessons/deadline?id=${id}`),
  extendLesson: (id: string, deadline: string, scope: 'all' | 'students', studentIds: string[] = []) =>
    call<{ ok: true; scope: string; deadline_at: string; count: number | null }>('POST', '/api/admin/lessons/deadline', { id, deadline, scope, student_ids: studentIds }),
  clearExtension: (id: string, studentIds: string[]) => call<{ ok: true; count: number }>('POST', '/api/admin/lessons/deadline/clear', { id, student_ids: studentIds }),
  updateLesson: (id: string, patch: { title?: string | null; milestone_id?: string }) =>
    call<{ ok: true; moved: number }>('POST', '/api/admin/lessons/update', { id, ...patch }),
};

export interface LessonDetail { lesson: Lesson; words: Word[]; studentIds: string[] }

export interface PublishResult { assigned: number; skipped: number; dueIdx: number; students: number }

export interface GridTask { index: number; cols: number; rows: number; count: number; wordIds: string[]; missing: number; prompt: string }
