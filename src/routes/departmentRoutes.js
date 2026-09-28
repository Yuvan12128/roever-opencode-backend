const express = require('express');

const departmentController = require('../controllers/departmentController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  departmentCreateRules,
  departmentUpdateRules,
  departmentIdRules,
  departmentStatusRules,
} = require('../validators/departmentValidators');

const router = express.Router();

// All department management is restricted to VP/ADMIN
router.use(authenticate, authorize('VP', 'ADMIN'));

router.get('/', departmentController.list);
router.post('/', departmentCreateRules, departmentController.create);
router.get('/:id', departmentIdRules, departmentController.getById);
router.put('/:id', departmentUpdateRules, departmentController.update);
router.patch('/:id/status', departmentStatusRules, departmentController.changeStatus);

module.exports = router;
