/* ===================================================================
   deco.js — the "living salon frame" for the Act sections.
   Each act gets a thin gold (claret on ivory) filigree border that
   DRAWS ITSELF IN when the section scrolls into view (same stroke-
   dashoffset technique as the intro ink), then stays alive:
     · twinkling gem accents in the four corners
     · a small wheel-of-fortune rosette on the top edge that slowly turns
     · a few gold motes drifting in the side margins
   Pure SVG + CSS, no deps. Sits behind the content; hidden on mobile.
   =================================================================== */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var PLAY = /[?&]play=1/.test(location.search);

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
  function vars(node, o) {
    if (o.d != null) node.style.setProperty("--d", f(o.d) + "s");
    if (o.dur != null) node.style.setProperty("--dur", f(o.dur) + "s");
    if (o.tw != null) node.style.setProperty("--tw", f(o.tw) + "s");
    return node;
  }
  function R(a, b) { return a + Math.random() * (b - a); }

  function draw(parent, d, o) {
    o = o || {};
    var p = E("path", { d: d, class: "deco-line deco-draw" + (o.cls ? " " + o.cls : ""), pathLength: 1 }, parent);
    if (o.sw != null) p.setAttribute("stroke-width", o.sw);
    return vars(p, o);
  }
  function gem(parent, cx, cy, r, o) {
    o = o || {};
    var c = E("circle", { cx: f(cx), cy: f(cy), r: f(r), class: "deco-gem" }, parent);
    return vars(c, o);
  }

  // an L-bracket + inner curl + gem, drawn in the canonical TL orientation
  // (origin at the corner, opening into +x / +y). Rotated per corner.
  function corner(svg, x, y, rot, baseDelay) {
    var g = E("g", { transform: "translate(" + f(x) + "," + f(y) + ") rotate(" + rot + ")" }, svg);
    draw(g, "M0 30 C0 14 14 0 30 0", { d: baseDelay, dur: 1.0, sw: 1.3 });
    draw(g, "M30 0 C20 0 14 6 16 13 C17 17 23 16 21.6 11.6", { cls: "deco-fine", d: baseDelay + 0.4, dur: 0.7, sw: 1.1 });
    draw(g, "M0 30 C8 30 13 25 12 19", { cls: "deco-fine", d: baseDelay + 0.4, dur: 0.7, sw: 1.1 });
    gem(g, 8.5, 8.5, 2.1, { d: baseDelay + 0.7, tw: 2.4 + Math.random() * 1.6 });
  }

  // a small wheel-of-fortune rosette centred at (cx,cy); the spoked
  // head spins forever once drawn (echoes the hero roulette).
  function rosette(svg, cx, cy, baseDelay) {
    var hub = E("g", { transform: "translate(" + f(cx) + "," + f(cy) + ")" }, svg);
    var ringP = "M0 -11 A11 11 0 1 1 0 11 A11 11 0 1 1 0 -11 Z";
    draw(hub, ringP, { d: baseDelay, dur: 0.9, sw: 1.3 });
    var spin = E("g", { class: "deco-rosette" }, hub);
    vars(spin, { d: baseDelay + 0.5 });
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      draw(spin, "M" + f(Math.cos(a) * 3.4) + " " + f(Math.sin(a) * 3.4) +
        "L" + f(Math.cos(a) * 9.6) + " " + f(Math.sin(a) * 9.6), { cls: "deco-fine", d: baseDelay + 0.55 + i * 0.03, dur: 0.5, sw: 1 });
    }
    gem(hub, 0, 0, 2.4, { d: baseDelay + 0.6, tw: 2.8 });
  }

  function buildFrame(section, isIvory) {
    // remove any prior frame (rebuilds on resize)
    var old = section.querySelector(":scope > .act-frame");
    if (old) old.remove();
    var frame = document.createElement("div");
    frame.className = "act-frame" + (isIvory ? " act-frame--ivory" : "");
    section.appendChild(frame);
    var fw = frame.clientWidth, fh = frame.clientHeight;
    if (fw < 40 || fh < 40) { frame.remove(); return; }

    var svg = E("svg", { viewBox: "0 0 " + fw + " " + fh, preserveAspectRatio: "none" }, frame);
    var inset = 7;
    // the perimeter rule (rounded rect) draws itself in
    var rx = 10, x = inset, y = inset, w = fw - inset * 2, h = fh - inset * 2;
    var rect = E("rect", { x: x, y: y, width: w, height: h, rx: rx, ry: rx,
      class: "deco-line deco-draw deco-rect", pathLength: 1 }, svg);
    vars(rect, { d: 0.1, dur: 2.4 });
    // an inner hairline, fainter, slightly inset (a salon double-rule)
    var hr = E("rect", { x: x + 5, y: y + 5, width: w - 10, height: h - 10, rx: rx,
      class: "deco-line deco-fine deco-draw deco-rect2", pathLength: 1 }, svg);
    vars(hr, { d: 0.5, dur: 2.4 });

    corner(svg, x, y, 0, 0.7);
    corner(svg, fw - inset, y, 90, 0.85);
    corner(svg, fw - inset, fh - inset, 180, 1.0);
    corner(svg, x, fh - inset, 270, 1.15);

    rosette(svg, fw / 2, inset, 1.3);

    // drifting motes in the side margins (where the centred content leaves room)
    var n = fw > 1180 ? 6 : (fw > 900 ? 4 : 0);
    for (var i = 0; i < n; i++) {
      var m = document.createElement("span");
      m.className = "deco-mote";
      var sz = R(3, 5.5);
      m.style.left = (Math.random() < 0.5 ? R(2, 9) : R(91, 98)) + "%";
      m.style.top = R(20, 86) + "%";
      m.style.width = m.style.height = sz.toFixed(1) + "px";
      m.style.setProperty("--mt", R(15, 24).toFixed(1) + "s");
      m.style.setProperty("--md", R(0, 12).toFixed(1) + "s");
      m.style.setProperty("--d", R(1.4, 2.4).toFixed(1) + "s");
      frame.appendChild(m);
    }
  }

  function sections() {
    return Array.prototype.slice.call(document.querySelectorAll("section.act-fit, .rules-section"));
  }

  function buildAll() {
    sections().forEach(function (sec) {
      try { buildFrame(sec, sec.classList.contains("section--ivory")); } catch (e) { console.error("deco failed:", e); }
    });
  }

  function observe() {
    var secs = sections();
    if (PLAY) { secs.forEach(function (s) { s.classList.add("act-inked"); }); return; }
    if (!("IntersectionObserver" in window)) { secs.forEach(function (s) { s.classList.add("act-inked"); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("act-inked"); io.unobserve(e.target); } });
    }, { threshold: 0.2, rootMargin: "0px 0px -10% 0px" });
    secs.forEach(function (s) { io.observe(s); });
  }

  function boot() {
    // skip the whole thing on mobile (acts stack and are space-tight there)
    if (window.innerWidth < 980) return;
    buildAll();
    observe();
    var lastW = window.innerWidth, t = null;
    window.addEventListener("resize", function () {
      if (Math.abs(window.innerWidth - lastW) < 40) return;
      lastW = window.innerWidth;
      clearTimeout(t);
      t = setTimeout(function () {
        if (window.innerWidth < 980) {
          sections().forEach(function (s) { var fr = s.querySelector(":scope > .act-frame"); if (fr) fr.remove(); });
          return;
        }
        buildAll();
        sections().forEach(function (s) { s.classList.add("act-inked"); });
      }, 240);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
