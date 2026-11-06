/** Chi tiết buổi: chạy pipeline, thanh tiến trình, Duyệt từng thẻ, xem infographic, Phát hành. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Class, PipelineLogEntry, Student, Word } from '@shared/types';
import StudentPicker from '../components/StudentPicker';
import Infographic from '../../shared-ui/Infographic';
import { ImagesSection, SingleImageDialog } from '../components/ImageTools';
import { adminApi, type LessonDetail, type PublishResult } from '../lib/adminApi';
import { Badge, Button, Card, ErrorBox, inputCls } from '../ui';

const STATUS = {
  draft: { label: 'Nháp', tone: 'slate' },
  processing: { label: 'Đang tạo media', tone: 'amber' },
  review: { label: 'Chờ duyệt', tone: 'blue' },
  published: { label: 'Đã phát hành', tone: 'teal' },
} as const;

const STEP_PCT: Record<PipelineLogEntry['step'], number> = { validate: 5, ipa: 20, audio: 50, image: 90, done: 100, error: -1 };
const REDO_TIMEOUT_MS = 120_000;

type Pending = Record<string, { what: 'audio'; before: string | null; since: number }>;

export default function ReviewPage() {
  const { id = '' } = useParams();
  const [data, setData] = useState<LessonDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState<'cards' | 'infographic'>('cards');
  const [pending, setPending] = useState<Pending>({});
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState('');
  const [success, setSuccess] = useState('');
  const [redraw, setRedraw] = useState<Word | null>(null);

  const load = useCallback(() => adminApi.lessonDetail(id).then(setData, setError), [id]);
  useEffect(() => {
    load();
  }, [load]);

  // Hỏi lại khi pipeline đang chạy hoặc có từ đang tạo lại
  const processing = data?.lesson.status === 'processing';
  const hasPending = Object.keys(pending).length > 0;
  useEffect(() => {
    if (!processing && !hasPending) return;
    const t = setInterval(load, processing ? 4000 : 3000);
    return () => clearInterval(t);
  }, [processing, hasPending, load]);

  // Xong / quá giờ thì gỡ trạng thái chờ
  useEffect(() => {
    if (!data || !hasPending) return;
    const next = { ...pending };
    let changed = false;
    for (const [wid, p] of Object.entries(pending)) {
      const w = data.words.find((x) => x.id === wid);
      const now = w?.audio_url ?? null;
      const timedOut = Date.now() - p.since > REDO_TIMEOUT_MS;
      if ((now && now !== p.before) || timedOut) {
        delete next[wid];
        changed = true;
        if (timedOut && !(now && now !== p.before)) setNotice(`Chưa tạo lại được audio cho "${w?.word}". Thử lại sau ít phút.`);
      }
    }
    if (changed) setPending(next);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error && !data) return <ErrorBox error={error} />;
  if (!data) return <p className="text-sm text-slate-500">Đang tải…</p>;

  const { lesson, words } = data;
  const status = STATUS[lesson.status];
  const errorsByWord = new Map<string, string[]>();
  for (const e of lesson.pipeline_log) if (e.step === 'error' && e.word_id) errorsByWord.set(e.word_id, [...(errorsByWord.get(e.word_id) ?? []), e.message]);
  const lastPct = Math.max(0, ...lesson.pipeline_log.map((e) => STEP_PCT[e.step]));
  const missingAudio = words.filter((w) => !w.audio_url).length;
  const missingImage = words.filter((w) => !w.image_url).length;
  const aiIpa = words.filter((w) => w.ipa_source === 'ai').length;
  const editable = lesson.status !== 'processing';

  const run = async () => {
    setError(null);
    try {
      await adminApi.runPipeline(lesson.id);
      setData({ ...data, lesson: { ...lesson, status: 'processing', pipeline_log: [] } });
    } catch (e) {
      setError(e);
    }
  };

  const redoAudio = async (w: Word) => {
    setNotice('');
    try {
      await adminApi.redoWord(w.id, 'audio');
      setPending((p) => ({ ...p, [w.id]: { what: 'audio', before: w.audio_url, since: Date.now() } }));
    } catch (e) {
      setError(e);
    }
  };

  const replaceWord = (nw: Word) => setData((d) => (d ? { ...d, words: d.words.map((x) => (x.id === nw.id ? nw : x)) } : d));

  return (
    <>
      <div className="mb-1 text-sm"><Link to="/admin/bo-tu" className="text-teal-700 hover:underline">← Bộ từ</Link></div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900 sm:text-2xl">
            Bộ từ {lesson.number} <Badge tone={status.tone}>{status.label}</Badge>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {words.length} từ · thêm {lesson.taught_on.split('-').reverse().join('/')} · giao cho {data.studentIds.length} học sinh
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lesson.status === 'draft' && <Button onClick={run}>Tạo audio</Button>}
          {lesson.status === 'published' && <Button variant="secondary" onClick={() => setPublishing(true)}>Thêm học sinh…</Button>}
          {lesson.status === 'review' && (
            <>
              {missingAudio > 0 && <Button variant="secondary" onClick={run}>Tạo audio còn thiếu</Button>}
              <Button onClick={() => setPublishing(true)}>Phát hành…</Button>
            </>
          )}
        </div>
      </header>

      <div className="space-y-4">
        <ErrorBox error={error} />
        {success && <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900 ring-1 ring-teal-200">{success}</p>}
        {notice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">{notice}</p>}

        {(lesson.status === 'processing' || lesson.pipeline_log.length > 0) && (
          <Card>
            {lesson.status === 'processing' && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">Đang tra phiên âm và tạo audio…</span>
                  <span className="text-slate-500">{lastPct}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-teal-600 transition-all duration-700" style={{ width: `${Math.max(4, lastPct)}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">Thường dưới 1 phút. Trong lúc chờ, có thể làm ảnh minh hoạ ở dưới.</p>
              </>
            )}
            <details className={lesson.status === 'processing' ? 'mt-3' : ''} open={lesson.status === 'processing'}>
              <summary className="cursor-pointer text-sm font-medium text-slate-700">Nhật ký ({lesson.pipeline_log.length})</summary>
              <ol className="mt-2 space-y-1 text-sm">
                {lesson.pipeline_log.map((e, i) => (
                  <li key={i} className={e.step === 'error' ? 'text-red-700' : 'text-slate-600'}>
                    <span className="mr-2 font-mono text-xs text-slate-400">{new Date(e.at).toLocaleTimeString('vi-VN')}</span>
                    {e.message}
                  </li>
                ))}
              </ol>
            </details>
          </Card>
        )}

        {lesson.status !== 'draft' && lesson.status !== 'processing' && (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone={missingAudio ? 'red' : 'teal'}>{missingAudio ? `${missingAudio} từ thiếu audio` : 'Đủ audio'}</Badge>
            <Badge tone={missingImage ? 'amber' : 'teal'}>{missingImage ? `${missingImage} từ không có ảnh` : 'Đủ ảnh'}</Badge>
            {aiIpa > 0 && <Badge tone="amber">{aiIpa} phiên âm do AI — kiểm tra lại</Badge>}
          </div>
        )}

        {lesson.status !== 'published' && <ImagesSection lessonId={lesson.id} words={words} onUploaded={load} />}

        <div className="flex gap-1 border-b border-slate-200">
          {(['cards', 'infographic'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {t === 'cards' ? 'Thẻ từ' : 'Xem trước infographic'}
            </button>
          ))}
        </div>

        {tab === 'cards' ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {words.map((w, i) => (
              <WordCard
                key={w.id}
                index={i}
                word={w}
                errors={errorsByWord.get(w.id) ?? []}
                pending={pending[w.id]?.what}
                editable={editable}
                audioRedo={editable && lesson.status !== 'draft'}
                onRedoAudio={() => redoAudio(w)}
                onRedraw={() => setRedraw(w)}
                onChanged={replaceWord}
              />
            ))}
          </ul>
        ) : (
          <Infographic title={`Bộ từ ${lesson.number}`} items={words.map((w) => ({ id: w.id, word: w.word, meaningVi: w.meaning_vi, imageUrl: w.image_url, pos: w.pos }))} />
        )}
      </div>

      {redraw && (
        <SingleImageDialog
          word={redraw}
          onClose={() => setRedraw(null)}
          onDone={(nw) => { replaceWord(nw); setRedraw(null); }}
        />
      )}
      {publishing && <PublishDialog detail={data} onClose={() => setPublishing(false)} onDone={(r) => {
            setPublishing(false);
            setSuccess(`Đã gán ${r.assigned} từ cho ${r.students} học sinh${r.skipped ? ` (bỏ qua ${r.skipped} từ đã có)` : ''}. Từ mới đến hạn ở mốc ${r.dueIdx}.`);
            load();
          }} />}
    </>
  );
}

function WordCard(props: {
  index: number;
  word: Word;
  errors: string[];
  pending?: 'audio';
  editable: boolean;
  audioRedo: boolean;
  onRedoAudio: () => void;
  onRedraw: () => void;
  onChanged: (w: Word) => void;
}) {
  const { word: w, pending } = props;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ meaning_vi: w.meaning_vi, ipa: w.ipa ?? '', example: w.example ?? '', image_hint: w.image_hint ?? '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { word } = await adminApi.updateWord(w.id, { meaning_vi: form.meaning_vi, ipa: form.ipa || null, example: form.example || null, image_hint: form.image_hint || null });
      props.onChanged(word);
      setEditing(false);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const drop = async () => {
    if (!confirm(`Bỏ ảnh của "${w.word}"? Câu hỏi dạng ảnh sẽ tự đổi sang dạng khác.`)) return;
    try {
      props.onChanged((await adminApi.dropImage(w.id)).word);
    } catch (e) {
      setErr(e);
    }
  };

  return (
    <li className={`overflow-hidden rounded-xl bg-white ring-1 ${props.errors.length ? 'ring-red-300' : 'ring-slate-200'}`}>
      <div className="relative aspect-[4/3] bg-slate-100">
        {w.image_url ? (
          <img src={w.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-sm text-slate-400">Không có ảnh</div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-xs font-medium text-slate-600">{props.index + 1}</span>
        {props.editable && (
          <div className="absolute bottom-2 right-2 flex gap-1">
            <button type="button" onClick={props.onRedraw} className="rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-white">
              Vẽ lại ảnh từ này
            </button>
            {w.image_url && (
              <button type="button" onClick={drop} className="rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-red-700 shadow-sm hover:bg-white">
                Bỏ ảnh
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">
              {w.word} <span className="text-xs font-normal text-slate-500">({w.pos})</span>
            </p>
            <p className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-slate-600">
              {w.ipa ?? '—'}
              {w.ipa_source === 'ai' && <Badge tone="amber">IPA do AI</Badge>}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              disabled={!w.audio_url || pending === 'audio'}
              onClick={() => {
                audio.current?.pause();
                audio.current = new Audio(w.audio_url!);
                audio.current.play().catch(() => undefined);
              }}
              aria-label={`Nghe ${w.word}`}
              className="grid h-8 w-8 place-items-center rounded-full bg-teal-50 text-teal-800 ring-1 ring-teal-200 hover:bg-teal-100 disabled:bg-slate-50 disabled:text-slate-300 disabled:ring-slate-200"
            >
              ▶
            </button>
          </div>
        </div>

        {!w.audio_url && pending !== 'audio' && <p className="text-xs font-medium text-red-700">Chưa có audio</p>}
        {props.audioRedo && (
          <button type="button" disabled={pending === 'audio'} onClick={props.onRedoAudio} className="text-xs font-medium text-teal-700 hover:underline disabled:text-slate-400">
            {pending === 'audio' ? 'Đang tạo lại audio…' : 'Tạo lại audio từ này'}
          </button>
        )}

        {editing ? (
          <div className="space-y-2">
            <Field label="Nghĩa" value={form.meaning_vi} onChange={(v) => setForm({ ...form, meaning_vi: v })} />
            <Field label="Phiên âm" value={form.ipa} onChange={(v) => setForm({ ...form, ipa: v })} mono />
            <Field label="Câu ví dụ" value={form.example} onChange={(v) => setForm({ ...form, example: v })} multiline />
            <Field label="Gợi ý vẽ ảnh (tiếng Anh)" value={form.image_hint} onChange={(v) => setForm({ ...form, image_hint: v })} multiline />
            <ErrorBox error={err} />
            <div className="flex gap-2">
              <Button onClick={save} disabled={busy || !form.meaning_vi.trim()}>{busy ? 'Đang lưu…' : 'Lưu'}</Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>Huỷ</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-800">{w.meaning_vi}</p>
            {w.example && <p className="text-sm italic text-slate-600">{w.example}</p>}
            {props.editable && (
              <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-slate-600 hover:underline">Sửa nội dung</button>
            )}
            <ErrorBox error={err} />
          </>
        )}

        {props.errors.map((m, i) => <p key={i} className="rounded bg-red-50 px-2 py-1 text-xs text-red-800">{m}</p>)}
      </div>
    </li>
  );
}

function Field({ label, value, onChange, mono, multiline }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean; multiline?: boolean }) {
  const cls = `${inputCls} mt-0.5 ${mono ? 'font-mono text-xs' : ''}`;
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      {multiline ? <textarea rows={2} className={cls} value={value} onChange={(e) => onChange(e.target.value)} /> : <input className={cls} value={value} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

function PublishDialog({ detail, onClose, onDone }: { detail: LessonDetail; onClose: () => void; onDone: (r: PublishResult) => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set(detail.studentIds));
  const [classes, setClasses] = useState<Class[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    adminApi.students().then((r) => setStudents(r.students.filter((s) => s.active)), setErr);
    adminApi.classes().then((r) => setClasses(r.classes.filter((c) => c.active)), () => undefined);
  }, []);

  const missingAudio = detail.words.filter((w) => !w.audio_url).length;
  const missingImage = detail.words.filter((w) => !w.image_url).length;
  const already = detail.lesson.status === 'published';

  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      onDone(await adminApi.publish(detail.lesson.id, [...sel]));
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{already ? 'Thêm học sinh vào' : 'Phát hành'} bộ từ {detail.lesson.number}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {detail.words.length} từ sẽ vào hộp 1 của các bạn được chọn và xuất hiện ở bài kế tiếp.
          {already ? ' Bạn đã có từ thì giữ nguyên tiến độ.' : ' Có thể thêm học sinh sau, nhưng không gỡ được.'}
        </p>
        {missingAudio > 0 && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-sm text-amber-900">Còn {missingAudio} từ chưa có audio — dạng câu nghe sẽ bỏ qua các từ này.</p>}
        {missingImage > 0 && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-sm text-amber-900">Còn {missingImage} từ chưa có ảnh — dạng câu ảnh sẽ bỏ qua các từ này.</p>}
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-800">Học sinh nhận ({sel.size})</span>
          <span className="text-xs text-slate-500">Bấm lớp để chọn cả lớp</span>
        </div>
        <div className="mt-2 rounded-lg p-3 ring-1 ring-slate-200">
          <StudentPicker
            students={students}
            classes={classes}
            selected={sel}
            onChange={setSel}
            maxHeight="max-h-56"
            note={(s) => (already && detail.studentIds.includes(s.id) ? 'đã giao' : !already && !detail.studentIds.includes(s.id) ? 'chưa chọn' : undefined)}
          />
        </div>
        <div className="mt-3"><ErrorBox error={err} /></div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Huỷ</Button>
          <Button onClick={go} disabled={busy || !sel.size}>{busy ? 'Đang gán từ…' : `${already ? 'Gán' : 'Phát hành'} cho ${sel.size} học sinh`}</Button>
        </div>
      </div>
    </div>
  );
}
