const express = require('express');

const attendanceController = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  attendanceListRules,
  attendanceIdRules,
  attendanceDateRules,
  attendanceStudentRules,
  markAttendanceRules,
  bulkMarkAttendanceRules,
  updateAttendanceRules,
  studentsForMarkingRules,
} = require('../validators/attendanceValidators');

const router = express.Router();

// All attendance routes require authentication
router.use(authenticate);

// VP/ADMIN/STAFF can view and mark attendance
router.get('/', authorize('VP', 'ADMIN', 'STAFF'), attendanceListRules, attendanceController.list);
router.get('/students/marking', authorize('VP', 'ADMIN', 'STAFF'), studentsForMarkingRules, attendanceController.getStudentsForMarking);
router.get('/date/:date', authorize('VP', 'ADMIN', 'STAFF'), attendanceDateRules, attendanceController.getByDate);
router.get('/student/:studentId', authorize('VP', 'ADMIN', 'STAFF', 'STUDENT'), attendanceStudentRules, attendanceController.getByStudent);
router.get('/:id', authorize('VP', 'ADMIN', 'STAFF'), attendanceIdRules, attendanceController.getById);

// Mark attendance (VP/ADMIN/STAFF only)
router.post('/mark', authorize('VP', 'ADMIN', 'STAFF'), markAttendanceRules, attendanceController.mark);
router.post('/bulk-mark', authorize('VP', 'ADMIN', 'STAFF'), bulkMarkAttendanceRules, attendanceController.bulkMark);

// Update attendance (VP/ADMIN/STAFF only)
router.put('/:id', authorize('VP', 'ADMIN', 'STAFF'), updateAttendanceRules, attendanceController.update);

module.exports = router;
