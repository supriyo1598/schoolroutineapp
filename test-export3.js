import { exportTeacherTimetablePDF } from './src/utils/exportUtils.js';

const classes = [
  { id: 'cls_1', name: 'Grade I', sections: ['A'] }
];
const periods = [
  { id: 'p1', label: 'Period 1', time: '08:00', isBreak: false }
];
const teacherSchedule = {
  Monday: {
    p1: { classId: 'cls_1__A', subject: 'Math', isSubstitution: false }
  }
};

try {
  exportTeacherTimetablePDF('John Doe', teacherSchedule, classes, periods);
  console.log('SUCCESS');
} catch (e) {
  console.error('ERROR:', e);
}
