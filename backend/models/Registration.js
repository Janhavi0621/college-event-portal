const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  registrationId: { type: String, required: true, unique: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  status: { type: String, enum: ['CONFIRMED', 'CANCELLED'], default: 'CONFIRMED' },
  registeredAt: { type: Date, default: Date.now },
});

// Database-level guarantee: one student can register for one event only once.
registrationSchema.index({ student: 1, event: 1 }, { unique: true });
registrationSchema.index({ event: 1, registeredAt: -1 });

module.exports = mongoose.model('Registration', registrationSchema);
