/**
 * Máy chủ giả cho chế độ demo (?demo=1). Dữ liệu chỉ sống trong bộ nhớ tab,
 * tải lại trang là về ban đầu. Không dùng ở bản thật.
 */
import type { Milestone, Student } from '@shared/types';
import { assignIdx, milestonesOfMonth } from '@shared/milestones';
import { vnDate } from '@shared/time';
import { ApiCallError } from '../../lib/api';
import type { LessonSummary, StudentCard } from './adminApi';

const NAMES = [
  'Nguyễn Minh Anh', 'Trần Gia Bảo', 'Lê Khánh Chi', 'Phạm Đức Duy', 'Hoàng Thu Hà',
  'Vũ Quang Huy', 'Đặng Ngọc Lan', 'Bùi Tuấn Minh', 'Đỗ Phương Nhi', 'Ngô Bảo Ngọc',
  'Dương Hải Phong', 'Lý Thanh Tâm',
];

const state = {
  loggedIn: false,
  students: NAMES.map<Student>((name, i) => ({
    id: `s${i + 1}`,
    code: 'HS' + String(i + 1).padStart(2, '0'),
    name,
    active: i !== 10,
    created_at: '2026-11-01T02:00:00Z',
  })),
  milestones: [] as Milestone[],
  lessons: [
    { id: 'l2', number: 2, taught_on: '2026-11-04', status: 'review', published_at: null, created_at: '2026-11-04T12:00:00Z', word_count: 18, student_count: 11 },
    { id: 'l1', number: 1, taught_on: '2026-11-02', status: 'published', published_at: '2026-11-02T14:00:00Z', created_at: '2026-11-02T12:00:00Z', word_count: 20, student_count: 12 },
  ] as LessonSummary[],
  knownWords: new Set(['environment|n', 'pollution|n', 'sustainable|adj']),
};

function ensureMonth(month: string) {
  if (state.milestones.some((m) => m.month === month)) return;
  const drafts = milestonesOfMonth(month).map((d, i) => ({ ...d, id: `${month}-${i}`, is_off: false }));
  state.milestones = assignIdx([...state.milestones, ...drafts].sort((a, b) => a.date.localeCompare(b.date))) as Milestone[];
}

function pin() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  await wait(150);
  const b = (body ?? {}) as Record<string, unknown>;
  const url = new URL(path, 'http://demo');
  const route = `${method} ${url.pathname}`;
  const ok = <R>(v: R) => v as unknown as T;

  if (route === 'POST /api/admin/login') {
    if (!b.password) throw new ApiCallError(401, 'wrong_password', 'Mật khẩu chưa đúng');
    state.loggedIn = true;
    return ok({ ok: true });
  }
  if (route === 'POST /api/admin/logout') {
    state.loggedIn = false;
    return ok({ ok: true });
  }
  if (!state.loggedIn) throw new ApiCallError(401, 'not_admin', 'Cần đăng nhập trang quản trị');
  if (route === 'GET /api/admin/me') return ok({ ok: true });

  if (route === 'GET /api/admin/students') return ok({ students: [...state.students] });
  if (route === 'POST /api/admin/students') {
    const names = (b.names as string[]).map((n) => n.trim()).filter(Boolean);
    const max = Math.max(0, ...state.students.map((s) => Number(s.code.slice(2))));
    const created: StudentCard[] = names.map((name, i) => {
      const s: Student = { id: `s${Date.now()}${i}`, code: 'HS' + String(max + i + 1).padStart(2, '0'), name, active: true, created_at: new Date().toISOString() };
      state.students.push(s);
      return { id: s.id, code: s.code, name, pin: pin() };
    });
    return ok({ created });
  }
  if (route === 'POST /api/admin/students/update') {
    const s = state.students.find((x) => x.id === b.id);
    if (!s) throw new ApiCallError(404, 'not_found', 'Không tìm thấy học sinh');
    if (typeof b.name === 'string') s.name = b.name.trim();
    if (typeof b.active === 'boolean') s.active = b.active;
    return ok({ student: { ...s } });
  }
  if (route === 'POST /api/admin/students/reset-pins') {
    const ids = b.ids as string[];
    const cards = state.students.filter((s) => ids.includes(s.id)).map((s) => ({ id: s.id, code: s.code, name: s.name, pin: pin() }));
    return ok({ cards });
  }

  if (route === 'GET /api/admin/milestones') {
    const month = url.searchParams.get('month')!;
    ensureMonth(month);
    return ok({ milestones: state.milestones.filter((m) => m.month === month) });
  }
  if (route === 'POST /api/admin/milestones/off') {
    const m = state.milestones.find((x) => x.id === b.id);
    if (!m) throw new ApiCallError(404, 'not_found', 'Không thấy mốc');
    if (m.date < vnDate(new Date())) throw new ApiCallError(400, 'past_milestone', 'Không đổi được mốc đã qua');
    m.is_off = Boolean(b.off);
    state.milestones = assignIdx(state.milestones) as Milestone[];
    return ok({ ok: true });
  }

  if (route === 'GET /api/admin/lessons') {
    return ok({ lessons: [...state.lessons], nextNumber: Math.max(0, ...state.lessons.map((l) => l.number)) + 1 });
  }
  if (route === 'POST /api/admin/lessons/check') {
    const words = b.words as { word: string; pos: string }[];
    const existing = words
      .filter((w) => state.knownWords.has(`${w.word.toLowerCase()}|${w.pos}`))
      .map((w, i) => ({ word: w.word.toLowerCase(), pos: w.pos, id: `w${i}`, has_audio: true, has_image: true }));
    return ok({ existing });
  }
  if (route === 'POST /api/admin/lessons') {
    const parsed = JSON.parse(String(b.json).replace(/^```[a-z]*|```$/g, '')) as { words: { word: string; pos: string }[] };
    const reused = parsed.words.filter((w) => state.knownWords.has(`${w.word.toLowerCase()}|${w.pos}`)).length;
    parsed.words.forEach((w) => state.knownWords.add(`${w.word.toLowerCase()}|${w.pos}`));
    const lesson: LessonSummary = {
      id: `l${Date.now()}`, number: Number(b.number), taught_on: String(b.taught_on), status: 'draft',
      published_at: null, created_at: new Date().toISOString(), word_count: parsed.words.length,
      student_count: (b.student_ids as string[]).length,
    };
    state.lessons.unshift(lesson);
    return ok({ lesson, reused, created: parsed.words.length - reused });
  }
  throw new ApiCallError(404, 'not_found', `Demo chưa có ${route}`);
}
