// KHU HỌC SINH — Claude 2. Mount tại /hoc/* (src/App.tsx của sếp).
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
// Chữ có chân "sách" (có bộ chữ tiếng Việt; trình duyệt chỉ tải phần chữ cần dùng)
import '@fontsource/cormorant-sc/600.css';
import '@fontsource/cormorant-sc/700.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BottomNav, SideNav } from './components/BottomNav';
import { Spinner } from './components/ui';
import LessonPage from './lesson/LessonPage';
import PracticePage from './lesson/PracticePage';
import Home, { Assignments } from './pages/Home';
import MyWords from './pages/MyWords';
import Progress from './pages/Progress';
import Login from './pages/Login';
import { SessionProvider, useSession } from './session';

function RequireLogin() {
  const { me } = useSession();
  if (me === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!me) return <Navigate to="/hoc/dang-nhap" replace />;
  return <Outlet />;
}

/** Khung có điều hướng: điện thoại = thanh dưới; máy tính = thanh bên trái + nội dung rộng */
function WithNav() {
  return (
    <div className="lg:flex lg:min-h-dvh">
      <SideNav />
      <div className="mx-auto w-full max-w-md pb-24 lg:max-w-5xl lg:px-8 lg:pb-12 lg:pt-6">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}

export default function StudentApp() {
  return (
    <div className="student-root">
      <SessionProvider>
        <Routes>
          <Route path="dang-nhap" element={<Login />} />
          <Route element={<RequireLogin />}>
            <Route element={<WithNav />}>
              <Route index element={<Home />} />
              <Route path="tien-do" element={<Progress />} />
              <Route path="kho-tu" element={<MyWords />} />
              <Route path="bai-can-lam" element={<Assignments />} />
            </Route>
            <Route path="bai/:milestoneId" element={<LessonPage />} />
            <Route path="luyen-them" element={<PracticePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/hoc" replace />} />
        </Routes>
      </SessionProvider>
    </div>
  );
}
