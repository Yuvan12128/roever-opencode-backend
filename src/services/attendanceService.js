const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

/**
 * Resolve the effective department filter based on user role.
 * STAFF users are hard-pinned to their own department.
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

/**
 * Validate that a student exists and is ACTIVE.
 */
const validateStudent = async (studentId) => {
  const student = await Student.findById(studentId).lean();
  if (!student) {
    throw ApiError.badRequest('Student does not exist', 'INVALID_STUDENT');
  }
  if (student.status !== 'ACTIVE') {
    throw ApiError.badRequest('Cannot mark attendance for inactive student', 'INACTIVE_STUDENT');
  }
  return student;
};

/**
 * List attendance records with pagination and filters.
 */
const listAttendance = async ({
  page = 1,
  limit = 20,
  date,
  studentId,
  departmentId,
  period,
  status,
} = {}) => {
  const filter = {};

  if (date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    const nextDay = new Date(d);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    filter.date = { $gte: d, $lt: nextDay };
  }
  if (studentId) {
    filter.studentId = studentId;
  }
  if (period && status) {
    filter[`periods.${period}.status`] = status;
  }

  const skip = (page - 1) * limit;

  // If department filter is set, we need to join with students
  let studentFilter = {};
  if (departmentId) {
    studentFilter.departmentId = departmentId;
  }

  const [attendance, total] = await Promise.all([
    Attendance.find(filter)
      .populate({
        path: 'studentId',
        match: Object.keys(studentFilter).length > 0 ? studentFilter : undefined,
        select: 'rollNo name departmentId',
      })
      .populate({
        path: 'periods.p1.markedBy',
        select: 'name',
      })
      .populate({
        path: 'periods.p2.markedBy',
        select: 'name',
      })
      .populate({
        path: 'periods.p3.markedBy',
        select: 'name',
      })
      .populate({
        path: 'periods.p4.markedBy',
        select: 'name',
      })
      .populate({
        path: 'periods.p5.markedBy',
        select: 'name',
      })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Attendance.countDocuments(filter),
  ]);

  // Filter out records where student didn't match department filter
  const filtered = attendance.filter((a) => a.studentId !== null);

  return {
    data: filtered,
    pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
  };
};

/**
 * Get attendance by ID.
 */
const getAttendance = async (id) => {
  const attendance = await Attendance.findById(id)
    .populate({
      path: 'studentId',
      select: 'rollNo name departmentId',
    })
    .populate({
      path: 'periods.p1.markedBy',
      select: 'name',
    })
    .populate({
      path: 'periods.p2.markedBy',
      select: 'name',
    })
    .populate({
      path: 'periods.p3.markedBy',
      select: 'name',
    })
    .populate({
      path: 'periods.p4.markedBy',
      select: 'name',
    })
    .populate({
      path: 'periods.p5.markedBy',
      select: 'name',
    })
    .lean();

  if (!attendance) {
    throw ApiError.notFound('Attendance record not found', 'ATTENDANCE_NOT_FOUND');
  }

  return attendance;
};

/**
 * Get attendance for a specific date with student details.
 */
const getAttendanceByDate = async (date, departmentId) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const nextDay = new Date(d);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const filter = { date: { $gte: d, $lt: nextDay } };

  const attendance = await Attendance.find(filter)
    .populate({
      path: 'studentId',
      match: departmentId ? { departmentId } : undefined,
      select: 'rollNo name departmentId',
    })
    .populate({
      path: 'periods.p1.markedBy',
      select: 'name',
    })
    .populate({
      path: 'periods.p2.markedBy',
      select: 'name',
    })
    .populate({
      path: 'periods.p3.markedBy',
      select: 'name',
    })
    .populate({
      path: 'periods.p4.markedBy',
      select: 'name',
    })
    .populate({
      path: 'periods.p5.markedBy',
      select: 'name',
    })
    .sort({ 'studentId.rollNo': 1 })
    .lean();

  return attendance.filter((a) => a.studentId !== null);
};

/**
 * Get attendance history for a specific student.
 */
const getStudentAttendance = async (studentId, { fromDate, toDate, page = 1, limit = 20 } = {}) => {
  const filter = { studentId };

  if (fromDate || toDate) {
    filter.date = {};
    if (fromDate) filter.date.$gte = new Date(fromDate);
    if (toDate) filter.date.$lte = new Date(toDate);
  }

  const skip = (page - 1) * limit;

  const [attendance, total] = await Promise.all([
    Attendance.find(filter)
      .populate({
        path: 'periods.p1.markedBy',
        select: 'name',
      })
      .populate({
        path: 'periods.p2.markedBy',
        select: 'name',
      })
      .populate({
        path: 'periods.p3.markedBy',
        select: 'name',
      })
      .populate({
        path: 'periods.p4.markedBy',
        select: 'name',
      })
      .populate({
        path: 'periods.p5.markedBy',
        select: 'name',
      })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Attendance.countDocuments(filter),
  ]);

  return {
    data: attendance,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Mark attendance for a single student.
 * Creates or updates the attendance document for the given date.
 * Only the specified period is modified; other periods remain unchanged.
 */
const markAttendance = async ({ studentId, date, period, status, userId }) => {
  await validateStudent(studentId);

  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);

  const periodField = `periods.${period}`;

  // Use findOneAndUpdate with upsert to atomically create or update
  const attendance = await Attendance.findOneAndUpdate(
    { studentId, date: d },
    {
      $set: {
        [`${periodField}.status`]: status,
        [`${periodField}.markedBy`]: userId,
        [`${periodField}.markedAt`]: new Date(),
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  return attendance;
};

/**
 * Bulk mark attendance for multiple students.
 * Uses bulkWrite for efficiency.
 */
const bulkMarkAttendance = async ({ studentIds, date, period, status, userId }) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);

  const periodField = `periods.${period}`;

  const operations = studentIds.map((studentId) => ({
    updateOne: {
      filter: { studentId, date: d },
      update: {
        $set: {
          [`${periodField}.status`]: status,
          [`${periodField}.markedBy`]: userId,
          [`${periodField}.markedAt`]: new Date(),
        },
      },
      upsert: true,
    },
  }));

  const result = await Attendance.bulkWrite(operations, { ordered: false });

  return {
    matched: result.matchedCount,
    modified: result.modifiedCount,
    upserted: result.upsertedCount,
  };
};

/**
 * Update attendance for a specific period.
 */
const updateAttendance = async (id, { period, status, userId }) => {
  const attendance = await Attendance.findById(id);

  if (!attendance) {
    throw ApiError.notFound('Attendance record not found', 'ATTENDANCE_NOT_FOUND');
  }

  const periodField = `periods.${period}`;

  attendance.periods[period].status = status;
  attendance.periods[period].markedBy = userId;
  attendance.periods[period].markedAt = new Date();

  await attendance.save();

  return attendance;
};

/**
 * Calculate attendance percentage for a student.
 * Formula: (Present Periods / Marked Periods) × 100
 * Unmarked periods are not counted.
 */
const calculatePercentage = (attendance) => {
  let present = 0;
  let marked = 0;

  for (const p of ['p1', 'p2', 'p3', 'p4', 'p5']) {
    const period = attendance.periods[p];
    if (period && period.status) {
      marked++;
      if (period.status === 'PRESENT') present++;
    }
  }

  if (marked === 0) return 0;
  return Math.round((present / marked) * 100);
};

/**
 * Get students for attendance marking.
 * Returns students with their attendance status for the given date.
 */
const getStudentsForMarking = async (departmentId, date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const nextDay = new Date(d);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const students = await Student.find({ departmentId, status: 'ACTIVE' })
    .select('rollNo name departmentId')
    .sort({ rollNo: 1 })
    .lean();

  const attendance = await Attendance.find({
    studentId: { $in: students.map((s) => s._id) },
    date: { $gte: d, $lt: nextDay },
  })
    .populate({
      path: 'periods.p1.markedBy',
      select: 'name',
    })
    .populate({
      path: 'periods.p2.markedBy',
      select: 'name',
    })
    .populate({
      path: 'periods.p3.markedBy',
      select: 'name',
    })
    .populate({
      path: 'periods.p4.markedBy',
      select: 'name',
    })
    .populate({
      path: 'periods.p5.markedBy',
      select: 'name',
    })
    .lean();

  const attendanceMap = new Map(attendance.map((a) => [a.studentId.toString(), a]));

  return students.map((student) => {
    const att = attendanceMap.get(student._id.toString());
    return {
      ...student,
      attendance: att || null,
    };
  });
};

module.exports = {
  listAttendance,
  getAttendance,
  getAttendanceByDate,
  getStudentAttendance,
  markAttendance,
  bulkMarkAttendance,
  updateAttendance,
  calculatePercentage,
  getStudentsForMarking,
  resolveDepartmentFilter,
};
