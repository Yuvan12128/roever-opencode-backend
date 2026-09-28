const { body, param } = require('express-validator');

const departmentCreateRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Department name is required')
    .isLength({ max: 150 })
    .withMessage('Department name cannot exceed 150 characters'),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Department code is required')
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage('Department code must contain only letters and numbers')
    .isLength({ max: 20 })
    .withMessage('Department code cannot exceed 20 characters'),
];

const departmentUpdateRules = [
  param('id').isMongoId().withMessage('Invalid department ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Department name cannot be empty')
    .isLength({ max: 150 })
    .withMessage('Department name cannot exceed 150 characters'),
  body('code')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Department code cannot be empty')
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage('Department code must contain only letters and numbers'),
];

const departmentIdRules = [param('id').isMongoId().withMessage('Invalid department ID')];

const departmentStatusRules = [
  param('id').isMongoId().withMessage('Invalid department ID'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Status must be ACTIVE or INACTIVE'),
];

module.exports = {
  departmentCreateRules,
  departmentUpdateRules,
  departmentIdRules,
  departmentStatusRules,
};
