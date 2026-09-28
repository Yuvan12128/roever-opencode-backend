const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    rollNo: {
      type: String,
      required: [true, 'Roll number is required'],
      unique: true,
      trim: true,
      uppercase: true, // normalize roll numbers (e.g. mca001 -> MCA001)
      maxlength: [30, 'Roll number cannot exceed 30 characters'],
    },
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[0-9]{10,15}$/, 'Please provide a valid phone number'],
      default: null,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
    },
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      default: null,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [1, 'Year must be at least 1'],
      max: [6, 'Year cannot exceed 6'],
    },
    section: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'A',
      maxlength: [5, 'Section cannot exceed 5 characters'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'INACTIVE'],
        message: 'Status must be ACTIVE or INACTIVE',
      },
      default: 'ACTIVE',
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

// Normalize roll number before save
studentSchema.pre('save', function normalizeRollNo(next) {
  if (this.isModified('rollNo') && this.rollNo) {
    this.rollNo = this.rollNo.toUpperCase().trim();
  }
  next();
});

studentSchema.pre('findOneAndUpdate', function normalizeRollNo(next) {
  const update = this.getUpdate();
  if (update.rollNo) {
    update.rollNo = update.rollNo.toUpperCase().trim();
  }
  next();
});

// Indexes — only for actual query patterns:
// rollNo/email uniqueness (via `unique: true` on the fields),
// department-scoped student lists, status filtering,
// and department+rollNo composite for sorted dept listings
studentSchema.index({ departmentId: 1 });
studentSchema.index({ departmentId: 1, rollNo: 1 });
studentSchema.index({ status: 1 });
studentSchema.index({ departmentId: 1, status: 1 });

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
