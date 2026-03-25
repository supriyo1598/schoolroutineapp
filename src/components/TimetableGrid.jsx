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

    // Conflict check - Pass classes and subject
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

  // Build sidebar: teachers assigned to the selected class grouped by subject
  const sidebarTeachers = teachers.map(t => ({
    teacher: t,
    subjects: t.subjects?.length ? t.subjects : ['—'],
    assignedToClass: !t.classes?.length || t.classes.includes(selectedClass),
  })).filter(item => item.assignedToClass);



  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="timetable-layout">
        {/* Sidebar */}
        <aside className="timetable-sidebar">
          <h3 className="sidebar-title">Teachers</h3>
          <p className="sidebar-hint">Select subject and drag handle (⠿)</p>
          <div className="sidebar-teachers">
            {sidebarTeachers.length === 0 && (
              <p className="sidebar-empty">No teachers assigned to this class. Add teachers in the Teachers tab.</p>
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

        {/* Grid */}
        <div className="timetable-grid-wrapper">
          <table className="timetable-table">
            <thead>
              <tr>
                <th className="period-header-cell">Period</th>
                {DAYS.map(day => <th key={day} className="day-header">{day}</th>)}
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
                    ? <td colSpan={5} className="break-span">— {period.label} —</td>
                    : DAYS.map(day => {
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
                            key={day}
                            classId={scheduleKey}
                            day={day}
                            periodId={period.id}
                            slots={effectiveSlots}
                            onRemove={handleRemove}
                          />
                        );
                      })
                  }
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
