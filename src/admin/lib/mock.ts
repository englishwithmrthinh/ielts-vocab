/**
 * Máy chủ giả cho chế độ demo (?demo=1). Dữ liệu chỉ sống trong bộ nhớ tab,
 * tải lại trang là về ban đầu. Không dùng ở bản thật.
 */
import type { AdminFlagsResponse, AdminReportsResponse, AdminSuggestionsResponse, Class, Lesson, Milestone, MonthlyStats, Student, Word } from '@shared/types';
import { assignIdx, milestonesOfMonth } from '@shared/milestones';
import { vnDate } from '@shared/time';
import { ApiCallError } from '../../lib/api';
import type { LessonDetail, LessonSummary, StudentCard } from './adminApi';

const NAMES = [
  'Nguyễn Minh Anh', 'Trần Gia Bảo', 'Lê Khánh Chi', 'Phạm Đức Duy', 'Hoàng Thu Hà',
  'Vũ Quang Huy', 'Đặng Ngọc Lan', 'Bùi Tuấn Minh', 'Đỗ Phương Nhi', 'Ngô Bảo Ngọc',
  'Dương Hải Phong', 'Lý Thanh Tâm',
];

const CLASSES: Class[] = [
  { id: 'c1', name: 'IELTS Foundation T3-T6', active: true, created_at: '2026-11-01T02:00:00Z' },
  { id: 'c2', name: 'IELTS 5.0 Cuối tuần', active: true, created_at: '2026-11-01T02:00:00Z' },
];

const state = {
  loggedIn: false,
  classes: [...CLASSES],
  students: NAMES.map<Student>((name, i) => ({
    id: `s${i + 1}`,
    code: 'HS' + String(i + 1).padStart(2, '0'),
    name,
    active: i !== 10,
    class_id: i < 6 ? 'c1' : i < 10 ? 'c2' : null,
    created_at: '2026-11-01T02:00:00Z',
  })),
  milestones: [] as Milestone[],
  lessons: [
    { id: 'l2', number: 2, taught_on: '2026-11-04', status: 'review', published_at: null, created_at: '2026-11-04T12:00:00Z', word_count: 18, student_count: 6, class_names: ['IELTS Foundation T3-T6'], unassigned_count: 0 },
    { id: 'l1', number: 1, taught_on: '2026-11-02', status: 'published', published_at: '2026-11-02T14:00:00Z', created_at: '2026-11-02T12:00:00Z', word_count: 20, student_count: 11, class_names: ['IELTS 5.0 Cuối tuần', 'IELTS Foundation T3-T6'], unassigned_count: 1 },
  ] as LessonSummary[],
  knownWords: new Set(['environment|n', 'pollution|n', 'sustainable|adj']),
};

const DEMO_WORDS: [string, Word['pos'], string, string][] = [
  ['environment', 'n', 'môi trường', '/ɪnˈvaɪrənmənt/'], ['pollution', 'n', 'sự ô nhiễm', '/pəˈluːʃn/'],
  ['renewable', 'adj', 'có thể tái tạo', '/rɪˈnjuːəbl/'], ['emission', 'n', 'khí thải', '/iˈmɪʃn/'],
  ['sustainable', 'adj', 'bền vững', '/səˈsteɪnəbl/'], ['recycle', 'v', 'tái chế', '/ˌriːˈsaɪkl/'],
  ['deforestation', 'n', 'nạn phá rừng', '/ˌdiːˌfɒrɪˈsteɪʃn/'], ['habitat', 'n', 'môi trường sống', '/ˈhæbɪtæt/'],
  ['endangered', 'adj', 'có nguy cơ tuyệt chủng', '/ɪnˈdeɪndʒəd/'], ['conserve', 'v', 'bảo tồn', '/kənˈsɜːv/'],
  ['drought', 'n', 'hạn hán', '/draʊt/'], ['flood', 'n', 'lũ lụt', '/flʌd/'],
  ['climate', 'n', 'khí hậu', '/ˈklaɪmət/'], ['carbon footprint', 'phr', 'lượng khí thải carbon', '/ˌkɑːbən ˈfʊtprɪnt/'],
  ['waste', 'n', 'rác thải', '/weɪst/'], ['solar', 'adj', 'thuộc mặt trời', '/ˈsəʊlə(r)/'],
  ['wildlife', 'n', 'động vật hoang dã', '/ˈwaɪldlaɪf/'], ['ecosystem', 'n', 'hệ sinh thái', '/ˈiːkəʊsɪstəm/'],
];

function demoImage(i: number): string {
  const hue = (i * 47) % 360;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='hsl(${hue},45%,70%)'/><circle cx='${30 + (i % 4) * 12}' cy='40' r='18' fill='hsl(${(hue + 60) % 360},55%,55%)'/><path d='M0 78 Q30 ${60 + (i % 3) * 6} 55 76 T100 70 V100 H0Z' fill='hsl(${(hue + 120) % 360},40%,45%)'/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

const demoDetail: LessonDetail = {
  lesson: {
    id: 'l2', number: 2, taught_on: '2026-11-04', status: 'review', infographic_urls: [], published_at: null, created_at: '2026-11-04T12:00:00Z',
    pipeline_log: [
      { at: '2026-11-04T12:00:01Z', step: 'validate', message: 'Bắt đầu: 18 từ' },
      { at: '2026-11-04T12:00:04Z', step: 'ipa', message: 'Phiên âm: 16/18 từ tra được từ điển, còn lại giữ bản AI' },
      { at: '2026-11-04T12:00:19Z', step: 'audio', message: 'Audio: tạo 18/18 từ (1 từ phải tạo lại riêng)' },
      { at: '2026-11-04T12:01:02Z', step: 'image', message: 'Ảnh: 17 ảnh mới · lưới đạt lần đầu 1/1, vẽ lại 0, chuyển ảnh lẻ 0' },
      { at: '2026-11-04T12:01:03Z', step: 'error', message: 'image "carbon footprint": ô có nét giống chữ', word_id: 'w13' },
      { at: '2026-11-04T12:01:03Z', step: 'done', message: 'Xong, 1 lỗi — xem và tạo lại ở màn Duyệt' },
    ],
  } as Lesson,
  words: DEMO_WORDS.map(([word, pos, meaning_vi, ipa], i) => ({
    id: `w${i}`, word, pos, meaning_vi, ipa, ipa_source: i === 13 || i === 6 ? 'ai' : 'dict',
    syllables: null, example: `People should care more about the ${word}.`, word_family: [],
    image_url: i === 13 ? null : demoImage(i), audio_url: i === 3 ? null : 'data:audio/mpeg;base64,', image_hint: `a picture of ${word}`,
    origin: 'teacher', created_at: '2026-11-04T12:00:00Z',
  })) as Word[],
  studentIds: ['s1', 's2', 's3', 's4', 's5', 's6'],
};

function demoStats(i: number, month: string): MonthlyStats {
  const total = 13;
  const late = i % 4 === 1 ? 2 : i % 5 === 3 ? 1 : 0;
  const abandoned = i % 7 === 6 ? 1 : 0;
  const owing = i % 6 === 5 ? 1 : 0;
  const on_time = total - late - abandoned - owing - (i % 3 === 2 ? 1 : 0);
  const submitted = on_time + late;
  return {
    month, total, submitted, on_time, late, abandoned, owing,
    total_days_late: late * 2, avg_days_late: late ? 2 : 0,
    attendance_pct: Math.round(((on_time * 100 + late * 80) / total) * 10) / 10,
    words_assigned: 60, words_passed: 18 + ((i * 7) % 25), words_learning: 30 - ((i * 3) % 10), accuracy_pct: 68 + ((i * 5) % 28),
    passed_by_week: [], cells: [],
  };
}

const demoReports = new Map<string, AdminReportsResponse['reports']>();
function reportsFor(month: string): AdminReportsResponse['reports'] {
  if (month > '2026-11') return [];
  if (!demoReports.has(month)) {
    demoReports.set(month, state.students.filter((x) => x.active).map((st, i) => ({
      id: `r-${month}-${st.id}`, studentId: st.id, code: st.code, name: st.name, classId: st.class_id ?? null,
      status: month < '2026-10' ? 'final' : 'draft', finalizedAt: null,
      link: `${window.location.origin}/bao-cao/demo-${st.code.toLowerCase()}`,
      aiComment: `${st.name.split(' ').pop()} làm bài khá đều trong tháng, nộp đúng hạn ${demoStats(i, month).on_time}/13 bài. Con nhớ tốt các từ về môi trường; cần ôn thêm các từ dài như "deforestation". Tháng tới cố gắng không để bài trễ nhé.`,
      teacherComment: null, stats: demoStats(i, month),
    })));
  }
  return demoReports.get(month)!;
}

const demoSuggestions: AdminSuggestionsResponse['suggestions'] = [
  { id: 'sg1', text: 'biodiversity', note: 'gặp trong bài đọc', status: 'pending', createdAt: '2026-11-05T13:00:00Z', code: 'HS03', name: 'Lê Khánh Chi' },
  { id: 'sg2', text: 'biodiversity', note: null, status: 'pending', createdAt: '2026-11-05T15:20:00Z', code: 'HS07', name: 'Đặng Ngọc Lan' },
  { id: 'sg3', text: 'take part in', note: 'cụm hay gặp trong Speaking', status: 'pending', createdAt: '2026-11-04T09:10:00Z', code: 'HS01', name: 'Nguyễn Minh Anh' },
  { id: 'sg4', text: 'commute', note: null, status: 'pending', createdAt: '2026-11-03T20:45:00Z', code: 'HS09', name: 'Đỗ Phương Nhi' },
];

const demoFlags: AdminFlagsResponse['flags'] = [
  { id: 'f1', createdAt: '2026-11-05T14:00:00Z', qtype: 'J', given: 'pollution', code: 'HS02', name: 'Trần Gia Bảo', wordId: 'w0', word: 'environment', meaningVi: 'môi trường' },
  { id: 'f2', createdAt: '2026-11-05T19:30:00Z', qtype: 'J', given: 'pollution', code: 'HS05', name: 'Hoàng Thu Hà', wordId: 'w0', word: 'environment', meaningVi: 'môi trường' },
  { id: 'f3', createdAt: '2026-11-04T08:15:00Z', qtype: 'A', given: 'bảo vệ', code: 'HS08', name: 'Bùi Tuấn Minh', wordId: 'w9', word: 'conserve', meaningVi: 'bảo tồn' },
];

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
      const s: Student = { id: `s${Date.now()}${i}`, code: 'HS' + String(max + i + 1).padStart(2, '0'), name, active: true, class_id: (b.classId as string | null) ?? null, created_at: new Date().toISOString() };
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

  if (route === 'GET /api/admin/classes') {
    return ok({ classes: state.classes.map((c) => ({ ...c, studentCount: state.students.filter((s) => s.active && s.class_id === c.id).length })).sort((a, b) => a.name.localeCompare(b.name)) });
  }
  if (route === 'POST /api/admin/classes') {
    const name = String(b.name ?? '').trim();
    if (state.classes.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new ApiCallError(409, 'duplicate', 'Đã có lớp trùng tên');
    const c: Class = { id: `c${Date.now()}`, name, active: true, created_at: new Date().toISOString() };
    state.classes.push(c);
    return ok({ class: c });
  }
  if (route === 'POST /api/admin/classes/update') {
    const c = state.classes.find((x) => x.id === b.id)!;
    if (typeof b.name === 'string') c.name = b.name;
    if (typeof b.active === 'boolean') c.active = b.active;
    return ok({ class: { ...c } });
  }
  if (route === 'POST /api/admin/milestones/deadline') {
    return ok({ ok: true, deadline_at: new Date(Date.parse(`${b.deadline}:59+07:00`)).toISOString() });
  }
  if (route === 'GET /api/admin/milestones/upcoming') {
    return ok({ milestones: [] });
  }
  if (route === 'POST /api/admin/lessons/update') {
    return ok({ ok: true, moved: 0 });
  }
  if (route === 'POST /api/admin/lessons/delete') {
    return ok({ ok: true, removedWords: 0, affectedStudents: 0 });
  }
  if (route === 'POST /api/admin/classes/delete') {
    state.classes = state.classes.filter((c) => c.id !== b.id);
    state.students.forEach((s) => { if (s.class_id === b.id) s.class_id = null; });
    return ok({ ok: true });
  }
  if (route === 'POST /api/admin/students/delete') {
    const ids = b.ids as string[];
    const before = state.students.length;
    state.students = state.students.filter((s) => !ids.includes(s.id));
    return ok({ deleted: before - state.students.length });
  }
  if (route === 'POST /api/admin/classes/move') {
    const ids = b.studentIds as string[];
    state.students.forEach((s) => { if (ids.includes(s.id)) s.class_id = (b.classId as string | null) ?? null; });
    return ok({ moved: ids.length });
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
  if (route === 'GET /api/admin/lessons/detail') {
    const id = url.searchParams.get('id')!;
    const sum = state.lessons.find((l) => l.id === id);
    if (!sum) throw new ApiCallError(404, 'not_found', 'Không thấy buổi');
    if (id !== 'l2') {
      return ok({ ...demoDetail, lesson: { ...demoDetail.lesson, id, number: sum.number, taught_on: sum.taught_on, status: sum.status, pipeline_log: sum.status === 'draft' ? [] : demoDetail.lesson.pipeline_log } });
    }
    return ok({ ...demoDetail, lesson: { ...demoDetail.lesson, status: sum.status } });
  }
  if (route === 'POST /api/admin/pipeline/run') {
    const l = state.lessons.find((x) => x.id === b.lesson_id);
    if (l) {
      l.status = 'processing';
      setTimeout(() => (l.status = 'review'), 2500);
    }
    return ok(null);
  }
  if (route === 'POST /api/admin/pipeline/word') {
    const w = demoDetail.words.find((x) => x.id === b.word_id);
    if (w) setTimeout(() => (b.what === 'image' ? (w.image_url = demoImage(Number(w.id.slice(1)) + 7)) : (w.audio_url = 'data:audio/mpeg;base64,')), 1500);
    return ok(null);
  }
  if (route === 'POST /api/admin/words/update') {
    const w = demoDetail.words.find((x) => x.id === b.id)!;
    Object.assign(w, b.patch as Partial<Word>);
    return ok({ word: { ...w } });
  }
  if (route === 'POST /api/admin/words/drop-image') {
    const w = demoDetail.words.find((x) => x.id === b.id)!;
    w.image_url = null;
    return ok({ word: { ...w } });
  }
  if (route === 'GET /api/admin/images/prompts') {
    const n = demoDetail.words.length;
    return ok({ grids: [{ index: 0, cols: 4, rows: Math.ceil(n / 4), count: n, wordIds: demoDetail.words.map((w) => w.id), missing: demoDetail.words.filter((w) => !w.image_url).length,
      prompt: `Create ONE image: a perfectly even grid of exactly 4 columns and ${Math.ceil(n / 4)} rows (${n} square illustrations in total).\n\nGRID RULES\n- Pure white gutters of equal width separate every cell…\n\nCELL CONTENTS (left to right, top to bottom)\n` +
        demoDetail.words.map((w, i) => `${i + 1}. ${w.image_hint}`).join('\n') }] });
  }
  if (route === 'GET /api/admin/images/single-prompt') {
    const w = demoDetail.words.find((x) => x.id === url.searchParams.get('word_id'))!;
    return ok({ prompt: `Create ONE square illustration in modern flat vector style…\nThe picture illustrates the English word "${w.word}", but the word itself must NOT appear.\nScene: ${w.image_hint}` });
  }
  if (route === 'POST /api/admin/images/grid') {
    if (String(b.image).length < 5000) throw new ApiCallError(422, 'grid_not_found', 'Ảnh có 4×4 ô, cần 4×5 = 20 ô. Vẽ lại hoặc tải ảnh khác.');
    const miss = demoDetail.words.filter((w) => !w.image_url);
    miss.forEach((w, i) => (w.image_url = demoImage(i + 3)));
    return ok({ updated: miss.length, kept: demoDetail.words.length - miss.length, layout: '5×4', ms: 900 });
  }
  if (route === 'POST /api/admin/images/single') {
    const w = demoDetail.words.find((x) => x.id === b.word_id)!;
    w.image_url = String(b.image);
    return ok({ word: { ...w } });
  }
  if (route === 'GET /api/admin/overview') {
    const act = state.students.filter((x) => x.active);
    return ok({
      now: new Date().toISOString(),
      milestone: { id: 'm', date: '2026-11-06', kind: 'fri', deadlineAt: '2026-11-06T16:59:59Z', open: true },
      today: { submitted: 6, doing: 2, notStarted: act.length - 8, total: act.length },
      owing: [
        { studentId: 's9', code: 'HS09', name: 'Đỗ Phương Nhi', classId: 'c2', count: 2, oldestDate: '2026-11-01', daysLate: 5, pctNow: 50, pctTomorrow: 40 },
        { studentId: 's4', code: 'HS04', name: 'Phạm Đức Duy', classId: 'c1', count: 1, oldestDate: '2026-11-03', daysLate: 3, pctNow: 70, pctTomorrow: 60 },
        { studentId: 's12', code: 'HS12', name: 'Lý Thanh Tâm', classId: null, count: 1, oldestDate: '2026-11-03', daysLate: 3, pctNow: 70, pctTomorrow: 60 },
      ],
      lessons: { draft: state.lessons.filter((l) => l.status === 'draft').length, processing: state.lessons.filter((l) => l.status === 'processing').length, review: state.lessons.filter((l) => l.status === 'review').length },
      suggestionsPending: demoSuggestions.filter((x) => x.status === 'pending').length,
      flagsTotal: demoFlags.length,
    });
  }
  if (route === 'GET /api/admin/reports') {
    const month = url.searchParams.get('month')!;
    return ok({ month, reports: reportsFor(month).map((r) => ({ ...r, classId: state.students.find((x) => x.id === r.studentId)?.class_id ?? null })) });
  }
  if (route === 'POST /api/admin/reports/update') {
    for (const list of demoReports.values()) {
      const r = list.find((x) => x.id === b.id);
      if (r) {
        if (b.teacher_comment !== undefined) r.teacherComment = (b.teacher_comment as string) || null;
        if (b.ai_comment !== undefined) r.aiComment = (b.ai_comment as string) || null;
      }
    }
    return ok({ ok: true });
  }
  if (route === 'POST /api/admin/reports/finalize') {
    for (const list of demoReports.values()) {
      const r = list.find((x) => x.id === b.id);
      if (r) { r.status = 'final'; r.finalizedAt = new Date().toISOString(); }
    }
    return ok({ ok: true });
  }
  if (route === 'POST /api/jobs/monthly') {
    const month = String(b.month);
    reportsFor(month);
    if (b.final) demoReports.get(month)?.forEach((r) => { r.status = 'final'; r.finalizedAt = new Date().toISOString(); });
    return ok(null);
  }
  if (route === 'GET /api/admin/suggestions') return ok({ suggestions: demoSuggestions.filter((x) => x.status === (url.searchParams.get('status') ?? 'pending')) });
  if (route === 'POST /api/admin/suggestions/update') {
    const sg = demoSuggestions.find((x) => x.id === b.id);
    if (sg) sg.status = b.status as never;
    return ok({ ok: true });
  }
  if (route === 'GET /api/admin/flags') return ok({ flags: demoFlags });
  if (route === 'GET /api/admin/words/get') {
    const w = demoDetail.words.find((x) => x.id === url.searchParams.get('id'));
    if (!w) throw new ApiCallError(404, 'not_found', 'Không tìm thấy từ');
    return ok({ word: { ...w } });
  }
  if (route === 'POST /api/admin/lessons/publish') {
    const l = state.lessons.find((x) => x.id === b.lesson_id);
    if (l) {
      l.status = 'published';
      l.published_at = new Date().toISOString();
    }
    const n = (b.student_ids as string[]).length;
    return ok({ assigned: n * 18 - 20, skipped: 20, dueIdx: 4, students: n });
  }
  throw new ApiCallError(404, 'not_found', `Demo chưa có ${route}`);
}
