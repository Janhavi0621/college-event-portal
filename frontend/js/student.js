/* Student dashboard: discovery, filters, stats, quick register */
(function () {
  const { api, esc, toast, isoDay } = CE;
  const user = CE.requireRole('student');
  if (!user) return;
  CE.renderStudentBar();

  const $ = (id) => document.getElementById(id);
  const state = { events: [], regs: [] };

  $('welcome').textContent = 'Welcome, ' + user.name;

  const params = new URLSearchParams(location.search);
  $('categoryFilter').innerHTML = '<option value="">All categories</option>' + [...CE.CATEGORIES.map((c) => c[0]), 'Other'].map((c) => `<option>${c}</option>`).join('');
  if (params.get('category')) $('categoryFilter').value = params.get('category');

  function stats() {
    const upcoming = state.events.filter((e) => e.status !== 'Completed');
    $('statAvailable').textContent = upcoming.filter((e) => e.status === 'Open' && !e.isRegistered).length;
    $('statMine').textContent = state.regs.length;
    $('statUpcoming').textContent = upcoming.filter((e) => e.isRegistered).length;
    $('statPasses').textContent = state.regs.length;
  }

  function filtered() {
    const q = $('search').value.trim().toLowerCase();
    const cat = $('categoryFilter').value;
    const date = $('dateFilter').value;
    const avail = $('availFilter').value;
    return state.events.filter((e) => e.status !== 'Completed')
      .filter((e) => !q || e.title.toLowerCase().includes(q))
      .filter((e) => !cat || e.category === cat)
      .filter((e) => !date || isoDay(e.date) === date)
      .filter((e) => !avail || (avail === 'available' ? e.status === 'Open' : e.status === 'Full'));
  }

  function render() {
    stats();
    const list = filtered();
    const anyFilter = $('search').value || $('categoryFilter').value || $('dateFilter').value || $('availFilter').value;
    $('clearFilters').hidden = !anyFilter;
    $('resultCount').textContent = list.length === 1 ? '1 event found' : list.length + ' events found';
    if (!list.length) {
      $('eventGrid').innerHTML = anyFilter
        ? CE.emptyState('🔍', 'No events match your filters', 'Try a different search or clear the filters.')
        : CE.emptyState('📅', 'No upcoming events available.', 'New events are added regularly. Check back soon.');
      return;
    }
    $('eventGrid').innerHTML = list.map(CE.eventCard).join('');
  }

  async function load() {
    $('eventGrid').innerHTML = CE.skeletons(3);
    $('resultCount').textContent = 'Loading events...';
    try {
      const [ev, rg] = await Promise.all([api('/events'), api('/registrations/my')]);
      state.events = ev.events; state.regs = rg.registrations;
      render();
    } catch (err) {
      $('resultCount').textContent = '';
      $('eventGrid').innerHTML = CE.emptyState('⚠️', 'Could not load events', err.message, '<button class="btn btn-primary" id="retry">Try again</button>');
      const r = $('retry'); if (r) r.addEventListener('click', load);
    }
  }

  ['search', 'categoryFilter', 'dateFilter', 'availFilter'].forEach((id) => $(id).addEventListener('input', render));
  $('clearFilters').addEventListener('click', () => {
    ['search', 'categoryFilter', 'dateFilter', 'availFilter'].forEach((id) => ($(id).value = ''));
    render();
  });

  $('eventGrid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-register]');
    if (!btn) return;
    const event = state.events.find((x) => x._id === btn.dataset.register);
    const res = await CE.registerFor(event, btn);
    if (!res) return;
    if (res.registration) {
      // Update the seat count and button immediately from the server's fresh numbers.
      state.events = state.events.map((x) => (x._id === res.event._id ? res.event : x));
      state.regs.unshift(res.registration);
      render();
      CE.showPassModal(res.registration);
    } else {
      await load(); // e.g. someone took the last seat: refresh to show the real numbers
    }
  });

  load();
})();
