/**
 * Phase 3 end-to-end tests: Department, Student, and Staff management.
 *
 * Spins up an in-memory MongoDB, starts the real server, seeds demo data,
 * and exercises every management flow including security/authorization.
 * Run with:
 *   node tests/management.e2e.js
 */

const { spawn } = require('child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 5098;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

let passed = 0;
let failed = 0;
const results = [];

const check = (name, condition, detail = '') => {
  if (condition) {
    passed += 1;
    results.push(`  PASS  ${name}`);
  } else {
    failed += 1;
    results.push(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const api = async (path, { method = 'GET', token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }

  return { status: res.status, data };
};

const waitForServer = async (timeoutMs = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) {
        console.log('[test] Server is up');
        return true;
      }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log('[test] Server failed to start within timeout');
  return false;
};

const login = async (email, password) => {
  const { data } = await api('/auth/login', { method: 'POST', body: { email, password } });
  return data.data;
};

const run = async () => {
  console.log('\n=== Phase 3: Management E2E Tests ===\n');

  const mongo = await MongoMemoryServer.create();
  const mongoUri = mongo.getUri();
  console.log(`[test] MongoDB started: ${mongoUri}`);

  // Seed
  const seed = spawn('node', ['src/config/seed.js'], {
    env: { ...process.env, MONGODB_URI: mongoUri, JWT_SECRET: 'test-secret', NODE_ENV: 'development' },
    stdio: 'inherit',
  });
  const seedExit = await new Promise((resolve) => seed.on('exit', resolve));
  check('seed script exits cleanly', seedExit === 0, `exit code ${seedExit}`);

  // Start server
  const server = spawn('node', ['src/server.js'], {
    env: {
      ...process.env,
      MONGODB_URI: mongoUri,
      JWT_SECRET: 'test-secret',
      NODE_ENV: 'development',
      PORT: String(PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[server] ${msg}`);
  });
  server.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[server-err] ${msg}`);
  });
  server.on('error', (err) => {
    console.error('[test] Server process error:', err.message);
  });

  const serverUp = await waitForServer();
  check('server starts and health check responds', serverUp);

  if (!serverUp) {
    console.error(results.join('\n'));
    console.error(`\n${failed} test(s) failed.`);
    server.kill();
    await mongo.stop();
    process.exit(1);
  }

  // Login all roles
  const vp = await login('vp@demo.com', 'Vp@Demo1234');
  const admin = await login('admin@demo.com', 'Admin@Demo1234');
  const staff = await login('staff@demo.com', 'Staff@Demo1234');
  const student = await login('student@demo.com', 'Student@Demo1234');

  check('all four roles can log in', !!(vp && admin && staff && student));

  // Get seeded departments
  const deptsRes = await api('/departments', { token: vp.token });
  const departments = deptsRes.data.data.data;
  const mcaDept = departments.find((d) => d.code === 'MCA');
  const bcaDept = departments.find((d) => d.code === 'BCA');
  check('seed created 3 departments', departments.length === 3, `count=${departments.length}`);
  check('department includes studentCount', typeof mcaDept.studentCount === 'number');
  check('department includes staffCount', typeof mcaDept.staffCount === 'number');
  check('MCA has 3 seeded students', mcaDept.studentCount === 3, `count=${mcaDept.studentCount}`);

  // --- Department: create ---
  const newDeptRes = await api('/departments', {
    method: 'POST',
    token: vp.token,
    body: { name: 'Information Technology', code: 'it' },
  });
  check(
    'VP creates department (code normalized to uppercase)',
    newDeptRes.status === 201 && newDeptRes.data.data.department.code === 'IT',
    `status=${newDeptRes.status}`
  );
  const itDept = newDeptRes.data.data.department;

  // --- Department: duplicate code ---
  const dupDeptRes = await api('/departments', {
    method: 'POST',
    token: vp.token,
    body: { name: 'Info Tech', code: 'IT' },
  });
  check(
    'duplicate department code rejected with 409 DUPLICATE_DEPARTMENT_CODE',
    dupDeptRes.status === 409 && dupDeptRes.data.errorCode === 'DUPLICATE_DEPARTMENT_CODE',
    `status=${dupDeptRes.status} errorCode=${dupDeptRes.data?.errorCode}`
  );

  // --- Department: invalid data ---
  const invalidDeptRes = await api('/departments', {
    method: 'POST',
    token: vp.token,
    body: { name: '', code: '' },
  });
  check(
    'empty department fields rejected with 400 VALIDATION_ERROR',
    invalidDeptRes.status === 400 && invalidDeptRes.data.errorCode === 'VALIDATION_ERROR',
    `status=${invalidDeptRes.status}`
  );

  // --- Department: edit ---
  const editDeptRes = await api(`/departments/${itDept._id}`, {
    method: 'PUT',
    token: vp.token,
    body: { name: 'Information Technology & Engineering' },
  });
  check(
    'VP edits department name',
    editDeptRes.status === 200 && editDeptRes.data.data.department.name === 'Information Technology & Engineering',
    `status=${editDeptRes.status}`
  );

  // --- Department: deactivate with dependents blocked ---
  const deactDeptRes = await api(`/departments/${mcaDept._id}/status`, {
    method: 'PATCH',
    token: vp.token,
    body: { status: 'INACTIVE' },
  });
  check(
    'deactivating department with students blocked (400 DEPARTMENT_HAS_DEPENDENTS)',
    deactDeptRes.status === 400 && deactDeptRes.data.errorCode === 'DEPARTMENT_HAS_DEPENDENTS',
    `status=${deactDeptRes.status} errorCode=${deactDeptRes.data?.errorCode}`
  );

  // --- Department: deactivate empty department succeeds ---
  const deactEmptyRes = await api(`/departments/${itDept._id}/status`, {
    method: 'PATCH',
    token: vp.token,
    body: { status: 'INACTIVE' },
  });
  check(
    'deactivating empty department succeeds',
    deactEmptyRes.status === 200 && deactEmptyRes.data.data.department.status === 'INACTIVE',
    `status=${deactEmptyRes.status}`
  );

  // --- Department: list with search + status filter ---
  const searchDeptRes = await api('/departments?search=mca', { token: vp.token });
  const searchDepts = searchDeptRes.data.data.data;
  check(
    'department search filters by name/code',
    searchDeptRes.status === 200 && searchDepts.length === 1,
    `count=${searchDepts.length}`
  );

  const inactiveDeptRes = await api('/departments?status=INACTIVE', { token: vp.token });
  const inactiveDepts = inactiveDeptRes.data.data.data;
  check(
    'department status filter works',
    inactiveDeptRes.status === 200 && inactiveDepts.every((d) => d.status === 'INACTIVE'),
    `count=${inactiveDepts.length}`
  );

  // --- Department: unauthorized access ---
  const noAuthDept = await api('/departments');
  check(
    'department list without token -> 401',
    noAuthDept.status === 401,
    `status=${noAuthDept.status}`
  );

  const studentDept = await api('/departments', { token: student.token });
  check(
    'STUDENT cannot access department management -> 403',
    studentDept.status === 403,
    `status=${studentDept.status}`
  );

  const staffDept = await api('/departments', { token: staff.token });
  check(
    'STAFF cannot access department management -> 403',
    staffDept.status === 403,
    `status=${staffDept.status}`
  );

  // --- Student: list with pagination ---
  const studentsRes = await api('/students?page=1&limit=2', { token: vp.token });
  const studentsData = studentsRes.data.data;
  check(
    'student list paginates correctly',
    studentsRes.status === 200 &&
      studentsData.data.length === 2 &&
      studentsData.pagination.total === 5 &&
      studentsData.pagination.totalPages === 3,
    `count=${studentsData.data.length} total=${studentsData.pagination.total}`
  );

  // --- Student: search ---
  const searchStudentRes = await api('/students?search=MCA001', { token: vp.token });
  const searchStudents = searchStudentRes.data.data.data;
  check(
    'student search by rollNo works',
    searchStudentRes.status === 200 && searchStudents.length === 1,
    `count=${searchStudents.length}`
  );

  // --- Student: department filter ---
  const deptFilterRes = await api(`/students?departmentId=${bcaDept._id}`, { token: vp.token });
  const deptFilterStudents = deptFilterRes.data.data.data;
  check(
    'student department filter works',
    deptFilterRes.status === 200 && deptFilterStudents.length === 2,
    `count=${deptFilterStudents.length}`
  );

  // --- Student: year filter ---
  const yearFilterRes = await api('/students?year=1', { token: vp.token });
  const yearFilterStudents = yearFilterRes.data.data.data;
  check(
    'student year filter works',
    yearFilterRes.status === 200 && yearFilterStudents.length === 3,
    `count=${yearFilterStudents.length}`
  );

  // --- Student: create ---
  const newStudentRes = await api('/students', {
    method: 'POST',
    token: vp.token,
    body: {
      rollNo: 'MCA004',
      name: 'Test Student',
      email: 'test.student@student.edu',
      phone: '9876543215',
      departmentId: mcaDept._id,
      year: 1,
      section: 'A',
    },
  });
  check(
    'VP creates student',
    newStudentRes.status === 201 && newStudentRes.data.data.student.rollNo === 'MCA004',
    `status=${newStudentRes.status}`
  );
  const newStudent = newStudentRes.data.data.student;

  // --- Student: duplicate roll number ---
  const dupRollRes = await api('/students', {
    method: 'POST',
    token: vp.token,
    body: {
      rollNo: 'MCA004',
      name: 'Another Student',
      email: 'another@student.edu',
      departmentId: mcaDept._id,
      year: 1,
    },
  });
  check(
    'duplicate roll number rejected with 409 DUPLICATE_ROLL_NUMBER',
    dupRollRes.status === 409 && dupRollRes.data.errorCode === 'DUPLICATE_ROLL_NUMBER',
    `status=${dupRollRes.status} errorCode=${dupRollRes.data?.errorCode}`
  );

  // --- Student: duplicate email ---
  const dupEmailRes = await api('/students', {
    method: 'POST',
    token: vp.token,
    body: {
      rollNo: 'MCA005',
      name: 'Another Student',
      email: 'test.student@student.edu',
      departmentId: mcaDept._id,
      year: 1,
    },
  });
  check(
    'duplicate email rejected with 409 DUPLICATE_EMAIL',
    dupEmailRes.status === 409 && dupEmailRes.data.errorCode === 'DUPLICATE_EMAIL',
    `status=${dupEmailRes.status} errorCode=${dupEmailRes.data?.errorCode}`
  );

  // --- Student: invalid department ---
  const studentInvalidDeptRes = await api('/students', {
    method: 'POST',
    token: vp.token,
    body: {
      rollNo: 'MCA006',
      name: 'Bad Dept Student',
      email: 'bad.dept@student.edu',
      departmentId: '64b7f0c2e1a2b3c4d5e6f7a8',
      year: 1,
    },
  });
  check(
    'invalid department ID rejected with 400 INVALID_DEPARTMENT',
    studentInvalidDeptRes.status === 400 && studentInvalidDeptRes.data.errorCode === 'INVALID_DEPARTMENT',
    `status=${studentInvalidDeptRes.status} errorCode=${studentInvalidDeptRes.data?.errorCode}`
  );

  // --- Student: inactive department rejected ---
  const studentInactiveDeptRes = await api('/students', {
    method: 'POST',
    token: vp.token,
    body: {
      rollNo: 'IT001',
      name: 'Inactive Dept Student',
      email: 'inactive.dept@student.edu',
      departmentId: itDept._id,
      year: 1,
    },
  });
  check(
    'inactive department rejected with 400 INACTIVE_DEPARTMENT',
    studentInactiveDeptRes.status === 400 && studentInactiveDeptRes.data.errorCode === 'INACTIVE_DEPARTMENT',
    `status=${studentInactiveDeptRes.status} errorCode=${studentInactiveDeptRes.data?.errorCode}`
  );

  // --- Student: edit ---
  const editStudentRes = await api(`/students/${newStudent._id}`, {
    method: 'PUT',
    token: vp.token,
    body: { name: 'Test Student Updated', section: 'B' },
  });
  check(
    'VP edits student',
    editStudentRes.status === 200 && editStudentRes.data.data.student.name === 'Test Student Updated',
    `status=${editStudentRes.status}`
  );

  // --- Student: deactivate ---
  const deactStudentRes = await api(`/students/${newStudent._id}/status`, {
    method: 'PATCH',
    token: vp.token,
    body: { status: 'INACTIVE' },
  });
  check(
    'VP deactivates student',
    deactStudentRes.status === 200 && deactStudentRes.data.data.student.status === 'INACTIVE',
    `status=${deactStudentRes.status}`
  );

  // --- Student: STAFF can view own department students ---
  const staffStudentsRes = await api('/students', { token: staff.token });
  const staffStudents = staffStudentsRes.data.data.data;
  check(
    'STAFF can list students',
    staffStudentsRes.status === 200,
    `status=${staffStudentsRes.status}`
  );
  check(
    'STAFF only sees own department (MCA) students',
    staffStudents.every((s) => s.department?.code === 'MCA'),
    `count=${staffStudents.length}`
  );

  // --- Student: STAFF cannot access other department ---
  const staffOtherDeptRes = await api(`/students?departmentId=${bcaDept._id}`, { token: staff.token });
  const staffOtherDeptStudents = staffOtherDeptRes.data.data.data;
  check(
    'STAFF requesting other department gets own department instead',
    staffOtherDeptRes.status === 200 &&
      staffOtherDeptStudents.every((s) => s.department?.code === 'MCA'),
    `count=${staffOtherDeptStudents.length}`
  );

  // --- Student: STAFF can add student to own department ---
  const staffAddRes = await api('/students', {
    method: 'POST',
    token: staff.token,
    body: {
      rollNo: 'MCA010',
      name: 'Staff Added Student',
      email: 'staff.added@student.edu',
      departmentId: bcaDept._id, // STAFF tries to add to BCA — should be overridden to MCA
      year: 2,
    },
  });
  check(
    'STAFF can add student (department forced to own)',
    staffAddRes.status === 201 && staffAddRes.data.data.student.departmentId === mcaDept._id,
    `status=${staffAddRes.status} deptId=${staffAddRes.data?.data?.student?.departmentId}`
  );

  // --- Student: STUDENT role cannot access student management ---
  const studentMgmtRes = await api('/students', { token: student.token });
  check(
    'STUDENT cannot access student management -> 403',
    studentMgmtRes.status === 403,
    `status=${studentMgmtRes.status}`
  );

  // --- Staff: create ---
  const newStaffRes = await api('/staff', {
    method: 'POST',
    token: vp.token,
    body: {
      name: 'New Staff Member',
      email: 'new.staff@demo.com',
      password: 'NewStaff@1234',
      departmentId: bcaDept._id,
    },
  });
  check(
    'VP creates staff',
    newStaffRes.status === 201 && newStaffRes.data.data.staff.email === 'new.staff@demo.com',
    `status=${newStaffRes.status}`
  );
  check(
    'staff response has no password field',
    newStaffRes.data?.data?.staff?.password === undefined
  );
  const newStaff = newStaffRes.data.data.staff;

  // --- Staff: duplicate email ---
  const dupStaffRes = await api('/staff', {
    method: 'POST',
    token: vp.token,
    body: {
      name: 'Duplicate Staff',
      email: 'new.staff@demo.com',
      password: 'AnotherPass1',
      departmentId: bcaDept._id,
    },
  });
  check(
    'duplicate staff email rejected with 409 DUPLICATE_EMAIL',
    dupStaffRes.status === 409 && dupStaffRes.data.errorCode === 'DUPLICATE_EMAIL',
    `status=${dupStaffRes.status} errorCode=${dupStaffRes.data?.errorCode}`
  );

  // --- Staff: invalid department ---
  const staffInvalidDeptRes = await api('/staff', {
    method: 'POST',
    token: vp.token,
    body: {
      name: 'Bad Dept Staff',
      email: 'bad.dept@demo.com',
      password: 'BadDept@1234',
      departmentId: '64b7f0c2e1a2b3c4d5e6f7a8',
    },
  });
  check(
    'staff with invalid department rejected with 400 INVALID_DEPARTMENT',
    staffInvalidDeptRes.status === 400 && staffInvalidDeptRes.data.errorCode === 'INVALID_DEPARTMENT',
    `status=${staffInvalidDeptRes.status} errorCode=${staffInvalidDeptRes.data?.errorCode}`
  );

  // --- Staff: list with pagination ---
  const staffListRes = await api('/staff?page=1&limit=1', { token: vp.token });
  const staffListData = staffListRes.data.data;
  check(
    'staff list paginates correctly',
    staffListRes.status === 200 &&
      staffListData.data.length === 1 &&
      staffListData.pagination.total >= 2,
    `count=${staffListData.data.length} total=${staffListData.pagination.total}`
  );

  // --- Staff: search ---
  const staffSearchRes = await api('/staff?search=rahul', { token: vp.token });
  const staffSearchResults = staffSearchRes.data.data.data;
  check(
    'staff search works',
    staffSearchRes.status === 200 && staffSearchResults.length === 1,
    `count=${staffSearchResults.length}`
  );

  // --- Staff: edit ---
  const editStaffRes = await api(`/staff/${newStaff._id}`, {
    method: 'PUT',
    token: vp.token,
    body: { name: 'Updated Staff Name' },
  });
  check(
    'VP edits staff',
    editStaffRes.status === 200 && editStaffRes.data.data.staff.name === 'Updated Staff Name',
    `status=${editStaffRes.status}`
  );

  // --- Staff: deactivate ---
  const deactStaffRes = await api(`/staff/${newStaff._id}/status`, {
    method: 'PATCH',
    token: vp.token,
    body: { status: 'INACTIVE' },
  });
  check(
    'VP deactivates staff',
    deactStaffRes.status === 200 && deactStaffRes.data.data.staff.status === 'INACTIVE',
    `status=${deactStaffRes.status}`
  );

  // --- Staff: STAFF cannot access staff management ---
  const staffMgmtRes = await api('/staff', { token: staff.token });
  check(
    'STAFF cannot access staff management -> 403',
    staffMgmtRes.status === 403,
    `status=${staffMgmtRes.status}`
  );

  // --- Staff: STUDENT cannot access staff management ---
  const studentStaffRes = await api('/staff', { token: student.token });
  check(
    'STUDENT cannot access staff management -> 403',
    studentStaffRes.status === 403,
    `status=${studentStaffRes.status}`
  );

  // --- Staff: deactivated staff cannot login ---
  const deactLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { email: 'new.staff@demo.com', password: 'NewStaff@1234' },
  });
  check(
    'deactivated staff cannot login -> 403 ACCOUNT_INACTIVE',
    deactLoginRes.status === 403 && deactLoginRes.data.errorCode === 'ACCOUNT_INACTIVE',
    `status=${deactLoginRes.status} errorCode=${deactLoginRes.data?.errorCode}`
  );

  // --- Performance: bulk create 1000 students, verify pagination ---
  console.log('\n[test] Performance: creating 1000 students...');
  const bulkStudents = [];
  for (let i = 0; i < 1000; i++) {
    bulkStudents.push({
      rollNo: `PERF${String(i).padStart(4, '0')}`,
      name: `Performance Test Student ${i}`,
      email: `perf.${i}@student.edu`,
      departmentId: mcaDept._id,
      year: (i % 3) + 1,
      section: String.fromCharCode(65 + (i % 3)),
    });
  }

  // Insert in batches of 200
  for (let i = 0; i < bulkStudents.length; i += 200) {
    const batch = bulkStudents.slice(i, i + 200);
    const res = await api('/students/bulk', {
      method: 'POST',
      token: vp.token,
      body: { students: batch },
    });
    console.log(`[test] Batch ${i / 200 + 1}: created=${res.data?.data?.created} skipped=${res.data?.data?.skipped}`);
  }

  const perfListRes = await api('/students?page=1&limit=20&departmentId=' + mcaDept._id, { token: vp.token });
  const perfListData = perfListRes.data.data;
  check(
    'performance: 1000+ students paginated correctly',
    perfListRes.status === 200 &&
      perfListData.data.length === 20 &&
      perfListData.pagination.total >= 1000,
    `total=${perfListData.pagination.total}`
  );

  const perfSearchRes = await api('/students?search=PERF0500', { token: vp.token });
  const perfSearchResults = perfSearchRes.data.data.data;
  check(
    'performance: search works with 1000+ students',
    perfSearchRes.status === 200 && perfSearchResults.length === 1,
    `count=${perfSearchResults.length}`
  );

  // Cleanup
  server.kill();
  await mongo.stop();

  console.log(results.join('\n'));
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('[test] Fatal:', err);
  process.exit(1);
});
