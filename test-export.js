import { exportClassTimetablePDF } from './src/utils/exportUtils.js';

const classes = [
  { id: 'cls_1', name: 'Grade I', sections: ['A'] }
];
const teachers = [
  { id: 't_1', name: 'John Doe' }
];
const periods = [
  { id: 'p1', label: 'Period 1', time: '08:00', isBreak: false }
];
const schedule = {
  Monday: {
    p1: [{ teacherId: 't_1', subject: 'Math' }]
  }
};

try {
  exportClassTimetablePDF('Grade I', 'A', schedule, teachers, periods);
  console.log('SUCCESS');
} catch (e) {
  console.error('ERROR:', e);
}
