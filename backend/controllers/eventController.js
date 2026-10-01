const Event = require('../models/Event');
const Registration = require('../models/Registration');
const v = require('../utils/validate');
const { present, startsAt } = require('../utils/eventHelpers');

const notFound = (res) => res.status(404).json({ message: 'Event not found.' });

// Validates and normalizes event form data. Returns { data } or { error }.
function parseEventBody(b) {
  const data = {
    title: v.str(b.title), category: v.str(b.category), date: v.str(b.date),
    time: v.str(b.time), venue: v.str(b.venue), description: v.str(b.description),
  };
  const seats = b.maxSeats;
  if (Object.values(data).some((x) => !x) || seats === undefined || seats === null || seats === '') {
    return { error: 'Please fill all required fields.' };
  }
  const maxSeats = Number(seats);
  if (!Number.isInteger(maxSeats) || maxSeats < 1) return { error: 'Maximum seat capacity must be at least 1.' };
  if (maxSeats > 100000) return { error: 'Maximum seat capacity is too large.' };
  if (!v.CATEGORIES.includes(data.category)) return { error: 'Please choose a valid category.' };
  if (!v.isDateStr(data.date)) return { error: 'Please enter a valid date.' };
  if (!v.isTime(data.time)) return { error: 'Please enter a valid time.' };
  if (data.title.length > 120 || data.venue.length > 150 || data.description.length > 2000) {
    return { error: 'One of the fields is too long. Please shorten it.' };
  }
  return { data: { ...data, maxSeats } };
}

// For a student, marks which of the given events they have already registered for.
async function registeredMap(user, eventIds) {
  const map = {};
  if (user && user.role === 'student' && eventIds.length) {
    const regs = await Registration.find({ student: user._id, event: { $in: eventIds } }).lean();
    regs.forEach((r) => { map[String(r.event)] = { isRegistered: true, registrationId: r.registrationId }; });
  }
  return map;
}

exports.createEvent = async (req, res, next) => {
  try {
    const { data, error } = parseEventBody(req.body || {});
    if (error) return res.status(400).json({ message: error });
    const fields = { ...data, date: new Date(data.date + 'T00:00:00Z') };
    if (startsAt(fields) <= new Date()) return res.status(400).json({ message: 'Event date and time must be in the future.' });

    const event = await Event.create({ ...fields, remainingSeats: data.maxSeats, createdBy: req.user._id });
    res.status(201).json({ message: 'Event created successfully!', event: present(event) });
  } catch (err) { next(err); }
};

exports.listEvents = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.mine === 'true') {
      if (!req.user || req.user.role !== 'organizer') return res.status(403).json({ message: 'You do not have permission to do that.' });
      filter.createdBy = req.user._id;
    }
    const events = await Event.find(filter).sort({ date: 1, time: 1 }).lean();
    const marks = await registeredMap(req.user, events.map((e) => e._id));
    res.json({ events: events.map((e) => present(e, marks[String(e._id)] || { isRegistered: false })) });
  } catch (err) { next(err); }
};

exports.getEvent = async (req, res, next) => {
  try {
    if (!v.isObjectId(req.params.id)) return notFound(res);
    const event = await Event.findById(req.params.id).lean();
    if (!event) return notFound(res);
    const marks = await registeredMap(req.user, [event._id]);
    res.json({ event: present(event, marks[String(event._id)] || { isRegistered: false }) });
  } catch (err) { next(err); }
};

exports.updateEvent = async (req, res, next) => {
  try {
    if (!v.isObjectId(req.params.id)) return notFound(res);
    const existing = await Event.findById(req.params.id);
    if (!existing || String(existing.createdBy) !== String(req.user._id)) return notFound(res);

    const current = { ...existing.toObject(), date: existing.date.toISOString().slice(0, 10) };
    const { data, error } = parseEventBody({ ...current, ...req.body });
    if (error) return res.status(400).json({ message: error });

    // Changing capacity shifts remainingSeats by the same amount. The filter guarantees it can
    // never drop below zero (i.e. capacity can't go lower than the students already registered).
    const delta = data.maxSeats - existing.maxSeats;
    const updated = await Event.findOneAndUpdate(
      { _id: existing._id, maxSeats: existing.maxSeats, remainingSeats: { $gte: Math.max(0, -delta) } },
      { $set: { ...data, date: new Date(data.date + 'T00:00:00Z') }, $inc: { remainingSeats: delta } },
      { new: true }
    );
    if (!updated) {
      const registered = existing.maxSeats - existing.remainingSeats;
      return res.status(409).json({ message: `Maximum seats cannot be lower than the ${registered} students already registered.` });
    }
    res.json({ message: 'Event updated successfully!', event: present(updated) });
  } catch (err) { next(err); }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    if (!v.isObjectId(req.params.id)) return notFound(res);
    const event = await Event.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!event) return notFound(res);
    await Registration.deleteMany({ event: event._id });
    await event.deleteOne();
    res.json({ message: 'Event deleted.' });
  } catch (err) { next(err); }
};

exports.eventRegistrations = async (req, res, next) => {
  try {
    if (!v.isObjectId(req.params.id)) return notFound(res);
    const event = await Event.findOne({ _id: req.params.id, createdBy: req.user._id }).lean();
    if (!event) return notFound(res);
    const registrations = await Registration.find({ event: event._id })
      .populate('student', 'name studentId email phone department')
      .sort({ registeredAt: -1 })
      .lean();
    res.json({ event: present(event), registrations });
  } catch (err) { next(err); }
};
