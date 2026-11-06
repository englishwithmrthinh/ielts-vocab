/** Truy vấn dùng chung cho các API làm bài của học sinh. */
import type { Assignment, AssignmentStatus, Box, Milestone, WordCard, WordFamilyItem, PartOfSpeech } from '../../shared/types';
import type { QuizWord } from '../../shared/questions';
import type { StudentWordLite } from '../../shared/assignment';
import { unsubmittedStatus } from '../../shared/lateness';
import { HttpError } from './http';
import { db, must } from './supabase';

export interface WordRow {
  id: string; word: string; pos: PartOfSpeech; meaning_vi: string; ipa: string | null; syllables: string | null;
  example: string | null; word_family: WordFamilyItem[]; image_url: string | null; audio_url: string | null;
}
export interface StudentWordFull extends StudentWordLite { wrong_count: number; last_answered_at: string | null; w: WordRow }

const WORD_COLS = 'id,word,pos,meaning_vi,ipa,syllables,example,word_family,image_url,audio_url';

export function toCard(w: WordRow): WordCard {
  return {
    wordId: w.id, word: w.word, pos: w.pos, meaningVi: w.meaning_vi, ipa: w.ipa, syllables: w.syllables,
    example: w.example, wordFamily: w.word_family ?? [], imageUrl: w.image_url, audioUrl: w.audio_url,
  };
}

export function toQuiz(sw: StudentWordFull): QuizWord {
  const w = sw.w;
  return {
    id: w.id, word: w.word, pos: w.pos, meaning_vi: w.meaning_vi, example: w.example, word_family: w.word_family ?? [],
    image_url: w.image_url, audio_url: w.audio_url, box: sw.box, typed_ok: sw.typed_ok,
  };
}

export async function loadStudentWords(studentId: string): Promise<StudentWordFull[]> {
  const rows = must(
    await db().from('student_words')
      .select(`word_id,box,due_idx,introduced,typed_ok,wrong_count,last_answered_at,w:words(${WORD_COLS})`)
      .eq('student_id', studentId),
  ) as unknown as (StudentWordLite & { wrong_count: number; last_answered_at: string | null; w: WordRow })[];
  return rows.filter((r) => r.w).map((r) => ({ ...r, box: r.box as Box }));
}

/** Kho để lấy đáp án nhiễu: từ của học sinh, thiếu thì bù từ kho tổng */
export async function distractorPool(own: QuizWord[]): Promise<QuizWord[]> {
  if (own.length >= 12) return own;
  const extra = must(await db().from('words').select(WORD_COLS).limit(60)) as WordRow[];
  const have = new Set(own.map((w) => w.id));
  return [
    ...own,
    ...extra.filter((w) => !have.has(w.id)).map((w) => ({
      id: w.id, word: w.word, pos: w.pos, meaning_vi: w.meaning_vi, example: w.example, word_family: w.word_family ?? [],
      image_url: w.image_url, audio_url: w.audio_url, box: 1 as Box, typed_ok: false,
    })),
  ];
}

export async function getWords(ids: string[]): Promise<Map<string, WordRow>> {
  if (!ids.length) return new Map();
  const rows = must(await db().from('words').select(WORD_COLS).in('id', ids)) as WordRow[];
  return new Map(rows.map((r) => [r.id, r]));
}

export interface StudentPlan {
  createdAt: string;
  milestones: Milestone[];                     // mốc không nghỉ áp dụng cho học sinh, theo ngày tăng dần
  assignments: Map<string, Assignment>;        // milestone_id → bài
  status: Map<string, AssignmentStatus>;       // milestone_id → trạng thái hiện tại
}

export async function loadPlan(studentId: string, now: string): Promise<StudentPlan> {
  const st = must(await db().from('students').select('created_at').eq('id', studentId).single()) as { created_at: string };
  const ms = (must(await db().from('milestones').select('*').eq('is_off', false).order('date')) as Milestone[])
    .filter((m) => Date.parse(m.deadline_at) >= Date.parse(st.created_at));
  const as = must(await db().from('assignments').select('*').eq('student_id', studentId)) as Assignment[];
  const assignments = new Map(as.map((a) => [a.milestone_id, a]));
  const status = new Map<string, AssignmentStatus>();
  for (const m of ms) {
    const a = assignments.get(m.id);
    status.set(m.id, a?.status === 'submitted' ? 'submitted' : unsubmittedStatus(m, now));
  }
  return { createdAt: st.created_at, milestones: ms, assignments, status };
}

/** Bài đang nợ (cũ nhất trước) và bài đang mở */
export function cardsOf(plan: StudentPlan): { owing: Milestone[]; open: Milestone | null; next: Milestone | null } {
  const owing = plan.milestones.filter((m) => plan.status.get(m.id) === 'owing');
  const open = plan.milestones.find((m) => plan.status.get(m.id) === 'open') ?? null;
  const next = plan.milestones.find((m) => plan.status.get(m.id) === 'locked') ?? null;
  return { owing, open, next };
}

/** Số mốc liên tiếp nộp đúng hạn tính đến hiện tại (mốc đang mở chưa nộp không làm đứt chuỗi) */
export function streakOf(plan: StudentPlan): number {
  let n = 0;
  for (const m of [...plan.milestones].reverse()) {
    const s = plan.status.get(m.id);
    if (s === 'locked' || s === 'open') continue;
    const a = plan.assignments.get(m.id);
    if (s === 'submitted' && a?.days_late === 0) n++;
    else break;
  }
  return n;
}

export async function getAssignment(studentId: string, id: string): Promise<{ a: Assignment; m: Milestone }> {
  const a = must(await db().from('assignments').select('*').eq('id', id).eq('student_id', studentId).maybeSingle()) as Assignment | null;
  if (!a) throw new HttpError(404, 'not_found', 'Không tìm thấy bài');
  const m = must(await db().from('milestones').select('*').eq('id', a.milestone_id).single()) as Milestone;
  return { a, m };
}

export interface AnswerLite { id: string; word_id: string; mode: string; correct: boolean; flagged: boolean; qtype: string; box_before: number | null; box_after: number | null; created_at: string }

export async function answersOf(assignmentId: string): Promise<AnswerLite[]> {
  return must(
    await db().from('answers').select('id,word_id,mode,correct,flagged,qtype,box_before,box_after,created_at')
      .eq('assignment_id', assignmentId).order('created_at'),
  ) as AnswerLite[];
}

export async function addXp(studentId: string, amount: number, reason: string): Promise<void> {
  if (amount > 0) must(await db().from('xp_events').insert({ student_id: studentId, amount, reason }));
}
