/** Đọc mốc đầu tiên của từng học sinh (xem shared/first-due.ts). Chủ sở hữu: Sếp. */
import { countsAsStarted, type FirstIdxMap } from '../../shared/first-due';
import { db, must } from './supabase';

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = must(await q(from, from + 999)) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export async function loadFirstIdx(studentIds?: string[]): Promise<FirstIdxMap> {
  if (studentIds && !studentIds.length) return new Map();
  const [asg, sw] = await Promise.all([
    all<{ student_id: string; required_count: number | null; status: string; m: { idx: number | null } | null }>((f, t) => {
      let q = db().from('assignments').select('student_id,required_count,status,m:milestones(idx)');
      if (studentIds) q = q.in('student_id', studentIds);
      return q.range(f, t) as never;
    }),
    all<{ student_id: string; due_idx: number }>((f, t) => {
      let q = db().from('student_words').select('student_id,due_idx').is('last_answered_at', null);
      if (studentIds) q = q.in('student_id', studentIds);
      return q.range(f, t);
    }),
  ]);
  const out: FirstIdxMap = new Map();
  const put = (s: string, i: number | null | undefined) => {
    if (typeof i !== 'number') return;
    const cur = out.get(s);
    if (cur === undefined || i < cur) out.set(s, i);
  };
  for (const a of asg) if (countsAsStarted(a)) put(a.student_id, a.m?.idx); // bỏ bài rỗng chưa nộp
  for (const w of sw) put(w.student_id, w.due_idx);
  return out;
}
