// Auto-substitution engine
// Given an absent teacher and a day, finds all their periods and suggests substitutes

export function findSubstitutes(absentTeacherId, day, schedule, teachers, substitutions = {}) {
  const slots = [];

  // Find all slots this teacher has on this day
  for (const compositeId of Object.keys(schedule)) {
    const daySchedule = schedule[compositeId]?.[day] || {};
    for (const periodId of Object.keys(daySchedule)) {
      const slot = daySchedule[periodId];
      if (slot) {
        const assignments = Array.isArray(slot) ? slot : [slot];
        const match = assignments.find(a => a.teacherId === absentTeacherId);
        if (match) {
          slots.push({ classId: compositeId, day, periodId, subject: match.subject, currentTeacherId: absentTeacherId });
        }
      }
    }
  }

  // For each slot, find eligible substitutes
  const suggestions = slots.map(slot => {
    // Find teachers who take classes in this class
    const classTeachers = new Set();
    const classSchedule = schedule[slot.classId] || {};
    for (const d of Object.keys(classSchedule)) {
      for (const p of Object.keys(classSchedule[d])) {
        const s = classSchedule[d][p];
        if (s) {
          const arr = Array.isArray(s) ? s : [s];
          arr.forEach(a => {
            if (a.teacherId) classTeachers.add(a.teacherId);
          });
        }
      }
    }

    // Find candidates who teach this subject OR take classes in this class
    const candidates = teachers.filter(t => {
      if (t.id === absentTeacherId) return false;
      if (!t.subjects || t.subjects.length === 0) return true;
      return t.subjects.includes(slot.subject) || classTeachers.has(t.id);
    });

    // Sort by periods already assigned on this day (ascending)
    const sorted = candidates.map(t => {
      let count = 0;
      for (const compositeId of Object.keys(schedule)) {
        const daySchedule = schedule[compositeId]?.[day] || {};
        for (const pId of Object.keys(daySchedule)) {
          const s = daySchedule[pId];
          if (s) {
            const arr = Array.isArray(s) ? s : [s];
            if (arr.some(a => a.teacherId === t.id)) count++;
          }
        }
      }
      const daySubs = substitutions[day] || {};
      for (const classId of Object.keys(daySubs)) {
        for (const pId of Object.keys(daySubs[classId])) {
           const subsArray = Array.isArray(daySubs[classId][pId]) ? daySubs[classId][pId] : [daySubs[classId][pId]];
           if (subsArray.some(sub => sub.substituteId === t.id)) count++;
        }
      }

      // Check if they're free this period
      let busy = false;
      for (const compositeId of Object.keys(schedule)) {
        const s = schedule[compositeId]?.[day]?.[slot.periodId];
        if (s) {
          const arr = Array.isArray(s) ? s : [s];
          if (arr.some(a => a.teacherId === t.id)) {
            busy = true;
            break;
          }
        }
      }
      if (!busy) {
        for (const compositeId of Object.keys(daySubs)) {
           const subPeriods = daySubs[compositeId][slot.periodId];
           if (subPeriods) {
              const arr = Array.isArray(subPeriods) ? subPeriods : [subPeriods];
              if (arr.some(sub => sub.substituteId === t.id)) {
                 busy = true;
                 break;
              }
           }
        }
      }
      let isSubjectMatch = t.subjects && t.subjects.includes(slot.subject);
      let isClassMatch = classTeachers.has(t.id);
      let matchType = isSubjectMatch && isClassMatch ? 'Subject & Class' :
                      isSubjectMatch ? 'Subject' : 'Class Teacher';

      return { teacher: t, periodsToday: count, busy, matchType };
    })
      .filter(c => !c.busy && c.periodsToday < 7)
      .sort((a, b) => a.periodsToday - b.periodsToday);

    return {
      ...slot,
      suggestions: sorted.slice(0, 5), // top 5 suggestions
      selectedSubstitute: sorted[0]?.teacher?.id || null,
    };
  });

  return suggestions;
}
