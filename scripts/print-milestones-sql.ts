/**
 * In câu lệnh SQL tạo mốc cho các tháng, đánh idx từ 1.
 *   npx tsx scripts/print-milestones-sql.ts 2026-11 2026-12 > supabase/seed-milestones.sql
 */
import { assignIdx, milestonesOfMonth } from '../shared/milestones';

const months = process.argv.slice(2);
if (!months.length) {
  console.error('Cần ít nhất một tháng, ví dụ 2026-11');
  process.exit(1);
}
const rows = assignIdx(months.flatMap(milestonesOfMonth));
const q = (s: string) => `'${s}'`;
console.log('-- Mốc ' + months.join(', ') + ' (sinh bởi scripts/print-milestones-sql.ts)');
console.log('insert into milestones (idx, date, kind, opens_at, deadline_at, month, is_off) values');
console.log(
  rows
    .map((m) => `  (${m.idx}, ${q(m.date)}, ${q(m.kind)}, ${q(m.opens_at)}, ${q(m.deadline_at)}, ${q(m.month)}, false)`)
    .join(',\n') + '\non conflict (date) do nothing;',
);
