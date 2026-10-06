(function () {
  var root = document.documentElement;
  root.classList.add('js');

  /* ---------- Menu ---------- */
  var menuBtn = document.getElementById('menu-btn');
  var menu = document.getElementById('menu');
  var main = document.getElementById('main');

  function openMenu() {
    menu.hidden = false;
    requestAnimationFrame(function () { menu.classList.add('is-open'); });
    root.classList.add('menu-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    main.inert = true;
    document.body.style.overflow = 'hidden';
    var first = menu.querySelector('a');
    if (first) first.focus();
  }

  function closeMenu(returnFocus) {
    menu.classList.remove('is-open');
    root.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    main.inert = false;
    document.body.style.overflow = '';
    setTimeout(function () { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 300);
    if (returnFocus) menuBtn.focus();
  }

  menuBtn.addEventListener('click', function () {
    menuBtn.getAttribute('aria-expanded') === 'true' ? closeMenu(true) : openMenu();
  });

  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) closeMenu(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') closeMenu(true);
  });

  /* ---------- RSVP dialog ---------- */
  var dialog = document.getElementById('rsvp-dialog');

  document.querySelectorAll('[data-rsvp]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (menuBtn.getAttribute('aria-expanded') === 'true') closeMenu(false);
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    });
  });

  dialog.querySelector('[data-close]').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); }); /* click on the backdrop */

  /* ---------- Plain text view ---------- */
  var toggle = document.getElementById('plain-toggle');

  function setPlain(on) {
    root.classList.toggle('plain', on);
    toggle.textContent = on ? 'Styled view' : 'Plain text';
    toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    try { localStorage.setItem('evergarden-view', on ? 'plain' : 'styled'); } catch (e) {}
  }

  setPlain(root.classList.contains('plain'));
  toggle.addEventListener('click', function () { setPlain(!root.classList.contains('plain')); });

  /* ---------- Gentle reveal ---------- */
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }
})();
