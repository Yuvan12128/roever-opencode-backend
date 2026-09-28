const { validationResult } = require('express-validator');
const studentService = require('../services/studentService');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/response');

/**
 * Resolve the effective department filter.
 * STAFF users are hard-pinned to their own department — any departmentId
 * sent from the frontend is ignored. VP/ADMIN can filter by any department.
 */
const resolveDepartmentFilter = (req) => {
  if (req.user.role === 'STAFF') {
    if (!req.user.departmentId) {
      throw ApiError.forbidden('Staff account has no department assigned', 'NO_DEPARTMENT_ASSIGNED');
    }
    return req.user.departmentId.toString();
  }
  return req.query.departmentId || undefined;
};

const list = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { page = 1, limit = 20, search = '', year, section, status } = req.query;
    const departmentId = resolveDepartmentFilter(req);

    const result = await studentService.listStudents({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      departmentId,
      year: year ? parseInt(year, 10) : undefined,
      section,
      status,
    });

    success(res, 'Students retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const student = await studentService.getStudent(req.params.id);
    success(res, 'Student retrieved successfully', { student });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    // STAFF can only add students to their own department
    let departmentId = req.body.departmentId;
    if (req.user.role === 'STAFF') {
      if (!req.user.departmentId) {
        throw ApiError.forbidden('Staff account has no department assigned', 'NO_DEPARTMENT_ASSIGNED');
      }
      departmentId = req.user.departmentId.toString();
    }

    const student = await studentService.createStudent({ ...req.body, departmentId });
    success(res, 'Student created successfully', { student }, 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    // STAFF cannot move students to another department
    if (req.user.role === 'STAFF') {
      if (!req.user.departmentId) {
        throw ApiError.forbidden('Staff account has no department assigned', 'NO_DEPARTMENT_ASSIGNED');
      }
      if (req.body.departmentId && req.body.departmentId !== req.user.departmentId.toString()) {
        throw ApiError.forbidden('Staff cannot reassign students to another department', 'FORBIDDEN');
      }
      delete req.body.departmentId;
    }

    const student = await studentService.updateStudent(req.params.id, req.body);
    success(res, 'Student updated successfully', { student });
  } catch (err) {
    next(err);
  }
};

const changeStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const student = await studentService.changeStudentStatus(req.params.id, req.body.status);
    success(res, 'Student status updated successfully', { student });
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk create students (used for performance testing and data imports).
 * Validates each student, skips duplicates, returns created + skipped counts.
 */
const bulkCreate = async (req, res, next) => {
  try {
    const { students } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      throw ApiError.badRequest('students array is required', 'VALIDATION_ERROR');
    }
    if (students.length > 500) {
      throw ApiError.badRequest('Maximum 500 students per bulk request', 'VALIDATION_ERROR');
    }

    // STAFF can only bulk-add to their own department
    let departmentId = students[0]?.departmentId;
    if (req.user.role === 'STAFF') {
      if (!req.user.departmentId) {
        throw ApiError.forbidden('Staff account has no department assigned', 'NO_DEPARTMENT_ASSIGNED');
      }
      departmentId = req.user.departmentId.toString();
    }

    const result = await studentService.bulkCreateStudents(students, departmentId);
    success(res, 'Bulk student creation completed', result);
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, changeStatus, bulkCreate };
