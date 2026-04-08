import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { DAYS } from '../utils/constants';
import { useNotification } from '../context/NotificationContext';
import { useLeave } from '../context/LeaveContext';
import { exportTeacherTimetablePDF } from '../utils/exportUtils';

export default function TeacherPanel() {
  const { currentUser, logout } = useAuth();
  const { periods, classes, getTeacherSchedule, isTeacherAbsent } = useSchedule();
  const { getTeacherNotifications, markAllRead, showToast } = useNotification();
  const { leaves, applyLeave, loading: leavesLoading } = useLeave();

  const [activeTab, setActiveTab] = useState('timetable');
  const [leaveDay, setLeaveDay] = useState('Monday');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [documentLink, setDocumentLink] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);

  const notifications = getTeacherNotifications(currentUser?.id);
  const unreadCount = notifications.filter(n => n.unread).length;

  async function handleApplyLeave(e) {
    e.preventDefault();
    if (!leaveReason.trim()) {
      showToast('Please provide a reason for your leave.', 'error');
      return;
    }
    setSubmittingLeave(true);
    try {
      await applyLeave(currentUser.id, currentUser.name, leaveDay, leaveReason, documentLink, leaveDate);
      setLeaveReason('');
      setLeaveDate('');
      setDocumentLink('');
      showToast('Leave application submitted successfully!', 'success');
    } catch {
      showToast('Failed to submit leave. Please try again.', 'error');
    } finally {
      setSubmittingLeave(false);
    }
  }

  const myLeaves = leaves.filter(l => l.teacher_id === currentUser?.id);

  const teacherSchedule = getTeacherSchedule(currentUser?.id);

  return (
    <div className="app-layout">
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div className="mobile-brand">
          <span className="brand-icon">📚</span>
          <span className="brand-name">SchoolRoutine</span>
        </div>
        <button className="mobile-logout" onClick={logout} title="Logout">
          <span className="nav-icon">🚪</span>
        </button>
      </header>

      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">📚</span>
          <div>
            <div className="brand-name">SchoolRoutine</div>
            <div className="brand-role">Teacher Portal</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'timetable' ? 'active' : ''}`} onClick={() => setActiveTab('timetable')}>
            <span className="nav-icon">📅</span>
            <span className="nav-label">My Timetable</span>
          </button>
          <button className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={async () => { setActiveTab('notifications'); await markAllRead(currentUser?.id); }}>
            <span className="nav-icon">🔔</span>
            <span className="nav-label">Notifications</span>
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          <button className={`nav-item ${activeTab === 'leave' ? 'active' : ''}`} onClick={() => setActiveTab('leave')}>
            <span className="nav-icon">🌴</span>
            <span className="nav-label">Apply for Leave</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar-sm">{currentUser?.name?.[0]}</div>
            <div>
              <div className="user-name">{currentUser?.name}</div>
              <div className="user-role-label">Teacher</div>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>Sign Out</button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav">
        <button className={`mobile-nav-item ${activeTab === 'timetable' ? 'active' : ''}`} onClick={() => setActiveTab('timetable')}>
          <span className="nav-icon">📅</span>
          <span className="nav-label">Schedule</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={async () => { setActiveTab('notifications'); await markAllRead(currentUser?.id); }}>
          <div className="nav-icon-wrapper">
            <span className="nav-icon">🔔</span>
            {unreadCount > 0 && <span className="notif-badge-sm">{unreadCount}</span>}
          </div>
          <span className="nav-label">Alerts</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === 'leave' ? 'active' : ''}`} onClick={() => setActiveTab('leave')}>
          <span className="nav-icon">🌴</span>
          <span className="nav-label">Leave</span>
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'timetable' && (
          <div className="tab-content">
            <div className="tab-header">
              <div>
                <h2>My Timetable</h2>
                <p className="tab-desc">Your complete weekly schedule (view-only).</p>
              </div>
              <button className="btn-outline" onClick={() => exportTeacherTimetablePDF(currentUser?.name, teacherSchedule, classes, periods.filter(p => !p.isBreak))}>
                📄 Export PDF
              </button>
            </div>

            <div className="teacher-timetable-wrapper">
              <table className="timetable-table teacher-view-table">
                <thead>
                  <tr>
                    <th className="period-header-cell">Day</th>
                    {periods.map(period => (
                      <th key={period.id} className={`day-header ${period.isBreak ? 'break-header' : ''}`}>
                        <div>{period.label}</div>
                        {period.time && <div className="period-time">{period.time}</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => (
                    <tr key={day} className={isTeacherAbsent(currentUser?.id, day) ? 'absent-row' : ''}>
                      <td className="period-label-cell day-label-cell">
                        <strong>{day}</strong>
                        {isTeacherAbsent(currentUser?.id, day) && <span className="absent-day-badge">Absent</span>}
                      </td>
                      {periods.map(period => {
                        if (period.isBreak) {
                          return <td key={period.id} className="period-cell break-cell"><span>Break</span></td>;
                        }
                        const slots = teacherSchedule[day]?.[period.id] || [];
                        return (
                          <td key={period.id} className={`period-cell ${slots.length > 0 ? 'cell-filled teacher-cell' : 'cell-empty'} ${slots.some(s => s.isSubstitution) ? 'cell-substitute' : ''}`}>
                            {slots.length > 0 ? (
                              <div className="cell-assignments">
                                {slots.map((slot, idx) => {
                                  const cls = classes.find(c => c.id === slot.classId);
                                  return (
                                    <div key={idx} className={`cell-content ${slot.isSubstitution ? 'cell-substitute' : ''}`}>
                                      <span className="cell-subject">{slot.subject}</span>
                                      <span className="cell-class">{cls?.name || slot.classId}{slot.section ? ` (${slot.section})` : ''}</span>
                                      {slot.isSubstitution && <span className="cell-sub-badge">SUB</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="cell-placeholder">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="tab-content">
            <div className="tab-header">
              <h2>Notifications</h2>
              <p className="tab-desc">Substitution assignments and important alerts.</p>
            </div>
            <div className="notifications-list">
              {notifications.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔔</div>
                  <h3>All caught up!</h3>
                  <p>No notifications yet. You'll receive alerts here when you're assigned substitution classes.</p>
                </div>
              ) : (
                [...notifications].reverse().map(n => (
                  <div key={n.id} className={`notification-item ${n.unread ? 'unread' : ''}`}>
                    <div className="notif-icon">🔄</div>
                    <div className="notif-body">
                      <p className="notif-message">{n.message}</p>
                      <span className="notif-time">{new Date(n.timestamp).toLocaleString()}</span>
                    </div>
                    {n.unread && <span className="notif-dot" />}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'leave' && (
          <div className="tab-content">
            <div className="tab-header">
              <h2>Apply for Leave</h2>
              <p className="tab-desc">Submit a request for leave. Admin will review and check for substitutions.</p>
            </div>

            <div className="section-card max-w-2xl mx-auto">
              <form onSubmit={handleApplyLeave} className="leave-form">
                <div className="form-group">
                  <label>Day of Leave</label>
                  <select value={leaveDay} onChange={e => setLeaveDay(e.target.value)}>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Specific Date</label>
                  <input 
                    type="date" 
                    value={leaveDate} 
                    onChange={e => setLeaveDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Document Link (Google Drive, Dropbox, etc.)</label>
                  <input 
                    type="url" 
                    value={documentLink} 
                    onChange={e => setDocumentLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Reason / Remarks</label>
                  <textarea 
                    value={leaveReason} 
                    onChange={e => setLeaveReason(e.target.value)}
                    placeholder="e.g. Family function, Medical leave..."
                    rows="3"
                  ></textarea>
                </div>
                <button type="submit" className="btn-primary w-full" disabled={submittingLeave}>
                  {submittingLeave ? 'Submitting...' : 'Submit Application'}
                </button>
              </form>
            </div>

            <div className="section-card mt-6">
              <h3>My Leave History</h3>
              {leavesLoading ? (
                <p>Loading leave history...</p>
              ) : myLeaves.length === 0 ? (
                <p className="empty-hint">No leave applications found.</p>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Day / Date</th>
                        <th>Document</th>
                        <th>Reason</th>
                        <th>Applied On</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myLeaves.map(l => (
                        <tr key={l.id}>
                          <td>
                            <strong>{l.day}</strong>
                            {l.leave_date && <div className="text-xs text-dim">{l.leave_date}</div>}
                          </td>
                          <td>
                            {l.document_link ? (
                              <a href={l.document_link} target="_blank" rel="noopener noreferrer" className="text-link text-sm">
                                📄 View
                              </a>
                            ) : '—'}
                          </td>
                          <td className="text-sm">{l.reason}</td>
                          <td className="text-sm">{new Date(l.created_at).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge-${l.status}`}>
                              {l.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
