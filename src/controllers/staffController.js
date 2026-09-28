const { validationResult } = require('express-validator');
const staffService = require('../services/staffService');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/response');

const list = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { page = 1, limit = 20, search = '', departmentId, status } = req.query;
    const result = await staffService.listStaff({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      departmentId,
      status,
    });

    success(res, 'Staff retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const staff = await staffService.getStaff(req.params.id);
    success(res, 'Staff member retrieved successfully', { staff });
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

    const staff = await staffService.createStaff(req.body);
    success(res, 'Staff member created successfully', { staff }, 201);
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

    const staff = await staffService.updateStaff(req.params.id, req.body);
    success(res, 'Staff member updated successfully', { staff });
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

    const staff = await staffService.changeStaffStatus(req.params.id, req.body.status);
    success(res, 'Staff status updated successfully', { staff });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, changeStatus };
