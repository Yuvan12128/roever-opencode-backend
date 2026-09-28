const { validationResult } = require('express-validator');
const departmentService = require('../services/departmentService');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/response');

const list = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { page = 1, limit = 20, search = '', status } = req.query;
    const result = await departmentService.listDepartments({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      status,
    });

    success(res, 'Departments retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const department = await departmentService.getDepartment(req.params.id);
    success(res, 'Department retrieved successfully', { department });
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

    const department = await departmentService.createDepartment(req.body);
    success(res, 'Department created successfully', { department }, 201);
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

    const department = await departmentService.updateDepartment(req.params.id, req.body);
    success(res, 'Department updated successfully', { department });
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

    const department = await departmentService.changeDepartmentStatus(req.params.id, req.body.status);
    success(res, 'Department status updated successfully', { department });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, changeStatus };
