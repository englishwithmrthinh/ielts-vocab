/**
 * Kiểu dữ liệu dùng chung — HỢP ĐỒNG giữa các AI.
 * Chủ sở hữu: Sếp (Claude 1). Người khác chỉ import, không sửa.
 * Cần đổi/thêm: ghi "Câu hỏi cho sếp" trong báo cáo.
 */

// ---------------- Giá trị cơ bản ----------------
export type UUID = string;
/** ISO 8601, UTC, ví dụ "2026-11-10T16:59:59.999Z" */
export type ISODateTime = string;
/** Ngày lịch theo giờ Việt Nam, "YYYY-MM-DD" */
export type ISODate = string;
/** "YYYY-MM" */
export type MonthKey = string;

export type PartOfSpeech = 'n' | 'v' | 'adj' | 'adv' | 'prep' | 'conj' | 'phr';
export type QType = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M';
/** 1–5 là hộp, 6 là Pass */
export type Box = 1 | 2 | 3 | 4 | 5 | 6;
export const PASS_BOX = 6 as const;

export type MilestoneKind = 'tue' | 'fri' | 'sun';
export type AssignmentStatus = 'locked' | 'open' | 'submitted' | 'owing' | 'abandoned' | 'off';
export type AnswerMode = 'graded' | 'fix' | 'practice' | 'retry';
export type TypingHint = 'extra_space' | 'missing_space' | 'one_letter' | 'swapped';
export type LessonStatus = 'draft' | 'processing' | 'review' | 'published';
export type SuggestionStatus = 'pending' | 'linked' | 'added' | 'rejected';

// ---------------- Bảng (khớp supabase/schema.sql) ----------------
export interface Student {
  id: UUID;
  code: string;
  name: string;
  active: boolean;
  created_at: ISODateTime;
}

export interface WordFamilyItem {
  form: string;
  pos: PartOfSpeech;
  /** Có đúng một "___" */
  sentence: string;
}

export interface Word {
  id: UUID;
  word: string;
  pos: PartOfSpeech;
  meaning_vi: string;
  ipa: string | null;
  ipa_source: 'dict' | 'ai' | null;
  syllables: string | null;
  example: string | null;
  word_family: WordFamilyItem[];
  image_url: string | null;
  audio_url: string | null;
  image_hint: string | null;
  origin: 'teacher' | 'student';
  created_at: ISODateTime;
}

export interface PipelineLogEntry {
  at: ISODateTime;
  step: 'validate' | 'ipa' | 'audio' | 'image' | 'done' | 'error';
  word_id?: UUID;
  message: string;
}

export interface Lesson {
  id: UUID;
  number: number;
  taught_on: ISODate;
  status: LessonStatus;
  infographic_urls: string[];
  pipeline_log: PipelineLogEntry[];
  published_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface Milestone {
  id: UUID;
  /** null khi is_off */
  idx: number | null;
  date: ISODate;
  kind: MilestoneKind;
  opens_at: ISODateTime;
  deadline_at: ISODateTime;
  month: MonthKey;
  is_off: boolean;
}

export interface Assignment {
  id: UUID;
  student_id: UUID;
  milestone_id: UUID;
  status: AssignmentStatus;
  started_at: ISODateTime | null;
  submitted_at: ISODateTime | null;
  days_late: number | null;
  score_pct: number | null;
  required_count: number | null;
  answered_count: number;
  word_ids: UUID[];
}

export interface StudentWord {
  student_id: UUID;
  word_id: UUID;
  box: Box;
  due_idx: number;
  introduced: boolean;
  typed_ok: boolean;
  wrong_count: number;
  last_answered_at: ISODateTime | null;
  assigned_at: ISODateTime;
}

export interface AnswerRow {
  id: UUID;
  student_id: UUID;
  assignment_id: UUID | null;
  word_id: UUID;
  qtype: QType;
  mode: AnswerMode;
  given: string | null;
  correct: boolean;
  hint_code: TypingHint | null;
  box_before: Box | null;
  box_after: Box | null;
  flagged: boolean;
  created_at: ISODateTime;
}

export interface Suggestion {
  id: UUID;
  student_id: UUID;
  text: string;
  note: string | null;
  status: SuggestionStatus;
  word_id: UUID | null;
  created_at: ISODateTime;
}

export interface MonthlyStats {
  month: MonthKey;
  total: number;          // số bài trong tháng (trừ Nghỉ)
  submitted: number;      // đã nộp (đúng hạn + trễ)
  on_time: number;
  late: number;
  abandoned: number;
  owing: number;          // còn nợ lúc tạo báo cáo (chỉ ở bản Tạm tính)
  total_days_late: number;
  avg_days_late: number;  // trên các bài trễ
  attendance_pct: number; // trung bình score_pct
  words_assigned: number;
  words_passed: number;
  words_learning: number;
  accuracy_pct: number;   // câu graded đúng / tổng câu graded trong tháng
  /** passed_total là số CỘNG DỒN đến hết tuần đó */
  passed_by_week: { week_start: ISODate; passed_total: number }[];
  cells: { milestone_date: ISODate; kind: MilestoneKind; status: AssignmentStatus; score_pct: number | null; days_late: number | null }[];
}

export interface MonthlyReport {
  id: UUID;
  student_id: UUID;
  month: MonthKey;
  token: string;
  stats: MonthlyStats;
  ai_comment: string | null;
  teacher_comment: string | null;
  status: 'draft' | 'final';
  finalized_at: ISODateTime | null;
}

export type BadgeCode =
  | 'first_submit' | 'perfect_week' | 'perfect_month' | 'all_sundays_month'
  | 'pass_10' | 'pass_50' | 'pass_100' | 'pass_300'
  | 'streak_6' | 'streak_12' | 'streak_24';

// ---------------- Thẻ từ & câu hỏi ----------------
export interface WordCard {
  wordId: UUID;
  word: string;
  pos: PartOfSpeech;
  meaningVi: string;
  ipa: string | null;
  syllables: string | null;
  example: string | null;
  wordFamily: WordFamilyItem[];
  imageUrl: string | null;
  audioUrl: string | null;
}

export interface Option { id: string; text: string }

export interface Question {
  qid: string;
  type: QType;
  mode: AnswerMode;
  /** done: câu BẮT BUỘC đã làm (không gồm câu ôn lại từ sai, không vượt required).
   *  fixLeft: số từ làm sai còn phải làm đúng lại trước khi được Nộp */
  progress: { done: number; required: number; extra: number; fixLeft?: number };
  prompt: {
    word?: string;
    meaningVi?: string;
    pos?: PartOfSpeech;
    imageUrl?: string;
    audioUrl?: string;
    /** Có "___" ở chỗ trống (J, K, M) */
    sentence?: string;
    firstLetter?: string; // K
    baseWord?: string;    // M (pos = loại từ của DẠNG CẦN ĐIỀN)
    masked?: string;      // G, ví dụ "en_ir_nm_nt"
    letters?: string[];   // F, đã xáo
  };
  options?: Option[];                          // A, B, C, E, J
  /** D: left[].id = wordId (khớp perWord) */
  pairs?: { left: Option[]; right: Option[] }; // D
  /** L: blanks[].id = wordId (khớp perWord) */
  blanks?: { id: string; sentence: string }[]; // L
  bank?: Option[];                             // L
  /** Chấm nhanh trên trình duyệt (shared/check.ts → quickGrade). Server vẫn chấm chính thức. */
  check?: QuickCheck;
}

/** Mã băm đáp án: option → h là chuỗi · text → h là chuỗi · match → h[wordId] */
export type QuickCheck =
  | { kind: 'option'; salt: string; h: string }
  | { kind: 'text'; salt: string; h: string }
  | { kind: 'match'; salt: string; h: Record<UUID, string> };

/** Học sinh gửi lên. Dạng nào dùng trường nào:
 *  A B C E J → optionId · F G H I K M → text · D L → matches */
export interface AnswerSubmission {
  qid: string;
  optionId?: string;
  text?: string;
  /** D: leftId → rightId · L: blankId → bankId */
  matches?: Record<string, string>;
}

export interface AnswerResult {
  correct: boolean;
  perWord?: { wordId: UUID; correct: boolean }[];
  expected: string;
  /** Dạng chọn (A B C E J): id của đáp án đúng, để tô xanh đúng nút */
  correctOptionId?: string;
  hint?: TypingHint;
  diff?: { char: string; ok: boolean }[];
  wordCard: WordCard;
  /** D, L: một thẻ cho mỗi từ */
  wordCards?: WordCard[];
  xp: number;
  /** Có từ vừa Pass → hiệu ứng */
  passed?: boolean;
}

// ---------------- Dữ liệu từng endpoint học sinh ----------------
export interface AssignmentCard {
  assignmentId: UUID | null; // null nếu chưa tạo (chưa start)
  milestoneId: UUID;
  date: ISODate;
  kind: MilestoneKind;
  status: AssignmentStatus;
  deadlineAt: ISODateTime;
  /** Điểm nếu nộp ngay bây giờ (100 khi chưa trễ) */
  currentPct: number;
  /** Điểm nếu để sang ngày mai */
  tomorrowPct: number;
  daysLateNow: number;
  /** true khi còn bài cũ hơn chưa nộp */
  blocked: boolean;
  progress: { done: number; required: number | null };
}

export interface HomeResponse {
  student: { name: string; code: string };
  /** Theo thứ tự ưu tiên: bài nợ cũ nhất trước */
  assignments: AssignmentCard[];
  newWordsToPreview: number;
  nextDeadlineAt: ISODateTime | null;
  streak: number;
  xpTotal: number;
  xpThisWeek: number;
  canPractice: boolean;
}

export interface PreviewResponse { cards: WordCard[] }

export interface StartAssignmentResponse {
  assignmentId: UUID;
  required: number;
  done: number;
  canContinueExtra: boolean;
}

export interface NextQuestionResponse {
  question: Question | null; // null: hết câu
  phase: 'graded' | 'extra' | 'fix' | 'done';
}

export interface SubmitResponse {
  daysLate: number;
  scorePct: number;
  xpGained: number;
  newBadges: BadgeCode[];
  perfectWeek: boolean;
  summary: { correct: number; total: number; passedWords: number };
}

export interface ProgressResponse {
  wordsByBox: Record<'1' | '2' | '3' | '4' | '5' | 'pass', number>;
  wordsTotal: number;
  streak: number;
  xpTotal: number;
  calendar: { date: ISODate; kind: MilestoneKind; status: AssignmentStatus; score_pct: number | null }[];
  badges: { code: BadgeCode; earned_at: ISODateTime | null }[];
  weeklyTop5: { name: string; xp: number; isMe: boolean }[];
}

export interface MyWordsResponse {
  words: (WordCard & { box: Box; lessonNumber: number | null })[];
  pending: { id: UUID; text: string; note: string | null; created_at: ISODateTime }[];
}

/** GET /api/report/:token — trang phụ huynh. 404 nếu token sai. Bản draft: ai_comment = null (chỉ hiện nhận xét khi đã chốt). */
export interface ParentReportResponse {
  student: { name: string };
  month: MonthKey;
  status: 'draft' | 'final';
  finalized_at: ISODateTime | null;
  stats: MonthlyStats;
  ai_comment: string | null;
  teacher_comment: string | null;
}

/** POST /api/my-words { text, note? } — linked: từ đã có trong kho tổng, gán luôn; pending: chờ giáo viên duyệt */
export interface AddWordResponse { status: 'linked' | 'pending' }

export interface ApiError { error: string; code: string }
