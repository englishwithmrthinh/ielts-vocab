import { ArrowLeft } from 'lucide-react';
import { Banner, Star4 } from '../components/Art';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { errorText, studentApi, USE_MOCK } from '../api';
import { PinPad } from '../components/PinPad';
import { Button, Spinner } from '../components/ui';
import { useSession } from '../session';

export default function Login() {
  const nav = useNavigate();
  const { me, setMe } = useSession();
  const [step, setStep] = useState<'code' | 'pin'>('code');
  const [code, setCode] = useState(''); // mã lớp, vd GB07 (hoặc mã cũ HS01)
  const [birth, setBirth] = useState(''); // mã học sinh (thường là ngày + tháng sinh, vd 2402; có thể có chữ)
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (pin.length !== 4 || busy) return;
    setBusy(true);
    setError('');
    studentApi
      .login(code, pin)
      .then((student) => {
        setMe(student);
        nav('/hoc', { replace: true });
      })
      .catch((e: unknown) => {
        setError(errorText(e));
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin('');
        }, 450);
      })
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  if (me) return <Navigate to="/hoc" replace />;

  // Giáo viên chọn: chỉ cần gõ MÃ (mã lớp + ngày sinh) là vào, không cần PIN
  const goPin = (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Nhập mã lớp trước nhé.');
      return;
    }
    if (busy) return;
    setError('');
    setBusy(true);
    studentApi
      .login(code.trim() + birth.trim(), '')
      .then((student) => {
        setMe(student);
        nav('/hoc', { replace: true });
      })
      .catch((err: unknown) => setError(errorText(err)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <Banner className="h-28 shrink-0 sm:h-36" />
      <div className="mx-auto -mt-10 flex w-full max-w-md flex-1 flex-col px-4 pb-8">
      <div className="relative flex flex-1 flex-col rounded-[var(--radius-card)] bg-surface px-5 pb-6 pt-6 shadow-[var(--shadow-card)] ring-1 ring-line">
      <div className="flex flex-col items-center text-center">
        <Star4 className="mb-2 size-5 text-gold" />
        <h1 className="font-display text-[22px] leading-tight">Học từ vựng</h1>
        <p className="label-caps mt-1 text-ink-3">Mr Thinh Class</p>
        <p className="mt-3 font-serif text-lg italic text-ink-2">Mỗi ngày một trang, nhớ lâu hơn nhiều.</p>
      </div>

      {step === 'code' ? (
        <form onSubmit={goPin} className="mt-10 flex flex-1 flex-col">
          <label htmlFor="code" className="label-caps mb-2 text-ink-2">
            Mã lớp
          </label>
          <input
            id="code"
            ref={codeRef}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError('');
            }}
            placeholder="VD: GB07"
            autoComplete="username"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            className="h-14 rounded-xl border border-line bg-surface-2 px-4 text-center text-xl font-semibold tracking-[0.2em] text-ink outline-none transition placeholder:text-ink-3/60 focus:border-brand focus:ring-2 focus:ring-brand/25"
          />
          <label htmlFor="birth" className="label-caps mb-2 mt-5 text-ink-2">
            Mã học sinh
          </label>
          <input
            id="birth"
            value={birth}
            onChange={(e) => {
              setBirth(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9));
              setError('');
            }}
            placeholder="VD: 2402"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            className="h-14 rounded-xl border border-line bg-surface-2 px-4 text-center text-xl font-semibold tracking-[0.2em] text-ink outline-none transition placeholder:text-ink-3/60 focus:border-brand focus:ring-2 focus:ring-brand/25"
          />
          {error && (
            <p role="alert" className="mt-2 text-sm text-bad-ink">
              {error}
            </p>
          )}
          <div className="mt-auto pt-8">
            <p className="mb-3 text-center text-xs text-ink-3">Mã học sinh thầy gửi, thường là ngày + tháng sinh (24/02 → 2402)</p>
            <Button type="submit" block size="lg" disabled={busy}>
              {busy ? 'Đang vào…' : 'Vào học'}
            </Button>
            {USE_MOCK && <p className="mt-3 text-center text-xs text-ink-3">Dữ liệu thử: mã lớp HS01, bỏ trống ngày sinh</p>}
          </div>
        </form>
      ) : (
        <div className="mt-8 flex flex-1 flex-col items-center">
          <button
            type="button"
            onClick={() => {
              setStep('code');
              setPin('');
              setError('');
            }}
            className="mb-6 inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium text-brand-ink hover:bg-brand-wash"
          >
            <ArrowLeft className="size-4" aria-hidden /> Mã: <b className="font-semibold">{code}</b> · Đổi
          </button>
          <p className="label-caps mb-5 text-ink-2">Nhập PIN 4 số</p>
          <PinPad
            value={pin}
            onChange={(v) => {
              setPin(v);
              setError('');
            }}
            disabled={busy}
            error={shake}
          />
          <div className="mt-5 min-h-6 text-center text-sm" aria-live="polite">
            {busy ? <Spinner className="size-5" /> : error && <span className="text-bad-ink">{error}</span>}
          </div>
          <p className="mt-auto pt-6 text-center text-xs text-ink-3">Quên mã? Nhắn thầy nhé.</p>
          <p className="pt-2 text-center text-xs text-ink-3">
            <a href="/admin" className="underline underline-offset-2">Dành cho thầy · Quản trị</a>
          </p>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
