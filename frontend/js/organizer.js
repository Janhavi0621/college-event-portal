/* Organizer dashboard: single page with hash-routed views */
(function () {
  const { api, esc, fmtDate, fmtTime, fmtStamp, toast, confirmDialog, setBusy, isoDay } = CE;
  const user = CE.requireRole('organizer');
  if (!user) return;

  const view = document.getElementById('view');
  const state = { events: [], regs: null, regsEventId: null };

  document.getElementById('orgName').textContent = user.name;
  document.getElementById('orgAvatar').textContent = CE.initials(user.name);
  document.getElementById('logoutBtn').addEventListener('click', CE.logout);

  const eventById = (id) => state.events.find((e) => e._id === id);
  const statusPill = (e) => `<span class="status status-${e.status.toLowerCase()}">${e.status}</span>`;
  const bar = (e) => {
    const used = Math.round((e.registered / e.maxSeats) * 100);
    return `<div class="seatbar ${e.remainingSeats > 0 && e.remainingSeats / e.maxSeats <= 0.1 ? 'low' : ''}"><i style="width:${used}%"></i></div>`;
  };

  async function loadEvents(force) {
    if (state.loaded && !force) return;
    state.events = (await api('/events?mine=true')).events;
    state.loaded = true;
  }

  const loading = (msg) => { view.innerHTML = `<p class="loading-note">${msg}</p>`; };
  const failed = (err) => { view.innerHTML = CE.emptyState('⚠️', 'Something went wrong', err.message, '<button class="btn btn-primary" onclick="location.reload()">Try again</button>'); };

  /* ---------- Dashboard ---------- */
  async function showDashboard() {
    loading('Loading events...');
    try { await loadEvents(true); } catch (e) { return failed(e); }
    const ev = state.events;
    const live = ev.filter((e) => e.status !== 'Completed');
    const totalRegs = ev.reduce((n, e) => n + e.registered, 0);
    const seatsLeft = live.reduce((n, e) => n + e.remainingSeats, 0);
    const next = live.slice(0, 5);
    view.innerHTML = `
      <div class="page-head"><div><h1>Dashboard</h1><p>A quick look at how your events are doing.</p></div>
        <a class="btn btn-primary" href="#create">Create Event</a></div>
      <div class="stats">
        <div class="stat" style="--c:96,140,255"><span class="stat-ico">📅</span><div><b>${ev.length}</b><span>Total Events</span></div></div>
        <div class="stat" style="--c:167,139,255"><span class="stat-ico">🎟️</span><div><b>${totalRegs}</b><span>Total Registrations</span></div></div>
        <div class="stat" style="--c:34,211,238"><span class="stat-ico">⏳</span><div><b>${live.length}</b><span>Upcoming Events</span></div></div>
        <div class="stat" style="--c:45,212,160"><span class="stat-ico">💺</span><div><b>${seatsLeft}</b><span>Available Seats</span></div></div>
      </div>
      <h2 style="font-size:1.3rem">Upcoming events</h2>
      <div class="card-list">${next.length ? next.map((e) => `
        <div class="mini-row"><div><h4>${esc(e.title)}</h4><small>${fmtDate(e.date)}, ${fmtTime(e.time)} at ${esc(e.venue)}</small></div>
          <div class="seat-col">${bar(e)}<small class="muted">${e.registered} registered, ${e.remainingSeats} left</small></div>
          <div style="display:flex;gap:.6rem;align-items:center">${statusPill(e)}<a class="btn btn-ghost btn-sm" href="#registrations/${e._id}">Attendees</a></div></div>`).join('')
        : CE.emptyState('📅', 'No upcoming events', 'Create your first event and students will be able to register right away.', '<a class="btn btn-primary" href="#create">Create Event</a>')}</div>`;
  }

  /* ---------- Create / edit ---------- */
  async function showForm(editId) {
    let ev = null;
    if (editId) {
      loading('Loading event...');
      try { await loadEvents(); } catch (e) { return failed(e); }
      ev = eventById(editId);
      if (!ev) { toast('Event not found.', 'error'); location.hash = '#events'; return; }
    }
    const today = new Date().toISOString().slice(0, 10);
    const val = (k) => (ev ? esc(k === 'date' ? isoDay(ev.date) : ev[k]) : '');
    view.innerHTML = `
      <div class="page-head"><div><h1>${ev ? 'Edit event' : 'Create event'}</h1><p>${ev ? 'Update the details students see.' : 'Fill in the details. The event goes live for students right away.'}</p></div></div>
      <form id="eventForm" class="panel form-card" novalidate>
        <div class="form-error" hidden></div>
        <div class="form-grid">
          <div class="field full"><label for="title">Event title <span class="req">*</span></label><input id="title" name="title" maxlength="120" placeholder="e.g. CodeFest 2026" value="${val('title')}"><p class="field-error"></p></div>
          <div class="field"><label for="category">Category <span class="req">*</span></label>
            <select id="category" name="category"><option value="">Choose a category</option>${[...CE.CATEGORIES.map((c) => c[0]), 'Other'].map((c) => `<option ${ev && ev.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select><p class="field-error"></p></div>
          <div class="field"><label for="maxSeats">Maximum seats <span class="req">*</span></label><input id="maxSeats" name="maxSeats" type="number" min="1" step="1" placeholder="e.g. 100" value="${val('maxSeats')}"><p class="field-error"></p>${ev ? `<p class="field-hint">${ev.registered} already registered.</p>` : ''}</div>
          <div class="field"><label for="date">Event date <span class="req">*</span></label><input id="date" name="date" type="date" ${ev ? '' : `min="${today}"`} value="${val('date')}"><p class="field-error"></p></div>
          <div class="field"><label for="time">Event time <span class="req">*</span></label><input id="time" name="time" type="time" value="${val('time')}"><p class="field-error"></p></div>
          <div class="field full"><label for="venue">Venue <span class="req">*</span></label><input id="venue" name="venue" maxlength="150" placeholder="e.g. Main Auditorium, Block A" value="${val('venue')}"><p class="field-error"></p></div>
          <div class="field full"><label for="description">Description <span class="req">*</span></label><textarea id="description" name="description" maxlength="2000" placeholder="What will students do, learn or see?">${val('description')}</textarea><p class="field-error"></p></div>
        </div>
        <div style="display:flex;gap:.7rem;flex-wrap:wrap"><button class="btn btn-primary" type="submit">${ev ? 'Save changes' : 'Create event'}</button><a class="btn btn-ghost" href="#events">Cancel</a></div>
      </form>`;

    const form = document.getElementById('eventForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      form.querySelectorAll('.field').forEach((f) => { f.classList.remove('invalid'); f.querySelector('.field-error').textContent = ''; });
      form.querySelector('.form-error').hidden = true;
      const f = Object.fromEntries(new FormData(form));
      const err = (name, msg) => { const fl = form.querySelector(`[name="${name}"]`).closest('.field'); fl.classList.add('invalid'); fl.querySelector('.field-error').textContent = msg; return true; };
      let bad = false;
      if (!f.title.trim()) bad = err('title', 'Please enter an event title.') || bad;
      if (!f.category) bad = err('category', 'Please choose a category.') || bad;
      if (!f.date) bad = err('date', 'Please choose a date.') || bad;
      if (!f.time) bad = err('time', 'Please choose a time.') || bad;
      if (!f.venue.trim()) bad = err('venue', 'Please enter the venue.') || bad;
      if (!f.description.trim()) bad = err('description', 'Please add a description.') || bad;
      if (f.maxSeats === '') bad = err('maxSeats', 'Please enter the maximum seats.') || bad;
      else if (!Number.isInteger(Number(f.maxSeats)) || Number(f.maxSeats) < 1) bad = err('maxSeats', 'Maximum seat capacity must be at least 1.') || bad;
      if (bad) { form.querySelector('.invalid input, .invalid select, .invalid textarea').focus(); return; }

      const btn = form.querySelector('[type="submit"]');
      setBusy(btn, true, ev ? 'Saving changes...' : 'Creating event...');
      try {
        await api(ev ? '/events/' + ev._id : '/events', { method: ev ? 'PUT' : 'POST', body: { ...f, maxSeats: Number(f.maxSeats) } });
        toast(ev ? 'Event updated successfully!' : 'Event created successfully!', 'success');
        state.loaded = false;
        location.hash = '#events';
      } catch (er) {
        const box = form.querySelector('.form-error'); box.textContent = er.message; box.hidden = false;
        setBusy(btn, false);
      }
    });
  }

  /* ---------- My events ---------- */
  async function showEvents() {
    loading('Loading events...');
    try { await loadEvents(true); } catch (e) { return failed(e); }
    const ev = state.events;
    view.innerHTML = `
      <div class="page-head"><div><h1>My events</h1><p>${ev.length} ${ev.length === 1 ? 'event' : 'events'} created by you.</p></div><a class="btn btn-primary" href="#create">Create Event</a></div>
      ${ev.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Event</th><th>Category</th><th>Date</th><th>Venue</th><th>Max seats</th><th>Registered</th><th>Remaining</th><th>Status</th><th></th></tr></thead><tbody>
      ${ev.map((e) => `<tr>
        <td data-label="Event"><strong>${esc(e.title)}</strong></td>
        <td data-label="Category"><span class="chip" data-cat="${esc(e.category)}">${esc(e.category)}</span></td>
        <td data-label="Date">${fmtDate(e.date)}, ${fmtTime(e.time)}</td>
        <td data-label="Venue">${esc(e.venue)}</td>
        <td data-label="Max seats">${e.maxSeats}</td>
        <td data-label="Registered">${e.registered}</td>
        <td data-label="Remaining">${e.remainingSeats}</td>
        <td data-label="Status">${statusPill(e)}</td>
        <td class="actions-cell"><div class="actions"><a class="btn btn-primary btn-sm" href="#registrations/${e._id}">View Registrations</a><a class="btn btn-ghost btn-sm" href="#edit/${e._id}">Edit</a><button class="btn btn-danger btn-sm" data-del="${e._id}">Delete</button></div></td></tr>`).join('')}
      </tbody></table></div>`
      : CE.emptyState('📅', "You haven't created any events yet.", 'Create an event and students can start registering straight away.', '<a class="btn btn-primary" href="#create">Create Event</a>')}`;
  }

  view.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    const ev = eventById(del.dataset.del);
    const ok = await confirmDialog({ title: 'Delete "' + ev.title + '"?', message: ev.registered ? `This also removes ${ev.registered} student registration${ev.registered === 1 ? '' : 's'}. This cannot be undone.` : 'This cannot be undone.', confirmText: 'Delete event', danger: true });
    if (!ok) return;
    setBusy(del, true, 'Deleting...');
    try { await api('/events/' + ev._id, { method: 'DELETE' }); toast('Event deleted.', 'success'); showEvents(); }
    catch (er) { toast(er.message, 'error'); setBusy(del, false); }
  });

  /* ---------- Registrations ---------- */
  async function showRegistrations(eventId) {
    loading('Loading registrations...');
    try { await loadEvents(true); } catch (e) { return failed(e); }
    const events = state.events;
    if (!events.length) {
      view.innerHTML = `<div class="page-head"><div><h1>Registrations</h1></div></div>` + CE.emptyState('👥', 'No events yet', 'Create an event to start collecting registrations.', '<a class="btn btn-primary" href="#create">Create Event</a>');
      return;
    }
    const id = eventId && eventById(eventId) ? eventId : events[0]._id;
    view.innerHTML = `
      <div class="page-head"><div><h1>Registrations</h1><p>See who has registered for each event.</p></div></div>
      <div class="field" style="max-width:480px"><label for="evPick">Event</label>
        <select id="evPick">${events.map((e) => `<option value="${e._id}" ${e._id === id ? 'selected' : ''}>${esc(e.title)} (${e.registered} registered)</option>`).join('')}</select></div>
      <div id="regBody"><p class="loading-note">Loading registrations...</p></div>`;
    document.getElementById('evPick').addEventListener('change', (e) => { location.hash = '#registrations/' + e.target.value; });

    let data;
    try { data = await api(`/events/${id}/registrations`); }
    catch (er) { document.getElementById('regBody').innerHTML = CE.emptyState('⚠️', 'Could not load registrations', er.message); return; }

    const { event, registrations } = data;
    const body = document.getElementById('regBody');
    body.innerHTML = `
      <div class="summary-strip">
        <div><b>${event.registered}</b><span>Registered</span></div><div><b>${event.remainingSeats}</b><span>Seats left</span></div>
        <div><b>${event.maxSeats}</b><span>Capacity</span></div><div style="align-self:center">${statusPill(event)}</div></div>
      ${registrations.length ? `
      <div class="table-tools">
        <div class="search-wrap"><input class="input" id="stuSearch" type="search" placeholder="Search by name, ID, email or department" aria-label="Search students"></div>
        <select class="input" id="stuSort" aria-label="Sort students"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="name">Name A to Z</option><option value="sid">Student ID</option></select>
        <button class="btn btn-ghost" id="csvBtn">Export CSV</button><span></span></div>
      <div class="table-wrap"><table class="data"><thead><tr><th>Registration ID</th><th>Student name</th><th>Student ID</th><th>Email</th><th>Phone</th><th>Department</th><th>Registered on</th></tr></thead><tbody id="stuRows"></tbody></table></div>
      <p class="result-count" id="stuCount" style="margin-top:.8rem"></p>`
      : CE.emptyState('👥', 'No students registered for this event.', 'Registrations will appear here as soon as students sign up.')}`;
    if (!registrations.length) return;

    const rows = document.getElementById('stuRows');
    const draw = () => {
      const q = document.getElementById('stuSearch').value.trim().toLowerCase();
      const sort = document.getElementById('stuSort').value;
      const list = registrations.filter((r) => !q || [r.student.name, r.student.studentId, r.student.email, r.student.department, r.registrationId].join(' ').toLowerCase().includes(q));
      list.sort((a, b) => sort === 'name' ? a.student.name.localeCompare(b.student.name) : sort === 'sid' ? String(a.student.studentId).localeCompare(String(b.student.studentId)) : sort === 'old' ? new Date(a.registeredAt) - new Date(b.registeredAt) : new Date(b.registeredAt) - new Date(a.registeredAt));
      rows.innerHTML = list.length ? list.map((r) => `<tr>
        <td data-label="Registration ID" class="mono">${esc(r.registrationId)}</td><td data-label="Name"><strong>${esc(r.student.name)}</strong></td>
        <td data-label="Student ID">${esc(r.student.studentId)}</td><td data-label="Email">${esc(r.student.email)}</td><td data-label="Phone">${esc(r.student.phone)}</td>
        <td data-label="Department">${esc(r.student.department)}</td><td data-label="Registered">${fmtStamp(r.registeredAt)}</td></tr>`).join('')
        : '<tr><td colspan="7" style="text-align:center;color:var(--muted)">No students match your search.</td></tr>';
      document.getElementById('stuCount').textContent = `Showing ${list.length} of ${registrations.length}`;
    };
    document.getElementById('stuSearch').addEventListener('input', draw);
    document.getElementById('stuSort').addEventListener('change', draw);
    document.getElementById('csvBtn').addEventListener('click', () => {
      const cell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const csv = [['Registration ID', 'Name', 'Student ID', 'Email', 'Phone', 'Department', 'Registered on']].concat(
        registrations.map((r) => [r.registrationId, r.student.name, r.student.studentId, r.student.email, r.student.phone, r.student.department, new Date(r.registeredAt).toISOString()])
      ).map((row) => row.map(cell).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = event.title.replace(/[^\w]+/g, '-').toLowerCase() + '-registrations.csv';
      a.click(); URL.revokeObjectURL(a.href);
    });
    draw();
  }

  /* ---------- router ---------- */
  function route() {
    const [name, arg] = (location.hash.slice(1) || 'dashboard').split('/');
    document.querySelectorAll('.side nav a').forEach((a) => {
      const t = a.getAttribute('href').slice(1);
      a.classList.toggle('active', t === name || (name === 'edit' && t === 'events'));
    });
    window.scrollTo(0, 0);
    if (name === 'create') showForm();
    else if (name === 'edit') showForm(arg);
    else if (name === 'events') showEvents();
    else if (name === 'registrations') showRegistrations(arg);
    else showDashboard();
  }
  window.addEventListener('hashchange', route);
  route();
})();
