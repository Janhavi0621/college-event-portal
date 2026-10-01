// An event's start moment (event date + time, in the server's local timezone).
const startsAt = (e) => new Date(`${new Date(e.date).toISOString().slice(0, 10)}T${e.time}:00`);

// Adds computed fields (registered count, status) to an event before sending it to the client.
// Status: Completed (start time has passed) > Full (no seats left) > Open.
const present = (doc, extra = {}) => {
  const e = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const registered = e.maxSeats - e.remainingSeats;
  const status = startsAt(e) <= new Date() ? 'Completed' : e.remainingSeats <= 0 ? 'Full' : 'Open';
  return { ...e, registered, status, registrationOpen: status === 'Open', ...extra };
};

module.exports = { startsAt, present };
