import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const { showToast } = useNotification();
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({ name: '', username: '', password: '', confirmPassword: '', email: '', phone: '' });
  const [pendingMsg, setPendingMsg] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(loginForm.username.trim(), loginForm.password);
      if (!result.success) {
        if (result.error === 'pending') {
          setPendingMsg(`Hi ${result.user.name}! Your account is pending admin approval.`);
        } else {
          showToast(result.error, 'error');
        }
      }
    } catch (err) {
      showToast('Login failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (regForm.password !== regForm.confirmPassword) {
      showToast('Passwords do not match.', 'error'); return;
    }
    if (regForm.password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error'); return;
    }
    setLoading(true);
    try {
      const result = await register({
        name: regForm.name.trim(),
        username: regForm.username.trim(),
        password: regForm.password,
        email: regForm.email.trim(),
        phone: regForm.phone.trim(),
      });
      if (result.success) {
        showToast('Registration submitted! Awaiting admin approval.', 'success');
        setTab('login');
        setRegForm({ name: '', username: '', password: '', confirmPassword: '', email: '', phone: '' });
      } else {
        showToast(result.error, 'error');
      }
    } catch (err) {
      showToast('Registration failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
      </div>
      <div className="login-container">
        <div className="login-brand">
          <div className="login-logo">📚</div>
          <h1>SchoolRoutine</h1>
          <p>Smart Timetable Management System</p>
        </div>

        <div className="login-card">
          {pendingMsg ? (
            <div className="pending-notice">
              <div className="pending-icon-sm">⏳</div>
              <p>{pendingMsg}</p>
              <button className="btn-ghost" onClick={() => setPendingMsg('')}>← Back</button>
            </div>
          ) : (
            <>
              <div className="login-tabs">
                <button className={`login-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Sign In</button>
                <button className={`login-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Register</button>
              </div>

              {tab === 'login' ? (
                <form className="login-form" onSubmit={handleLogin}>
                  <div className="login-hint">
                    <span>Admin login: <code>admin / admin123</code></span>
                  </div>
                  <div className="form-group">
                    <label>Username</label>
                    <input
                      type="text" required placeholder="Enter username"
                      value={loginForm.username}
                      onChange={e => setLoginForm(p => ({ ...p, username: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password" required placeholder="Enter password"
                      value={loginForm.password}
                      onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                    />
                  </div>
                  <button type="submit" className="btn-login" disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </form>
              ) : (
                <form className="login-form" onSubmit={handleRegister}>
                  <p className="register-info">Register as a teacher. An admin will review and approve your account.</p>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Full Name</label>
                      <input type="text" required placeholder="Your full name" value={regForm.name} onChange={e => setRegForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Username</label>
                      <input type="text" required placeholder="Choose a username" value={regForm.username} onChange={e => setRegForm(p => ({ ...p, username: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" required placeholder="your@email.com" value={regForm.email} onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Phone (optional)</label>
                    <input type="tel" placeholder="Phone number" value={regForm.phone} onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Password</label>
                      <input type="password" required placeholder="Min 6 characters" value={regForm.password} onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Confirm Password</label>
                      <input type="password" required placeholder="Repeat password" value={regForm.confirmPassword} onChange={e => setRegForm(p => ({ ...p, confirmPassword: e.target.value }))} />
                    </div>
                  </div>
                  <button type="submit" className="btn-login" disabled={loading}>
                    {loading ? 'Submitting…' : 'Request Access'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
