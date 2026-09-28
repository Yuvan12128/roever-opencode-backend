const express = require('express');

const studentController = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  studentCreateRules,
  studentUpdateRules,
  studentIdRules,
  studentStatusRules,
  studentListRules,
} = require('../validators/studentValidators');

const router = express.Router();

// VP/ADMIN: full management. STAFF: view + add students in own department.
router.use(authenticate, authorize('VP', 'ADMIN', 'STAFF'));

router.get('/', studentListRules, studentController.list);
router.post('/', studentCreateRules, studentController.create);
router.post('/bulk', studentController.bulkCreate);
router.get('/:id', studentIdRules, studentController.getById);
router.put('/:id', studentUpdateRules, studentController.update);
router.patch('/:id/status', studentStatusRules, studentController.changeStatus);

module.exports = router;
