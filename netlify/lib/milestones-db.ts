/** Ghi mốc vào database và đánh lại idx. */
import type { Milestone, MonthKey } from '../../shared/types';
import { assignIdx, milestonesOfMonth } from '../../shared/milestones';
import { vnDate } from '../../shared/time';
import { HttpError } from './http';
import { db, must } from './supabase';

/** Thêm các mốc còn thiếu của một tháng (không đụng mốc đã có), rồi đánh lại idx */
export async function ensureMonth(month: MonthKey): Promise<number> {
  const drafts = milestonesOfMonth(month);
  const existing = must(await db().from('milestones').select('date').eq('month', month)) as { date: string }[];
  const have = new Set(existing.map((r) => r.date));
  const missing = drafts.filter((d) => !have.has(d.date));
  if (missing.length) {
    // Chèn tạm dạng is_off=true, idx=null (thoả ràng buộc), rồi reindex bật lại
    must(await db().from('milestones').insert(missing.map((m) => ({ ...m, idx: null, is_off: true }))));
    await reindex(new Set(missing.map((m) => m.date)));
  }
  return missing.length;
}

/**
 * Đánh lại idx toàn bộ mốc theo ngày.
 * `forceOn` = các ngày đang tạm để is_off=true cần bật thành mốc thường.
 */
export async function reindex(forceOn: Set<string> = new Set()): Promise<void> {
  const all = must(await db().from('milestones').select('*').order('date')) as Milestone[];
  const fixed = assignIdx(all.map((m) => ({ ...m, is_off: forceOn.has(m.date) ? false : m.is_off })));
  const changed = fixed.filter((m, i) => m.idx !== all[i]!.idx || m.is_off !== all[i]!.is_off);
  if (!changed.length) return;
  // Bước 1: gỡ idx của các mốc sẽ đổi (tránh trùng unique khi dịch số)
  must(await db().from('milestones').update({ idx: null, is_off: true }).in('id', changed.map((m) => m.id)));
  // Bước 2: ghi idx mới
  for (const m of changed) {
    must(await db().from('milestones').update({ idx: m.idx, is_off: m.is_off }).eq('id', m.id));
  }
}

/**
 * Giáo viên bật/tắt Nghỉ cho một mốc. Chỉ cho mốc từ hôm nay trở đi:
 * đổi mốc đã qua sẽ làm lệch hạn ôn (due_idx) của các từ đã xếp lịch.
 */
export async function setOff(milestoneId: string, isOff: boolean): Promise<void> {
  const row = must(await db().from('milestones').select('date').eq('id', milestoneId).single()) as { date: string };
  if (row.date < vnDate(new Date())) {
    throw new HttpError(400, 'past_milestone', 'Không đổi được mốc đã qua');
  }
  must(await db().from('milestones').update({ is_off: true, idx: null }).eq('id', milestoneId));
  await reindex(isOff ? new Set() : new Set([row.date]));
}

/**
 * Đổi hạn nộp chung của một mốc. deadline: 'YYYY-MM-DDTHH:mm' giờ VN (giây :59).
 * Trạng thái bài (đang mở / nợ / bỏ) tính lại theo hạn mới ngay lập tức; bài đã nộp giữ nguyên điểm.
 */
export async function setMilestoneDeadline(id: string, deadline: string | undefined): Promise<string> {
  const at = parseVnDeadline(deadline);
  const m = must(await db().from('milestones').select('*').eq('id', id).maybeSingle()) as Milestone | null;
  if (!m) throw new HttpError(404, 'not_found', 'Không tìm thấy mốc');
  if (Date.parse(at) <= Date.parse(m.opens_at)) throw new HttpError(400, 'too_early', 'Hạn phải sau giờ mở bài');
  must(await db().from('milestones').update({ deadline_at: at }).eq('id', id));
  return at;
}

/** 'YYYY-MM-DDTHH:mm' (giờ VN) → ISO, giây :59 */
export function parseVnDeadline(deadline: string | undefined): string {
  if (!deadline || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline)) throw new HttpError(400, 'bad_input', 'Cần hạn dạng YYYY-MM-DDTHH:mm');
  const t = Date.parse(`${deadline}:59+07:00`);
  if (!Number.isFinite(t)) throw new HttpError(400, 'bad_input', 'Hạn không hợp lệ');
  return new Date(t).toISOString();
}
