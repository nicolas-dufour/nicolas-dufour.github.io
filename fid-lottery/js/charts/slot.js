/* ===================================================================
   slot.js — THE TWO-LOTTERY FLOOR.

   ① The Training Lottery (left): one 3-reel machine. Pulling draws one
   of the 25 trained SiT-B/2 networks (a training seed) and prints a
   ticket for the generation lottery.
   ② The Generation Lottery (right): a 5×2 wall of 10 mini slot machines
   (one per real sampling seed in the panel). Each lands on one sampling-seed
   FID of the ticketed network — the within-network (generation) spread.

   Two histograms below, on a shared FID axis: the *sampling* histogram
   (this network's 10 draws — narrow) vs. the *training* histogram (the
   mean of every network you've drawn — wide). Watching them fill makes
   the 3.2× gap visible. Draw a lucky low FID and the floor pays a
   JACKPOT.
   =================================================================== */
(function () {
  "use strict";
  window.FLCharts = window.FLCharts || {};

  var ORDER_TRAIN = ["init", "data", "noise"];
  // engraved classic-slot symbols (keys into ICON_DEFS), varied per reel
  var SYM_TRAIN = {
    init:  ["seven", "spade", "bell", "heart", "star", "club", "crown", "diamond", "horseshoe"],
    data:  ["diamond", "bell", "clover", "seven", "spade", "cherry", "heart", "star", "club"],
    noise: ["heart", "star", "horseshoe", "club", "bell", "seven", "spade", "crown", "cherry"]
  };
  var MINI_SYMS = ["spade", "heart", "seven", "diamond", "star", "club", "bell", "cherry", "horseshoe", "clover"];

  var DOMAIN = [33.4, 35.7];
  var BINS = 18;

  // Symbol geometry, authored once at 24×24. Single-ink shapes use currentColor
  // (tinted per-symbol in CSS); fruit / jewels carry their own fills. Rendered
  // through a hidden <symbol> sprite so the thousands of reel cells stay light.
  var ICON_DEFS = {
    seven:     '<path fill="currentColor" d="M5 4h14v3.4l-6.6 13.6H7.3L13.9 8H5z"/>',
    spade:     '<path fill="currentColor" d="M12 2.5C8.6 6.9 3.6 9.6 3.6 13.9c0 2.4 1.8 4.1 4 4.1 1 0 1.9-.3 2.5-.9-.3 1.9-1.1 3.1-2.4 3.9h8.6c-1.3-.8-2.1-2-2.4-3.9.6.6 1.5.9 2.5.9 2.2 0 4-1.7 4-4.1 0-4.3-5-7-8.4-11.4z"/>',
    heart:     '<path fill="currentColor" d="M12 20.6C5 16 3 12.2 3 8.7 3 6 5 4 7.6 4 9.3 4 10.8 4.9 12 6.5 13.2 4.9 14.7 4 16.4 4 19 4 21 6 21 8.7c0 3.5-2 7.3-9 11.9z"/>',
    diamond:   '<path fill="currentColor" d="M12 2.5 21 12l-9 9.5L3 12z"/>',
    club:      '<g fill="currentColor"><circle cx="12" cy="6.4" r="3.2"/><circle cx="7.4" cy="11.6" r="3.2"/><circle cx="16.6" cy="11.6" r="3.2"/><path d="M10.4 11.2h3.2l1.3 7.6H9.1z"/></g>',
    bell:      '<path fill="currentColor" d="M12 2.4c.9 0 1.7.7 1.7 1.7v.4c2.6.8 4 3 4 6 0 3.1.6 4.9 1.7 6.1v.4H4.6v-.4c1.1-1.2 1.7-3 1.7-6.1 0-3 1.4-5.2 4-6v-.4c0-1 .8-1.7 1.7-1.7z"/><path fill="currentColor" d="M9.8 19.4h4.4a2.2 2.2 0 0 1-4.4 0z"/>',
    cherry:    '<path d="M6.8 5.3C10.3 4.8 14 4.6 17.4 5.9" fill="none" stroke="#1a7a52" stroke-width="1.4" stroke-linecap="round"/><path d="M7.2 14.4C6.8 11 6.8 8 6.9 5.6" fill="none" stroke="#1a7a52" stroke-width="1.3" stroke-linecap="round"/><path d="M15.7 15.2C15.6 11.5 16 8 17.2 5.8" fill="none" stroke="#1a7a52" stroke-width="1.3" stroke-linecap="round"/><path d="M17.8 4.7c1.6-.5 3 0 4.1 1.3-1.3.9-2.9.9-4.2 0z" fill="#1a7a52"/><circle cx="7.2" cy="17.4" r="3.4" fill="#9d2a22"/><circle cx="15.7" cy="18.1" r="3.4" fill="#9d2a22"/><circle cx="6" cy="16.3" r="1" fill="#df7d74"/><circle cx="14.5" cy="17" r="1" fill="#df7d74"/>',
    horseshoe: '<path d="M7.2 20.6C3.4 17 2.6 11.7 4.9 7.7 6.4 5 9 3.6 12 3.6s5.6 1.4 7.1 4.1c2.3 4 1.5 9.3-2.3 12.9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="5.7" cy="12.2" r="1" fill="currentColor"/><circle cx="7.1" cy="8" r="1" fill="currentColor"/><circle cx="18.3" cy="12.2" r="1" fill="currentColor"/><circle cx="16.9" cy="8" r="1" fill="currentColor"/>',
    star:      '<path fill="currentColor" d="M12 2.4l2.8 6.1 6.7.6-5 4.4 1.5 6.5L12 17l-6 3.5 1.5-6.5-5-4.4 6.7-.6z"/>',
    clover:    '<g fill="currentColor"><circle cx="12" cy="6.6" r="3.3"/><circle cx="6.6" cy="12" r="3.3"/><circle cx="17.4" cy="12" r="3.3"/><circle cx="12" cy="12.4" r="3.1"/></g><path d="M12 13c.2 3.4-.6 5.7-2.6 7.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    crown:     '<path fill="currentColor" d="M3.6 18.2 4.5 8l4.6 3.4L12 5.3l2.9 6.1L19.5 8l.9 10.2z"/><rect fill="currentColor" x="3.6" y="18" width="16.8" height="2.6" rx="1"/><circle cx="12" cy="9.6" r="1.1" fill="#9d2a22"/><circle cx="6.1" cy="14.2" r="1" fill="#9d2a22"/><circle cx="17.9" cy="14.2" r="1" fill="#9d2a22"/>'
  };
  function ensureSprite() {
    if (document.getElementById("fl-sym-sprite")) return;
    var inner = "";
    for (var k in ICON_DEFS) if (ICON_DEFS.hasOwnProperty(k))
      inner += '<symbol id="ic-' + k + '" viewBox="0 0 24 24">' + ICON_DEFS[k] + "</symbol>";
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "fl-sym-sprite"; svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
    svg.innerHTML = inner;
    document.body.insertBefore(svg, document.body.firstChild);
  }
  function glyphHTML(sym) {
    if (ICON_DEFS[sym]) return '<svg class="sym sym--' + sym + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-' + sym + '"/></svg>';
    return sym;
  }
  function symbolIndexFor(key, reelIdx, len) {
    return ((key * 2654435761 + (reelIdx + 1) * 40503) >>> 0) % len;
  }
  function distProfile(x) {
    var sT = 0.72, sD = 0.84;
    if (x <= sT) return sD * (x / sT);
    var u = (x - sT) / (1 - sT);
    return sD + (1 - sD) * (1 - Math.pow(1 - u, 3));
  }

  // A pool of vivid procedural "images" a diffusion model could generate,
  // built as scene × palette combinations. Returned as an array of
  // Uint8ClampedArray (W*H*3); the sampling montage fills each grid cell with
  // a UNIQUE one and cycles through 10 distinct grids.
  function buildTargetPool(W, H) {
    var MIN = Math.min(W, H);
    function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    function dark(c) { return [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5]; }
    function px(a, x, y, r, g, b) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; var i = (y * W + x) * 3; a[i] = r; a[i + 1] = g; a[i + 2] = b; }
    function grad(a, t, b) { for (var y = 0; y < H; y++) { var f = y / (H - 1); for (var x = 0; x < W; x++) px(a, x, y, t[0] + (b[0] - t[0]) * f, t[1] + (b[1] - t[1]) * f, t[2] + (b[2] - t[2]) * f); } }
    function disc(a, cx, cy, rad, col, glow) {
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
        if (d < rad) px(a, x, y, col[0], col[1], col[2]);
        else if (glow && d < rad * glow) { var h = 1 - (d - rad) / (rad * (glow - 1)), i = (y * W + x) * 3; a[i] += (col[0] - a[i]) * h * 0.6; a[i + 1] += (col[1] - a[i + 1]) * h * 0.6; a[i + 2] += (col[2] - a[i + 2]) * h * 0.6; }
      }
    }
    function ring(a, cx, cy, rad, thick, col) { for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var dx = x - cx, dy = y - cy; if (Math.abs(Math.sqrt(dx * dx + dy * dy) - rad) < thick) px(a, x, y, col[0], col[1], col[2]); } }
    function ground(a, atY, c1, c2) { for (var y = atY | 0; y < H; y++) { var f = (y - atY) / (H - atY); for (var x = 0; x < W; x++) px(a, x, y, c1[0] + (c2[0] - c1[0]) * f, c1[1] + (c2[1] - c1[1]) * f, c1[2] + (c2[2] - c1[2]) * f); } }
    function tri(a, cx, baseY, halfW, peakY, col) { for (var y = peakY | 0; y < baseY; y++) { var f = (y - peakY) / (baseY - peakY), hw = halfW * f; for (var x = (cx - hw) | 0; x <= cx + hw; x++) px(a, x, y, col[0], col[1], col[2]); } }
    function band(a, amp, base, h, col) { for (var x = 0; x < W; x++) { var yy = base + Math.sin(x / W * 6.5 + amp) * h; for (var y = yy | 0; y < yy + H * 0.16; y++) px(a, x, y, col[0], col[1], col[2]); } }
    function stars(a, n, col) { for (var s = 0; s < n; s++) px(a, Math.random() * W, Math.random() * H * 0.7, col[0], col[1], col[2]); }
    var cx = W * 0.5, cy = H * 0.5;
    var PAL = [
      { sky: [250, 180, 90], deep: [120, 55, 95], acc: [255, 235, 170] },   // sunset
      { sky: [20, 42, 92], deep: [12, 95, 115], acc: [232, 242, 255] },     // ocean
      { sky: [44, 14, 16], deep: [232, 92, 22], acc: [255, 212, 84] },      // lava
      { sky: [150, 200, 170], deep: [60, 120, 80], acc: [235, 245, 200] },  // forest
      { sky: [26, 12, 52], deep: [70, 24, 92], acc: [240, 230, 255] },      // galaxy
      { sky: [10, 16, 36], deep: [16, 42, 58], acc: [70, 210, 155] },       // aurora
      { sky: [232, 122, 202], deep: [120, 30, 112], acc: [255, 224, 244] }, // berry
      { sky: [246, 212, 150], deep: [200, 140, 84], acc: [255, 246, 202] }  // sand
    ];
    var SCENES = [
      function (a, P) { grad(a, P.sky, P.deep); disc(a, W * 0.5, H * 0.44, MIN * 0.22, P.acc, 1.8); ground(a, H * 0.72, mix(P.deep, P.sky, 0.25), dark(P.deep)); },                 // sun
      function (a, P) { grad(a, P.sky, P.deep); disc(a, W * 0.7, H * 0.3, MIN * 0.15, P.acc, 1.5); stars(a, 7, P.acc); ground(a, H * 0.62, P.deep, dark(P.deep)); },                // moon + water
      function (a, P) { grad(a, P.sky, P.deep); tri(a, W * 0.5, H * 0.86, W * 0.44, H * 0.26, dark(P.deep)); tri(a, W * 0.26, H * 0.84, W * 0.32, H * 0.46, P.deep); ground(a, H * 0.82, P.deep, dark(P.deep)); }, // mountains
      function (a, P) { grad(a, P.sky, P.deep); disc(a, cx, cy, MIN * 0.27, P.acc, 2.0); disc(a, cx, cy, MIN * 0.12, mix(P.acc, P.deep, 0.5)); },                                   // orb
      function (a, P) { grad(a, dark(P.sky), P.deep); band(a, 0, H * 0.4, H * 0.12, P.acc); band(a, 2.2, H * 0.52, H * 0.1, mix(P.acc, P.sky, 0.4)); stars(a, 8, P.acc); },         // aurora bands
      function (a, P) { grad(a, dark(P.deep), [8, 12, 12]); ring(a, cx, cy, MIN * 0.42, 2, P.acc); ring(a, cx, cy, MIN * 0.29, 2, mix(P.acc, P.deep, 0.5)); ring(a, cx, cy, MIN * 0.16, 2, P.acc); disc(a, cx, cy, 2.4, P.acc); } // target rings
    ];
    var pool = [];
    for (var pi = 0; pi < PAL.length; pi++) for (var si = 0; si < SCENES.length; si++) {
      var buf = new Uint8ClampedArray(W * H * 3); SCENES[si](buf, PAL[pi]); pool.push(buf);
    }
    return pool;   // 8 × 6 = 48 distinct images
  }

  // The SAMPLING monitor: a contact-sheet of many thumbnails resolving from
  // noise → images, like a batch being generated. reverse(dur,onTick,onDone)
  // streams them in (onTick(p) drives a "N / 50,000 images" counter);
  // idle(k) parks a static frame (k=1 all noise, k=0 all images).
  function makeMontage(canvas, cols, rows) {
    var stub = { reverse: function (d, t, done) { if (done) done(); }, idle: function () {}, stop: function () {} };
    if (!canvas || !canvas.getContext) return stub;
    var ctx = canvas.getContext("2d"); if (!ctx) return stub;
    var W = canvas.width, H = canvas.height, gap = 2;
    var cw = Math.floor(W / cols), ch = Math.floor(H / rows);
    var tw = cw - gap, th = ch - gap, cells = cols * rows;
    var pool = buildTargetPool(tw, th);            // 48 distinct images
    var img = ctx.createImageData(W, H);
    // 10 distinct grids; each fills its cells with UNIQUE images (sampled
    // without replacement). Draws cycle through the 10 grids.
    function shuffledRange(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); for (var j = n - 1; j > 0; j--) { var m = Math.floor(Math.random() * (j + 1)), t = a[j]; a[j] = a[m]; a[m] = t; } return a; }
    var GRIDS = [];
    for (var g = 0; g < 10; g++) GRIDS.push(shuffledRange(pool.length).slice(0, cells));
    var gi = 0, startFrac = [];
    function randomizeStarts() { for (var k = 0; k < cells; k++) startFrac[k] = Math.random() * 0.5; }
    function nextGrid() { gi = (gi + 1) % GRIDS.length; randomizeStarts(); }
    randomizeStarts();
    function cellNoise(p, k) {
      var local = (p - startFrac[k]) / (1 - startFrac[k]);   // each cell resolves on its own clock
      if (local < 0) local = 0; else if (local > 1) local = 1;
      return Math.pow(1 - local, 1.7);
    }
    function render(p, forceK) {
      var d = img.data;
      for (var i = 0; i < W * H; i++) { var o = i * 4; d[o] = 6; d[o + 1] = 20; d[o + 2] = 15; d[o + 3] = 255; }
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var k = r * cols + c, kn = (forceK == null) ? cellNoise(p, k) : forceK, thumb = pool[GRIDS[gi][k]];
        var ox = c * cw + (gap >> 1), oy = r * ch + (gap >> 1);
        for (var ty = 0; ty < th; ty++) for (var tx = 0; tx < tw; tx++) {
          var ti = (ty * tw + tx) * 3, rr = thumb[ti], gg = thumb[ti + 1], bb = thumb[ti + 2];
          if (kn > 0.002) { rr = rr * (1 - kn) + Math.random() * 255 * kn; gg = gg * (1 - kn) + Math.random() * 255 * kn; bb = bb * (1 - kn) + Math.random() * 255 * kn; }
          var X = ox + tx, Y = oy + ty; if (X >= W || Y >= H) continue;
          var o2 = (Y * W + X) * 4; d[o2] = rr; d[o2 + 1] = gg; d[o2 + 2] = bb; d[o2 + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    var raf = null;
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
    return {
      reverse: function (dur, onTick, onDone) {
        stop(); nextGrid(); var t0 = null;
        (function step(ts) {
          if (t0 == null) t0 = ts;
          var p = Math.min(1, (ts - t0) / dur);
          render(p, null); if (onTick) onTick(p);
          if (p < 1) raf = requestAnimationFrame(step); else { raf = null; if (onDone) onDone(); }
        })(performance.now());
      },
      idle: function (k) { stop(); render(0, k == null ? 0 : k); },
      stop: stop
    };
  }

  // The TRAINING monitor: a diffusion training step — a NOISY image x_t is
  // fed through the denoiser ε_θ and comes out cleaner (x̂₀); the output
  // resolves from noise → image as the model trains, with a loss curve in a
  // separate strip below. Reads as "training a diffusion model to denoise."
  function makeTrainViz(canvas) {
    if (!canvas || !canvas.getContext) return { train: function (d, t, done) { if (done) done(); }, idle: function () {}, stop: function () {} };
    var ctx = canvas.getContext("2d"); if (!ctx) return { train: function (d, t, done) { if (done) done(); }, idle: function () {}, stop: function () {} };
    var W = canvas.width || 200, H = canvas.height || 150;
    function faintGold(a) { return "rgba(236,209,133," + a + ")"; }
    function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

    var TILE = 52, ty = 14, lx = 12, rx = W - 12 - TILE, cyT = ty + TILE / 2;
    var DIV = 86, LX0 = 12, LX1 = W - 10, LY0 = 101, LY1 = 143;

    // small procedural landscape (what the model learns to generate / denoise)
    var target = (function () {
      var a = new Uint8ClampedArray(TILE * TILE * 3), sx = TILE * 0.66, sy = TILE * 0.32, sr = TILE * 0.17;
      for (var y = 0; y < TILE; y++) { var ny = y / TILE; for (var x = 0; x < TILE; x++) {
        var r, g, b;
        if (ny < 0.6) { var t = ny / 0.6; r = 250 + (155 - 250) * t; g = 205 + (180 - 205) * t; b = 120 + (150 - 120) * t;
          var dx = x - sx, dy = y - sy; if (Math.sqrt(dx * dx + dy * dy) < sr) { r = 255; g = 236; b = 150; } }
        else { var t2 = (ny - 0.6) / 0.4; r = 92 + (40 - 92) * t2; g = 150 + (90 - 150) * t2; b = 82 + (50 - 82) * t2; }
        var i = (y * TILE + x) * 3; a[i] = r; a[i + 1] = g; a[i + 2] = b;
      } }
      return a;
    })();

    function drawTile(ox, oy, k) {
      var img = ctx.createImageData(TILE, TILE), d = img.data, useN = k > 0.002;
      for (var i = 0; i < TILE * TILE; i++) {
        var o3 = i * 3, o4 = i * 4, r = target[o3], g = target[o3 + 1], b = target[o3 + 2];
        if (useN) { r = r * (1 - k) + Math.random() * 255 * k; g = g * (1 - k) + Math.random() * 255 * k; b = b * (1 - k) + Math.random() * 255 * k; }
        d[o4] = r; d[o4 + 1] = g; d[o4 + 2] = b; d[o4 + 3] = 255;
      }
      ctx.putImageData(img, ox, oy);
      ctx.strokeStyle = faintGold(0.45); ctx.lineWidth = 1; ctx.strokeRect(ox - 0.5, oy - 0.5, TILE + 1, TILE + 1);
    }
    function arrow(x1, x2, y) {
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2 - 3, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x2 - 5, y - 3); ctx.lineTo(x2 - 5, y + 3); ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle; ctx.fill();
    }

    var N_LOSS = 96, LOSS_HI = 0.46, LOSS_LO = 0.09, lossSeries = new Array(N_LOSS);
    function genLoss() {
      for (var k = 0; k < N_LOSS; k++) { var t = k / (N_LOSS - 1), base = LOSS_LO + (LOSS_HI - LOSS_LO) * Math.exp(-3.2 * t); lossSeries[k] = base + (Math.random() * 2 - 1) * 0.045 * (0.25 + 0.75 * (1 - t)); }
      lossSeries[0] = LOSS_HI;
    }
    genLoss();
    function lossAt(p) { var fk = p * (N_LOSS - 1), k0 = Math.floor(fk), k1 = Math.min(N_LOSS - 1, k0 + 1), f = fk - k0; return lossSeries[k0] * (1 - f) + lossSeries[k1] * f; }

    function drawNetwork(p, t, animated) {
      var bx = 80, bw = 40, by = cyT - 13, bh = 26;
      ctx.strokeStyle = faintGold(0.55); ctx.lineWidth = 1.4;
      arrow(lx + TILE, bx, cyT); arrow(bx + bw, rx, cyT);
      // the denoiser box ε_θ (fills in as it trains)
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 5); else ctx.rect(bx, by, bw, bh);
      ctx.fillStyle = "rgba(224,191,106," + (0.14 + 0.5 * p) + ")"; ctx.fill();
      ctx.strokeStyle = "#e0bf6a"; ctx.lineWidth = 1.2; ctx.stroke();
      // ε_θ — render θ as a proper subscript (smaller + dropped) rather than full
      // size beside ε, and centre the whole "ε_θ" unit in the box.
      ctx.fillStyle = "#fdf6e3"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.font = "13px ui-monospace, monospace";
      var epsW = ctx.measureText("ε").width;
      ctx.font = "9px ui-monospace, monospace";
      var subW = ctx.measureText("θ").width;
      var glyphX = bx + bw / 2 - (epsW + subW) / 2;
      ctx.font = "13px ui-monospace, monospace";
      ctx.fillText("ε", glyphX, cyT + 1);
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText("θ", glyphX + epsW, cyT + 4);
      ctx.font = "13px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      // a pulse flowing input → network → output
      if (animated) {
        var tt = (t * 0.85) % 1, px = (lx + TILE) + (rx - (lx + TILE)) * tt;
        ctx.fillStyle = "#f3e2a6"; ctx.beginPath(); ctx.arc(px, cyT, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawLoss(p) {
      var plotW = LX1 - LX0, plotH = LY1 - LY0;
      function ly(v) { var lo = LOSS_LO - 0.02, hi = LOSS_HI + 0.03, t = clamp01((v - lo) / (hi - lo)); return LY1 - t * plotH; }
      ctx.strokeStyle = faintGold(0.18); ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(LX0, LY1 + 0.5); ctx.lineTo(LX1, LY1 + 0.5); ctx.stroke();
      ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = faintGold(0.3); ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(LX0, ly(LOSS_LO)); ctx.lineTo(LX1, ly(LOSS_LO)); ctx.stroke(); ctx.restore();
      var revealK = Math.max(1, Math.round(p * (N_LOSS - 1)));
      ctx.strokeStyle = "#e0bf6a"; ctx.lineWidth = 1.2; ctx.beginPath();
      for (var k = 0; k <= revealK; k++) { var px = LX0 + plotW * (k / (N_LOSS - 1)), py = ly(lossSeries[k]); if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.stroke();
      var curLoss = lossAt(p), headX = LX0 + plotW * p;
      ctx.fillStyle = "#f3e2a6"; ctx.beginPath(); ctx.arc(headX, ly(curLoss), 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillStyle = faintGold(0.75); ctx.textAlign = "left"; ctx.fillText("loss", LX0, LY0 - 4);
      ctx.fillStyle = "#f6efdc"; ctx.textAlign = "right"; ctx.fillText(curLoss.toFixed(2), LX1, LY0 - 4);
      ctx.textAlign = "left";
    }

    function renderFrame(p, t, animated) {
      p = clamp01(p);
      ctx.fillStyle = "#06140f"; ctx.fillRect(0, 0, W, H);
      // left = noisy input x_t (noise level flickers → a random diffusion timestep)
      var kIn = animated ? (0.42 + 0.4 * Math.abs(Math.sin(t * 2.6 + 0.6))) : 0.7;
      drawTile(lx, ty, kIn);
      // right = the model's denoised output, resolving as it trains
      drawTile(rx, ty, Math.pow(1 - p, 1.5));
      drawNetwork(p, t, animated);
      // tile captions
      ctx.font = "9px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillStyle = faintGold(0.72);
      ctx.fillText("noisy  x_t", lx + TILE / 2, ty + TILE + 11);
      ctx.fillText("denoised", rx + TILE / 2, ty + TILE + 11);
      ctx.textAlign = "left";
      // divider between the diffusion step and the loss strip
      ctx.strokeStyle = faintGold(0.16); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, DIV); ctx.lineTo(W, DIV); ctx.stroke();
      drawLoss(p);
    }

    var raf = null;
    function cancel() { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } }
    return {
      train: function (durMs, onTick, onDone) {
        cancel(); durMs = durMs || 4000; genLoss(); var start = performance.now(), done = false;
        (function step(now) {
          var p = clamp01((now - start) / durMs), tSec = (now - start) / 1000;
          renderFrame(p, tSec, true);
          if (onTick) onTick(p, lossAt(p));
          if (p >= 1) { if (!done) { done = true; raf = null; if (onDone) onDone(); } return; }
          raf = requestAnimationFrame(step);
        })(performance.now());
      },
      idle: function (prog) { cancel(); renderFrame(clamp01(prog == null ? 0 : prog), 0, false); },
      stop: cancel
    };
  }

  window.FLCharts.slot = function (stage, FL, opts) {
    opts = opts || {};
    if (!stage) return;
    ensureSprite();
    var panel = FL && FL.baseline && Array.isArray(FL.baseline.panel) ? FL.baseline.panel : [];
    if (!panel.length) return;

    var B = FL.baseline;
    var GRAND = typeof B.grand_mean === "number" ? B.grand_mean : 34.744;
    var JACKPOT_AT = typeof B.cell_p10 === "number" ? B.cell_p10 : 34.11;
    var N = panel.length;
    // K = sampling seeds per network in the real Act-I panel (25×K). The generation
    // lottery shows exactly K mini machines, each reading out one real sampling-seed FID.
    var K = (panel[0] && panel[0].fids && panel[0].fids.length) || 10;
    var theme = FLUtils.theme(stage);

    // elements
    var trainHost   = stage.querySelector("#reels-train");
    var trainSeedEl = stage.querySelector("#train-seed");
    var leverTrain  = stage.querySelector("#lever-train");
    var slotTrainEl = stage.querySelector("#slot-train");
    var trainMsgEl  = stage.querySelector("#train-msg");
    var autoLever   = stage.querySelector("#lever-auto");
    var autoBtnMobile = stage.querySelector("#auto-mobile");   // mobile-only bottom CTA
    var sampleSideEl = stage.querySelector(".sample-side");
    var graphEl      = stage.querySelector(".lottery-graph");
    var AUTO_AT     = 3, TOTAL_DRAWS = N, mobileNav = false;   // reveal auto-button after N draws
    function scrollToEl(el) { if (mobileNav && el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" }); }
    var grid        = stage.querySelector("#sample-grid");
    var ticketEl    = stage.querySelector("#ticket");
    var ticketSeed  = stage.querySelector("#ticket-seed");
    var sampleOfEl  = stage.querySelector("#sample-of");
    var countEl     = stage.querySelector("#slot-count");
    var resetBtn    = stage.querySelector("#slot-reset");
    var captionEl   = stage.querySelector("#slot-caption");
    var jackpotEl   = stage.querySelector("#jackpot");
    var statMainEl  = stage.querySelector("#stat-main");
    var trainCap    = stage.querySelector("#train-monitor-cap");
    var sampleCap   = stage.querySelector("#sample-monitor-cap");
    var trainViz    = makeTrainViz(stage.querySelector("#train-canvas"));
    var sampleViz   = makeMontage(stage.querySelector("#sample-canvas"), 5, 4);
    function imgCount(p) { return Math.min(50000, Math.round(p * 50000)).toLocaleString(); }

    // ---------- reel strip builders ----------
    var STRIP_REPEATS = 9;
    function fillStrip(strip, syms, cls) {
      var html = "";
      for (var r = 0; r < STRIP_REPEATS; r++)
        for (var s = 0; s < syms.length; s++)
          html += '<div class="' + cls + '">' + glyphHTML(syms[s]) + "</div>";
      strip.innerHTML = html;
      strip.style.transition = "none";
      strip.style.transform = "translateY(0px)";
    }
    function cellH(reel, fallback) {
      var c = reel.querySelector(".reel__cell, .mini-cell");
      if (c) { var h = c.getBoundingClientRect().height; if (h > 4) return h; }
      return fallback;
    }

    // training reels
    var trainStrips = [];
    if (trainHost) ORDER_TRAIN.forEach(function (key, i) {
      var reel = trainHost.querySelector('.reel[data-reel="' + key + '"]');
      if (!reel) return;
      var strip = reel.querySelector(".reel__strip");
      fillStrip(strip, SYM_TRAIN[key], "reel__cell");
      trainStrips.push({ key: key, idx: i, reel: reel, strip: strip, syms: SYM_TRAIN[key] });
    });

    // K mini machines — one per real sampling seed in the panel
    var minis = [];
    if (grid) {
      grid.innerHTML = "";
      for (var i = 0; i < K; i++) {
        var slot = document.createElement("div"); slot.className = "mini-slot";
        var cab = document.createElement("div"); cab.className = "mini-cab";
        var reel = document.createElement("div"); reel.className = "mini-reel";
        var strip = document.createElement("div"); strip.className = "mini-strip";
        fillStrip(strip, MINI_SYMS, "mini-cell");
        reel.appendChild(strip);
        var lever = document.createElement("button"); lever.className = "mini-lever"; lever.type = "button"; lever.disabled = true;
        lever.setAttribute("aria-label", "re-roll this sampling seed");
        lever.appendChild(Object.assign(document.createElement("span"), { className: "mini-lever__stick" }));
        cab.appendChild(reel); cab.appendChild(lever);
        var fid = document.createElement("div"); fid.className = "mini-fid pending"; fid.textContent = "—";
        slot.appendChild(cab); slot.appendChild(fid); grid.appendChild(slot);
        (function (idx) { lever.addEventListener("click", function () { rerollOne(idx); }); })(i);
        minis.push({ reel: reel, strip: strip, fid: fid, lever: lever, idx: i });
      }
    }

    // ---------- spin engine ----------
    function settleTransform(reel, strip, syms, symIdx, fb) {
      var ch = cellH(reel, fb), len = syms.length;
      var absoluteCell = Math.floor(STRIP_REPEATS / 2) * len + (symIdx % len);
      return -(absoluteCell - 1) * ch;
    }
    function planSpin(reel, syms, symIdx, fb, extraLoops) {
      var ch = cellH(reel, fb), len = syms.length, period = len * ch;
      var bandBase = 2 * period;
      var targetMod = (((symIdx - 1) % len + len) % len) * ch;
      var endMod = (targetMod + ch) % period;
      return {
        period: period, bandBase: bandBase,
        distEnd: (5 + extraLoops) * period + endMod,
        restY: -(bandBase + targetMod), spinEndY: -(bandBase + endMod)
      };
    }
    // shared rAF ticker for all spinning reels (training + minis)
    var active = [], ticking = false;
    function tick(ts) {
      var live = false;
      for (var k = 0; k < active.length; k++) {
        var a = active[k]; if (a.done) continue;
        if (a.t0 == null) a.t0 = ts;
        var x = Math.min(1, (ts - a.t0) / (a.dur * 1000));
        var d = distProfile(x) * a.p.distEnd;
        a.strip.style.transition = "none";
        a.strip.style.transform = "translateY(" + (-(a.p.bandBase + (d % a.p.period))) + "px)";
        if (x >= 0.9) a.strip.style.filter = "";
        if (x >= 1) {
          a.strip.style.transition = "none";
          a.strip.style.transform = "translateY(" + a.p.spinEndY + "px)";
          void a.strip.offsetHeight;
          a.strip.style.transition = "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)";
          a.strip.style.transform = "translateY(" + a.p.restY + "px)";
          a.done = true; if (a.onDone) a.onDone();
        } else live = true;
      }
      if (live) requestAnimationFrame(tick);
      else { ticking = false; active = []; }
    }
    function spin(reel, strip, syms, symIdx, dur, fb, extraLoops, onDone) {
      strip.style.filter = "blur(0.7px)";
      active.push({ strip: strip, p: planSpin(reel, syms, symIdx, fb, extraLoops), dur: dur, t0: null, done: false, onDone: onDone });
      if (!ticking) { ticking = true; requestAnimationFrame(tick); }
    }

    // ---------- the lottery joint plot ----------
    // TOP: a progressively-built density of network-mean FIDs (the training
    // lottery), with the min↔max FID gap bracketed. BOTTOM: the 2D scatter,
    // x = network mean FID (training), y = each sample FID (generation). The
    // gold means spread WIDE horizontally while each blue column stays SHORT
    // vertically — the training-vs-generation gap, in one picture.
    function makeLotteryGraph(mount) {
      if (!mount) return { addPoint: function () {}, markMean: function () {}, reset: function () {}, meansX: function () { return []; } };
      var hMeasure = mount.clientHeight || 0, Wm = mount.clientWidth || 320;
      var H = hMeasure > 320 ? hMeasure : Math.round(Wm * 1.4);
      var dim = FLUtils.svg(mount, { height: H, margin: { top: 8, right: 14, bottom: 34, left: 54 } });
      var DOM = [33.3, 35.8];
      var x = d3.scaleLinear().domain(DOM).range([0, dim.iw]);
      var topPad = 22;                                                 // header band so the density title clears the curve
      var densBandH = Math.max(120, Math.min(188, dim.ih * 0.36));     // a fuller density band fills the top
      var densBase = topPad + densBandH, gapY = densBase + 26, scatterTop = densBase + 46, scatterBot = dim.ih;
      var y = d3.scaleLinear().domain(DOM).range([scatterBot, scatterTop]);

      x.ticks(4).forEach(function (t) { dim.g.append("line").attr("class", "fl-grid").attr("x1", x(t)).attr("x2", x(t)).attr("y1", 0).attr("y2", scatterBot); });
      y.ticks(4).forEach(function (t) { dim.g.append("line").attr("class", "fl-grid").attr("x1", 0).attr("x2", dim.iw).attr("y1", y(t)).attr("y2", y(t)); });
      dim.g.append("line").attr("x1", x(DOM[0])).attr("y1", y(DOM[0])).attr("x2", x(DOM[1])).attr("y2", y(DOM[1]))
        .attr("stroke", theme.faint).attr("stroke-opacity", 0.3).attr("stroke-dasharray", "3 4");
      dim.g.append("g").attr("class", "fl-axis").attr("transform", "translate(0," + dim.ih + ")")
        .call(d3.axisBottom(x).ticks(4).tickFormat(function (d) { return d.toFixed(1); }).tickSizeOuter(0));
      dim.g.append("g").attr("class", "fl-axis").call(d3.axisLeft(y).ticks(4).tickFormat(function (d) { return d.toFixed(1); }).tickSizeOuter(0));
      dim.g.append("text").attr("class", "fl-axis-label").attr("x", dim.iw / 2).attr("y", dim.ih + 30).attr("text-anchor", "middle").text("network mean FID · training");
      dim.g.append("text").attr("class", "fl-axis-label").attr("transform", "rotate(-90)").attr("x", -(scatterTop + scatterBot) / 2).attr("y", -44).attr("text-anchor", "middle").text("sample FID · generation");
      dim.g.append("text").attr("class", "fl-axis-label").attr("x", 0).attr("y", 14).attr("fill", theme.train).text("DENSITY OF NETWORK MEANS");

      var densArea = dim.g.append("path").attr("fill", theme.band).attr("stroke", theme.train).attr("stroke-width", 1.3).attr("stroke-opacity", 0.9);
      var gapMin = dim.g.append("line").attr("stroke", theme.goldBright).attr("stroke-dasharray", "2 3").attr("stroke-opacity", 0);
      var gapMax = dim.g.append("line").attr("stroke", theme.goldBright).attr("stroke-dasharray", "2 3").attr("stroke-opacity", 0);
      var gapLine = dim.g.append("line").attr("stroke", theme.goldBright).attr("stroke-width", 1.2).attr("stroke-opacity", 0);
      var gapLabel = dim.g.append("text").attr("class", "fl-axis-label").attr("fill", theme.goldBright).attr("text-anchor", "middle").attr("opacity", 0);
      var ptLayer = dim.g.append("g"), meanLayer = dim.g.append("g");
      var meansX = [], reduced = function () { return FLUtils.reduced(); };

      var NS = 64, BW = 0.07, xs = [];
      for (var s = 0; s <= NS; s++) xs.push(DOM[0] + (DOM[1] - DOM[0]) * s / NS);
      function kde(vals) {
        return xs.map(function (xv) { var sum = 0; for (var i = 0; i < vals.length; i++) { var u = (xv - vals[i]) / BW; sum += Math.exp(-0.5 * u * u); } return sum / (vals.length * BW * 2.5066); });
      }
      function redrawDensity() {
        if (!meansX.length) { densArea.attr("d", null); [gapMin, gapMax, gapLine].forEach(function (g) { g.attr("stroke-opacity", 0); }); gapLabel.attr("opacity", 0); return; }
        var dens = kde(meansX), mx = Math.max.apply(null, dens) || 1;
        var area = d3.area().curve(d3.curveBasis).x(function (d, i) { return x(xs[i]); }).y0(densBase).y1(function (d) { return densBase - (d / mx) * (densBandH - 2); });
        densArea.datum(dens).attr("d", area);
        var lo = Math.min.apply(null, meansX), hi = Math.max.apply(null, meansX), show = meansX.length > 1 ? 1 : 0;
        gapMin.attr("x1", x(lo)).attr("x2", x(lo)).attr("y1", topPad + 2).attr("y2", scatterBot).attr("stroke-opacity", show ? 0.4 : 0);
        gapMax.attr("x1", x(hi)).attr("x2", x(hi)).attr("y1", topPad + 2).attr("y2", scatterBot).attr("stroke-opacity", show ? 0.4 : 0);
        gapLine.attr("x1", x(lo)).attr("x2", x(hi)).attr("y1", gapY).attr("y2", gapY).attr("stroke-opacity", show ? 0.9 : 0);
        gapLabel.attr("x", (x(lo) + x(hi)) / 2).attr("y", gapY - 6).attr("opacity", show).text("min↔max gap  Δ " + (hi - lo).toFixed(2) + " FID");
      }

      return {
        addPoint: function (mx, fy, animate) {
          var jx = (Math.random() - 0.5) * 7;
          var c = ptLayer.append("circle").attr("cx", x(mx) + jx).attr("cy", y(fy)).attr("r", (animate && !reduced()) ? 0 : 2.7)
            .attr("fill", theme.sample).attr("fill-opacity", 0.62);
          if (animate && !reduced()) c.transition().duration(220).attr("r", 2.7);
        },
        markMean: function (mx, animate) {
          meansX.push(mx);
          var c = meanLayer.append("circle").attr("cx", x(mx)).attr("cy", y(mx)).attr("r", (animate && !reduced()) ? 0 : 4.2)
            .attr("fill", theme.train).attr("stroke", theme.goldBright).attr("stroke-width", 1).attr("stroke-opacity", 0.75);
          if (animate && !reduced()) c.transition().duration(320).ease(d3.easeBackOut).attr("r", 4.2);
          redrawDensity();
        },
        reset: function () { ptLayer.selectAll("*").remove(); meanLayer.selectAll("*").remove(); meansX = []; redrawDensity(); },
        meansX: function () { return meansX.slice(); }
      };
    }
    // put the one-row pinned layout in place BEFORE the graph measures its height,
    // so its SVG fills the stretched card instead of the shorter wrapped layout.
    (function () {
      var pinEl = stage.closest && stage.closest(".lottery-pin");
      var pinOK = window.innerWidth >= 980 && !(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
      if (pinEl && pinOK) pinEl.classList.add("pin-active");
    })();
    var graph = makeLotteryGraph(stage.querySelector("#hist-main"));

    function stat(arr) {
      if (!arr || arr.length < 1) return null;
      var m = d3.mean(arr), sd = arr.length > 1 ? d3.deviation(arr) : 0;
      return { mean: m, sd: sd || 0, cov: m ? 100 * (sd || 0) / m : 0 };
    }
    function showMainStat() {
      if (!statMainEl) return;
      var ss = stat((curSamples || []).filter(function (z) { return z != null; }));
      var ms = stat(graph.meansX());
      var parts = [];
      if (ss && ss.sd > 0) parts.push("samples σ " + ss.sd.toFixed(2));
      if (ms && ms.sd > 0) parts.push("network means σ " + ms.sd.toFixed(2));
      if (ss && ms && ss.sd > 0 && ms.sd > 0) parts.push("→ " + (ms.sd / ss.sd).toFixed(1) + "× wider");
      statMainEl.textContent = parts.length ? parts.join("  ·  ") : "draw a network to begin";
    }

    // ---------- jackpot ----------
    function jackpot(fid, seed) {
      if (!jackpotEl) return;
      var banner = document.createElement("div");
      banner.className = "jackpot-banner";
      banner.innerHTML =
        '<div class="jackpot-sign">' +
          '<span class="jackpot-lights"></span>' +
          '<div class="jackpot-word">Paper accepted<br>at NeurIPS</div>' +
          '<div class="jackpot-sub">seed <b>' + seed + '</b> · lucky FID <b>' + fid.toFixed(2) + '</b></div>' +
          '<span class="jackpot-lights jackpot-lights--b"></span>' +
        '</div>';
      jackpotEl.appendChild(banner);
      void banner.offsetWidth; banner.classList.add("show");
      // on mobile the overlay is viewport-fixed, so coins should fall a viewport-
      // relative distance (stage is the full tall floor → would overshoot wildly).
      var H = (window.innerWidth < 980) ? window.innerHeight : (stage.clientHeight || 560);
      for (var i = 0; i < 28; i++) {
        var c = document.createElement("div"); c.className = "coin";
        var sz = 16 + Math.round(Math.random() * 12);
        c.style.left = (Math.random() * 96) + "%";
        c.style.width = c.style.height = sz + "px";
        c.style.setProperty("--cf-dist", (H * 0.8 + Math.random() * H * 0.3) + "px");
        c.style.setProperty("--cf-rot", (480 + Math.random() * 720) + "deg");
        c.style.animationDuration = (1.5 + Math.random() * 1.1) + "s";
        c.style.animationDelay = (Math.random() * 0.5) + "s";
        c.textContent = "★";
        jackpotEl.appendChild(c);
      }
      setTimeout(function () { while (jackpotEl.firstChild) jackpotEl.removeChild(jackpotEl.firstChild); }, 3200);
    }

    // ---------- state ----------
    var pulls = 0, busy = false, bag = [], current = null, autoTimer = null, pinSync = null, pinRelayout = null, pinRelease = null;
    function nextNetwork() {
      if (!bag.length) {
        bag = panel.map(function (_, i) { return i; });
        for (var i = bag.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
      }
      var idx = bag.pop(); return panel[idx];
    }

    function setCaption(net, samples, lucky) {
      if (!captionEl) return;
      var sLo = d3.min(samples).toFixed(2), sHi = d3.max(samples).toFixed(2);
      var msg;
      if (lucky) {
        msg = "Jackpot — seed " + net.seed + " drew a sample as low as " + sLo + ". A lucky seed, not a better recipe.";
      } else if (pulls >= 6) {
        var st = stat(graph.meansX()), ss = stat(samples);
        var ratio = (ss && ss.sd > 0 && st && st.sd > 0) ? (st.sd / ss.sd).toFixed(1) : "—";
        msg = "Across networks the spread is ≈" + ratio + "× wider than within one network. The training lottery dominates the generation lottery.";
      } else if (pulls >= 2) {
        msg = "seed " + net.seed + ": its " + K + " samples cluster in [" + sLo + ", " + sHi + "] — but the network means keep drifting. Pull again.";
      } else {
        msg = "Network seed " + net.seed + " scored: " + K + " samples in [" + sLo + ", " + sHi + "]. Now draw another network.";
      }
      captionEl.textContent = msg;
    }

    var curSamples = new Array(minis.length);

    function pullMiniLever(m) {
      if (!m || !m.lever) return;
      m.lever.classList.remove("pulled"); void m.lever.offsetWidth; m.lever.classList.add("pulled");
      setTimeout(function () { m.lever.classList.remove("pulled"); }, 500);
    }
    function setMiniLevers(disabled) { minis.forEach(function (m) { if (m.lever) m.lever.disabled = disabled; }); updateAuto(); }
    // the blue "Speed up" lever on the right of the training machine: armed once AUTO_AT
    // networks are drawn, pulling it auto-samples the rest. It lives in the machine's
    // horizontal space, so arming it never changes the pinned layout height (no rescale).
    function updateAuto() {
      var armed = pulls >= AUTO_AT && pulls < TOTAL_DRAWS;
      if (autoLever) autoLever.disabled = busy || !armed;
      // mobile: a bottom "Draw all" button (the top-of-machine lever scrolls out of
      // view), shown once the first draw lands and hidden once the set is complete.
      if (autoBtnMobile) { autoBtnMobile.hidden = !(mobileNav && armed); autoBtnMobile.disabled = busy; }
    }
    function pullAuto() {
      if (!autoLever) return;
      autoLever.classList.remove("pulled"); void autoLever.offsetWidth; autoLever.classList.add("pulled");
      setTimeout(function () { autoLever.classList.remove("pulled"); }, 600);
    }

    // spin ONE mini machine → one sampling-seed FID for `net`.
    // toGraph=true plots the sample on the lottery graph (full run only).
    function spinOneMini(net, i, salt, toGraph, doneCb) {
      var m = minis[i];
      // initial fill (salt 0): mini i shows the REAL i-th sampling-seed FID, so all K are
      // shown once. A re-roll (salt ≠ 0) redraws a random one of this network's K seeds.
      var v = salt === 0 ? net.fids[i] : net.fids[Math.floor(Math.random() * net.fids.length)];
      var lucky = v <= JACKPOT_AT;
      var dur = 0.7 + Math.random() * 0.5;
      pullMiniLever(m);
      m.fid.className = "mini-fid pending"; m.fid.textContent = "—";
      spin(m.reel, m.strip, MINI_SYMS, symbolIndexFor(net.seed * 97 + i * 7 + 1 + salt, 0, MINI_SYMS.length), dur, 62, 2 + (i % 4), function () {
        m.fid.textContent = v.toFixed(2);
        m.fid.className = "mini-fid" + (lucky ? " lucky" : "");
        curSamples[i] = v; if (toGraph) graph.addPoint(net.mean, v, true);
        if (doneCb) doneCb(v, lucky);
      });
    }

    // fan 25 small tickets from the training machine out to each mini machine;
    // each ticket's arrival triggers that machine's spin.
    function flyTickets(net, onArrive) {
      var srcEl = (ticketEl && ticketEl.classList.contains("show")) ? ticketEl : slotTrainEl;
      if (!srcEl || !srcEl.animate) { minis.forEach(function (_, i) { onArrive(i); }); return; }
      var sr = srcEl.getBoundingClientRect(), sx = sr.left + sr.width * 0.5, sy = sr.top + sr.height * 0.4;
      minis.forEach(function (m, i) {
        var mr = m.reel.getBoundingClientRect(), dxm = (mr.left + mr.width / 2) - sx, dym = (mr.top + mr.height / 2) - sy;
        var arc = -26 - Math.random() * 22, spin0 = Math.random() * 30 - 15;
        var tk = document.createElement("div"); tk.className = "fly-ticket";
        tk.style.left = sx + "px"; tk.style.top = sy + "px";
        document.body.appendChild(tk);
        var anim = tk.animate([
          { transform: "translate(-50%,-50%) translate(0,0) scale(.6) rotate(" + spin0 + "deg)", opacity: 0, offset: 0 },
          { opacity: 1, offset: 0.18 },
          { transform: "translate(-50%,-50%) translate(" + (dxm * 0.5) + "px," + (dym * 0.5 + arc) + "px) scale(1) rotate(" + (spin0 * -0.6) + "deg)", opacity: 1, offset: 0.6 },
          { transform: "translate(-50%,-50%) translate(" + dxm + "px," + dym + "px) scale(.45) rotate(0deg)", opacity: 0, offset: 1 }
        ], { duration: 600, delay: i * 26, easing: "cubic-bezier(.4,0,.3,1)", fill: "forwards" });
        var fired = false;
        function arr() { if (fired) return; fired = true; try { anim.cancel(); } catch (e) {} if (tk.parentNode) tk.parentNode.removeChild(tk); if (onArrive) onArrive(i); }
        anim.onfinish = arr; setTimeout(arr, i * 26 + 700);
      });
    }

    function finalizeFull(net) {
      pulls += 1; if (countEl) countEl.textContent = String(pulls);
      var minS = d3.min(curSamples), lucky = minS <= JACKPOT_AT;
      graph.markMean(net.mean, true);   // the network's gold mean dot on the diagonal
      showMainStat();
      setCaption(net, curSamples, lucky);
      if (lucky) setTimeout(function () { jackpot(minS, net.seed); }, 140);
      busy = false;
      if (leverTrain) leverTrain.disabled = false;
      setMiniLevers(false);
      if (trainMsgEl) trainMsgEl.innerHTML = "<b>" + pulls + "</b> / " + TOTAL_DRAWS + " networks drawn — pull again";
      maybeRevealAuto();
      if (pulls >= TOTAL_DRAWS) onAllDrawn();   // reached the full set (e.g. via the lever) → offer reset
      scrollToEl(graphEl);                     // mobile: transport to the plot
      if (pinSync) setTimeout(pinSync, 60);   // fire the next scroll-queued draw
    }

    // a full generation run: 25 tickets fan out, each machine spins on arrival.
    function runGenerationFull(net) {
      busy = true;
      if (leverTrain) leverTrain.disabled = true;
      setMiniLevers(true);
      if (sampleOfEl) sampleOfEl.textContent = "seed " + net.seed;
      curSamples = new Array(minis.length);   // graph accumulates columns across pulls
      minis.forEach(function (m) { m.fid.textContent = "—"; m.fid.className = "mini-fid pending"; });
      sampleViz.reverse(1700,
        function (p) { if (sampleCap) sampleCap.textContent = "generating " + imgCount(p) + " / 50,000 images"; },
        function () { sampleViz.idle(0); if (sampleCap) sampleCap.textContent = "50,000 images → compute one FID"; });
      var done = 0;
      flyTickets(net, function (i) {
        spinOneMini(net, i, 0, true, function () { done += 1; if (done === minis.length) finalizeFull(net); });
      });
    }

    // re-roll a single sampling seed on the CURRENT network (its own lever).
    function rerollOne(i) {
      if (busy || !current) return;
      busy = true;
      if (leverTrain) leverTrain.disabled = true;
      setMiniLevers(true);
      if (captionEl) captionEl.textContent = "Re-rolling one sampling seed on seed " + current.seed + " — same network.";
      spinOneMini(current, i, 991 + Math.floor(Math.random() * 9000), false, function (v, lucky) {
        showMainStat();
        if (lucky) setTimeout(function () { jackpot(v, current.seed); }, 120);
        busy = false;
        if (leverTrain) leverTrain.disabled = false;
        setMiniLevers(false);
      });
    }

    function pullArm() {
      if (!leverTrain) return;
      leverTrain.classList.remove("pulled"); void leverTrain.offsetWidth; leverTrain.classList.add("pulled");
      setTimeout(function () { leverTrain.classList.remove("pulled"); }, 600);
    }
    function maybeRevealAuto() { updateAuto(); }   // arms the side lever (no layout change)

    // a fast, animation-light draw used by the auto-sampler.
    function autoDraw() {
      var net = nextNetwork(); current = net;
      var samples = new Array(minis.length);
      trainStrips.forEach(function (so, i) { so.strip.style.transition = "none"; so.strip.style.transform = "translateY(" + settleTransform(so.reel, so.strip, so.syms, symbolIndexFor(net.seed, i, so.syms.length), 44) + "px)"; });
      for (var i = 0; i < minis.length; i++) {
        var v = net.fids[i];                       // each mini = one real sampling-seed FID
        samples[i] = v; graph.addPoint(net.mean, v, false);
        var m = minis[i]; m.fid.textContent = v.toFixed(2); m.fid.className = "mini-fid" + (v <= JACKPOT_AT ? " lucky" : "");
      }
      graph.markMean(net.mean, false);
      curSamples = samples;
      pulls += 1; if (countEl) countEl.textContent = String(pulls);
      if (trainSeedEl) trainSeedEl.textContent = "seed " + net.seed;
      if (sampleOfEl) sampleOfEl.textContent = "seed " + net.seed;
      showMainStat();
    }

    function finishAuto() {
      busy = false;
      if (leverTrain) leverTrain.disabled = false;
      setMiniLevers(false);
      if (trainMsgEl) trainMsgEl.innerHTML = "<b>" + TOTAL_DRAWS + "</b> networks drawn — the full lottery";
      if (captionEl) captionEl.textContent = "All " + TOTAL_DRAWS + " networks drawn. Network means spread far wider than the samples within any one network — the training lottery dominates.";
      onAllDrawn();
    }

    // ----- reset: replay the whole lottery from scratch -----
    function showReset() { if (resetBtn) resetBtn.hidden = false; }
    function hideReset() { if (resetBtn) resetBtn.hidden = true; }
    function onAllDrawn() { if (pinRelease) pinRelease(); showReset(); }   // free the scroll + offer a reset
    function resetLottery() {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      graph.reset();
      pulls = 0; busy = false; current = null; bag = []; curSamples = new Array(minis.length);
      if (countEl) countEl.textContent = "0";
      minis.forEach(function (m) { m.fid.textContent = "—"; m.fid.className = "mini-fid pending"; });
      if (ticketEl) ticketEl.classList.remove("show");
      if (trainSeedEl) trainSeedEl.textContent = "seed —";
      if (sampleOfEl) sampleOfEl.textContent = "your network";
      if (trainMsgEl) trainMsgEl.innerHTML = "Pull the lever to draw a network";
      trainViz.idle(0); sampleViz.idle(1);
      showMainStat();
      if (leverTrain) leverTrain.disabled = false;
      setMiniLevers(true);
      updateAuto();
      hideReset();
    }

    // automate the remaining draws, accelerating until all 25 are drawn.
    function autoSample() {
      if (busy) return;
      busy = true;
      if (leverTrain) leverTrain.disabled = true;
      setMiniLevers(true);
      pullAuto();
      sampleViz.idle(0); if (sampleCap) sampleCap.textContent = "auto-sampling networks…";
      var startAt = pulls;
      (function step() {
        if (pulls >= TOTAL_DRAWS) { finishAuto(); return; }
        autoDraw();
        if (trainMsgEl) trainMsgEl.innerHTML = "auto-sampling… <b>" + pulls + "</b> / " + TOTAL_DRAWS;
        var delay = Math.max(55, Math.round(340 * Math.pow(0.84, pulls - startAt)));  // accelerate
        autoTimer = setTimeout(step, delay);
      })();
    }

    function pullTrain() {
      if (busy) return;
      busy = true;
      if (leverTrain) leverTrain.disabled = true;
      setMiniLevers(true);
      pullArm();
      if (trainMsgEl) trainMsgEl.textContent = "Training a network…";
      var net = nextNetwork(); current = net;
      if (ticketEl) ticketEl.classList.remove("show");
      minis.forEach(function (m) { m.fid.textContent = "—"; m.fid.className = "mini-fid pending"; });
      if (captionEl) captionEl.textContent = "Spinning the training reels…";
      sampleViz.idle(1);
      if (sampleCap) sampleCap.textContent = "waiting for the tickets…";
      trainViz.train(1760,
        function (p, loss) { if (trainCap) trainCap.textContent = "training · loss " + loss.toFixed(3) + " ↓"; },
        function () { if (trainCap) trainCap.textContent = "trained · loss converged"; });
      var durs = [1.35, 1.42, 1.5], done = 0;
      trainStrips.forEach(function (so, i) {
        spin(so.reel, so.strip, so.syms, symbolIndexFor(net.seed, i, so.syms.length), durs[i] || 1.5, 44, 2 + i, function () { done += 1; });
      });
      setTimeout(function () {
        if (trainSeedEl) trainSeedEl.textContent = "seed " + net.seed;
        if (ticketSeed) ticketSeed.textContent = "seed " + net.seed;
        if (ticketEl) ticketEl.classList.add("show");
        if (captionEl) captionEl.textContent = "A book of " + minis.length + " tickets prints for seed " + net.seed + " — one flies to each machine…";
        scrollToEl(sampleSideEl);              // mobile: transport to the generation lottery
        setTimeout(function () { runGenerationFull(net); }, 520);
      }, durs[durs.length - 1] * 1000 + 260);
    }

    // ---------- pinned scroll scene (desktop): scrolling drives the draws ----------
    function setupPin() {
      var pin = stage.closest && stage.closest(".lottery-pin");
      if (!pin) return;
      var scene = pin.querySelector(".lottery-scene"), inner = pin.querySelector(".lottery-inner");
      var enabled = window.innerWidth >= 980 && !(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
      if (!enabled) { pin.classList.remove("pin-active"); pin.style.height = ""; if (inner) inner.style.transform = ""; pinSync = null; pinRelayout = null; mobileNav = true; AUTO_AT = 1; return; }
      pin.classList.add("pin-active");
      var TRACK = 4.6;   // pin height in viewport-heights (scroll distance to finish)
      function layout() {
        if (!released) pin.style.height = (window.innerHeight * TRACK) + "px";
        if (!inner) return;
        // offsetWidth/Height are layout (untransformed) metrics, so we can measure
        // without resetting the transform — that lets the scale animate smoothly
        // and lets us re-fit whenever the floor's content height changes.
        var nw = inner.offsetWidth, nh = inner.offsetHeight;
        // The floor renders at a fixed natural size, so on a normal laptop/desktop
        // it just fits the viewport (cap = 1). On a genuinely large display (TV,
        // 1440p+) leaving the cap at 1 strands it at natural size in a sea of empty
        // margin, so we let it grow to fill the wide pinned scene — the real limit
        // is the available width/height below, so the cap only stops absurd zoom on
        // ultra-wide panels. Below ~1600px nothing changes.
        var big = Math.min(scene.clientWidth, window.innerWidth);
        var maxUp = big >= 1600 ? Math.min(2.8, big / 1320) : 1;
        var s = Math.min(maxUp, (window.innerHeight * 0.92) / nh, (scene.clientWidth * 0.98) / nw);
        inner.style.transform = "scale(" + (s > 0 ? s : 1) + ")";
      }
      var lastP = 0, autoStarted = false, released = false;
      function syncPin(p) {
        lastP = p;
        if (busy || released) return;   // once the full lottery is drawn (released), scroll no longer draws
        var want = (p >= 0.12 ? 1 : 0) + (p >= 0.30 ? 1 : 0) + (p >= 0.48 ? 1 : 0);
        if (!autoStarted && pulls < want && pulls < 3) { pullTrain(); return; }
        if (!autoStarted && p >= 0.64 && pulls >= 3) { autoStarted = true; autoSample(); return; }
      }
      pinSync = function () { syncPin(lastP); };
      // re-fit the floor to one screen whenever its content height changes
      // (e.g. the "Sample all 25" button appearing / disappearing).
      pinRelayout = function () { layout(); onScroll(); };
      // once every network is drawn, collapse the leftover (dead) pin-track so the
      // scene unpins right here and scrolling continues straight to the next section.
      pinRelease = function () {
        released = true;
        var scrolled = Math.max(0, -pin.getBoundingClientRect().top);
        var newH = Math.round(scrolled + window.innerHeight);
        if (newH < pin.offsetHeight) pin.style.height = newH + "px";
      };
      function onScroll() {
        var total = pin.offsetHeight - window.innerHeight;
        var p = total > 0 ? Math.min(1, Math.max(0, -pin.getBoundingClientRect().top / total)) : 0;
        syncPin(p);
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      var rt = null;
      window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { layout(); onScroll(); }, 150); });
      layout(); onScroll();
    }

    // ---------- init ----------
    if (resetBtn) resetBtn.addEventListener("click", resetLottery);
    if (autoBtnMobile) {
      autoBtnMobile.textContent = "⚡ Draw all " + TOTAL_DRAWS + " networks";
      autoBtnMobile.addEventListener("click", function () { if (!autoBtnMobile.disabled) autoSample(); });
    }
    if (opts.play === true) {
      var rep = panel[Math.floor(N / 2)];
      trainStrips.forEach(function (so, i) { so.strip.style.transition = "none"; so.strip.style.transform = "translateY(" + settleTransform(so.reel, so.strip, so.syms, symbolIndexFor(rep.seed, i, so.syms.length), 44) + "px)"; });
      var repSamples = [];
      minis.forEach(function (m, i) {
        var v = rep.fids[i % rep.fids.length]; repSamples.push(v);
        m.strip.style.transition = "none";
        m.strip.style.transform = "translateY(" + settleTransform(m.reel, m.strip, MINI_SYMS, symbolIndexFor(rep.seed * 97 + i, 0, MINI_SYMS.length), 62) + "px)";
        m.fid.textContent = v.toFixed(2);
        m.fid.className = "mini-fid" + (v <= JACKPOT_AT ? " lucky" : "");
      });
      curSamples = repSamples.slice();
      graph.reset();
      panel.forEach(function (pp) { pp.fids.forEach(function (v) { graph.addPoint(pp.mean, v, false); }); graph.markMean(pp.mean, false); });
      showMainStat();
      if (trainSeedEl) trainSeedEl.textContent = "seed " + rep.seed;
      if (ticketSeed) ticketSeed.textContent = "seed " + rep.seed;
      if (sampleOfEl) sampleOfEl.textContent = "seed " + rep.seed;
      if (ticketEl) ticketEl.classList.add("show");
      pulls = N; if (countEl) countEl.textContent = String(N); showReset();
      if (captionEl) captionEl.textContent = "Sampling spread (this network): narrow. Training spread (across networks): ≈3.2× wider. That is the FID lottery.";
      trainViz.idle(1); if (trainCap) trainCap.textContent = "trained · loss converged";
      sampleViz.idle(0); if (sampleCap) sampleCap.textContent = "50,000 images → compute one FID";
      current = rep;
      setMiniLevers(false);
      if (trainMsgEl) trainMsgEl.innerHTML = "<b>" + N + "</b> networks drawn — the full lottery";
      if (leverTrain) leverTrain.addEventListener("click", pullTrain);
      if (autoLever) autoLever.addEventListener("click", function () { if (!autoLever.disabled) { pullAuto(); autoSample(); } });
      updateAuto();
      setupPin();
      return;
    }

    // idle screens: training shows an empty loss plot; sampling shows pure noise
    trainViz.idle(0);
    sampleViz.idle(1);
    setMiniLevers(true);
    if (leverTrain) leverTrain.addEventListener("click", pullTrain);
    if (autoLever) autoLever.addEventListener("click", function () { if (!autoLever.disabled) { pullAuto(); autoSample(); } });
    updateAuto();
    setupPin();
  };
})();
