import { createContext, useContext, useReducer, useEffect, useState } from 'react';
import api from '../services/api';
import { DAYS } from '../utils/constants';
import { useAuth } from './AuthContext';

const ScheduleContext = createContext(null);

const DEFAULT_PERIODS = [
  { id: 'p1', label: 'Period 1', time: '08:00 - 08:45' },
  { id: 'p2', label: 'Period 2', time: '08:45 - 09:30' },
  { id: 'p3', label: 'Period 3', time: '09:30 - 10:15' },
  { id: 'p4', label: 'Break', time: '10:15 - 10:30', isBreak: true },
  { id: 'p5', label: 'Period 4', time: '10:30 - 11:15' },
  { id: 'p6', label: 'Period 5', time: '11:15 - 12:00' },
  { id: 'p7', label: 'Lunch', time: '12:00 - 12:40', isBreak: true },
  { id: 'p8', label: 'Period 6', time: '12:40 - 13:25' },
  { id: 'p9', label: 'Period 7', time: '13:25 - 14:10' },
  { id: 'p10', label: 'Period 8', time: '14:10 - 14:55' },
];

const DEFAULT_CLASSES = [
  'Grade I', 'Grade II', 'Grade III', 'Grade IV', 'Grade V',
  'Grade VI', 'Grade VII', 'Grade VIII', 'Grade IX', 'Grade X',
  'Grade XI', 'Grade XII',
].map((name, i) => ({ id: `cls_${i + 1}`, name, sections: ['A'] }));

const DEFAULT_SUBJECTS = [
  'Mathematics', 'Science', 'English', 'Hindi', 'Social Studies',
  'Physics', 'Chemistry', 'Biology', 'History', 'Geography',
  'Computer Science', 'Physical Education', 'Art', 'Music',
];

const INITIAL_STATE = {
  classes: DEFAULT_CLASSES,
  periods: DEFAULT_PERIODS,
  subjects: DEFAULT_SUBJECTS,
  schedule: {},
  substitutions: {},
  absentTeachers: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'PLACE_SLOT': {
      const { classId, day, periodId, teacherId, subject } = action.payload;
      const existing = state.schedule[classId]?.[day]?.[periodId];
      const assignments = existing 
        ? (Array.isArray(existing) ? existing : [existing])
        : [];
      
      const newAssignments = [...assignments, { teacherId, subject }];

      return {
        ...state,
        schedule: {
          ...state.schedule,
          [classId]: {
            ...(state.schedule[classId] || {}),
            [day]: {
              ...(state.schedule[classId]?.[day] || {}),
              [periodId]: newAssignments,
            },
          },
        },
      };
    }
    case 'REMOVE_SLOT': {
      const { classId, day, periodId, teacherId } = action.payload;
      const existing = state.schedule[classId]?.[day]?.[periodId];
      if (!existing) return state;

      const assignments = Array.isArray(existing) ? existing : [existing];
      
      // If teacherId is provided, remove only that one
      const updatedAssignments = teacherId 
        ? assignments.filter(a => a.teacherId !== teacherId)
        : [];

      const daySchedule = { ...(state.schedule[classId]?.[day] || {}) };
      if (updatedAssignments.length === 0) {
        delete daySchedule[periodId];
      } else {
        daySchedule[periodId] = updatedAssignments;
      }

      return {
        ...state,
        schedule: {
          ...state.schedule,
          [classId]: { ...(state.schedule[classId] || {}), [day]: daySchedule },
        },
      };
    }
    case 'CLEAR_CLASS_SCHEDULE': {
      const { classId } = action.payload;
      const updated = { ...state.schedule };
      delete updated[classId];
      return { ...state, schedule: updated };
    }
    case 'MARK_ABSENT': {
      const { teacherId, day } = action.payload;
      const exists = state.absentTeachers.find(a => a.teacherId === teacherId && a.day === day);
      if (exists) return state;
      return { ...state, absentTeachers: [...state.absentTeachers, { teacherId, day }] };
    }
    case 'MARK_PRESENT': {
      const { teacherId, day } = action.payload;
      return {
        ...state,
        absentTeachers: state.absentTeachers.filter(a => !(a.teacherId === teacherId && a.day === day)),
      };
    }
    case 'ASSIGN_SUBSTITUTE': {
      const { classId, day, periodId, substituteId, originalTeacherId } = action.payload;
      const existingSubs = state.substitutions[day]?.[classId]?.[periodId];
      const subsArray = existingSubs ? (Array.isArray(existingSubs) ? existingSubs : [existingSubs]) : [];
      
      const updatedSubsArray = [...subsArray.filter(s => s.originalTeacherId !== originalTeacherId), { substituteId, originalTeacherId }];

      return {
        ...state,
        substitutions: {
          ...state.substitutions,
          [day]: {
            ...(state.substitutions[day] || {}),
            [classId]: {
              ...(state.substitutions[day]?.[classId] || {}),
              [periodId]: updatedSubsArray,
            },
          },
        },
      };
    }
    case 'REMOVE_SUBSTITUTE': {
      const { classId, day, periodId, substituteId } = action.payload;
      const existingSubs = state.substitutions[day]?.[classId]?.[periodId];
      if (!existingSubs) return state;

      const subsArray = Array.isArray(existingSubs) ? existingSubs : [existingSubs];
      const updatedSubsArray = substituteId 
        ? subsArray.filter(s => s.substituteId !== substituteId)
        : [];

      const updatedClass = { ...(state.substitutions[day]?.[classId] || {}) };
      if (updatedSubsArray.length === 0) {
        delete updatedClass[periodId];
      } else {
        updatedClass[periodId] = updatedSubsArray;
      }

      return {
        ...state,
        substitutions: {
          ...state.substitutions,
          [day]: { ...(state.substitutions[day] || {}), [classId]: updatedClass },
        },
      };
    }
    case 'UPDATE_CLASSES':
      return { ...state, classes: action.payload };
    case 'UPDATE_PERIODS':
      return { ...state, periods: action.payload };
    case 'UPDATE_SUBJECTS':
      return { ...state, subjects: action.payload };
    case 'RESET_SCHEDULE':
      return { ...state, schedule: {}, substitutions: {}, absentTeachers: [] };
    default:
      return state;
  }
}

export function ScheduleProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.schedule.get();
        if (data) {
          dispatch({ type: 'SET_STATE', payload: data });
        }
      } catch (err) {
        console.error('Failed to load schedule:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Sync to API - Only Admin should push global updates
  useEffect(() => {
    if (!loading && currentUser?.role === 'admin') {
      api.schedule.save(state).catch(err => {
        console.error('Failed to auto-save schedule:', err);
      });
    }
  }, [state, loading, currentUser]);

  function placeSlot(classId, day, periodId, teacherId, subject) {
    dispatch({ type: 'PLACE_SLOT', payload: { classId, day, periodId, teacherId, subject } });
  }

  function removeSlot(classId, day, periodId, teacherId = null) {
    dispatch({ type: 'REMOVE_SLOT', payload: { classId, day, periodId, teacherId } });
  }

  function markAbsent(teacherId, day) {
    dispatch({ type: 'MARK_ABSENT', payload: { teacherId, day } });
  }

  function markPresent(teacherId, day) {
    dispatch({ type: 'MARK_PRESENT', payload: { teacherId, day } });
  }

  function assignSubstitute(classId, day, periodId, substituteId, originalTeacherId) {
    dispatch({ type: 'ASSIGN_SUBSTITUTE', payload: { classId, day, periodId, substituteId, originalTeacherId } });
  }

  function removeSubstitute(classId, day, periodId, substituteId = null) {
    dispatch({ type: 'REMOVE_SUBSTITUTE', payload: { classId, day, periodId, substituteId } });
  }

  function getEffectiveTeacher(classId, day, periodId) {
    // This is rarely used directly for multi-assignments now since TimetableGrid computes it,
    // but just in case we return a general response.
    const subs = state.substitutions[day]?.[classId]?.[periodId];
    const subsArray = subs ? (Array.isArray(subs) ? subs : [subs]) : [];
    
    // First subst found
    if (subsArray.length > 0) return { teacherId: subsArray[0].substituteId, isSubstitute: true, originalTeacherId: subsArray[0].originalTeacherId };
    
    const slot = state.schedule[classId]?.[day]?.[periodId];
    if (slot) {
      const assignments = Array.isArray(slot) ? slot : [slot];
      return assignments.map(a => ({ teacherId: a.teacherId, subject: a.subject, isSubstitute: false }));
    }
    return null;
  }

  function isTeacherAbsent(teacherId, day) {
    return state.absentTeachers.some(a => a.teacherId === teacherId && a.day === day);
  }

  function getTeacherSchedule(teacherId) {
    const result = {};
    for (const day of DAYS) {
      result[day] = {};
      
      // Regular schedule
      for (const compositeKey of Object.keys(state.schedule)) {
        // Always extract the pure classId (first part before __) so the teacher
        // view can look it up in the classes array by id to display the name.
        const parts = compositeKey.split('__');
        const classId = parts[0];
        const section = parts[1] || 'A';
          
        const daySchedule = state.schedule[compositeKey]?.[day] || {};
        for (const periodId of Object.keys(daySchedule)) {
          const slot = daySchedule[periodId];
          if (slot) {
            const assignments = Array.isArray(slot) ? slot : [slot];
            const match = assignments.find(a => a.teacherId === teacherId);
            if (match) {
              if (!result[day][periodId]) result[day][periodId] = [];
              result[day][periodId].push({ classId, section, subject: match.subject });
            }
          }
        }
      }
      
      // Substitutions
      for (const compositeId of Object.keys(state.substitutions[day] || {})) {
        const classSubstitutions = state.substitutions[day][compositeId];
        const parts = compositeId.split('__');
        const classId = parts[0];
        const section = parts[1] || 'A';
          
        for (const periodId of Object.keys(classSubstitutions)) {
          const subs = classSubstitutions[periodId];
          const subsArray = Array.isArray(subs) ? subs : [subs];
          for (const sub of subsArray) {
            if (sub.substituteId === teacherId) {
              const origSlot = state.schedule[compositeId]?.[day]?.[periodId];
              const origAssignments = origSlot ? (Array.isArray(origSlot) ? origSlot : [origSlot]) : [];
              const origAssignment = origAssignments.find(a => a.teacherId === sub.originalTeacherId);
              if (!result[day][periodId]) result[day][periodId] = [];
              result[day][periodId].push({
                classId,
                section,
                subject: origAssignment?.subject || '—',
                isSubstitution: true,
              });
            }
          }
        }
      }
    }
    return result;
  }

  return (
    <ScheduleContext.Provider value={{
      ...state,
      loading,
      dispatch,
      placeSlot,
      removeSlot,
      markAbsent,
      markPresent,
      assignSubstitute,
      removeSubstitute,
      getEffectiveTeacher,
      isTeacherAbsent,
      getTeacherSchedule,
      DAYS,
    }}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  return useContext(ScheduleContext);
}
