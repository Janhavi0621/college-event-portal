const jwt = require('jsonwebtoken');
const User = require('../models/User');
const v = require('../utils/validate');

const sign = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const bad = (res, message, status = 400) => res.status(status).json({ message });

exports.register = async (req, res, next) => {
  try {
    const b = req.body || {};
    const name = v.str(b.name);
    const studentId = v.str(b.studentId).toUpperCase();
    const email = v.str(b.email).toLowerCase();
    const phone = v.normPhone(b.phone);
    const department = v.str(b.department);
    const password = b.password;

    if (!name || !studentId || !email || !phone || !department || typeof password !== 'string' || !password) {
      return bad(res, 'Please fill all required fields.');
    }
    if (!v.isEmail(email)) return bad(res, 'Please enter a valid email address.');
    if (!v.isPhone(phone)) return bad(res, 'Please enter a valid phone number.');
    if (!v.isStrongPassword(password)) return bad(res, 'Password must be at least 8 characters and include a letter and a number.');
    if (b.confirmPassword !== undefined && b.confirmPassword !== password) return bad(res, 'Passwords do not match.');

    if (await User.exists({ email })) return bad(res, 'An account with this email already exists.', 409);
    if (await User.exists({ studentId })) return bad(res, 'This Student ID is already registered.', 409);

    // Public sign-up can only ever create students. Organizer accounts come from the seed script.
    const user = await User.create({ name, studentId, email, phone, department, password, role: 'student' });
    res.status(201).json({ message: 'Account created successfully!', token: sign(user), user });
  } catch (err) {
    if (err.code === 11000) return bad(res, 'An account with this email or Student ID already exists.', 409);
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const b = req.body || {};
    const email = v.str(b.email).toLowerCase();
    const password = b.password;
    if (!email || typeof password !== 'string' || !password) return bad(res, 'Please enter your email and password.');

    const user = await User.findOne({ email }).select('+password');
    // Same message for every failure so attackers can't discover which emails exist.
    const ok = user && (!b.role || user.role === b.role) && (await user.comparePassword(password));
    if (!ok) return bad(res, 'Invalid email or password.', 401);

    res.json({ message: 'Welcome back!', token: sign(user), user });
  } catch (err) { next(err); }
};

exports.me = (req, res) => res.json({ user: req.user });
