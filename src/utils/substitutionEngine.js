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
    // Find teachers who take classes in this GRADE (all sections)
    const classTeachers = new Set();
    const baseClassId = slot.classId.split('__')[0];
    
    for (const compositeId of Object.keys(schedule)) {
      if (!compositeId.startsWith(baseClassId)) continue;
      
      const classSchedule = schedule[compositeId] || {};
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
    }

    // Consider ALL approved teachers (except the absent one)
    const sorted = teachers.filter(t => t.id !== absentTeacherId)
      .map(t => {
        let count = 0;
        // Count periods today in original schedule
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
        // Count periods today in active substitutions
        const daySubs = substitutions[day] || {};
        for (const classId of Object.keys(daySubs)) {
          for (const pId of Object.keys(daySubs[classId])) {
            const subsArray = Array.isArray(daySubs[classId][pId]) ? daySubs[classId][pId] : [daySubs[classId][pId]];
            if (subsArray.some(sub => sub.substituteId === t.id)) count++;
          }
        }

        // Check availability this period
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

        const isSubjectMatch = t.subjects && t.subjects.includes(slot.subject);
        const isClassMatch = classTeachers.has(t.id);
        
        let matchRank = 4; // Default: General
        let matchType = 'Available (General)';

        if (isSubjectMatch && isClassMatch) {
          matchRank = 0;
          matchType = 'Subject & Class Expert';
        } else if (isSubjectMatch) {
          matchRank = 1;
          matchType = 'Subject Specialist';
        } else if (isClassMatch) {
          matchRank = 2;
          matchType = 'Class Teacher';
        }

        return { teacher: t, periodsToday: count, busy, matchType, matchRank };
      })
      .filter(c => !c.busy)
      .sort((a, b) => {
        // First by expertise rank
        if (a.matchRank !== b.matchRank) return a.matchRank - b.matchRank;
        // Then by load balancing (fewer periods first)
        return a.periodsToday - b.periodsToday;
      });

    return {
      ...slot,
      suggestions: sorted.slice(0, 20), // Show up to 20 options
      selectedSubstitute: sorted[0]?.teacher?.id || null,
    };
  });

  return suggestions;
}
