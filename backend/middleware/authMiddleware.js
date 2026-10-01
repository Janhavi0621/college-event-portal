const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function loadUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  return User.findById(payload.id);
}

// Requires a valid token.
exports.protect = async (req, res, next) => {
  try {
    const user = await loadUser(req);
    if (!user) return res.status(401).json({ message: 'Please log in to continue.' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  }
};

// Attaches req.user when a valid token is present, but never blocks the request.
exports.optionalAuth = async (req, res, next) => {
  try { req.user = await loadUser(req); } catch (err) { req.user = null; }
  next();
};
