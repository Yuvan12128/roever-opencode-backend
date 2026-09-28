const { validationResult } = require('express-validator');
const attendanceService = require('../services/attendanceService');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/response');

const list = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { page = 1, limit = 20, date, studentId, period, status } = req.query;
    const departmentId = attendanceService.resolveDepartmentFilter(req);

    const result = await attendanceService.listAttendance({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      date,
      studentId,
      departmentId,
      period,
      status,
    });

    success(res, 'Attendance records retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const attendance = await attendanceService.getAttendance(req.params.id);
    success(res, 'Attendance record retrieved successfully', { attendance });
  } catch (err) {
    next(err);
  }
};

const getByDate = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { date } = req.params;
    const departmentId = attendanceService.resolveDepartmentFilter(req);

    const attendance = await attendanceService.getAttendanceByDate(date, departmentId);
    success(res, 'Attendance records retrieved successfully', { attendance });
  } catch (err) {
    next(err);
  }
};

const getByStudent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { studentId } = req.params;
    const { fromDate, toDate, page = 1, limit = 20 } = req.query;

    // Students can only view their own attendance
    if (req.user.role === 'STUDENT') {
      if (req.user.studentId?.toString() !== studentId) {
        throw ApiError.forbidden('You can only view your own attendance', 'FORBIDDEN');
      }
    }

    const result = await attendanceService.getStudentAttendance(studentId, {
      fromDate,
      toDate,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    success(res, 'Student attendance retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

const mark = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { studentId, date, period, status } = req.body;

    // STAFF can only mark attendance for their own department
    if (req.user.role === 'STAFF') {
      if (!req.user.departmentId) {
        throw ApiError.forbidden('Staff account has no department assigned', 'NO_DEPARTMENT_ASSIGNED');
      }
      const student = await attendanceService.markAttendance({
        studentId,
        date,
        period,
        status,
        userId: req.user._id,
      });
      success(res, 'Attendance marked successfully', { attendance: student });
    } else {
      const student = await attendanceService.markAttendance({
        studentId,
        date,
        period,
        status,
        userId: req.user._id,
      });
      success(res, 'Attendance marked successfully', { attendance: student });
    }
  } catch (err) {
    next(err);
  }
};

const bulkMark = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { studentIds, date, period, status } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw ApiError.badRequest('studentIds array is required', 'VALIDATION_ERROR');
    }
    if (studentIds.length > 500) {
      throw ApiError.badRequest('Maximum 500 students per bulk request', 'VALIDATION_ERROR');
    }

    const result = await attendanceService.bulkMarkAttendance({
      studentIds,
      date,
      period,
      status,
      userId: req.user._id,
    });

    success(res, 'Bulk attendance marked successfully', result);
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

    const { period, status } = req.body;

    const attendance = await attendanceService.updateAttendance(req.params.id, {
      period,
      status,
      userId: req.user._id,
    });

    success(res, 'Attendance updated successfully', { attendance });
  } catch (err) {
    next(err);
  }
};

const getStudentsForMarking = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { departmentId, date } = req.query;

    // STAFF can only access their own department
    if (req.user.role === 'STAFF') {
      if (!req.user.departmentId) {
        throw ApiError.forbidden('Staff account has no department assigned', 'NO_DEPARTMENT_ASSIGNED');
      }
      const students = await attendanceService.getStudentsForMarking(
        req.user.departmentId.toString(),
        date
      );
      success(res, 'Students retrieved successfully', { students });
    } else {
      const students = await attendanceService.getStudentsForMarking(departmentId, date);
      success(res, 'Students retrieved successfully', { students });
    }
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  getById,
  getByDate,
  getByStudent,
  mark,
  bulkMark,
  update,
  getStudentsForMarking,
};
