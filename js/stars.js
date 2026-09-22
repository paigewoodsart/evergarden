/* =========================================================
   Star engine
   - dissolve(): turns the on-screen photos into gold dust, pixel by pixel
   - a few of those grains drift out and settle as permanent twinkling stars
   - seed(): the same star field without the dissolve (skip intro, returning from plain view)
   ========================================================= */
(function () {
  'use strict';

  var canvas = document.getElementById('stars');
  if (!canvas || !canvas.getContext) { window.EvergardenStars = null; return; }
  var ctx = canvas.getContext('2d');

  var TAU = Math.PI * 2;
  var SWEEP = 1.5;               // seconds for the dissolve front to cross the photos
  var RESOLVE_AT = SWEEP + 0.15; // when dissolve() reports "done": the landing starts as the last grain lifts

  var W = 0, H = 0, dpr = 1;
  var glow, glint;
  var stars = [], dust = [];
  var remnant = null, rctx = null;
  var cells = [], nextCell = 0, cellSize = 4, expectedSpawn = 1;
  var running = false, raf = 0, lastT = 0, clock = 0;
  var phase = 'idle';            // idle | dissolve | settled
  var pending = null, pendClock = 0;
  var fieldAlpha = 0;

  /* ---------- sprites ---------- */
  function sprite(size, paint) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    paint(c.getContext('2d'), size);
    return c;
  }

  function buildSprites() {
    glow = sprite(64, function (g, s) {
      var r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,247,226,1)');
      r.addColorStop(0.18, 'rgba(240,224,180,0.95)');
      r.addColorStop(0.4, 'rgba(206,178,118,0.5)');
      r.addColorStop(0.72, 'rgba(192,160,103,0.12)');
      r.addColorStop(1, 'rgba(192,160,103,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, s, s);
    });
    glint = sprite(128, function (g, s) {
      g.translate(s / 2, s / 2);
      for (var k = 0; k < 2; k++) {
        var lg = g.createLinearGradient(-s / 2, 0, s / 2, 0);
        lg.addColorStop(0, 'rgba(240,226,190,0)');
        lg.addColorStop(0.5, 'rgba(250,240,212,1)');
        lg.addColorStop(1, 'rgba(240,226,190,0)');
        g.fillStyle = lg;
        g.fillRect(-s / 2, -0.8, s, 1.6);
        g.rotate(Math.PI / 2);
      }
      var c = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.14);
      c.addColorStop(0, 'rgba(252,246,228,1)');
      c.addColorStop(1, 'rgba(240,226,190,0)');
      g.fillStyle = c;
      g.fillRect(-s / 2, -s / 2, s, s);
    });
  }

  /* ---------- sizing ---------- */
  function resize() {
    var r = canvas.getBoundingClientRect();
    var w = Math.round(r.width), h = Math.round(r.height);
    if (!w || !h) return;
    var d = Math.min(window.devicePixelRatio || 1, 2);
    // ignore the small height jitter from mobile browser toolbars
    if (canvas.width && w === W && Math.abs(h - H) < 120 && d === dpr) return;
    W = w; H = h; dpr = d;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    for (var i = 0; i < stars.length; i++) {
      if (!stars[i].mv) { stars[i].x = stars[i].nx * W; stars[i].y = stars[i].ny * H; }
    }
  }

  function targetCount() {
    return Math.max(100, Math.min(340, Math.round((W * H) / 6200)));
  }

  /* ---------- stars ---------- */
  function makeStar(nx, ny) {
    var big = Math.random();
    return {
      nx: nx, ny: ny, x: nx * W, y: ny * H,
      sz: 4 + Math.pow(big, 3) * 9,
      base: 0.28 + Math.random() * 0.42,
      ph: Math.random() * TAU,
      sp: 0.7 + Math.random() * 2.1,
      glint: big > 0.94,
      a: 1, mv: null
    };
  }

  function topUp() {
    var need = targetCount() - stars.length;
    for (var i = 0; i < need; i++) {
      var s = makeStar(Math.random(), Math.random());
      s.a = 0;
      stars.push(s);
    }
    fieldAlpha = 1;
  }

  function seed() {
    resize();
    stars.length = 0;
    var n = targetCount();
    for (var i = 0; i < n; i++) {
      var s = makeStar(Math.random(), Math.random());
      s.a = 0;
      stars.push(s);
    }
    fieldAlpha = 1;
    start();
  }

  /* ---------- dissolve ---------- */
  function coverRect(iw, ih, w, h) {
    var ir = iw / ih, r = w / h, sw, sh;
    if (ir > r) { sh = ih; sw = ih * r; } else { sw = iw; sh = iw / r; }
    return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw: sw, sh: sh };
  }

  function liftCell(c) {
    var s = cellSize * 1.3;
    rctx.save();
    rctx.globalCompositeOperation = 'destination-out';
    rctx.translate(c.x, c.y);
    rctx.rotate(c.ang);
    rctx.fillRect(-s / 2, -s / 2, s, s);
    rctx.restore();

    if (Math.random() > c.p) return;

    var pSurvive = Math.min(1, targetCount() / Math.max(1, expectedSpawn)) * (0.5 + c.L);
    if (Math.random() < pSurvive) {
      var st = makeStar(Math.random(), Math.random());   // its new home in the sky
      st.x = c.x; st.y = c.y; st.a = 0;
      st.mv = { sx: c.x, sy: c.y, t: 0, dur: 2.4 + Math.random() * 1.8, wob: (Math.random() - 0.5) * 60, ph2: Math.random() * TAU };
      stars.push(st);
    } else {
      dust.push({
        x: c.x, y: c.y,
        vx: (Math.random() - 0.3) * 46, vy: -(14 + Math.random() * 60),
        age: 0, ttl: 1.3 + Math.random() * 1.7,
        sz: 5 + c.L * 7 + Math.random() * 3,
        ph: Math.random() * TAU, sp: 5 + Math.random() * 7
      });
    }
  }

  function dissolve(figs) {
    cancelDissolve();
    resize();

    var items = [], totalArea = 0;
    figs.forEach(function (fig) {
      var img = fig.querySelector('img');
      var r = fig.getBoundingClientRect();
      var m = new DOMMatrixReadOnly(getComputedStyle(fig).transform);
      var it = {
        fig: fig, img: img,
        cx: r.left + r.width / 2, cy: r.top + r.height / 2,
        w: fig.offsetWidth, h: fig.offsetHeight,
        ang: Math.atan2(m.b, m.a)
      };
      totalArea += it.w * it.h;
      items.push(it);
    });

    var maxCells = (W * H > 700000) ? 15000 : 7000;
    cellSize = Math.max(3, Math.ceil(Math.sqrt(totalArea / maxCells)));

    remnant = document.createElement('canvas');
    remnant.width = canvas.width; remnant.height = canvas.height;
    rctx = remnant.getContext('2d');
    rctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cells = []; expectedSpawn = 0;

    items.forEach(function (it) {
      var cols = Math.ceil(it.w / cellSize), rows = Math.ceil(it.h / cellSize);
      var cr = coverRect(it.img.naturalWidth, it.img.naturalHeight, it.w, it.h);

      // the photo itself, drawn exactly where the DOM copy sits
      rctx.save();
      rctx.translate(it.cx, it.cy);
      rctx.rotate(it.ang);
      rctx.drawImage(it.img, cr.sx, cr.sy, cr.sw, cr.sh, -it.w / 2, -it.h / 2, it.w, it.h);
      rctx.restore();

      // brightness map, so bright parts of the photo make more stars
      var lum = null;
      try {
        var sc = document.createElement('canvas');
        sc.width = cols; sc.height = rows;
        var sctx = sc.getContext('2d', { willReadFrequently: true });
        sctx.drawImage(it.img, cr.sx, cr.sy, cr.sw, cr.sh, 0, 0, cols, rows);
        var data = sctx.getImageData(0, 0, cols, rows).data;
        lum = new Float32Array(cols * rows);
        for (var k = 0; k < lum.length; k++) {
          lum[k] = (data[k * 4] * 0.2126 + data[k * 4 + 1] * 0.7152 + data[k * 4 + 2] * 0.0722) / 255;
        }
      } catch (e) { lum = null; }   // opened from file://: pixels are locked, so sprinkle evenly

      var cos = Math.cos(it.ang), sin = Math.sin(it.ang);
      for (var j = 0; j < rows; j++) {
        for (var i = 0; i < cols; i++) {
          var lx = (i + 0.5) * cellSize - it.w / 2, ly = (j + 0.5) * cellSize - it.h / 2;
          var x = it.cx + lx * cos - ly * sin, y = it.cy + lx * sin + ly * cos;
          var L = lum ? lum[j * cols + i] : 0.35 + Math.random() * 0.3;
          var front = Math.min(1, Math.max(0, x / W)) * 0.6 + Math.random() * 0.4;
          var p = 0.1 + 0.6 * Math.pow(L, 0.85);
          expectedSpawn += p;
          cells.push({ x: x, y: y, ang: it.ang, L: L, p: p, at: front * SWEEP });
        }
      }
    });

    cells.sort(function (a, b) { return a.at - b.at; });
    nextCell = 0; pendClock = 0; phase = 'dissolve'; fieldAlpha = 1;

    // hand over from the DOM photos to the canvas copy in the same frame
    draw();
    items.forEach(function (it) { it.fig.style.visibility = 'hidden'; });
    start();

    return new Promise(function (resolve) { pending = resolve; });
  }

  function endDissolve() {
    remnant = null; rctx = null; cells = []; nextCell = 0;
    phase = 'settled';
    topUp();
  }

  function cancelDissolve() {
    remnant = null; rctx = null; cells = []; nextCell = 0;
    if (pending) { var r = pending; pending = null; r(); }
  }

  /** Skip: drop whatever is mid-flight and show the finished star field. */
  function finishNow() {
    resize();
    cancelDissolve();
    phase = 'settled';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      if (s.mv) { s.x = s.nx * W; s.y = s.ny * H; s.mv = null; }
    }
    topUp();
    start();
  }

  /* ---------- loop ---------- */
  function update(dt) {
    clock += dt;

    if (phase === 'dissolve') {
      var t = clock - dissolveStart;
      while (nextCell < cells.length && cells[nextCell].at <= t) liftCell(cells[nextCell++]);
      if (nextCell >= cells.length) endDissolve();
    }
    if (pending) {
      pendClock += dt;
      if (pendClock >= RESOLVE_AT) { var r = pending; pending = null; r(); }
    }

    var i, s, d;
    for (i = 0; i < stars.length; i++) {
      s = stars[i];
      if (s.a < 1) s.a = Math.min(1, s.a + dt * 2.2);
      if (s.mv) {
        s.mv.t += dt;
        var k = Math.min(1, s.mv.t / s.mv.dur);
        var e = 1 - Math.pow(1 - k, 3);
        var tx = s.nx * W, ty = s.ny * H;
        s.x = s.mv.sx + (tx - s.mv.sx) * e + Math.sin(e * TAU + s.mv.ph2) * s.mv.wob * (1 - e);
        s.y = s.mv.sy + (ty - s.mv.sy) * e + Math.cos(e * Math.PI * 1.5 + s.mv.ph2) * s.mv.wob * 0.6 * (1 - e);
        if (k >= 1) { s.mv = null; s.x = tx; s.y = ty; }
      }
    }
    for (i = dust.length - 1; i >= 0; i--) {
      d = dust[i];
      d.age += dt;
      if (d.age >= d.ttl) { dust[i] = dust[dust.length - 1]; dust.pop(); continue; }
      var damp = 1 - Math.min(1, 1.1 * dt);
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.vx *= damp; d.vy = d.vy * damp - 6 * dt;
    }
  }

  var dissolveStart = 0;

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (remnant) ctx.drawImage(remnant, 0, 0);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';

    var i, d, s;
    for (i = 0; i < dust.length; i++) {
      d = dust[i];
      var life = d.age / d.ttl;
      var env = Math.min(1, d.age / 0.18) * Math.pow(1 - life, 1.3);
      ctx.globalAlpha = env * (0.55 + 0.45 * Math.sin(clock * d.sp + d.ph));
      ctx.drawImage(glow, d.x - d.sz / 2, d.y - d.sz / 2, d.sz, d.sz);
    }
    for (i = 0; i < stars.length; i++) {
      s = stars[i];
      var tw = s.base + (1 - s.base) * (0.5 + 0.5 * Math.sin(clock * s.sp + s.ph));
      var a = s.a * fieldAlpha * tw;
      if (a <= 0.01) continue;
      var sz = s.sz * (0.85 + 0.3 * tw);
      ctx.globalAlpha = a;
      ctx.drawImage(glow, s.x - sz / 2, s.y - sz / 2, sz, sz);
      if (s.glint) {
        var g = Math.pow(Math.max(0, Math.sin(clock * s.sp * 0.6 + s.ph)), 4);
        if (g > 0.02) {
          var gs = sz * 2.8;
          ctx.globalAlpha = a * g * 0.75;
          ctx.drawImage(glint, s.x - gs / 2, s.y - gs / 2, gs, gs);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    var calm = phase !== 'dissolve' && !dust.length;
    if (calm && ts - lastT < 32) return;          // twinkle at ~30fps once things settle
    var dt = Math.min(0.05, (ts - lastT) / 1000);
    if (!(dt > 0)) dt = 0.016;
    lastT = ts;
    update(dt);
    draw();
  }

  function start() {
    if (running) return;
    running = true;
    lastT = performance.now();
    if (phase === 'dissolve') dissolveStart = clock;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  /** Plain text view: stop everything and wipe the canvas. */
  function clear() {
    stop();
    cancelDissolve();
    stars.length = 0; dust.length = 0; phase = 'idle';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  buildSprites();
  resize();
  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 150);
  });

  window.EvergardenStars = {
    dissolve: function (figs) { dissolveStart = clock; return dissolve(figs); },
    seed: seed,
    finishNow: finishNow,
    clear: clear,
    stop: stop
  };
})();
