import { describe, expect, it } from 'vitest';
import { audioForWords, buildScript, cutWords, encodeMp3, SAMPLE_RATE, type Alignment, type TtsResult } from './audio';

/**
 * Giả lập ElevenLabs: mỗi ký tự 70ms tiếng (sóng sin), dấu chấm + cách = 350ms lặng.
 * Mỗi từ một tần số riêng để kiểm tra không dính âm từ bên cạnh.
 */
function fakeTts(text: string, opts: { jitterMs?: number } = {}): TtsResult & { wordFreq: number[] } {
  const rate = SAMPLE_RATE;
  const chars = [...text];
  const starts: number[] = [];
  const ends: number[] = [];
  const samples: number[] = [];
  let t = 0.2; // lặng đầu
  for (let i = 0; i < Math.round(t * rate); i++) samples.push(0);
  let word = 0;
  const wordFreq: number[] = [];
  for (const ch of chars) {
    const silent = ch === '.' || ch === ' ';
    const dur = ch === '.' ? 0.3 : ch === ' ' ? 0.05 : 0.07;
    starts.push(t);
    const f = 300 + word * 40;
    if (!silent && wordFreq[word] === undefined) wordFreq[word] = f;
    const n = Math.round(dur * rate);
    for (let i = 0; i < n; i++) samples.push(silent ? 0 : Math.round(9000 * Math.sin((2 * Math.PI * f * (samples.length)) / rate)));
    t += dur;
    // alignment của ElevenLabs hơi lệch so với âm thật
    ends.push(t - (opts.jitterMs ?? 0) / 1000);
    if (ch === ' ') word++;
  }
  for (let i = 0; i < 0.2 * rate; i++) samples.push(0);
  const alignment: Alignment = { characters: chars, character_start_times_seconds: starts, character_end_times_seconds: ends };
  return { pcm: Int16Array.from(samples), alignment, wordFreq };
}

describe('buildScript', () => {
  it('ghép từ bằng dấu chấm và nhớ vị trí ký tự', () => {
    const { text, spans } = buildScript(['environment', 'give up']);
    expect(text).toBe('environment. give up.');
    expect(text.slice(spans[1]!.charStart, spans[1]!.charEnd)).toBe('give up');
  });
});

describe('cutWords', () => {
  const words = Array.from({ length: 20 }, (_, i) => `word${String.fromCharCode(97 + i)}`);

  it('cắt 20 từ, không đoạn nào chồng sang từ bên cạnh', () => {
    const { text, spans } = buildScript(words);
    const tts = fakeTts(text);
    const cuts = cutWords(tts.pcm, tts.alignment, spans);
    expect(cuts).toHaveLength(20);
    for (let i = 1; i < cuts.length; i++) {
      expect(cuts[i]!.startSample).toBeGreaterThanOrEqual(cuts[i - 1]!.endSample);
    }
    expect(cuts.filter((c) => c.edgeLoud)).toHaveLength(0);
    // có đệm: đoạn dài hơn phần lời nói
    expect(cuts[5]!.pcm.length / SAMPLE_RATE).toBeGreaterThan(cuts[5]!.speechSeconds + 0.1);
  });

  it('alignment lệch 40ms vẫn không dính từ bên cạnh', () => {
    const { text, spans } = buildScript(words);
    const tts = fakeTts(text, { jitterMs: 40 });
    const cuts = cutWords(tts.pcm, tts.alignment, spans);
    for (let i = 1; i < cuts.length; i++) expect(cuts[i]!.startSample).toBeGreaterThanOrEqual(cuts[i - 1]!.endSample);
  });

  it('gắn cờ khi hai từ dính liền (không có khoảng lặng)', () => {
    const { text, spans } = buildScript(['alpha', 'beta']);
    const tts = fakeTts(text);
    // xoá khoảng lặng: lấp tiếng vào giữa
    tts.pcm.fill(8000, Math.round(0.55 * SAMPLE_RATE), Math.round(0.9 * SAMPLE_RATE));
    const cuts = cutWords(tts.pcm, tts.alignment, spans);
    expect(cuts.some((c) => c.edgeLoud)).toBe(true);
  });
});

describe('audioForWords + encodeMp3', () => {
  it('ra mp3 hợp lệ cho từng từ', async () => {
    const words = ['environment', 'renewable', 'emission'];
    const res = await audioForWords(words, async (t) => fakeTts(t));
    expect(res.redo).toEqual([]);
    for (const m of res.mp3) {
      expect(m).not.toBeNull();
      // khung mp3 bắt đầu bằng 0xFFE (sync word)
      expect(m![0]).toBe(0xff);
      expect(m![1]! & 0xe0).toBe(0xe0);
    }
  });

  it('mã hoá được đoạn rất ngắn', () => {
    expect(encodeMp3(new Int16Array(100)).length).toBeGreaterThan(0);
  });
});
