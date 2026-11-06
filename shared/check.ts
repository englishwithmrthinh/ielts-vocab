/**
 * Chấm nhanh ngay trên trình duyệt (hiện ✓/✗ tức thì, không chờ mạng).
 * Server vẫn là nơi chấm chính thức: kết quả từ /api/answer luôn thắng nếu khác.
 * Chỉ gửi mã băm SHA-256 (có muối ngẫu nhiên theo câu), không gửi đáp án thô.
 * Chủ sở hữu: Sếp. Dùng được cả ở Netlify Functions (Node 18+) lẫn trình duyệt (Web Crypto).
 */
import type { AnswerSubmission, QuickCheck, UUID } from './types';
import type { AnswerKey } from './questions';

const norm = (s: string) => s.trim().toLowerCase();

export async function sha(salt: string, value: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${value}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt(): string {
  const a = new Uint8Array(12);
  globalThis.crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Server: tạo QuickCheck từ đáp án */
export async function makeCheck(key: AnswerKey): Promise<QuickCheck> {
  const salt = randomSalt();
  if (key.kind === 'option') return { kind: 'option', salt, h: await sha(salt, key.correctOptionId) };
  if (key.kind === 'text') return { kind: 'text', salt, h: await sha(salt, norm(key.expected)) };
  const h: Record<UUID, string> = {};
  for (const [id, target] of Object.entries(key.pairs)) h[id] = await sha(salt, `${id}:${target}`);
  return { kind: 'match', salt, h };
}

/** Trình duyệt: chấm nhanh. Trả về null nếu câu không có check. */
export async function quickGrade(
  check: QuickCheck | undefined, sub: AnswerSubmission,
): Promise<{ correct: boolean; perWord?: { wordId: UUID; correct: boolean }[] } | null> {
  if (!check) return null;
  if (check.kind === 'option') return { correct: (await sha(check.salt, sub.optionId ?? '')) === check.h };
  if (check.kind === 'text') return { correct: (await sha(check.salt, norm(sub.text ?? ''))) === check.h };
  const perWord = await Promise.all(Object.entries(check.h).map(async ([wordId, h]) => ({
    wordId, correct: (await sha(check.salt, `${wordId}:${sub.matches?.[wordId] ?? ''}`)) === h,
  })));
  return { correct: perWord.every((p) => p.correct), perWord };
}
