/**
 * Hộp ôn (Leitner) tính theo MỐC. Hàm thuần — không đụng database.
 *
 * Sau mỗi câu TÍNH ĐIỂM (mode 'graded'):
 *   - Đúng: lên một hộp. H5 → Pass chỉ khi đã từng gõ đúng (typed_ok);
 *           chưa gõ đúng thì ở lại H5, hẹn ngay mốc sau để ra dạng gõ.
 *           Pass đúng (kiểm tra lại) → giữ Pass.
 *   - Sai: về hộp theo BOX_ON_WRONG.
 *   - Hạn ôn tiếp: due_idx = idx của bài đang làm + BOX_INTERVAL[hộp mới].
 * Câu 'fix' / 'practice' / 'retry' KHÔNG gọi hàm này.
 */
import type { Box } from './types';
import { PASS_BOX } from './types';
import { BOX_INTERVAL, BOX_ON_WRONG } from './question-config';

export interface SrsState {
  box: Box;
  typed_ok: boolean;
  wrong_count: number;
}

export interface SrsResult extends SrsState {
  due_idx: number;
  /** Từ vừa chuyển sang Pass ở câu này (để hiện hiệu ứng, cộng XP) */
  passed: boolean;
}

export function applyAnswer(
  state: SrsState,
  correct: boolean,
  isTyping: boolean,
  currentIdx: number,
): SrsResult {
  const typed_ok = state.typed_ok || (correct && isTyping);

  if (!correct) {
    const box = BOX_ON_WRONG[state.box];
    return { box, typed_ok, wrong_count: state.wrong_count + 1, due_idx: currentIdx + BOX_INTERVAL[box], passed: false };
  }

  if (state.box === PASS_BOX) {
    return { box: PASS_BOX, typed_ok, wrong_count: state.wrong_count, due_idx: currentIdx + BOX_INTERVAL[PASS_BOX], passed: false };
  }

  if (state.box === 5 && !typed_ok) {
    // Đúng nhưng chưa từng gõ đúng: chưa cho Pass, hỏi lại ngay mốc sau (bằng dạng gõ)
    return { box: 5, typed_ok, wrong_count: state.wrong_count, due_idx: currentIdx + 1, passed: false };
  }

  const box = (state.box + 1) as Box;
  return {
    box,
    typed_ok,
    wrong_count: state.wrong_count,
    due_idx: currentIdx + BOX_INTERVAL[box],
    passed: box === PASS_BOX,
  };
}

/** Trạng thái khi từ mới được phát hành cho học sinh */
export function initialState(nextIdx: number): SrsState & { due_idx: number } {
  return { box: 1, typed_ok: false, wrong_count: 0, due_idx: nextIdx };
}
