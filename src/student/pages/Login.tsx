import { ArrowLeft, BookOpenCheck } from 'lucide-react';
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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-8 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-primary text-white shadow-[0_4px_0_var(--color-primary-edge)]">
          <BookOpenCheck className="size-8" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Ôn từ vựng IELTS</h1>
        <p className="mt-1 text-ink-2">Mỗi ngày một chút, nhớ lâu hơn nhiều.</p>
      </div>

      {step === 'code' ? (
        <form onSubmit={goPin} className="mt-10 flex flex-1 flex-col">
          <label htmlFor="code" className="mb-2 text-sm font-semibold text-ink-2">
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
            className="h-14 rounded-2xl border-2 border-line bg-surface px-4 text-center text-xl font-semibold tracking-[0.2em] text-ink outline-none transition placeholder:text-ink-3/60 focus:border-brand"
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
          <p className="mb-5 font-semibold">Nhập PIN 4 số</p>
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
          <p className="mt-auto pt-6 text-center text-xs text-ink-3">Quên PIN? Nhắn cô giáo để được đặt lại.</p>
        </div>
      )}
    </div>
  );
}
