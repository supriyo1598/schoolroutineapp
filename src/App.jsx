import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScheduleProvider, useSchedule } from './context/ScheduleContext';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { LeaveProvider } from './context/LeaveContext';
import LoginPage from './pages/LoginPage';
import AdminPanel from './pages/AdminPanel';
import TeacherPanel from './pages/TeacherPanel';
import Toast from './components/Toast';

function ProtectedRoute({ children, allowedRole }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (allowedRole === 'admin' && currentUser.role !== 'admin') return <Navigate to="/teacher" replace />;
  if (allowedRole === 'teacher') {
    if (currentUser.role === 'admin') return <Navigate to="/admin" replace />;
    if (currentUser.status !== 'approved') return <Navigate to="/pending" replace />;
  }
  return children;
}

function PendingPage() {
  const { logout, currentUser } = useAuth();
  return (
    <div className="pending-page">
      <div className="pending-card">
        <div className="pending-icon">⏳</div>
        <h2>Account Pending Approval</h2>
        <p>Hi <strong>{currentUser?.name}</strong>, your registration is under review.</p>
        <p className="pending-sub">An administrator will review and approve your account shortly.</p>
        <button className="btn-primary" onClick={logout}>Back to Login</button>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { currentUser, loading: authLoading } = useAuth();
  const { loading: scheduleLoading } = useSchedule();
  const { loading: notifLoading } = useNotification();

  if (authLoading || scheduleLoading || notifLoading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Initializing Service...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={
        currentUser
          ? <Navigate to={currentUser.role === 'admin' ? '/admin' : currentUser.status === 'approved' ? '/teacher' : '/pending'} replace />
          : <LoginPage />
      } />
      <Route path="/pending" element={<PendingPage />} />
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRole="admin"><AdminPanel /></ProtectedRoute>
      } />
      <Route path="/teacher/*" element={
        <ProtectedRoute allowedRole="teacher"><TeacherPanel /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <ScheduleProvider>
        <NotificationProvider>
          <LeaveProvider>
            <BrowserRouter>
              <Toast />
              <AppRoutes />
            </BrowserRouter>
          </LeaveProvider>
        </NotificationProvider>
      </ScheduleProvider>
    </AuthProvider>
  );
}

export default App;
