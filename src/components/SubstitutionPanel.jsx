import { useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { DAYS } from '../utils/constants';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { findSubstitutes } from '../utils/substitutionEngine';

export default function SubstitutionPanel() {
  const { schedule, periods, classes, markAbsent, markPresent, assignSubstitute, removeSubstitute, isTeacherAbsent, substitutions } = useSchedule();
  const { getApprovedTeachers } = useAuth();
  const { showToast, addNotification } = useNotification();

  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [overrides, setOverrides] = useState({});

  const teachers = getApprovedTeachers();
  const absentOnDay = teachers.filter(t => isTeacherAbsent(t.id, selectedDay));

  async function handleMarkAbsent() {
    if (!selectedTeacher) return;
    const teacher = teachers.find(t => t.id === selectedTeacher);
    if (isTeacherAbsent(selectedTeacher, selectedDay)) {
      showToast(`${teacher?.name} is already marked absent on ${selectedDay}.`, 'error');
      return;
    }
    await markAbsent(selectedTeacher, selectedDay);
    // Auto-calculate substitutes
    const subs = findSubstitutes(selectedTeacher, selectedDay, schedule, teachers, substitutions);
    setSuggestions(subs);
    showToast(`${teacher?.name} marked absent on ${selectedDay}. ${subs.length} slot(s) need substitution.`, 'info');
  }

  async function handleMarkPresent(teacherId) {
    await markPresent(teacherId, selectedDay);
    setSuggestions([]);
    showToast('Teacher marked present.', 'success');
  }

  async function handleAssignSub(slot, substituteId) {
    if (!substituteId) return;
    const sub = teachers.find(t => t.id === substituteId);
    await assignSubstitute(slot.classId, slot.day, slot.periodId, substituteId, slot.currentTeacherId);
    await addNotification(substituteId, `You have been assigned as substitute for ${slot.classId} - ${slot.day} - ${slot.subject} (${slot.periodId}).`);
    showToast(`${sub?.name} assigned as substitute. Teacher notified.`, 'success');
  }

  function showSuggestionsForAbsent(teacherId) {
    const subs = findSubstitutes(teacherId, selectedDay, schedule, teachers, substitutions);
    setSuggestions(subs);
  }

  const periodMap = Object.fromEntries(periods.map(p => [p.id, p]));

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Substitution Management</h2>
        <p className="tab-desc">Mark teachers absent and assign substitutes automatically or manually.</p>
      </div>

      <div className="sub-panel-grid">
        {/* Mark Absent */}
        <div className="section-card">
          <h3>Mark Teacher Absent</h3>
          <div className="form-group">
            <label>Select Day</label>
            <select value={selectedDay} onChange={e => { setSelectedDay(e.target.value); setSuggestions([]); }}>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Select Teacher</label>
            <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)}>
              <option value="">— Choose teacher —</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button className="btn-danger" onClick={handleMarkAbsent}>Mark Absent & Find Substitutes</button>
        </div>

        {/* Currently Absent */}
        <div className="section-card">
          <h3>Absent on {selectedDay}</h3>
          {absentOnDay.length === 0 ? (
            <p className="empty-hint">No teachers marked absent on this day.</p>
          ) : (
            <div className="absent-list">
              {absentOnDay.map(t => (
                <div key={t.id} className="absent-item">
                  <div className="absent-info">
                    <span className="absent-avatar">{t.name[0]}</span>
                    <span>{t.name}</span>
                    <span className="badge-absent">ABSENT</span>
                  </div>
                  <div className="absent-actions">
                    <button className="btn-sm-outline" onClick={() => showSuggestionsForAbsent(t.id)}>View Slots</button>
                    <button className="btn-approve-sm" onClick={() => handleMarkPresent(t.id)}>Mark Present</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Substitution Suggestions */}
      {suggestions.length > 0 && (
        <div className="section-card mt-4">
          <h3>Substitution Suggestions</h3>
          <div className="suggestions-list">
            {suggestions.map((slot, idx) => {
              const period = periodMap[slot.periodId];
              const [classId, section] = slot.classId.includes('__') ? slot.classId.split('__') : [slot.classId, ''];
              const classObj = classes.find(c => c.id === classId);
              const classDisplayName = section ? `${classObj?.name || classId} (${section})` : (classObj?.name || classId);
              const currentOverride = overrides[`${slot.classId}-${slot.periodId}`];
              return (
                <div key={idx} className="suggestion-card">
                  <div className="suggestion-header">
                    <strong>{classDisplayName}</strong>
                    <span className="suggestion-period">{period?.label || slot.periodId} · {period?.time}</span>
                    <span className="suggestion-subject">{slot.subject}</span>
                  </div>
                  {slot.suggestions.length === 0 ? (
                    <p className="no-sub">No available substitutes found for this slot.</p>
                  ) : (
                    <div className="suggestion-controls">
                      <select
                        value={currentOverride || slot.suggestions[0]?.teacher?.id || ''}
                        onChange={e => setOverrides(p => ({ ...p, [`${slot.classId}-${slot.periodId}`]: e.target.value }))}
                      >
                        {slot.suggestions.map(s => (
                          <option key={s.teacher.id} value={s.teacher.id}>
                            {s.teacher.name} ({s.periodsToday} periods today)
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn-primary"
                        onClick={() => handleAssignSub(slot, currentOverride || slot.suggestions[0]?.teacher?.id)}
                      >
                        Assign
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Substitutions */}
      <div className="section-card mt-4">
        <h3>Active Substitutions on {selectedDay}</h3>
        {(() => {
          const daySubstitutions = substitutions[selectedDay] || {};
          const entries = [];
          for (const compositeId of Object.keys(daySubstitutions)) {
            for (const periodId of Object.keys(daySubstitutions[compositeId])) {
              const subs = daySubstitutions[compositeId][periodId];
              const subsArray = Array.isArray(subs) ? subs : [subs];
              for (const sub of subsArray) {
                const subTeacher = teachers.find(t => t.id === sub.substituteId);
                const origTeacher = teachers.find(t => t.id === sub.originalTeacherId);
                const [classId, section] = compositeId.includes('__') ? compositeId.split('__') : [compositeId, ''];
                const classObj = classes.find(c => c.id === classId);
                const classDisplayName = section ? `${classObj?.name || classId} (${section})` : (classObj?.name || classId);
                const period = periodMap[periodId];
                entries.push({ classId: compositeId, classDisplayName, periodId, sub, subTeacher, origTeacher, classObj, period });
              }
            }
          }
          if (entries.length === 0) return <p className="empty-hint">No substitutions active for {selectedDay}.</p>;
          return (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Class</th><th>Period</th><th>Original Teacher</th><th>Substitute</th><th>Action</th></tr></thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={i}>
                      <td>{e.classDisplayName}</td>
                      <td>{e.period?.label || e.periodId}</td>
                      <td><span className="tag tag-red">{e.origTeacher?.name || e.sub.originalTeacherId}</span></td>
                      <td><span className="tag tag-green">{e.subTeacher?.name || e.sub.substituteId}</span></td>
                      <td><button className="btn-danger-sm" onClick={() => removeSubstitute(e.classId, selectedDay, e.periodId, e.sub.substituteId)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
