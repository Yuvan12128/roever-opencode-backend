const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
      maxlength: [150, 'Department name cannot exceed 150 characters'],
    },
    code: {
      type: String,
      required: [true, 'Department code is required'],
      unique: true,
      trim: true,
      uppercase: true, // normalize to uppercase on save
      maxlength: [20, 'Department code cannot exceed 20 characters'],
      match: [/^[A-Z0-9]+$/, 'Department code must contain only uppercase letters and numbers'],
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

// Normalize code to uppercase before validation/save
departmentSchema.pre('save', function normalizeCode(next) {
  if (this.isModified('code') && this.code) {
    this.code = this.code.toUpperCase().trim();
  }
  next();
});

departmentSchema.pre('findOneAndUpdate', function normalizeCode(next) {
  const update = this.getUpdate();
  if (update.code) {
    update.code = update.code.toUpperCase().trim();
  }
  next();
});

// Indexes (code index is created by `unique: true` on the field)
departmentSchema.index({ status: 1 });

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department;
