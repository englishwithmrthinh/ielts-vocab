/**
 * Phần dùng chung của pipeline media: Storage, Gemini ảnh, phiên âm, nhật ký.
 * Media lưu ở Supabase Storage (bucket "media"), không đi qua Netlify.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PipelineLogEntry, Word } from '../../../shared/types';
import { env, envOptional } from '../../lib/env';
import { db, must } from '../../lib/supabase';
import { elevenLabsTts, type TtsResult } from './audio';

export const BUCKET = 'media';

// ---------------- Chạy song song có giới hạn ----------------
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---------------- Storage ----------------
export async function upload(path: string, body: Buffer, contentType: string): Promise<string> {
  must(await db().storage.from(BUCKET).upload(path, body, { contentType, upsert: true, cacheControl: '31536000' }));
  const { data } = db().storage.from(BUCKET).getPublicUrl(path);
  // ?v= để trình duyệt tải bản mới khi tạo lại
  return `${data.publicUrl}?v=${Date.now().toString(36)}`;
}

// ---------------- Nhật ký tiến trình (lessons.pipeline_log) ----------------
export class PipelineLog {
  private entries: PipelineLogEntry[] = [];
  constructor(private lessonId: string, initial: PipelineLogEntry[] = []) {
    this.entries = [...initial];
  }
  add(step: PipelineLogEntry['step'], message: string, word_id?: string) {
    this.entries.push({ at: new Date().toISOString(), step, message, ...(word_id ? { word_id } : {}) });
  }
  /** Ghi xuống DB (gọi sau mỗi bước, không gọi trong vòng lặp từng từ để đỡ tốn thời gian) */
  async flush(extra: Record<string, unknown> = {}) {
    must(await db().from('lessons').update({ pipeline_log: this.entries.slice(-300), ...extra }).eq('id', this.lessonId));
  }
}

// ---------------- Phiên âm: Free Dictionary API ----------------
export async function lookupIpa(word: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (word.includes(' ')) return null; // cụm từ: giữ bản AI
  const res = await fetchImpl(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { phonetic?: string; phonetics?: { text?: string; audio?: string }[] }[];
  for (const entry of data) {
    // ưu tiên phiên âm có kèm audio Anh-Anh/Anh-Mỹ, rồi tới bất kỳ
    const withText = (entry.phonetics ?? []).filter((p) => p.text);
    const pick = withText.find((p) => p.audio?.includes('-uk')) ?? withText.find((p) => p.audio) ?? withText[0];
    const t = pick?.text ?? entry.phonetic;
    if (t) return t.startsWith('/') ? t : `/${t.replace(/^\[|\]$/g, '')}/`;
  }
  return null;
}

// ---------------- ElevenLabs ----------------
export function ttsFromEnv(): (text: string) => Promise<TtsResult> {
  const apiKey = env('ELEVENLABS_API_KEY');
  const voiceId = env('ELEVENLABS_VOICE_ID');
  return (text) => elevenLabsTts(text, { apiKey, voiceId });
}

// ---------------- Prompt ảnh ----------------
const FALLBACK_GRID = `Create ONE image: a grid of {{cols}} columns × {{rows}} rows of separate illustrations, exactly {{count}} filled cells{{emptyNote}}.
Every cell is a full-bleed colourful illustration with its own solid, non-white background. Cells are separated by thick, perfectly straight PURE WHITE gutters (about 3% of the image width) running edge to edge, plus a white outer margin. All cells have the same size.
Absolutely NO text, letters, numbers, captions, labels, signs or symbols that look like writing anywhere in the image.
Consistent semi-realistic illustration style, soft lighting, friendly for teenage learners.
Cells in reading order (left→right, top→bottom):
{{items}}`;

const FALLBACK_SINGLE = `One semi-realistic illustration, square, colourful solid background, friendly for teenage learners, showing: {{hint}} (meaning of the English word "{{word}}").
Absolutely NO text, letters, numbers or symbols that look like writing.`;

function loadPrompt(file: string, fallback: string): string {
  for (const base of [process.cwd(), join(process.cwd(), '..'), '/var/task']) {
    try {
      const raw = readFileSync(join(base, 'prompts', file), 'utf8');
      // file .md của Gemini: lấy khối ```text … ``` đầu tiên nếu có, không thì cả file
      const block = /```(?:text|prompt)?\s*([\s\S]*?)```/.exec(raw);
      return (block ? block[1]! : raw).trim();
    } catch {
      /* thử chỗ khác */
    }
  }
  return fallback;
}

function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ''));
}

export function gridPrompt(words: Pick<Word, 'word' | 'image_hint' | 'meaning_vi'>[], cols: number, rows: number): string {
  const items = words.map((w, i) => `${i + 1}. ${w.image_hint || `a clear picture showing "${w.word}"`}`).join('\n');
  const empty = cols * rows - words.length;
  return fill(loadPrompt('image-grid.md', FALLBACK_GRID), {
    cols, rows, count: words.length, items,
    emptyNote: empty > 0 ? `The last ${empty} cell(s) stay empty: plain pastel background, nothing drawn.` : '',
  });
}

export function singlePrompt(w: Pick<Word, 'word' | 'image_hint'>): string {
  return fill(loadPrompt('image-single.md', FALLBACK_SINGLE), { word: w.word, hint: w.image_hint || w.word });
}

// ---------------- Gemini ảnh ----------------
export async function geminiImage(prompt: string, aspectRatio: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const model = envOptional('GEMINI_IMAGE_MODEL') ?? 'gemini-2.5-flash-image';
  const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env('GEMINI_API_KEY'), 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio } },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string }; inline_data?: { data: string } }[] } }[] };
  for (const p of data.candidates?.[0]?.content?.parts ?? []) {
    const d = p.inlineData?.data ?? p.inline_data?.data;
    if (d) return Buffer.from(d, 'base64');
  }
  throw new Error('Gemini không trả ảnh (có thể bị chặn nội dung)');
}

/** Tỷ lệ khung khớp lưới: 4×5 → 4:5, 5×5 → 1:1, 4×4 → 1:1 */
export function aspectFor(cols: number, rows: number): string {
  if (cols === rows) return '1:1';
  return cols < rows ? '4:5' : '5:4';
}
