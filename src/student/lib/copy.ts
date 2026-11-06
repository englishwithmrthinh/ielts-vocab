// Câu chữ khu học sinh — nội dung trong src/student/copy.json (Gemini viết, sếp chỉnh).
import type { BadgeCode } from '@shared/types';
import COPY from '../copy.json';

export { COPY };

/** Chọn ngẫu nhiên nhưng ổn định theo `seed` (ví dụ qid) để không đổi câu khi vẽ lại */
export function pick(list: readonly string[], seed = ''): string {
  if (!list.length) return '';
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return list[Math.abs(h) % list.length]!;
}

/** Thay {key} trong câu mẫu */
export function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export const badgeName = (c: BadgeCode) => COPY.badges[c]?.name ?? c;
export const badgeDesc = (c: BadgeCode) => COPY.badges[c]?.desc ?? '';

/** Câu nhận xét cuối bài theo % câu đúng */
export function summaryLine(correct: number, total: number, seed = ''): string {
  const pct = total ? (correct / total) * 100 : 0;
  const s = COPY.summary;
  const list = pct >= 90 ? s['90_100'] : pct >= 70 ? s['70_89'] : pct >= 50 ? s['50_69'] : s['0_49'];
  return pick(list, seed);
}
