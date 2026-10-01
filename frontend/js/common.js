/* CampusEvents shared helpers: API client, session, toasts, dialogs, navigation */
(function () {
  'use strict';
  const API = window.API_BASE || '/api';

  /* ---------- session (JWT kept in localStorage) ---------- */
  const session = {
    get token() { try { return localStorage.getItem('ce_token'); } catch (e) { return null; } },
    get user() { try { return JSON.parse(localStorage.getItem('ce_user')); } catch (e) { return null; } },
    save(token, user) { localStorage.setItem('ce_token', token); localStorage.setItem('ce_user', JSON.stringify(user)); },
    clear() { try { localStorage.removeItem('ce_token'); localStorage.removeItem('ce_user'); } catch (e) { /* ignore */ } },
  };

  /* ---------- API client ---------- */
  async function api(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (session.token) headers.Authorization = 'Bearer ' + session.token;
    let res;
    try {
      res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw Object.assign(new Error('Cannot reach the server. Check your connection and try again.'), { status: 0, data: {} });
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      if (res.status === 401 && session.token && !path.startsWith('/auth/')) {
        session.clear();
        location.href = 'login.html?expired=1';
      }
      throw Object.assign(new Error(data.message || 'Something went wrong. Please try again.'), { status: res.status, data });
    }
    return data;
  }

  /* ---------- formatting ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const fmtLongDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const fmtTime = (t) => { const [h, m] = String(t).split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
  const fmtStamp = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
  const initials = (n) => (n || '?').trim().charAt(0).toUpperCase();
  const CATEGORIES = [
    ['Technical', '💻', 'Hackathons, coding contests and tech talks'],
    ['Cultural', '🎭', 'Music, dance, theatre and fests'],
    ['Workshop', '🛠️', 'Hands-on sessions to learn by doing'],
    ['Sports', '🏅', 'Tournaments and inter-college meets'],
    ['Competition', '🏆', 'Contests with prizes and bragging rights'],
    ['Seminar', '🎤', 'Talks from alumni and industry experts'],
  ];

  /* ---------- toasts ---------- */
  const ICONS = { success: '✓', error: '!', warning: '!', info: 'i' };
  function toast(message, type = 'info', action) {
    let wrap = document.getElementById('toasts');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toasts'; wrap.className = 'toasts no-print'; wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.innerHTML = `<span class="toast-ico">${ICONS[type] || 'i'}</span><span>${esc(message)}</span>` +
      (action ? `<a href="${esc(action.href)}">${esc(action.label)}</a>` : '');
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, action ? 6500 : 4200);
  }

  /* ---------- modals ---------- */
  function openModal(html, cls = '') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');
    const close = () => { overlay.remove(); document.body.classList.remove('modal-open'); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) close(); });
    return { el: overlay, close };
  }

  function confirmDialog({ title = 'Are you sure?', message = '', confirmText = 'Confirm', danger = false } = {}) {
    return new Promise((resolve) => {
      const m = openModal(
        `<h3>${esc(title)}</h3><p class="muted">${esc(message)}</p>
         <div class="modal-actions"><button class="btn btn-ghost" data-no>Cancel</button>
         <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(confirmText)}</button></div>`, 'modal-sm');
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; m.close(); resolve(v); } };
      m.el.querySelector('[data-yes]').addEventListener('click', () => done(true));
      m.el.querySelector('[data-no]').addEventListener('click', () => done(false));
      m.el.addEventListener('click', (e) => { if (e.target === m.el) done(false); });
      document.addEventListener('keydown', function esc_(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', esc_); done(false); } });
      m.el.querySelector('[data-yes]').focus();
    });
  }

  /* ---------- buttons ---------- */
  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) {
      btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.classList.add('loading');
      if (label) btn.textContent = label;
    } else {
      btn.disabled = false; btn.classList.remove('loading');
      if (btn.dataset.html !== undefined) { btn.innerHTML = btn.dataset.html; delete btn.dataset.html; }
    }
  }

  /* ---------- auth guards & navigation ---------- */
  const homeFor = (u) => (u && u.role === 'organizer' ? 'organizer-dashboard.html' : 'student-dashboard.html');
  function requireRole(role) {
    const u = session.user;
    if (!session.token || !u) {
      location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search));
      return null;
    }
    if (u.role !== role) { location.replace(homeFor(u)); return null; }
    return u;
  }
  function logout() { session.clear(); location.href = 'index.html'; }

  function initPublicNav() {
    const nav = document.getElementById('navLinks');
    const toggle = document.querySelector('.nav-toggle');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open);
      });
      nav.addEventListener('click', (e) => { if (e.target.closest('a')) nav.classList.remove('open'); });
    }
    const u = session.user;
    if (u && session.token && nav) {
      const login = nav.querySelector('[data-nav="login"]');
      const reg = nav.querySelector('[data-nav="register"]');
      if (login) { login.textContent = 'My Dashboard'; login.href = homeFor(u); }
      if (reg) { reg.textContent = 'Logout'; reg.href = '#'; reg.className = 'btn btn-sm btn-ghost'; reg.addEventListener('click', (e) => { e.preventDefault(); logout(); }); }
    }
  }

  // Top bar for student pages. Usage: <div id="appbar" data-active="dash"></div>
  function renderStudentBar() {
    const host = document.getElementById('appbar');
    if (!host) return;
    const u = session.user || {};
    const active = host.dataset.active;
    host.outerHTML = `<header class="appbar no-print">
      <a class="logo" href="student-dashboard.html"><span class="logo-mark"></span>CampusEvents</a>
      <nav class="app-links">
        <a href="student-dashboard.html" class="${active === 'dash' ? 'active' : ''}">Explore Events</a>
        <a href="my-registrations.html" class="${active === 'regs' ? 'active' : ''}">My Registrations</a>
      </nav>
      <div class="user-chip"><span class="avatar" aria-hidden="true">${esc(initials(u.name))}</span>
        <span class="uname">${esc(u.name || '')}</span>
        <button class="btn btn-ghost btn-sm" id="logoutBtn">Logout</button></div>
    </header>`;
    document.getElementById('logoutBtn').addEventListener('click', logout);
  }

  const skeletons = (n = 3) => Array.from({ length: n }, () => '<div class="skeleton"></div>').join('');
  const emptyState = (icon, title, text, actionHtml = '') =>
    `<div class="empty"><div class="empty-ico">${icon}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${actionHtml}</div>`;

  window.CE = { api, session, esc, fmtDate, fmtLongDate, fmtTime, fmtStamp, isoDay, initials, CATEGORIES, toast, openModal, confirmDialog, setBusy, homeFor, requireRole, logout, initPublicNav, renderStudentBar, skeletons, emptyState };
  document.addEventListener('DOMContentLoaded', () => { initPublicNav(); });
})();
