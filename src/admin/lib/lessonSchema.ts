/**
 * Kiểm tra JSON từ skill (mục 5 đặc tả) — dùng cả ở trình duyệt (Tạo buổi)
 * và ở server (admin-lessons). Không phụ thuộc DOM hay Node.
 *
 * Đối chiếu với skill/schema.json (Gemini): luật bắt buộc ở đây là LỖI; các luật
 * định dạng còn lại của schema (nghĩa ≤6 tiếng, ipa /…/, ví dụ 8–18 từ, ≤3 dạng từ,
 * gợi ý ảnh ≥10 ký tự) là LƯU Ý — vẫn cho tạo buổi (sếp đã duyệt cách này).
 */
import type { PartOfSpeech, WordFamilyItem } from '../../../shared/types';

export const POS_LIST: PartOfSpeech[] = ['n', 'v', 'adj', 'adv', 'prep', 'conj', 'phr'];

export interface LessonWordInput {
  word: string;
  pos: PartOfSpeech;
  meaning_vi: string;
  ipa: string | null;
  syllables: string | null;
  example: string | null;
  word_family: WordFamilyItem[];
  image_hint: string | null;
}

export interface SchemaIssue {
  /** Vị trí từ (0-based), -1 là lỗi chung của cả JSON */
  index: number;
  /** Từ đang lỗi (nếu đọc được) để giáo viên dễ tìm */
  word: string | null;
  field: string;
  message: string;
  /** warning: vẫn cho tạo buổi; error: phải sửa */
  level: 'error' | 'warning';
}

export interface ParseResult {
  words: LessonWordInput[];
  issues: SchemaIssue[];
  ok: boolean;
}

const MAX_WORDS = 50;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

/** Từ ở dạng chuẩn để so trùng: chữ thường, gộp khoảng trắng */
export function normWord(w: string): string {
  return w.trim().toLowerCase().replace(/\s+/g, ' ');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Câu ví dụ có chứa đúng nguyên dạng từ (không phân biệt hoa thường, theo ranh giới từ) */
export function containsExact(sentence: string, word: string): boolean {
  const re = new RegExp(`(^|[^A-Za-z])${escapeRe(word)}([^A-Za-z]|$)`, 'i');
  return re.test(sentence);
}

/** Dán text → JSON. Chấp nhận cả khi giáo viên dán kèm ```json ... ``` */
export function parseLessonJson(text: string): ParseResult {
  const issues: SchemaIssue[] = [];
  const fail = (message: string): ParseResult => ({
    words: [],
    issues: [{ index: -1, word: null, field: '(JSON)', message, level: 'error' }],
    ok: false,
  });

  let cleaned = text.trim();
  const fence = /^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/.exec(cleaned);
  if (fence) cleaned = fence[1]!.trim();
  if (!cleaned) return fail('Chưa dán JSON.');

  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch (e) {
    return fail(`JSON sai cú pháp: ${(e as Error).message}. Hãy copy lại toàn bộ khối JSON từ Claude.`);
  }

  const list = isObj(data) ? data.words : Array.isArray(data) ? data : undefined;
  if (!Array.isArray(list)) return fail('Không thấy danh sách "words". JSON phải có dạng { "words": [ ... ] }.');
  if (list.length === 0) return fail('Danh sách "words" đang rỗng.');
  if (list.length > MAX_WORDS) {
    issues.push({ index: -1, word: null, field: 'words', level: 'error', message: `Một buổi tối đa ${MAX_WORDS} từ (đang có ${list.length}).` });
  }

  const words: LessonWordInput[] = [];
  const seen = new Map<string, number>();

  list.forEach((raw, index) => {
    const add = (field: string, message: string, level: 'error' | 'warning' = 'error', word: string | null = null) =>
      issues.push({ index, word: word ?? (isObj(raw) ? str(raw.word) : null), field, message, level });

    if (!isObj(raw)) {
      add('(từ)', 'Mục này không phải object { ... }.');
      return;
    }

    const word = str(raw.word);
    if (!word) add('word', 'Thiếu từ.');
    else if (word.length > 60) add('word', 'Từ dài quá 60 ký tự.');

    const pos = str(raw.pos);
    if (!pos) add('pos', 'Thiếu loại từ.');
    else if (!POS_LIST.includes(pos as PartOfSpeech)) add('pos', `Loại từ "${pos}" không hợp lệ. Chỉ dùng: ${POS_LIST.join(', ')}.`);

    const meaning = str(raw.meaning_vi);
    if (!meaning) add('meaning_vi', 'Thiếu nghĩa tiếng Việt.');
    else if (meaning.split(/\s+/).length > 6) add('meaning_vi', 'Nghĩa nên ngắn, tối đa 6 tiếng.', 'warning');

    const ipa = str(raw.ipa);
    if (!ipa) add('ipa', 'Thiếu phiên âm (hệ thống sẽ tự tra từ điển).', 'warning');
    else if (!/^\/.+\/$/.test(ipa)) add('ipa', 'Phiên âm nên đặt trong hai dấu /.../.', 'warning');

    const syllables = str(raw.syllables);
    if (!syllables) add('syllables', 'Thiếu phần tách âm tiết.', 'warning');
    else if (!/[A-Z]/.test(syllables) && word && word.includes(' ') === false && /[·.]/.test(syllables))
      add('syllables', 'Chưa có âm nhấn (viết HOA âm tiết được nhấn).', 'warning');

    const example = str(raw.example);
    if (!example) add('example', 'Thiếu câu ví dụ (dạng J, K, L sẽ không dùng được).', 'warning');
    else if (word && !containsExact(example, word)) add('example', `Câu ví dụ không chứa đúng nguyên dạng "${word}".`);
    else {
      const n = example.split(/\s+/).length;
      if (n < 8 || n > 18) add('example', `Câu ví dụ nên dài 8–18 từ (đang có ${n}).`, 'warning');
    }

    const familyRaw = raw.word_family ?? [];
    const family: WordFamilyItem[] = [];
    if (!Array.isArray(familyRaw)) {
      add('word_family', '"word_family" phải là danh sách [ ... ] (có thể rỗng).');
    } else {
      if (familyRaw.length > 3) add('word_family', `Tối đa 3 dạng từ (đang có ${familyRaw.length}).`, 'warning');
      familyRaw.forEach((f, fi) => {
        const at = `word_family[${fi + 1}]`;
        if (!isObj(f)) return add(at, 'Mục này không phải object.');
        const form = str(f.form);
        const fpos = str(f.pos);
        const sentence = str(f.sentence);
        if (!form) add(`${at}.form`, 'Thiếu dạng từ.');
        if (!fpos || !POS_LIST.includes(fpos as PartOfSpeech)) add(`${at}.pos`, `Loại từ "${fpos ?? ''}" không hợp lệ.`);
        if (!sentence) add(`${at}.sentence`, 'Thiếu câu.');
        else {
          const blanks = sentence.split('___').length - 1;
          if (blanks !== 1) add(`${at}.sentence`, `Câu phải có đúng một "___" (đang có ${blanks}).`);
        }
        if (form && fpos && sentence) family.push({ form, pos: fpos as PartOfSpeech, sentence });
      });
    }

    const hint = str(raw.image_hint);
    if (!hint) add('image_hint', 'Thiếu gợi ý vẽ ảnh.', 'warning');
    else if (/[À-ỹĐđ]/.test(hint) && /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(hint))
      add('image_hint', 'Gợi ý vẽ ảnh nên viết bằng tiếng Anh.', 'warning');
    else if (hint.length < 10) add('image_hint', 'Gợi ý vẽ ảnh quá ngắn (tối thiểu 10 ký tự).', 'warning');

    if (word && pos) {
      const key = `${normWord(word)}|${pos}`;
      const prev = seen.get(key);
      if (prev !== undefined) add('word', `Trùng với từ số ${prev + 1} (cùng từ, cùng loại từ).`);
      else seen.set(key, index);
    }

    if (word && pos && meaning) {
      words.push({
        word: normWord(word),
        pos: pos as PartOfSpeech,
        meaning_vi: meaning,
        ipa,
        syllables,
        example,
        word_family: family,
        image_hint: hint,
      });
    }
  });

  const ok = !issues.some((i) => i.level === 'error');
  return { words: ok ? words : [], issues, ok };
}

/**
 * Số ảnh lưới cần cho một buổi (mục 5: ≤20 → 4 cột, 21–25 → 5 cột, >25 tách 2 ảnh).
 * Số hàng = vừa đủ chứa số từ (16 từ → 4×4), để không có hàng trắng trọn vẹn
 * làm bộ dò rãnh đếm sai.
 */
export function gridPlan(n: number): { cols: number; rows: number; count: number }[] {
  if (n <= 0) return [];
  if (n <= 20) return [{ cols: 4, rows: Math.ceil(n / 4), count: n }];
  if (n <= 25) return [{ cols: 5, rows: 5, count: n }];
  const first = Math.ceil(n / 2);
  return [...gridPlan(first), ...gridPlan(n - first)];
}
