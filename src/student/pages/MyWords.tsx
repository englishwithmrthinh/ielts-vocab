// Kho từ của tôi (/hoc/kho-tu): tìm, lọc theo hộp/buổi, bấm xem thẻ từ, Thêm từ → "Chờ duyệt".
import { Clock3, ImageIcon, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { Box, MyWordsResponse } from '@shared/types';
import { errorText, studentApi } from '../api';
import { Button, Card, Spinner, Tag, cx } from '../components/ui';
import { WordCardView } from '../components/WordCardView';
import Infographic from '../../shared-ui/Infographic';
import { COPY } from '../lib/copy';

type Word = MyWordsResponse['words'][number];
type BoxFilter = 'all' | Box;

const BOX_LABEL: Record<Box, string> = { 1: 'H1', 2: 'H2', 3: 'H3', 4: 'H4', 5: 'H5', 6: 'Đã thuộc' };

/** Khung đáy màn hình (bottom sheet) */
function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose} role="dialog" aria-modal="true" aria-label={label}>
      <div
        className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-page p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-[fadeIn_.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex justify-end">
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-xl p-2 text-ink-2 hover:bg-surface-2">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function MyWords() {
  const [d, setD] = useState<MyWordsResponse | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [box, setBox] = useState<BoxFilter>('all');
  const [lesson, setLesson] = useState<number | 'all'>('all');
  const [open, setOpen] = useState<Word | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');
  const [hideMeaning, setHideMeaning] = useState(false);

  const load = () => studentApi.myWords().then(setD).catch((e: unknown) => setErr(errorText(e)));
  useEffect(() => {
    void load();
  }, []);

  const lessons = useMemo(
    () => [...new Set((d?.words ?? []).map((w) => w.lessonNumber).filter((n): n is number => n != null))].sort((a, b) => a - b),
    [d],
  );

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (d?.words ?? [])
      .filter((w) => box === 'all' || w.box === box)
      .filter((w) => lesson === 'all' || w.lessonNumber === lesson)
      .filter((w) => !t || w.word.toLowerCase().includes(t) || w.meaningVi.toLowerCase().includes(t))
      .sort((a, b) => a.word.localeCompare(b.word));
  }, [d, q, box, lesson]);

  if (err) return <p className="p-6 text-center text-bad-ink">{err}</p>;
  if (!d)
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Spinner />
      </div>
    );

  const count = (b: BoxFilter) => (b === 'all' ? d.words.length : d.words.filter((w) => w.box === b).length);

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-[22px] font-bold">Kho từ của tôi</h1>
        <Button size="md" className="h-10 px-3 text-sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden /> Thêm từ
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm từ hoặc nghĩa"
          aria-label="Tìm từ"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-12 w-full rounded-2xl border-2 border-line bg-surface pl-11 pr-4 text-base text-ink outline-none focus:border-brand"
          style={{ fontSize: 16 }}
        />
      </div>

      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Lọc theo hộp">
        {(['all', 1, 2, 3, 4, 5, 6] as BoxFilter[]).map((b) => (
          <button
            key={String(b)}
            type="button"
            role="tab"
            aria-selected={box === b}
            onClick={() => setBox(b)}
            className={cx(
              'shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition',
              box === b ? 'bg-primary text-white' : 'bg-surface text-ink-2 ring-1 ring-line',
            )}
          >
            {b === 'all' ? 'Tất cả' : BOX_LABEL[b]} <span className="opacity-70">{count(b)}</span>
          </button>
        ))}
      </div>

      {lessons.length > 0 && (
        <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1" aria-label="Lọc theo buổi">
          {(['all', ...lessons] as (number | 'all')[]).map((n) => (
            <button
              key={String(n)}
              type="button"
              onClick={() => setLesson(n)}
              aria-pressed={lesson === n}
              className={cx(
                'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition',
                lesson === n ? 'bg-brand-tint text-brand-ink ring-1 ring-brand' : 'text-ink-2 ring-1 ring-line',
              )}
            >
              {n === 'all' ? 'Mọi buổi' : `Buổi ${n}`}
            </button>
          ))}
        </div>
      )}

      {lesson !== 'all' && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-2">
              <ImageIcon className="size-4 text-brand" aria-hidden /> Infographic buổi {lesson}
            </h2>
            <button
              type="button"
              onClick={() => setHideMeaning((v) => !v)}
              aria-pressed={hideMeaning}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-ink ring-1 ring-line"
            >
              {hideMeaning ? 'Hiện nghĩa' : 'Che nghĩa để tự kiểm tra'}
            </button>
          </div>
          <div className="overflow-hidden rounded-[var(--radius-card)] bg-surface p-2 shadow-[var(--shadow-card)]">
            <Infographic
              title={`Buổi ${lesson}`}
              hideMeaning={hideMeaning}
              items={d.words
                .filter((w) => w.lessonNumber === lesson)
                .map((w) => ({ id: w.wordId, word: w.word, meaningVi: w.meaningVi, imageUrl: w.imageUrl, pos: w.pos }))}
              onSelect={(it) => {
                const w = d.words.find((x) => x.wordId === it.id);
                if (w) setOpen(w);
              }}
            />
          </div>
        </div>
      )}

      {d.pending.length > 0 && box === 'all' && lesson === 'all' && !q && (
        <div className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-ink-2">Từ bạn đề xuất</h2>
          <ul className="space-y-1.5">
            {d.pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
                <div className="min-w-0">
                  <p className="font-semibold">{p.text}</p>
                  {p.note && <p className="truncate text-xs text-ink-3">{p.note}</p>}
                </div>
                <Tag tone="mid">
                  <Clock3 className="size-3.5" aria-hidden /> Chờ duyệt
                </Tag>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-4 space-y-1.5">
        {list.map((w) => (
          <li key={w.wordId}>
            <button
              type="button"
              onClick={() => setOpen(w)}
              className="flex w-full items-center gap-3 rounded-2xl bg-surface px-3 py-2.5 text-left shadow-[var(--shadow-card)] active:bg-brand-wash"
            >
              {w.imageUrl ? (
                <img src={w.imageUrl} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="size-11 shrink-0 rounded-xl bg-brand-tint" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{w.word}</span>
                <span className="block truncate text-sm text-ink-2">{w.meaningVi}</span>
              </span>
              <Tag tone={w.box === 6 ? 'ok' : 'brand'}>{BOX_LABEL[w.box]}</Tag>
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-8 text-center text-sm text-ink-3">{d.words.length ? COPY.empty.my_words_search_empty : COPY.empty.no_words_yet}</li>
        )}
      </ul>

      {open && (
        <Sheet onClose={() => setOpen(null)} label={`Thẻ từ ${open.word}`}>
          <WordCardView card={open} big />
          <p className="mt-3 text-center text-sm text-ink-2">
            {open.box === 6 ? 'Bạn đã thuộc từ này.' : `Đang ở ${BOX_LABEL[open.box].replace('H', 'Hộp ')}.`}
            {open.lessonNumber != null && ` · Buổi ${open.lessonNumber}`}
          </p>
        </Sheet>
      )}

      {adding && (
        <Sheet onClose={() => setAdding(false)} label="Thêm từ">
          <AddWordForm
            onDone={(msg) => {
              setAdding(false);
              setToast(msg);
              setTimeout(() => setToast(''), 3500);
              void load();
            }}
          />
        </Sheet>
      )}

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-30 mx-auto max-w-md rounded-2xl bg-ink px-4 py-3 text-center text-sm font-medium text-page shadow-lg animate-[fadeIn_.2s_ease-out]">
          {toast}
        </div>
      )}
    </div>
  );
}

function AddWordForm({ onDone }: { onDone: (msg: string) => void }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setErr('Nhập từ bạn muốn học trước nhé.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await studentApi.addWord(text, note.trim() || null);
      onDone(r.status === 'linked' ? `Đã thêm "${text.trim()}" vào kho của bạn.` : `Đã gửi "${text.trim()}" cho cô duyệt.`);
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="text-lg font-bold">Thêm từ muốn học</h2>
      <p className="text-sm text-ink-2">Từ đã có trong kho của lớp sẽ được thêm ngay. Từ mới sẽ chờ cô duyệt rồi vào buổi học sau.</p>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-2">Từ / cụm từ</span>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErr('');
          }}
          placeholder="sustainable"
          autoFocus
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-12 w-full rounded-2xl border-2 border-line bg-surface px-4 text-ink outline-none focus:border-brand"
          style={{ fontSize: 16 }}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-2">Ghi chú (không bắt buộc)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Gặp trong bài đọc Unit 3"
          className="h-12 w-full rounded-2xl border-2 border-line bg-surface px-4 text-ink outline-none focus:border-brand"
          style={{ fontSize: 16 }}
        />
      </label>
      {err && (
        <p role="alert" className="text-sm text-bad-ink">
          {err}
        </p>
      )}
      <Button type="submit" block size="lg" disabled={busy}>
        {busy ? <Spinner className="size-5 border-white/40 border-t-white" /> : 'Gửi'}
      </Button>
    </form>
  );
}
