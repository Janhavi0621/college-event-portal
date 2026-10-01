const router = require('express').Router();
const c = require('../controllers/registrationController');
const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

router.post('/', protect, allowRoles('student'), c.register);
router.get('/my', protect, allowRoles('student'), c.myRegistrations);
router.get('/:id', protect, c.getRegistration);

module.exports = router;
