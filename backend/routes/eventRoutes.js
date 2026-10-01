const router = require('express').Router();
const c = require('../controllers/eventController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

router.get('/', optionalAuth, c.listEvents);
router.post('/', protect, allowRoles('organizer'), c.createEvent);
router.get('/:id/registrations', protect, allowRoles('organizer'), c.eventRegistrations);
router.get('/:id', optionalAuth, c.getEvent);
router.put('/:id', protect, allowRoles('organizer'), c.updateEvent);
router.delete('/:id', protect, allowRoles('organizer'), c.deleteEvent);

module.exports = router;
