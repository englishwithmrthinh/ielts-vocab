/** Câu báo lỗi: câu học sinh báo "có 2 đáp án đúng", gom theo từ, mở thẻ để sửa nghĩa / ví dụ. */
import { useEffect, useState } from 'react';
import type { AdminFlagsResponse, QType, Word } from '@shared/types';
import { adminApi } from '../lib/adminApi';
import { Badge, Button, Card, ErrorBox, PageHeader, inputCls } from '../ui';

type Flag = AdminFlagsResponse['flags'][number];

const QTYPE: Record<QType, string> = {
  A: 'Từ → nghĩa', B: 'Ảnh → từ', C: 'Nghe → từ', D: 'Nối', E: 'Nghĩa → từ', F: 'Xếp chữ cái', G: 'Spelling khuyết',
  H: 'Nghe – gõ', I: 'Ảnh – gõ', J: 'Chọn từ điền câu', K: 'Gõ từ vào câu', L: 'Kéo thả nhiều câu', M: 'Chia dạng từ',
};

const HANDLED_KEY = 'admin-flags-handled';
function readHandled(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(HANDLED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function writeHandled(s: Set<string>) {
  try {
    localStorage.setItem(HANDLED_KEY, JSON.stringify([...s].slice(-2000)));
  } catch {
    /* bỏ qua */
  }
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [handled, setHandled] = useState<Set<string>>(readHandled);
  const [showHandled, setShowHandled] = useState(false);

  useEffect(() => {
    adminApi.flags().then((r) => setFlags(r.flags), setError);
  }, []);

  const byWord = new Map<string, Flag[]>();
  for (const f of flags ?? []) byWord.set(f.wordId, [...(byWord.get(f.wordId) ?? []), f]);
  const groups = [...byWord.values()]
    .map((g) => ({ g, open: g.filter((f) => !handled.has(f.id)) }))
    .filter((x) => showHandled || x.open.length > 0)
    .sort((a, b) => b.open.length - a.open.length || b.g[0]!.createdAt.localeCompare(a.g[0]!.createdAt));
  const handledCount = (flags ?? []).filter((f) => handled.has(f.id)).length;

  const markHandled = (g: Flag[]) => {
    const n = new Set(handled);
    g.forEach((f) => n.add(f.id));
    setHandled(n);
    writeHandled(n);
  };

  return (
    <>
      <PageHeader title="Câu báo lỗi" sub="Câu học sinh bấm “Câu này có 2 đáp án đúng”. Từ bị nhiều em báo xếp lên đầu. Sửa nghĩa / câu ví dụ để câu sau rõ hơn." />
      <ErrorBox error={error} />
      {handledCount > 0 && (
        <label className="mb-2 flex items-center justify-end gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showHandled} onChange={(e) => setShowHandled(e.target.checked)} />
          Hiện cả mục đã xử lý ({handledCount})
        </label>
      )}
      <Card className="p-0 sm:p-0">
        {!flags ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Đang tải…</p>
        ) : groups.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Không có câu báo lỗi nào cần xem.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {groups.map(({ g, open }) => {
              const first = g[0]!;
              return (
                <li key={first.wordId} className={`px-4 py-3 ${open.length ? '' : 'opacity-60'}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[12rem] flex-1">
                      <p className="font-semibold text-slate-900">
                        {first.word} <span className="font-normal text-slate-600">— {first.meaningVi}</span>
                        {open.length > 1 && <span className="ml-2"><Badge tone="red">{open.length} lượt báo</Badge></span>}
                        {!open.length && <span className="ml-2"><Badge>Đã xử lý</Badge></span>}
                      </p>
                      <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                        {g.map((f) => (
                          <li key={f.id} className={handled.has(f.id) ? 'line-through decoration-slate-300' : ''}>
                            <span className="font-mono text-xs text-slate-400">{f.code}</span> {f.name} · {QTYPE[f.qtype] ?? f.qtype} · trả lời “{f.given ?? '—'}” · {fmt(f.createdAt)}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="secondary" onClick={() => setEditing(editing === first.wordId ? null : first.wordId)}>{editing === first.wordId ? 'Đóng' : 'Sửa từ'}</Button>
                      {open.length > 0 && <Button variant="ghost" onClick={() => markHandled(g)}>Đã xử lý</Button>}
                    </div>
                  </div>
                  {editing === first.wordId && <WordEditor wordId={first.wordId} onSaved={() => markHandled(g)} />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

function WordEditor({ wordId, onSaved }: { wordId: string; onSaved: () => void }) {
  const [w, setW] = useState<Word | null>(null);
  const [form, setForm] = useState({ meaning_vi: '', example: '' });
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    adminApi.getWord(wordId).then((r) => {
      setW(r.word);
      setForm({ meaning_vi: r.word.meaning_vi, example: r.word.example ?? '' });
    }, setErr);
  }, [wordId]);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await adminApi.updateWord(wordId, { meaning_vi: form.meaning_vi, example: form.example || null });
      setW(r.word);
      setOk(true);
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  if (!w) return <div className="mt-3"><ErrorBox error={err} />{!err && <p className="text-sm text-slate-500">Đang tải thẻ từ…</p>}</div>;
  return (
    <div className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[120px_1fr]">
      {w.image_url ? <img src={w.image_url} alt="" className="aspect-square w-full rounded-md object-cover" /> : <div className="grid aspect-square place-items-center rounded-md bg-slate-200 text-xs text-slate-500">Không có ảnh</div>}
      <div className="space-y-2">
        <p className="text-sm text-slate-600"><b className="text-slate-900">{w.word}</b> ({w.pos}) <span className="font-mono text-xs">{w.ipa}</span></p>
        <label className="block text-xs font-medium text-slate-600">
          Nghĩa
          <input className={`${inputCls} mt-0.5`} value={form.meaning_vi} onChange={(e) => setForm({ ...form, meaning_vi: e.target.value })} />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Câu ví dụ (phải chứa đúng “{w.word}”)
          <textarea rows={2} className={`${inputCls} mt-0.5`} value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
        </label>
        <ErrorBox error={err} />
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy || !form.meaning_vi.trim()}>{busy ? 'Đang lưu…' : 'Lưu và đánh dấu đã xử lý'}</Button>
          {ok && <span className="text-sm text-teal-700">Đã lưu ✓ — mọi bộ từ có từ này cùng cập nhật</span>}
        </div>
      </div>
    </div>
  );
}
