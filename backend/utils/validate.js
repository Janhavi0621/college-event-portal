const mongoose = require('mongoose');

const CATEGORIES = ['Technical', 'Cultural', 'Workshop', 'Sports', 'Competition', 'Seminar', 'Other'];

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const normPhone = (v) => String(v || '').replace(/[\s-]/g, '');
const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const isPhone = (v) => /^\+?\d{10,13}$/.test(normPhone(v));
const isStrongPassword = (v) => typeof v === 'string' && v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v);
const isObjectId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id) && mongoose.Types.ObjectId.isValid(id);
const isDateStr = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00:00Z'));
const isTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

module.exports = { CATEGORIES, str, normPhone, isEmail, isPhone, isStrongPassword, isObjectId, isDateStr, isTime };
