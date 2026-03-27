// Conflict Detection Rules:
// 1. Teacher already assigned in this period (same day) across any class → BLOCKED
// 2. Teacher at max periods for the day (7) → BLOCKED
// 3. Slot already has a teacher assigned → BLOCKED (unless overlap is allowed)

function isOverlapAllowed(classId, subject, classes = []) {
  if (!subject) return false;
  
  // Rule 1: 2nd Language (Hindi, Bengali, etc.)
  const langSubjects = ['hindi', 'bengali', 'sanskrit', 'urdu', 'french'];
  const lowerSub = subject.toLowerCase().trim();
  if (langSubjects.some(lang => lowerSub.includes(lang))) return true;

  // Rule 2: Senior Classes (IX, X, XI, XII)
  const [baseClassId] = classId.split('__');
  const cls = classes.find(c => c.id === baseClassId);
  const className = cls?.name || '';
  
  const seniorGrades = ['grade ix', 'grade x', 'grade xi', 'grade xii'];
  if (seniorGrades.some(g => className.toLowerCase().includes(g))) return true;

  return false;
}

export function checkConflicts(schedule, { classId, day, periodId, teacherId, subject }, teachers = [], classes = []) {
  const errors = [];

  // Check if slot is already occupied
  const existing = schedule[classId]?.[day]?.[periodId];
  if (existing) {
    const assignments = Array.isArray(existing) ? existing : [existing];
    
    // Check if the same teacher is already in THIS slot
    if (assignments.some(a => a.teacherId === teacherId)) {
      errors.push({
        type: 'DUPLICATE_TEACHER',
        message: `Teacher is already assigned to this slot.`,
      });
      return errors;
    }

    // Check if overlap is allowed
    const isNewAllowed = isOverlapAllowed(classId, subject, classes);
    const areExistingAllowed = assignments.every(a => isOverlapAllowed(classId, a.subject, classes));

    if (!isNewAllowed || !areExistingAllowed) {
      errors.push({
        type: 'SLOT_OCCUPIED',
        message: `This slot already has an assignment. Both the existing and new subjects must allow simultaneous periods (e.g. 2nd Languages or Senior Grades).`,
      });
    }
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
