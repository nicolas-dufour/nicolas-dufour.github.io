/* ===================================================================
   calc.js — the interactive "FID → error bar" calculator.
   Given a reported FID (F) and the number of independently-trained
   seeds it averages (N), it returns the 95% confidence interval the
   seed lottery hides behind that single number:

       CI₉₅(F, N) ≈ 1.96 · (CoV · F) / √N      (CoV = 1.3% median floor)

   Geometry note: because the plotted window is normalised to the
   one-seed bar (width ∝ CoV·F), the bar's on-screen size depends only
   on N — F just rescales the numbers. So sliding F updates the labels;
   choosing N animates the whisker tightening. Self-initialising, like
   ink.js / deco.js. Uses d3 (loaded) for the SVG transitions.
   =================================================================== */
(function () {
  "use strict";
  var COV = 0.013;            // median between-seed CoV (the 1.3% floor)
  var Z = 1.96;               // 95% normal quantile
  var SEEDS = [1, 2, 3, 5, 10];
  var PRESETS = [
    { l: "SOTA ≈ 1.8", v: 1.8 },
    { l: "Strong ≈ 5", v: 5 },
    { l: "SiT-B ≈ 34.7", v: 34.7 }
  ];

  function el(tag, cls, parent, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    if (parent) parent.appendChild(e);
    return e;
  }

  function build(mount) {
    var d3 = window.d3, U = window.FLUtils;
    mount.innerHTML = "";
    var F = 12, N = 1;
    var disp = { ci: null, lo: null, hi: null };   // last shown (count-from)

    var card = el("div", "panel-card calc__card", mount);
    ["tl", "tr", "bl", "br"].forEach(function (p, i) {
      var s = el("span", "corner " + p, card); s.textContent = "♠♥♣♦"[i];
    });

    // ---- controls ----
    var controls = el("div", "calc__controls", card);
    var f1 = el("div", "calc__field", controls);
    var l1 = el("div", "calc__label", f1);
    l1.innerHTML = 'Reported FID <b id="calc-fval"></b>';
    var slider = el("input", "calc__slider", f1);
    slider.type = "range"; slider.min = "1.5"; slider.max = "50"; slider.step = "0.1"; slider.value = String(F);
    slider.setAttribute("aria-label", "Reported FID");
    var presets = el("div", "calc__presets", f1);
    PRESETS.forEach(function (p) {
      var b = el("button", "chip-toggle calc__chip", presets, p.l); b.type = "button";
      b.addEventListener("click", function () { F = p.v; slider.value = String(F); recompute(true); });
    });

    var f2 = el("div", "calc__field calc__field--seeds", controls);
    el("div", "calc__label", f2).textContent = "Training seeds averaged";
    var seedsRow = el("div", "calc__seeds", f2);
    var seedBtns = SEEDS.map(function (n) {
      var b = el("button", "chip-toggle calc__chip" + (n === N ? " active" : ""), seedsRow, String(n));
      b.type = "button";
      b.addEventListener("click", function () {
        N = n;
        seedBtns.forEach(function (x, j) { x.classList.toggle("active", SEEDS[j] === N); });
        recompute(true);
      });
      return b;
    });

    // ---- big readout ----
    var read = el("div", "calc__readout", card);
    var big = el("div", "calc__big", read);
    big.innerHTML = '<span id="calc-F"></span><span class="calc__pm">±</span><span id="calc-ci"></span>';
    var range = el("div", "calc__range", read);
    range.innerHTML = '95% interval&nbsp;&nbsp;·&nbsp;&nbsp;<b id="calc-lo"></b> to <b id="calc-hi"></b> FID';

    // ---- error-bar visual ----
    var viz = el("div", "calc__viz", card);
    var W = 620, H = 104, ML = 60, MR = 60, axisY = 58, x0 = ML, x1 = W - MR, cx = (x0 + x1) / 2;
    var svg = d3.select(viz).append("svg").attr("viewBox", "0 0 " + W + " " + H).attr("preserveAspectRatio", "xMidYMid meet");
    svg.append("line").attr("class", "calc-axis").attr("x1", x0 - 8).attr("x2", x1 + 8).attr("y1", axisY).attr("y2", axisY);
    var refHalf = (x1 - x0) / 2 * (1 / 1.5);                 // the one-seed bar's half-width on screen
    svg.append("rect").attr("class", "calc-ref").attr("x", cx - refHalf).attr("width", refHalf * 2).attr("y", axisY - 16).attr("height", 32).attr("rx", 4);
    svg.append("text").attr("class", "calc-reflbl").attr("x", cx + refHalf).attr("y", axisY - 21).attr("text-anchor", "end").text("one-seed bar");
    var bandFill = svg.append("rect").attr("class", "calc-band").attr("y", axisY - 13).attr("height", 26).attr("rx", 3);
    var capL = svg.append("line").attr("class", "calc-cap").attr("y1", axisY - 13).attr("y2", axisY + 13);
    var capR = svg.append("line").attr("class", "calc-cap").attr("y1", axisY - 13).attr("y2", axisY + 13);
    var whisk = svg.append("line").attr("class", "calc-whisk").attr("y1", axisY).attr("y2", axisY);
    var center = svg.append("circle").attr("class", "calc-center").attr("cx", cx).attr("cy", axisY).attr("r", 6.5);
    var fLbl = svg.append("text").attr("class", "calc-lbl calc-lbl--f").attr("x", cx).attr("y", axisY - 24).attr("text-anchor", "middle");
    var loLbl = svg.append("text").attr("class", "calc-lbl").attr("y", axisY + 30).attr("text-anchor", "middle");
    var hiLbl = svg.append("text").attr("class", "calc-lbl").attr("y", axisY + 30).attr("text-anchor", "middle");

    var verdict = el("div", "calc__verdict", card);

    function q(id) { return card.querySelector(id); }

    function recompute(animate) {
      var sigma = COV * F, ci1 = Z * sigma, ci = ci1 / Math.sqrt(N);
      var lo = F - ci, hi = F + ci;
      q("#calc-fval").textContent = F.toFixed(1);
      q("#calc-F").textContent = F.toFixed(1);
      fLbl.text(F.toFixed(F < 10 ? 2 : 1));

      var ciEl = q("#calc-ci"), loEl = q("#calc-lo"), hiEl = q("#calc-hi");
      if (animate && U && disp.ci != null) {
        U.animateCount(ciEl, ci, { dur: 520, dec: 2, from: disp.ci });
        U.animateCount(loEl, lo, { dur: 520, dec: 2, from: disp.lo });
        U.animateCount(hiEl, hi, { dur: 520, dec: 2, from: disp.hi });
      } else {
        ciEl.textContent = ci.toFixed(2); loEl.textContent = lo.toFixed(2); hiEl.textContent = hi.toFixed(2);
      }
      disp = { ci: ci, lo: lo, hi: hi };

      // bar geometry depends only on N (window is normalised to the one-seed bar)
      var half = (x1 - x0) / 2 * (1 / (1.5 * Math.sqrt(N)));
      var bl = cx - half, br = cx + half;
      function set(sel, attrs) {
        var s = animate ? sel.transition().duration(520).ease(d3.easeCubicOut) : sel;
        for (var k in attrs) s.attr(k, attrs[k]);
      }
      set(bandFill, { x: bl, width: half * 2 });
      set(capL, { x1: bl, x2: bl });
      set(capR, { x1: br, x2: br });
      set(whisk, { x1: bl, x2: br });
      set(loLbl, { x: bl }); loLbl.text(lo.toFixed(2));
      set(hiLbl, { x: br }); hiLbl.text(hi.toFixed(2));

      verdict.innerHTML = "A reported improvement smaller than <b>" + ci.toFixed(2) +
        " FID</b> falls inside this bar — at " + N + " seed" + (N > 1 ? "s" : "") + ", you cannot call it real.";
    }

    slider.addEventListener("input", function () { F = parseFloat(slider.value); recompute(false); });
    recompute(false);
  }

  function boot() {
    var m = document.getElementById("fid-calc");
    if (m && window.d3) { try { build(m); } catch (e) { console.error("calc failed:", e); } }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
