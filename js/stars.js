/* =========================================================
   Star engine
   - seed(): scatters a fresh field of twinkling gold stars across the sky
   - the stars fade in in place and quietly twinkle; nothing else happens to them
   ========================================================= */
(function () {
  'use strict';

  var canvas = document.getElementById('stars');
  if (!canvas || !canvas.getContext) { window.EvergardenStars = null; return; }
  var ctx = canvas.getContext('2d');

  var TAU = Math.PI * 2;

  var W = 0, H = 0, dpr = 1;
  var glow, glint;
  var stars = [];
  var running = false, raf = 0, lastT = 0, clock = 0;
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
      r.addColorStop(0.72, 'rgba(212,175,55,0.12)');
      r.addColorStop(1, 'rgba(212,175,55,0)');
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
      stars[i].x = stars[i].nx * W; stars[i].y = stars[i].ny * H;
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
      a: 0
    };
  }

  function topUp() {
    var need = targetCount() - stars.length;
    for (var i = 0; i < need; i++) stars.push(makeStar(Math.random(), Math.random()));
    fieldAlpha = 1;
  }

  /** Scatter a fresh field of stars and start them fading in. */
  function seed() {
    resize();
    stars.length = 0;
    topUp();
    start();
  }

  /** Make sure the field exists and is running, without resetting stars already in place. */
  function finishNow() {
    resize();
    topUp();
    start();
  }

  /* ---------- loop ---------- */
  function update(dt) {
    clock += dt;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      if (s.a < 1) s.a = Math.min(1, s.a + dt * 2.2);
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
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
    if (ts - lastT < 32) return;   // twinkle at ~30fps, this is a quiet ambient layer
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
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  /** Plain text view: stop everything and wipe the canvas. */
  function clear() {
    stop();
    stars.length = 0;
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
    seed: seed,
    finishNow: finishNow,
    clear: clear,
    stop: stop
  };
})();
