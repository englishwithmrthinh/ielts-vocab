/** Thêm bộ từ: dán JSON từ skill, chọn học sinh được giao. Số bộ từ tự lấy. */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Class, Student } from '@shared/types';
import StudentPicker from '../components/StudentPicker';
import { copyText } from '../lib/imageFile';
import { rememberForLesson, type PickedSuggestion } from '../lib/suggestionHandoff';
import { vnDate } from '@shared/time';
import { ApiCallError } from '../../lib/api';
import { adminApi, type ExistingWord } from '../lib/adminApi';
import { gridPlan, parseLessonJson, type SchemaIssue } from '../lib/lessonSchema';
import { Badge, Button, Card, ErrorBox, PageHeader, inputCls } from '../ui';

const SAMPLE = `{
  "words": [
    {
      "word": "environment",
      "pos": "n",
      "meaning_vi": "môi trường",
      "ipa": "/ɪnˈvaɪrənmənt/",
      "syllables": "en·VI·ron·ment",
      "example": "Plastic waste is a serious threat to the environment.",
      "word_family": [
        { "form": "environmental", "pos": "adj", "sentence": "The project had a huge ___ impact." }
      ],
      "image_hint": "a green forest with a clear river"
    }
  ]
}`;

export default function CreateLessonPage() {
  const nav = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [classes, setClasses] = useState<Class[]>([]);
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [taughtOn, setTaughtOn] = useState(vnDate(new Date()));
  const [text, setText] = useState('');
  const [existing, setExisting] = useState<ExistingWord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<{ id: string; number: number; reused: number; created: number } | null>(null);
  // Từ trang "Từ HS đề xuất": danh sách từ + học sinh đề xuất (mặc định chỉ giao cho các em đó)
  const location = useLocation();
  const suggestions = ((location.state as { suggestions?: PickedSuggestion[] } | null)?.suggestions ?? []) as PickedSuggestion[];
  const suggestedWords = [...new Map(suggestions.map((p) => [p.text.trim().toLowerCase(), p.text.trim()])).values()];
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    adminApi.students().then((r) => {
      const active = r.students.filter((s) => s.active);
      setStudents(active);
      const codes = new Set(suggestions.map((p) => p.code));
      const fromSuggest = active.filter((s) => codes.has(s.code));
      setPresent(new Set((fromSuggest.length ? fromSuggest : active).map((s) => s.id)));
    }, setError);
    adminApi.lessons().then((r) => setNextNumber(r.nextNumber), setError);
    adminApi.classes().then((r) => setClasses(r.classes.filter((c) => c.active)), () => undefined);
  }, []);

  const parsed = useMemo(() => (text.trim() ? parseLessonJson(text) : null), [text]);

  // Đánh dấu từ đã có trong kho tổng (chỉ khi JSON hợp lệ)
  useEffect(() => {
    setExisting([]);
    if (!parsed?.ok) return;
    const t = setTimeout(() => {
      adminApi.checkWords(parsed.words.map((w) => ({ word: w.word, pos: w.pos }))).then((r) => setExisting(r.existing), () => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [parsed]);

  const existingKey = new Set(existing.map((e) => `${e.word}|${e.pos}`));
  const errors = parsed?.issues.filter((i) => i.level === 'error') ?? [];
  const warnings = parsed?.issues.filter((i) => i.level === 'warning') ?? [];
  const canSubmit = !!parsed?.ok && present.size > 0 && nextNumber !== null && !!taughtOn && !busy;

  // Số bộ từ tự lấy; trùng (409, ví dụ hai tab cùng thêm) thì tự thử số kế tiếp
  const submit = async () => {
    setBusy(true);
    setError(null);
    let number = nextNumber ?? 1;
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const r = await adminApi.createLesson({ number, taught_on: taughtOn, student_ids: [...present], json: text });
          setDone({ id: r.lesson.id, number: r.lesson.number, reused: r.reused, created: r.created });
          rememberForLesson(r.lesson.id, suggestions);
          setNextNumber(r.lesson.number + 1);
          return;
        } catch (e) {
          if (e instanceof ApiCallError && e.code === 'lesson_number_taken' && attempt < 5) {
            number++;
            continue;
          }
          throw e;
        }
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <h1 className="text-xl font-semibold text-slate-900">Đã thêm bộ từ {done.number}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {done.created} từ mới vào kho · {done.reused} từ dùng lại (không tạo lại audio, ảnh). Bộ từ đang ở trạng thái Nháp.
        </p>
        <p className="mt-1 text-xs text-slate-500">Bước tiếp: mở bộ từ, bấm “Tạo audio”, tải ảnh lên, duyệt rồi phát hành.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => { setDone(null); setText(''); }}>
            Thêm bộ từ khác
          </Button>
          <Button onClick={() => nav(`/admin/bo-tu/${done.id}`)}>Mở bộ từ {done.number}</Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Thêm bộ từ"
        sub="Mỗi bộ từ là các từ bạn muốn giao. Thêm bao nhiêu bộ cũng được; học sinh vẫn làm 3 bài/tuần (Thứ 3, Thứ 6, Chủ nhật) và từ mới tự vào bài kế tiếp."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {suggestedWords.length > 0 && (
            <Card className="bg-sky-50/60 ring-sky-200">
              <h2 className="font-semibold text-sky-950">{suggestedWords.length} từ học sinh đề xuất</h2>
              <p className="mt-1 text-sm text-sky-900/80">
                Copy danh sách → dán vào Claude (skill từ vựng) để lấy JSON → dán JSON vào ô dưới. Mặc định chỉ giao cho các em đã đề xuất; tick thêm bạn khác nếu muốn.
                Phát hành xong, các đề xuất này tự chuyển sang “đã thêm”.
              </p>
              <p className="mt-2 rounded-lg bg-white px-3 py-2 font-mono text-sm text-slate-800 ring-1 ring-sky-200">{suggestedWords.join(', ')}</p>
              <div className="mt-2 flex items-center gap-3">
                <Button variant="secondary" onClick={async () => setCopied(await copyText(suggestedWords.join('\n')))}>Copy danh sách từ</Button>
                {copied && <span className="text-sm text-teal-700">Đã copy ✓</span>}
              </div>
            </Card>
          )}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="json" className="font-semibold text-slate-900">JSON từ vựng</label>
              {!text && <Button variant="ghost" className="text-xs" onClick={() => setText(SAMPLE)}>Dán mẫu để xem thử</Button>}
            </div>
            <textarea
              id="json"
              rows={14}
              spellCheck={false}
              className={`${inputCls} mt-2 font-mono text-xs leading-relaxed`}
              placeholder='{ "words": [ ... ] }'
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {parsed && (
              <div className="mt-3">
                {parsed.ok ? (
                  <p className="text-sm font-medium text-teal-800">
                    ✓ JSON hợp lệ · {parsed.words.length} từ
                    {existing.length > 0 && ` · ${existing.length} từ đã có trong kho`}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-red-700">Có {errors.length} lỗi cần sửa trước khi thêm bộ từ</p>
                )}
              </div>
            )}
          </Card>

          {parsed && (errors.length > 0 || warnings.length > 0) && (
            <Card>
              <IssueList title="Lỗi phải sửa" tone="red" issues={errors} />
              <IssueList title="Lưu ý (vẫn tạo được)" tone="amber" issues={warnings} />
              <p className="mt-3 text-xs text-slate-500">Sửa ngay trong ô JSON, hoặc nhờ Claude xuất lại rồi dán đè.</p>
            </Card>
          )}

          {parsed?.ok && (
            <Card className="p-0 sm:p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                <h2 className="font-semibold text-slate-900">Xem trước {parsed.words.length} từ</h2>
                <p className="text-xs text-slate-500">
                  Ảnh lưới: {gridPlan(parsed.words.length).map((g) => `${g.cols}×${g.rows}`).join(' + ')}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">#</th>
                      <th className="px-2 py-2 font-medium">Từ</th>
                      <th className="px-2 py-2 font-medium">Nghĩa</th>
                      <th className="px-2 py-2 font-medium">Phiên âm</th>
                      <th className="px-4 py-2 font-medium">Kho</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsed.words.map((w, i) => (
                      <tr key={`${w.word}|${w.pos}`}>
                        <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                        <td className="px-2 py-2"><span className="font-medium">{w.word}</span> <span className="text-xs text-slate-500">({w.pos})</span></td>
                        <td className="px-2 py-2 text-slate-700">{w.meaning_vi}</td>
                        <td className="px-2 py-2 font-mono text-xs text-slate-600">{w.ipa ?? '—'}</td>
                        <td className="px-4 py-2">{existingKey.has(`${w.word}|${w.pos}`) ? <Badge tone="blue">Đã có</Badge> : <Badge tone="teal">Mới</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {existing.length > 0 && (
                <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Từ “Đã có” sẽ dùng lại nội dung, audio và ảnh trong kho, không tạo lại.</p>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold text-slate-900">
              Giao cho học sinh <span className="font-normal text-slate-500">{present.size}/{students.length}</span>
            </h2>
            <p className="mb-2 text-xs text-slate-500">Bấm lớp để chọn cả lớp, rồi bỏ tick bạn không giao.</p>
            <StudentPicker students={students} classes={classes} selected={present} onChange={setPresent} />
          </Card>

          <details className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Tuỳ chọn</summary>
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Ngày thêm
              <input type="date" className={`${inputCls} mt-1`} value={taughtOn} onChange={(e) => setTaughtOn(e.target.value)} />
              <span className="mt-1 block text-xs font-normal text-slate-500">Chỉ để ghi nhớ. Từ vẫn vào bài kế tiếp sau khi phát hành.</span>
            </label>
          </details>

          <ErrorBox error={error} />
          <Button className="w-full py-2.5" disabled={!canSubmit} onClick={submit}>
            {busy ? 'Đang thêm…' : `Thêm bộ từ${nextNumber ? ` ${nextNumber}` : ''} (nháp)`}
          </Button>
          {!canSubmit && !busy && (
            <p className="text-center text-xs text-slate-500">
              {!parsed ? 'Dán JSON để bắt đầu' : !parsed.ok ? 'Sửa hết lỗi JSON trước' : !present.size ? 'Tick ít nhất 1 học sinh' : 'Đang tải…'}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function IssueList({ title, tone, issues }: { title: string; tone: 'red' | 'amber'; issues: SchemaIssue[] }) {
  if (!issues.length) return null;
  const color = tone === 'red' ? 'text-red-700' : 'text-amber-700';
  return (
    <div className="mb-3 last:mb-0">
      <h3 className={`text-sm font-semibold ${color}`}>{title} ({issues.length})</h3>
      <ul className="mt-1.5 space-y-1 text-sm">
        {issues.map((i, k) => (
          <li key={k} className="flex flex-wrap gap-x-2">
            <span className="font-medium text-slate-800">
              {i.index < 0 ? 'Cả JSON' : `Từ ${i.index + 1}${i.word ? ` “${i.word}”` : ''}`}
            </span>
            <span className="font-mono text-xs leading-5 text-slate-500">{i.field}</span>
            <span className="text-slate-700">{i.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
