// Conflict Detection Rules:
// 1. Teacher already assigned in this period (same day) across any class → BLOCKED
// 2. Teacher at max periods for the day (7) → BLOCKED
// 3. Same teacher assigned twice in the same slot → BLOCKED
// Multiple teachers/subjects CAN be assigned to the same slot in any class.

export function checkConflicts(schedule, { classId, day, periodId, teacherId, subject }, teachers = [], classes = []) {
  const errors = [];

  // Check if the same teacher is already in THIS exact slot (prevent duplicates)
  const existing = schedule[classId]?.[day]?.[periodId];
  if (existing) {
    const assignments = Array.isArray(existing) ? existing : [existing];
    
    if (assignments.some(a => a.teacherId === teacherId)) {
      errors.push({
        type: 'DUPLICATE_TEACHER',
        message: `Teacher is already assigned to this slot.`,
      });
      return errors;
    }
    // Multiple teachers/subjects are always allowed in the same slot
  }

  // Check teacher conflict: same teacher, same day, same period, any class
  for (const cId of Object.keys(schedule)) {
    if (cId === classId) continue;
    const slot = schedule[cId]?.[day]?.[periodId];
    if (slot) {
      const assignments = Array.isArray(slot) ? slot : [slot];
      if (assignments.some(a => a.teacherId === teacherId)) {
        errors.push({
          type: 'TEACHER_CONFLICT',
          message: `Teacher is already assigned to ${cId} during this period on ${day}.`,
        });
        break;
      }
    }
  }

  // Check max periods per day (7)
  if (teacherId) {
    let count = 0;
    for (const cId of Object.keys(schedule)) {
      const daySchedule = schedule[cId]?.[day] || {};
      for (const pId of Object.keys(daySchedule)) {
        const slot = daySchedule[pId];
        if (slot) {
          const assignments = Array.isArray(slot) ? slot : [slot];
          if (assignments.some(a => a.teacherId === teacherId)) count++;
        }
      }
    }
    if (count >= 7) {
      errors.push({
        type: 'MAX_PERIODS',
        message: `Teacher has already reached the maximum of 7 periods on ${day}.`,
      });
    }
  }

  return errors;
}

export function getTeacherDayCount(schedule, teacherId, day) {
  let count = 0;
  for (const cId of Object.keys(schedule)) {
    const daySchedule = schedule[cId]?.[day] || {};
    for (const pId of Object.keys(daySchedule)) {
      const slot = daySchedule[pId];
      if (slot) {
        const assignments = Array.isArray(slot) ? slot : [slot];
        if (assignments.some(a => a.teacherId === teacherId)) count++;
      }
    }
  }
  return count;
}

export function isTeacherBusy(schedule, teacherId, day, periodId, excludeClass = null) {
  for (const cId of Object.keys(schedule)) {
    if (cId === excludeClass) continue;
    const slot = schedule[cId]?.[day]?.[periodId];
    if (slot) {
      const assignments = Array.isArray(slot) ? slot : [slot];
      if (assignments.some(a => a.teacherId === teacherId)) return true;
    }
  }
  return false;
}
