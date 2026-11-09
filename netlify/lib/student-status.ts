/**
 * Trạng thái từng bài (mốc) của học sinh, theo đúng luật: hạn hiệu lực (gia hạn riêng),
 * "chưa vào lớp", "chưa có từ thì chưa có bài". Dùng cho trang Học sinh (số nợ, chi tiết). Chủ sở hữu: Sếp.
 */
import type { Assignment, AssignmentStatus, Milestone } from '../../shared/types';
import { extKey, withExtension } from '../../shared/deadlines';
import { beforeFirst } from '../../shared/first-due';
import { unsubmittedStatus } from '../../shared/lateness';
import { loadExtensions } from './extensions';
import { loadFirstIdx } from './first-due';
import { allRows, db, must } from './supabase';

export interface MilestoneState {
  /** Mốc với hạn hiệu lực của em này */
  m: Milestone;
  status: AssignmentStatus;
  a: Assignment | null;
  /** Đang được gia hạn riêng */
  extended: boolean;
}

/** Hàm thuần: danh sách bài của một em (mốc không nghỉ, sau ngày vào lớp, từ mốc đầu tiên trở đi). */
export function statesOf(
  student: { id: string; created_at: string },
  milestones: Milestone[],
  asgBy: Map<string, Assignment>,
  ext: Map<string, string>,
  firstIdx: number | undefined,
  now: string,
): MilestoneState[] {
  const out: MilestoneState[] = [];
  for (const m0 of milestones) {
    if (m0.is_off) continue;
    const own = ext.get(extKey(student.id, m0.id));
    const m = withExtension(m0, own);
    if (Date.parse(m.deadline_at) < Date.parse(student.created_at)) continue; // chưa vào lớp
    if (beforeFirst(m, firstIdx)) continue; // chưa có từ thì chưa có bài
    const a = asgBy.get(`${student.id}|${m.id}`) ?? null;
    const status: AssignmentStatus = a?.status === 'submitted' ? 'submitted' : unsubmittedStatus(m, now);
    out.push({ m, status, a, extended: m !== m0 });
  }
  return out;
}

export async function loadStates(now: string, studentIds?: string[]) {
  const [stR, msR, asg, ext, first] = await Promise.all([
    studentIds
      ? db().from('students').select('id,code,name,active,class_id,created_at').in('id', studentIds)
      : db().from('students').select('id,code,name,active,class_id,created_at'),
    db().from('milestones').select('*').order('date'),
    allRows<Assignment>((f, t) => {
      let q = db().from('assignments').select('*');
      if (studentIds) q = q.in('student_id', studentIds);
      return q.range(f, t);
    }),
    loadExtensions(studentIds ? { studentIds } : {}),
    loadFirstIdx(studentIds),
  ]);
  const students = must(stR) as { id: string; code: string; name: string; active: boolean; class_id: string | null; created_at: string }[];
  const milestones = must(msR) as Milestone[];
  const asgBy = new Map(asg.map((a) => [`${a.student_id}|${a.milestone_id}`, a]));
  return {
    students,
    states: new Map(students.map((s) => [s.id, statesOf(s, milestones, asgBy, ext, first.get(s.id), now)])),
  };
}
