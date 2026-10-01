// Fills the database with demo users and events.  Run:  npm run seed
// WARNING: this clears all existing events and registrations (and re-creates the demo users).
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Event = require('./models/Event');
const Registration = require('./models/Registration');

const DEMO_PASSWORDS = { organizer: 'Admin@123', student: 'Student@123' };

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Date(d.toISOString().slice(0, 10) + 'T00:00:00Z');
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([Event.deleteMany({}), Registration.deleteMany({})]);

  const extraEmails = ['aarav@campusevents.com', 'meera@campusevents.com', 'rohan@campusevents.com'];
  await User.deleteMany({ email: { $in: ['admin@campusevents.com', 'student@campusevents.com', ...extraEmails] } });

  const admin = await User.create({
    name: 'Campus Admin', email: 'admin@campusevents.com', phone: '9000000001',
    department: 'Student Affairs', password: DEMO_PASSWORDS.organizer, role: 'organizer',
  });
  await User.create({
    name: 'Demo Student', studentId: 'STU2026001', email: 'student@campusevents.com', phone: '9876543210',
    department: 'Computer Science', password: DEMO_PASSWORDS.student, role: 'student',
  });
  const others = [];
  const people = [['Aarav Sharma', 'STU2026002', 'Electronics'], ['Meera Iyer', 'STU2026003', 'Information Technology'], ['Rohan Patil', 'STU2026004', 'Mechanical']];
  for (let i = 0; i < people.length; i++) {
    others.push(await User.create({
      name: people[i][0], studentId: people[i][1], email: extraEmails[i], phone: `98000000${10 + i}`,
      department: people[i][2], password: DEMO_PASSWORDS.student, role: 'student',
    }));
  }

  const make = (title, category, offset, time, venue, description, maxSeats) => ({
    title, category, date: day(offset), time, venue, description, maxSeats, remainingSeats: maxSeats, createdBy: admin._id,
  });

  const events = await Event.insertMany([
    make('CodeFest 2026', 'Technical', 12, '10:00', 'Main Auditorium, Block A',
      'A full day of coding contests, live problem solving and tech talks by industry engineers. Open to every branch, from first-years to final-years.', 150),
    make('Hackathon 2026', 'Competition', 20, '09:00', 'Innovation Lab, Block C',
      'Build a working prototype in 24 hours. Teams of up to four compete for cash prizes and internship interviews with our partner companies.', 80),
    make('Cultural Night', 'Cultural', 8, '18:30', 'Open Air Theatre',
      'An evening of dance, music, stand-up and theatre performed by students from every department. Food stalls open from 5 PM.', 500),
    make('AI & Future Technology Workshop', 'Workshop', 15, '14:00', 'Seminar Hall 2, Block B',
      'A hands-on workshop on building small machine learning models and using AI tools responsibly. Bring a laptop; no prior experience needed.', 40),
    make('Inter-College Sports Meet', 'Sports', 25, '08:00', 'University Sports Ground',
      'Athletics, cricket, football and badminton with teams from 12 colleges. Register to attend as a spectator or volunteer.', 200),
    make('Careers in Cloud Computing', 'Seminar', 5, '11:00', 'Conference Room, Library Building',
      'Two alumni working at cloud companies walk through career paths, certifications and how to prepare for interviews.', 100),
    make('Campus Chess Open', 'Competition', 10, '15:00', 'Indoor Games Room',
      'A rapid-format chess tournament with a small field of players. This event is intentionally full so you can see how sold-out events behave.', 3),
    make("Freshers' Welcome 2026", 'Cultural', -20, '16:00', 'Main Auditorium, Block A',
      'The welcome event for the new batch. This one has already taken place and shows how completed events are displayed.', 300),
  ]);

  // Fill the chess event with the three other students so it shows as FULL.
  const chess = events.find((e) => e.title === 'Campus Chess Open');
  const codefest = events.find((e) => e.title === 'CodeFest 2026');
  const seatsTaken = new Map();
  const book = async (student, event, n) => {
    await Registration.create({ registrationId: `REG-${new Date().getFullYear()}-SEED${String(n).padStart(2, '0')}`, student: student._id, event: event._id });
    seatsTaken.set(String(event._id), (seatsTaken.get(String(event._id)) || 0) + 1);
  };
  let n = 1;
  for (const s of others) await book(s, chess, n++);
  await book(others[0], codefest, n++);
  await book(others[1], codefest, n++);
  for (const [id, taken] of seatsTaken) await Event.updateOne({ _id: id }, { $inc: { remainingSeats: -taken } });

  console.log('Seed complete.');
  console.log(`  ${events.length} events, 5 users`);
  console.log('  Organizer: admin@campusevents.com   / Admin@123');
  console.log('  Student:   student@campusevents.com / Student@123');
  await mongoose.disconnect();
}

run().catch((err) => { console.error('Seed failed:', err.message); process.exit(1); });
