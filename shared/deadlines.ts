/**
 * Hạn hiệu lực của một bài = hạn chung của mốc, hoặc hạn riêng (bảng deadline_extensions) nếu muộn hơn.
 * Hàm thuần — không đụng database. Chủ sở hữu: Sếp.
 *
 *   const m2 = withExtension(m, ext.get(extKey(studentId, m.id)));
 *   unsubmittedStatus(m2, now); daysLate(vnDate(m2.deadline_at), at);
 */
export type ExtensionMap = Map<string, string>; // `${student_id}|${milestone_id}` → deadline_at (ISO)

export const extKey = (studentId: string, milestoneId: string) => `${studentId}|${milestoneId}`;

export function withExtension<T extends { deadline_at: string }>(m: T, ext: string | null | undefined): T {
  if (!ext || Date.parse(ext) <= Date.parse(m.deadline_at)) return m;
  return { ...m, deadline_at: ext };
}

export function toExtensionMap(rows: { student_id: string; milestone_id: string; deadline_at: string }[]): ExtensionMap {
  return new Map(rows.map((r) => [extKey(r.student_id, r.milestone_id), r.deadline_at]));
}
