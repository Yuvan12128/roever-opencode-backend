const Student = require('../models/Student');
const Department = require('../models/Department');
const ApiError = require('../utils/ApiError');

/**
 * Validate that a department exists and is ACTIVE.
 * Centralized so every student/staff write path enforces the same rule.
 */
const validateActiveDepartment = async (departmentId) => {
  const department = await Department.findById(departmentId).lean();

  if (!department) {
    throw ApiError.badRequest('Department does not exist', 'INVALID_DEPARTMENT');
  }

  if (department.status !== 'ACTIVE') {
    throw ApiError.badRequest('Cannot assign an inactive department', 'INACTIVE_DEPARTMENT');
  }

  return department;
};

/**
 * List students with server-side pagination, search, and filters.
 * Uses .lean() + projection — never loads all students into memory.
 *
 * @param {Object} opts
 * @param {number} opts.page
 * @param {number} opts.limit
 * @param {string} opts.search — matches rollNo or name (case-insensitive)
 * @param {string} [opts.departmentId] — forced by caller for STAFF role
 * @param {number} [opts.year]
 * @param {string} [opts.section]
 * @param {string} [opts.status]
 */
const listStudents = async ({ page = 1, limit = 20, search = '', departmentId, year, section, status } = {}) => {
  const filter = {};

  if (search) {
    filter.$or = [
      { rollNo: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
    ];
  }
  if (departmentId) {
    filter.departmentId = departmentId;
  }
  if (year) {
    filter.year = year;
  }
  if (section) {
    filter.section = section.toUpperCase();
  }
  if (status) {
    filter.status = status;
  }

  const skip = (page - 1) * limit;

  const [students, total] = await Promise.all([
    Student.find(filter)
      .select('rollNo name email phone departmentId year section status createdAt')
      .sort({ rollNo: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Student.countDocuments(filter),
  ]);

  // Populate department info only for the current page (max `limit` docs)
  const departmentIds = [...new Set(students.map((s) => s.departmentId.toString()))];
  const departments = await Department.find({ _id: { $in: departmentIds } })
    .select('name code')
    .lean();
  const deptMap = new Map(departments.map((d) => [d._id.toString(), d]));

  const data = students.map((s) => ({
    ...s,
    department: deptMap.get(s.departmentId.toString()) || null,
  }));

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getStudent = async (id) => {
  const student = await Student.findById(id).lean();

  if (!student) {
    throw ApiError.notFound('Student not found', 'STUDENT_NOT_FOUND');
  }

  // Populate department only for the detail view
  const department = await Department.findById(student.departmentId).select('name code').lean();

  return { ...student, department };
};

const createStudent = async (studentData) => {
  await validateActiveDepartment(studentData.departmentId);

  const rollNo = studentData.rollNo.toUpperCase().trim();

  const [duplicateRollNo, duplicateEmail] = await Promise.all([
    Student.findOne({ rollNo }).lean(),
    Student.findOne({ email: studentData.email.toLowerCase() }).lean(),
  ]);

  if (duplicateRollNo) {
    throw ApiError.conflict('Roll number already exists', 'DUPLICATE_ROLL_NUMBER');
  }
  if (duplicateEmail) {
    throw ApiError.conflict('Email already exists', 'DUPLICATE_EMAIL');
  }

  const student = await Student.create({ ...studentData, rollNo });

  return student;
};

const updateStudent = async (id, updateData) => {
  const student = await Student.findById(id);

  if (!student) {
    throw ApiError.notFound('Student not found', 'STUDENT_NOT_FOUND');
  }

  if (updateData.departmentId && updateData.departmentId.toString() !== student.departmentId.toString()) {
    await validateActiveDepartment(updateData.departmentId);
  }

  if (updateData.rollNo) {
    const rollNo = updateData.rollNo.toUpperCase().trim();
    const duplicate = await Student.findOne({ rollNo, _id: { $ne: id } }).lean();
    if (duplicate) {
      throw ApiError.conflict('Roll number already exists', 'DUPLICATE_ROLL_NUMBER');
    }
    student.rollNo = rollNo;
  }

  if (updateData.email) {
    const email = updateData.email.toLowerCase();
    const duplicate = await Student.findOne({ email, _id: { $ne: id } }).lean();
    if (duplicate) {
      throw ApiError.conflict('Email already exists', 'DUPLICATE_EMAIL');
    }
    student.email = email;
  }

  const updatableFields = ['name', 'phone', 'departmentId', 'academicYearId', 'year', 'section', 'status'];
  for (const field of updatableFields) {
    if (updateData[field] !== undefined) {
      student[field] = updateData[field];
    }
  }

  await student.save();

  return student;
};

const changeStudentStatus = async (id, status) => {
  const student = await Student.findById(id);

  if (!student) {
    throw ApiError.notFound('Student not found', 'STUDENT_NOT_FOUND');
  }

  student.status = status;
  await student.save();

  return student;
};

/**
 * Bulk create students with duplicate skipping.
 * Validates the department once, checks all duplicates in a single query,
 * then inserts valid students in one batch.
 */
const bulkCreateStudents = async (studentsData, forcedDepartmentId) => {
  const departmentId = forcedDepartmentId || studentsData[0]?.departmentId;
  await validateActiveDepartment(departmentId);

  // Normalize all entries first
  const normalized = studentsData.map((s) => ({
    ...s,
    rollNo: s.rollNo.toUpperCase().trim(),
    email: s.email.toLowerCase(),
    departmentId,
    status: s.status || 'ACTIVE',
  }));

  // Single query to find all existing rollNos and emails
  const rollNos = normalized.map((s) => s.rollNo);
  const emails = normalized.map((s) => s.email);

  const [existingByRollNo, existingByEmail] = await Promise.all([
    Student.find({ rollNo: { $in: rollNos } }).select('rollNo').lean(),
    Student.find({ email: { $in: emails } }).select('email').lean(),
  ]);

  const existingRollNos = new Set(existingByRollNo.map((s) => s.rollNo));
  const existingEmails = new Set(existingByEmail.map((s) => s.email));

  // Also deduplicate within the batch itself
  const seenRollNos = new Set();
  const seenEmails = new Set();
  const validStudents = [];
  let skipped = 0;

  for (const s of normalized) {
    if (
      existingRollNos.has(s.rollNo) ||
      existingEmails.has(s.email) ||
      seenRollNos.has(s.rollNo) ||
      seenEmails.has(s.email)
    ) {
      skipped += 1;
      continue;
    }
    seenRollNos.add(s.rollNo);
    seenEmails.add(s.email);
    validStudents.push(s);
  }

  if (validStudents.length > 0) {
    await Student.insertMany(validStudents, { ordered: false });
  }

  return {
    created: validStudents.length,
    skipped,
    total: studentsData.length,
  };
};

module.exports = {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  changeStudentStatus,
  bulkCreateStudents,
  validateActiveDepartment,
};
