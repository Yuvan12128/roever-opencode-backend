const { body, param, query } = require('express-validator');

const PERIOD_VALUES = ['p1', 'p2', 'p3', 'p4', 'p5'];
const STATUS_VALUES = ['PRESENT', 'ABSENT'];

const attendanceListRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('date').optional().isISO8601().withMessage('Invalid date format'),
  query('studentId').optional().isMongoId().withMessage('Invalid student ID'),
  query('period').optional().isIn(PERIOD_VALUES).withMessage('Period must be p1, p2, p3, p4, or p5'),
  query('status').optional().isIn(STATUS_VALUES).withMessage('Status must be PRESENT or ABSENT'),
];

const attendanceIdRules = [param('id').isMongoId().withMessage('Invalid attendance ID')];

const attendanceDateRules = [
  param('date').isISO8601().withMessage('Invalid date format (YYYY-MM-DD)'),
];

const attendanceStudentRules = [
  param('studentId').isMongoId().withMessage('Invalid student ID'),
  query('fromDate').optional().isISO8601().withMessage('Invalid from date'),
  query('toDate').optional().isISO8601().withMessage('Invalid to date'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];

const markAttendanceRules = [
  body('studentId').notEmpty().withMessage('Student ID is required').isMongoId().withMessage('Invalid student ID'),
  body('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Invalid date format'),
  body('period').notEmpty().withMessage('Period is required').isIn(PERIOD_VALUES).withMessage('Period must be p1, p2, p3, p4, or p5'),
  body('status').notEmpty().withMessage('Status is required').isIn(STATUS_VALUES).withMessage('Status must be PRESENT or ABSENT'),
];

const bulkMarkAttendanceRules = [
  body('studentIds').isArray({ min: 1 }).withMessage('studentIds must be a non-empty array'),
  body('studentIds.*').isMongoId().withMessage('Invalid student ID'),
  body('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Invalid date format'),
  body('period').notEmpty().withMessage('Period is required').isIn(PERIOD_VALUES).withMessage('Period must be p1, p2, p3, p4, or p5'),
  body('status').notEmpty().withMessage('Status is required').isIn(STATUS_VALUES).withMessage('Status must be PRESENT or ABSENT'),
];

const updateAttendanceRules = [
  param('id').isMongoId().withMessage('Invalid attendance ID'),
  body('period').notEmpty().withMessage('Period is required').isIn(PERIOD_VALUES).withMessage('Period must be p1, p2, p3, p4, or p5'),
  body('status').notEmpty().withMessage('Status is required').isIn(STATUS_VALUES).withMessage('Status must be PRESENT or ABSENT'),
];

const studentsForMarkingRules = [
  query('departmentId').optional().isMongoId().withMessage('Invalid department ID'),
  query('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Invalid date format'),
];

module.exports = {
  attendanceListRules,
  attendanceIdRules,
  attendanceDateRules,
  attendanceStudentRules,
  markAttendanceRules,
  bulkMarkAttendanceRules,
  updateAttendanceRules,
  studentsForMarkingRules,
};
