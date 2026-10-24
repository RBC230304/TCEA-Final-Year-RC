// Shared portal session/logout handler. Loaded by every authenticated dashboard.
// V10: logout controls remain visible and clickable at all times; navigation is guaranteed
// even when Supabase is slow or temporarily unavailable.
(() => {
  let busy = false;
  async function logout() {
    if (busy) return;
    busy = true;
    const buttons = [...document.querySelectorAll('[data-logout]')];
    buttons.forEach(btn => {
      btn.dataset.oldText = btn.textContent;
      btn.textContent = 'Signing out…';
      btn.setAttribute('aria-busy', 'true');
      // Do not disable the button: some browsers dim disabled controls and make the
      // official Sign out control appear invisible. The busy guard prevents duplicates.
    });
    try {
      if (window.sb?.auth) {
        await Promise.race([
          window.sb.auth.signOut(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
        ]);
      }
    } catch (e) {
      // Always navigate out so a network problem cannot trap the user in a session.
    } finally {
      location.replace('index.html');
    }
  }
  window.logout = logout;
  document.addEventListener('click', e => {
    const btn = e.target.closest?.('[data-logout]');
    if (btn) {
      e.preventDefault();
      logout();
    }
  });
})();
