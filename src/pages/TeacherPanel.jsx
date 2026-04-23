import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { DAYS } from '../utils/constants';
import { useNotification } from '../context/NotificationContext';
import { useLeave } from '../context/LeaveContext';
import { exportTeacherTimetablePDF } from '../utils/exportUtils';
import { isWithinRadius, isLate } from '../utils/locationUtils';
import api from '../services/api';


export default function TeacherPanel() {
  const { currentUser, logout, updateUser } = useAuth();
  const { periods, classes, getTeacherSchedule, isTeacherAbsent } = useSchedule();
  const { getTeacherNotifications, markAllRead, showToast, notifPermission, requestNotificationPermission } = useNotification();

  const { leaves, applyLeave, loading: leavesLoading } = useLeave();

  const [activeTab, setActiveTab] = useState('timetable');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [documentLink, setDocumentLink] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [branch, setBranch] = useState(null);
  const [attendanceToday, setAttendanceToday] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [selectedDay, setSelectedDay] = useState('Monday');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    
    // Auto-detect current day
    const dayIndex = new Date().getDay(); // 0 (Sun) to 6 (Sat)
    const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = dayMap[dayIndex];
    
    if (DAYS.includes(currentDayName)) {
      setSelectedDay(currentDayName);
    } else {
      setSelectedDay('Monday'); // Default to Monday on weekends
    }

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (currentUser?.branchId) {
      api.branches.getAll().then(branches => {
        const myBranch = branches.find(b => b.id === currentUser.branchId);
        setBranch(myBranch);
      });
    }
    // Check if already marked today
    const today = new Date().toISOString().split('T')[0];
    api.attendance.getForTeacher(currentUser.id, today.substring(0, 7)).then(logs => {
      const todayLog = logs.find(l => l.date === today);
      setAttendanceToday(todayLog);
    });
  }, [currentUser]);


  const notifications = getTeacherNotifications(currentUser?.id);
  const unreadCount = notifications.filter(n => n.unread).length;

  async function handleApplyLeave(e) {
    e.preventDefault();
    if (!leaveDate) {
      showToast('Please select a leave date.', 'error');
      return;
    }
    if (!leaveReason.trim()) {
      showToast('Please provide a reason for your leave.', 'error');
      return;
    }
    // Auto-derive day-of-week from the selected date
    const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const derivedDay = dayMap[new Date(leaveDate + 'T00:00:00').getDay()];
    setSubmittingLeave(true);
    try {
      await applyLeave(currentUser.id, currentUser.name, derivedDay, leaveReason, documentLink, leaveDate);
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
    <div className={`app-layout ${isMobile ? 'mobile-layout' : ''}`}>
      {!isMobile && (
        <aside className="app-sidebar">
          <div className="sidebar-brand">
            <img src="/pwa-logo.png" style={{ width: '40px', height: '40px', borderRadius: '8px' }} alt="Logo" />
            <div>
              <div className="brand-name">RPB Routine</div>
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
            <button className={`nav-item ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
              <span className="nav-icon">📝</span>
              <span className="nav-label">Attendance & CL</span>
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
            <button className="logout-button-sidebar" onClick={logout}>
              <span className="icon">🚪</span>
              Sign Out
            </button>
          </div>

        </aside>
      )}

      {/* Mobile Top Header */}
      {isMobile && (
        <header className="mobile-header">
          <div className="mobile-brand">
            <img src="/pwa-logo.png" style={{ width: '32px', height: '32px', borderRadius: '6px' }} alt="Logo" />
            <span className="brand-name">RPB Routine</span>
          </div>

          <button className="mobile-logout-btn" onClick={logout} title="Logout">
            <span className="logout-icon">🚪</span>
            <span className="logout-text">Logout</span>
          </button>
        </header>
      )}


      {/* Mobile Bottom Navigation */}
      {isMobile && (
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
          <button className={`mobile-nav-item ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
            <span className="nav-icon">📍</span>
            <span className="nav-label">Check-in</span>
          </button>
          <button className={`mobile-nav-item ${activeTab === 'leave' ? 'active' : ''}`} onClick={() => setActiveTab('leave')}>
            <span className="nav-icon">🌴</span>
            <span className="nav-label">Leave</span>
          </button>
        </nav>
      )}

      <main className="app-main">
        {/* Personalized Greeting */}
        <div className="teacher-greeting-card">
          <div className="greeting-content">
            <h1>Hello, {currentUser?.name?.[0]?.toUpperCase() + currentUser?.name?.slice(1)}! 👋</h1>
            <p>Have a beautiful and productive day today.</p>
          </div>
          <div className="greeting-date">
            <span className="day-name">{selectedDay}</span>
            <span className="full-date">{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</span>
          </div>
        </div>

        {activeTab === 'timetable' && (
          <div className="tab-content">
            {isMobile ? (
              <div className="mobile-teacher-view">
                <div className="tab-header">
                  <h2>My Schedule</h2>
                  <p className="tab-desc">Auto-detected: Today is {selectedDay}</p>
                </div>

                <div className="mobile-day-switcher">
                  {DAYS.map(day => {
                    const isToday = day === selectedDay;
                    return (
                      <div 
                        key={day} 
                        className={`day-tab ${isToday ? 'active' : ''}`}
                        onClick={() => setSelectedDay(day)}
                      >
                        <span className="day-short">{day.substring(0, 3)}</span>
                        <span className="day-num">{DAYS.indexOf(day) + 1}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="period-cards-list">
                  {periods.map(period => {
                    if (period.isBreak) return null;
                    const slots = teacherSchedule[selectedDay]?.[period.id] || [];
                    return (
                      <div key={period.id} className="period-card">
                        <div className="period-time-col">
                          <span className="period-label-large">{period.label}</span>
                        </div>
                        <div className="period-info-col">

                          {slots.map((slot, idx) => {
                            const cls = classes.find(c => c.id === slot.classId);
                            return (
                              <div key={idx} className="slot-item">
                                <div className="subject-name">{slot.subject}</div>
                                <div className="class-name">
                                  <span>🏫 {cls?.name || slot.classId}</span>
                                  <span>🚪 Section {slot.section}</span>
                                </div>
                                {slot.isSubstitution && (
                                  <span className="period-status-badge badge-substitution">SUBSTITUTION</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {(!teacherSchedule[selectedDay] || Object.keys(teacherSchedule[selectedDay]).filter(pid => !periods.find(p => p.id === pid)?.isBreak).length === 0) && (
                    <div className="mobile-empty-routine">
                      <div className="icon">🌴</div>
                      <h4>No Classes Scheduled</h4>
                      <p>Time to relax or catch up on paperwork!</p>
                    </div>
                  )}
                </div>
                
                <button className="btn-outline mt-4" onClick={() => exportTeacherTimetablePDF(currentUser?.name, teacherSchedule, classes, periods.filter(p => !p.isBreak))}>
                  📄 Export Weekly PDF
                </button>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="tab-content">
            <div className="tab-header">
              <h2>Notifications</h2>
              <p className="tab-desc">Substitution assignments and important alerts.</p>
            </div>

            {notifPermission !== 'granted' && (
              <div className="notif-permission-banner">
                <div className="banner-icon">🔔</div>
                <div className="banner-text">
                  <h4>Enable System Alerts?</h4>
                  <p>Get notified instantly on your phone when you are assigned a substitution.</p>
                </div>
                <button className="btn-primary-sm" onClick={() => {
                  requestNotificationPermission().then(res => {
                    if (res === 'granted') showToast('Notifications enabled!', 'success');
                    else if (res === 'denied') showToast('Permission denied. Please check your browser settings.', 'error');
                  });
                }}>Enable</button>
              </div>
            )}

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
                  <label>Date of Leave</label>
                  <input 
                    type="date" 
                    value={leaveDate} 
                    onChange={e => setLeaveDate(e.target.value)}
                    required
                  />
                  {leaveDate && (
                    <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>
                      📅 {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(leaveDate + 'T00:00:00').getDay()]}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Document Link <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional — Google Drive, Dropbox, etc.)</span></label>
                  <input 
                    type="url" 
                    value={documentLink} 
                    onChange={e => setDocumentLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
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
                        <th>Date</th>
                        <th>Day</th>
                        <th>Document</th>
                        <th>Reason</th>
                        <th>Applied On</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myLeaves.map(l => (
                        <tr key={l.id}>
                          <td><strong>{l.leave_date || '—'}</strong></td>
                          <td><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{l.day}</span></td>
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
        {activeTab === 'attendance' && (
          <div className="tab-content">
            <div className="tab-header">
              <h2>Attendance & Check-in</h2>
              <p className="tab-desc">Mark your daily presence and track your leave balance.</p>
            </div>

            <div className={`${isMobile ? 'mobile-attendance-view' : 'two-col-grid'}`}>
              <div className={isMobile ? 'mb-6' : ''}>
                {isMobile ? (
                  <div className="at-cl-mini-card mb-4">
                    <div className="cl-mini-info">
                      <span className="cl-mini-label">Remaining CL</span>
                      <span className="cl-mini-val">{currentUser.remainingCl || 0}</span>
                    </div>
                    <div className="cl-mini-info text-right">
                      <span className="cl-mini-label">Total Allocated</span>
                      <span className="cl-mini-val" style={{ color: 'var(--text-muted)' }}>{currentUser.totalCl || 0}</span>
                    </div>
                  </div>
                ) : (
                  <div className="section-card">
                    <h3>Leave Balance</h3>
                    <div className="cl-balance-card">
                      <div className="cl-balance-main">
                        <span className="cl-value">{currentUser.remainingCl || 0}</span>
                        <span className="cl-label">Remaining CL</span>
                      </div>
                      <div className="cl-total">Out of {currentUser.totalCl || 0} Total</div>
                    </div>
                  </div>
                )}
                
                {!isMobile && (
                  <div className="branch-info-card mt-4">
                    <strong>Assigned Branch:</strong>
                    <div>{branch?.name || (currentUser.branchId ? 'Loading...' : 'Not Assigned')}</div>
                    {branch && <div className="text-xs text-dim">Location: {branch.latitude}, {branch.longitude}</div>}
                  </div>
                )}
              </div>

              <div className={isMobile ? '' : 'section-card'}>
                {!isMobile && <h3>Today's Attendance</h3>}
                
                {attendanceToday ? (
                  isMobile ? (
                    <div className="mobile-attendance-card success">
                      <div className="at-card-header">
                        <div className="at-card-title">
                          <h3>Checked In</h3>
                          <div className="at-location-status in-radius">
                            <span>📍 {branch?.name || 'School Branch'}</span>
                          </div>
                        </div>
                        <span className="status-icon">✅</span>
                      </div>
                      <div className="at-attendance-meta">
                        <div className="status-title">Status: {attendanceToday.status.toUpperCase()}</div>
                        <div className="status-time">Time: {attendanceToday.time}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="attendance-status-card success">
                      <div className="status-icon">✅</div>
                      <div>
                        <div className="status-title">Marked as {attendanceToday.status.toUpperCase()}</div>
                        <div className="status-time">At {attendanceToday.time}</div>
                        <div className="text-xs text-dim mt-1">📍 {branch?.name}</div>
                      </div>
                    </div>
                  )
                ) : (
                  isMobile ? (
                    <div className="mobile-attendance-card">
                      <div className="at-card-header">
                        <div className="at-card-title">
                          <h3>Daily Check-in</h3>
                          <div className={`at-location-status ${branch ? 'in-radius' : 'out-radius'}`}>
                            <span>📍 {branch?.name || 'No Branch Assigned'}</span>
                          </div>
                        </div>
                        <span className="status-icon">🕙</span>
                      </div>
                      
                      <p className="text-sm text-dim">Please ensure you are within the school campus (100m) to mark your attendance.</p>
                      
                      <button 
                        className="at-mark-button" 
                        disabled={markingAttendance || !branch}
                        onClick={async () => {
                          if (attendanceToday) return;
                          if (!branch) return showToast('Contact admin to assign a branch.', 'warning');
                          setMarkingAttendance(true);
                          
                          navigator.geolocation.getCurrentPosition(async (pos) => {
                            const { latitude, longitude } = pos.coords;
                            
                            if (!isWithinRadius(branch.latitude, branch.longitude, latitude, longitude, 100)) {
                              showToast('Out of Range: You must be at the school location.', 'error');
                              setMarkingAttendance(false);
                              return;
                            }

                            const now = new Date();
                            const currentTime = now.toTimeString().split(' ')[0];
                            const status = isLate(currentTime, branch.late_threshold) ? 'late' : 'present';
                            
                            const record = {
                              id: 'att_' + Date.now(),
                              teacher_id: currentUser.id,
                              branch_id: branch.id,
                              date: now.toISOString().split('T')[0],
                              time: currentTime,
                              status,
                              latitude,
                              longitude
                            };

                            try {
                              await api.attendance.mark(record);
                              setAttendanceToday(record);
                              showToast(`Checked in successfully as ${status}!`, 'success');

                              if (status === 'late') {
                                 const month = now.toISOString().substring(0, 7);
                                 const monthLogs = await api.attendance.getForTeacher(currentUser.id, month);
                                 const lates = monthLogs.filter(l => l.status === 'late').length;
                                 if (lates > 0 && lates % 3 === 0) {
                                    const newRemaining = Math.max(0, (currentUser.remainingCl || 0) - 1);
                                    await updateUser(currentUser.id, { remainingCl: newRemaining });
                                    showToast('CL Deduction: 1 Day deducted for 3 late check-ins.', 'info');
                                 }
                              }
                            } catch (err) {
                              showToast('System Error: Failed to mark attendance.', 'error');
                            } finally {
                              setMarkingAttendance(false);
                            }
                          }, (err) => {
                            showToast('GPS Error: Please enable location services.', 'error');
                            setMarkingAttendance(false);
                          }, { enableHighAccuracy: true });
                        }}
                      >
                        {markingAttendance ? 'Verifying...' : '✅ Mark Attendance'}
                      </button>
                    </div>
                  ) : (
                    <div className="attendance-mark-box">
                      <p className="text-sm mb-4">You must be at the school location to mark your attendance.</p>
                      <button 
                        className="btn-primary w-full" 
                        disabled={markingAttendance || !branch}
                        onClick={async () => {
                          if (attendanceToday) return;
                          if (!branch) return showToast('Contact admin to assign a branch.', 'warning');
                          setMarkingAttendance(true);
                          
                          navigator.geolocation.getCurrentPosition(async (pos) => {
                            const { latitude, longitude } = pos.coords;
                            
                            if (!isWithinRadius(branch.latitude, branch.longitude, latitude, longitude, 100)) {
                              showToast('You are outside the school location.', 'error');
                              setMarkingAttendance(false);
                              return;
                            }

                            const now = new Date();
                            const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
                            const status = isLate(currentTime, branch.late_threshold) ? 'late' : 'present';
                            
                            const record = {
                              id: 'att_' + Date.now(),
                              teacher_id: currentUser.id,
                              branch_id: branch.id,
                              date: now.toISOString().split('T')[0],
                              time: currentTime,
                              status,
                              latitude,
                              longitude
                            };

                            try {
                              await api.attendance.mark(record);
                              setAttendanceToday(record);
                              showToast(`Attendance marked as ${status}!`, 'success');

                              // Deduct CL if 3rd late
                              if (status === 'late') {
                                 const month = now.toISOString().substring(0, 7);
                                 const monthLogs = await api.attendance.getForTeacher(currentUser.id, month);
                                 const lates = monthLogs.filter(l => l.status === 'late').length;
                                 if (lates > 0 && lates % 3 === 0) {
                                    const newRemaining = Math.max(0, (currentUser.remainingCl || 0) - 1);
                                    await updateUser(currentUser.id, { remainingCl: newRemaining });
                                    showToast('1 CL deducted for 3 late attendances this month.', 'info');
                                 }
                              }
                            } catch (err) {
                              showToast('Failed to mark attendance.', 'error');
                            } finally {
                              setMarkingAttendance(false);
                            }
                          }, () => {
                            showToast('Please enable GPS to mark attendance.', 'error');
                            setMarkingAttendance(false);
                          });
                        }}
                      >
                        {markingAttendance ? 'Checking Location...' : '📍 Mark Present'}
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
