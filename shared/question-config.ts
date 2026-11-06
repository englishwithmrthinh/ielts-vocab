/**
 * Cấu hình thuật toán — đổi số ở đây, không cần sửa code khác.
 * Chủ sở hữu: Sếp (Claude 1).
 */
import type { Box, QType } from './types';

/** Khoảng ôn (tính bằng số mốc) theo hộp SAU khi trả lời */
export const BOX_INTERVAL: Record<Box, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 3,
  5: 5,
  6: 9, // Pass: kiểm tra lại sau 9 mốc
};

/** Hộp mới khi trả lời SAI, theo hộp hiện tại */
export const BOX_ON_WRONG: Record<Box, Box> = {
  1: 1,
  2: 1,
  3: 1,
  4: 2,
  5: 2,
  6: 3,
};

/** Dạng câu dùng cho từng hộp (6 = kiểm tra Pass) */
export const QTYPES_BY_BOX: Record<Box, QType[]> = {
  1: ['A', 'B', 'C', 'D'],
  2: ['B', 'C', 'E', 'F'],
  3: ['G', 'H', 'J'],
  4: ['H', 'I', 'J', 'K', 'M'],
  5: ['K', 'L', 'I', 'M'],
  6: ['K', 'H', 'L', 'M'],
};

/** Dạng gõ — từ phải gõ đúng ít nhất một lần mới được Pass */
export const TYPING_QTYPES: QType[] = ['G', 'H', 'I', 'K', 'M'];
/** Dạng bắt buộc khi ở H5 mà chưa từng gõ đúng */
export const FORCED_TYPING_QTYPES: QType[] = ['H', 'I', 'K', 'M'];
/** Dạng nhiều từ trong một câu */
export const MULTI_WORD_QTYPES: QType[] = ['D', 'L'];
export const MULTI_WORD_MIN = 4;
export const MATCH_PAIRS = 5; // D
export const DRAG_BLANKS_MAX = 5; // L

/** Dữ liệu từ mà mỗi dạng cần */
export const QTYPE_NEEDS: Record<QType, ('image' | 'audio' | 'example' | 'word_family')[]> = {
  A: [], B: ['image'], C: ['audio'], D: [], E: [], F: [], G: [],
  H: ['audio'], I: ['image'], J: ['example'], K: ['example'], L: ['example'], M: ['word_family'],
};

/** Dạng dễ cho lần sửa sai đầu tiên. Từ sai được chèn lại sau 4 câu, cần đúng 2 lần liên tiếp (RELEARN_* trong student-learn.ts); không đổi hộp; xong hết mới được Nộp. */
export const FIX_QTYPES: QType[] = ['A', 'E'];

export const ASSIGNMENT_LIMITS = {
  /** Phần bắt buộc tối đa */
  maxRequired: 40,
  /** Tối thiểu; thiếu thì bù câu ôn không đổi hộp */
  minRequired: 15,
};

export const LATENESS = {
  /** Trừ mỗi ngày trễ (điểm %) */
  penaltyPerDay: 10,
  /** Số ngày trễ tối đa còn được nộp; quá thì Bỏ bài */
  maxLateDays: 7,
};

export const SPELLING_MASK_RATIO = 0.4; // G

export const XP = {
  choiceCorrect: 10,
  typingCorrect: 15,
  wordPassed: 50,
  onTimeSubmit: 30,
  perfectWeek: 100,
  practiceCorrect: 2,
};
