/** Tổng quan hôm nay: bài của mốc hiện tại, ai đang nợ bài, việc cần làm (bộ từ chờ duyệt, đề xuất, báo lỗi). */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ClassesResponse } from '@shared/types';
import { adminApi } from '../lib/adminApi';
import { copyText } from '../lib/imageFile';
import type { AdminOverview } from '../lib/overview';
import { Badge, Button, Card, ErrorBox, PageHeader, selectCls } from '../ui';

const KIND: Record<string, string> = { tue: 'Thứ 3', fri: 'Thứ 6', sun: 'Chủ nhật' };
const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default function OverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [classes, setClasses] = useState<ClassesResponse['classes']>([]);
  const [classFilter, setClassFilter] = useState('all');
  const [error, setError] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);

  const load = () => adminApi.overview().then(setData, setError);
  useEffect(() => {
    load();
    adminApi.classes().then((r) => setClasses(r.classes), () => undefined);
  }, []);

  const className = new Map(classes.map((c) => [c.id, c.name]));
  const owing = (data?.owing ?? []).filter((o) => classFilter === 'all' || (classFilter === 'none' ? !o.classId : o.classId === classFilter));

  const zalo = () =>
    [
      `Các bạn còn nợ bài từ vựng (${new Date().toLocaleDateString('vi-VN')}):`,
      ...owing.map((o) => `- ${o.name}: ${o.count} bài, trễ ${o.daysLate} ngày — nộp hôm nay còn ${o.pctNow}%, để mai còn ${o.pctTomorrow}%`),
      'Các bạn làm bài cũ nhất trước nhé!',
    ].join('\n');

  const m = data?.milestone;
  const t = data?.today;
  const todo = data ? data.lessons.draft + data.lessons.review + data.suggestionsPending : 0;

  return (
    <>
      <PageHeader title="Tổng quan hôm nay" sub={data ? `Cập nhật ${new Date(data.now).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : undefined} actions={<Button variant="ghost" onClick={load}>Tải lại</Button>} />
      <ErrorBox error={error} />
      {!data ? (
        !error && <p className="text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={m ? `Bài ${KIND[m.kind] ?? ''} ${dmy(m.date)}` : 'Chưa có mốc'} value={t ? `${t.submitted}/${t.total}` : '—'} note={t ? `đã nộp · ${t.doing} đang làm · ${t.notStarted} chưa làm` : ''} tone="teal" />
            <Tile label="Đang nợ bài" value={String(data.owing.length)} note="học sinh" tone={data.owing.length ? 'red' : 'teal'} />
            <Tile label="Bộ từ chờ xử lý" value={String(data.lessons.draft + data.lessons.review)} note={`${data.lessons.draft} nháp · ${data.lessons.review} chờ duyệt${data.lessons.processing ? ` · ${data.lessons.processing} đang tạo audio` : ''}`} to="/admin/bo-tu" />
            <Tile label="Đề xuất / báo lỗi" value={`${data.suggestionsPending} / ${data.flagsTotal}`} note="từ HS đề xuất · câu báo lỗi" to="/admin/de-xuat" />
          </div>

          {t && t.total > 0 && m?.open && (
            <Card>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800">Bài {KIND[m.kind]} {dmy(m.date)} · hạn 23:59</span>
                <span className="text-slate-500">{Math.round((100 * t.submitted) / t.total)}% đã nộp</span>
              </div>
              <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-teal-600" style={{ width: `${(100 * t.submitted) / t.total}%` }} />
                <div className="bg-amber-400" style={{ width: `${(100 * t.doing) / t.total}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500"><span className="text-teal-700">■</span> đã nộp · <span className="text-amber-500">■</span> đang làm · ■ chưa làm</p>
            </Card>
          )}

          <Card className="p-0 sm:p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
              <h2 className="font-semibold text-slate-900">Đang nợ bài <span className="font-normal text-slate-500">({owing.length})</span></h2>
              <select className={`${selectCls} ml-auto py-1.5`} value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Lọc theo lớp">
                <option value="all">Tất cả lớp</option>
                {classes.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="none">Chưa xếp lớp</option>
              </select>
              <Button variant="secondary" disabled={!owing.length} onClick={async () => { setCopied(await copyText(zalo())); setTimeout(() => setCopied(false), 2500); }}>
                {copied ? 'Đã copy ✓' : 'Copy để dán Zalo'}
              </Button>
            </div>
            {owing.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Không ai nợ bài. 🎉</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Học sinh</th>
                      <th className="px-2 py-2 font-medium">Lớp</th>
                      <th className="px-2 py-2 font-medium">Bài nợ cũ nhất</th>
                      <th className="px-2 py-2 text-right font-medium">Số bài nợ</th>
                      <th className="px-2 py-2 text-right font-medium">Trễ</th>
                      <th className="px-4 py-2 text-right font-medium">Nộp hôm nay → mai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {owing.map((o) => (
                      <tr key={o.studentId}>
                        <td className="px-4 py-2"><span className="font-mono text-xs text-slate-400">{o.code}</span> <span className="font-medium text-slate-900">{o.name}</span></td>
                        <td className="px-2 py-2 text-slate-600">{o.classId ? className.get(o.classId) ?? '—' : '—'}</td>
                        <td className="px-2 py-2 text-slate-700">{dmy(o.oldestDate)}</td>
                        <td className="px-2 py-2 text-right">{o.count > 1 ? <Badge tone="red">{o.count}</Badge> : o.count}</td>
                        <td className="px-2 py-2 text-right text-slate-700">{o.daysLate} ngày</td>
                        <td className="px-4 py-2 text-right"><b className="text-slate-900">{o.pctNow}%</b> <span className="text-slate-400">→ {o.pctTomorrow}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {todo > 0 && (
            <Card>
              <h2 className="font-semibold text-slate-900">Việc cần làm</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {data.lessons.review > 0 && <li><Link className="text-teal-700 hover:underline" to="/admin/bo-tu">{data.lessons.review} bộ từ chờ duyệt và phát hành →</Link></li>}
                {data.lessons.draft > 0 && <li><Link className="text-teal-700 hover:underline" to="/admin/bo-tu">{data.lessons.draft} bộ từ nháp chưa tạo audio →</Link></li>}
                {data.suggestionsPending > 0 && <li><Link className="text-teal-700 hover:underline" to="/admin/de-xuat">{data.suggestionsPending} từ học sinh đề xuất đang chờ →</Link></li>}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function Tile({ label, value, note, tone, to }: { label: string; value: string; note?: string; tone?: 'teal' | 'red'; to?: string }) {
  const body = (
    <div className={`h-full rounded-xl bg-white p-4 ring-1 ring-slate-200 ${to ? 'transition hover:ring-teal-400' : ''}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${tone === 'red' ? 'text-red-700' : tone === 'teal' ? 'text-teal-800' : 'text-slate-900'}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}
