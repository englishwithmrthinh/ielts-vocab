// Kho từ của tôi (/hoc/kho-tu): kệ sách theo hộp, tìm kiếm, mỗi từ một dòng kiểu từ điển,
// bấm xem thẻ từ, xem dạng bảng ảnh (Infographic), Thêm từ → "Chờ duyệt".
// URL: ?hop=1..6 lọc theo hộp (từ kệ sách trang chủ), ?them=1 mở form thêm từ.
import { Clock3, LayoutGrid, List, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Box, MyWordsResponse } from '@shared/types';
import { errorText, studentApi } from '../api';
import { ART, Spot } from '../components/Art';
import { BookCover, SHELF } from '../components/BookCover';
import { Button, Card, SectionTitle, Spinner, Tag, cx } from '../components/ui';
import { POS_VI, WordCardView } from '../components/WordCardView';
import { WordGrid } from '../components/WordGrid';
import { COPY } from '../lib/copy';

type Word = MyWordsResponse['words'][number];

const BOX_LABEL: Record<Box, string> = { 1: 'Hộp 1', 2: 'Hộp 2', 3: 'Hộp 3', 4: 'Hộp 4', 5: 'Hộp 5', 6: 'Đã thuộc' };

/** Khung đáy màn hình (bottom sheet) — trên máy tính là hộp thoại giữa màn */
function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 lg:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label={label}>
      <div
        className="max-h-[88dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl bg-page p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-[fadeIn_.2s_ease-out] lg:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex justify-end">
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-full p-2 text-ink-2 hover:bg-surface-2">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function MyWords() {
  const [params, setParams] = useSearchParams();
  const [d, setD] = useState<MyWordsResponse | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [open, setOpen] = useState<Word | null>(null);
  const [toast, setToast] = useState('');
  const [hideMeaning, setHideMeaning] = useState(false);

  const hop = Number(params.get('hop'));
  const box: Box | null = hop >= 1 && hop <= 6 ? (hop as Box) : null;
  const adding = params.get('them') === '1';
  const setParam = (k: string, v: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (v == null) n.delete(k);
        else n.set(k, v);
        return n;
      },
      { replace: true },
    );

  const load = () => studentApi.myWords().then(setD).catch((e: unknown) => setErr(errorText(e)));
  useEffect(() => {
    void load();
  }, []);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (d?.words ?? [])
      .filter((w) => box == null || w.box === box)
      .filter((w) => !t || w.word.toLowerCase().includes(t) || w.meaningVi.toLowerCase().includes(t))
      .sort((a, b) => a.word.localeCompare(b.word));
  }, [d, q, box]);

  if (err) return <p className="p-6 text-center text-bad-ink">{err}</p>;
  if (!d)
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Spinner />
      </div>
    );

  const count = (b: Box) => d.words.filter((w) => w.box === b).length;

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] lg:px-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <SectionTitle as="h1" className="!mb-0">
          Kho từ của tôi
        </SectionTitle>
        <Button variant="accent" className="h-10 shrink-0 whitespace-nowrap px-3" onClick={() => setParam('them', '1')}>
          <Plus className="size-4" aria-hidden /> Thêm
        </Button>
      </div>

      <Card>
        <SectionTitle aside={box ? 'Chạm lại để bỏ lọc' : `${d.words.length} từ`}>Kệ sách</SectionTitle>
        <div className="grid grid-cols-6 gap-2 sm:gap-3" role="tablist" aria-label="Lọc theo hộp">
          {SHELF.map((b) => {
            const on = box === b.box;
            return (
              <div key={b.key} role="tab" aria-selected={on} className={cx('transition', box && !on && 'opacity-45')}>
                <BookCover
                  title={b.key === 'pass' ? '' : b.key}
                  tone={b.tone}
                  emblem={b.emblem}
                  onClick={() => setParam('hop', on ? null : String(b.box))}
                  label={`${b.title}: ${count(b.box)} từ${on ? ' (đang lọc)' : ''}`}
                  className={cx(on && '-translate-y-1 ring-2 ring-gold ring-offset-2 ring-offset-surface')}
                />
                <p className="mt-1.5 text-center text-[11px] font-semibold leading-tight text-ink-2">
                  {b.title}
                  <span className="block font-normal text-ink-3">{count(b.box)}</span>
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm từ hoặc nghĩa"
            aria-label="Tìm từ"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-base text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
            style={{ fontSize: 16 }}
          />
        </div>
        <div className="flex rounded-xl bg-surface-2 p-1 ring-1 ring-line" role="group" aria-label="Cách xem">
          {(
            [
              ['list', List, 'Danh sách'],
              ['board', LayoutGrid, 'Bảng ảnh'],
            ] as const
          ).map(([v, Icon, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              aria-label={label}
              title={label}
              onClick={() => setView(v)}
              className={cx('flex w-10 items-center justify-center rounded-lg transition', view === v ? 'bg-surface text-brand-ink shadow-sm' : 'text-ink-3')}
            >
              <Icon className="size-5" strokeWidth={1.6} aria-hidden />
            </button>
          ))}
        </div>
      </div>

      {box && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-2">
          Đang xem <Tag tone={box === 6 ? 'ok' : 'brand'}>{BOX_LABEL[box]}</Tag>
          <button type="button" onClick={() => setParam('hop', null)} className="text-sm font-semibold text-brand-ink underline underline-offset-2">
            Xem tất cả
          </button>
        </p>
      )}

      {d.pending.length > 0 && !box && !q && (
        <div className="mt-4">
          <p className="label-caps mb-2 text-ink-3">Từ bạn đề xuất</p>
          <ul className="space-y-1.5">
            {d.pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface px-4 py-3 ring-1 ring-line">
                <div className="min-w-0">
                  <p className="font-serif text-[20px] font-bold leading-tight">{p.text}</p>
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

      {view === 'board' && list.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setHideMeaning((v) => !v)}
              aria-pressed={hideMeaning}
              className="rounded-full px-3 py-1 text-xs font-semibold text-brand-ink ring-1 ring-line"
            >
              {hideMeaning ? 'Hiện nghĩa' : 'Che nghĩa để tự kiểm tra'}
            </button>
          </div>
          <WordGrid words={list} hideMeaning={hideMeaning} onOpen={setOpen} />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)] ring-1 ring-line">
          {list.map((w) => (
            <li key={w.wordId}>
              <button type="button" onClick={() => setOpen(w)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-brand-wash">
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="font-serif text-[22px] font-bold leading-tight text-ink">{w.word}</span>
                    <span className="shrink-0 font-serif text-[15px] italic text-accent">{POS_VI[w.pos]}</span>
                  </span>
                  <span className="block truncate text-sm text-ink-2">{w.meaningVi}</span>
                </span>
                <Tag tone={w.box === 6 ? 'ok' : 'brand'}>{BOX_LABEL[w.box]}</Tag>
              </button>
            </li>
          ))}
          {list.length === 0 && (
            <li className="flex flex-col items-center px-4 py-8 text-center">
              <Spot src={ART.emptyShelf} className="w-28" />
              <p className="mt-2 text-sm text-ink-3">{d.words.length ? COPY.empty.my_words_search_empty : COPY.empty.no_words_yet}</p>
            </li>
          )}
        </ul>
      )}

      {open && (
        <Sheet onClose={() => setOpen(null)} label={`Thẻ từ ${open.word}`}>
          <WordCardView card={open} variant="detail" />
          <p className="mt-2 text-center text-sm text-ink-2">{open.box === 6 ? 'Bạn đã thuộc từ này.' : `Đang ở ${BOX_LABEL[open.box]}.`}</p>
        </Sheet>
      )}

      {adding && (
        <Sheet onClose={() => setParam('them', null)} label="Thêm từ">
          <AddWordForm
            onDone={(msg) => {
              setParam('them', null);
              setToast(msg);
              setTimeout(() => setToast(''), 3500);
              void load();
            }}
          />
        </Sheet>
      )}

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-30 mx-auto max-w-md rounded-xl bg-primary px-4 py-3 text-center text-sm font-medium text-cream shadow-lg animate-[fadeIn_.2s_ease-out]">
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
      onDone(r.status === 'linked' ? `Đã thêm "${text.trim()}" vào kho của bạn.` : `Đã gửi "${text.trim()}" cho thầy duyệt.`);
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[var(--radius-card)] bg-highlight p-4 ring-1 ring-highlight-line">
      <SectionTitle as="h2" className="!mb-1">
        Thêm từ muốn học
      </SectionTitle>
      <p className="text-sm text-ink-2">Từ đã có trong kho của lớp sẽ được thêm ngay. Từ mới sẽ chờ thầy duyệt rồi vào bộ từ sau.</p>
      <label className="block">
        <span className="label-caps mb-1 block text-ink-2">Từ / cụm từ</span>
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
          className="h-12 w-full rounded-xl border border-highlight-line bg-surface px-4 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
          style={{ fontSize: 16 }}
        />
      </label>
      <label className="block">
        <span className="label-caps mb-1 block text-ink-2">Ghi chú (không bắt buộc)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Gặp trong bài đọc Unit 3"
          className="h-12 w-full rounded-xl border border-highlight-line bg-surface px-4 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
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
