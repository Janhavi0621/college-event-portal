const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  studentId: { type: String, trim: true, uppercase: true, unique: true, sparse: true }, // students only
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  department: { type: String, trim: true, maxlength: 120 },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'organizer'], default: 'student' },
  createdAt: { type: Date, default: Date.now },
});

// Passwords are always hashed before saving. Plain text is never stored.
userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform: (doc, ret) => { delete ret.password; delete ret.__v; return ret; },
});

module.exports = mongoose.model('User', userSchema);
