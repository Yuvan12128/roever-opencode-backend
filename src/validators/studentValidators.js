const { body, param, query } = require('express-validator');

const studentCreateRules = [
  body('rollNo')
    .trim()
    .notEmpty()
    .withMessage('Roll number is required')
    .isLength({ max: 30 })
    .withMessage('Roll number cannot exceed 30 characters'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Student name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage('Please provide a valid phone number'),
  body('departmentId')
    .notEmpty()
    .withMessage('Department is required')
    .isMongoId()
    .withMessage('Invalid department ID'),
  body('academicYearId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid academic year ID'),
  body('year')
    .notEmpty()
    .withMessage('Year is required')
    .isInt({ min: 1, max: 6 })
    .withMessage('Year must be between 1 and 6'),
  body('section')
    .optional()
    .trim()
    .isLength({ max: 5 })
    .withMessage('Section cannot exceed 5 characters'),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Status must be ACTIVE or INACTIVE'),
];

const studentUpdateRules = [
  param('id').isMongoId().withMessage('Invalid student ID'),
  body('rollNo')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Roll number cannot be empty')
    .isLength({ max: 30 })
    .withMessage('Roll number cannot exceed 30 characters'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Student name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage('Please provide a valid phone number'),
  body('departmentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid department ID'),
  body('academicYearId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid academic year ID'),
  body('year')
    .optional()
    .isInt({ min: 1, max: 6 })
    .withMessage('Year must be between 1 and 6'),
  body('section')
    .optional()
    .trim()
    .isLength({ max: 5 })
    .withMessage('Section cannot exceed 5 characters'),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Status must be ACTIVE or INACTIVE'),
];

const studentIdRules = [param('id').isMongoId().withMessage('Invalid student ID')];

const studentStatusRules = [
  param('id').isMongoId().withMessage('Invalid student ID'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Status must be ACTIVE or INACTIVE'),
];

const studentListRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().trim().isLength({ max: 100 }).withMessage('Search too long'),
  query('departmentId').optional().isMongoId().withMessage('Invalid department ID'),
  query('year').optional().isInt({ min: 1, max: 6 }).withMessage('Year must be between 1 and 6'),
  query('section').optional().trim().isLength({ max: 5 }).withMessage('Section too long'),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Status must be ACTIVE or INACTIVE'),
];

module.exports = {
  studentCreateRules,
  studentUpdateRules,
  studentIdRules,
  studentStatusRules,
  studentListRules,
};
