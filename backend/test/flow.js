// End-to-end API check. Start the server (and run `npm run seed`) first, then:  npm run test:flow
// Needs Node 18+ (built-in fetch). Set BASE_URL to test a different address.
const BASE = process.env.BASE_URL || 'http://localhost:5000';
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`); };

async function call(method, path, body, token) {
  const res = await fetch(BASE + '/api' + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function newStudent(tag) {
  const stamp = Date.now() + '' + Math.floor(Math.random() * 1000);
  const r = await call('POST', '/auth/register', {
    name: 'Test ' + tag, studentId: 'T' + stamp, email: `t${stamp}@test.com`, phone: '9876543210',
    department: 'Testing', password: 'Passw0rd1', confirmPassword: 'Passw0rd1',
  });
  return r.data.token;
}

(async () => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const form = { title: 'Test Event', category: 'Technical', date: tomorrow, time: '10:00', venue: 'Lab', description: 'Testing', maxSeats: 1 };

  const admin = (await call('POST', '/auth/login', { email: 'admin@campusevents.com', password: 'Admin@123', role: 'organizer' })).data.token;
  check('Organizer can log in', !!admin);
  check('Invalid login rejected', (await call('POST', '/auth/login', { email: 'admin@campusevents.com', password: 'wrong', role: 'organizer' })).status === 401);
  check('Wrong role rejected', (await call('POST', '/auth/login', { email: 'admin@campusevents.com', password: 'Admin@123', role: 'student' })).status === 401);

  const missing = await call('POST', '/events', { ...form, venue: '' }, admin);
  check('Missing event fields rejected', missing.status === 400 && /required/.test(missing.data.message));
  const zero = await call('POST', '/events', { ...form, maxSeats: 0 }, admin);
  check('maxSeats = 0 rejected', zero.status === 400 && /at least 1/.test(zero.data.message));

  const created = await call('POST', '/events', form, admin);
  const ev = created.data.event;
  check('Organizer creates event (remainingSeats = maxSeats)', created.status === 201 && ev.remainingSeats === 1);

  const students = [];
  for (let i = 0; i < 6; i++) students.push(await newStudent(i));
  check('Students can sign up', students.every(Boolean));

  check('Student cannot create events', (await call('POST', '/events', form, students[0])).status === 403);
  check('Student cannot list attendees', (await call('GET', `/events/${ev._id}/registrations`, null, students[0])).status === 403);
  check('Organizer cannot register for events', (await call('POST', '/registrations', { eventId: ev._id }, admin)).status === 403);

  // Six students race for ONE seat.
  const race = await Promise.all(students.map((t) => call('POST', '/registrations', { eventId: ev._id }, t)));
  const wins = race.filter((r) => r.status === 201);
  const closed = race.filter((r) => r.status === 409 && r.data.message === 'Event registration is closed.');
  check('Only ONE of 6 simultaneous requests wins the last seat', wins.length === 1, `(got ${wins.length})`);
  check('The other 5 get "Event registration is closed."', closed.length === 5);

  const after = (await call('GET', `/events/${ev._id}`)).data.event;
  check('remainingSeats is exactly 0 (never negative)', after.remainingSeats === 0 && after.status === 'Full');

  const winnerIndex = race.findIndex((r) => r.status === 201);
  const dup = await call('POST', '/registrations', { eventId: ev._id }, students[winnerIndex]);
  check('Duplicate registration -> "Already registered."', dup.status === 409 && dup.data.message === 'Already registered.');

  const list = await call('GET', `/events/${ev._id}/registrations`, null, admin);
  check('Organizer sees exactly one attendee', list.data.registrations && list.data.registrations.length === 1);

  const mine = await call('GET', '/registrations/my', null, students[winnerIndex]);
  const regId = mine.data.registrations[0].registrationId;
  check('Registration ID has the REG-YYYY-XXXXXX format', /^REG-\d{4}-[A-Z2-9]{6}$/.test(regId), regId);
  check('Another student cannot open that pass', (await call('GET', `/registrations/${regId}`, null, students[(winnerIndex + 1) % 6])).status === 404);

  await call('DELETE', `/events/${ev._id}`, null, admin);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('Test run crashed (is the server running?)', e.message); process.exit(1); });
