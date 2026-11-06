/**
 * Chạy pipeline cho một buổi: phiên âm → audio → ảnh. Chỉ tạo phần CÒN THIẾU,
 * nên chạy lại an toàn (từ dùng lại từ kho đã có media thì bỏ qua).
 * Lỗi ở từ nào thì ghi nhật ký và chạy tiếp, không dừng cả buổi.
 *
 * Tiết kiệm credit Netlify (tính theo GB-giờ): mọi việc chờ mạng chạy song song
 * có giới hạn, không vòng chờ, ghi DB theo bước chứ không theo từng từ.
 */
import type { Word } from '../../../shared/types';
import { gridPlan } from '../../../src/admin/lib/lessonSchema';
import { db, must } from '../../lib/supabase';
import { audioForSingleWord, audioForWords, type TtsResult } from './audio';
import { cutCells, detectGrid, toCell, toInfographic } from './grid';
import { aspectFor, geminiImage, gridPrompt, lookupIpa, mapLimit, PipelineLog, singlePrompt, upload } from './lib';

export interface PipelineDeps {
  tts: (text: string) => Promise<TtsResult>;
  image: (prompt: string, aspect: string) => Promise<Buffer>;
  ipa: (word: string) => Promise<string | null>;
  upload: (path: string, body: Buffer, type: string) => Promise<string>;
}

export const realDeps = (tts: PipelineDeps['tts']): PipelineDeps => ({
  tts,
  image: (p, a) => geminiImage(p, a),
  ipa: (w) => lookupIpa(w),
  upload,
});

export interface GridStats { grids: number; firstTry: number; redrawn: number; fellBackToSingles: number }
export interface PipelineSummary { words: number; ipaDict: number; audioMade: number; audioRedo: number; imagesMade: number; errors: number; grid: GridStats }

type W = Pick<Word, 'id' | 'word' | 'ipa' | 'ipa_source' | 'audio_url' | 'image_url' | 'image_hint' | 'meaning_vi'>;

async function lessonWords(lessonId: string): Promise<W[]> {
  const rows = must(
    await db().from('lesson_words').select('position, words(id,word,ipa,ipa_source,audio_url,image_url,image_hint,meaning_vi)').eq('lesson_id', lessonId).order('position'),
  ) as unknown as { position: number; words: W }[];
  return rows.map((r) => r.words);
}

async function setWord(id: string, patch: Partial<Word>) {
  must(await db().from('words').update(patch).eq('id', id));
}

export async function runPipeline(lessonId: string, deps: PipelineDeps): Promise<PipelineSummary> {
  const lesson = must(await db().from('lessons').select('id,status').eq('id', lessonId).single()) as { id: string; status: string };
  if (lesson.status === 'published') throw new Error('Buổi đã phát hành, không chạy lại pipeline');

  const log = new PipelineLog(lessonId);
  const words = await lessonWords(lessonId);
  const sum: PipelineSummary = { words: words.length, ipaDict: 0, audioMade: 0, audioRedo: 0, imagesMade: 0, errors: 0, grid: { grids: 0, firstTry: 0, redrawn: 0, fellBackToSingles: 0 } };
  const fail = (step: 'ipa' | 'audio' | 'image', w: W | null, e: unknown) => {
    sum.errors++;
    log.add('error', `${step}${w ? ` "${w.word}"` : ''}: ${(e as Error).message ?? e}`, w?.id);
  };

  log.add('validate', `Bắt đầu: ${words.length} từ`);
  await log.flush({ status: 'processing' });

  // 1. Phiên âm
  const needIpa = words.filter((w) => w.ipa_source !== 'dict');
  await mapLimit(needIpa, 5, async (w) => {
    try {
      const ipa = await deps.ipa(w.word);
      if (ipa) {
        await setWord(w.id, { ipa, ipa_source: 'dict' });
        sum.ipaDict++;
      } else if (w.ipa) {
        await setWord(w.id, { ipa_source: 'ai' });
      }
    } catch (e) {
      fail('ipa', w, e);
    }
  });
  log.add('ipa', `Phiên âm: ${sum.ipaDict}/${needIpa.length} từ tra được từ điển, còn lại giữ bản AI`);
  await log.flush();

  // 2. Audio: một lần gọi cho cả buổi, từ nào cắt không sạch thì tạo lại riêng
  const needAudio = words.filter((w) => !w.audio_url);
  if (needAudio.length) {
    let redo: number[] = needAudio.map((_, i) => i);
    try {
      const res = await audioForWords(needAudio.map((w) => w.word), deps.tts);
      redo = res.redo;
      await mapLimit(needAudio, 5, async (w, i) => {
        const mp3 = res.mp3[i];
        if (!mp3) return;
        try {
          await setWord(w.id, { audio_url: await deps.upload(`audio/${w.id}.mp3`, mp3, 'audio/mpeg') });
          sum.audioMade++;
        } catch (e) {
          fail('audio', w, e);
        }
      });
    } catch (e) {
      fail('audio', null, e);
    }
    sum.audioRedo = redo.length;
    await mapLimit(redo, 3, async (i) => {
      const w = needAudio[i]!;
      try {
        const mp3 = await audioForSingleWord(w.word, deps.tts);
        await setWord(w.id, { audio_url: await deps.upload(`audio/${w.id}.mp3`, mp3, 'audio/mpeg') });
        sum.audioMade++;
      } catch (e) {
        fail('audio', w, e);
      }
    });
  }
  log.add('audio', `Audio: tạo ${sum.audioMade}/${needAudio.length} từ (${sum.audioRedo} từ phải tạo lại riêng)`);
  await log.flush();

  // 3. Ảnh: lưới cho CẢ buổi (để infographic đủ ô), chỉ ghi ảnh cho từ chưa có
  const infographics: string[] = [];
  if (words.some((w) => !w.image_url)) {
    let offset = 0;
    for (const [gi, plan] of gridPlan(words.length).entries()) {
      const group = words.slice(offset, offset + plan.count);
      offset += plan.count;
      sum.grid.grids++;
      const spec = { cols: plan.cols, rows: plan.rows };
      let cells: Buffer[] | null = null;
      for (let attempt = 0; attempt < 2 && !cells; attempt++) {
        try {
          const img = await deps.image(gridPrompt(group, plan.cols, plan.rows), aspectFor(plan.cols, plan.rows));
          const grid = await detectGrid(img, spec);
          if (grid.ok) {
            cells = await cutCells(img, grid, group.length);
            infographics.push(await deps.upload(`infographic/${lessonId}-${gi + 1}.webp`, await toInfographic(img), 'image/webp'));
            if (attempt === 0) sum.grid.firstTry++;
            else sum.grid.redrawn++;
          } else {
            log.add('image', `Lưới ${gi + 1} lần ${attempt + 1}: ${grid.reason}`);
          }
        } catch (e) {
          log.add('image', `Lưới ${gi + 1} lần ${attempt + 1} lỗi: ${(e as Error).message}`);
        }
      }
      const missing = group.filter((w) => !w.image_url);
      if (cells) {
        await mapLimit(group, 5, async (w, i) => {
          if (w.image_url) return;
          try {
            await setWord(w.id, { image_url: await deps.upload(`images/${w.id}.webp`, cells![i]!, 'image/webp') });
            sum.imagesMade++;
          } catch (e) {
            fail('image', w, e);
          }
        });
      } else {
        sum.grid.fellBackToSingles++;
        log.add('image', `Lưới ${gi + 1}: chuyển sang vẽ ${missing.length} ảnh lẻ`);
        await mapLimit(missing, 3, async (w) => {
          try {
            const img = await deps.image(singlePrompt(w), '1:1');
            await setWord(w.id, { image_url: await deps.upload(`images/${w.id}.webp`, await toCell(img), 'image/webp') });
            sum.imagesMade++;
          } catch (e) {
            fail('image', w, e);
          }
        });
      }
      await log.flush();
    }
  }
  log.add('image', `Ảnh: ${sum.imagesMade} ảnh mới · lưới đạt lần đầu ${sum.grid.firstTry}/${sum.grid.grids}, vẽ lại ${sum.grid.redrawn}, chuyển ảnh lẻ ${sum.grid.fellBackToSingles}`);

  log.add('done', `Xong${sum.errors ? `, ${sum.errors} lỗi — xem và tạo lại ở màn Duyệt` : ''}`);
  await log.flush({ status: 'review', ...(infographics.length ? { infographic_urls: infographics } : {}) });
  return sum;
}
