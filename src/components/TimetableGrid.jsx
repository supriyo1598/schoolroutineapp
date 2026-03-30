import { useState, useCallback } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, closestCenter } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { useSchedule } from '../context/ScheduleContext';
import { DAYS } from '../utils/constants';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { checkConflicts } from '../utils/conflictDetection';

function DraggableTeacherChip({ teacher, subjects, classId }) {
  const [selectedSubject, setSelectedSubject] = useState(subjects[0] || '—');

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `drag-${teacher.id}`,
    data: { teacherId: teacher.id, teacherName: teacher.name, subject: selectedSubject, classId, type: 'teacher-chip' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`teacher-chip ${isDragging ? 'dragging' : ''}`}
    >
      <span className="chip-avatar">{teacher.name[0]}</span>
      <div className="chip-info">
        <span className="chip-name">{teacher.name}</span>
        <div className="chip-subject-selector">
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="mini-select"
          >
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="chip-drag-handle" {...listeners} {...attributes}>⠿</div>
    </div>
  );
}

function DroppableCell({ classId, day, periodId, slots, isBreak, onRemove }) {
  const { isOver, setNodeRef } = useDroppable({ id: `${classId}__${day}__${periodId}`, data: { classId, day, periodId } });
  const { isTeacherAbsent } = useSchedule();

  if (isBreak) {
    return <td className="period-cell break-cell"><span>Break</span></td>;
  }

  return (
    <td ref={setNodeRef} className={`period-cell ${isOver ? 'cell-over' : ''} ${slots.length > 0 ? 'cell-filled' : 'cell-empty'}`}>
      {slots.length > 0 ? (
        <div className="cell-assignments">
          {slots.map((s, idx) => {
            const absent = isTeacherAbsent(s.displayTeacherId, day);
            return (
              <div key={idx} className={`cell-content ${absent ? 'cell-absent' : ''} ${s.isSubstitute ? 'cell-substitute' : ''}`}>
                <div className="cell-text">
                  <span className="cell-subject">{s.subject}</span>
                  <span className="cell-teacher">{s.teacherName}</span>
                </div>
                {s.isSubstitute && <span className="cell-sub-badge">SUB</span>}
                {absent && <span className="cell-absent-badge">ABSENT</span>}
                <button className="cell-remove" onClick={() => onRemove(classId, day, periodId, s.teacherId)} title="Remove">×</button>
              </div>
            );
          })}
        </div>
      ) : (
        <span className="cell-placeholder">Drop here</span>
      )}
    </td>
  );
}

export default function TimetableGrid({ selectedClass, selectedSection }) {
  const { schedule, periods, placeSlot, removeSlot, substitutions, classes } = useSchedule();
  const { getApprovedTeachers } = useAuth();
  const { showToast } = useNotification();

  const [activeData, setActiveData] = useState(null);
  const [teacherSearch, setTeacherSearch] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const teachers = getApprovedTeachers();

  const scheduleKey = `${selectedClass}__${selectedSection}`;

  const handleDragStart = useCallback((event) => {
    setActiveData(event.active.data.current);
  }, []);

  const handleDragEnd = useCallback((event) => {
    setActiveData(null);
    const { active, over } = event;
    if (!over) return;
    const dragData = active.data.current;
    const dropData = over.data.current;
    if (!dragData || !dropData) return;

    const { teacherId, teacherName, subject } = dragData;
    const { day, periodId } = dropData;

    // Conflict check
    const errors = checkConflicts(schedule, { classId: scheduleKey, day, periodId, teacherId, subject }, teachers, classes);
    if (errors.length > 0) {
      showToast(errors[0].message, 'error');
      return;
    }

    placeSlot(scheduleKey, day, periodId, teacherId, subject || '—');
    showToast(`${teacherName} assigned to ${selectedClass} - ${selectedSection}`, 'success');
  }, [schedule, placeSlot, showToast, scheduleKey, selectedClass, selectedSection, teachers, classes]);

  const handleRemove = useCallback((classId, day, periodId, teacherId) => {
    removeSlot(classId, day, periodId, teacherId);
    showToast('Assignment removed.', 'info');
  }, [removeSlot, showToast]);

  // Sidebar: teachers assigned to the selected class, sorted alphabetically, filtered by search
  const sidebarTeachers = teachers
    .filter(t => !t.classes?.length || t.classes.includes(selectedClass))
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase()))
    .map(t => ({
      teacher: t,
      subjects: t.subjects?.length ? t.subjects : ['—'],
    }));

  // Periods split into non-break and break for column headers
  const activePeriods = periods.filter(p => !p.isBreak);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="timetable-layout">
        {/* Sidebar */}
        <aside className="timetable-sidebar">
          <h3 className="sidebar-title">Teachers</h3>
          <div className="sidebar-search-wrapper">
            <input
              className="sidebar-search-input"
              type="text"
              placeholder="🔍 Search teacher..."
              value={teacherSearch}
              onChange={e => setTeacherSearch(e.target.value)}
            />
          </div>
          <p className="sidebar-hint">Select subject then drag ⠿ to assign</p>
          <div className="sidebar-teachers">
            {sidebarTeachers.length === 0 && (
              <p className="sidebar-empty">
                {teacherSearch ? 'No teachers match your search.' : 'No teachers assigned to this class. Add teachers in the Teachers tab.'}
              </p>
            )}
            {sidebarTeachers.map(({ teacher, subjects }) => (
              <DraggableTeacherChip
                key={teacher.id}
                teacher={teacher}
                subjects={subjects}
                classId={selectedClass}
              />
            ))}
          </div>
        </aside>

        {/* Grid — Days as rows, Periods as columns */}
        <div className="timetable-grid-wrapper">
          <table className="timetable-table">
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
                <tr key={day}>
                  <td className="period-label-cell day-label-cell">
                    <strong>{day}</strong>
                  </td>
                  {periods.map(period => {
                    if (period.isBreak) {
                      return (
                        <td key={period.id} className="period-cell break-cell">
                          <span>Break</span>
                        </td>
                      );
                    }
                    const rawSlot = schedule[scheduleKey]?.[day]?.[period.id] || schedule[selectedClass]?.[day]?.[period.id];
                    const slots = rawSlot ? (Array.isArray(rawSlot) ? rawSlot : [rawSlot]) : [];

                    const effectiveSlots = slots.map(s => {
                      const sub = substitutions[day]?.[scheduleKey]?.[period.id];
                      const isSubstituted = sub && sub.originalTeacherId === s.teacherId;
                      const displayTeacherId = isSubstituted ? sub.substituteId : s.teacherId;
                      const teacher = teachers.find(t => t.id === displayTeacherId);

                      return {
                        teacherId: s.teacherId,
                        displayTeacherId,
                        teacherName: teacher?.name || displayTeacherId,
                        subject: s.subject,
                        isSubstitute: !!isSubstituted
                      };
                    });

                    return (
                      <DroppableCell
                        key={period.id}
                        classId={scheduleKey}
                        day={day}
                        periodId={period.id}
                        slots={effectiveSlots}
                        onRemove={handleRemove}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DragOverlay>
        {activeData && (
          <div className="drag-overlay-chip">
            <span className="chip-avatar">{activeData.teacherName?.[0]}</span>
            <div>
              <div className="chip-name">{activeData.teacherName}</div>
              {activeData.subject && <div className="chip-subject">{activeData.subject}</div>}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
