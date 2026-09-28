const User = require('../models/User');
const Department = require('../models/Department');
const ApiError = require('../utils/ApiError');
const { validateActiveDepartment } = require('./studentService');

/**
 * List staff (Users with role STAFF) with pagination, search, and filters.
 */
const listStaff = async ({ page = 1, limit = 20, search = '', departmentId, status } = {}) => {
  const filter = { role: 'STAFF' };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (departmentId) {
    filter.departmentId = departmentId;
  }
  if (status) {
    filter.status = status;
  }

  const skip = (page - 1) * limit;

  const [staff, total] = await Promise.all([
    User.find(filter)
      .select('name email role departmentId status lastLogin createdAt')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  // Populate department info only for the current page
  const departmentIds = [...new Set(staff.map((s) => s.departmentId?.toString()).filter(Boolean))];
  const departments = await Department.find({ _id: { $in: departmentIds } })
    .select('name code')
    .lean();
  const deptMap = new Map(departments.map((d) => [d._id.toString(), d]));

  const data = staff.map((s) => ({
    ...s,
    department: s.departmentId ? deptMap.get(s.departmentId.toString()) || null : null,
  }));

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getStaff = async (id) => {
  const staff = await User.findOne({ _id: id, role: 'STAFF' })
    .select('name email role departmentId status lastLogin createdAt')
    .lean();

  if (!staff) {
    throw ApiError.notFound('Staff member not found', 'STAFF_NOT_FOUND');
  }

  const department = staff.departmentId
    ? await Department.findById(staff.departmentId).select('name code').lean()
    : null;

  return { ...staff, department };
};

/**
 * Create a staff member. Password is hashed by the User model's
 * pre-save hook — never stored or returned in plain text.
 */
const createStaff = async ({ name, email, password, departmentId }) => {
  await validateActiveDepartment(departmentId);

  const existing = await User.findOne({ email: email.toLowerCase() }).lean();

  if (existing) {
    throw ApiError.conflict('Email already exists', 'DUPLICATE_EMAIL');
  }

  const staff = await User.create({
    name,
    email,
    password,
    role: 'STAFF',
    departmentId,
    status: 'ACTIVE',
  });

  // Return safe user (password excluded by toJSON transform)
  return staff;
};

const updateStaff = async (id, updateData) => {
  const staff = await User.findOne({ _id: id, role: 'STAFF' });

  if (!staff) {
    throw ApiError.notFound('Staff member not found', 'STAFF_NOT_FOUND');
  }

  if (updateData.departmentId && updateData.departmentId.toString() !== (staff.departmentId?.toString() || '')) {
    await validateActiveDepartment(updateData.departmentId);
    staff.departmentId = updateData.departmentId;
  }

  if (updateData.email) {
    const email = updateData.email.toLowerCase();
    const duplicate = await User.findOne({ email, _id: { $ne: id } }).lean();
    if (duplicate) {
      throw ApiError.conflict('Email already exists', 'DUPLICATE_EMAIL');
    }
    staff.email = email;
  }

  if (updateData.name) {
    staff.name = updateData.name;
  }

  if (updateData.password) {
    staff.password = updateData.password; // hashed by pre-save hook
  }

  await staff.save();

  return staff;
};

const changeStaffStatus = async (id, status) => {
  const staff = await User.findOne({ _id: id, role: 'STAFF' });

  if (!staff) {
    throw ApiError.notFound('Staff member not found', 'STAFF_NOT_FOUND');
  }

  staff.status = status;
  await staff.save();

  return staff;
};

module.exports = {
  listStaff,
  getStaff,
  createStaff,
  updateStaff,
  changeStaffStatus,
};
