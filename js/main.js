/* =========================================================
   Kai & XJ | Evergarden Wedding
   Intro sequence, plain text view, RSVP form, scroll reveals
   ========================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  var stars = window.EvergardenStars;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var intro = $('#intro'), flash = $('#flash');
  var gate = $('#gate'), enterBtn = $('#enter-btn'), gatePlain = $('#gate-plain');
  var figs = $$('.shot', intro);
  var plainBtn = $('#plain-toggle'), skipBtn = $('#skip-intro'), live = $('#live'), main = $('#main');

  // Timing (ms)
  var FOCUS_TIME = 450;     // viewfinder locks on
  var SHOT_GAP = 350;       // pause after each click
  var PHOTOS_HOLD = 600;    // all three photos on screen before they dissolve

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

  function shutter(fig) {
    var r = fig.getBoundingClientRect();
    flash.style.setProperty('--fx', (r.left + r.width / 2) + 'px');
    flash.style.setProperty('--fy', (r.top + r.height / 2) + 'px');
    flash.classList.remove('go');
    void flash.offsetWidth;   // restart the animation
    flash.classList.add('go');
  }

  function clickShot(fig) {
    fig.classList.add('is-focusing');
    return wait(FOCUS_TIME).then(function () {
      shutter(fig);
      fig.classList.add('is-clicked');
      return wait(SHOT_GAP);
    });
  }

  // Order of events: gate (click to enter), then the photos, then the page lands on the invitation.
  function play() {
    var chain = Promise.resolve(preload || ready()).then(function () {
      if (skipped) throw SKIP;
    });

    figs.forEach(function (fig) { chain = chain.then(function () { return clickShot(fig); }); });

    chain.then(function () { return wait(PHOTOS_HOLD); })
      .then(function () {
        figs.forEach(function (f) { f.classList.add('is-fading'); });
        return wait(180);
      })
      .then(function () { return stars ? stars.dissolve(figs) : wait(1500); })
      .then(function () { finish(false, true); }, function (err) {
        if (err !== SKIP && window.console) console.error(err);
        finish(false);
      });
  }

  function enter() {
    if (entered || finished) return;
    entered = true;
    gate.classList.add('is-out');
    root.classList.remove('gate-on');
    play();
    // safety net: never leave a visitor stuck behind the intro
    setTimeout(function () { if (!finished && !isPlain()) endIntro(false); }, 60000);
  }

  // natural = the dissolve ran to the end, so its stars are already drifting home
  function finish(focusMain, natural) {
    if (finished) return;
    if (isPlain()) { finished = true; return; }
    finished = true;
    gate.classList.add('is-out');
    root.classList.remove('gate-on');
    figs.forEach(function (f) { f.style.visibility = 'hidden'; });
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
    if (idx > 0) { last.nodeValue = text.slice(0, idx) + '\u00A0' + text.slice(idx + 1); return; }
    var prev = nodes[nodes.length - 2];   // e.g. label text followed by an "(optional)" span
    if (prev && /\s$/.test(prev.nodeValue)) prev.nodeValue = prev.nodeValue.replace(/\s$/, '\u00A0');
  }
  $$('p, h1, h2, h3, dd, label, legend, a.btn, button.btn').forEach(tidy);

  /* ---------- RSVP dialog + Formspree ---------- */
  var dialog = $('#rsvp-dialog'), form = $('#rsvp-form');
  var body = $('#rsvp-body'), thanks = $('#rsvp-thanks');
  var errorBox = $('#form-error'), submitBtn = $('#rsvp-submit');
  var guestFields = $('#guest-fields'), adults = $('#f-adults');

  function openRsvp() {
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

  /* ---------- "+" buttons that open Places to Stay and Things to Do ---------- */
  $$('.toggle').forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      btn.setAttribute('aria-label', (open ? 'Show ' : 'Hide ') + btn.getAttribute('data-label'));
      panel.classList.toggle('is-open', !open);
      if (!open) {
        // if the button sits low on the screen, bring it up so the opened list is in view
        var r = btn.getBoundingClientRect();
        if (r.bottom > window.innerHeight * 0.6) window.scrollBy({ top: r.top - window.innerHeight * 0.3, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
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
