/**
 * Development seed script.
 *
 * Creates (or updates) demo accounts, departments, and sample students.
 * Idempotent: safe to run multiple times — existing records are matched
 * by natural key (email / rollNo / code) and never duplicated.
 *
 * DEMO PASSWORDS (development only — never use in production):
 *   VP     -> vp@demo.com     / Vp@Demo1234
 *   ADMIN  -> admin@demo.com  / Admin@Demo1234
 *   STAFF  -> staff@demo.com  / Staff@Demo1234
 *   STUDENT-> student@demo.com/ Student@Demo1234
 */

const mongoose = require('mongoose');
const connectDB = require('./db');
const config = require('./env');
const User = require('../models/User');
const Department = require('../models/Department');
const AcademicYear = require('../models/AcademicYear');
const Student = require('../models/Student');

const seedUsers = [
  {
    name: 'Vikram Prasad',
    email: 'vp@demo.com',
    password: 'Vp@Demo1234',
    role: 'VP',
  },
  {
    name: 'Anita Desai',
    email: 'admin@demo.com',
    password: 'Admin@Demo1234',
    role: 'ADMIN',
  },
  {
    name: 'Rahul Sharma',
    email: 'staff@demo.com',
    password: 'Staff@Demo1234',
    role: 'STAFF',
  },
  {
    name: 'Priya Nair',
    email: 'student@demo.com',
    password: 'Student@Demo1234',
    role: 'STUDENT',
  },
];

const seedDepartments = [
  { name: 'Master of Computer Applications', code: 'MCA' },
  { name: 'Bachelor of Computer Applications', code: 'BCA' },
  { name: 'Master of Business Administration', code: 'MBA' },
];

const seedStudents = [
  { rollNo: 'MCA001', name: 'Arun Kumar', email: 'arun.kumar@student.edu', phone: '9876543210', year: 1, section: 'A' },
  { rollNo: 'MCA002', name: 'Divya Menon', email: 'divya.menon@student.edu', phone: '9876543211', year: 1, section: 'A' },
  { rollNo: 'MCA003', name: 'Karthik Raja', email: 'karthik.raja@student.edu', phone: '9876543212', year: 2, section: 'B' },
  { rollNo: 'BCA001', name: 'Sneha Pillai', email: 'sneha.pillai@student.edu', phone: '9876543213', year: 1, section: 'A' },
  { rollNo: 'BCA002', name: 'Vigneshwaran', email: 'vignesh.bca@student.edu', phone: '9876543214', year: 3, section: 'A' },
];

const runSeed = async () => {
  // Use MONGODB_URI when provided; otherwise fall back to the shared dev database
  if (config.mongoUri) {
    await mongoose.connect(config.mongoUri);
    console.log(`[seed] Connected to: ${config.mongoUri}`);
  } else {
    await connectDB();
  }

  // --- Departments ---
  const departments = {};
  for (const dept of seedDepartments) {
    let department = await Department.findOne({ code: dept.code });
    if (!department) {
      department = await Department.create({ name: dept.name, code: dept.code, status: 'ACTIVE' });
    }
    departments[dept.code] = department;
    console.log(`[seed] Department ready: ${dept.code}`);
  }

  // --- Academic Year ---
  let academicYear = await AcademicYear.findOne({ name: '2026-2027' });
  if (!academicYear) {
    academicYear = await AcademicYear.create({
      name: '2026-2027',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      status: 'ACTIVE',
    });
  }
  console.log('[seed] Academic year ready: 2026-2027');

  // --- Users (passwords hashed by pre-save hook) ---
  const mcaDept = departments.MCA;
  const bcaDept = departments.BCA;

  for (const seedUser of seedUsers) {
    const existing = await User.findOne({ email: seedUser.email });

    if (existing) {
      existing.name = seedUser.name;
      existing.role = seedUser.role;
      existing.status = 'ACTIVE';
      if (seedUser.role === 'STAFF') existing.departmentId = mcaDept._id;
      await existing.save();
      console.log(`[seed] Updated ${seedUser.role}: ${seedUser.email}`);
    } else {
      await User.create({
        name: seedUser.name,
        email: seedUser.email,
        password: seedUser.password,
        role: seedUser.role,
        departmentId: seedUser.role === 'STAFF' ? mcaDept._id : null,
        status: 'ACTIVE',
      });
      console.log(`[seed] Created ${seedUser.role}: ${seedUser.email}`);
    }
  }

  // --- Students ---
  const studentDeptMap = {
    MCA: mcaDept,
    BCA: bcaDept,
  };

  for (const s of seedStudents) {
    const deptCode = s.rollNo.replace(/[0-9]/g, '');
    const department = studentDeptMap[deptCode];

    const existing = await Student.findOne({ rollNo: s.rollNo });

    if (existing) {
      existing.name = s.name;
      existing.email = s.email;
      existing.phone = s.phone;
      existing.year = s.year;
      existing.section = s.section;
      existing.departmentId = department._id;
      existing.academicYearId = academicYear._id;
      existing.status = 'ACTIVE';
      await existing.save();
      console.log(`[seed] Updated student: ${s.rollNo}`);
    } else {
      await Student.create({
        ...s,
        departmentId: department._id,
        academicYearId: academicYear._id,
        status: 'ACTIVE',
      });
      console.log(`[seed] Created student: ${s.rollNo}`);
    }
  }

  console.log('\n[seed] Demo accounts ready. Passwords:');
  console.log('  VP      -> vp@demo.com      / Vp@Demo1234');
  console.log('  ADMIN   -> admin@demo.com    / Admin@Demo1234');
  console.log('  STAFF   -> staff@demo.com    / Staff@Demo1234');
  console.log('  STUDENT -> student@demo.com  / Student@Demo1234');

  await mongoose.connection.close();
  console.log('[seed] Done. Database connection closed.');
};

runSeed().catch((err) => {
  console.error('[seed] Failed:', err.message);
  process.exit(1);
});
