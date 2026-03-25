import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { DAYS } from './constants';

export function exportClassTimetablePDF(className, section, schedule, teachers, periods) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const fullTitle = section ? `${className} - Section ${section}` : className;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(`School Routine - ${fullTitle}`, 148.5, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 148.5, 22, { align: 'center' });

  const head = [['Period / Time', ...DAYS]];

  // Find the internal key (which might be name__section or just name)
  // But usually we pass the already filtered schedule for this specific class/section
  const body = periods.map(period => {
    const row = [`${period.label}\n${period.time || ''}`];
    for (const day of DAYS) {
      const slot = schedule?.[day]?.[period.id];
      if (slot) {
        const assignments = Array.isArray(slot) ? slot : [slot];
        const content = assignments.map(a => {
          const teacher = teachers.find(t => t.id === a.teacherId);
          return `${a.subject || '-'} [${teacher?.name || a.teacherId}]`;
        }).join('\n');
        row.push(content);
      } else {
        row.push('-');
      }
    }
    return row;
  });

  autoTable(doc, {
    startY: 28,
    head,
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 4,
      valign: 'middle',
      halign: 'center',
      lineColor: [203, 213, 225],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [248, 250, 252],
      fontStyle: 'bold',
      fontSize: 10,
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],
    },
    columnStyles: {
      0: { fillColor: [30, 41, 59], textColor: [248, 250, 252], fontStyle: 'bold', halign: 'left' },
    },
  });

  doc.save(`${fullTitle.replace(/\s+/g, '_')}_Timetable.pdf`);
}

export function exportTeacherTimetablePDF(teacherName, teacherSchedule, classes, periods) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(`Teacher Routine - ${teacherName}`, 148.5, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 148.5, 22, { align: 'center' });

  const head = [['Period', ...DAYS]];
  const body = periods.map(period => {
    const row = [`${period.label}\n${period.time || ''}`];
    for (const day of DAYS) {
      const slot = teacherSchedule[day]?.[period.id];
      if (slot) {
        // Extract class info and section from slot.classId (which might be Id__Section)
        const [classId, section] = slot.classId.split('__');
        const cls = classes.find(c => c.id === classId);
        const displayClass = section ? `${cls?.name || classId} (${section})` : (cls?.name || classId);
        row.push(`${slot.subject}\n${displayClass}`);
      } else {
        row.push('-');
      }
    }
    return row;
  });

  autoTable(doc, {
    startY: 28,
    head,
    body,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: [15, 23, 42], textColor: [248, 250, 252], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    columnStyles: { 0: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' } },
  });

  doc.save(`${teacherName.replace(/\s+/g, '_')}_Routine.pdf`);
}

export function exportAllClassesPDF(classes, schedule, teachers, periods) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  let pageAdded = false;
  classes.forEach((cls) => {
    (cls.sections || ['A']).forEach((section) => {
      if (pageAdded) doc.addPage();
      pageAdded = true;

      const fullTitle = `${cls.name} - Section ${section}`;
      const scheduleKey = `${cls.id}__${section}`;
      const sectionSchedule = schedule[scheduleKey] || schedule[cls.id] || {}; // Fallback for legacy data

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text(`School Routine - ${fullTitle}`, 148.5, 15, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 148.5, 22, { align: 'center' });

      const head = [['Period', ...DAYS]];
      const body = periods.map(period => {
        const row = [`${period.label}\n${period.time || ''}`];
        for (const day of DAYS) {
          const slot = sectionSchedule[day]?.[period.id];
          if (slot) {
            const assignments = Array.isArray(slot) ? slot : [slot];
            const content = assignments.map(a => {
              const teacher = teachers.find(t => t.id === a.teacherId);
              return `${a.subject || '-'} [${teacher?.name || ''}]`;
            }).join('\n');
            row.push(content);
          } else {
            row.push('-');
          }
        }
        return row;
      });

      autoTable(doc, {
        startY: 28,
        head,
        body,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [15, 23, 42], textColor: [248, 250, 252], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        columnStyles: { 0: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' } },
      });
    });
  });

  doc.save('School_Timetable_All_Classes.pdf');
}
