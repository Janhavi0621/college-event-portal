/* Digital pass, My Registrations page, and pass page */
(function () {
  const { api, esc, fmtDate, fmtLongDate, fmtTime, fmtStamp, session } = CE;

  // Decorative QR-style graphic, generated from the registration ID. It is NOT a scannable code
  // and nothing in the app depends on it.
  function qrSvg(seed) {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    const rnd = () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
    const N = 21; let cells = '';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const inFinder = (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
      if (!inFinder && rnd() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
    const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    return `<svg viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" fill="#0B1026" aria-hidden="true">${cells}${finder(0, 0)}${finder(N - 7, 0)}${finder(0, N - 7)}</svg>`;
  }

  function passHTML(r) {
    const e = r.event;
    const s = (r.student && r.student.name) ? r.student : (session.user || {});
    return `<div class="pass-stage"><div class="pass">
      <div class="pass-main">
        <div class="pass-top"><span>CAMPUS EVENTS</span><span class="pass-kind">EVENT ENTRY PASS</span></div>
        <h2 class="pass-title">${esc(e.title)}</h2>
        <span class="chip" data-cat="${esc(e.category)}">${esc(e.category)}</span>
        <dl class="pass-grid">
          <div><dt>Date</dt><dd>${fmtLongDate(e.date)}</dd></div>
          <div><dt>Time</dt><dd>${fmtTime(e.time)}</dd></div>
          <div><dt>Venue</dt><dd>${esc(e.venue)}</dd></div>
          <div><dt>Student name</dt><dd>${esc(s.name)}</dd></div>
          <div><dt>Student ID</dt><dd>${esc(s.studentId)}</dd></div>
          <div><dt>Registered on</dt><dd>${fmtStamp(r.registeredAt)}</dd></div>
        </dl>
      </div>
      <div class="pass-stub">
        ${qrSvg(r.registrationId)}
        <div><div class="pass-id-label">Registration ID</div><div class="pass-id">${esc(r.registrationId)}</div></div>
        <span class="status status-confirmed">${esc(r.status)}</span>
      </div></div></div>`;
  }

  function showPassModal(reg) {
    const m = CE.openModal(
      `<div class="pass-intro no-print"><h3>🎉 Your event pass is ready</h3><p>Show this pass at the venue entrance.</p></div>
       ${passHTML(reg)}
       <div class="pass-actions"><button class="btn btn-primary" data-print>Print Pass</button>
       <a class="btn btn-ghost" href="my-registrations.html">My Registrations</a>
       <button class="btn btn-ghost" data-close>Close</button></div>`, 'modal-wide');
    m.el.querySelector('[data-print]').addEventListener('click', () => window.print());
  }

  /* ---------- My Registrations ---------- */
  async function initMine() {
    if (!CE.requireRole('student')) return;
    CE.renderStudentBar();
    const list = document.getElementById('regList');
    list.innerHTML = CE.skeletons(3);
    try {
      const { registrations } = await api('/registrations/my');
      document.getElementById('regCount').textContent = registrations.length === 1 ? '1 event' : registrations.length + ' events';
      if (!registrations.length) {
        list.innerHTML = CE.emptyState('🎟️', "You haven't registered for any events yet.", 'Find something you like and your pass will show up here.',
          '<a class="btn btn-primary" href="student-dashboard.html">Explore events</a>');
        return;
      }
      list.innerHTML = registrations.map((r) => `
        <article class="reg-card">
          <div class="ec-top"><span class="chip" data-cat="${esc(r.event.category)}">${esc(r.event.category)}</span><span class="status status-confirmed">${esc(r.status)}</span></div>
          <h3>${esc(r.event.title)}</h3>
          <ul class="meta"><li><span class="ico">📅</span>${fmtDate(r.event.date)}, ${fmtTime(r.event.time)}</li><li><span class="ico">📍</span>${esc(r.event.venue)}</li></ul>
          <div class="reg-id">${esc(r.registrationId)}</div>
          <a class="btn btn-primary btn-sm" href="event-pass.html?id=${esc(r.registrationId)}">View Pass</a>
        </article>`).join('');
    } catch (err) {
      list.innerHTML = CE.emptyState('⚠️', 'Could not load your registrations', err.message, '<button class="btn btn-primary" onclick="location.reload()">Try again</button>');
    }
  }

  /* ---------- Pass page ---------- */
  async function initPassPage() {
    if (!CE.requireRole('student')) return;
    CE.renderStudentBar();
    const mount = document.getElementById('passMount');
    const id = new URLSearchParams(location.search).get('id');
    mount.innerHTML = '<p class="loading-note">Loading your pass...</p>';
    try {
      const { registration } = await api('/registrations/' + encodeURIComponent(id));
      mount.innerHTML = passHTML(registration) +
        `<div class="pass-actions"><button class="btn btn-primary" id="printBtn">Print Pass</button><a class="btn btn-ghost" href="my-registrations.html">All my registrations</a></div>`;
      document.getElementById('printBtn').addEventListener('click', () => window.print());
    } catch (err) {
      mount.innerHTML = CE.emptyState('🔍', 'Pass not found', 'We could not find that pass. It may belong to a different account.',
        '<a class="btn btn-primary" href="my-registrations.html">Go to My Registrations</a>');
    }
  }

  window.CE.showPassModal = showPassModal;
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('regList')) initMine();
    if (document.getElementById('passMount')) initPassPage();
  });
})();
