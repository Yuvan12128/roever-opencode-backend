const mongoose = require('mongoose');

const PERIODS = ['p1', 'p2', 'p3', 'p4', 'p5'];
const STATUSES = ['PRESENT', 'ABSENT'];

const periodStatusSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: {
        values: STATUSES,
        message: 'Status must be PRESENT or ABSENT',
      },
      default: null,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    markedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      set: (v) => {
        // Normalize to midnight UTC for consistent date-only comparison
        const d = new Date(v);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      },
    },
    periods: {
      p1: { type: periodStatusSchema, default: () => ({}) },
      p2: { type: periodStatusSchema, default: () => ({}) },
      p3: { type: periodStatusSchema, default: () => ({}) },
      p4: { type: periodStatusSchema, default: () => ({}) },
      p5: { type: periodStatusSchema, default: () => ({}) },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound unique index — one attendance document per student per date
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

// Query indexes
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ studentId: 1 });

// TTL index — attendance records expire after ~1 year (365 days)
// MongoDB TTL cleanup is asynchronous; documents may persist briefly past expiration
attendanceSchema.index(
  { date: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60, name: 'ttl_attendance_retention' }
);

const Attendance = mongoose.model('Attendance', attendanceSchema);

Attendance.PERIODS = PERIODS;
Attendance.STATUSES = STATUSES;

module.exports = Attendance;
