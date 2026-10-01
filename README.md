# CampusEvents: College Event Management & Registration Portal

A full-stack web app where organizers publish college events and students discover them, register while seats last, and receive a digital entry pass with a unique Registration ID.

## Features

**Students**
- Sign up and log in, then browse upcoming events
- Search by name, filter by category, date and availability
- See live seat counts, with FULL / Sold Out events locked
- Register with a confirmation dialog, and watch the seat count update instantly
- Get a digital entry pass (printable) and see all passes under My Registrations

**Organizers**
- Dashboard with total events, registrations, upcoming events and available seats
- Create, edit and delete events
- See registered / remaining seats and Open / Full / Completed status per event
- View each event's attendee list with search, sort and CSV export

**Under the hood**
- JWT login with role-based access (students and organizers cannot use each other's APIs)
- Atomic seat reservation, so the last seat can never be double-booked
- Duplicate registrations blocked by a unique database index
- Responsive UI (desktop, tablet, mobile), toasts, loading states and empty states

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | HTML, CSS (Grid, Flexbox, glassmorphism), vanilla JavaScript |
| Backend | Node.js, Express |
| Database | MongoDB with Mongoose |
| Auth & security | JWT, bcryptjs (a pure-JS bcrypt, so it installs without a compiler), CORS, input validation and NoSQL-operator sanitizing |

## Folder structure

```
college-event-portal/
├── backend/
│   ├── models/          User.js, Event.js, Registration.js
│   ├── controllers/     authController.js, eventController.js, registrationController.js
│   ├── routes/          authRoutes.js, eventRoutes.js, registrationRoutes.js
│   ├── middleware/      authMiddleware.js, roleMiddleware.js, sanitize.js, errorHandler.js
│   ├── utils/           validate.js, eventHelpers.js
│   ├── test/flow.js     end-to-end API checks (incl. the "last seat" race)
│   ├── seed.js          demo users + events
│   ├── server.js        also serves the frontend
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html  login.html  register.html
│   ├── student-dashboard.html  event-details.html  my-registrations.html  event-pass.html
│   ├── organizer-dashboard.html
│   ├── css/  style.css  dashboard.css  responsive.css
│   └── js/   config.js  common.js  auth.js  student.js  organizer.js  events.js  registrations.js
└── README.md
```

## Prerequisites

1. **Node.js 18 or newer**: https://nodejs.org (check with `node -v`)
2. **MongoDB**, either:
   - **Option A: Local.** Install MongoDB Community Server (https://www.mongodb.com/try/download/community) and make sure it is running (on most systems it starts automatically, or run `mongod`).
   - **Option B: Cloud (no install).** Create a free cluster on MongoDB Atlas (https://www.mongodb.com/atlas), add a database user, allow your IP address, click **Connect → Drivers** and copy the connection string.

## Setup

```bash
# 1. Go to the backend folder
cd college-event-portal/backend

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env          # on Windows: copy .env.example .env
```

Open `.env` and fill it in:

```
MONGO_URI=mongodb://127.0.0.1:27017/campusevents     # or your Atlas string
JWT_SECRET=any-long-random-string-you-make-up
PORT=5000
```

For Atlas, `MONGO_URI` looks like `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/campusevents`.

## Load the demo data

```bash
npm run seed
```

This **clears all events and registrations**, then creates the demo users and 8 sample events (CodeFest 2026, Hackathon 2026, Cultural Night, AI & Future Technology Workshop, Inter-College Sports Meet, a seminar, a tiny already-full chess tournament, and one completed event). Dates are generated relative to today, so events are always upcoming.

## Run the app

```bash
npm start          # or: npm run dev   (auto-restarts on file changes)
```

Open **http://localhost:5000**. The backend serves the frontend too, so one command runs everything.

*Hosting the frontend separately?* (for example with VS Code Live Server) Change `API_BASE` in `frontend/js/config.js` to `http://localhost:5000/api` and set `CLIENT_ORIGIN` in `.env` to the frontend's address.

## Demo accounts (created by `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Organizer | admin@campusevents.com | Admin@123 |
| Student | student@campusevents.com | Student@123 |

Three more students (aarav@, meera@, rohan@campusevents.com, same password as the student above) already fill the "Campus Chess Open" so you can see a **FULL** event.
These credentials exist only in `seed.js` and this README. They are not in any frontend code. Change them before any real deployment.

## Try the full flow

**Student:** Login (role: Student) → pick an event → **Register** → confirm → the seat count drops and your pass appears → **Print Pass** or open **My Registrations**.

**Organizer:** Login (role: Organizer) → **Create Event** → log in as a student and register → back in the organizer view, open **Registrations** and pick the event to see the student.

## Automated API check

With the server running and the database seeded:

```bash
npm run test:flow
```

It checks: invalid login, wrong role, missing fields, `maxSeats = 0`, role restrictions (student → organizer API and organizer → student API), duplicate registration, registering for a full event, and **six students racing for one seat** (exactly one must win and `remainingSeats` must end at exactly 0).

## API overview

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | public | Create a student account |
| POST | `/api/auth/login` | public | Log in (`email`, `password`, `role`) |
| GET | `/api/auth/me` | logged in | Current user |
| GET | `/api/events` | public (richer if logged in) | List events; `?mine=true` for an organizer's own |
| GET | `/api/events/:id` | public (richer if logged in) | One event |
| POST | `/api/events` | organizer | Create event |
| PUT | `/api/events/:id` | owner organizer | Edit event |
| DELETE | `/api/events/:id` | owner organizer | Delete event and its registrations |
| GET | `/api/events/:id/registrations` | owner organizer | Attendee list |
| POST | `/api/registrations` | student | Register (`{ "eventId": "..." }`) |
| GET | `/api/registrations/my` | student | My registrations |
| GET | `/api/registrations/:registrationId` | owner student or event organizer | One registration / pass |

Send the token as `Authorization: Bearer <token>`.

## Business rules

- A student can register for an event **once** (unique index on `student + event`).
- Registration needs a free seat. When `remainingSeats` is 0 the API answers **"Event registration is closed."** even if someone bypasses the UI.
- An event is **Completed** once its start time has passed, and registration closes then.
- Organizers can only see and manage **their own** events and attendees.
- Capacity can be edited, but never below the number of students already registered.
- Event dates must be in the future when created.
- Public sign-up always creates a **student**. Organizer accounts come from the seed script.

## How registration and capacity work

1. The API checks the event exists, has not started, and the student is not already registered.
2. **It claims a seat atomically.** One MongoDB call does `findOneAndUpdate({ _id, remainingSeats: { $gt: 0 } }, { $inc: { remainingSeats: -1 } })`. The "is a seat left?" check and the decrement happen in the same operation inside the database. If ten students click for the last seat, MongoDB lets exactly one update match; the other nine get "Event registration is closed." The count can never go negative, and there is no read-then-write gap.
3. It creates the `Registration` with a random ID such as `REG-2026-8F42K9` (the unique index on `registrationId` guards against collisions, with an automatic retry).
4. **If step 3 fails, the seat is given back** (`$inc: +1`), so a failed registration never leaks a seat.
5. If the same student sends two requests at the same instant, the unique `student + event` index rejects the second and the seat is returned.

This works on a standalone MongoDB without transactions (no replica set required).

## Notes and limitations

- The JWT is kept in `localStorage` for simplicity. It is fine for a college project, but a production deployment would use httpOnly cookies plus HTTPS.
- Event times are interpreted in the server's timezone.
- The QR-style graphic on the pass is decorative. It is generated from the Registration ID and is not a scannable code.
- There is no rate limiting or email verification. Add them (for example `express-rate-limit`) before going public.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Missing MONGO_URI or JWT_SECRET` | You have not created `backend/.env` (see Setup) |
| `ECONNREFUSED 127.0.0.1:27017` | MongoDB isn't running locally. Start it, or use Atlas |
| Atlas connection times out | Add your IP in Atlas → Network Access |
| Login says "Invalid email or password" | Choose the right role on the login page, and run `npm run seed` for the demo accounts |
| Port already in use | Change `PORT` in `.env` |
