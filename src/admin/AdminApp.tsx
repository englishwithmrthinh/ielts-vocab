/** KHU QUẢN TRỊ — Claude 3. Router con dưới /admin/*. */
import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { adminApi, DEMO } from './lib/adminApi';
import { Button, ErrorBox, inputCls } from './ui';
import StudentsPage from './pages/StudentsPage';
import ClassesPage from './pages/ClassesPage';
import PrintCardsPage from './pages/PrintCardsPage';
import CalendarPage from './pages/CalendarPage';
import CreateLessonPage from './pages/CreateLessonPage';
import LessonsPage from './pages/LessonsPage';
import ReviewPage from './pages/ReviewPage';
import ReportsPage from './pages/ReportsPage';
import OverviewPage from './pages/OverviewPage';
import SuggestionsPage from './pages/SuggestionsPage';
import FlagsPage from './pages/FlagsPage';

const NAV: { to: string; label: string; badge?: 'suggestions' | 'flags' }[] = [
  { to: 'tong-quan', label: 'Tổng quan' },
  { to: 'bo-tu', label: 'Bộ từ' },
  { to: 'them-bo-tu', label: 'Thêm bộ từ' },
  { to: 'de-xuat', label: 'Từ HS đề xuất', badge: 'suggestions' },
  { to: 'bao-loi', label: 'Câu báo lỗi', badge: 'flags' },
  { to: 'bao-cao', label: 'Báo cáo tháng' },
  { to: 'lop', label: 'Lớp' },
  { to: 'hoc-sinh', label: 'Học sinh' },
  { to: 'lich-moc', label: 'Lịch mốc' },
];

export default function AdminApp() {
  const [auth, setAuth] = useState<'checking' | 'in' | 'out'>('checking');

  useEffect(() => {
    adminApi.me().then(() => setAuth('in'), () => setAuth('out'));
  }, []);

  if (auth === 'checking') return <div className="grid min-h-dvh place-items-center bg-slate-50 text-sm text-slate-500">Đang tải…</div>;
  if (auth === 'out') return <Login onDone={() => setAuth('in')} />;

  return (
    <Routes>
      <Route path="in-the" element={<PrintCardsPage />} />
      <Route path="*" element={<Shell onLogout={() => setAuth('out')} />} />
    </Routes>
  );
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const [badges, setBadges] = useState<{ suggestions: number; flags: number }>({ suggestions: 0, flags: 0 });
  const location = useLocation();
  useEffect(() => {
    // chấm báo trên menu: đề xuất đang chờ + câu báo lỗi chưa xử lý (theo máy này)
    adminApi.suggestions('pending').then((r) => setBadges((b) => ({ ...b, suggestions: r.suggestions.length })), () => undefined);
    adminApi.flags().then((r) => {
      let handled = new Set<string>();
      try {
        handled = new Set(JSON.parse(localStorage.getItem('admin-flags-handled') ?? '[]') as string[]);
      } catch {
        /* bỏ qua */
      }
      setBadges((b) => ({ ...b, flags: r.flags.filter((f) => !handled.has(f.id)).length }));
    }, () => undefined);
  }, [location.pathname]);

  const logout = async () => {
    await adminApi.logout().catch(() => undefined);
    onLogout();
  };
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-800 md:flex">
      <aside className="sticky top-0 z-10 border-b border-slate-200 bg-white md:h-dvh md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 md:block md:py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-teal-700">IELTS Vocab</p>
            <p className="font-semibold text-slate-900">Quản trị</p>
          </div>
          <Button variant="ghost" className="md:hidden" onClick={logout}>Đăng xuất</Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:flex-col md:px-3 md:pb-0">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-100'}`
              }
            >
              <span className="inline-flex items-center gap-1.5">
                {n.label}
                {n.badge && badges[n.badge] > 0 && (
                  <span className="min-w-5 rounded-full bg-red-600 px-1.5 text-center text-[11px] font-semibold leading-5 text-white">{badges[n.badge]}</span>
                )}
              </span>
            </NavLink>
          ))}
          <a href="/bao-cao-lop" target="_blank" rel="noreferrer"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Bảng báo cáo lớp ↗
          </a>
          <a href="/hoc" target="_blank" rel="noreferrer"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Xem trang học sinh ↗
          </a>
        </nav>
        <div className="absolute bottom-4 left-3 hidden md:block">
          {DEMO && <p className="mb-2 px-3 text-xs text-amber-700">Chế độ demo · dữ liệu giả</p>}
          <Button variant="ghost" onClick={logout}>Đăng xuất</Button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-8">
        <Routes>
          <Route index element={<Navigate to="tong-quan" replace />} />
          <Route path="tong-quan" element={<OverviewPage />} />
          <Route path="bo-tu" element={<LessonsPage />} />
          <Route path="bo-tu/:id" element={<ReviewPage />} />
          <Route path="them-bo-tu" element={<CreateLessonPage />} />
          {/* đường dẫn cũ */}
          <Route path="buoi-hoc" element={<Navigate to="/admin/bo-tu" replace />} />
          <Route path="buoi-hoc/:id" element={<LegacyLesson />} />
          <Route path="tao-buoi" element={<Navigate to="/admin/them-bo-tu" replace />} />
          <Route path="de-xuat" element={<SuggestionsPage onCount={(n) => setBadges((b) => ({ ...b, suggestions: n }))} />} />
          <Route path="bao-loi" element={<FlagsPage />} />
          <Route path="bao-cao" element={<ReportsPage />} />
          <Route path="lop" element={<ClassesPage />} />
          <Route path="hoc-sinh" element={<StudentsPage />} />
          <Route path="lich-moc" element={<CalendarPage />} />
          <Route path="*" element={<Navigate to="bo-tu" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.login(password);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-medium uppercase tracking-wider text-teal-700">IELTS Vocab</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Đăng nhập quản trị</h1>
        <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="pw">Mật khẩu</label>
        <input id="pw" type="password" autoFocus autoComplete="current-password" className={`${inputCls} mt-1`} value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="mt-3"><ErrorBox error={error} /></div>
        <Button type="submit" className="mt-4 w-full" disabled={busy || !password}>{busy ? 'Đang kiểm tra…' : 'Đăng nhập'}</Button>
        {DEMO && <p className="mt-3 text-center text-xs text-amber-700">Chế độ demo: gõ mật khẩu bất kỳ.</p>}
      </form>
    </div>
  );
}

function LegacyLesson() {
  const { id } = useParams();
  return <Navigate to={`/admin/bo-tu/${id}`} replace />;
}
