const Department = require('../models/Department');
const Student = require('../models/Student');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

/**
 * List departments with optional search + status filter.
 * Includes student/staff counts via a single aggregation
 * (no per-department queries, no loading students into memory).
 */
const listDepartments = async ({ page = 1, limit = 20, search = '', status } = {}) => {
  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
    ];
  }
  if (status) {
    filter.status = status;
  }

  const skip = (page - 1) * limit;

  const [departments, total] = await Promise.all([
    Department.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Department.countDocuments(filter),
  ]);

  // Efficient counts: one grouped aggregation per collection
  const [studentCounts, staffCounts] = await Promise.all([
    Student.aggregate([
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { role: 'STAFF' } },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
    ]),
  ]);

  const studentCountMap = new Map(studentCounts.map((r) => [r._id.toString(), r.count]));
  const staffCountMap = new Map(staffCounts.map((r) => [r._id.toString(), r.count]));

  const data = departments.map((dept) => ({
    ...dept,
    studentCount: studentCountMap.get(dept._id.toString()) || 0,
    staffCount: staffCountMap.get(dept._id.toString()) || 0,
  }));

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getDepartment = async (id) => {
  const department = await Department.findById(id).lean();

  if (!department) {
    throw ApiError.notFound('Department not found', 'DEPARTMENT_NOT_FOUND');
  }

  return department;
};

const createDepartment = async ({ name, code }) => {
  const existing = await Department.findOne({ code: code.toUpperCase().trim() });

  if (existing) {
    throw ApiError.conflict('Department code already exists', 'DUPLICATE_DEPARTMENT_CODE');
  }

  const department = await Department.create({ name, code });

  return department;
};

const updateDepartment = async (id, { name, code }) => {
  const department = await Department.findById(id);

  if (!department) {
    throw ApiError.notFound('Department not found', 'DEPARTMENT_NOT_FOUND');
  }

  if (code) {
    const normalizedCode = code.toUpperCase().trim();
    const duplicate = await Department.findOne({ code: normalizedCode, _id: { $ne: id } });

    if (duplicate) {
      throw ApiError.conflict('Department code already exists', 'DUPLICATE_DEPARTMENT_CODE');
    }
    department.code = normalizedCode;
  }

  if (name) {
    department.name = name;
  }

  await department.save();

  return department;
};

/**
 * Soft-deactivate a department. Physical deletion is never performed —
 * departments with students or staff are blocked from deactivation.
 */
const changeDepartmentStatus = async (id, status) => {
  const department = await Department.findById(id);

  if (!department) {
    throw ApiError.notFound('Department not found', 'DEPARTMENT_NOT_FOUND');
  }

  if (status === 'INACTIVE') {
    const [studentCount, staffCount] = await Promise.all([
      Student.countDocuments({ departmentId: id, status: 'ACTIVE' }),
      User.countDocuments({ role: 'STAFF', departmentId: id, status: 'ACTIVE' }),
    ]);

    if (studentCount > 0 || staffCount > 0) {
      throw ApiError.badRequest(
        `Cannot deactivate: department has ${studentCount} active students and ${staffCount} active staff`,
        'DEPARTMENT_HAS_DEPENDENTS'
      );
    }
  }

  department.status = status;
  await department.save();

  return department;
};

module.exports = {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  changeDepartmentStatus,
};
