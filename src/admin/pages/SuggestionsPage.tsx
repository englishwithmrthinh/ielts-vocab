/** Từ học sinh đề xuất: chọn nhiều → Thêm vào bộ từ mới, hoặc Bỏ qua. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminSuggestionsResponse } from '@shared/types';
import { adminApi } from '../lib/adminApi';
import type { PickedSuggestion } from '../lib/suggestionHandoff';
import { Button, Card, ErrorBox, PageHeader } from '../ui';

type Row = AdminSuggestionsResponse['suggestions'][number];

const fmt = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

export default function SuggestionsPage({ onCount }: { onCount?: (n: number) => void }) {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    adminApi.suggestions('pending').then((r) => {
      setRows(r.suggestions);
      onCount?.(r.suggestions.length);
    }, setError);
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Gộp cùng một từ (nhiều em đề xuất) để giáo viên nhìn gọn
  const groups = new Map<string, Row[]>();
  for (const r of rows ?? []) {
    const k = r.text.trim().toLowerCase();
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const list = [...groups.values()].sort((a, b) => b.length - a.length || b[0]!.createdAt.localeCompare(a[0]!.createdAt));

  const toggle = (g: Row[]) =>
    setSel((p) => {
      const n = new Set(p);
      const on = g.every((r) => n.has(r.id));
      g.forEach((r) => (on ? n.delete(r.id) : n.add(r.id)));
      return n;
    });

  const picked = (rows ?? []).filter((r) => sel.has(r.id));

  const reject = async (ids: string[]) => {
    if (!ids.length || !confirm(`Bỏ qua ${ids.length} đề xuất? Học sinh sẽ thấy đề xuất không được thêm.`)) return;
    setBusy(true);
    setError(null);
    try {
      for (const id of ids) await adminApi.updateSuggestion(id, 'rejected');
      setSel(new Set());
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const addToNew = () => {
    const state: PickedSuggestion[] = picked.map((r) => ({ id: r.id, text: r.text, code: r.code, name: r.name }));
    nav('/admin/them-bo-tu', { state: { suggestions: state } });
  };

  return (
    <>
      <PageHeader
        title="Từ học sinh đề xuất"
        sub="Từ học sinh tự thêm mà chưa có trong kho. Gom vào một bộ từ mới để giao, hoặc bỏ qua."
        actions={
          <>
            <Button variant="secondary" disabled={busy || !sel.size} onClick={() => reject([...sel])}>Bỏ qua ({sel.size})</Button>
            <Button disabled={busy || !sel.size} onClick={addToNew}>Thêm vào bộ từ mới ({new Set(picked.map((p) => p.text.trim().toLowerCase())).size} từ)</Button>
          </>
        }
      />
      <ErrorBox error={error} />
      <Card className="mt-4 p-0 sm:p-0">
        {!rows ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Đang tải…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Không có đề xuất nào đang chờ. 🎉</p>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" checked={sel.size === rows.length} onChange={() => setSel(sel.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))} />
                Chọn tất cả
              </label>
              <span className="text-slate-500">{list.length} từ · {rows.length} lượt đề xuất</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {list.map((g) => {
                const first = g[0]!;
                const on = g.every((r) => sel.has(r.id));
                return (
                  <li key={first.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <input type="checkbox" className="mt-1" aria-label={`Chọn ${first.text}`} checked={on} onChange={() => toggle(g)} />
                    <div className="min-w-[12rem] flex-1">
                      <p className="font-semibold text-slate-900">
                        {first.text}
                        {g.length > 1 && <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">{g.length} em đề xuất</span>}
                      </p>
                      <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                        {g.map((r) => (
                          <li key={r.id}>
                            <span className="font-mono text-xs text-slate-400">{r.code}</span> {r.name} · {fmt(r.createdAt)}
                            {r.note && <span className="italic text-slate-500"> — “{r.note}”</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Button variant="ghost" disabled={busy} onClick={() => reject(g.map((r) => r.id))}>Bỏ qua</Button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
