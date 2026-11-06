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
  const [code, setCode] = useState('');
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

  const goPin = (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Nhập mã học sinh của bạn trước nhé.');
      return;
    }
    setError('');
    setStep('pin');
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
            Mã học sinh
          </label>
          <input
            id="code"
            ref={codeRef}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError('');
            }}
            placeholder="HS01"
            autoComplete="username"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            className="h-14 rounded-xl border border-line bg-surface-2 px-4 text-center text-xl font-semibold tracking-[0.2em] text-ink outline-none transition placeholder:text-ink-3/60 focus:border-brand focus:ring-2 focus:ring-brand/25"
          />
          {error && (
            <p role="alert" className="mt-2 text-sm text-bad-ink">
              {error}
            </p>
          )}
          <div className="mt-auto pt-8">
            <Button type="submit" block size="lg">
              Tiếp tục
            </Button>
            {USE_MOCK && <p className="mt-3 text-center text-xs text-ink-3">Dữ liệu thử: mã HS01, PIN 1234</p>}
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
          <p className="mt-auto pt-6 text-center text-xs text-ink-3">Quên PIN? Nhắn thầy để được đặt lại.</p>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
