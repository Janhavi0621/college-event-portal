const mongoose = require('mongoose');
const { CATEGORIES } = require('../utils/validate');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true, enum: CATEGORIES },
  date: { type: Date, required: true }, // stored as midnight UTC of the event day
  time: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }, // "HH:MM" 24h
  venue: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  maxSeats: { type: Number, required: true, min: 1, validate: Number.isInteger },
  remainingSeats: { type: Number, required: true, min: 0 }, // never allowed to go below 0
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

eventSchema.index({ date: 1, time: 1 });

module.exports = mongoose.model('Event', eventSchema);
