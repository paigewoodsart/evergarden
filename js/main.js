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

  /* Other pop-ups, like the Zelle QR code */
  document.querySelectorAll('[data-open]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var d = document.getElementById(btn.getAttribute('data-open'));
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    });
  });

  document.querySelectorAll('dialog').forEach(function (d) {
    d.querySelector('[data-close]').addEventListener('click', function () { d.close(); });
    d.addEventListener('click', function (e) { /* close only on a click outside the panel, on the backdrop */
      if (e.target !== d) return;
      var r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    });
  });

  /* ---------- RSVP form ---------- */
  var form = document.getElementById('rsvp-form');
  var errorBox = document.getElementById('rsvp-error');
  var done = document.getElementById('rsvp-done');
  var attendingBlock = document.getElementById('rsvp-attending');
  var lists = { adult: document.getElementById('adult-list'), child: document.getElementById('child-list') };
  var words = { adult: 'Adult', child: 'Child' };
  var counter = { adult: 1, child: 0 };

  function renumber(kind) {
    lists[kind].querySelectorAll('.rsvp__row').forEach(function (row, i) {
      row.querySelector('label').textContent = words[kind] + ' ' + (i + 1) + ' name';
      var rm = row.querySelector('.rsvp__remove');
      if (rm) rm.setAttribute('aria-label', 'Remove ' + words[kind].toLowerCase() + ' ' + (i + 1));
    });
  }

  function addRow(kind) {
    counter[kind] += 1;
    var id = kind + '-' + counter[kind];
    var row = document.createElement('div');
    row.className = 'rsvp__row';
    row.innerHTML =
      '<label class="sr-only" for="' + id + '"></label>' +
      '<input id="' + id + '" name="' + kind + '_name" type="text" placeholder="' + (kind === 'child' ? 'Child\'s name' : 'Full name') + '">' +
      '<button type="button" class="rsvp__remove"><span aria-hidden="true">&times;</span></button>';
    lists[kind].appendChild(row);
    renumber(kind);
    row.querySelector('input').focus();
  }

  form.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]');
    if (add) { addRow(add.getAttribute('data-add')); return; }
    var rm = e.target.closest('.rsvp__remove');
    if (rm) {
      var row = rm.closest('.rsvp__row');
      var kind = row.parentNode === lists.child ? 'child' : 'adult';
      row.remove();
      renumber(kind);
      form.querySelector('[data-add="' + kind + '"]').focus();
    }
  });

  /* Meals and accessibility only matter for guests who are coming */
  form.addEventListener('change', function (e) {
    if (e.target.name !== 'attending') return;
    var declining = e.target.value.indexOf('Regretfully') === 0;
    attendingBlock.hidden = declining;
    attendingBlock.querySelectorAll('input, textarea').forEach(function (el) { el.disabled = declining; });
  });

  form.addEventListener('input', function (e) {
    e.target.removeAttribute('aria-invalid');
    errorBox.hidden = true;
  });
  form.addEventListener('change', function () { errorBox.hidden = true; });

  function showError(msg, field) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorBox.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });

    var firstAdult = document.getElementById('adult-1');
    if (!firstAdult.value.trim()) return showError('Please add at least one name.', firstAdult);
    if (!form.querySelector('input[name="attending"]:checked')) {
      return showError('Please let us know if you can join us.', form.querySelector('input[name="attending"]'));
    }

    /* Combine the repeated rows into tidy single fields for the Formspree inbox */
    var raw = new FormData(form);
    var data = new FormData();
    var adults = raw.getAll('adult_name').map(function (v) { return v.trim(); }).filter(Boolean);
    var kids = raw.getAll('child_name').map(function (v) { return v.trim(); }).filter(Boolean);
    data.append('_subject', raw.get('_subject') + ' (' + adults[0] + ')');
    data.append('_gotcha', raw.get('_gotcha') || '');
    data.append('attending', raw.get('attending'));
    data.append('adult_names', adults.join(', '));
    data.append('adults_attending', String(adults.length));
    data.append('child_names', kids.join(', ') || 'None');
    data.append('children_attending', String(kids.length));
    if (!attendingBlock.hidden) {
      data.append('allergies_dietary', raw.get('allergies_dietary') || 'None');
      data.append('accessibility_needs', raw.getAll('accessibility').join(', ') || 'None');
      data.append('accessibility_other', raw.get('accessibility_other') || '');
    }

    var submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Sending...';

    fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('bad response');
        form.hidden = true;
        done.hidden = false;
        done.focus();
      })
      .catch(function () {
        showError('Sorry, that did not go through. Please try again, or call, text or email us below.');
      })
      .then(function () {
        submit.disabled = false;
        submit.textContent = 'Send RSVP';
      });
  });

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
