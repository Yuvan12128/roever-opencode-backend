const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Department = require('../models/Department');
const User = require('../models/User');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

const PERIODS = ['p1', 'p2', 'p3', 'p4', 'p5'];

/**
 * Build a date range filter from query parameters.
 * Returns a MongoDB $match fragment for the date field.
 */
const buildDateRange = (fromDate, toDate) => {
  const range = {};
  if (fromDate) {
    const d = new Date(fromDate);
    if (isNaN(d.getTime())) throw ApiError.badRequest('Invalid fromDate', 'INVALID_DATE');
    d.setUTCHours(0, 0, 0, 0);
    range.$gte = d;
  }
  if (toDate) {
    const d = new Date(toDate);
    if (isNaN(d.getTime())) throw ApiError.badRequest('Invalid toDate', 'INVALID_DATE');
    d.setUTCHours(23, 59, 59, 999);
    range.$lte = d;
  }
  return Object.keys(range).length > 0 ? range : null;
};

/**
 * Student Attendance Report
 * Returns total marked periods, present, absent, and percentage.
 */
const getStudentReport = async (studentId, { fromDate, toDate } = {}) => {
  const student = await Student.findById(studentId).lean();
  if (!student) {
    throw ApiError.notFound('Student not found', 'STUDENT_NOT_FOUND');
  }

  const match = { studentId: student._id };
  const dateRange = buildDateRange(fromDate, toDate);
  if (dateRange) match.date = dateRange;

  const [result] = await Attendance.aggregate([
    { $match: match },
    {
      $project: {
        periods: 1,
      },
    },
    {
      $group: {
        _id: null,
        totalPresent: {
          $sum: {
            $sum: [
              { $cond: [{ $eq: ['$periods.p1.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p2.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p3.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p4.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p5.status', 'PRESENT'] }, 1, 0] },
            ],
          },
        },
        totalAbsent: {
          $sum: {
            $sum: [
              { $cond: [{ $eq: ['$periods.p1.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p2.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p3.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p4.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p5.status', 'ABSENT'] }, 1, 0] },
            ],
          },
        },
        totalMarked: {
          $sum: {
            $sum: [
              { $cond: [{ $ne: ['$periods.p1.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p2.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p3.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p4.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p5.status', null] }, 1, 0] },
            ],
          },
        },
      },
    },
  ]);

  const present = result?.totalPresent || 0;
  const absent = result?.totalAbsent || 0;
  const totalMarked = result?.totalMarked || 0;
  const percentage = totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 0;

  return {
    student: {
      _id: student._id,
      rollNo: student.rollNo,
      name: student.name,
      department: student.departmentId,
    },
    present,
    absent,
    totalMarked,
    percentage,
  };
};

/**
 * Student Daily Attendance History
 * Returns per-date breakdown with period statuses and daily percentage.
 */
const getStudentDailyHistory = async (studentId, { fromDate, toDate, page = 1, limit = 20 } = {}) => {
  const match = { studentId: studentId };
  const dateRange = buildDateRange(fromDate, toDate);
  if (dateRange) match.date = dateRange;

  const skip = (page - 1) * limit;

  const [result] = await Attendance.aggregate([
    { $match: match },
    { $sort: { date: -1 } },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              date: 1,
              p1: '$periods.p1.status',
              p2: '$periods.p2.status',
              p3: '$periods.p3.status',
              p4: '$periods.p4.status',
              p5: '$periods.p5.status',
              presentCount: {
                $sum: [
                  { $cond: [{ $eq: ['$periods.p1.status', 'PRESENT'] }, 1, 0] },
                  { $cond: [{ $eq: ['$periods.p2.status', 'PRESENT'] }, 1, 0] },
                  { $cond: [{ $eq: ['$periods.p3.status', 'PRESENT'] }, 1, 0] },
                  { $cond: [{ $eq: ['$periods.p4.status', 'PRESENT'] }, 1, 0] },
                  { $cond: [{ $eq: ['$periods.p5.status', 'PRESENT'] }, 1, 0] },
                ],
              },
              absentCount: {
                $sum: [
                  { $cond: [{ $eq: ['$periods.p1.status', 'ABSENT'] }, 1, 0] },
                  { $cond: [{ $eq: ['$periods.p2.status', 'ABSENT'] }, 1, 0] },
                  { $cond: [{ $eq: ['$periods.p3.status', 'ABSENT'] }, 1, 0] },
                  { $cond: [{ $eq: ['$periods.p4.status', 'ABSENT'] }, 1, 0] },
                  { $cond: [{ $eq: ['$periods.p5.status', 'ABSENT'] }, 1, 0] },
                ],
              },
              markedCount: {
                $sum: [
                  { $cond: [{ $ne: ['$periods.p1.status', null] }, 1, 0] },
                  { $cond: [{ $ne: ['$periods.p2.status', null] }, 1, 0] },
                  { $cond: [{ $ne: ['$periods.p3.status', null] }, 1, 0] },
                  { $cond: [{ $ne: ['$periods.p4.status', null] }, 1, 0] },
                  { $cond: [{ $ne: ['$periods.p5.status', null] }, 1, 0] },
                ],
              },
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const data = result.data.map((d) => ({
    ...d,
    percentage: d.markedCount > 0 ? Math.round((d.presentCount / d.markedCount) * 100) : 0,
  }));

  return {
    data,
    pagination: {
      page,
      limit,
      total: result.total[0]?.count || 0,
      totalPages: Math.ceil((result.total[0]?.count || 0) / limit),
    },
  };
};

/**
 * Department Attendance Report
 * Returns department-level analytics.
 */
const getDepartmentReport = async (departmentId, { fromDate, toDate } = {}) => {
  const department = await Department.findById(departmentId).lean();
  if (!department) {
    throw ApiError.notFound('Department not found', 'DEPARTMENT_NOT_FOUND');
  }

  const students = await Student.find({ departmentId, status: 'ACTIVE' }).select('_id').lean();
  const studentIds = students.map((s) => s._id);

  const match = { studentId: { $in: studentIds } };
  const dateRange = buildDateRange(fromDate, toDate);
  if (dateRange) match.date = dateRange;

  const [result] = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalPresent: {
          $sum: {
            $sum: [
              { $cond: [{ $eq: ['$periods.p1.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p2.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p3.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p4.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p5.status', 'PRESENT'] }, 1, 0] },
            ],
          },
        },
        totalAbsent: {
          $sum: {
            $sum: [
              { $cond: [{ $eq: ['$periods.p1.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p2.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p3.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p4.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p5.status', 'ABSENT'] }, 1, 0] },
            ],
          },
        },
        totalMarked: {
          $sum: {
            $sum: [
              { $cond: [{ $ne: ['$periods.p1.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p2.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p3.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p4.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p5.status', null] }, 1, 0] },
            ],
          },
        },
      },
    },
  ]);

  const totalPresent = result?.totalPresent || 0;
  const totalAbsent = result?.totalAbsent || 0;
  const totalMarked = result?.totalMarked || 0;
  const averagePercentage = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 0;

  // Count low attendance students (below threshold)
  const threshold = config.lowAttendanceThreshold;
  const lowAttendanceCount = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$studentId',
        present: {
          $sum: {
            $sum: [
              { $cond: [{ $eq: ['$periods.p1.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p2.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p3.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p4.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p5.status', 'PRESENT'] }, 1, 0] },
            ],
          },
        },
        marked: {
          $sum: {
            $sum: [
              { $cond: [{ $ne: ['$periods.p1.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p2.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p3.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p4.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p5.status', null] }, 1, 0] },
            ],
          },
        },
      },
    },
    {
      $project: {
        percentage: {
          $cond: [
            { $gt: ['$marked', 0] },
            { $multiply: [{ $divide: ['$present', '$marked'] }, 100] },
            0,
          ],
        },
      },
    },
    { $match: { percentage: { $lt: threshold } } },
    { $count: 'count' },
  ]);

  return {
    department: {
      _id: department._id,
      name: department.name,
      code: department.code,
    },
    totalStudents: students.length,
    totalPresent,
    totalAbsent,
    totalMarked,
    averagePercentage,
    lowAttendanceCount: lowAttendanceCount[0]?.count || 0,
    threshold,
  };
};

/**
 * Daily Attendance Report
 * Returns per-period statistics for a specific date.
 */
const getDailyReport = async (date, departmentId) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) throw ApiError.badRequest('Invalid date', 'INVALID_DATE');
  d.setUTCHours(0, 0, 0, 0);
  const nextDay = new Date(d);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const match = { date: { $gte: d, $lt: nextDay } };

  // If department filter, join with students
  let studentMatch = {};
  if (departmentId) {
    studentMatch.departmentId = departmentId;
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'students',
        localField: 'studentId',
        foreignField: '_id',
        as: 'student',
        pipeline: [
          { $match: Object.keys(studentMatch).length > 0 ? studentMatch : {} },
          { $project: { rollNo: 1, name: 1, departmentId: 1 } },
        ],
      },
    },
    { $unwind: '$student' },
    {
      $group: {
        _id: null,
        totalStudents: { $sum: 1 },
        p1Present: { $sum: { $cond: [{ $eq: ['$periods.p1.status', 'PRESENT'] }, 1, 0] } },
        p1Absent: { $sum: { $cond: [{ $eq: ['$periods.p1.status', 'ABSENT'] }, 1, 0] } },
        p1Unmarked: { $sum: { $cond: [{ $eq: ['$periods.p1.status', null] }, 1, 0] } },
        p2Present: { $sum: { $cond: [{ $eq: ['$periods.p2.status', 'PRESENT'] }, 1, 0] } },
        p2Absent: { $sum: { $cond: [{ $eq: ['$periods.p2.status', 'ABSENT'] }, 1, 0] } },
        p2Unmarked: { $sum: { $cond: [{ $eq: ['$periods.p2.status', null] }, 1, 0] } },
        p3Present: { $sum: { $cond: [{ $eq: ['$periods.p3.status', 'PRESENT'] }, 1, 0] } },
        p3Absent: { $sum: { $cond: [{ $eq: ['$periods.p3.status', 'ABSENT'] }, 1, 0] } },
        p3Unmarked: { $sum: { $cond: [{ $eq: ['$periods.p3.status', null] }, 1, 0] } },
        p4Present: { $sum: { $cond: [{ $eq: ['$periods.p4.status', 'PRESENT'] }, 1, 0] } },
        p4Absent: { $sum: { $cond: [{ $eq: ['$periods.p4.status', 'ABSENT'] }, 1, 0] } },
        p4Unmarked: { $sum: { $cond: [{ $eq: ['$periods.p4.status', null] }, 1, 0] } },
        p5Present: { $sum: { $cond: [{ $eq: ['$periods.p5.status', 'PRESENT'] }, 1, 0] } },
        p5Absent: { $sum: { $cond: [{ $eq: ['$periods.p5.status', 'ABSENT'] }, 1, 0] } },
        p5Unmarked: { $sum: { $cond: [{ $eq: ['$periods.p5.status', null] }, 1, 0] } },
      },
    },
  ];

  const [result] = await Attendance.aggregate(pipeline);

  if (!result) {
    return {
      date: d,
      totalStudents: 0,
      periods: PERIODS.map((p) => ({
        period: p,
        present: 0,
        absent: 0,
        unmarked: 0,
        percentage: 0,
      })),
    };
  }

  const periods = PERIODS.map((p) => {
    const present = result[`${p}Present`] || 0;
    const absent = result[`${p}Absent`] || 0;
    const unmarked = result[`${p}Unmarked`] || 0;
    const total = present + absent + unmarked;
    return {
      period: p,
      present,
      absent,
      unmarked,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  });

  return {
    date: d,
    totalStudents: result.totalStudents,
    periods,
  };
};

/**
 * Low Attendance Report
 * Returns students below the attendance threshold.
 */
const getLowAttendance = async ({ departmentId, threshold, fromDate, toDate, page = 1, limit = 20 } = {}) => {
  const effectiveThreshold = threshold || config.lowAttendanceThreshold;

  // Build student match
  const studentMatch = { status: 'ACTIVE' };
  if (departmentId) studentMatch.departmentId = departmentId;

  const students = await Student.find(studentMatch).select('_id').lean();
  const studentIds = students.map((s) => s._id);

  const match = { studentId: { $in: studentIds } };
  const dateRange = buildDateRange(fromDate, toDate);
  if (dateRange) match.date = dateRange;

  const skip = (page - 1) * limit;

  const [result] = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$studentId',
        present: {
          $sum: {
            $sum: [
              { $cond: [{ $eq: ['$periods.p1.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p2.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p3.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p4.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p5.status', 'PRESENT'] }, 1, 0] },
            ],
          },
        },
        absent: {
          $sum: {
            $sum: [
              { $cond: [{ $eq: ['$periods.p1.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p2.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p3.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p4.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p5.status', 'ABSENT'] }, 1, 0] },
            ],
          },
        },
        marked: {
          $sum: {
            $sum: [
              { $cond: [{ $ne: ['$periods.p1.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p2.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p3.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p4.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p5.status', null] }, 1, 0] },
            ],
          },
        },
      },
    },
    {
      $project: {
        present: 1,
        absent: 1,
        marked: 1,
        percentage: {
          $cond: [
            { $gt: ['$marked', 0] },
            { $multiply: [{ $divide: ['$present', '$marked'] }, 100] },
            0,
          ],
        },
      },
    },
    { $match: { percentage: { $lt: effectiveThreshold } } },
    { $sort: { percentage: 1 } },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'students',
              localField: '_id',
              foreignField: '_id',
              as: 'student',
              pipeline: [{ $project: { rollNo: 1, name: 1, departmentId: 1 } }],
            },
          },
          { $unwind: '$student' },
          {
            $lookup: {
              from: 'departments',
              localField: 'student.departmentId',
              foreignField: '_id',
              as: 'department',
              pipeline: [{ $project: { name: 1, code: 1 } }],
            },
          },
          { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              rollNo: '$student.rollNo',
              name: '$student.name',
              department: '$department.name',
              present: 1,
              absent: 1,
              total: '$marked',
              percentage: { $round: ['$percentage', 1] },
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  return {
    data: result.data,
    pagination: {
      page,
      limit,
      total: result.total[0]?.count || 0,
      totalPages: Math.ceil((result.total[0]?.count || 0) / limit),
    },
    threshold: effectiveThreshold,
  };
};

/**
 * Dashboard Statistics for VP/Admin
 */
const getAdminDashboardStats = async () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [totalStudents, totalStaff, totalDepartments, todayStats, lowAttendance] = await Promise.all([
    Student.countDocuments({ status: 'ACTIVE' }),
    User.countDocuments({ role: 'STAFF', status: 'ACTIVE' }),
    Department.countDocuments({ status: 'ACTIVE' }),
    Attendance.aggregate([
      { $match: { date: { $gte: today, $lt: tomorrow } } },
      {
        $group: {
          _id: null,
          totalPresent: {
            $sum: {
              $sum: [
                { $cond: [{ $eq: ['$periods.p1.status', 'PRESENT'] }, 1, 0] },
                { $cond: [{ $eq: ['$periods.p2.status', 'PRESENT'] }, 1, 0] },
                { $cond: [{ $eq: ['$periods.p3.status', 'PRESENT'] }, 1, 0] },
                { $cond: [{ $eq: ['$periods.p4.status', 'PRESENT'] }, 1, 0] },
                { $cond: [{ $eq: ['$periods.p5.status', 'PRESENT'] }, 1, 0] },
              ],
            },
          },
          totalAbsent: {
            $sum: {
              $sum: [
                { $cond: [{ $eq: ['$periods.p1.status', 'ABSENT'] }, 1, 0] },
                { $cond: [{ $eq: ['$periods.p2.status', 'ABSENT'] }, 1, 0] },
                { $cond: [{ $eq: ['$periods.p3.status', 'ABSENT'] }, 1, 0] },
                { $cond: [{ $eq: ['$periods.p4.status', 'ABSENT'] }, 1, 0] },
                { $cond: [{ $eq: ['$periods.p5.status', 'ABSENT'] }, 1, 0] },
              ],
            },
          },
          totalMarked: {
            $sum: {
              $sum: [
                { $cond: [{ $ne: ['$periods.p1.status', null] }, 1, 0] },
                { $cond: [{ $ne: ['$periods.p2.status', null] }, 1, 0] },
                { $cond: [{ $ne: ['$periods.p3.status', null] }, 1, 0] },
                { $cond: [{ $ne: ['$periods.p4.status', null] }, 1, 0] },
                { $cond: [{ $ne: ['$periods.p5.status', null] }, 1, 0] },
              ],
            },
          },
        },
      },
    ]),
    Attendance.aggregate([
      {
        $group: {
          _id: '$studentId',
          present: {
            $sum: {
              $sum: [
                { $cond: [{ $eq: ['$periods.p1.status', 'PRESENT'] }, 1, 0] },
                { $cond: [{ $eq: ['$periods.p2.status', 'PRESENT'] }, 1, 0] },
                { $cond: [{ $eq: ['$periods.p3.status', 'PRESENT'] }, 1, 0] },
                { $cond: [{ $eq: ['$periods.p4.status', 'PRESENT'] }, 1, 0] },
                { $cond: [{ $eq: ['$periods.p5.status', 'PRESENT'] }, 1, 0] },
              ],
            },
          },
          marked: {
            $sum: {
              $sum: [
                { $cond: [{ $ne: ['$periods.p1.status', null] }, 1, 0] },
                { $cond: [{ $ne: ['$periods.p2.status', null] }, 1, 0] },
                { $cond: [{ $ne: ['$periods.p3.status', null] }, 1, 0] },
                { $cond: [{ $ne: ['$periods.p4.status', null] }, 1, 0] },
                { $cond: [{ $ne: ['$periods.p5.status', null] }, 1, 0] },
              ],
            },
          },
        },
      },
      {
        $project: {
          percentage: {
            $cond: [
              { $gt: ['$marked', 0] },
              { $multiply: [{ $divide: ['$present', '$marked'] }, 100] },
              0,
            ],
          },
        },
      },
      { $match: { percentage: { $lt: config.lowAttendanceThreshold } } },
      { $count: 'count' },
    ]),
  ]);

  const todayPresent = todayStats[0]?.totalPresent || 0;
  const todayAbsent = todayStats[0]?.totalAbsent || 0;
  const todayMarked = todayStats[0]?.totalMarked || 0;
  const todayPercentage = todayMarked > 0 ? Math.round((todayPresent / todayMarked) * 100) : 0;

  return {
    totalStudents,
    totalStaff,
    totalDepartments,
    today: {
      present: todayPresent,
      absent: todayAbsent,
      totalMarked: todayMarked,
      percentage: todayPercentage,
    },
    lowAttendanceCount: lowAttendance[0]?.count || 0,
  };
};

/**
 * Dashboard Statistics for Staff
 */
const getStaffDashboardStats = async (departmentId) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const students = await Student.find({ departmentId, status: 'ACTIVE' }).select('_id').lean();
  const studentIds = students.map((s) => s._id);

  const [todayStats] = await Attendance.aggregate([
    { $match: { date: { $gte: today, $lt: tomorrow }, studentId: { $in: studentIds } } },
    {
      $group: {
        _id: null,
        totalPresent: {
          $sum: {
            $sum: [
              { $cond: [{ $eq: ['$periods.p1.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p2.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p3.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p4.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p5.status', 'PRESENT'] }, 1, 0] },
            ],
          },
        },
        totalAbsent: {
          $sum: {
            $sum: [
              { $cond: [{ $eq: ['$periods.p1.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p2.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p3.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p4.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p5.status', 'ABSENT'] }, 1, 0] },
            ],
          },
        },
        totalUnmarked: {
          $sum: {
            $sum: [
              { $cond: [{ $eq: ['$periods.p1.status', null] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p2.status', null] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p3.status', null] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p4.status', null] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p5.status', null] }, 1, 0] },
            ],
          },
        },
        totalMarked: {
          $sum: {
            $sum: [
              { $cond: [{ $ne: ['$periods.p1.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p2.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p3.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p4.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p5.status', null] }, 1, 0] },
            ],
          },
        },
      },
    },
  ]);

  const present = todayStats?.totalPresent || 0;
  const absent = todayStats?.totalAbsent || 0;
  const unmarked = todayStats?.totalUnmarked || 0;
  const marked = todayStats?.totalMarked || 0;
  const percentage = marked > 0 ? Math.round((present / marked) * 100) : 0;

  return {
    totalStudents: students.length,
    today: {
      present,
      absent,
      unmarked,
      totalMarked: marked,
      percentage,
    },
  };
};

/**
 * Dashboard Statistics for Student
 */
const getStudentDashboardStats = async (studentId) => {
  const [stats] = await Attendance.aggregate([
    { $match: { studentId } },
    {
      $group: {
        _id: null,
        totalPresent: {
          $sum: {
            $sum: [
              { $cond: [{ $eq: ['$periods.p1.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p2.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p3.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p4.status', 'PRESENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p5.status', 'PRESENT'] }, 1, 0] },
            ],
          },
        },
        totalAbsent: {
          $sum: {
            $sum: [
              { $cond: [{ $eq: ['$periods.p1.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p2.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p3.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p4.status', 'ABSENT'] }, 1, 0] },
              { $cond: [{ $eq: ['$periods.p5.status', 'ABSENT'] }, 1, 0] },
            ],
          },
        },
        totalMarked: {
          $sum: {
            $sum: [
              { $cond: [{ $ne: ['$periods.p1.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p2.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p3.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p4.status', null] }, 1, 0] },
              { $cond: [{ $ne: ['$periods.p5.status', null] }, 1, 0] },
            ],
          },
        },
      },
    },
  ]);

  const present = stats?.totalPresent || 0;
  const absent = stats?.totalAbsent || 0;
  const totalMarked = stats?.totalMarked || 0;
  const percentage = totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 0;

  return {
    totalClasses: totalMarked,
    present,
    absent,
    percentage,
  };
};

module.exports = {
  getStudentReport,
  getStudentDailyHistory,
  getDepartmentReport,
  getDailyReport,
  getLowAttendance,
  getAdminDashboardStats,
  getStaffDashboardStats,
  getStudentDashboardStats,
};
