import { createContext, useContext, useReducer, useEffect, useState, useMemo, useCallback } from 'react';
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
  isLocked: false,
  schedule: {},
  substitutions: {},   // { [date: YYYY-MM-DD]: { [classId]: { [periodId]: [...subs] } } }
  absentTeachers: [],  // { teacherId, day, date }
  lastChangedClassId: null,
  lastChangeType: null,
  lastChangeId: null,
};

// Helper: get YYYY-MM-DD for a given day name in the current week
function getThisWeekDate(dayName) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date();
  const todayDay = today.getDay();
  const targetDay = dayNames.indexOf(dayName);
  if (targetDay === -1) return null;
  const diff = targetDay - todayDay;
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  return target.toISOString().split('T')[0];
}

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
        lastChangedClassId: classId,
        lastChangeType: 'class',
        lastChangeId: Date.now(),
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
        lastChangedClassId: classId,
        lastChangeType: 'class',
        lastChangeId: Date.now(),
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
      return { ...state, lastChangedClassId: classId, lastChangeType: 'class', lastChangeId: Date.now(), schedule: updated };
    }
    case 'MARK_ABSENT': {
      // date is required; day is derived from date
      const { teacherId, day, date } = action.payload;
      const exists = state.absentTeachers.find(a => a.teacherId === teacherId && a.date === date);
      if (exists) return state;
      return {
        ...state,
        lastChangeType: 'absent',
        lastChangeId: Date.now(),
        absentTeachers: [...state.absentTeachers, { teacherId, day, date }],
      };
    }
    case 'MARK_PRESENT': {
      const { teacherId, date } = action.payload;
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const derivedDay = date ? dayNames[new Date(date + 'T00:00:00').getDay()] : null;
      
      return {
        ...state,
        lastChangeType: 'absent',
        lastChangeId: Date.now(),
        absentTeachers: state.absentTeachers.filter(a => {
          // If the record has a date, match strictly on date
          if (a.date) {
            return !(a.teacherId === teacherId && a.date === date);
          }
          // If the record has no date (legacy), match on day name
          return !(a.teacherId === teacherId && a.day === derivedDay);
        }),
      };
    }
    case 'ASSIGN_SUBSTITUTE': {
      // date (YYYY-MM-DD) is the key, replacing old day-name key
      const { classId, date, periodId, substituteId, originalTeacherId } = action.payload;
      const existingSubs = state.substitutions[date]?.[classId]?.[periodId];
      const subsArray = existingSubs ? (Array.isArray(existingSubs) ? existingSubs : [existingSubs]) : [];
      const updatedSubsArray = [...subsArray.filter(s => s.originalTeacherId !== originalTeacherId), { substituteId, originalTeacherId }];
      return {
        ...state,
        lastChangeType: 'substitutions',
        lastChangeId: Date.now(),
        substitutions: {
          ...state.substitutions,
          [date]: {
            ...(state.substitutions[date] || {}),
            [classId]: {
              ...(state.substitutions[date]?.[classId] || {}),
              [periodId]: updatedSubsArray,
            },
          },
        },
      };
    }
    case 'REMOVE_SUBSTITUTE': {
      const { classId, date, periodId, substituteId } = action.payload;
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = date ? dayNames[new Date(date + 'T00:00:00').getDay()] : null;
      
      const newSubs = { ...state.substitutions };
      
      // Keys to check and remove from (both date and day name for legacy support)
      const keys = [date, dayName].filter(Boolean);
      
      keys.forEach(key => {
        const existingSubs = newSubs[key]?.[classId]?.[periodId];
        if (existingSubs) {
          const subsArray = Array.isArray(existingSubs) ? existingSubs : [existingSubs];
          const updatedSubsArray = substituteId 
            ? subsArray.filter(s => s.substituteId !== substituteId)
            : [];
          
          if (updatedSubsArray.length === 0) {
            delete newSubs[key][classId][periodId];
            if (Object.keys(newSubs[key][classId]).length === 0) {
              delete newSubs[key][classId];
            }
          } else {
            newSubs[key][classId][periodId] = updatedSubsArray;
          }
        }
      });

      return {
        ...state,
        lastChangeType: 'substitutions',
        lastChangeId: Date.now(),
        substitutions: newSubs,
      };
    }
    case 'UPDATE_CLASSES':
      return { ...state, lastChangeType: 'config', lastChangeId: Date.now(), classes: action.payload };
    case 'UPDATE_PERIODS':
      return { ...state, lastChangeType: 'config', lastChangeId: Date.now(), periods: action.payload };
    case 'UPDATE_SUBJECTS':
      return { ...state, lastChangeType: 'config', lastChangeId: Date.now(), subjects: action.payload };
    case 'TOGGLE_LOCK':
      return { ...state, lastChangeType: 'config', lastChangeId: Date.now(), isLocked: !state.isLocked };
    case 'RESET_SCHEDULE':
      return { ...state, lastChangeType: 'config', lastChangeId: Date.now(), schedule: {}, substitutions: {}, absentTeachers: [] };
    default:
      return state;
  }
}

export function ScheduleProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('synced');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isFirstLoadDone, setIsFirstLoadDone] = useState(false);
  const { currentUser } = useAuth();

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Role-based filtered classes
  const filteredClasses = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'super_admin') return state.classes;
    if (currentUser.role === 'admin') {
      const assigned = currentUser.assignedClasses || [];
      return state.classes.filter(c => assigned.includes(c.id));
    }
    return state.classes;
  }, [state.classes, currentUser]);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await api.schedule.get();
      if (data && Object.keys(data).length > 0) {
        dispatch({ type: 'SET_STATE', payload: data });
        setLastSyncTime(new Date());
      }
      setIsFirstLoadDone(true);
      setSyncStatus('synced');
    } catch (err) {
      console.error('Failed to load schedule:', err);
      setSyncStatus('error');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Background Polling (30s)
  useEffect(() => {
    const interval = setInterval(() => {
      if (syncStatus !== 'saving') {
        loadData(true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData, syncStatus]);

  // Refresh on Focus
  useEffect(() => {
    const handleFocus = () => loadData(true);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadData]);

  // Targeted Sync Worker
  useEffect(() => {
    if (!loading && isAdmin && isFirstLoadDone && state.lastChangeId) {
      const { lastChangeType, lastChangedClassId } = state;
      const timer = setTimeout(async () => {
        setSyncStatus('saving');
        try {
          if (lastChangeType === 'class' && lastChangedClassId) {
            await api.schedule.updateKey(`sch_cls_${lastChangedClassId}`, state.schedule[lastChangedClassId]);
          } else if (lastChangeType === 'absent') {
            await api.schedule.updateKey('sch_absent', state.absentTeachers);
          } else if (lastChangeType === 'substitutions') {
            await api.schedule.updateKey('sch_substitutes', state.substitutions);
          } else if (lastChangeType === 'config') {
            await api.schedule.updateKey('sch_config', {
              classes: state.classes,
              periods: state.periods,
              subjects: state.subjects,
              isLocked: state.isLocked
            });
          }
          setSyncStatus('synced');
          setLastSyncTime(new Date());
        } catch (err) {
          console.error('Granular sync failed:', err);
          setSyncStatus('error');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state.lastChangeId, loading, isAdmin, isFirstLoadDone]);

  // Handle Initial Migration
  useEffect(() => {
    async function migrateIfNeeded() {
      if (!isFirstLoadDone || !isAdmin) return;
      try {
        const rows = await api.schedule.getRaw();
        const hasGranular = rows.some(r => r.key.startsWith('sch_cls_'));
        const legacy = rows.find(r => r.key === 'schedule_data');
        if (!hasGranular && legacy?.value?.schedule) {
          console.log('Migrating legacy schedule to granular rows...');
          const sched = legacy.value.schedule;
          for (const classId of Object.keys(sched)) {
            await api.schedule.updateKey(`sch_cls_${classId}`, sched[classId]);
          }
          await api.schedule.updateKey('sch_config', {
            classes: legacy.value.classes || state.classes,
            periods: legacy.value.periods || state.periods,
            subjects: legacy.value.subjects || state.subjects,
            isLocked: legacy.value.isLocked || state.isLocked
          });
          if (legacy.value.absentTeachers) {
            await api.schedule.updateKey('sch_absent', legacy.value.absentTeachers);
          }
          if (legacy.value.substitutions) {
            const subs = legacy.value.substitutions;
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            // Convert day-name keys to this week's dates
            for (const key of Object.keys(subs)) {
              if (dayNames.includes(key)) {
                const targetDate = getThisWeekDate(key);
                if (targetDate) {
                  subs[targetDate] = { ...(subs[targetDate] || {}), ...subs[key] };
                  delete subs[key];
                }
              }
            }
            await api.schedule.updateKey('sch_substitutes', subs);
          }
          console.log('Migration complete.');
        }
      } catch (err) {
        console.error('Migration failed:', err);
      }
    }
    migrateIfNeeded();
  }, [isFirstLoadDone, isAdmin]);


  function placeSlot(classId, day, periodId, teacherId, subject) {
    dispatch({ type: 'PLACE_SLOT', payload: { classId, day, periodId, teacherId, subject } });
  }

  function removeSlot(classId, day, periodId, teacherId = null) {
    dispatch({ type: 'REMOVE_SLOT', payload: { classId, day, periodId, teacherId } });
  }

  // markAbsent now requires date; day is auto-derived if not passed
  function markAbsent(teacherId, day, date) {
    const resolvedDate = date || getThisWeekDate(day) || new Date().toISOString().split('T')[0];
    dispatch({ type: 'MARK_ABSENT', payload: { teacherId, day, date: resolvedDate } });
  }

  // markPresent now removes by date
  function markPresent(teacherId, date) {
    dispatch({ type: 'MARK_PRESENT', payload: { teacherId, date } });
  }

  // assignSubstitute now uses date as the key
  function assignSubstitute(classId, date, periodId, substituteId, originalTeacherId) {
    dispatch({ type: 'ASSIGN_SUBSTITUTE', payload: { classId, date, periodId, substituteId, originalTeacherId } });
  }

  function removeSubstitute(classId, date, periodId, substituteId = null) {
    dispatch({ type: 'REMOVE_SUBSTITUTE', payload: { classId, date, periodId, substituteId } });
  }

  function toggleLock() {
    dispatch({ type: 'TOGGLE_LOCK' });
  }

  async function saveSchedule() {
    setSyncStatus('saving');
    try {
      await api.schedule.save(state);
      setSyncStatus('synced');
      return { success: true };
    } catch (err) {
      console.error('Manual save failed:', err);
      setSyncStatus('error');
      return { success: false, error: err.message };
    }
  }

  function getEffectiveTeacher(classId, date, periodId) {
    const subs = state.substitutions[date]?.[classId]?.[periodId];
    const subsArray = subs ? (Array.isArray(subs) ? subs : [subs]) : [];
    if (subsArray.length > 0) return { teacherId: subsArray[0].substituteId, isSubstitute: true, originalTeacherId: subsArray[0].originalTeacherId };
    const slot = state.schedule[classId]?.[date]?.[periodId];
    if (slot) {
      const assignments = Array.isArray(slot) ? slot : [slot];
      return assignments.map(a => ({ teacherId: a.teacherId, subject: a.subject, isSubstitute: false }));
    }
    return null;
  }

  // Check absent by day-of-week: checks current week's date (new) AND legacy day-name records
  function isTeacherAbsent(teacherId, day) {
    const thisWeekDate = getThisWeekDate(day);
    // New format: date-based
    if (thisWeekDate && state.absentTeachers.some(a => a.teacherId === teacherId && a.date === thisWeekDate)) {
      return true;
    }
    // Legacy format: day-name-based (records that have no date field)
    return state.absentTeachers.some(a => a.teacherId === teacherId && a.day === day && !a.date);
  }

  // Check absent by specific date: checks date (new) AND derives day-name for legacy records
  function isTeacherAbsentOnDate(teacherId, date) {
    // New format: exact date match
    if (state.absentTeachers.some(a => a.teacherId === teacherId && a.date === date)) {
      return true;
    }
    // Legacy format: derive day name from date and match on day field
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const derivedDay = dayNames[new Date(date + 'T00:00:00').getDay()];
    return state.absentTeachers.some(a => a.teacherId === teacherId && a.day === derivedDay && !a.date);
  }

  function getTeacherSchedule(teacherId) {
    const result = {};
    for (const day of DAYS) {
      result[day] = {};
      
      // Regular schedule (keyed by day-of-week)
      for (const compositeKey of Object.keys(state.schedule)) {
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
      
      // Substitutions (STRICTLY keyed by date)
      const thisWeekDate = getThisWeekDate(day);
      if (thisWeekDate) {
        const dateKey = thisWeekDate;
        for (const compositeId of Object.keys(state.substitutions[dateKey] || {})) {
          const classSubstitutions = state.substitutions[dateKey][compositeId];
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
                // Avoid duplicates
                const alreadyAdded = result[day][periodId].some(s => s.isSubstitution && s.classId === classId);
                if (!alreadyAdded) {
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
      }
    }
    return result;
  }

  return (
    <ScheduleContext.Provider value={{
      ...state,
      filteredClasses: filteredClasses || [],
      loading,
      syncStatus,
      lastSyncTime,
      dispatch,
      placeSlot,
      removeSlot,
      markAbsent,
      markPresent,
      assignSubstitute,
      removeSubstitute,
      toggleLock,
      saveSchedule,
      getEffectiveTeacher,
      isTeacherAbsent,
      isTeacherAbsentOnDate,
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
