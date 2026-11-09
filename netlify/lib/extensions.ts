/**
 * Đọc hạn riêng (bảng deadline_extensions, migration 005). Chủ sở hữu: Sếp.
 * Chưa chạy migration 005 thì coi như không có hạn riêng (web vẫn chạy bình thường).
 */
import { toExtensionMap, type ExtensionMap } from '../../shared/deadlines';
import { db } from './supabase';

type Row = { student_id: string; milestone_id: string; deadline_at: string };

function missingTable(err: { code?: string; message?: string } | null): boolean {
  return !!err && (err.code === '42P01' || err.code === 'PGRST205' || /deadline_extensions/.test(err.message ?? ''));
}

export async function loadExtensions(filter: { studentIds?: string[]; milestoneIds?: string[] } = {}): Promise<ExtensionMap> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db().from('deadline_extensions').select('student_id,milestone_id,deadline_at');
    if (filter.studentIds) q = q.in('student_id', filter.studentIds.length ? filter.studentIds : ['00000000-0000-0000-0000-000000000000']);
    if (filter.milestoneIds) q = q.in('milestone_id', filter.milestoneIds.length ? filter.milestoneIds : ['00000000-0000-0000-0000-000000000000']);
    const r = await q.range(from, from + 999);
    if (r.error) {
      if (missingTable(r.error)) return new Map();
      throw new Error(r.error.message);
    }
    const rows = (r.data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return toExtensionMap(out);
}

export { missingTable };
