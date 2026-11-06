/**
 * Background Function: tạo lại audio hoặc vẽ lại ảnh cho MỘT từ (nút ở màn Duyệt).
 * POST /api/admin/pipeline/word { word_id, what: 'audio' | 'image' }
 * Màn Duyệt đọc lại từ đó cho tới khi audio_url / image_url đổi.
 */
import type { Config } from '@netlify/functions';
import type { Word } from '../../../shared/types';
import { requireAdmin } from '../../lib/auth';
import { readJson } from '../../lib/http';
import { db, must } from '../../lib/supabase';
import { audioForSingleWord } from '../pipeline-run-background/audio';
import { toCell } from '../pipeline-run-background/grid';
import { geminiImage, singlePrompt, ttsFromEnv, upload } from '../pipeline-run-background/lib';

export default async (req: Request): Promise<void> => {
  try {
    requireAdmin(req);
    const { word_id, what } = await readJson<{ word_id?: string; what?: string }>(req);
    if (!word_id || (what !== 'audio' && what !== 'image')) return;
    const w = must(await db().from('words').select('*').eq('id', word_id).single()) as Word;
    if (what === 'audio') {
      const mp3 = await audioForSingleWord(w.word, ttsFromEnv());
      must(await db().from('words').update({ audio_url: await upload(`audio/${w.id}.mp3`, mp3, 'audio/mpeg') }).eq('id', w.id));
    } else {
      const img = await geminiImage(singlePrompt(w), '1:1');
      must(await db().from('words').update({ image_url: await upload(`images/${w.id}.webp`, await toCell(img), 'image/webp') }).eq('id', w.id));
    }
  } catch (e) {
    console.error('pipeline-word lỗi', e);
  }
};

export const config: Config = { path: '/api/admin/pipeline/word' };
