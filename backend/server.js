require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const sanitize = require('./middleware/sanitize');
const errorHandler = require('./middleware/errorHandler');

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error('Missing MONGO_URI or JWT_SECRET. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = express();
const origins = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(origins.length ? { origin: origins } : {}));
app.use(express.json({ limit: '50kb' }));
app.use(sanitize);

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/registrations', require('./routes/registrationRoutes'));
app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint not found.' }));

// The backend also serves the frontend, so one command runs the whole app.
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    // Make sure the unique indexes (duplicate protection) exist before serving traffic.
    return Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  })
  .then(() => app.listen(PORT, () => console.log(`CampusEvents running at http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Could not start the server:', err.message);
    process.exit(1);
  });
