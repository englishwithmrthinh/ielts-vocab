/** Khu "Ảnh minh hoạ" vẽ tay: prompt điền sẵn + Copy + Tải ảnh lên (lưới và ảnh lẻ). */
import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { Word } from '@shared/types';
import { adminApi, type GridTask } from '../lib/adminApi';
import { copyText, prepareImage } from '../lib/imageFile';
import { Button, Card, ErrorBox } from '../ui';

export function PromptBox({ prompt }: { prompt: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState<'ok' | 'manual' | null>(null);
  const copy = async () => {
    const ok = await copyText(prompt);
    if (!ok) ref.current?.select();
    setCopied(ok ? 'ok' : 'manual');
    setTimeout(() => setCopied(null), 2500);
  };
  return (
    <div>
      <textarea ref={ref} readOnly rows={6} value={prompt} className="w-full resize-y rounded-lg bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200" />
      <div className="mt-2 flex items-center gap-3">
        <Button variant="secondary" onClick={copy}>Copy prompt</Button>
        {copied === 'ok' && <span className="text-sm text-teal-700">Đã copy ✓</span>}
        {copied === 'manual' && <span className="text-sm text-amber-700">Đã chọn sẵn — bấm Ctrl+C (Cmd+C) để copy</span>}
      </div>
    </div>
  );
}

export function UploadZone({ label, onFile, busy }: { label: string; onFile: (dataUrl: string) => Promise<void>; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    try {
      await onFile(await prepareImage(file));
    } catch (e) {
      setErr(e);
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    handle(e.dataTransfer.files[0]);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-center transition ${
          over ? 'border-teal-500 bg-teal-50' : 'border-slate-300 bg-white'
        }`}
      >
        <Button disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Đang cắt ảnh…' : label}</Button>
        <p className="text-xs text-slate-500">hoặc kéo thả ảnh vào đây · PNG, JPG, WEBP</p>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      </div>
      <div className="mt-2"><ErrorBox error={err} /></div>
    </div>
  );
}

/** Mỗi lưới của buổi: prompt + tải ảnh lên */
export function ImagesSection({ lessonId, words, onUploaded }: { lessonId: string; words: Word[]; onUploaded: () => void }) {
  const [grids, setGrids] = useState<GridTask[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [result, setResult] = useState<Record<number, { ok: boolean; text: string }>>({});
  const missing = words.filter((w) => !w.image_url).length;
  const [open, setOpen] = useState(missing > 0);

  useEffect(() => {
    adminApi.imagePrompts(lessonId).then((r) => setGrids(r.grids), setError);
  }, [lessonId]);

  const upload = (g: GridTask) => async (dataUrl: string) => {
    setBusy(g.index);
    setResult((r) => ({ ...r, [g.index]: { ok: true, text: '' } }));
    try {
      const r = await adminApi.uploadGrid(lessonId, g.index, dataUrl);
      setResult((x) => ({ ...x, [g.index]: { ok: true, text: `Đã cắt lưới ${r.layout} thành ${r.updated} ảnh. Kiểm tra từng thẻ bên dưới.` } }));
      onUploaded();
    } catch (e) {
      setResult((x) => ({ ...x, [g.index]: { ok: false, text: (e as Error).message } }));
    } finally {
      setBusy(null);
    }
  };

  const byId = new Map(words.map((w) => [w.id, w]));

  return (
    <Card>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="font-semibold text-slate-900">Ảnh minh hoạ</span>
          <span className="ml-2 text-sm text-slate-500">{missing ? `${missing}/${words.length} từ chưa có ảnh` : 'Đủ ảnh'}</span>
        </span>
        <span className="text-sm text-teal-700">{open ? 'Thu gọn' : 'Mở'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-5">
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-200">
            Copy prompt → dán vào app Gemini → tải ảnh về → bấm <b>Tải ảnh lên</b>. Hệ thống tự tìm rãnh trắng và cắt thành ảnh từng từ.
          </p>
          <ErrorBox error={error} />
          {!grids && !error && <p className="text-sm text-slate-500">Đang chuẩn bị prompt…</p>}
          {grids?.map((g) => (
            <div key={g.index} className="space-y-3 border-t border-slate-100 pt-4 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium text-slate-800">
                  {grids.length > 1 ? `Lưới ${g.index + 1}/${grids.length}` : 'Lưới ảnh'} · {g.cols}×{g.rows} ({g.count} ô)
                </h3>
                <span className="text-xs text-slate-500">
                  Từ {g.wordIds.map((id) => byId.get(id)?.word).filter(Boolean).slice(0, 3).join(', ')}
                  {g.count > 3 ? '…' : ''}
                </span>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
                <PromptBox prompt={g.prompt} />
                <UploadZone label="Tải ảnh lên" busy={busy === g.index} onFile={upload(g)} />
              </div>
              {result[g.index]?.text && (
                <p className={`rounded-lg px-3 py-2 text-sm ring-1 ${result[g.index]!.ok ? 'bg-teal-50 text-teal-900 ring-teal-200' : 'bg-red-50 text-red-800 ring-red-200'}`}>
                  {result[g.index]!.text}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Hộp "Vẽ lại ảnh từ này": prompt ảnh lẻ + tải lên */
export function SingleImageDialog({ word, onClose, onDone }: { word: Word; onClose: () => void; onDone: (w: Word) => void }) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.singlePrompt(word.id).then((r) => setPrompt(r.prompt), setError);
  }, [word.id]);

  const upload = async (dataUrl: string) => {
    setBusy(true);
    try {
      onDone((await adminApi.uploadSingle(word.id, dataUrl)).word);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Vẽ lại ảnh “{word.word}”</h2>
            <p className="mt-1 text-sm text-slate-600">Copy prompt → dán vào app Gemini → tải ảnh về → Tải ảnh lên. Ảnh được cắt vuông ở giữa.</p>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Đóng">✕</Button>
        </div>
        <div className="mt-4 space-y-3">
          <ErrorBox error={error} />
          {prompt ? <PromptBox prompt={prompt} /> : !error && <p className="text-sm text-slate-500">Đang chuẩn bị prompt…</p>}
          <UploadZone label="Tải ảnh lên" busy={busy} onFile={upload} />
        </div>
      </div>
    </div>
  );
}
