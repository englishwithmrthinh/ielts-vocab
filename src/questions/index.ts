/**
 * 13 dạng câu — Claude 2. Mỗi dạng một file A.tsx … M.tsx, cùng props:
 *   { question: Question; onSubmit: (a: AnswerSubmission) => void; disabled?: boolean; result?: AnswerResult }
 * `result` (tuỳ chọn) có sau khi chấm: component tô đúng/sai ngay trên đáp án.
 * Đăng ký vào QUESTION_COMPONENTS để màn làm bài chọn theo question.type.
 */
import type { ComponentType } from 'react';
import type { AnswerResult, AnswerSubmission, QType, Question } from '@shared/types';
import A from './A';
import B from './B';
import C from './C';
import D from './D';
import E from './E';
import F from './F';
import G from './G';
import H from './H';
import I from './I';
import J from './J';
import K from './K';
import L from './L';
import M from './M';

/** Kết quả chấm nhanh trên máy (shared/check.ts) — có trước khi server trả AnswerResult */
export interface QuickResult {
  correct: boolean;
  perWord?: { wordId: string; correct: boolean }[];
}

export interface QuestionProps {
  question: Question;
  onSubmit: (answer: AnswerSubmission) => void;
  disabled?: boolean;
  result?: AnswerResult;
  /** chấm nhanh: tô đúng/sai ngay, trước khi có `result` */
  quick?: QuickResult;
}

export const QUESTION_COMPONENTS: Partial<Record<QType, ComponentType<QuestionProps>>> = {
  A, B, C, D, E, F, G, H, I, J, K, L, M,
};
