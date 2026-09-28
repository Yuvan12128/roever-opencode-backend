const express = require('express');

const authRoutes = require('./authRoutes');
const departmentRoutes = require('./departmentRoutes');
const studentRoutes = require('./studentRoutes');
const staffRoutes = require('./staffRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const reportRoutes = require('./reportRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/departments', departmentRoutes);
router.use('/students', studentRoutes);
router.use('/staff', staffRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/reports', reportRoutes);

module.exports = router;
