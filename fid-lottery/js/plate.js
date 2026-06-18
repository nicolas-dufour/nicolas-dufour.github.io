/* ===================================================================
   plate.js — the Introduction's engraved plate of the paper's teaser:
   every place randomness enters when one trains and then samples a
   generative model.

       TRAINING LOTTERY  (faint gold wash)        GENERATION  (faint blue)
         ① random init   ② data order              ⑤ initial noise → image
         ③ training noise ④ hardware  ─▶ trained net ─▶

   Drawn in sepia engraving + rubricated red — the SAME pen-stroke /
   ink-bloom technique as js/ink.js (so the strokes "ink themselves on"
   when #intro scrolls into view, via the .inked class ink.js toggles).
   The small components then keep moving: the 3D dice are tossed and
   bounce, the conveyor chevrons flow left→right, the noise tiles
   re-sample fresh speckle, and the trained-network medallion breathes
   a gold halo. Pure SVG + CSS, no deps.
   =================================================================== */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";

  // ---- tiny SVG helpers (same idiom as ink.js) ----
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
  function mulberry32(a) {                 // stable PRNG → identical speckle each load
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ensure the shared rough-ink filter exists (ink.js usually injects it first;
  // re-added defensively so the plate renders even if loaded standalone)
  function ensureDefs() {
    if (document.getElementById("fl-ink-defs")) return;
    var s = E("svg", { id: "fl-ink-defs", width: 0, height: 0 });
    s.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
    var defs = E("defs", {}, s);
    var fr = E("filter", { id: "fl-ink-rough", x: "-25%", y: "-25%", width: "150%", height: "150%" }, defs);
    E("feTurbulence", { type: "fractalNoise", baseFrequency: "0.013 0.017", numOctaves: 2, seed: 7, result: "n" }, fr);
    E("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 2.4, xChannelSelector: "R", yChannelSelector: "G" }, fr);
    document.body.appendChild(s);
  }

  // ---- ink primitives (draw-on strokes, blooming fills, fading numerals) ----
  function stroke(parent, d, cls, o) {
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
  function tile(parent, x, y, w, h, r, cls, o) {       // soft rounded tile, outline draws on
    o = o || {};
    var rc = E("rect", { x: f(x), y: f(y), width: f(w), height: f(h), rx: r, ry: r,
      class: (cls || "") + " ink-draw", pathLength: 1 }, parent);
    if (o.sw != null) rc.setAttribute("stroke-width", o.sw);
    dly(rc, o.d); dur(rc, o.dur);
    return rc;
  }
  function poly(parent, pts, cls, o) {                 // filled/outlined polygon, draws on
    o = o || {};
    var d = "M" + pts.map(function (p) { return f(p[0]) + " " + f(p[1]); }).join("L") + "Z";
    var p = E("path", { d: d, class: (cls || "") + " ink-draw", pathLength: 1 }, parent);
    if (o.sw != null) p.setAttribute("stroke-width", o.sw);
    dly(p, o.d); dur(p, o.dur);
    return p;
  }
  function blob(parent, cx, cy, r, cls, d) {
    var c = E("circle", { cx: f(cx), cy: f(cy), r: f(r), class: "ink-fill ink-bloom" + (cls ? " " + cls : "") }, parent);
    return dly(c, d);
  }
  function txt(parent, x, y, str, cls, o) {
    o = o || {};
    var t = E("text", { x: f(x), y: f(y), "text-anchor": o.anchor || "middle",
      class: (cls || "") + " ink-fade", text: str }, parent);
    return dly(t, o.d);
  }

  // ============================ ICONS ===============================
  // a small neural-net schematic (random = faint varied edges, trained = full)
  function netIcon(g, cx, cy, trained, base) {
    var rng = mulberry32(trained ? 4242 : 91);
    var L = cx - 23, M = cx, R = cx + 23;
    var ly = [cy - 15, cy, cy + 15], my = [cy - 21, cy - 7, cy + 7, cy + 21], ry = [cy - 15, cy, cy + 15];
    var edges = E("g", { class: "ink-soft" }, g);
    function link(x1, y1, x2, y2, k) {
      var d = "M" + f(x1) + " " + f(y1) + "L" + f(x2) + " " + f(y2);
      if (trained) {                                  // trained net: settled, drawn-on, static
        stroke(edges, d, "ink-stroke--fine", { d: base + 0.15 + k * 0.012, dur: 0.5, sw: 0.9 })
          .style.opacity = 0.6;
      } else {                                         // random init: weights shimmer (never pen-drawn)
        var e = E("path", { d: d, class: "ink-stroke ink-stroke--fine plate-winit" }, edges);
        e.setAttribute("stroke-width", 0.8);
        e.style.setProperty("--d", f(0.3 + rng() * 1.9) + "s");
        e.style.setProperty("--tm", f(1.5 + rng() * 1.5) + "s");
        e.style.setProperty("--op", f(0.32 + 0.5 * rng()));   // each weight peaks at its own opacity
      }
    }
    var k = 0;
    ly.forEach(function (a) { my.forEach(function (b) { link(L, a, M, b, k++); }); });
    my.forEach(function (a) { ry.forEach(function (b) { link(M, a, R, b, k++); }); });
    var j = 0;
    function node(x, y) { ring(g, x, y, 3.1, "plate-node", { d: base + 0.05 + j++ * 0.02, dur: 0.4, sw: 1.1 }); }
    ly.forEach(function (y) { node(L, y); });
    my.forEach(function (y) { node(M, y); });
    ry.forEach(function (y) { node(R, y); });
  }

  // a small framed photo: sky + sun + a single horizon (used in the data stack)
  function photoMini(g, cx, cy, half, base, rot) {
    var grp = E("g", rot ? { transform: "rotate(" + rot + " " + f(cx) + " " + f(cy) + ")" } : {}, g);
    tile(grp, cx - half, cy - half, 2 * half, 2 * half, 2, "plate-card plate-card--photo", { d: base, dur: 0.5, sw: 1 });
    blob(grp, cx + half * 0.4, cy - half * 0.42, half * 0.16, "ink-fill--rubric", base + 0.25);   // sun
    stroke(grp, "M" + f(cx - half) + " " + f(cy + half * 0.34) +
      "L" + f(cx - half * 0.2) + " " + f(cy - half * 0.18) + "L" + f(cx + half) + " " + f(cy + half * 0.34),
      "ink-stroke--fine", { d: base + 0.32, dur: 0.5, sw: 1 });
    return grp;
  }

  // ② data order — a neat row of three data examples, reshuffled: the two outer
  // tiles continuously trade places, and the two-crossing-arrows "shuffle" glyph
  // below pulses in time (the glyph alone reads "reorder" instantly at any size)
  function dataOrder(g, cx, cy, base) {
    var ys = cy - 9, half = 9;
    var tL = photoMini(g, cx - 22, ys, half, base + 0.1, 0);
    photoMini(g, cx, ys, half, base + 0.22, 0);
    var tR = photoMini(g, cx + 22, ys, half, base + 0.34, 0);
    tL.setAttribute("class", "plate-shuffle plate-shuffle--l"); tL.style.setProperty("--d", f(base + 1.1) + "s");
    tR.setAttribute("class", "plate-shuffle plate-shuffle--r"); tR.style.setProperty("--d", f(base + 1.1) + "s");
    // the shuffle glyph (its own group so it can pulse as one)
    var ag = E("g", { class: "plate-shufarrows" }, g);
    ag.style.setProperty("--d", f(base + 1.1) + "s");
    var ax = 18, top = cy + 7, bot = cy + 18;
    stroke(ag, "M" + f(cx - ax) + " " + f(bot) + " Q" + f(cx) + " " + f(bot) + " " + f(cx + ax - 3) + " " + f(top),
      "ink-stroke--fine", { d: base + 0.6, dur: 0.6, sw: 1.3 });
    stroke(ag, "M" + f(cx - ax) + " " + f(top) + " Q" + f(cx) + " " + f(top) + " " + f(cx + ax - 3) + " " + f(bot),
      "ink-stroke--fine", { d: base + 0.75, dur: 0.6, sw: 1.3 });
    stroke(ag, "M" + f(cx + ax - 8) + " " + f(top - 3.5) + "L" + f(cx + ax - 2) + " " + f(top) + "L" + f(cx + ax - 7) + " " + f(top + 4),
      "ink-stroke--rubric", { d: base + 0.95, dur: 0.3, sw: 1.3 });
    stroke(ag, "M" + f(cx + ax - 7) + " " + f(bot - 4) + "L" + f(cx + ax - 2) + " " + f(bot) + "L" + f(cx + ax - 8) + " " + f(bot + 3.5),
      "ink-stroke--rubric", { d: base + 1.0, dur: 0.3, sw: 1.3 });
  }

  // a patch of re-sampling noise: 3 speckle layers that cross-fade (looks alive)
  function noise(g, cx, cy, half, base) {
    tile(g, cx - half, cy - half, 2 * half, 2 * half, 2, "plate-card", { d: base, dur: 0.5, sw: 1 });
    var m = 5, step = (2 * half - 2) / m, x0 = cx - half + 1, y0 = cy - half + 1;
    for (var layer = 0; layer < 3; layer++) {
      var lg = E("g", { class: "plate-noiselayer" }, g);
      dly(lg, base + 0.55 + layer * 0.34);
      var rng = mulberry32(900 + layer * 37 + Math.round(cx));
      for (var i = 0; i < m; i++) for (var jx = 0; jx < m; jx++) {
        var v = rng();
        E("rect", { x: f(x0 + i * step), y: f(y0 + jx * step), width: f(step + 0.3), height: f(step + 0.3),
          class: "plate-ncell", "fill-opacity": f(0.08 + 0.78 * v * v) }, lg);
      }
    }
  }

  // ⑤ a clean little landscape — the *generated image* (sun, hills, water)
  function landscape(g, cx, cy, half, base) {
    var L = cx - half, R = cx + half, B = cy + half, T = cy - half;
    tile(g, L, T, 2 * half, 2 * half, 2.5, "plate-card plate-card--sky", { d: base, dur: 0.55, sw: 1 });
    blob(g, R - half * 0.42, T + half * 0.42, half * 0.26, "ink-fill--rubric", base + 0.3);          // sun
    // far hill (light) then near hill (darker), both seated on the waterline
    var wl = cy + half * 0.34;
    poly(g, [[L, wl], [L + half * 0.7, cy - half * 0.18], [cx + half * 0.05, wl]], "plate-hill plate-hill--far", { d: base + 0.4, dur: 0.5, sw: 0.8 });
    poly(g, [[cx - half * 0.35, wl], [cx + half * 0.45, cy - half * 0.42], [R, wl]], "plate-hill plate-hill--near", { d: base + 0.55, dur: 0.5, sw: 0.8 });
    stroke(g, "M" + f(L) + " " + f(wl) + "L" + f(R) + " " + f(wl), "ink-stroke--fine", { d: base + 0.7, dur: 0.4, sw: 0.9 }); // waterline
    stroke(g, "M" + f(L + half * 0.25) + " " + f(B - half * 0.3) + "q " + f(half * 0.4) + " 3 " + f(half * 0.8) + " 0",
      "ink-stroke--fine", { d: base + 0.85, dur: 0.4, sw: 0.7 });   // a ripple
  }

  // ④ hardware — a clearly graphics-card-shaped GPU (shroud + two fans + PCB lip)
  function gpuCard(g, cx, cy, w, base) {
    var h = w * 0.44;
    tile(g, cx - w / 2, cy + h / 2 - 2.5, w - 4, 4.5, 1, "plate-pcb", { d: base + 0.1, dur: 0.4, sw: 0.7 });   // PCB board lip
    tile(g, cx - w / 2, cy - h / 2, w, h, 2.2, "plate-card plate-gpu", { d: base, dur: 0.5, sw: 1 });           // cooler shroud
    stroke(g, "M" + f(cx - w / 2) + " " + f(cy - h / 2) + "l-4 0l0 " + f(h) + "l4 0", "ink-stroke--fine", { d: base + 0.2, dur: 0.4, sw: 0.9 }); // bracket
    [-0.23, 0.23].forEach(function (fr, i) {
      var fxp = cx + fr * w, fr2 = h * 0.3;
      // ring + blades + hub live in one group so the whole fan can spin about its centre
      var fg = E("g", { class: "plate-fan" + (i ? " plate-fan--rev" : "") }, g);
      fg.style.setProperty("--d", f(base + 0.9) + "s");
      fg.style.setProperty("--tm", (3 + i * 0.7) + "s");
      ring(fg, fxp, cy, fr2, "ink-stroke--fine", { d: base + 0.3 + i * 0.05, dur: 0.4, sw: 0.9 });
      for (var a = 0; a < 3; a++) {
        var ang = (a / 3) * Math.PI * 2 + 0.5;
        stroke(fg, "M" + f(fxp) + " " + f(cy) + "L" + f(fxp + Math.cos(ang) * fr2 * 0.86) + " " + f(cy + Math.sin(ang) * fr2 * 0.86),
          "ink-stroke--fine", { d: base + 0.45 + i * 0.05, dur: 0.3, sw: 0.7 });
      }
      blob(fg, fxp, cy, 1.1, "", base + 0.55 + i * 0.05);
    });
  }
  function gpus(g, cx, cy, base) {
    gpuCard(g, cx, cy - 13, 58, base);
    gpuCard(g, cx, cy + 13, 58, base + 0.25);
    stroke(g, "M" + f(cx - 23) + " " + f(cy - 5) + "L" + f(cx - 23) + " " + f(cy + 5), "ink-stroke--fine ink-stroke--rubric", { d: base + 0.6, dur: 0.3, sw: 1 }); // interconnect
    blob(g, cx - 23, cy - 5, 1.3, "ink-fill--rubric", base + 0.75);
    blob(g, cx - 23, cy + 5, 1.3, "ink-fill--rubric", base + 0.78);
  }

  // ---- 3D dice that get tossed and bounce ---------------------------------
  var PIPS = {
    1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.27, .27], [.5, .5], [.73, .73]],
    4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]],
    5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]],
    6: [[.27, .22], [.27, .5], [.27, .78], [.73, .22], [.73, .5], [.73, .78]]
  };
  function pipFace(g, matrix, n, cls, base) {
    var grp = E("g", { transform: matrix }, g);
    PIPS[n].forEach(function (p, i) { blob(grp, p[0], p[1], 0.085, cls, base + 0.32 + i * 0.03); });
  }
  // an oblique-projected cube (front + top + right faces) with pips, then it rolls
  function die3d(parent, cx, cy, s, faces, base, rollDelay, rollDur) {
    var k = s * 0.46;
    var fx = cx - (s + k) / 2, fy = cy - (s - k) / 2;
    var g = E("g", { class: "plate-die ink-soft" }, parent);
    dly(g, rollDelay); g.style.setProperty("--tm", rollDur + "s");
    // faces, back-to-front (outlines draw on; tonal fills via CSS)
    poly(g, [[fx, fy], [fx + k, fy - k], [fx + s + k, fy - k], [fx + s, fy]], "plate-die-top", { d: base, dur: 0.45, sw: 1.1 });
    poly(g, [[fx + s, fy], [fx + s + k, fy - k], [fx + s + k, fy + s - k], [fx + s, fy + s]], "plate-die-right", { d: base + 0.05, dur: 0.45, sw: 1.1 });
    tile(g, fx, fy, s, s, 1.6, "plate-die-front", { d: base + 0.1, dur: 0.45, sw: 1.1 });
    // pips, projected onto each face
    pipFace(g, "matrix(" + s + ",0,0," + s + "," + f(fx) + "," + f(fy) + ")", faces[0], "plate-pip", base);
    pipFace(g, "matrix(" + s + ",0," + k + ",-" + k + "," + f(fx) + "," + f(fy) + ")", faces[1], "plate-pip-top", base);
    pipFace(g, "matrix(" + k + ",-" + k + ",0," + s + "," + f(fx + s) + "," + f(fy) + ")", faces[2], "plate-pip-lite", base);
    return g;
  }

  // a flow chevron "›" that inks on, then pulses (the conveyor moving right)
  function chev(parent, x, y, base, flow) {
    var g = E("g", { class: "plate-chev" }, parent);
    dly(g, flow);
    stroke(g, "M" + f(x - 3.2) + " " + f(y - 4.4) + "L" + f(x + 3.2) + " " + f(y) + "L" + f(x - 3.2) + " " + f(y + 4.4),
      "", { d: base, dur: 0.35, sw: 1.7 });
  }
  // the same chevron turned to point down — the conveyor flowing top→bottom (phone layout)
  function chevDown(parent, x, y, base, flow) {
    var g = E("g", { class: "plate-chev" }, parent);
    dly(g, flow);
    stroke(g, "M" + f(x - 4.4) + " " + f(y - 3.2) + "L" + f(x) + " " + f(y + 3.2) + "L" + f(x + 4.4) + " " + f(y - 3.2),
      "", { d: base, dur: 0.35, sw: 1.7 });
  }

  // a rubricated numbered badge (red disc + reversed cream numeral)
  function badge(parent, cx, cy, n, base) {
    blob(parent, cx, cy, 8.4, "ink-fill--rubric", base);
    ring(parent, cx, cy, 8.4, "plate-badge-ring", { d: base + 0.05, dur: 0.4, sw: 0.8 });
    txt(parent, cx, cy + 3.4, String(n), "plate-bnum", { d: base + 0.25 });
  }

  // a zone banner with flanking hairline rules + terminal dots (classic, not arrows).
  // The flanks MEASURE the rendered text and sit just outside it, clamped to the
  // panel's half-extent `bound` — and are skipped entirely if the title nearly
  // fills its panel (so the narrow generation panel never collides).
  function banner(parent, cx, y, str, cls, base, bound) {
    var t = txt(parent, cx, y, str, "plate-band " + cls, { d: base });
    var w2 = 0;
    try { w2 = t.getBBox().width / 2; } catch (e) { }
    if (!(w2 > 4)) w2 = str.length * 3.2;                 // fallback if not yet laid out
    var inner = w2 + 6;
    if (bound - inner < 6) return;                         // no room → title stands alone
    var outer = Math.min(inner + 11, bound);
    [-1, 1].forEach(function (sgn) {
      stroke(parent, "M" + f(cx + sgn * inner) + " " + f(y - 3.6) + "L" + f(cx + sgn * outer) + " " + f(y - 3.6),
        "plate-rule", { d: base + 0.15, dur: 0.5, sw: 1 });
      blob(parent, cx + sgn * outer, y - 3.6, 1.5, "plate-ruledot", base + 0.32);
    });
  }

  // =========================== ASSEMBLY =============================
  var SOURCES = [
    { cx: 62, name: "random init", n: 1, icon: "net", die: [5, 3, 6], base: 0.55 },
    { cx: 180, name: "data order", n: 2, icon: "data", die: [2, 4, 1], base: 0.75 },
    { cx: 298, name: "training noise", n: 3, icon: "tnoise", die: [3, 6, 2], base: 0.95 },
    { cx: 416, name: "hardware", n: 4, icon: "gpu", die: [6, 2, 4], base: 1.15 }
  ];
  var ROLLDUR = [2.7, 3.0, 2.5, 3.2];

  function build(mount) {
    while (mount.firstChild) mount.removeChild(mount.firstChild);
    var W = 784, H = 200, cy = 122;
    var svg = E("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "The five sources of randomness behind a generative model" }, mount);

    // --- zone washes (gold = training, blue = generation) ---
    tile(svg, 4, 6, 470, 188, 9, "plate-zone plate-zone--train", { d: 0.25, dur: 1.4, sw: 1.2 });
    tile(svg, 590, 6, 190, 188, 9, "plate-zone plate-zone--gen", { d: 0.3, dur: 1.2, sw: 1.2 });

    banner(svg, 239, 22, "Training lottery", "plate-band--train", 0.3, 226);
    banner(svg, 685, 22, "Generation lottery", "plate-band--gen", 0.35, 90);

    // --- conveyor chevrons (flow left→right) ---
    var chevs = [121, 239, 357].reduce(function (a, gx) { return a.concat([[gx - 7, 0.8], [gx + 7, 0.8]]); }, []);
    chevs = chevs.concat([[468, 1.7], [482, 1.7], [586, 2.0], [600, 2.0], [614, 2.0]]);
    chevs.forEach(function (c, i) { chev(svg, c[0], cy, c[1], i * 0.14); });

    // --- the four training sources ---
    SOURCES.forEach(function (s, idx) {
      txt(svg, s.cx, 46, s.name, "plate-name", { d: s.base - 0.05 });
      badge(svg, s.cx - 31, 68, s.n, s.base + 0.55);
      die3d(svg, s.cx + 31, 69, 15, s.die, s.base + 0.35, s.base + 1.5, ROLLDUR[idx]);
      tile(svg, s.cx - 42, 80, 84, 84, 4, "plate-card plate-card--bg", { d: s.base, dur: 0.6, sw: 1.1 });
      var g = E("g", {}, svg);
      if (s.icon === "net") netIcon(g, s.cx, cy, false, s.base + 0.2);
      else if (s.icon === "data") dataOrder(g, s.cx, cy, s.base + 0.2);
      else if (s.icon === "tnoise") {
        photoMini(g, s.cx - 19, cy, 11, s.base + 0.2, 0);
        txt(g, s.cx, cy + 4, "+", "plate-plus", { d: s.base + 0.4 });
        noise(g, s.cx + 19, cy, 11, s.base + 0.3);
      } else if (s.icon === "gpu") gpus(g, s.cx, cy, s.base + 0.2);
    });

    // --- the trained-network medallion (the one ticket we actually drew) ---
    var bx = 532;
    E("ellipse", { cx: bx, cy: cy, rx: 50, ry: 44, class: "plate-glow" }, svg).style.setProperty("--d", "2.4s");
    tile(svg, bx - 40, 80, 80, 84, 10, "plate-card plate-card--bridge", { d: 1.8, dur: 0.7, sw: 1.3 });
    netIcon(E("g", {}, svg), bx, cy, true, 1.95);
    txt(svg, bx, 180, "trained network", "plate-name plate-name--bridge", { d: 2.15 });

    // --- the generation source: initial noise → sampled image ---
    var gx = 685;
    txt(svg, gx, 46, "initial noise", "plate-name", { d: 2.25 });
    badge(svg, gx - 44, 68, 5, 2.85);
    die3d(svg, gx + 44, 69, 15, [4, 5, 1], 2.6, 3.7, 2.8);
    tile(svg, gx - 56, 80, 112, 84, 4, "plate-card plate-card--bg", { d: 2.3, dur: 0.6, sw: 1.1 });
    var gg = E("g", {}, svg);
    noise(gg, gx - 28, cy, 13, 2.45);
    chev(svg, gx, cy, 2.7, 0.6);
    landscape(gg, gx + 28, cy, 16, 2.6);

    return svg;
  }

  // --- the SAME engraving, reflowed into a tall portrait column for phones ---
  // The wide layout is ~3.9:1, so on a phone its 10px engraved labels shrink to
  // ~5px and read as nothing. Here the four training sources stack into a 2×2
  // grid, the conveyor flows DOWN into the trained-network medallion, and the
  // generation lottery sits at the foot — every block reuses the wide layout's
  // icon/badge/die helpers (and thus the same .inked motion) at full size.
  function buildNarrow(mount) {
    while (mount.firstChild) mount.removeChild(mount.firstChild);
    var W = 360, H = 690, ZX = 10, ZW = 340;
    var svg = E("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "The five sources of randomness behind a generative model" }, mount);

    // --- training zone (gold wash) + banner ---
    tile(svg, ZX, 8, ZW, 324, 11, "plate-zone plate-zone--train", { d: 0.25, dur: 1.4, sw: 1.2 });
    banner(svg, 180, 26, "Training lottery", "plate-band--train", 0.3, 168);

    // --- the four training sources, in a 2×2 grid ---
    var COLS = [96, 264], ROWS = [54, 200];
    SOURCES.forEach(function (s, idx) {
      var cx = COLS[idx % 2], nameY = ROWS[idx < 2 ? 0 : 1], cy = nameY + 76;
      txt(svg, cx, nameY, s.name, "plate-name", { d: s.base - 0.05 });
      badge(svg, cx - 31, nameY + 22, s.n, s.base + 0.55);
      die3d(svg, cx + 31, nameY + 23, 15, s.die, s.base + 0.35, s.base + 1.5, ROLLDUR[idx]);
      tile(svg, cx - 42, nameY + 34, 84, 84, 4, "plate-card plate-card--bg", { d: s.base, dur: 0.6, sw: 1.1 });
      var g = E("g", {}, svg);
      if (s.icon === "net") netIcon(g, cx, cy, false, s.base + 0.2);
      else if (s.icon === "data") dataOrder(g, cx, cy, s.base + 0.2);
      else if (s.icon === "tnoise") {
        photoMini(g, cx - 19, cy, 11, s.base + 0.2, 0);
        txt(g, cx, cy + 4, "+", "plate-plus", { d: s.base + 0.4 });
        noise(g, cx + 19, cy, 11, s.base + 0.3);
      } else if (s.icon === "gpu") gpus(g, cx, cy, s.base + 0.2);
    });

    // --- conveyor flowing down into the trained-network medallion ---
    [346, 358, 370].forEach(function (yy, i) { chevDown(svg, 180, yy, 1.7, i * 0.14); });
    var BCY = 408;
    E("ellipse", { cx: 180, cy: BCY, rx: 50, ry: 44, class: "plate-glow" }, svg).style.setProperty("--d", "2.4s");
    tile(svg, 140, BCY - 42, 80, 84, 10, "plate-card plate-card--bridge", { d: 1.8, dur: 0.7, sw: 1.3 });
    netIcon(E("g", {}, svg), 180, BCY, true, 1.95);
    txt(svg, 180, BCY + 58, "trained network", "plate-name plate-name--bridge", { d: 2.15 });

    // --- flow down into the generation lottery (blue wash) ---
    [480, 492].forEach(function (yy, i) { chevDown(svg, 180, yy, 2.0, i * 0.14); });
    tile(svg, ZX, 502, ZW, 180, 11, "plate-zone plate-zone--gen", { d: 0.3, dur: 1.2, sw: 1.2 });
    banner(svg, 180, 520, "Generation lottery", "plate-band--gen", 0.35, 168);

    // --- initial noise → sampled image ---
    var gx = 180, gNameY = 548, gcy = 624;
    txt(svg, gx, gNameY, "initial noise", "plate-name", { d: 2.25 });
    badge(svg, gx - 44, gNameY + 22, 5, 2.85);
    die3d(svg, gx + 44, gNameY + 23, 15, [4, 5, 1], 2.6, 3.7, 2.8);
    tile(svg, gx - 56, gNameY + 34, 112, 84, 4, "plate-card plate-card--bg", { d: 2.3, dur: 0.6, sw: 1.1 });
    var gg = E("g", {}, svg);
    noise(gg, gx - 28, gcy, 13, 2.45);
    chev(svg, gx, gcy, 2.7, 0.6);
    landscape(gg, gx + 28, gcy, 16, 2.6);

    return svg;
  }

  function boot() {
    ensureDefs();
    var mount = document.querySelector("[data-plate]");
    if (!mount) return;
    // phones AND portrait tablets get the portrait reflow: the wide layout is ~3.9:1,
    // so below ~820px its 10px engraved labels shrink into an unreadable strip that
    // breaks the single-column reading flow. We rebuild if the viewport crosses the
    // cutoff (rotation, resize).
    var mq = window.matchMedia ? window.matchMedia("(max-width: 820px)") : null;
    function render() {
      try { (mq && mq.matches ? buildNarrow : build)(mount); }
      catch (e) { console.error("plate build failed:", e); }
    }
    render();
    if (mq) {
      var on = function () { render(); };
      if (mq.addEventListener) mq.addEventListener("change", on);
      else if (mq.addListener) mq.addListener(on);   // older Safari
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
