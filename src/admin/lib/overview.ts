/**
 * Tổng quan hôm nay — phần tính toán thuần (không đụng database), dùng ở admin-overview.ts.
 * Trạng thái bài tính bằng shared/lateness.ts (cùng cách với sheet.ts của sếp).
 */
import type { Assignment, Milestone } from '../../../shared/types';
import { daysLate, scoreIfSubmittedAt, unsubmittedStatus } from '../../../shared/lateness';
import { vnDate } from '../../../shared/time';
import { extKey, withExtension, type ExtensionMap } from '../../../shared/deadlines';

export interface AdminOverview {
  now: string;
  milestone: { id: string; date: string; kind: string; deadlineAt: string; open: boolean } | null;
  today: { submitted: number; doing: number; notStarted: number; total: number };
  owing: {
    studentId: string; code: string; name: string; classId: string | null;
    count: number; oldestDate: string; daysLate: number; pctNow: number; pctTomorrow: number;
  }[];
  lessons: { draft: number; processing: number; review: number };
  suggestionsPending: number;
  flagsTotal: number;
}

export function buildOverview(
  now: string,
  students: { id: string; code: string; name: string; created_at: string; class_id: string | null }[],
  milestones: Milestone[],
  assignments: Pick<Assignment, 'student_id' | 'milestone_id' | 'status' | 'answered_count'>[],
  ext: ExtensionMap = new Map(),
): Pick<AdminOverview, 'milestone' | 'today' | 'owing'> {
  const byKey = new Map(assignments.map((a) => [`${a.student_id}|${a.milestone_id}`, a]));
  const t = Date.parse(now);
  const live = milestones.filter((m) => !m.is_off).sort((a, b) => a.date.localeCompare(b.date));
  const cur = live.find((m) => Date.parse(m.opens_at) <= t && t <= Date.parse(m.deadline_at))
    ?? [...live].reverse().find((m) => Date.parse(m.deadline_at) < t) ?? null;

  const today = { submitted: 0, doing: 0, notStarted: 0, total: 0 };
  const owing: AdminOverview['owing'] = [];
  const tomorrow = new Date(t + 24 * 3600 * 1000).toISOString();

  for (const s of students) {
    const joined = Date.parse(s.created_at);
    if (cur && Date.parse(cur.deadline_at) >= joined) {
      today.total++;
      const a = byKey.get(`${s.id}|${cur.id}`);
      if (a?.status === 'submitted') today.submitted++;
      else if (a && a.answered_count > 0) today.doing++;
      else today.notStarted++;
    }
    const mine = live.map((m) => withExtension(m, ext.get(extKey(s.id, m.id))))
      .filter((m) => Date.parse(m.deadline_at) >= joined && byKey.get(`${s.id}|${m.id}`)?.status !== 'submitted' && unsubmittedStatus(m, now) === 'owing');
    if (mine.length) {
      const oldest = mine[0]!;
      owing.push({
        studentId: s.id, code: s.code, name: s.name, classId: s.class_id,
        count: mine.length, oldestDate: oldest.date, daysLate: daysLate(vnDate(oldest.deadline_at), now),
        pctNow: scoreIfSubmittedAt(vnDate(oldest.deadline_at), now), pctTomorrow: scoreIfSubmittedAt(vnDate(oldest.deadline_at), tomorrow),
      });
    }
  }
  owing.sort((a, b) => b.daysLate - a.daysLate || b.count - a.count || a.code.localeCompare(b.code));
  return {
    milestone: cur ? { id: cur.id, date: cur.date, kind: cur.kind, deadlineAt: cur.deadline_at, open: t <= Date.parse(cur.deadline_at) } : null,
    today,
    owing,
  };
}
