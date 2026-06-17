/* ===================================================================
   ink.js — the Introduction's old-book ink marginalia.
   Fills the generous side margins with engraving-style allegories of
   chance, drawn in sepia + rubricated red and "inked on" by a pen
   when the intro scrolls into view. Inspired by Borges, "The Lottery
   in Babylon".

     · headpiece  — a banner with a turning wheel-of-fortune rosette
     · left rail  — an URN OF LOTS at the base, a climbing vine of
                    numbered lots ascending the full margin (the draw)
     · right rail — a TREE OF OUTCOMES: one seed forking again and
                    again into many inkblot fates (chance at every stage)
     · tailpiece  — a closing fleuron;  + page-frame corner curls, motes

   The two rails are generated to the *measured* column height, so they
   fill the margin whatever the prose length. Pure SVG + CSS, no deps.
   =================================================================== */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var PLAY = /[?&]play=1/.test(location.search);

  // ---- tiny SVG helpers ----
  function E(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  }
  function f(n) { return Math.round(n * 100) / 100; }
  function dly(node, d) { if (d != null) node.style.setProperty("--d", f(d) + "s"); return node; }
  function dur(node, x) { if (x != null) node.style.setProperty("--dur", x + "s"); return node; }
  function R(a, b) { return a + Math.random() * (b - a); }
  function mulberry32(a) {           // stable PRNG → identical art each load
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function svgFit(mount, w, h) {     // 1:1 svg that fills the mount exactly
    while (mount.firstChild) mount.removeChild(mount.firstChild);
    return E("svg", { viewBox: "0 0 " + w + " " + h, preserveAspectRatio: "none" }, mount);
  }
  function svgBox(mount, w, h) {     // aspect-preserving svg (headpiece / tailpiece)
    while (mount.firstChild) mount.removeChild(mount.firstChild);
    var s = E("svg", { viewBox: "0 0 " + w + " " + h, preserveAspectRatio: "xMidYMid meet" }, mount);
    s.style.width = "100%"; s.style.height = "auto"; s.style.display = "block"; s.style.overflow = "visible";
    return s;
  }

  function path(parent, d, cls, o) {
    o = o || {};
    var p = E("path", { d: d, class: "ink-stroke ink-draw" + (cls ? " " + cls : ""), pathLength: 1 }, parent);
    if (o.sw != null) p.setAttribute("stroke-width", o.sw);
    dly(p, o.d); dur(p, o.dur);
    return p;
  }
  function ring(parent, cx, cy, r, cls, o) {
    o = o || {};
    var c = E("circle", { cx: f(cx), cy: f(cy), r: f(r), class: "ink-stroke ink-draw" + (cls ? " " + cls : ""), pathLength: 1 }, parent);
    if (o.sw != null) c.setAttribute("stroke-width", o.sw);
    dly(c, o.d); dur(c, o.dur);
    return c;
  }
  function ellipse(parent, cx, cy, rx, ry, cls, o) {
    o = o || {};
    var e = E("ellipse", { cx: f(cx), cy: f(cy), rx: rx, ry: ry, class: "ink-stroke ink-draw" + (cls ? " " + cls : ""), pathLength: 1 }, parent);
    if (o.sw != null) e.setAttribute("stroke-width", o.sw);
    dly(e, o.d); dur(e, o.dur);
    return e;
  }
  function blob(parent, cx, cy, r, cls, d) {
    var c = E("circle", { cx: f(cx), cy: f(cy), r: f(r), class: "ink-fill ink-bloom" + (cls ? " " + cls : "") }, parent);
    return dly(c, d);
  }
  function diamond(parent, cx, cy, r, cls, d) {
    var p = E("path", {
      d: "M" + f(cx) + " " + f(cy - r) + "L" + f(cx + r) + " " + f(cy) + "L" + f(cx) + " " + f(cy + r) + "L" + f(cx - r) + " " + f(cy) + "Z",
      class: "ink-fill ink-bloom" + (cls ? " " + cls : "")
    }, parent);
    return dly(p, d);
  }
  function numeral(parent, cx, cy, str, sz, d) {
    var t = E("text", { x: f(cx), y: f(cy + sz * 0.34), "text-anchor": "middle", "font-size": sz, class: "ink-txt ink-fade", text: str }, parent);
    return dly(t, d);
  }
  // smooth an open polyline with mid-point quadratics
  function smooth(p) {
    if (p.length < 3) return "M" + p.map(function (q) { return f(q[0]) + " " + f(q[1]); }).join(" L");
    var d = "M " + f(p[0][0]) + " " + f(p[0][1]);
    for (var i = 1; i < p.length - 2; i++) {
      var xc = (p[i][0] + p[i + 1][0]) / 2, yc = (p[i][1] + p[i + 1][1]) / 2;
      d += " Q " + f(p[i][0]) + " " + f(p[i][1]) + " " + f(xc) + " " + f(yc);
    }
    d += " Q " + f(p[p.length - 2][0]) + " " + f(p[p.length - 2][1]) + " " + f(p[p.length - 1][0]) + " " + f(p[p.length - 1][1]);
    return d;
  }
  // a meandering vertical stem from bottom (yB) to top (yT)
  function climbPoints(x0, yB, yT, amp, waves) {
    var pts = [], n = Math.max(8, Math.round((yB - yT) / 26));
    for (var i = 0; i <= n; i++) {
      var t = i / n, y = yB - (yB - yT) * t;
      var x = x0 + Math.sin(t * Math.PI * waves) * amp * (0.45 + 0.55 * t);
      pts.push([x, y]);
    }
    return pts;
  }

  function injectDefs() {
    if (document.getElementById("fl-ink-defs")) return;
    var s = E("svg", { id: "fl-ink-defs", width: 0, height: 0 });
    s.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
    var defs = E("defs", {}, s);
    var fr = E("filter", { id: "fl-ink-rough", x: "-25%", y: "-25%", width: "150%", height: "150%" }, defs);
    E("feTurbulence", { type: "fractalNoise", baseFrequency: "0.013 0.017", numOctaves: 2, seed: 7, result: "n" }, fr);
    E("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 2.4, xChannelSelector: "R", yChannelSelector: "G" }, fr);
    document.body.appendChild(s);
  }

  // ============================ HEADPIECE ============================
  function buildHeadpiece(mount) {
    var W = 540, H = 90, cx = 270, cy = 48;
    var svg = svgBox(mount, W, H);
    function half(g) {
      path(g, "M44 48 C 76 45 104 51 140 48 C 176 45 206 51 236 48", "", { d: 0.2, dur: 1.2, sw: 1.7 });
      path(g, "M64 42.5 C 104 40 156 45 230 42.5", "ink-stroke--fine", { d: 0.5, dur: 1.0 });
      path(g, "M44 48 C 30 48 25 39 34 35 C 40 32.5 45.5 37 43 41", "ink-stroke--rubric", { d: 1.15, dur: 0.8 });
      diamond(g, 150, 48, 4.5, "ink-fill--rubric", 1.0);
      diamond(g, 196, 48, 3, "ink-fill--rubric", 1.15);
    }
    half(E("g", { class: "ink-soft" }, svg));
    half(E("g", { class: "ink-soft", transform: "translate(" + W + ",0) scale(-1,1)" }, svg));

    var ros = E("g", { class: "ink-soft" }, svg);
    ring(ros, cx, cy, 21, "", { d: 0.85, dur: 1.0, sw: 1.7 });
    ring(ros, cx, cy, 16, "ink-stroke--fine", { d: 1.05, dur: 0.9 });
    var spokes = E("g", { class: "rosette-spin" }, ros);
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2;
      path(spokes, "M" + f(cx + Math.cos(a) * 7) + " " + f(cy + Math.sin(a) * 7) +
        "L" + f(cx + Math.cos(a) * 19) + " " + f(cy + Math.sin(a) * 19), "ink-stroke--fine", { d: 1.25 + i * 0.02, dur: 0.6 });
    }
    for (var j = 0; j < 12; j++) {
      var b = (j / 12) * Math.PI * 2 + Math.PI / 12;
      blob(ros, cx + Math.cos(b) * 24, cy + Math.sin(b) * 24, j % 2 ? 1.5 : 2, j % 2 ? "ink-fill--rubric" : "", 1.5 + j * 0.03);
    }
    blob(ros, cx, cy, 6.5, "ink-fill--rubric", 1.2);
    blob(ros, cx, cy, 2, "ink-fill--deep", 1.45);
  }

  // ============================ TAILPIECE ===========================
  function buildTailpiece(mount) {
    var W = 240, H = 48, cx = 120, cy = 24;
    var svg = svgBox(mount, W, H);
    function half(g) {
      path(g, "M114 24 C 92 24 78 15 56 17 C 40 18.5 31 27 35 32 C 38 35.5 46 33.5 44 28.5", "", { d: 0.4, dur: 1.0, sw: 1.6 });
      path(g, "M86 22 C 70 20 58 24 50 30", "ink-stroke--fine ink-stroke--rubric", { d: 0.9, dur: 0.7 });
      blob(g, 35, 18, 2.4, "ink-fill--rubric", 1.0);
    }
    half(E("g", { class: "ink-soft" }, svg));
    half(E("g", { class: "ink-soft", transform: "translate(" + W + ",0) scale(-1,1)" }, svg));
    diamond(svg, cx, cy, 5.5, "ink-fill--rubric", 0.7);
    blob(svg, cx, cy, 1.6, "ink-fill--deep", 0.95);
    blob(svg, cx - 13, cy, 1.6, "ink-fill", 1.05);
    blob(svg, cx + 13, cy, 1.6, "ink-fill", 1.05);
  }

  // ===================== LEFT RAIL — URN OF LOTS ====================
  // a classical urn at the base; a vine of numbered lots climbs the margin.
  function drawUrn(g, cx, baseY, rng) {
    var u = E("g", { transform: "translate(" + f(cx - 84) + "," + f(baseY - 228) + ")" }, g);  // native base (84,228) → (cx,baseY)
    var prof = [[30, 90], [14, 106], [39, 138], [37, 164], [21, 190], [11, 203], [15, 209], [25, 223], [27, 228]];
    var pts = [];
    prof.forEach(function (p) { pts.push([84 - p[0], p[1]]); });
    for (var i = prof.length - 1; i >= 0; i--) pts.push([84 + prof[i][0], prof[i][1]]);
    path(u, smooth(pts), "", { d: 0.3, dur: 1.7, sw: 1.9 });
    ellipse(u, 84, 90, 30, 6, "", { d: 0.55, dur: 0.9, sw: 1.6 });
    ellipse(u, 84, 90, 22, 4, "ink-stroke--fine", { d: 0.85, dur: 0.8 });
    ellipse(u, 84, 228, 27, 5, "", { d: 0.7, dur: 0.9, sw: 1.6 });
    path(u, "M70 110 C 40 113 33 140 49 151", "", { d: 1.0, dur: 0.9, sw: 1.6 });
    path(u, "M98 110 C 128 113 135 140 119 151", "", { d: 1.1, dur: 0.9, sw: 1.6 });
    path(u, "M48 150 Q84 157 120 150", "ink-stroke--fine", { d: 1.3, dur: 0.7 });
    path(u, "M50 159 Q84 166 118 159", "ink-stroke--fine", { d: 1.4, dur: 0.7 });
    [60, 84, 108].forEach(function (lx, k) { diamond(u, lx, 154.5, 3, "ink-fill--rubric", 1.5 + k * 0.08); });
    path(u, "M64 116 Q58 150 66 186", "ink-stroke--fine", { d: 1.2, dur: 0.8 });
    path(u, "M104 116 Q110 150 102 186", "ink-stroke--fine", { d: 1.35, dur: 0.8 });
    return baseY - 138;   // mouth-top y, where the vine starts
  }

  function drawLeaf(g, x, y, side, len, delay) {
    var ex = x + side * len, ey = y - len * 0.62;
    var d = "M" + f(x) + " " + f(y) +
      " Q" + f(x + side * len * 0.28) + " " + f(y - len * 0.92) + " " + f(ex) + " " + f(ey) +
      " Q" + f(x + side * len * 0.72) + " " + f(y - len * 0.16) + " " + f(x) + " " + f(y) + "Z";
    dly(E("path", { d: d, class: "ink-fill ink-bloom" }, g), delay);
  }

  var NUMS = ["7", "3", "9", "2", "5", "8", "4", "6", "1", "23"];
  function buildLeftRail(mount) {
    var cw = mount.clientWidth, ch = mount.clientHeight;
    if (!cw || !ch) return;
    var svg = svgFit(mount, cw, ch);
    var g = E("g", { class: "ink-soft" }, svg);
    var rng = mulberry32(0x10770);
    var cx = cw * 0.5;
    var baseY = ch - 12;
    var mouthY = drawUrn(g, cx, baseY, rng);

    var yB = mouthY - 4, yT = 26, span = yB - yT;
    var amp = Math.min(30, cw * 0.2);
    var pts = climbPoints(cx, yB, yT, amp, 2.3);
    path(g, smooth(pts), "", { d: 0.5, dur: 2.9, sw: 2.0 });          // the climbing stem
    // a small terminal curl at the very top
    var top = pts[pts.length - 1];
    path(g, "M" + f(top[0]) + " " + f(top[1]) + " C " + f(top[0] - 9) + " " + f(top[1] - 4) + " " + f(top[0] - 11) + " " + f(top[1] - 13) + " " + f(top[0] - 3) + " " + f(top[1] - 15) + " C " + f(top[0] + 4) + " " + f(top[1] - 16) + " " + f(top[0] + 5) + " " + f(top[1] - 9) + " " + f(top[0] + 1) + " " + f(top[1] - 9), "ink-stroke--rubric", { d: 3.0, dur: 0.7 });

    // lots + leaves budding along the vine (lower ones ink first)
    var every = 4, ni = 0;
    for (var i = 3; i < pts.length - 2; i += every) {
      var nd = pts[i], side = (ni % 2 ? 1 : -1);
      var hf = (yB - nd[1]) / span;                 // 0 bottom .. 1 top
      var bd = 1.0 + hf * 2.4;
      var len = 14 + rng() * 16;
      var ex = nd[0] + side * len, ey = nd[1] - 6 - rng() * 7;
      path(g, "M" + f(nd[0]) + " " + f(nd[1]) + " Q" + f((nd[0] + ex) / 2) + " " + f(nd[1] - 10) + " " + f(ex) + " " + f(ey), "", { d: bd, dur: 0.5, sw: 1.5 });
      var r = 5 + rng() * 1.8;
      var rub = (ni % 3 === 0);
      blob(g, ex, ey, r, rub ? "ink-fill--rubric" : "", bd + 0.4);
      ring(g, ex, ey, r + 1.1, "ink-stroke--fine", { d: bd + 0.5, dur: 0.5 });
      if (ni % 2 === 0) numeral(g, ex, ey, NUMS[ni % NUMS.length], 7, bd + 0.6);
      if (rng() < 0.7) drawLeaf(g, nd[0], nd[1] + 2, -side, 9 + rng() * 7, bd + 0.1);
      ni++;
    }
  }

  // =================== RIGHT RAIL — TREE OF OUTCOMES ================
  function drawBranch(g, x, y, side, rng, bd) {
    var a = 0.6 + rng() * 0.42, len = 58 + rng() * 56;
    var ex = x + side * Math.sin(a) * len, ey = y - Math.cos(a) * len;
    var mx = (x + ex) / 2, my = (y + ey) / 2, bow = 7 + rng() * 11;
    path(g, "M" + f(x) + " " + f(y) + " Q" + f(mx - side * bow * 0.5) + " " + f(my - bow) + " " + f(ex) + " " + f(ey), "", { d: bd, dur: 0.6, sw: 1.7 });
    blob(g, ex, ey, 2.3 + rng() * 2.5, rng() < 0.16 ? "ink-fill--rubric" : "", bd + 0.5);
    if (rng() < 0.45) {                       // a smaller twig + tip off the middle
      var a2 = a - 0.34, l2 = len * 0.5;
      var ex2 = mx + side * Math.sin(a2) * l2, ey2 = my - Math.cos(a2) * l2;
      path(g, "M" + f(mx) + " " + f(my) + " Q" + f(mx + side * 4) + " " + f(my - 6) + " " + f(ex2) + " " + f(ey2), "", { d: bd + 0.2, dur: 0.5, sw: 1.3 });
      blob(g, ex2, ey2, 1.8 + rng() * 1.6, "", bd + 0.7);
    }
  }
  function buildRightRail(mount) {
    var cw = mount.clientWidth, ch = mount.clientHeight;
    if (!cw || !ch) return;
    var svg = svgFit(mount, cw, ch);
    var g = E("g", { class: "ink-soft" }, svg);
    var rng = mulberry32(20260616);
    var cx = cw * 0.52;
    var yB = ch - 12, yT = 22, span = yB - yT;
    var pts = climbPoints(cx, yB, yT, Math.min(24, cw * 0.15), 1.9);

    // tapering trunk drawn bottom→top in three stacked segments
    var n = pts.length, a = Math.round(n * 0.34), b = Math.round(n * 0.67);
    path(g, smooth(pts.slice(0, a + 1)), "", { d: 0.3, dur: 1.1, sw: 3.4 });
    path(g, smooth(pts.slice(a, b + 1)), "", { d: 1.1, dur: 1.1, sw: 2.6 });
    path(g, smooth(pts.slice(b)), "", { d: 1.9, dur: 1.1, sw: 1.8 });

    // seed + ground at the root
    path(g, "M" + f(cx - 24) + " " + f(yB + 8) + " L" + f(cx + 24) + " " + f(yB + 8), "ink-stroke--fine", { d: 0.1, dur: 0.6 });
    [-16, -8, 8, 16].forEach(function (dx, k) {
      path(g, "M" + f(cx + dx) + " " + f(yB + 8) + " l" + (dx > 0 ? 5 : -5) + " 7", "ink-stroke--fine", { d: 0.15 + k * 0.04, dur: 0.5 });
    });
    blob(g, cx, yB + 2, 6.5, "ink-fill--deep", 0.1);
    ring(g, cx, yB + 2, 10.5, "", { d: 0.2, dur: 0.7, sw: 1.6 });
    blob(g, cx, yB + 2, 2.2, "ink-fill--rubric", 0.45);

    // forking branches all the way up
    var ni = 0;
    for (var i = 3; i < pts.length - 2; i += 3) {
      var nd = pts[i], hf = (yB - nd[1]) / span, bd = 0.6 + hf * 2.5;
      var side = (ni % 2 ? 1 : -1); if (rng() < 0.28) side = -side;
      drawBranch(g, nd[0], nd[1], side, rng, bd);
      if (rng() < 0.5) drawBranch(g, nd[0], nd[1], -side, rng, bd + 0.12);
      ni++;
    }
    // a crown fan of fates at the top
    var topN = pts[pts.length - 1];
    for (var c = -2; c <= 2; c++) {
      var ang = -Math.PI / 2 + c * 0.34, ln = 34 + rng() * 22;
      var ex = topN[0] + Math.cos(ang) * ln, ey = topN[1] + Math.sin(ang) * ln;
      path(g, "M" + f(topN[0]) + " " + f(topN[1]) + " Q" + f((topN[0] + ex) / 2 - c) + " " + f((topN[1] + ey) / 2 - 6) + " " + f(ex) + " " + f(ey), "", { d: 2.5 + c * 0.04, dur: 0.5, sw: 1.4 });
      blob(g, ex, ey, 2.2 + rng() * 2, c === 0 ? "ink-fill--rubric" : "", 3.0 + c * 0.04);
    }
  }

  // ========================= FRAME CORNERS / MOTES ==================
  function buildCorners(frame) {
    ["tl", "tr", "bl", "br"].forEach(function (pos, k) {
      var span = document.createElement("span");
      span.className = "leaf__corner " + pos;
      var svg = svgBox(span, 34, 34);
      var g = E("g", { class: "ink-soft" }, svg);
      path(g, "M3 17 C3 9 9 3 17 3", "ink-stroke--rubric", { d: 0.4 + k * 0.08, dur: 0.8, sw: 1.4 });
      path(g, "M17 3 C12.5 3 10 6.5 11 9.6 C11.6 11.4 14 11 13.6 9.2", "ink-stroke--rubric", { d: 0.7 + k * 0.08, dur: 0.6 });
      blob(g, 5.5, 5.5, 1.6, "ink-fill--rubric", 0.95 + k * 0.06);
      frame.appendChild(span);
    });
  }
  function buildMotes(field, n) {
    field.querySelectorAll(".ink-mote").forEach(function (m) { m.remove(); });
    for (var i = 0; i < n; i++) {
      var m = document.createElement("span");
      m.className = "ink-mote";
      var sz = R(4, 7);
      m.style.left = R(6, 94) + "%";
      m.style.top = R(38, 96) + "%";
      m.style.width = m.style.height = sz.toFixed(1) + "px";
      m.style.setProperty("--mt", R(14, 23).toFixed(1) + "s");
      m.style.setProperty("--md", R(0, 13).toFixed(1) + "s");
      field.appendChild(m);
    }
  }

  // build (and rebuild on resize) the measured full-height rails
  function buildRails() {
    var l = document.querySelector('.ink-art--urn'), r = document.querySelector('.ink-art--tree');
    try { if (l && l.clientWidth) buildLeftRail(l); } catch (e) { console.error("ink left failed:", e); }
    try { if (r && r.clientWidth) buildRightRail(r); } catch (e) { console.error("ink right failed:", e); }
  }

  function observe() {
    var intro = document.getElementById("intro");
    if (!intro) return;
    if (PLAY) { intro.classList.add("inked", "ink-play"); return; }
    if (!("IntersectionObserver" in window)) { intro.classList.add("inked"); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { intro.classList.add("inked"); io.disconnect(); } });
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    io.observe(intro);
  }

  function boot() {
    injectDefs();
    var hp = document.querySelector('[data-ink="headpiece"]'); if (hp) try { buildHeadpiece(hp); } catch (e) { console.error("ink headpiece failed:", e); }
    var tp = document.querySelector('[data-ink="tailpiece"]'); if (tp) try { buildTailpiece(tp); } catch (e) { console.error("ink tailpiece failed:", e); }
    var field = document.querySelector(".ink-field"); if (field) buildMotes(field, 7);
    var frame = document.querySelector(".leaf__frame"); if (frame) buildCorners(frame);
    buildRails();
    observe();

    // rebuild the measured rails when the width changes meaningfully
    var lastW = window.innerWidth, t = null;
    window.addEventListener("resize", function () {
      if (Math.abs(window.innerWidth - lastW) < 40) return;
      lastW = window.innerWidth;
      clearTimeout(t);
      t = setTimeout(buildRails, 240);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
