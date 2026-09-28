const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['VP', 'ADMIN', 'STAFF', 'STUDENT'];
const STATUSES = ['ACTIVE', 'INACTIVE'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
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
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned by queries unless explicitly requested
    },
    role: {
      type: String,
      enum: {
        values: ROLES,
        message: 'Role must be one of: VP, ADMIN, STAFF, STUDENT',
      },
      required: [true, 'Role is required'],
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: STATUSES,
        message: 'Status must be ACTIVE or INACTIVE',
      },
      default: 'ACTIVE',
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        // Defense in depth: password is select:false, but strip it here too
        // so it can never leak through a serialized user object.
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes (email index is created by `unique: true` on the field)
userSchema.index({ role: 1, status: 1 });
userSchema.index({ departmentId: 1 });

// Hash password before save (only when modified)
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method: compare a candidate password against the hash
userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model('User', userSchema);

User.ROLES = ROLES;
User.STATUSES = STATUSES;

module.exports = User;
