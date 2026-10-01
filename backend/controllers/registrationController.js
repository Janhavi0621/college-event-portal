const crypto = require('crypto');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const v = require('../utils/validate');
const { present, startsAt } = require('../utils/eventHelpers');

// Example: REG-2026-8F42K9 (no look-alike characters such as 0/O or 1/I)
function newRegistrationId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return `REG-${new Date().getFullYear()}-${code}`;
}

const closed = (res) => res.status(409).json({ message: 'Event registration is closed.' });

exports.register = async (req, res, next) => {
  try {
    const { eventId } = req.body || {};
    if (!v.isObjectId(eventId)) return res.status(404).json({ message: 'Event not found.' });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (startsAt(event) <= new Date()) return closed(res);

    // Friendly early check. The unique index below is the real guarantee.
    const existing = await Registration.findOne({ student: req.user._id, event: event._id });
    if (existing) return res.status(409).json({ message: 'Already registered.', registrationId: existing.registrationId });

    // STEP 1: atomically claim one seat.
    // The "remainingSeats > 0" check and the decrement happen in ONE database operation, so
    // when 10 students click for the last seat, MongoDB lets exactly one of them through.
    const claimed = await Event.findOneAndUpdate(
      { _id: event._id, remainingSeats: { $gt: 0 } },
      { $inc: { remainingSeats: -1 } },
      { new: true }
    );
    if (!claimed) return closed(res);

    const releaseSeat = () => Event.updateOne({ _id: event._id }, { $inc: { remainingSeats: 1 } });

    // STEP 2: create the registration. If anything fails, give the seat back.
    let registration = null;
    try {
      for (let attempt = 0; attempt < 5 && !registration; attempt++) {
        try {
          registration = await Registration.create({
            registrationId: newRegistrationId(), student: req.user._id, event: event._id,
          });
        } catch (err) {
          const idCollision = err.code === 11000 && err.keyPattern && err.keyPattern.registrationId;
          if (!idCollision) throw err; // retry only if the random ID collided
        }
      }
      if (!registration) throw new Error('Could not generate a unique registration ID');
    } catch (err) {
      await releaseSeat();
      if (err.code === 11000) {
        // Same student sent two requests at once. The unique index blocked the second one.
        return res.status(409).json({ message: 'Already registered.' });
      }
      throw err;
    }

    await registration.populate('student', 'name studentId email');
    const freshEvent = present(claimed, { isRegistered: true, registrationId: registration.registrationId });
    res.status(201).json({
      message: 'Registration confirmed!',
      registration: { ...registration.toObject(), event: freshEvent },
      event: freshEvent,
    });
  } catch (err) { next(err); }
};

exports.myRegistrations = async (req, res, next) => {
  try {
    const regs = await Registration.find({ student: req.user._id }).populate('event').sort({ registeredAt: -1 }).lean();
    res.json({ registrations: regs.filter((r) => r.event).map((r) => ({ ...r, event: present(r.event) })) });
  } catch (err) { next(err); }
};

exports.getRegistration = async (req, res, next) => {
  try {
    const reg = await Registration.findOne({ registrationId: String(req.params.id) })
      .populate('student', 'name studentId email phone department')
      .populate('event')
      .lean();
    const notFound = () => res.status(404).json({ message: 'Registration not found.' });
    if (!reg || !reg.event) return notFound();

    const isOwner = req.user.role === 'student' && String(reg.student._id) === String(req.user._id);
    const isOrganizer = req.user.role === 'organizer' && String(reg.event.createdBy) === String(req.user._id);
    if (!isOwner && !isOrganizer) return notFound(); // don't reveal that it exists

    res.json({ registration: { ...reg, event: present(reg.event) } });
  } catch (err) { next(err); }
};
