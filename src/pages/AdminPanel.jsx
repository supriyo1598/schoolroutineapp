import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { useSchedule } from '../context/ScheduleContext';
import { DAYS } from '../utils/constants';
import { useNotification } from '../context/NotificationContext';
import { useLeave } from '../context/LeaveContext';
import { findSubstitutes } from '../utils/substitutionEngine';
import TimetableGrid from '../components/TimetableGrid';
import SubstitutionPanel from '../components/SubstitutionPanel';
import { exportClassTimetablePDF, exportAllClassesPDF } from '../utils/exportUtils';

const TABS = [
  { id: 'timetable', label: '📅 Timetable', icon: '📅' },
  { id: 'teachers', label: '👩‍🏫 Teachers', icon: '👩‍🏫' },
  { id: 'classes', label: '🏫 Classes', icon: '🏫' },
  { id: 'periods', label: '⏰ Periods', icon: '⏰' },
  { id: 'substitutions', label: '🔄 Substitutions', icon: '🔄' },
  { id: 'users', label: '👥 Users', icon: '👥' },
  { id: 'notifications', label: '🔔 Broadcast', icon: '🔔' },
  { id: 'leaves', label: '🌴 Leave Requests', icon: '🌴' },
  { id: 'supabase', label: '☁️ Cloud Sync', icon: '☁️' },
];

// ===== Teachers Tab =====
function TeachersTab() {
  const { getAllTeachers, updateTeacher, deleteUser } = useAuth();
  const { subjects, classes, getTeacherSchedule, periods, isTeacherAbsent } = useSchedule();
  const { showToast } = useNotification();
  const [editingId, setEditingId] = useState(null);
  const [viewingTimelineId, setViewingTimelineId] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', subjects: [], classes: [] });
  const [showForm, setShowForm] = useState(false);

  const teachers = getAllTeachers().filter(u => u.status === 'approved');

  function openEdit(teacher) {
    setForm({ name: teacher.name, email: teacher.email || '', phone: teacher.phone || '', subjects: teacher.subjects || [], classes: teacher.classes || [] });
    setEditingId(teacher.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: '', email: '', phone: '', subjects: [], classes: [] });
  }

  async function saveEdit() {
    await updateTeacher(editingId, { name: form.name, email: form.email, phone: form.phone, subjects: form.subjects, classes: form.classes });
    showToast('Teacher updated.', 'success');
    closeForm();
  }

  function toggleItem(arr, item) {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
  }

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Teacher Management</h2>
        <p className="tab-desc">Manage approved teachers, assign subjects and classes.</p>
      </div>

      {viewingTimelineId && (
        <div className="modal-overlay">
          <div className="modal modal-lg" style={{ maxWidth: '90%' }}>
            <div className="modal-header">
              <h3>{teachers.find(t => t.id === viewingTimelineId)?.name}'s Timetable</h3>
              <button className="modal-close" onClick={() => setViewingTimelineId(null)}>×</button>
            </div>
            <div className="modal-body" style={{ overflowX: 'auto' }}>
              <table className="timetable-table teacher-view-table">
                <thead>
                  <tr>
                    <th className="period-header-cell">Period</th>
                    {DAYS.map(day => (
                      <th key={day} className={`day-header ${isTeacherAbsent(viewingTimelineId, day) ? 'absent-column' : ''}`}>
                        {day}
                        {isTeacherAbsent(viewingTimelineId, day) && <span className="absent-day-badge">Absent</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map(period => (
                    <tr key={period.id} className={period.isBreak ? 'break-row' : ''}>
                      <td className="period-label-cell">
                        <strong>{period.label}</strong>
                        {period.time && <span className="period-time">{period.time}</span>}
                      </td>
                      {period.isBreak
                        ? <td colSpan={DAYS.length} className="break-span">— {period.label} —</td>
                        : DAYS.map(day => {
                            const slots = getTeacherSchedule(viewingTimelineId)[day]?.[period.id] || [];
                            return (
                              <td key={day} className={`period-cell ${slots.length > 0 ? 'cell-filled teacher-cell' : 'cell-empty'} ${slots.some(s => s.isSubstitution) ? 'cell-substitute' : ''}`}>
                                {slots.length > 0 ? (
                                  <div className="cell-assignments">
                                    {slots.map((slot, idx) => {
                                      const cls = classes.find(c => c.id === slot.classId);
                                      return (
                                        <div key={idx} className={`cell-content ${slot.isSubstitution ? 'cell-substitute' : ''}`}>
                                          <span className="cell-subject">{slot.subject}</span>
                                          <span className="cell-class">{cls?.name || slot.classId} {slot.section ? `(${slot.section})` : ''}</span>
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
                          })
                      }
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {showForm && editingId && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Edit Teacher</h3>
              <button className="modal-close" onClick={closeForm}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Subjects (select all that apply)</label>
                <div className="chip-grid">
                  {subjects.map(s => (
                    <button key={s} type="button"
                      className={`chip-toggle ${form.subjects.includes(s) ? 'active' : ''}`}
                      onClick={() => setForm(p => ({ ...p, subjects: toggleItem(p.subjects, s) }))}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Assigned Classes (select all that apply)</label>
                <div className="chip-grid">
                  {classes.map(c => (
                    <button key={c.id} type="button"
                      className={`chip-toggle ${form.classes.includes(c.id) ? 'active' : ''}`}
                      onClick={() => setForm(p => ({ ...p, classes: toggleItem(p.classes, c.id) }))}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={closeForm}>Cancel</button>
              <button className="btn-primary" onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Username</th><th>Email</th><th>Subjects</th><th>Classes</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 && <tr><td colSpan={6} className="empty-row">No approved teachers yet. Approve teachers in the Users tab.</td></tr>}
            {teachers.map(t => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td>
                <td><code>{t.username}</code></td>
                <td>{t.email || '—'}</td>
                <td>
                  <div className="tag-list">
                    {(t.subjects || []).map(s => <span key={s} className="tag tag-blue">{s}</span>)}
                    {(!t.subjects || t.subjects.length === 0) && <span className="tag-none">None assigned</span>}
                  </div>
                </td>
                <td>
                  <div className="tag-list">
                    {(t.classes || []).map(cId => {
                      const cls = classes.find(c => c.id === cId);
                      return cls ? <span key={cId} className="tag tag-green">{cls.name}</span> : null;
                    })}
                    {(!t.classes || t.classes.length === 0) && <span className="tag-none">All classes</span>}
                  </div>
                </td>
                <td>
                  <div className="action-btns">
                    <button className="btn-outline-sm" onClick={() => setViewingTimelineId(t.id)}>Timeline</button>
                    <button className="btn-edit" onClick={() => openEdit(t)}>Edit</button>
                    <button className="btn-danger-sm" onClick={async () => { await deleteUser(t.id); showToast('Teacher deleted.', 'info'); }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== Classes Tab =====
function ClassesTab() {
  const { classes, subjects, dispatch } = useSchedule();
  const { showToast } = useNotification();
  const [newClass, setNewClass] = useState('');
  const [addingSubject, setAddingSubject] = useState('');

  function addClass() {
    if (!newClass.trim()) return;
    const id = 'cls_' + Date.now();
    dispatch({ type: 'UPDATE_CLASSES', payload: [...classes, { id, name: newClass.trim(), sections: ['A', 'B'] }] });
    setNewClass('');
    showToast('Class added (Default: Section A, B).', 'success');
  }

  function updateSections(id, commaString) {
    const sectionList = commaString.split(',').map(s => s.trim()).filter(Boolean);
    if (sectionList.length === 0) return;
    const updated = classes.map(c => c.id === id ? { ...c, sections: sectionList } : c);
    dispatch({ type: 'UPDATE_CLASSES', payload: updated });
  }

  function deleteClass(id) {
    dispatch({ type: 'UPDATE_CLASSES', payload: classes.filter(c => c.id !== id) });
    showToast('Class removed.', 'info');
  }

  function addSubject() {
    if (!addingSubject.trim() || subjects.includes(addingSubject.trim())) return;
    dispatch({ type: 'UPDATE_SUBJECTS', payload: [...subjects, addingSubject.trim()] });
    setAddingSubject('');
  }

  function deleteSubject(s) {
    dispatch({ type: 'UPDATE_SUBJECTS', payload: subjects.filter(x => x !== s) });
  }

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Class & Subject Configuration</h2>
        <p className="tab-desc">Manage Grade I–XII classes and define available subjects.</p>
      </div>
      <div className="two-col-grid">
        <div className="section-card">
          <h3>Classes</h3>
          <div className="input-row">
            <input value={newClass} onChange={e => setNewClass(e.target.value)} placeholder="e.g. Grade XI Science" />
            <button className="btn-primary" onClick={addClass}>Add Class</button>
          </div>
          <div className="list-items">
            {classes.map(c => (
              <div key={c.id} className="list-item class-management-item">
                <div className="class-main-info">
                  <span className="class-name-label">{c.name}</span>
                  <div className="section-editor">
                    <span className="tiny-label">Sections:</span>
                    <input 
                      className="section-csv-input"
                      value={c.sections?.join(', ') || ''} 
                      onChange={e => updateSections(c.id, e.target.value)}
                      placeholder="A, B, C"
                    />
                  </div>
                </div>
                <button className="btn-danger-sm" onClick={() => deleteClass(c.id)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
        <div className="section-card">
          <h3>Subjects</h3>
          <div className="input-row">
            <input value={addingSubject} onChange={e => setAddingSubject(e.target.value)} placeholder="e.g. Economics" />
            <button className="btn-primary" onClick={addSubject}>Add</button>
          </div>
          <div className="chip-grid mt-2">
            {subjects.map(s => (
              <div key={s} className="chip-removable">
                <span>{s}</span>
                <button onClick={() => deleteSubject(s)}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Periods Tab =====
function PeriodsTab() {
  const { periods, dispatch } = useSchedule();
  const { showToast } = useNotification();

  function updatePeriod(id, field, value) {
    const updated = periods.map(p => p.id === id ? { ...p, [field]: value } : p);
    dispatch({ type: 'UPDATE_PERIODS', payload: updated });
  }

  function addPeriod() {
    const id = 'p_' + Date.now();
    dispatch({ type: 'UPDATE_PERIODS', payload: [...periods, { id, label: `Period ${periods.filter(p => !p.isBreak).length + 1}`, time: '', isBreak: false }] });
    showToast('Period added.', 'success');
  }

  function removePeriod(id) {
    dispatch({ type: 'UPDATE_PERIODS', payload: periods.filter(p => p.id !== id) });
  }

  function toggleBreak(id) {
    const updated = periods.map(p => p.id === id ? { ...p, isBreak: !p.isBreak } : p);
    dispatch({ type: 'UPDATE_PERIODS', payload: updated });
  }

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Period Configuration</h2>
        <p className="tab-desc">Configure period labels, time slots, and breaks.</p>
      </div>
      <div className="section-card">
        <div className="periods-list">
          {periods.map((p, i) => (
            <div key={p.id} className={`period-config-row ${p.isBreak ? 'break-config' : ''}`}>
              <span className="period-num">#{i + 1}</span>
              <input className="period-input-label" value={p.label} onChange={e => updatePeriod(p.id, 'label', e.target.value)} placeholder="Label" />
              <input className="period-input-time" value={p.time || ''} onChange={e => updatePeriod(p.id, 'time', e.target.value)} placeholder="08:00 - 08:45" />
              <label className="break-toggle">
                <input type="checkbox" checked={p.isBreak || false} onChange={() => toggleBreak(p.id)} />
                Break
              </label>
              <button className="btn-danger-sm" onClick={() => removePeriod(p.id)}>Remove</button>
            </div>
          ))}
        </div>
        <button className="btn-primary mt-2" onClick={addPeriod}>+ Add Period</button>
      </div>
    </div>
  );
}

// ===== Users Tab =====
function UsersTab() {
  const { getAllTeachers, approveUser, rejectUser, deleteUser } = useAuth();
  const { showToast } = useNotification();
  const teachers = getAllTeachers();

  const pending = teachers.filter(t => t.status === 'pending');

  function StatusBadge({ status }) {
    const cls = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' }[status] || '';
    return <span className={`status-badge ${cls}`}>{status}</span>;
  }

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>User Management</h2>
        <p className="tab-desc">Review teacher registration requests and manage access.</p>
      </div>

      {pending.length > 0 && (
        <div className="pending-section">
          <h3 className="section-label pending-heading">⏳ Pending Approval ({pending.length})</h3>
          <div className="user-cards">
            {pending.map(t => (
              <div key={t.id} className="user-card pending-card-item">
                <div className="user-card-info">
                  <div className="user-avatar">{t.name[0]}</div>
                  <div>
                    <strong>{t.name}</strong>
                    <div><code>{t.username}</code> · {t.email}</div>
                    <div className="user-date">{new Date(t.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="user-card-actions">
                  <button className="btn-approve" onClick={async () => { await approveUser(t.id); showToast(`${t.name} approved!`, 'success'); }}>✓ Approve</button>
                  <button className="btn-reject" onClick={async () => { await rejectUser(t.id); showToast(`${t.name} rejected.`, 'info'); }}>✕ Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 className="section-label">All Teachers</h3>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Status</th><th>Registered</th><th>Actions</th></tr></thead>
          <tbody>
            {teachers.length === 0 && <tr><td colSpan={6} className="empty-row">No teacher registrations yet.</td></tr>}
            {teachers.map(t => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td>
                <td><code>{t.username}</code></td>
                <td>{t.email || '—'}</td>
                <td><StatusBadge status={t.status} /></td>
                <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="action-btns">
                    {t.status !== 'approved' && <button className="btn-approve-sm" onClick={async () => { await approveUser(t.id); showToast('Approved!', 'success'); }}>Approve</button>}
                    {t.status !== 'rejected' && <button className="btn-reject-sm" onClick={async () => { await rejectUser(t.id); showToast('Rejected.', 'info'); }}>Reject</button>}
                    <button className="btn-danger-sm" onClick={async () => { await deleteUser(t.id); showToast('Deleted.', 'info'); }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== Timetable Tab =====
function TimetableTab() {
  const { classes, schedule, periods } = useSchedule();
  const { getApprovedTeachers } = useAuth();
  const { showToast } = useNotification();
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || '');
  const [selectedSection, setSelectedSection] = useState('A');
  const teachers = getApprovedTeachers();

  const cls = classes.find(c => c.id === selectedClass);
  const sections = useMemo(() => cls?.sections || ['A'], [cls]);

  // Ensure we use a valid section even if state is temporarily out of sync
  const activeSection = useMemo(() => 
    sections.includes(selectedSection) ? selectedSection : sections[0]
  , [sections, selectedSection]);

  const scheduleKey = `${selectedClass}__${activeSection}`;

  function handleExportSection() {
    try {
      exportClassTimetablePDF(cls?.name || selectedClass, activeSection, schedule[scheduleKey] || {}, teachers, periods.filter(p => !p.isBreak));
      showToast('Export successful!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Export failed: ' + err.message, 'error');
    }
  }

  function handleExportAll() {
    try {
      exportAllClassesPDF(classes, schedule, teachers, periods.filter(p => !p.isBreak));
      showToast('Export successful!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Export failed: ' + err.message, 'error');
    }
  }

  return (
    <div className="tab-content timetable-tab">
      <div className="tab-header timetable-header">
        <div>
          <h2>Timetable Builder</h2>
          <p className="tab-desc">Drag teachers to assign them to periods for this section.</p>
        </div>
        <div className="timetable-controls">
          <select className="class-select" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="section-select" value={activeSection} onChange={e => setSelectedSection(e.target.value)}>
            {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
          <button className="btn-outline" onClick={handleExportSection}>
            📄 Export Section PDF
          </button>
          <button className="btn-outline" onClick={handleExportAll}>
            📄 Export All
          </button>
        </div>
      </div>
      {selectedClass && <TimetableGrid selectedClass={selectedClass} selectedSection={activeSection} />}
    </div>
  );
}

// ===== Supabase Tab =====
function SupabaseTab() {
  const { users } = useAuth();
  const scheduleContext = useSchedule();
  const { showToast } = useNotification();
  const [syncing, setSyncing] = useState(false);

  const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

  async function handleSync() {
    if (!isConfigured) {
      showToast('Supabase not configured in .env', 'error');
      return;
    }
    setSyncing(true);
    try {
      // Sync Users
      await api.users.saveAll(users);
      
      // Sync Full Schedule State
      const { 
        classes, periods, subjects, schedule, substitutions, absentTeachers 
      } = scheduleContext;
      
      await api.schedule.save({ 
        classes, periods, subjects, schedule, substitutions, absentTeachers 
      });
      
      showToast('Global data synced successfully!', 'success');
    } catch (err) {
      showToast('Sync failed: ' + err.message, 'error');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Cloud Configuration</h2>
        <p className="tab-desc">Manage your Supabase connection and synchronize local data.</p>
      </div>
      <div className="section-card" style={{ maxWidth: '600px' }}>
        <div className="supabase-status">
          <div className={`status-pill ${isConfigured ? 'pill-success' : 'pill-error'}`}>
            {isConfigured ? '🟢 Connected to Supabase' : '🔴 Connection Missing'}
          </div>
          <p className="mt-4 text-sm text-dim">
            {isConfigured 
              ? 'Your application is correctly configured to use global storage. Any new data you save will be stored in your Supabase database.'
              : 'Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file to enable global storage.'
            }
          </p>
          {isConfigured && (
            <p className="mt-2 text-sm text-dim">
              If you have existing data in this browser, use the button below to migrate it to the cloud now.
            </p>
          )}
        </div>
        <div className="mt-4">
          <button 
            className={`btn-primary ${syncing ? 'btn-loading' : ''}`} 
            onClick={handleSync}
            disabled={syncing || !isConfigured}
          >
            {syncing ? 'Syncing...' : '🔄 Sync Local Data to Cloud'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Main Admin Panel =====
export default function AdminPanel() {
  const { currentUser, logout } = useAuth();
  const { leaves } = useLeave();
  const [activeTab, setActiveTab] = useState('timetable');

  const tabContent = {
    timetable: <TimetableTab />,
    teachers: <TeachersTab />,
    classes: <ClassesTab />,
    periods: <PeriodsTab />,
    substitutions: <SubstitutionPanel />,
    users: <UsersTab />,
    notifications: <NotificationsTab />, // Added NotificationsTab
    leaves: <LeavesTab />, // Added LeavesTab
    supabase: <SupabaseTab />,
  };

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">📚</span>
          <div>
            <div className="brand-name">SchoolRoutine</div>
            <div className="brand-role">Admin Panel</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <div className="nav-icon-wrapper">
                <span className="nav-icon">{tab.icon}</span>
                {tab.id === 'leaves' && leaves.filter(l => l.status === 'pending').length > 0 && (
                  <span className="notif-badge">{leaves.filter(l => l.status === 'pending').length}</span>
                )}
              </div>
              <span className="nav-label">{tab.label.split(' ').slice(1).join(' ')}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar-sm">A</div>
            <div>
              <div className="user-name">{currentUser?.name}</div>
              <div className="user-role-label">Administrator</div>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>Sign Out</button>
        </div>
      </aside>
      <main className="app-main">
        {tabContent[activeTab]}
      </main>
    </div>
  );
}
// ===== Leaves Tab =====
function LeavesTab() {
  const { schedule, markAbsent, substitutions } = useSchedule();
  const { leaves, updateLeaveStatus, refreshLeaves, loading: leavesLoading } = useLeave();
  const { showToast, addNotification } = useNotification();
  const { getApprovedTeachers } = useAuth();
  
  const [checkingSub, setCheckingSub] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const pendingLeaves = leaves.filter(l => l.status === 'pending');
  const pastLeaves = leaves.filter(l => l.status !== 'pending');
  const teachers = getApprovedTeachers();

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshLeaves();
      showToast('Leave requests updated.', 'info');
    } catch {
      showToast('Failed to refresh leaves.', 'error');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleApprove(leave) {
    try {
      await updateLeaveStatus(leave.id, 'approved');
      await markAbsent(leave.teacher_id, leave.day);
      await addNotification(leave.teacher_id, `Your leave application for ${leave.day} has been APPROVED.`, 'info');
      showToast(`Leave approved for ${leave.teacher_name}. Teacher marked absent.`, 'success');
      setCheckingSub(null);
    } catch (err) {
      showToast('Action failed: ' + err.message, 'error');
    }
  }

  async function handleReject(leave) {
    await updateLeaveStatus(leave.id, 'rejected');
    await addNotification(leave.teacher_id, `Your leave application for ${leave.day} has been REJECTED.`, 'warning');
    showToast(`Leave rejected for ${leave.teacher_name}.`, 'info');
    setCheckingSub(null);
  }

  function checkSubs(leave) {
    const subs = findSubstitutes(leave.teacher_id, leave.day, schedule, teachers, substitutions);
    setSuggestions(subs);
    setCheckingSub(leave.id);
  }

  return (
    <div className="tab-content">
      <div className="tab-header">
        <div>
          <h2>Leave Applications</h2>
          <p className="tab-desc">Review teacher leave requests and manage substitutions.</p>
        </div>
        <button 
          className={`btn-outline ${refreshing || leavesLoading ? 'btn-loading' : ''}`} 
          onClick={handleRefresh}
          disabled={refreshing || leavesLoading}
        >
          {refreshing || leavesLoading ? 'Updating...' : '🔄 Refresh Requests'}
        </button>
      </div>

      <div className="section-card">
        <h3>Pending Requests</h3>
        {pendingLeaves.length === 0 ? (
          <p className="empty-hint">No pending leave requests.</p>
        ) : (
          <div className="leave-requests-grid">
            {pendingLeaves.map(l => (
              <div key={l.id} className={`leave-request-card ${checkingSub === l.id ? 'active' : ''}`}>
                <div className="leave-main-info">
                  <div className="teacher-avatar-sm">{l.teacher_name[0]}</div>
                  <div>
                    <strong>{l.teacher_name}</strong>
                    <div className="text-sm text-dim">
                      {l.day} {l.leave_date && `(${l.leave_date})`}
                    </div>
                  </div>
                </div>
                <p className="leave-reason">"{l.reason}"</p>
                {l.document_link && (
                  <div style={{ margin: '0.5rem 0', padding: '0.5rem', background: 'var(--bg-app)', borderRadius: '4px' }}>
                    <a href={l.document_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', fontSize: '0.875rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      📄 View Supported Document
                    </a>
                  </div>
                )}
                <div className="leave-actions">
                  <button className="btn-sm-outline" onClick={() => checkSubs(l)}>Check Subs</button>
                  <button className="btn-approve-sm" onClick={() => handleApprove(l)}>Approve</button>
                  <button className="btn-danger-sm" onClick={() => handleReject(l)}>Reject</button>
                </div>

                {checkingSub === l.id && (
                  <div className="sub-check-box">
                    <h4>Substitution Check ({l.day})</h4>
                    {suggestions.length === 0 ? (
                      <p className="text-success text-sm">No periods scheduled for this teacher on {l.day}. Approval is safe!</p>
                    ) : (
                      <ul className="sub-suggestion-list">
                        {suggestions.map((s, idx) => (
                          <li key={idx} className="sub-suggestion-item">
                            <span className="text-sm"><strong>{s.classId}</strong>: {s.subject} ({s.periodId})</span>
                            {s.suggestions.length > 0 ? (
                              <span className="badge-success-sm">{s.suggestions.length} substitutes available</span>
                            ) : (
                              <span className="badge-danger-sm">No substitutes available</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-card mt-6">
        <h3>Leave History</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr><th>Teacher</th><th>Day / Date</th><th>Document</th><th>Status</th><th>Applied On</th></tr>
            </thead>
            <tbody>
              {pastLeaves.map(l => (
                <tr key={l.id}>
                  <td>{l.teacher_name}</td>
                  <td>
                    {l.day}
                    {l.leave_date && <div className="text-xs text-dim">{l.leave_date}</div>}
                  </td>
                  <td>
                    {l.document_link ? (
                      <a href={l.document_link} target="_blank" rel="noopener noreferrer" className="text-link text-sm">
                        📄 View
                      </a>
                    ) : '—'}
                  </td>
                  <td><span className={`badge-${l.status}`}>{l.status.toUpperCase()}</span></td>
                  <td className="text-sm">{new Date(l.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const { addNotification, showToast } = useNotification();
  const { getApprovedTeachers } = useAuth();
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all');

  const teachers = getApprovedTeachers();

  async function handleBroadcast(e) {
    e.preventDefault();
    if (!message.trim()) return;
    
    try {
      if (target === 'all') {
        for (const t of teachers) {
          await addNotification(t.id, message, 'info');
        }
      } else {
        await addNotification(target, message, 'info');
      }
      showToast('Broadcast sent successfully!', 'success');
      setMessage('');
    } catch {
      showToast('Failed to send broadcast.', 'error');
    }
  }

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Broadcast Notifications</h2>
        <p className="tab-desc">Send messages to all teachers or specific individuals.</p>
      </div>
      <div className="section-card max-w-2xl">
        <form onSubmit={handleBroadcast}>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Recipient</label>
            <select 
              value={target} 
              onChange={e => setTarget(e.target.value)}
              className="class-select"
              style={{ width: '100%' }}
            >
              <option value="all">All Teachers</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Message Body</label>
            <textarea 
              value={message} 
              onChange={e => setMessage(e.target.value)}
              placeholder="e.g. Please check your assigned substitution for Period 3."
              rows={4}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', resize: 'vertical' }}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            🚀 Send Broadcast
          </button>
        </form>
      </div>
    </div>
  );
}
