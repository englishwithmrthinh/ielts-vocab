/**
 * Audio cả bộ từ: gọi ElevenLabs with-timestamps theo đoạn ≤25 từ (PCM 16-bit mono, tốc độ 0.7),
 * rồi cắt từng từ theo mốc thời gian ký tự.
 *
 * Cắt:
 *  - Khoảng của từ = [start ký tự đầu, end ký tự cuối] theo `alignment`.
 *  - Ranh giới giữa hai từ = điểm YÊN NHẤT trong khoảng lặng giữa chúng
 *    (cửa sổ 10ms có năng lượng thấp nhất), không phải điểm giữa mù.
 *  - Đệm ~80ms mỗi đầu nhưng không vượt ranh giới → không chồng sang từ bên cạnh.
 *  - Fade 5ms hai đầu để không có tiếng "tách".
 *  - Kiểm tra: 15ms đầu/cuối mỗi đoạn phải yên (≤ 12% năng lượng đỉnh của từ);
 *    không đạt thì gắn cờ `edgeLoud` → pipeline tạo lại riêng từ đó.
 *
 * Phần thuần (cắt, kiểm tra, mã hoá mp3) tách khỏi phần gọi mạng để test được.
 */
import { Mp3Encoder } from '@breezystack/lamejs';

export const SAMPLE_RATE = 24_000; // pcm_24000: có ở mọi gói ElevenLabs (44.1k cần gói Pro)
export const TTS_SPEED = 0.7;
/** Mỗi lần gọi ElevenLabs tối đa 25 từ: đoạn dài dễ đọc nhanh dần và mốc thời gian lệch về cuối */
export const CHUNK_WORDS = 25;
const PAD_S = 0.08;
const FADE_S = 0.005;
const EDGE_S = 0.015;
const EDGE_MAX_RATIO = 0.12;
const WIN_S = 0.01;
/** Mốc ký tự của ElevenLabs hay kết thúc trước khi âm gió cuối (s, sh, ch) tắt hẳn, nhất là khi đọc chậm 0.7.
 *  Sau khi đệm, nếu mép vẫn còn tiếng (> TAIL_RATIO năng lượng của từ) thì kéo dài thêm từng 10ms, tối đa MAX_EXTEND_S,
 *  nhưng không bao giờ vượt ranh giới với từ bên cạnh. */
const TAIL_RATIO = 0.05;
const MAX_EXTEND_S = 0.45;

export interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface WordSpan { index: number; charStart: number; charEnd: number } // [charStart, charEnd)

export interface AudioCut {
  index: number;
  startSample: number;
  endSample: number;
  pcm: Int16Array;
  edgeLoud: boolean;
  /** Thời lượng lời nói theo alignment (giây) — 0 nghĩa là không thấy từ trong audio */
  speechSeconds: number;
}

/** "word1. word2. word3." và vị trí ký tự của từng từ */
export function buildScript(words: string[]): { text: string; spans: WordSpan[] } {
  let text = '';
  const spans: WordSpan[] = [];
  words.forEach((w, index) => {
    if (index > 0) text += ' ';
    const clean = w.trim();
    spans.push({ index, charStart: text.length, charEnd: text.length + clean.length });
    text += clean + '.';
  });
  return { text, spans };
}

export function pcmFromBase64(b64: string): Int16Array {
  const buf = Buffer.from(b64, 'base64');
  const out = new Int16Array(Math.floor(buf.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(i * 2);
  return out;
}

function rms(pcm: Int16Array, from: number, to: number): number {
  const a = Math.max(0, from);
  const b = Math.min(pcm.length, to);
  if (b <= a) return 0;
  let sum = 0;
  for (let i = a; i < b; i++) sum += pcm[i]! * pcm[i]!;
  return Math.sqrt(sum / (b - a));
}

/**
 * Điểm giữa của đoạn YÊN DÀI NHẤT trong [from, to) (cửa sổ 10ms).
 * Lấy giữa đoạn yên thay vì cửa sổ yên đầu tiên, để hai từ đều được đệm đủ.
 */
function quietestPoint(pcm: Int16Array, from: number, to: number, rate: number): number {
  const win = Math.max(1, Math.round(WIN_S * rate));
  if (to - from <= win) return Math.round((from + to) / 2);
  const step = Math.max(1, Math.floor(win / 2));
  const pos: number[] = [];
  const en: number[] = [];
  for (let s = from; s + win <= to; s += step) {
    pos.push(s + Math.floor(win / 2));
    en.push(rms(pcm, s, s + win));
  }
  const min = Math.min(...en);
  const max = Math.max(...en);
  const limit = min + Math.max(30, (max - min) * 0.1);
  let bestA = 0;
  let bestB = 0;
  let a = -1;
  for (let i = 0; i <= en.length; i++) {
    const quiet = i < en.length && en[i]! <= limit;
    if (quiet && a < 0) a = i;
    if (!quiet && a >= 0) {
      if (i - a > bestB - bestA) {
        bestA = a;
        bestB = i;
      }
      a = -1;
    }
  }
  return Math.round((pos[bestA]! + pos[Math.max(bestA, bestB - 1)]!) / 2);
}

export function cutWords(pcm: Int16Array, alignment: Alignment, spans: WordSpan[], rate = SAMPLE_RATE): AudioCut[] {
  const st = alignment.character_start_times_seconds;
  const en = alignment.character_end_times_seconds;
  const toS = (sec: number) => Math.max(0, Math.min(pcm.length, Math.round(sec * rate)));

  const timed = spans.map((s) => {
    const a = st[s.charStart];
    const b = en[s.charEnd - 1];
    return { span: s, start: a === undefined ? NaN : toS(a), end: b === undefined ? NaN : toS(b) };
  });

  // Ranh giới giữa từ i và i+1
  const bounds: number[] = [];
  for (let i = 0; i < timed.length - 1; i++) {
    const a = timed[i]!;
    const b = timed[i + 1]!;
    bounds.push(Number.isFinite(a.end) && Number.isFinite(b.start) ? quietestPoint(pcm, a.end, Math.max(a.end + 1, b.start), rate) : NaN);
  }

  const pad = Math.round(PAD_S * rate);
  const fade = Math.round(FADE_S * rate);
  const edge = Math.round(EDGE_S * rate);

  return timed.map((t, i) => {
    if (!Number.isFinite(t.start) || !Number.isFinite(t.end) || t.end <= t.start) {
      return { index: t.span.index, startSample: 0, endSample: 0, pcm: new Int16Array(0), edgeLoud: true, speechSeconds: 0 };
    }
    const left = i > 0 && Number.isFinite(bounds[i - 1]!) ? bounds[i - 1]! : 0;
    const right = i < bounds.length && Number.isFinite(bounds[i]!) ? bounds[i]! : pcm.length;
    const peakWord = Math.max(1, rms(pcm, t.start, t.end));
    const win = Math.max(1, Math.round(WIN_S * rate));
    const maxExt = Math.round(MAX_EXTEND_S * rate);
    let s = Math.max(left, t.start - pad);
    let e = Math.min(right, t.end + pad);
    const eLimit = Math.min(right, e + maxExt);
    while (e < eLimit && rms(pcm, e - win, e) > TAIL_RATIO * peakWord) e = Math.min(eLimit, e + win);
    const sLimit = Math.max(left, s - maxExt);
    while (s > sLimit && rms(pcm, s, s + win) > TAIL_RATIO * peakWord) s = Math.max(sLimit, s - win);
    const seg = pcm.slice(s, e);
    for (let k = 0; k < Math.min(fade, seg.length); k++) {
      const g = k / fade;
      seg[k] = Math.round(seg[k]! * g);
      seg[seg.length - 1 - k] = Math.round(seg[seg.length - 1 - k]! * g);
    }
    const peak = peakWord;
    const edgeLoud = rms(seg, fade, fade + edge) / peak > EDGE_MAX_RATIO || rms(seg, seg.length - fade - edge, seg.length - fade) / peak > EDGE_MAX_RATIO;
    return { index: t.span.index, startSample: s, endSample: e, pcm: seg, edgeLoud, speechSeconds: (t.end - t.start) / rate };
  });
}

export function encodeMp3(pcm: Int16Array, rate = SAMPLE_RATE, kbps = 64): Buffer {
  const enc = new Mp3Encoder(1, rate, kbps);
  const chunks: Buffer[] = [];
  const BLOCK = 1152;
  for (let i = 0; i < pcm.length; i += BLOCK) {
    const out = enc.encodeBuffer(pcm.subarray(i, i + BLOCK));
    if (out.length) chunks.push(Buffer.from(out.buffer, out.byteOffset, out.length));
  }
  const tail = enc.flush();
  if (tail.length) chunks.push(Buffer.from(tail.buffer, tail.byteOffset, tail.length));
  return Buffer.concat(chunks);
}

// ---------------- Gọi ElevenLabs ----------------

export interface TtsResult { pcm: Int16Array; alignment: Alignment }

export async function elevenLabsTts(text: string, opts: { apiKey: string; voiceId: string; modelId?: string; fetchImpl?: typeof fetch }): Promise<TtsResult> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}/with-timestamps?output_format=pcm_${SAMPLE_RATE}`;
  const res = await (opts.fetchImpl ?? fetch)(url, {
    method: 'POST',
    headers: { 'xi-api-key': opts.apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: opts.modelId ?? 'eleven_multilingual_v2',
      // đọc chậm (0.7 = mức chậm nhất ElevenLabs cho phép), đều, khoảng lặng rõ giữa các từ
      voice_settings: { stability: 0.75, similarity_boost: 0.75, speed: TTS_SPEED },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { audio_base64: string; alignment: Alignment | null; normalized_alignment: Alignment | null };
  const alignment = data.alignment ?? data.normalized_alignment;
  if (!alignment) throw new Error('ElevenLabs không trả mốc thời gian');
  return { pcm: pcmFromBase64(data.audio_base64), alignment };
}

/**
 * Tạo mp3 cho danh sách từ: mỗi đoạn ≤25 từ là MỘT lần gọi (20 từ = 1 lần, 40 từ = 2 lần).
 * Trả về mp3 theo thứ tự + vị trí các từ cần tạo lại riêng. Đoạn nào lỗi thì cả đoạn vào danh sách tạo lại.
 */
export async function audioForWords(
  words: string[],
  tts: (text: string) => Promise<TtsResult>,
  chunkSize = CHUNK_WORDS,
): Promise<{ mp3: (Buffer | null)[]; redo: number[]; calls: number }> {
  const mp3: (Buffer | null)[] = new Array(words.length).fill(null);
  const redo: number[] = [];
  let calls = 0;
  for (let start = 0; start < words.length; start += chunkSize) {
    const part = words.slice(start, start + chunkSize);
    calls++;
    try {
      const { text, spans } = buildScript(part);
      const { pcm, alignment } = await tts(text);
      for (const c of cutWords(pcm, alignment, spans)) {
        const at = start + c.index;
        if (c.edgeLoud || c.speechSeconds < 0.15) redo.push(at);
        else mp3[at] = encodeMp3(c.pcm);
      }
    } catch {
      part.forEach((_, i) => redo.push(start + i));
    }
  }
  return { mp3, redo, calls };
}

/** Một từ lẻ (tạo lại): gọi riêng, cắt bỏ khoảng lặng hai đầu theo alignment */
export async function audioForSingleWord(word: string, tts: (text: string) => Promise<TtsResult>): Promise<Buffer> {
  const { text, spans } = buildScript([word]);
  const { pcm, alignment } = await tts(text);
  const [cut] = cutWords(pcm, alignment, spans);
  if (!cut || !cut.pcm.length) throw new Error(`Không tìm thấy "${word}" trong audio`);
  return encodeMp3(cut.pcm);
}
