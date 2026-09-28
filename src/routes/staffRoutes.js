const express = require('express');

const staffController = require('../controllers/staffController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  staffCreateRules,
  staffUpdateRules,
  staffIdRules,
  staffStatusRules,
  staffListRules,
} = require('../validators/staffValidators');

const router = express.Router();

// Staff management is restricted to VP/ADMIN
router.use(authenticate, authorize('VP', 'ADMIN'));

router.get('/', staffListRules, staffController.list);
router.post('/', staffCreateRules, staffController.create);
router.get('/:id', staffIdRules, staffController.getById);
router.put('/:id', staffUpdateRules, staffController.update);
router.patch('/:id/status', staffStatusRules, staffController.changeStatus);

module.exports = router;
