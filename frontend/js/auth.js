/* Login + student registration pages */
(function () {
  const { api, session, toast, setBusy, homeFor } = CE;

  // Already logged in? Skip straight to the dashboard.
  if (session.token && session.user) { location.replace(homeFor(session.user)); return; }

  const params = new URLSearchParams(location.search);
  if (params.get('expired')) document.addEventListener('DOMContentLoaded', () => toast('Your session has expired. Please log in again.', 'warning'));

  // Show/hide password buttons
  document.querySelectorAll('.pw-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-pressed', show);
    });
  });

  const setError = (form, name, msg) => {
    const field = form.querySelector(`[name="${name}"]`).closest('.field');
    field.classList.toggle('invalid', !!msg);
    field.querySelector('.field-error').textContent = msg || '';
  };
  const clearErrors = (form) => {
    form.querySelectorAll('.field').forEach((f) => f.classList.remove('invalid'));
    form.querySelectorAll('.field-error').forEach((e) => (e.textContent = ''));
    const fe = form.querySelector('.form-error'); if (fe) fe.hidden = true;
  };
  const showFormError = (form, msg) => { const fe = form.querySelector('.form-error'); fe.textContent = msg; fe.hidden = false; };
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const phoneOk = (v) => /^\+?\d{10,13}$/.test(v.replace(/[\s-]/g, ''));

  function afterAuth(data) {
    session.save(data.token, data.user);
    const next = params.get('next');
    const safe = next && /^[\w-]+\.html(\?.*)?$/.test(next) && next.startsWith(data.user.role === 'organizer' ? 'organizer' : 'student') ? next : null;
    location.href = safe || homeFor(data.user);
  }

  /* ----- login ----- */
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(loginForm);
      const f = Object.fromEntries(new FormData(loginForm));
      let bad = false;
      if (!emailOk(f.email.trim())) { setError(loginForm, 'email', 'Please enter a valid email address.'); bad = true; }
      if (!f.password) { setError(loginForm, 'password', 'Please enter your password.'); bad = true; }
      if (bad) return;
      const btn = loginForm.querySelector('[type="submit"]');
      setBusy(btn, true, 'Logging in...');
      try {
        const data = await api('/auth/login', { method: 'POST', body: { email: f.email.trim(), password: f.password, role: f.role } });
        toast('Welcome back, ' + data.user.name.split(' ')[0] + '!', 'success');
        afterAuth(data);
      } catch (err) {
        showFormError(loginForm, err.message);
        setBusy(btn, false);
      }
    });
  }

  /* ----- student sign-up ----- */
  const regForm = document.getElementById('registerForm');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(regForm);
      const f = Object.fromEntries(new FormData(regForm));
      let bad = false;
      const need = (name, msg) => { if (!String(f[name] || '').trim()) { setError(regForm, name, msg); bad = true; return false; } return true; };
      need('name', 'Please enter your full name.');
      need('studentId', 'Please enter your Student ID.');
      if (need('email', 'Please enter your email address.') && !emailOk(f.email.trim())) { setError(regForm, 'email', 'Please enter a valid email address.'); bad = true; }
      if (need('phone', 'Please enter your phone number.') && !phoneOk(f.phone)) { setError(regForm, 'phone', 'Please enter a valid 10-digit phone number.'); bad = true; }
      need('department', 'Please enter your college or department.');
      if (need('password', 'Please create a password.') && !(f.password.length >= 8 && /[A-Za-z]/.test(f.password) && /\d/.test(f.password))) {
        setError(regForm, 'password', 'Use at least 8 characters with a letter and a number.'); bad = true;
      }
      if (need('confirmPassword', 'Please confirm your password.') && f.confirmPassword !== f.password) { setError(regForm, 'confirmPassword', 'Passwords do not match.'); bad = true; }
      if (bad) { const first = regForm.querySelector('.invalid input'); if (first) first.focus(); return; }

      const btn = regForm.querySelector('[type="submit"]');
      setBusy(btn, true, 'Creating account...');
      try {
        const data = await api('/auth/register', { method: 'POST', body: {
          name: f.name, studentId: f.studentId, email: f.email, phone: f.phone, department: f.department,
          password: f.password, confirmPassword: f.confirmPassword,
        } });
        toast('Account created successfully!', 'success');
        afterAuth(data);
      } catch (err) {
        showFormError(regForm, err.message);
        setBusy(btn, false);
      }
    });
  }
})();
