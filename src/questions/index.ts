/**
 * 13 dạng câu — Claude 2. Mỗi dạng một file A.tsx … M.tsx, cùng props:
 *   { question: Question; onSubmit: (a: AnswerSubmission) => void; disabled?: boolean }
 * Đăng ký vào QUESTION_COMPONENTS để màn làm bài chọn theo question.type.
 */
import type { ComponentType } from 'react';
import type { AnswerSubmission, QType, Question } from '@shared/types';

export interface QuestionProps {
  question: Question;
  onSubmit: (answer: AnswerSubmission) => void;
  disabled?: boolean;
}

export const QUESTION_COMPONENTS: Partial<Record<QType, ComponentType<QuestionProps>>> = {};
