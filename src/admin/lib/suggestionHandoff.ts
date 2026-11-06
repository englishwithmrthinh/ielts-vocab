/**
 * Từ học sinh đề xuất → Thêm bộ từ → Phát hành → đánh dấu "added".
 * Giữ danh sách đề xuất đi kèm bộ từ trong localStorage của máy giáo viên (bọc try/catch:
 * mất cũng không hỏng gì, chỉ là đề xuất vẫn ở trạng thái chờ và giáo viên tự bấm).
 */
import { normWord } from './lessonSchema';
import { adminApi } from './adminApi';

export interface PickedSuggestion { id: string; text: string; code: string; name: string }

const KEY = 'admin-suggestions-by-lesson';

function read(): Record<string, PickedSuggestion[]> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, PickedSuggestion[]>;
  } catch {
    return {};
  }
}

function write(v: Record<string, PickedSuggestion[]>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* bỏ qua */
  }
}

export function rememberForLesson(lessonId: string, picked: PickedSuggestion[]) {
  if (!picked.length) return;
  write({ ...read(), [lessonId]: picked });
}

/** Sau khi phát hành: đề xuất nào khớp một từ trong bộ thì đánh dấu added + word_id. Trả về số đã đánh dấu. */
export async function resolveAfterPublish(lessonId: string, words: { id: string; word: string }[]): Promise<number> {
  const all = read();
  const picked = all[lessonId];
  if (!picked?.length) return 0;
  const byText = new Map(words.map((w) => [normWord(w.word), w.id]));
  let done = 0;
  const left: PickedSuggestion[] = [];
  for (const p of picked) {
    const wordId = byText.get(normWord(p.text));
    if (!wordId) {
      left.push(p);
      continue;
    }
    try {
      await adminApi.updateSuggestion(p.id, 'added', wordId);
      done++;
    } catch {
      left.push(p);
    }
  }
  if (left.length) all[lessonId] = left;
  else delete all[lessonId];
  write(all);
  return done;
}
