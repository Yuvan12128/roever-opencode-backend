const { validationResult } = require('express-validator');
const reportService = require('../services/reportService');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/response');

const studentReport = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { studentId } = req.params;
    const { fromDate, toDate } = req.query;

    // Students can only view their own report
    if (req.user.role === 'STUDENT') {
      if (req.user.studentId?.toString() !== studentId) {
        throw ApiError.forbidden('You can only view your own attendance report', 'FORBIDDEN');
      }
    }

    const report = await reportService.getStudentReport(studentId, { fromDate, toDate });
    success(res, 'Student report retrieved successfully', report);
  } catch (err) {
    next(err);
  }
};

const studentDailyHistory = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { studentId } = req.params;
    const { fromDate, toDate, page = 1, limit = 20 } = req.query;

    if (req.user.role === 'STUDENT') {
      if (req.user.studentId?.toString() !== studentId) {
        throw ApiError.forbidden('You can only view your own attendance', 'FORBIDDEN');
      }
    }

    const result = await reportService.getStudentDailyHistory(studentId, {
      fromDate,
      toDate,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    success(res, 'Student daily history retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

const departmentReport = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { departmentId } = req.params;
    const { fromDate, toDate } = req.query;

    // STAFF can only access their own department
    if (req.user.role === 'STAFF') {
      if (req.user.departmentId?.toString() !== departmentId) {
        throw ApiError.forbidden('You can only access your own department reports', 'FORBIDDEN');
      }
    }

    const report = await reportService.getDepartmentReport(departmentId, { fromDate, toDate });
    success(res, 'Department report retrieved successfully', report);
  } catch (err) {
    next(err);
  }
};

const dailyReport = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { date } = req.params;
    const { departmentId } = req.query;

    // STAFF can only access their own department
    if (req.user.role === 'STAFF') {
      if (departmentId && req.user.departmentId?.toString() !== departmentId) {
        throw ApiError.forbidden('You can only access your own department reports', 'FORBIDDEN');
      }
    }

    const report = await reportService.getDailyReport(date, departmentId);
    success(res, 'Daily report retrieved successfully', report);
  } catch (err) {
    next(err);
  }
};

const lowAttendance = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { departmentId, threshold, fromDate, toDate, page = 1, limit = 20 } = req.query;

    // STAFF can only access their own department
    if (req.user.role === 'STAFF') {
      if (departmentId && req.user.departmentId?.toString() !== departmentId) {
        throw ApiError.forbidden('You can only access your own department reports', 'FORBIDDEN');
      }
    }

    const result = await reportService.getLowAttendance({
      departmentId,
      threshold: threshold ? parseInt(threshold, 10) : undefined,
      fromDate,
      toDate,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    success(res, 'Low attendance report retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

const adminDashboard = async (req, res, next) => {
  try {
    const stats = await reportService.getAdminDashboardStats();
    success(res, 'Dashboard statistics retrieved successfully', stats);
  } catch (err) {
    next(err);
  }
};

const staffDashboard = async (req, res, next) => {
  try {
    if (!req.user.departmentId) {
      throw ApiError.forbidden('Staff account has no department assigned', 'NO_DEPARTMENT_ASSIGNED');
    }
    const stats = await reportService.getStaffDashboardStats(req.user.departmentId);
    success(res, 'Dashboard statistics retrieved successfully', stats);
  } catch (err) {
    next(err);
  }
};

const studentDashboard = async (req, res, next) => {
  try {
    if (!req.user.studentId) {
      throw ApiError.forbidden('No student account linked', 'NO_STUDENT_ACCOUNT');
    }
    const stats = await reportService.getStudentDashboardStats(req.user.studentId);
    success(res, 'Dashboard statistics retrieved successfully', stats);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  studentReport,
  studentDailyHistory,
  departmentReport,
  dailyReport,
  lowAttendance,
  adminDashboard,
  staffDashboard,
  studentDashboard,
};
