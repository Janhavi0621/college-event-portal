/* Event cards, registration action, and the event details page */
(function () {
  const { api, esc, fmtDate, fmtLongDate, fmtTime, toast, confirmDialog, setBusy } = CE;

  const seatText = (e) => (e.status === 'Completed' ? 'Event ended' : e.remainingSeats <= 0 ? 'FULL' : `${e.remainingSeats} ${e.remainingSeats === 1 ? 'seat' : 'seats'} left`);
  const isLow = (e) => e.remainingSeats > 0 && (e.remainingSeats <= 5 || e.remainingSeats / e.maxSeats <= 0.1);

  function actionButton(e, big = false) {
    const size = big ? 'btn-lg btn-block' : 'btn-sm';
    if (e.isRegistered) return `<a class="btn btn-success ${size}" href="event-pass.html?id=${esc(e.registrationId)}">View Pass</a>`;
    if (e.status === 'Completed') return `<button class="btn btn-ghost ${size}" disabled>Event completed</button>`;
    if (e.status === 'Full') return `<button class="btn btn-ghost ${size}" disabled>Sold Out</button>`;
    return `<button class="btn btn-primary ${size}" data-register="${esc(e._id)}">${big ? 'Register for Event' : 'Register'}</button>`;
  }

  function seatBlock(e) {
    const used = e.maxSeats ? Math.round((e.registered / e.maxSeats) * 100) : 0;
    return `<div class="seatbar ${isLow(e) ? 'low' : ''}" role="progressbar" aria-valuenow="${used}" aria-valuemin="0" aria-valuemax="100" aria-label="Seats filled"><i style="width:${used}%"></i></div>
      <div class="seat-row"><span>${e.remainingSeats <= 0 && e.status !== 'Completed' ? '<span class="full-label">FULL</span>' : `<strong>${esc(seatText(e))}</strong>`}</span><span>of ${e.maxSeats} seats</span></div>`;
  }

  function eventCard(e) {
    const link = `event-details.html?id=${esc(e._id)}`;
    return `<article class="event-card" data-id="${esc(e._id)}">
      <div class="ec-top"><span class="chip" data-cat="${esc(e.category)}">${esc(e.category)}</span>
        <span class="status status-${e.isRegistered ? 'confirmed' : e.status.toLowerCase()}">${esc(e.isRegistered ? 'Registered' : e.status)}</span></div>
      <h3><a href="${link}">${esc(e.title)}</a></h3>
      <ul class="meta">
        <li><span class="ico">📅</span>${fmtDate(e.date)}</li>
        <li><span class="ico">🕒</span>${fmtTime(e.time)}</li>
        <li><span class="ico">📍</span>${esc(e.venue)}</li>
      </ul>
      <p class="desc">${esc(e.description)}</p>
      ${seatBlock(e)}
      <div class="ec-actions"><a class="btn btn-ghost btn-sm" href="${link}">Details</a>${actionButton(e)}</div>
    </article>`;
  }

  // Confirm -> POST /registrations. Returns the API response on success, or null if cancelled/failed.
  async function registerFor(event, btn) {
    const ok = await confirmDialog({ title: event.title, message: 'Do you want to register for this event?', confirmText: 'Yes, register me' });
    if (!ok) return null;
    setBusy(btn, true, 'Registering...');
    try {
      const res = await api('/registrations', { method: 'POST', body: { eventId: event._id } });
      toast('Registration confirmed!', 'success', { label: 'View Pass', href: 'event-pass.html?id=' + res.registration.registrationId });
      return res;
    } catch (err) {
      toast(err.message, err.message === 'Already registered.' ? 'warning' : 'error');
      setBusy(btn, false);
      return { error: err };
    }
  }

  /* ---------- details page ---------- */
  async function initDetails() {
    const mount = document.getElementById('eventDetail');
    if (!CE.requireRole('student')) return;
    CE.renderStudentBar();
    const id = new URLSearchParams(location.search).get('id');
    mount.innerHTML = '<p class="loading-note">Loading event...</p>';

    let event;
    async function load() {
      try { event = (await api('/events/' + encodeURIComponent(id))).event; render(); }
      catch (err) {
        mount.innerHTML = CE.emptyState('🔍', 'Event not found', err.message === 'Event not found.' ? 'This event may have been removed.' : err.message,
          '<a class="btn btn-primary" href="student-dashboard.html">Back to events</a>');
      }
    }
    function render() {
      document.title = event.title + ' · CampusEvents';
      mount.innerHTML = `
        <a class="back-link" href="student-dashboard.html">← Back to events</a>
        <div class="detail-banner"><span class="chip" data-cat="${esc(event.category)}">${esc(event.category)}</span>
          <h1>${esc(event.title)}</h1></div>
        <div class="detail">
          <div class="panel">
            <dl class="info-grid">
              <div><dt>Date</dt><dd>${fmtLongDate(event.date)}</dd></div>
              <div><dt>Time</dt><dd>${fmtTime(event.time)}</dd></div>
              <div><dt>Venue</dt><dd>${esc(event.venue)}</dd></div>
              <div><dt>Maximum capacity</dt><dd>${event.maxSeats} seats</dd></div>
            </dl>
            <h3>About this event</h3>
            <p class="muted" style="white-space:pre-line">${esc(event.description)}</p>
          </div>
          <aside class="panel" id="regPanel">
            <p class="muted" style="margin-bottom:.3rem">Seats remaining</p>
            <div class="big-seats">${event.remainingSeats <= 0 ? 'FULL' : event.remainingSeats}</div>
            <div style="margin:1rem 0 1.3rem">${seatBlock(event).replace(/<div class="seat-row">[\s\S]*$/, '')}</div>
            ${event.isRegistered ? '<p class="status status-confirmed" style="margin-bottom:1rem">You are registered</p>' : ''}
            ${actionButton(event, true)}
          </aside>
        </div>`;
    }
    mount.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-register]');
      if (!btn) return;
      const res = await registerFor(event, btn);
      if (!res) return;
      if (res.registration) { event = res.event; render(); CE.showPassModal(res.registration); }
      else await load(); // failed: refresh so seat info is current
    });
    load();
  }

  window.CE.eventCard = eventCard;
  window.CE.registerFor = registerFor;
  if (document.getElementById('eventDetail')) document.addEventListener('DOMContentLoaded', initDetails);
})();
