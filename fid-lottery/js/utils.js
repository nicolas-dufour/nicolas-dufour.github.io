/* ===================================================================
   FLUtils — shared palette, theming, responsive SVG, tooltip, helpers.
   Used by every chart module. Mirrors the CSS custom properties.
   =================================================================== */
(function () {
  "use strict";

  var PAL = {
    baize900: "#062019", baize850: "#08291f", baize800: "#0b3a2c",
    gold100: "#fbf3d4", gold200: "#f3e2a6", gold300: "#ecd185",
    gold400: "#e0bf6a", gold500: "#c8a24a", gold600: "#a8842f", gold700: "#7d6020",
    ivory: "#f6efdc", ink: "#17241c", inkSoft: "#2e4034",
    claret: "#8f241f", claretBr: "#c8453c", jade: "#4fb286", chipBlue: "#4b86a6"
  };

  // theme by section background (felt = dark, ivory = light)
  var THEME = {
    felt: {
      fg: "#f6efdc", faint: "rgba(246,239,220,0.55)", grid: "rgba(236,209,133,0.16)",
      axis: "rgba(236,209,133,0.4)", gold: "#e0bf6a", goldBright: "#f3e2a6",
      train: "#e6c878", sample: "#5fa3c0", lucky: "#7bdcae", unlucky: "#e0654f",
      claret: "#c8453c", band: "rgba(224,191,106,0.16)", bandStroke: "rgba(224,191,106,0.5)",
      surface: "#08291f"
    },
    ivory: {
      fg: "#17241c", faint: "rgba(23,36,28,0.6)", grid: "rgba(0,0,0,0.08)",
      axis: "rgba(143,36,31,0.3)", gold: "#a8842f", goldBright: "#7d6020",
      train: "#a8842f", sample: "#4b86a6", lucky: "#2f8f63", unlucky: "#b5362c",
      claret: "#8f241f", band: "rgba(143,36,31,0.10)", bandStroke: "rgba(143,36,31,0.45)",
      surface: "#fbf6e6"
    }
  };

  // ordinal model colours (used by race + mup, both on felt)
  var MODEL_COLOR = { "DiT-S": "#7bdcae", "DiT-B": "#e0bf6a", "DiT-L": "#e0954a", "DiT-XL": "#e0654f" };

  function onIvory(node) {
    return !!(node && node.closest && node.closest(".section--ivory"));
  }
  function theme(node) { return onIvory(node) ? THEME.ivory : THEME.felt; }

  /* Create a responsive SVG inside `mount`. Returns {svg, g, W, H, iw, ih, m}.
     Coordinates are in a fixed viewBox; CSS scales width to 100%. */
  function svg(mount, opts) {
    opts = opts || {};
    var W = opts.width || Math.max(320, Math.round(mount.clientWidth || 720));
    var aspect = opts.aspect || 0.56;
    var H = opts.height || Math.round(W * aspect);
    var m = Object.assign({ top: 24, right: 24, bottom: 44, left: 52 }, opts.margin || {});
    var sel = d3.select(mount);
    sel.selectAll("*").remove();
    var s = sel.append("svg")
      .attr("viewBox", "0 0 " + W + " " + H)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("role", "img");
    var g = s.append("g").attr("transform", "translate(" + m.left + "," + m.top + ")");
    return { svg: s, g: g, W: W, H: H, iw: W - m.left - m.right, ih: H - m.top - m.bottom, m: m };
  }

  // --- tooltip (single shared element #fl-tooltip) ---
  var tipEl = null;
  function tip() { if (!tipEl) tipEl = document.getElementById("fl-tooltip"); return tipEl; }
  function showTip(html, evt) {
    var t = tip(); if (!t) return;
    t.innerHTML = html; t.style.opacity = 1;
    moveTip(evt);
  }
  function moveTip(evt) {
    var t = tip(); if (!t) return;
    var x = evt.clientX + 14, y = evt.clientY + 14;
    var r = t.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - 14;
    t.style.left = x + "px"; t.style.top = y + "px";
  }
  function hideTip() { var t = tip(); if (t) t.style.opacity = 0; }

  // animate a number in `el` from 0 (or current) to `to`
  function animateCount(el, to, opts) {
    opts = opts || {};
    var dur = opts.dur || 1100, dec = opts.dec == null ? 0 : opts.dec;
    var suffix = opts.suffix || "", prefix = opts.prefix || "", from = opts.from || 0;
    if (reduced()) { el.textContent = prefix + to.toFixed(dec) + suffix; return; }
    var t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + (from + (to - from) * e).toFixed(dec) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function reduced() {
    return false;   // reduced-motion handling removed — charts always animate
  }

  // standard styled axes; caller supplies scales. cls toggles fl-axis classes (styled in CSS)
  function axisBottom(g, scale, ih, opts) {
    opts = opts || {};
    var ax = g.append("g").attr("class", "fl-axis").attr("transform", "translate(0," + ih + ")")
      .call(d3.axisBottom(scale).ticks(opts.ticks || 6).tickSizeOuter(0));
    if (opts.fmt) ax.call(d3.axisBottom(scale).ticks(opts.ticks || 6).tickFormat(opts.fmt).tickSizeOuter(0));
    return ax;
  }
  function axisLeft(g, scale, opts) {
    opts = opts || {};
    return g.append("g").attr("class", "fl-axis")
      .call(d3.axisLeft(scale).ticks(opts.ticks || 6).tickSizeOuter(0));
  }

  window.FLUtils = {
    PAL: PAL, THEME: THEME, MODEL_COLOR: MODEL_COLOR,
    onIvory: onIvory, theme: theme, svg: svg,
    showTip: showTip, moveTip: moveTip, hideTip: hideTip,
    animateCount: animateCount, reduced: reduced,
    axisBottom: axisBottom, axisLeft: axisLeft,
    modelColor: function (m) { return MODEL_COLOR[m] || "#e0bf6a"; }
  };
})();
