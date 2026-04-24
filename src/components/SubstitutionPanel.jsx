import { useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { findSubstitutes } from '../utils/substitutionEngine';

// Helper: derive day-of-week name from a date string (YYYY-MM-DD)
function getDayFromDate(dateStr) {
  if (!dateStr) return '';
  const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayMap[new Date(dateStr + 'T00:00:00').getDay()];
}

// Helper: today's date as YYYY-MM-DD
function todayDate() {
  return new Date().toISOString().split('T')[0];
}

// Helper: Robust Class Name Resolution from composite ID (e.g. cls_123__A)
function getClassDisplayName(compositeId, classes) {
  let [classIdPart, sectionPart] = compositeId.includes('__') ? compositeId.split('__') : [compositeId, ''];
  
  // Try exact ID match
  let classObj = classes.find(c => c.id === classIdPart);
  
  // Fallback: Fuzzy ID match
  if (!classObj) {
    classObj = classes.find(c => classIdPart.includes(c.id) || c.id.includes(classIdPart));
  }

  const className = classObj?.name || classIdPart || "Unknown Class";
  const sectionDisplay = sectionPart ? ` (Section ${sectionPart})` : "";
  return `${className}${sectionDisplay}`;
}

export default function SubstitutionPanel() {
  const {
    schedule, periods, classes, filteredClasses,
    markAbsent, markPresent, assignSubstitute, removeSubstitute,
    isTeacherAbsentOnDate, substitutions,
  } = useSchedule();
  const { getApprovedTeachers } = useAuth();
  const { showToast, addNotification } = useNotification();

  const [selectedDate, setSelectedDate] = useState(todayDate());
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [absentType, setAbsentType] = useState('absent'); // 'absent' | 'school_duty'
  const [suggestions, setSuggestions] = useState([]);
  const [overrides, setOverrides] = useState({});

  const teachers = getApprovedTeachers();
  const displayClasses = filteredClasses.length > 0 ? filteredClasses : classes;

  // Derive day-of-week from selected date (for schedule lookups)
  const selectedDay = getDayFromDate(selectedDate);

  // Teachers absent on selected date — checks both new date-based AND legacy day-name records
  const absentOnDate = teachers.filter(t =>
    isTeacherAbsentOnDate(t.id, selectedDate) ||
    (!selectedDate && false) // ensure we only match when date is selected
  );

  async function handleMarkAbsent() {
    if (!selectedTeacher) return;
    if (!selectedDate) { showToast('Please select a date.', 'error'); return; }
    const teacher = teachers.find(t => t.id === selectedTeacher);
    if (isTeacherAbsentOnDate(selectedTeacher, selectedDate)) {
      showToast(`${teacher?.name} is already marked absent on ${selectedDate}.`, 'error');
      return;
    }
    await markAbsent(selectedTeacher, selectedDay, selectedDate);
    // Auto-calculate substitutes
    const subs = findSubstitutes(selectedTeacher, selectedDay, selectedDate, schedule, teachers, substitutions);
    setSuggestions(subs);
    showToast(
      `${teacher?.name} marked ${absentType === 'school_duty' ? 'absent (school duty)' : 'absent'} on ${selectedDate}. ${subs.length} slot(s) need substitution.`,
      'info'
    );
  }

  async function handleMarkPresent(teacherId, date) {
    await markPresent(teacherId, date);
    setSuggestions([]);
    showToast('Teacher marked present.', 'success');
  }

  async function handleAssignSub(slot, substituteId) {
    if (!substituteId) return;
    const sub = teachers.find(t => t.id === substituteId);
    const fullClassDisplayName = getClassDisplayName(slot.classId, classes);
    const periodObj = periods.find(p => p.id === slot.periodId);
    const periodLabel = periodObj?.label || slot.periodId;

    await assignSubstitute(slot.classId, selectedDate, slot.periodId, substituteId, slot.currentTeacherId);
    await addNotification(
      substituteId,
      `🔄 Substitution Assigned: You are assigned for ${fullClassDisplayName} on ${selectedDate} (${selectedDay}) - Subject: ${slot.subject} - ${periodLabel}.`
    );
    showToast(`${sub?.name} assigned as substitute. Teacher notified.`, 'success');
  }

  function showSuggestionsForAbsent(teacherId) {
    const subs = findSubstitutes(teacherId, selectedDay, selectedDate, schedule, teachers, substitutions);
    setSuggestions(subs);
  }

  const periodMap = Object.fromEntries(periods.map(p => [p.id, p]));

  // Active substitutions for the selected date — STRICTLY date-keyed
  const dateSubs = substitutions[selectedDate] || {};

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Substitution Management</h2>
        <p className="tab-desc">Mark teachers absent by date and assign substitutes automatically or manually.</p>
      </div>

      <div className="sub-panel-grid">
        {/* Mark Absent */}
        <div className="section-card">
          <h3>Mark Teacher Absent</h3>
          <div className="form-group">
            <label>Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => { setSelectedDate(e.target.value); setSuggestions([]); }}
            />
            {selectedDay && (
              <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                📅 {selectedDay}
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Select Teacher</label>
            <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)}>
              <option value="">— Choose teacher —</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Absence Type</label>
            <select value={absentType} onChange={e => setAbsentType(e.target.value)}>
              <option value="absent">Absent</option>
              <option value="school_duty">Absent for School Duty</option>
            </select>
          </div>
          <button className="btn-danger" onClick={handleMarkAbsent}>
            {absentType === 'school_duty' ? '🏫 Mark School Duty & Find Substitutes' : '❌ Mark Absent & Find Substitutes'}
          </button>
        </div>

        {/* Currently Absent on selected date */}
        <div className="section-card">
          <h3>Absent on {selectedDate}{selectedDay ? ` (${selectedDay})` : ''}</h3>
          {absentOnDate.length === 0 ? (
            <p className="empty-hint">No teachers marked absent on this date.</p>
          ) : (
            <div className="absent-list">
              {absentOnDate.map(t => {
                const absentRecord = teachers.find(x => x.id === t.id);
                return (
                  <div key={t.id} className="absent-item">
                    <div className="absent-info">
                      <span className="absent-avatar">{t.name[0]}</span>
                      <span>{t.name}</span>
                      <span className="badge-absent">ABSENT</span>
                    </div>
                    <div className="absent-actions">
                      <button className="btn-sm-outline" onClick={() => showSuggestionsForAbsent(t.id)}>View Slots</button>
                      <button className="btn-approve-sm" onClick={() => handleMarkPresent(t.id, selectedDate)}>Mark Present</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Substitution Suggestions */}
      {suggestions.length > 0 && (
        <div className="section-card mt-4">
          <h3>Substitution Suggestions for {selectedDate}</h3>
          <div className="suggestions-list">
            {suggestions.map((slot, idx) => {
              const period = periodMap[slot.periodId];
              const classDisplayName = getClassDisplayName(slot.classId, classes);
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
                            {s.teacher.name} ({s.matchType} • {s.periodsToday} periods today)
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

      {/* Active Substitutions for selected date */}
      <div className="section-card mt-4">
        <h3>Active Substitutions on {selectedDate}{selectedDay ? ` (${selectedDay})` : ''}</h3>
        {(() => {
          const entries = [];
          for (const compositeId of Object.keys(dateSubs)) {
            for (const periodId of Object.keys(dateSubs[compositeId])) {
              const subs = dateSubs[compositeId][periodId];
              const subsArray = Array.isArray(subs) ? subs : [subs];
              for (const sub of subsArray) {
                const subTeacher = teachers.find(t => t.id === sub.substituteId);
                const origTeacher = teachers.find(t => t.id === sub.originalTeacherId);
                const classDisplayName = getClassDisplayName(compositeId, teachers.length > 0 ? classes : []);
                const period = periodMap[periodId];
                
                // Get subject from original schedule
                const origSlot = schedule[compositeId]?.[selectedDay]?.[periodId];
                const assignments = origSlot ? (Array.isArray(origSlot) ? origSlot : [origSlot]) : [];
                const match = assignments.find(a => a.teacherId === sub.originalTeacherId);
                const subject = match?.subject || '—';

                entries.push({ classId: compositeId, classDisplayName, periodId, sub, subTeacher, origTeacher, period, subject });
              }
            }
          }
          if (entries.length === 0) return <p className="empty-hint">No substitutions active for {selectedDate}.</p>;
          return (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Class</th><th>Period</th><th>Subject</th><th>Original Teacher</th><th>Substitute</th><th>Action</th></tr></thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={i}>
                      <td>{e.classDisplayName}</td>
                      <td>{e.period?.label || e.periodId}</td>
                      <td><span className="suggestion-subject">{e.subject}</span></td>
                      <td><span className="tag tag-red">{e.origTeacher?.name || e.sub.originalTeacherId}</span></td>
                      <td><span className="tag tag-green">{e.subTeacher?.name || e.sub.substituteId}</span></td>
                      <td><button className="btn-danger-sm" onClick={() => removeSubstitute(e.classId, selectedDate, e.periodId, e.sub.substituteId)}>Remove</button></td>
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
