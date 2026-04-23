import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { DAYS } from '../utils/constants';
import { useNotification } from '../context/NotificationContext';
import { useLeave } from '../context/LeaveContext';
import { findSubstitutes } from '../utils/substitutionEngine';
import TimetableGrid from '../components/TimetableGrid';
import SubstitutionPanel from '../components/SubstitutionPanel';
import { exportClassTimetablePDF, exportAllClassesPDF } from '../utils/exportUtils';
import api from '../services/api';

const TABS = [
  { id: 'timetable', label: '📅 Timetable', icon: '📅', roles: ['super_admin', 'admin'] },
  { id: 'teachers', label: '👩‍🏫 Teachers', icon: '👩‍🏫', roles: ['super_admin', 'admin'] },
  { id: 'classes', label: '🏫 Classes & Subjects', icon: '🏫', roles: ['super_admin', 'admin'] },
  { id: 'periods', label: '⏰ Periods', icon: '⏰', roles: ['super_admin'] },
  { id: 'substitutions', label: '🔄 Substitutions', icon: '🔄', roles: ['super_admin', 'admin'] },
  { id: 'users', label: '👥 User Management', icon: '👥', roles: ['super_admin'] },
  { id: 'notifications', label: '🔔 Broadcast', icon: '🔔', roles: ['super_admin', 'admin'] },
  { id: 'leaves', label: '🌴 Leave Requests', icon: '🌴', roles: ['super_admin', 'admin'] },
  { id: 'branches', label: '📍 Branches', icon: '📍', roles: ['super_admin'] },
  { id: 'attendance', label: '📝 Attendance', icon: '📝', roles: ['super_admin', 'admin'] },
];

// ===== Teachers Tab =====
function TeachersTab() {
  const { getAllTeachers, updateUser, deleteUser } = useAuth();
  const { subjects, classes, getTeacherSchedule, periods, isTeacherAbsent } = useSchedule();
  const { showToast } = useNotification();
  const [editingId, setEditingId] = useState(null);
  const [viewingTimelineId, setViewingTimelineId] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', subjects: [], classes: [] });
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const teachers = useMemo(() => {
    return getAllTeachers()
      .filter(u => u.status === 'approved')
      .filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) || (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [getAllTeachers, searchTerm]);

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
    await updateUser(editingId, { name: form.name, email: form.email, phone: form.phone, subjects: form.subjects, classes: form.classes });
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
          <div className="modal modal-lg" style={{ maxWidth: '95%' }}>
            <div className="modal-header">
              <h3>{teachers.find(t => t.id === viewingTimelineId)?.name}'s Timetable</h3>
              <button className="modal-close" onClick={() => setViewingTimelineId(null)}>×</button>
            </div>
            <div className="modal-body" style={{ overflowX: 'auto' }}>
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
                    <tr key={day} className={isTeacherAbsent(viewingTimelineId, day) ? 'absent-row' : ''}>
                      <td className="period-label-cell day-label-cell">
                        <strong>{day}</strong>
                        {isTeacherAbsent(viewingTimelineId, day) && <span className="absent-day-badge">Absent</span>}
                      </td>
                      {periods.map(period => {
                        if (period.isBreak) {
                          return <td key={period.id} className="period-cell break-cell"><span>Break</span></td>;
                        }
                        const slots = getTeacherSchedule(viewingTimelineId)[day]?.[period.id] || [];
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

      <div className="section-card mt-2 mb-4">
        <input 
          type="text" 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          placeholder="Search teachers by name, username, or email..." 
          className="search-input"
          style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
        />
      </div>

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
  const { currentUser } = useAuth();
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
      <div className={currentUser.role === 'super_admin' ? "two-col-grid" : ""}>
        {currentUser.role === 'super_admin' && (
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
        )}
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

// ===== Users Tab (Super Admin Only) =====
function UsersTab() {
  const { users, approveUser, rejectUser, deleteUser, createUserAccount, updateUser } = useAuth();
  const { classes, subjects } = useSchedule();
  const { showToast } = useNotification();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ 
    name: '', username: '', password: '', role: 'teacher', email: '', phone: '', assignedClasses: [], subjects: [], classes: [],
    branchId: '', totalCl: 0, remainingCl: 0
  });
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    api.branches.getAll().then(setBranches);
  }, []);

  const pending = users.filter(t => t.status === 'pending');
  const admins = users.filter(u => u.role === 'admin');
  const teachers = users.filter(u => u.role === 'teacher' && u.status !== 'pending');

  async function handleCreate() {
    if (!form.name || !form.username || !form.password) {
      showToast('Please fill required fields.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await createUserAccount({
        ...form,
        totalCl: parseInt(form.totalCl || 0),
        remainingCl: parseFloat(form.remainingCl || 0)
      });
      if (res.success) {
        showToast(`${form.role === 'admin' ? 'Admin' : 'Teacher'} created successfully.`, 'success');
        setShowAddModal(false);
        resetForm();
      } else {
        showToast(res.error, 'error');
      }
    } catch (err) {
      showToast('DB Error: Failed to create user.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editingUser) return;
    setLoading(true);
    try {
      await updateUser(editingUser.id, { 
        name: form.name, 
        email: form.email, 
        phone: form.phone, 
        assignedClasses: form.assignedClasses,
        subjects: form.subjects,
        classes: form.classes,
        branchId: form.branchId,
        totalCl: parseInt(form.totalCl || 0),
        remainingCl: parseFloat(form.remainingCl || 0)
      });
      showToast('User updated successfully.', 'success');
      setEditingUser(null);
      resetForm();
    } catch (err) {
      showToast('DB Error: Failed to update user.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ 
      name: '', username: '', password: '', role: 'teacher', email: '', phone: '', 
      assignedClasses: [], subjects: [], classes: [], branchId: '',
      totalCl: 0, remainingCl: 0 
    });
  }

  function openEdit(user) {
    setForm({ 
      name: user.name, 
      username: user.username, 
      role: user.role, 
      email: user.email || '', 
      phone: user.phone || '', 
      assignedClasses: user.assignedClasses || [],
      subjects: user.subjects || [],
      classes: user.classes || [],
      branchId: user.branchId || '',
      totalCl: user.totalCl || 0,
      remainingCl: user.remainingCl || 0
    });
    setEditingUser(user);
  }

  function toggleAssignedClass(id) {
    setForm(p => ({
      ...p,
      assignedClasses: p.assignedClasses.includes(id) 
        ? p.assignedClasses.filter(x => x !== id)
        : [...p.assignedClasses, id]
    }));
  }

  function toggleSubject(s) {
    setForm(p => ({
      ...p,
      subjects: p.subjects.includes(s) ? p.subjects.filter(x => x !== s) : [...p.subjects, s]
    }));
  }

  function toggleTeacherClass(id) {
    setForm(p => ({
      ...p,
      classes: p.classes.includes(id) ? p.classes.filter(x => x !== id) : [...p.classes, id]
    }));
  }

  function StatusBadge({ status }) {
    const cls = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' }[status] || '';
    return <span className={`status-badge ${cls}`}>{status}</span>;
  }

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>User Management</h2>
        <div className="action-btns">
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Add User</button>
        </div>
      </div>

      {(showAddModal || editingUser) && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
              <button className="modal-close" onClick={() => { setShowAddModal(false); setEditingUser(null); resetForm(); }}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Full Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" />
              </div>
              {!editingUser && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Username *</label>
                    <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="johndoe" />
                  </div>
                  <div className="form-group">
                    <label>Password *</label>
                    <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
                  </div>
                </div>
              )}
              {!editingUser && (
                <div className="form-group">
                  <label>Role</label>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Assigned Branch</label>
                <select value={form.branchId || ''} onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))}>
                  <option value="">No branch assigned</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="john@example.com" />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1234567890" />
                </div>
              </div>

              {form.role === 'admin' && (
                <div className="form-group">
                  <label>Assign Classes (Restricts logic for this admin)</label>
                  <div className="chip-grid">
                    {classes.map(c => (
                      <button 
                        key={c.id} 
                        type="button"
                        className={`chip-toggle ${form.assignedClasses.includes(c.id) ? 'active' : ''}`}
                        onClick={() => toggleAssignedClass(c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-dim text-xs mt-1">If no classes are selected, the admin will have no access to classes.</p>
                </div>
              )}

              {form.role === 'teacher' && (
                <>
                  <div className="form-group">
                    <label>Subjects (select all that apply)</label>
                    <div className="chip-grid">
                      {subjects.map(s => (
                        <button key={s} type="button"
                          className={`chip-toggle ${form.subjects.includes(s) ? 'active' : ''}`}
                          onClick={() => toggleSubject(s)}>
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
                          onClick={() => toggleTeacherClass(c.id)}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Total Casual Leave</label>
                      <input type="number" value={form.totalCl || 0} onChange={e => setForm(p => ({ ...p, totalCl: e.target.value, remainingCl: e.target.value }))} />
                    </div>
                    <div className="form-group">
                       <label>Remaining CL</label>
                       <input type="number" step="0.5" value={form.remainingCl || 0} onChange={e => setForm(p => ({ ...p, remainingCl: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => { setShowAddModal(false); setEditingUser(null); resetForm(); }} disabled={loading}>Cancel</button>
              <button className="btn-primary" onClick={editingUser ? handleUpdate : handleCreate} disabled={loading}>
                {loading ? 'Saving...' : (editingUser ? 'Save Changes' : 'Create User')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="section-card mb-4">
          <h3>⏳ Pending Approval ({pending.length})</h3>
          <div className="user-cards">
            {pending.map(t => (
              <div key={t.id} className="user-card">
                <div className="user-card-info">
                  <div className="user-avatar">{t.name[0]}</div>
                  <div>
                    <strong>{t.name}</strong>
                    <div className="text-xs text-dim">{t.username} · {t.email || 'No email'}</div>
                  </div>
                </div>
                <div className="user-card-actions">
                  <button className="btn-approve-sm" onClick={() => approveUser(t.id)}>Approve</button>
                  <button className="btn-reject-sm" onClick={() => rejectUser(t.id)}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="two-col-grid">
        <div className="section-card">
          <h3>Administrators</h3>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Assignments</th><th>Actions</th></tr></thead>
              <tbody>
                {admins.length === 0 && <tr><td colSpan={3} className="empty-row">No admins added.</td></tr>}
                {admins.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong><br/><code className="text-xs">{u.username}</code></td>
                    <td>
                      <div className="tag-list">
                        {(u.assignedClasses || []).map(cId => (
                          <span key={cId} className="tag tag-blue">{classes.find(c => c.id === cId)?.name || 'Unknown'}</span>
                        ))}
                        {(!u.assignedClasses || u.assignedClasses.length === 0) && <span className="tag-none">None</span>}
                      </div>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-edit" onClick={() => openEdit(u)}>Edit</button>
                        <button className="btn-danger-sm" onClick={() => deleteUser(u.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section-card">
          <h3>Approved Teachers</h3>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Branch</th><th>CL (Rem/Tot)</th><th>Actions</th></tr></thead>
              <tbody>
                {teachers.length === 0 && <tr><td colSpan={4} className="empty-row">No teachers yet.</td></tr>}
                {teachers.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong><br/><code className="text-xs">{u.username}</code></td>
                    <td>{branches.find(b => b.id === u.branchId)?.name || <span className="text-dim">None</span>}</td>
                    <td>{u.remainingCl} / {u.totalCl}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-edit" onClick={() => openEdit(u)}>Edit</button>
                        <button className="btn-danger-sm" onClick={() => deleteUser(u.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Timetable Tab =====
function TimetableTab() {
  const { classes, filteredClasses, schedule, periods, saveSchedule, syncStatus, lastSyncTime, isLocked, toggleLock } = useSchedule();
  const { getApprovedTeachers, currentUser } = useAuth();
  const { showToast } = useNotification();
  
  const displayClasses = [...(filteredClasses.length > 0 ? filteredClasses : classes)]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  
  const [selectedClass, setSelectedClass] = useState(displayClasses[0]?.id || '');
  const [selectedSection, setSelectedSection] = useState('A');
  const teachers = getApprovedTeachers();

  const cls = displayClasses.find(c => c.id === selectedClass);
  const sections = useMemo(() => cls?.sections || ['A'], [cls]);
  const activeSection = useMemo(() => sections.includes(selectedSection) ? selectedSection : sections[0], [sections, selectedSection]);
  const scheduleKey = `${selectedClass}__${activeSection}`;

  function handleExportSection() {
    try {
      exportClassTimetablePDF(cls?.name || selectedClass, activeSection, schedule[scheduleKey] || {}, teachers, periods.filter(p => !p.isBreak));
      showToast('Export successful!', 'success');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  }

  function handleExportAll() {
    try {
      exportAllClassesPDF(displayClasses, schedule, teachers, periods.filter(p => !p.isBreak));
      showToast('Export successful!', 'success');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  }

  async function handleManualSave() {
    if (isLocked && currentUser?.role !== 'super_admin') {
      showToast('Routine is locked by Super Admin.', 'warning');
      return;
    }
    const res = await saveSchedule();
    if (res.success) {
      showToast('All changes saved and synchronized successfully!', 'success');
    } else {
      showToast('Sync error: ' + res.error, 'error');
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
            {displayClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="section-select" value={activeSection} onChange={e => setSelectedSection(e.target.value)}>
            {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
          <div className="sync-status">
            {syncStatus === 'error' ? (
              <span className="sync-badge error">❌ Sync Error</span>
            ) : syncStatus === 'saving' ? (
              <span className="sync-badge saving">⏳ Saving...</span>
            ) : (
              <span className="sync-badge success">
                {lastSyncTime ? `✅ Last Synced: ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '⏳ Initializing...'}
              </span>
            )}
          </div>
          {currentUser?.role === 'super_admin' && (
            <button 
              className={`btn-outline ${isLocked ? 'btn-danger' : 'btn-primary'}`}
              onClick={toggleLock}
            >
              {isLocked ? '🔓 Unlock Routine' : '🔒 Lock Routine'}
            </button>
          )}
          {isLocked && currentUser?.role !== 'super_admin' && (
            <span className="sync-badge error" style={{ padding: '0.25rem 0.75rem', background: 'var(--bg-danger)', color: 'var(--danger-text)' }}>🔒 Locked</span>
          )}
          <button 
            className={`btn-primary ${syncStatus === 'saving' ? 'loading' : ''}`} 
            onClick={handleManualSave}
            disabled={syncStatus === 'saving' || (isLocked && currentUser?.role !== 'super_admin')}
          >
            {syncStatus === 'saving' ? '⏳ Saving...' : '💾 Save & Finish'}
          </button>
          <button className="btn-outline" onClick={handleExportSection}>📄 Export Section PDF</button>
          <button className="btn-outline" onClick={handleExportAll}>📄 Export All</button>
        </div>
      </div>
      {selectedClass && <TimetableGrid selectedClass={selectedClass} selectedSection={activeSection} />}
    </div>
  );
}

// ===== Main Admin Panel =====
export default function AdminPanel() {
  const { currentUser, logout } = useAuth();
  const { leaves } = useLeave();
  const { syncStatus } = useSchedule();
  const [activeTab, setActiveTab] = useState('timetable');

  const tabContent = {
    timetable: <TimetableTab />,
    teachers: <TeachersTab />,
    classes: <ClassesTab />,
    periods: <PeriodsTab />,
    substitutions: <SubstitutionPanel />,
    users: <UsersTab />,
    notifications: <NotificationsTab />,
    leaves: <LeavesTab />,
    branches: <BranchesTab />,
    attendance: <AttendanceTab />,
  };

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img src="/pwa-logo.png" style={{ width: '40px', height: '40px', borderRadius: '8px' }} alt="Logo" />
          <div className="brand-info">
            <div className="brand-name">RPB Routine</div>
            <div className="brand-role">
              Admin Panel
              <div className={`sync-indicator ${syncStatus}`}>
                {syncStatus === 'saving' && <span className="sync-dot saving"></span>}
                {syncStatus === 'synced' && <span className="sync-dot synced"></span>}
                {syncStatus === 'error' && <span className="sync-dot error"></span>}
                {syncStatus === 'saving' ? 'Saving...' : syncStatus === 'error' ? 'Sync Error' : 'Cloud Synced'}
              </div>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {TABS.filter(t => t.roles.includes(currentUser?.role)).map(tab => (
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
            <div className="user-avatar-sm">{currentUser?.name?.[0] || 'A'}</div>
            <div>
              <div className="user-name">{currentUser?.name}</div>
              <div className="user-role-label">{currentUser?.role === 'super_admin' ? 'Super Admin' : 'Administrator'}</div>
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
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [teacherSearch, setTeacherSearch] = useState('');




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
      await markAbsent(leave.teacher_id, leave.day, leave.leave_date);
      await addNotification(leave.teacher_id, `Your leave application for ${leave.leave_date || leave.day} has been APPROVED.`, 'info');
      showToast(`Leave approved for ${leave.teacher_name}. Teacher marked absent.`, 'success');
      setCheckingSub(null);
    } catch (err) {
      showToast('Action failed: ' + err.message, 'error');
    }
  }

  async function handleReject(leave) {
    await updateLeaveStatus(leave.id, 'rejected');
    await addNotification(leave.teacher_id, `Your leave application for ${leave.leave_date || leave.day} has been REJECTED.`, 'warning');
    showToast(`Leave rejected for ${leave.teacher_name}.`, 'info');
    setCheckingSub(null);
  }

  async function handleSchoolDuty(leave) {
    try {
      await updateLeaveStatus(leave.id, 'school_duty');
      await markAbsent(leave.teacher_id, leave.day, leave.leave_date);
      await addNotification(leave.teacher_id, `Your absence on ${leave.leave_date || leave.day} has been recorded as SCHOOL DUTY (CL not deducted).`, 'info');
      showToast(`${leave.teacher_name} marked as Absent for School Duty.`, 'success');
      setCheckingSub(null);
    } catch (err) {
      showToast('Action failed: ' + err.message, 'error');
    }
  }

  function checkSubs(leave) {
    const subs = findSubstitutes(leave.teacher_id, leave.day, leave.leave_date, schedule, teachers, substitutions);
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
                  <div style={{ margin: '0.5rem 0', padding: '0.4rem', background: 'var(--bg-app)', borderRadius: '4px' }}>
                    <a href={l.document_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', fontSize: '0.875rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      📄 View Supported Document
                    </a>
                  </div>
                )}
                <div className="leave-actions" style={{ flexWrap: 'wrap' }}>
                   <button className="btn-sm-outline" onClick={() => checkSubs(l)}>Check Subs</button>
                   <button className="btn-approve-sm" onClick={() => handleApprove(l)}>Approve</button>
                   <button className="btn-danger-sm" onClick={() => handleReject(l)}>Reject</button>
                   <button className="btn-school-duty-sm" onClick={() => handleSchoolDuty(l)}>🏫 School Duty</button>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3>{selectedTeacherId ? `Leave Detail: ${teachers.find(t => t.id === selectedTeacherId)?.name}` : 'Leave History Summary'}</h3>
            <p className="text-sm text-dim">
              {selectedTeacherId 
                ? 'Viewing detailed records for this teacher.' 
                : 'Overview of total leaves taken by all teachers.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {!selectedTeacherId && (
              <div className="form-group" style={{ margin: 0, minWidth: '250px' }}>
                <input 
                  type="text" 
                  placeholder="🔍 Search Teacher Name..."
                  value={teacherSearch}
                  onChange={e => setTeacherSearch(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%' }}
                />
              </div>
            )}
            {selectedTeacherId && (
              <button className="btn-outline" onClick={() => setSelectedTeacherId(null)}>← Back to Summary</button>
            )}
          </div>
        </div>

        {!selectedTeacherId ? (
          /* SUMMARY VIEW */
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Teacher Name</th>
                  <th>Total Leaves Taken</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers
                  .filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase()))
                  .map(t => {
                    const count = pastLeaves.filter(l => l.teacher_id === t.id && l.status !== 'rejected').length;
                    if (count === 0 && teacherSearch === '') return null; // Only show teachers with leaves unless searching
                    return (
                      <tr key={t.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div className="teacher-avatar-sm">{t.name[0]}</div>
                            <strong>{t.name}</strong>
                          </div>
                        </td>
                        <td>
                          <span className="badge-info" style={{ fontSize: '1rem', padding: '0.2rem 0.6rem' }}>{count} days</span>
                        </td>
                        <td>
                          <button className="btn-sm-outline" onClick={() => setSelectedTeacherId(t.id)}>View Details</button>
                        </td>
                      </tr>
                    );
                  })
                  .filter(Boolean)
                }
                {teachers.filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase())).length === 0 && (
                  <tr><td colSpan="3" className="empty-hint">No teachers found matching your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* DETAIL VIEW */
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Reason</th>
                  <th>Document</th>
                  <th>Status</th>
                  <th>Applied On</th>
                </tr>
              </thead>
              <tbody>
                {pastLeaves
                  .filter(l => l.teacher_id === selectedTeacherId)
                  .map(l => (
                  <tr key={l.id}>
                    <td><strong>{l.leave_date || '—'}</strong></td>
                    <td><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{l.day}</span></td>
                    <td>
                      <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal' }}>
                        {l.reason}
                      </div>
                    </td>
                    <td>
                      {l.document_link ? (
                        <a href={l.document_link} target="_blank" rel="noopener noreferrer" className="text-link text-sm">
                          📄 View
                        </a>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`badge-${l.status}`}>
                        {l.status === 'school_duty' ? 'SCHOOL DUTY' : l.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-sm">{new Date(l.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

// ===== Branches Tab (Super Admin Only) =====
function BranchesTab() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', start_time: '08:00', late_threshold: '08:15' });
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const { showToast } = useNotification();

  const fetchCurrentLocation = () => {
    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(p => ({
          ...p,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6)
        }));
        setFetchingLocation(false);
        showToast('Location fetched successfully!', 'success');
      },
      (err) => {
        setFetchingLocation(false);
        showToast('Failed to fetch location. Please enable GPS.', 'error');
      }
    );
  };

  const loadBranches = async () => {
    try {
      const data = await api.branches.getAll();
      setBranches(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBranches(); }, []);

  async function handleSave() {
    if (!form.name || !form.latitude || !form.longitude) return showToast('Fill all fields.', 'warning');
    const branchData = {
      ...form,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude)
    };
    try {
      if (editingBranch) {
        await api.branches.update(editingBranch.id, branchData);
        showToast('Branch updated.', 'success');
      } else {
        await api.branches.create({ id: 'br_' + Date.now(), ...branchData });
        showToast('Branch created.', 'success');
      }
      setShowModal(false);
      setEditingBranch(null);
      setForm({ name: '', latitude: '', longitude: '', start_time: '08:00', late_threshold: '08:15' });
      loadBranches();
    } catch (err) {
      showToast('Error saving branch.', 'error');
    }
  }

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Branch Management</h2>
        <button className="btn-primary" onClick={() => { setEditingBranch(null); setShowModal(true); }}>+ Add Branch</button>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
               <h3>{editingBranch ? 'Edit Branch' : 'Add Branch'}</h3>
               <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
               <div className="form-group">
                 <label>Branch Name</label>
                 <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Main Campus" />
               </div>
               <div className="form-group mb-4">
                  <button 
                    type="button" 
                    className={`btn-outline-sm w-full ${fetchingLocation ? 'loading' : ''}`}
                    onClick={fetchCurrentLocation}
                    disabled={fetchingLocation}
                  >
                    {fetchingLocation ? '📡 Fetching...' : '📍 Get Current coordinates'}
                  </button>
                </div>
               <div className="form-row">
                 <div className="form-group">
                   <label>Latitude</label>
                   <input type="number" step="any" value={form.latitude} onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))} placeholder="22.5726" />
                 </div>
                 <div className="form-group">
                   <label>Longitude</label>
                   <input type="number" step="any" value={form.longitude} onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))} placeholder="88.3639" />
                 </div>
               </div>
               <div className="form-row">
                 <div className="form-group">
                   <label>Start Time (24h)</label>
                   <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
                 </div>
                 <div className="form-group">
                   <label>Late After (24h)</label>
                   <input type="time" value={form.late_threshold} onChange={e => setForm(p => ({ ...p, late_threshold: e.target.value }))} />
                 </div>
               </div>
            </div>
            <div className="modal-footer">
               <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
               <button className="btn-primary" onClick={handleSave}>Save Branch</button>
            </div>
          </div>
        </div>
      )}

      <div className="section-card">
        <div className="table-container">
           <table className="data-table">
             <thead><tr><th>Name</th><th>Location</th><th>Timing</th><th>Actions</th></tr></thead>
             <tbody>
               {branches.map(b => (
                 <tr key={b.id}>
                   <td><strong>{b.name}</strong></td>
                   <td><code>{b.latitude}, {b.longitude}</code></td>
                   <td>{b.start_time} (Late: {b.late_threshold})</td>
                   <td>
                     <div className="action-btns">
                       <button className="btn-edit" onClick={() => { setEditingBranch(b); setForm(b); setShowModal(true); }}>Edit</button>
                       <button className="btn-danger-sm" onClick={async () => { await api.branches.delete(b.id); loadBranches(); }}>Delete</button>
                     </div>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      </div>
    </div>
  );
}

// ===== Attendance Tab =====
function AttendanceTab() {
  const [logs, setLogs] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [reportType, setReportType] = useState('daily'); // 'daily' or 'monthly'
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [branches, setBranches] = useState([]);
  const { users } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      try {
        const [bData, lData] = await Promise.all([
          api.branches.getAll(),
          api.leaves.getAll()
        ]);
        setBranches(bData);
        setAllLeaves(lData);

        if (reportType === 'daily') {
          const logsData = await api.attendance.getByDate(date);
          setLogs(logsData || []);
        } else {
          // Optimized Monthly fetch
          const monthLogs = await api.attendance.getAllForMonth(month);
          const aggregated = branchTeachers.map(t => {
            const tLogs = (monthLogs || []).filter(l => l.teacher_id === t.id);
            const lates = tLogs.filter(l => l.status === 'late');
            const leavesCount = lData.filter(lv => 
              lv.teacher_id === t.id && 
              lv.leave_date.startsWith(month) && 
              lv.status === 'approved'
            ).length;

            return {
              name: t.name,
              lateDays: lates.map(l => ({ date: l.date, time: l.time })),
              leaveCount: leavesCount,
              totalLates: lates.length
            };
          });
          setMonthlyData(aggregated);
        }
      } catch (err) {
        console.error('Failed to load attendance report:', err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, [date, month, reportType, selectedBranchId]);

  const branchTeachers = users.filter(u => 
    u.role === 'teacher' && 
    (selectedBranchId === 'all' || u.branchId === selectedBranchId)
  );

  const getDailyReport = () => {
    return branchTeachers.map(teacher => {
      const log = logs.find(l => l.teacher_id === teacher.id);
      const leave = allLeaves.find(lv => 
        lv.teacher_id === teacher.id && 
        lv.leave_date === date && 
        lv.status === 'approved'
      );
      
      let status = 'absent';
      let arrivalTime = '—';
      
      if (log) {
        status = log.status || 'present';
        arrivalTime = log.time;
      } else if (leave) {
        status = 'leave';
      }
      
      return { name: teacher.name, arrivalTime, status, branchId: teacher.branchId };
    });
  };

  const [monthlyData, setMonthlyData] = useState([]);
  const reportData = reportType === 'daily' ? getDailyReport() : monthlyData;

  return (
    <div className="tab-content">
      <div className="tab-header flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="flex items-center gap-4">
          <h2>Attendance Report</h2>
          <div className="toggle-group">
            <button 
              className={`btn-toggle ${reportType === 'daily' ? 'active' : ''}`}
              onClick={() => setReportType('daily')}
            >Daily</button>
            <button 
              className={`btn-toggle ${reportType === 'monthly' ? 'active' : ''}`}
              onClick={() => setReportType('monthly')}
            >Monthly</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select 
            value={selectedBranchId} 
            onChange={e => setSelectedBranchId(e.target.value)}
            className="class-select"
          >
            <option value="all">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          {reportType === 'daily' ? (
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="class-select" />
          ) : (
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="class-select" />
          )}
        </div>
      </div>

      <div className="section-card">
        {loading ? (
          <div className="p-8 text-center text-slate-500">⏳ Loading report data...</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              {reportType === 'daily' ? (
                <>
                  <thead>
                    <tr>
                      <th>Teacher Name</th>
                      <th>Branch</th>
                      <th>Arrival Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.length === 0 && <tr><td colSpan={4} className="empty-row">No teachers found in this branch.</td></tr>}
                    {reportData.map((row, i) => {
                      const branch = branches.find(b => b.id === row.branchId);
                      return (
                        <tr key={i}>
                          <td><strong>{row.name}</strong></td>
                          <td>{branch?.name || '—'}</td>
                          <td>{row.arrivalTime}</td>
                          <td>
                            <span className={`status-badge badge-${row.status}`}>
                              {row.status === 'present' ? 'Present' : 
                               row.status === 'late' ? 'Late' : 
                               row.status === 'leave' ? 'On Leave' : 'Absent'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr>
                      <th>Teacher Name</th>
                      <th>Late (Days & Time)</th>
                      <th>Leave Count</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.length === 0 && <tr><td colSpan={4} className="empty-row">No teachers found in this branch.</td></tr>}
                    {reportData.map((row, i) => (
                      <tr key={i}>
                        <td><strong>{row.name}</strong></td>
                        <td>
                          {row.totalLates > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {row.lateDays.map((d, di) => (
                                <span key={di} className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                                  {d.date.slice(-2)}: {d.time.slice(0,5)}
                                </span>
                              ))}
                            </div>
                          ) : '—'}
                        </td>
                        <td>{row.leaveCount}</td>
                        <td>
                          {row.totalLates === 0 && row.leaveCount === 0 ? (
                            <span className="text-emerald-600 font-medium text-sm">Perfect Attendance! (No leave taken)</span>
                          ) : (
                            <span className="text-slate-500 text-sm">{row.totalLates} Late, {row.leaveCount} Leave</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
