/* =========================================================
   Kai & Xia Jiang | Evergarden Wedding
   Intro sequence, plain text view, RSVP form, scroll reveals, nav menu
   ========================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  var stars = window.EvergardenStars;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var intro = $('#intro');
  var gate = $('#gate'), enterBtn = $('#enter-btn'), gatePlain = $('#gate-plain');
  var shotsEl = $('#shots');
  var figs = $$('.shot', intro);
  var plainBtn = $('#plain-toggle'), skipBtn = $('#skip-intro'), live = $('#live'), main = $('#main');

  // Timing (ms) for the photos' fade + drop entrance
  var STAGGER = 120;      // gap between each photo starting its reveal
  var REVEAL_DUR = 650;   // how long one photo takes to fade in and ease into place
  var PHOTOS_HOLD = 900;  // how long all three sit still, fully revealed
  var REVEAL_TOTAL = STAGGER * Math.max(0, figs.length - 1) + REVEAL_DUR + PHOTOS_HOLD;

  var SKIP = { skipped: true };
  var skipped = false, finished = false, entered = false, preload = null, pend = [];

  function isPlain() { return root.getAttribute('data-view') === 'plain'; }

  /* ---------- cancellable waiting ---------- */
  function wait(ms) {
    return new Promise(function (resolve, reject) {
      if (skipped) { reject(SKIP); return; }
      var entry;
      var t = setTimeout(function () {
        var i = pend.indexOf(entry);
        if (i > -1) pend.splice(i, 1);
        resolve();
      }, ms);
      entry = function () { clearTimeout(t); reject(SKIP); };
      pend.push(entry);
    });
  }

  function cancelWaits() {
    skipped = true;
    var list = pend.slice();
    pend.length = 0;
    list.forEach(function (fn) { fn(); });
  }

  /* ---------- plain text view ---------- */
  function announce(msg) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 60); } }

  function setView(plain, opts) {
    opts = opts || {};
    root.setAttribute('data-view', plain ? 'plain' : 'designed');
    plainBtn.textContent = plain ? 'Switch to designed version' : 'Plain text version';
    if (!opts.silent) {
      try { localStorage.setItem('evergarden-view', plain ? 'plain' : 'designed'); } catch (e) {}
      announce(plain ? 'Plain text version is on.' : 'Designed version is on.');
    }

    if (plain) {
      cancelWaits();
      root.classList.remove('intro-on', 'gate-on');
      intro.classList.remove('is-done');
      intro.hidden = false;
      if (stars) stars.clear();
      finished = true;
    } else if (opts.fromPlain) {
      // coming back from plain: go straight to the finished scene
      finished = false; skipped = true;
      intro.hidden = false;
      finish(false);
    }
  }

  /* ---------- the opening scene ---------- */
  function ready() {
    var fontsReady = new Promise(function (resolve) {
      if (!document.fonts || !document.fonts.ready) { resolve(); return; }
      requestAnimationFrame(function () { requestAnimationFrame(function () { document.fonts.ready.then(resolve, resolve); }); });
    });
    var imgs = $$('img', intro).map(function (img) {
      return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
    });
    var all = Promise.all([fontsReady].concat(imgs));
    var cap = new Promise(function (resolve) { setTimeout(resolve, 3500); });
    return Promise.race([all, cap]);
  }

  // Order of events: gate (click to enter) -> the photos fade in and ease into place, hold,
  // then fade away together -> the page lands on the invitation. The photos' fade-out and the
  // landing's fade-in are started together (not one after the other), so there is never a gap
  // of empty background between the two - just one continuous crossfade.
  function play() {
    Promise.resolve(preload || ready()).then(function () {
      if (skipped) throw SKIP;
      shotsEl.classList.add('is-in');
      return wait(REVEAL_TOTAL);
    }).then(function () {
      shotsEl.classList.add('is-out');
      finish(false, true);
    }, function (err) {
      if (err !== SKIP && window.console) console.error(err);
      finish(false);
    });
  }

  function enter() {
    if (entered || finished) return;
    entered = true;
    if (stars) stars.seed();   // the night sky is already twinkling as the photos appear
    gate.classList.add('is-out');
    root.classList.remove('gate-on');
    play();
    // safety net: never leave a visitor stuck behind the intro
    setTimeout(function () { if (!finished && !isPlain()) endIntro(false); }, 60000);
  }

  // natural = the photos' own fade-out is already under way as this runs
  function finish(focusMain, natural) {
    if (finished) return;
    if (isPlain()) { finished = true; return; }
    finished = true;
    gate.classList.add('is-out');
    root.classList.remove('gate-on');
    if (stars && !natural) stars.finishNow();
    intro.classList.add('is-done');
    root.classList.remove('intro-on');
    root.classList.add('landed');
    window.scrollTo(0, 0);
    initReveals();
    if (focusMain && main) main.focus({ preventScroll: true });
    setTimeout(function () { if (!isPlain()) intro.hidden = true; }, 1200);
  }

  function endIntro(focusMain) {
    if (finished) return;
    cancelWaits();
    finish(focusMain);
  }

  /* ---------- scroll reveals ---------- */
  var revealsStarted = false;
  function initReveals() {
    var items = $$('.reveal');
    if (revealsStarted) { items.forEach(function (el) { el.classList.add('in'); }); return; }
    revealsStarted = true;

    var counts = new Map();
    items.forEach(function (el) {
      var n = counts.get(el.parentNode) || 0;
      counts.set(el.parentNode, n + 1);
      el.style.setProperty('--i', n % 3);
    });

    if (!('IntersectionObserver' in window)) { items.forEach(function (el) { el.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- no orphaned words ----------
     CSS text-wrap balances most text; this also glues the last two words of every
     block together so no browser can leave a single word alone on the last line. */
  function tidy(el) {
    if (el.closest('.sr-only, .hp')) return;
    var nodes = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue.trim() || (n.parentNode.closest && n.parentNode.closest('.sr-only'))) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    var last = nodes[nodes.length - 1];
    if (!last) return;
    var text = last.nodeValue, trimmed = text.replace(/\s+$/, ''), idx = trimmed.lastIndexOf(' ');
    if (idx > 0) { last.nodeValue = text.slice(0, idx) + ' ' + text.slice(idx + 1); return; }
    var prev = nodes[nodes.length - 2];   // e.g. label text followed by an "(optional)" span
    if (prev && /\s$/.test(prev.nodeValue)) prev.nodeValue = prev.nodeValue.replace(/\s$/, ' ');
  }
  $$('p, h1, h2, h3, dd, label, legend, a.btn, button.btn').forEach(tidy);

  /* ---------- top-right nav: a single hamburger menu ---------- */
  var menuBtn = $('#menu-toggle'), menuPanel = $('#menu-panel'), menuPlainLink = $('#menu-plain-link');

  function closeMenu() {
    if (!menuBtn || menuBtn.getAttribute('aria-expanded') !== 'true') return;
    menuBtn.setAttribute('aria-expanded', 'false');
    menuPanel.classList.remove('is-open');
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      menuPanel.classList.toggle('is-open', !open);
    });
    // bound once, unconditionally: checking the open state inside avoids the classic bug where
    // the click that opens the panel immediately bubbles up and closes it again
    document.addEventListener('click', function (e) {
      if (menuBtn.getAttribute('aria-expanded') === 'true' && !menuPanel.contains(e.target) && !menuBtn.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { closeMenu(); menuBtn.focus(); }
    });
    $$('.menu__link', menuPanel).forEach(function (el) { el.addEventListener('click', closeMenu); });
  }
  if (menuPlainLink) menuPlainLink.addEventListener('click', function () { setView(true); });

  /* ---------- RSVP dialog + Formspree ---------- */
  var dialog = $('#rsvp-dialog'), form = $('#rsvp-form');
  var body = $('#rsvp-body'), thanks = $('#rsvp-thanks');
  var errorBox = $('#form-error'), submitBtn = $('#rsvp-submit');
  var guestFields = $('#guest-fields'), adults = $('#f-adults');

  function openRsvp() {
    closeMenu();
    if (!finished) endIntro(false);
    resetForm();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    root.classList.add('modal-open');
  }

  function closeRsvp() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    root.classList.remove('modal-open');
  }

  function resetForm() {
    if (!thanks.hidden) form.reset();
    body.hidden = false; thanks.hidden = true;
    errorBox.hidden = true;
    submitBtn.disabled = false; submitBtn.textContent = 'Send RSVP';
    var picked = $('input[name="attending"]:checked', form);
    toggleGuests(!!picked && picked.value === 'Yes');
  }

  function toggleGuests(show) {
    guestFields.hidden = !show;
    $$('input, textarea', guestFields).forEach(function (el) { el.disabled = !show; });
    adults.required = show;
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    tidy(errorBox);
  }

  $$('[data-rsvp]').forEach(function (btn) { btn.addEventListener('click', openRsvp); });
  $('#rsvp-close').addEventListener('click', closeRsvp);
  $('#thanks-close').addEventListener('click', closeRsvp);
  dialog.addEventListener('click', function (e) { if (e.target === dialog) closeRsvp(); });
  dialog.addEventListener('close', function () { root.classList.remove('modal-open'); });

  $$('input[name="attending"]', form).forEach(function (radio) {
    radio.addEventListener('change', function () { toggleGuests(radio.value === 'Yes' && radio.checked); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorBox.hidden = true;
    if (!form.checkValidity()) { form.reportValidity(); return; }

    if (/YOUR_FORM_ID/.test(form.action)) {
      showError('The RSVP form is not connected yet. Add your Formspree form ID in index.html (search for YOUR_FORM_ID).');
      return;
    }

    var attending = (new FormData(form)).get('attending');
    submitBtn.disabled = true; submitBtn.textContent = 'Sending...';

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      if (res.ok) return;
      return res.json().then(function (j) {
        var msg = (j && j.errors || []).map(function (x) { return x.message; }).join(', ');
        throw new Error(msg || 'Something went wrong.');
      });
    }).then(function () {
      $('#thanks-text').textContent = attending === 'Yes'
        ? 'Thank you! Your RSVP has arrived and we cannot wait to celebrate with you.'
        : 'Thank you for letting us know. We will miss you, and we are sending our love.';
      tidy($('#thanks-text'));
      body.hidden = true; thanks.hidden = false;
      thanks.focus();
      announce('Your RSVP was sent. Thank you.');
    }).catch(function (err) {
      submitBtn.disabled = false; submitBtn.textContent = 'Send RSVP';
      var detail = err && err.message && err.message !== 'Failed to fetch' ? err.message.replace(/\.?\s*$/, '.') : '';
      showError(detail
        ? detail + ' Please check the form and try again.'
        : 'We could not send your RSVP. Please check your connection and try again.');
    });
  });

  /* ---------- controls ---------- */
  plainBtn.addEventListener('click', function () {
    var toPlain = !isPlain();
    setView(toPlain, { fromPlain: !toPlain });
  });
  skipBtn.addEventListener('click', function () { endIntro(true); });
  enterBtn.addEventListener('click', enter);
  gatePlain.addEventListener('click', function () { setView(true); });
  $('#skip-link').addEventListener('click', function () { if (!finished) endIntro(true); });

  /* ---------- start ---------- */
  plainBtn.textContent = isPlain() ? 'Switch to designed version' : 'Plain text version';

  if (isPlain()) {
    finished = true; skipped = true;
    if (stars) stars.clear();
  } else if (reduceMotion || !stars) {
    // Motion is switched off (or the canvas is unavailable): show the finished scene right away.
    skipped = true;
    finish(false);
  } else {
    preload = ready();   // fonts and photos load quietly while the gate waits for a click
  }
})();
