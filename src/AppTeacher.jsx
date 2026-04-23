import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScheduleProvider, useSchedule } from './context/ScheduleContext';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { LeaveProvider } from './context/LeaveContext';
import LoginPage from './pages/LoginPage';
import TeacherPanel from './pages/TeacherPanel';
import Toast from './components/Toast';

// Simplified ProtectedRoute for Teacher Portal
function TeacherProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  
  // Ensure admins don't accidentally use the teacher app logic if redirected here
  // But primarily focusing on teachers
  if (currentUser.status !== 'approved' && currentUser.role === 'teacher') {
    return <Navigate to="/pending" replace />;
  }
  
  return children;
}

function TeacherPendingPage() {
  const { logout, currentUser } = useAuth();
  return (
    <div className="pending-page">
      <div className="pending-card">
        <div className="pending-icon">⏳</div>
        <h2>Account Pending</h2>
        <p>Hi <strong>{currentUser?.name}</strong>, your account is awaiting approval.</p>
        <button className="btn-primary" onClick={logout}>Back to Login</button>
      </div>
    </div>
  );
}

function TeacherAppRoutes() {
  const { currentUser, loading: authLoading } = useAuth();
  const { loading: scheduleLoading } = useSchedule();
  const { loading: notifLoading } = useNotification();

  if (authLoading || scheduleLoading || notifLoading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Opening Teacher Portal...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={
        currentUser
          ? <Navigate to={currentUser.status === 'approved' ? '/teacher' : '/pending'} replace />
          : <LoginPage />
      } />
      <Route path="/pending" element={<TeacherPendingPage />} />
      <Route path="/teacher/*" element={
        <TeacherProtectedRoute><TeacherPanel /></TeacherProtectedRoute>
      } />
      {/* Default to teacher dashboard if authenticated */}
      <Route path="*" element={<Navigate to={currentUser ? "/teacher" : "/login"} replace />} />
    </Routes>
  );
}

export default function AppTeacher() {
  return (
    <AuthProvider>
      <ScheduleProvider>
        <NotificationProvider>
          <LeaveProvider>
            <BrowserRouter>
              <Toast />
              <TeacherAppRoutes />
            </BrowserRouter>
          </LeaveProvider>
        </NotificationProvider>
      </ScheduleProvider>
    </AuthProvider>
  );
}
