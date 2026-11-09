/**
 * "Chưa có từ thì chưa có bài": mốc đến TRƯỚC mốc đầu tiên của học sinh thì không tính (như chưa vào lớp).
 * Mốc đầu tiên = idx nhỏ nhất trong: các mốc em đã có bài (assignments; bỏ bài rỗng 0 câu chưa nộp), và hạn của các từ em CHƯA làm lần nào
 * (student_words.last_answered_at null → due_idx là mốc làm lần đầu, kể cả sau khi thầy "Sửa" dời mốc).
 * Hàm thuần — không đụng database. Chủ sở hữu: Sếp.
 */
export type FirstIdxMap = Map<string, number>; // student_id → idx mốc đầu tiên; không có = chưa có bài nào

export function firstIdxOf(assignmentIdxs: (number | null | undefined)[], unansweredDueIdxs: number[]): number | null {
  let min: number | null = null;
  for (const i of [...assignmentIdxs, ...unansweredDueIdxs]) if (typeof i === 'number' && (min === null || i < min)) min = i;
  return min;
}

/** true: mốc này chưa phải bài của em (đến trước từ đầu tiên). Mốc nghỉ (idx null) không xét ở đây. */
export function beforeFirst(m: { idx: number | null }, firstIdx: number | null | undefined): boolean {
  if (m.idx === null) return false;
  return firstIdx === null || firstIdx === undefined || m.idx < firstIdx;
}
