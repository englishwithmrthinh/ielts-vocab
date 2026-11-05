/**
 * Router gốc — chủ sở hữu: Sếp. Ba khu, mỗi khu một người phụ trách:
 *   /hoc/*            → src/student  (Claude 2)
 *   /admin/*          → src/admin    (Claude 3)
 *   /bao-cao/:token   → src/parent   (Claude 2)
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import StudentApp from './student/StudentApp';
import AdminApp from './admin/AdminApp';
import ParentReport from './parent/ParentReport';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/hoc" replace />} />
      <Route path="/hoc/*" element={<StudentApp />} />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/bao-cao/:token" element={<ParentReport />} />
      <Route path="*" element={<Navigate to="/hoc" replace />} />
    </Routes>
  );
}
