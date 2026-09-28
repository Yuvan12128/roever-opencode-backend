const { param, query } = require('express-validator');

const studentIdParam = [param('studentId').isMongoId().withMessage('Invalid student ID')];

const departmentIdParam = [param('departmentId').isMongoId().withMessage('Invalid department ID')];

const dateParam = [param('date').isISO8601().withMessage('Invalid date format (YYYY-MM-DD)')];

const dateRangeQuery = [
  query('fromDate').optional().isISO8601().withMessage('Invalid from date'),
  query('toDate').optional().isISO8601().withMessage('Invalid to date'),
];

const paginationQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];

const thresholdQuery = [
  query('threshold').optional().isInt({ min: 1, max: 100 }).withMessage('Threshold must be between 1 and 100'),
];

const departmentQuery = [
  query('departmentId').optional().isMongoId().withMessage('Invalid department ID'),
];

module.exports = {
  studentIdParam,
  departmentIdParam,
  dateParam,
  dateRangeQuery,
  paginationQuery,
  thresholdQuery,
  departmentQuery,
};
