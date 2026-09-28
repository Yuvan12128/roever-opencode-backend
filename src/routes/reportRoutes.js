const express = require('express');

const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  studentIdParam,
  departmentIdParam,
  dateParam,
  dateRangeQuery,
  paginationQuery,
  thresholdQuery,
  departmentQuery,
} = require('../validators/reportValidators');

const router = express.Router();

router.use(authenticate);

// Dashboard stats
router.get('/dashboard/admin', authorize('VP', 'ADMIN'), reportController.adminDashboard);
router.get('/dashboard/staff', authorize('STAFF'), reportController.staffDashboard);
router.get('/dashboard/student', authorize('STUDENT'), reportController.studentDashboard);

// Student report
router.get('/student/:studentId', authorize('VP', 'ADMIN', 'STAFF', 'STUDENT'), studentIdParam, dateRangeQuery, reportController.studentReport);
router.get('/student/:studentId/daily', authorize('VP', 'ADMIN', 'STAFF', 'STUDENT'), studentIdParam, dateRangeQuery, paginationQuery, reportController.studentDailyHistory);

// Department report
router.get('/department/:departmentId', authorize('VP', 'ADMIN', 'STAFF'), departmentIdParam, dateRangeQuery, reportController.departmentReport);

// Daily report
router.get('/daily/:date', authorize('VP', 'ADMIN', 'STAFF'), dateParam, departmentQuery, reportController.dailyReport);

// Low attendance
router.get('/low-attendance', authorize('VP', 'ADMIN', 'STAFF'), departmentQuery, thresholdQuery, dateRangeQuery, paginationQuery, reportController.lowAttendance);

module.exports = router;
