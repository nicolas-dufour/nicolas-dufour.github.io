/* ===================================================================
   race.js — Act III "The luck of the draw".
   FLCharts.race(mount, FL, opts) → mount #chart-race, on FELT.
   Model-toggle (opts.model in DiT-S/B/L/XL; default DiT-XL).

   x = training steps (cropped to 0.5M → 2M), y = FID. Every seed is a faint
   gold line (the "field"). The luckiest seed (lowest final FID) is
   drawn bold in jade, the unluckiest (highest final FID) in claret.
   A dashed target line marks the unlucky seed's 2M FID; we find where
   the lucky curve first crosses it, drop a vertical guide, and bracket
   the saved span — annotated "<speedup>× faster". That is the money shot.
   =================================================================== */
(function () {
  "use strict";
  window.FLCharts = window.FLCharts || {};

  window.FLCharts.race = function (mount, FL, opts) {
    if (!mount) return;
    opts = opts || {};
    var play = opts.play === true;
    var reduced = (window.FLUtils && FLUtils.reduced && FLUtils.reduced());
    var instant = play || reduced;

    // ---- resolve data, guard hard ----
    var key = opts.model || "DiT-XL";
    var s = FL && FL.scaling && (FL.scaling[key] || FL.scaling["DiT-XL"]);
    var d3sel = d3.select(mount);
    d3sel.selectAll("*").remove();
    if (!s || !s.steps || !s.steps.length || !s.seeds) {
      d3sel.append("div").style("padding", "1.5rem").style("opacity", 0.7)
        .style("font-family", "var(--sans)").style("font-size", ".82rem")
        .text("No race data available.");
      return;
    }

    var T = FLUtils.theme(mount);
    var steps = s.steps;
    var STEP_MIN = steps[0], STEP_MAX = steps[steps.length - 1];
    // crop the x-axis at 0.5M: the steep early descent hides the late-run differences
    var X_MIN = Math.min(STEP_MAX, Math.max(STEP_MIN, 500000));

    // ---- build seed trajectories -> [{seed, pts:[[step,fid]], final}] ----
    var seedKeys = Object.keys(s.seeds);
    var series = [];
    seedKeys.forEach(function (sk) {
      var raw = s.seeds[sk];
      if (!raw || !raw.length) return;
      var pts = raw
        .filter(function (p) { return p && p.length >= 2 && isFinite(p[0]) && isFinite(p[1]); })
        .map(function (p) { return [+p[0], +p[1]]; })
        .sort(function (a, b) { return a[0] - b[0]; });
      if (!pts.length) return;
      series.push({ seed: sk, pts: pts, final: pts[pts.length - 1][1] });
    });
    if (!series.length) return;

    // luckiest = lowest final FID; unluckiest = highest final FID
    var sorted = series.slice().sort(function (a, b) { return a.final - b.final; });
    var lucky = sorted[0];
    var unlucky = sorted[sorted.length - 1];
    var target = unlucky.final;            // the FID everyone eventually reaches

    // where the lucky curve FIRST drops to/below the target
    function crossStep(serie, tgt) {
      var pts = serie.pts;
      for (var i = 0; i < pts.length; i++) {
        if (pts[i][1] <= tgt) {
          if (i === 0) return pts[0][0];
          // linear interpolate between the straddling points for a clean guide
          var a = pts[i - 1], b = pts[i];
          if (a[1] === b[1]) return b[0];
          var f = (a[1] - tgt) / (a[1] - b[1]);
          return a[0] + f * (b[0] - a[0]);
        }
      }
      return pts[pts.length - 1][0];
    }
    var cross = crossStep(lucky, target);

    // trim each trajectory to [X_MIN, 2M] so the cropped window fills the plot
    // and the y-axis zooms onto where the runs actually diverge.
    if (X_MIN > STEP_MIN) {
      series.forEach(function (se) {
        var pts = se.pts, out = [];
        for (var i = 0; i < pts.length; i++) {
          if (pts[i][0] >= X_MIN) {
            if (!out.length && i > 0 && pts[i - 1][0] < X_MIN) {
              var a = pts[i - 1], b = pts[i], f = (X_MIN - a[0]) / (b[0] - a[0]);
              out.push([X_MIN, a[1] + f * (b[1] - a[1])]);   // clean start exactly at 0.5M
            }
            out.push(pts[i]);
          }
        }
        if (out.length) se.pts = out;
      });
    }

    // ---- responsive svg ----
    // narrow (phone): a much taller frame — the field + hero lines + target +
    // "Nx faster" bracket + legend are far too cramped in the short desktop aspect.
    var W0 = Math.max(320, Math.round(mount.clientWidth || 720));
    var narrow = W0 < 480;
    var dim = FLUtils.svg(mount, {
      aspect: narrow ? 0.88 : 0.52,
      margin: { top: 26, right: 30, bottom: 48, left: 56 }
    });
    var g = dim.g, iw = dim.iw, ih = dim.ih;

    // ---- scales ----
    var x = d3.scaleLinear().domain([X_MIN, STEP_MAX]).range([0, iw]);

    var allFid = [];
    series.forEach(function (se) { se.pts.forEach(function (p) { allFid.push(p[1]); }); });
    var yMin = d3.min(allFid), yMax = d3.max(allFid);
    var pad = (yMax - yMin) * 0.06 || 1;
    var y = d3.scaleLinear().domain([yMin - pad, yMax + pad]).nice().range([ih, 0]);

    // ---- axes ----
    function fmtStep(v) {
      var m = v / 1e6;
      if (m >= 1) return (Number.isInteger(m) ? m : m.toFixed(1)) + "M";
      return (Math.round(v / 1e5) / 10) + "M"; // 0.5M, 0.2M ...
    }
    var xt = steps.filter(function (v, i) { return v >= X_MIN && i % 3 === 0; });
    if (!xt.length || xt[0] !== X_MIN) xt.unshift(X_MIN);
    if (xt[xt.length - 1] !== STEP_MAX) xt.push(STEP_MAX);

    g.append("g").attr("class", "fl-grid")
      .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(""))
      .call(function (sel) { sel.select(".domain").remove(); });

    g.append("g").attr("class", "fl-axis")
      .attr("transform", "translate(0," + ih + ")")
      .call(d3.axisBottom(x).tickValues(xt).tickFormat(fmtStep).tickSizeOuter(0));

    g.append("g").attr("class", "fl-axis")
      .call(d3.axisLeft(y).ticks(5).tickSizeOuter(0));

    g.append("text").attr("class", "fl-axis-label")
      .attr("x", iw).attr("y", ih + 40).attr("text-anchor", "end")
      .text("Training steps");
    g.append("text").attr("class", "fl-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", 0).attr("y", -42).attr("text-anchor", "end")
      .text("FID");

    // ---- line generator ----
    var line = d3.line()
      .x(function (p) { return x(p[0]); })
      .y(function (p) { return y(p[1]); })
      .curve(d3.curveMonotoneX);

    // ---- layered groups (draw order) ----
    var gField = g.append("g");      // faint background field
    var gMark = g.append("g");       // target line + bracket
    var gHero = g.append("g");       // lucky + unlucky bold lines
    var gLbl = g.append("g");        // end labels

    // ---------------- FAINT FIELD ----------------
    var fieldSel = gField.selectAll("path.fl-field")
      .data(series.filter(function (se) { return se !== lucky && se !== unlucky; }))
      .enter().append("path")
      .attr("class", "fl-field")
      .attr("fill", "none")
      .attr("stroke", T.gold)
      .attr("stroke-width", 1)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("d", function (se) { return line(se.pts); });

    // ---------------- HERO LINES ----------------
    function heroLine(serie, color, role) {
      var p = gHero.append("path")
        .attr("class", "fl-hero")
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .style("filter", "drop-shadow(0 1px 4px rgba(0,0,0,0.45))")
        .attr("d", line(serie.pts))
        .style("cursor", "pointer")
        .datum({ serie: serie, color: color, role: role });

      // invisible fat hit area for hover
      var hit = gHero.append("path")
        .attr("fill", "none").attr("stroke", "transparent")
        .attr("stroke-width", 16)
        .attr("d", line(serie.pts))
        .style("cursor", "pointer");

      function tip(evt) {
        if (!(window.FLUtils && FLUtils.showTip)) return;
        // nearest step to pointer x
        var rel = d3.pointer(evt, g.node());
        var sx = x.invert(rel[0]);
        var best = serie.pts[0], bd = Infinity;
        serie.pts.forEach(function (pt) {
          var dd = Math.abs(pt[0] - sx);
          if (dd < bd) { bd = dd; best = pt; }
        });
        var html =
          '<b>' + (role === "lucky" ? "Luckiest" : "Unluckiest") + ' seed</b> · #' + serie.seed +
          '<br>' + fmtStep(best[0]) + ' steps' +
          '<br>FID <b>' + best[1].toFixed(2) + '</b>';
        FLUtils.showTip(html, evt);
      }
      hit.on("mouseenter", tip).on("mousemove", function (e) { tip(e); })
        .on("mouseleave", function () { if (window.FLUtils) FLUtils.hideTip(); });

      return p;
    }
    var luckyPath = heroLine(lucky, T.lucky, "lucky");
    var unluckyPath = heroLine(unlucky, T.unlucky, "unlucky");

    // end markers + labels
    function endLabel(serie, color, txt, dy) {
      var last = serie.pts[serie.pts.length - 1];
      var cx = x(last[0]), cy = y(last[1]);
      var grp = gLbl.append("g").attr("class", "fl-endlabel");
      grp.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 4)
        .attr("fill", color).attr("stroke", T.surface).attr("stroke-width", 1.5);
      // on narrow (phone) the lucky/unlucky ends sit too close to label inline
      // without colliding — the legend names both lines, so keep just the dots.
      if (!narrow) {
        grp.append("text")
          .attr("x", cx - 8).attr("y", cy + dy)
          .attr("text-anchor", "end")
          .attr("font-family", "var(--sans)").attr("font-size", "10.5px")
          .attr("font-weight", 600).attr("letter-spacing", ".04em")
          .attr("fill", color)
          .text(txt);
      }
      return grp;
    }
    var luckyLbl = endLabel(lucky, T.lucky, "luckiest", -8);
    var unluckyLbl = endLabel(unlucky, T.unlucky, "unluckiest", 14);

    // ---------------- TARGET LINE + BRACKET (money shot) ----------------
    var yT = y(target);
    var xCross = x(cross), xEnd = x(STEP_MAX);

    var targetGrp = gMark.append("g").attr("class", "fl-target");
    // horizontal dashed target line
    targetGrp.append("line")
      .attr("x1", 0).attr("x2", iw).attr("y1", yT).attr("y2", yT)
      .attr("stroke", T.unlucky).attr("stroke-width", 1.4)
      .attr("stroke-dasharray", "5 5").attr("opacity", 0.85);
    // (target line is named by the legend; no inline label, to avoid overlap)

    // vertical guide where lucky first reaches target
    var guideGrp = gMark.append("g").attr("class", "fl-guide");
    guideGrp.append("line")
      .attr("x1", xCross).attr("x2", xCross).attr("y1", yT).attr("y2", ih)
      .attr("stroke", T.lucky).attr("stroke-width", 1.4)
      .attr("stroke-dasharray", "4 4").attr("opacity", 0.9);
    guideGrp.append("circle")
      .attr("cx", xCross).attr("cy", yT).attr("r", 4.5)
      .attr("fill", "none").attr("stroke", T.lucky).attr("stroke-width", 2);

    // bracket spanning saved steps, drawn just above the target line
    var spd = (s.speedup != null) ? s.speedup : (STEP_MAX / Math.max(cross, 1));
    var spdTxt = (Math.round(spd * 100) / 100);
    spdTxt = (spdTxt % 1 === 0) ? spdTxt.toFixed(0) : spdTxt.toFixed(spdTxt * 10 % 1 === 0 ? 1 : 2);

    var yBr = Math.max(16, yT - 30);       // bracket baseline
    var brGrp = gMark.append("g").attr("class", "fl-bracket");
    var tick = 7;
    var brPath =
      "M" + xCross + "," + (yBr + tick) +
      " L" + xCross + "," + yBr +
      " L" + xEnd + "," + yBr +
      " L" + xEnd + "," + (yBr + tick);
    brGrp.append("path")
      .attr("d", brPath).attr("fill", "none")
      .attr("stroke", T.goldBright).attr("stroke-width", 1.6)
      .attr("stroke-linecap", "round");

    var brMidX = (xCross + xEnd) / 2;
    // headline "Nx faster"
    brGrp.append("text")
      .attr("x", brMidX).attr("y", yBr - 14)
      .attr("text-anchor", "middle")
      .attr("font-family", "var(--serif-display)")
      .attr("font-size", "20px").attr("font-weight", 600)
      .attr("fill", T.goldBright)
      .style("text-shadow", "0 0 12px rgba(236,209,133,.4)")
      .text(spdTxt + "× faster");
    // the two step values being compared
    brGrp.append("text")
      .attr("x", brMidX).attr("y", yBr - 2)
      .attr("text-anchor", "middle")
      .attr("font-family", "var(--sans)").attr("font-size", "9.5px")
      .attr("letter-spacing", ".06em").attr("fill", T.gold).attr("opacity", 0.9)
      .text("lucky @ " + fmtStep(cross) + "  =  unlucky @ " + fmtStep(STEP_MAX));

    // small inline legend (lower-left, above the x-axis area)
    var legItems = [
      { c: T.lucky, t: "luckiest seed", dash: null, w: 3 },
      { c: T.unlucky, t: "unluckiest seed", dash: null, w: 3 },
      { c: T.unlucky, t: "target = unlucky @ 2M", dash: "4 4", w: 1.4 }
    ];
    var leg = g.append("g").attr("class", "fl-legend")
      .attr("transform", "translate(2," + (ih - 6) + ")");
    var ly = 0;
    legItems.slice().reverse().forEach(function (it) {
      var row = leg.append("g").attr("transform", "translate(0," + ly + ")");
      row.append("line").attr("x1", 0).attr("x2", 20).attr("y1", 0).attr("y2", 0)
        .attr("stroke", it.c).attr("stroke-width", it.w)
        .attr("stroke-linecap", "round")
        .attr("stroke-dasharray", it.dash);
      row.append("text").attr("x", 26).attr("y", 3.5)
        .attr("font-family", "var(--sans)").attr("font-size", "10px")
        .attr("letter-spacing", ".03em").attr("fill", T.fg).attr("opacity", 0.85)
        .text(it.t);
      ly -= 15;
    });

    // ===================================================================
    // ENTRANCE ANIMATION
    // !play: field draws in (fade) → hero lines stroke on → target+bracket fade
    // play / reduced: instant final state (everything already at full opacity)
    // ===================================================================
    function dashLen(node) {
      try { return node.getTotalLength(); } catch (e) { return 0; }
    }

    if (instant) {
      // everything is already drawn at final state; nothing to animate.
      return;
    }

    // start hidden
    fieldSel.attr("opacity", 0);
    gHero.selectAll("path.fl-hero").each(function () {
      var L = dashLen(this);
      d3.select(this).attr("stroke-dasharray", L + " " + L).attr("stroke-dashoffset", L);
    });
    gLbl.selectAll(".fl-endlabel").attr("opacity", 0);
    targetGrp.attr("opacity", 0);
    guideGrp.attr("opacity", 0);
    brGrp.attr("opacity", 0);

    // 1) faint field fades in, staggered
    fieldSel.transition().duration(650).delay(function (_, i) { return i * 18; })
      .attr("opacity", 0.16);

    var fieldDone = 350 + series.length * 18;

    // 2) hero lines stroke on
    var heroDur = 1100;
    gHero.selectAll("path.fl-hero").transition()
      .delay(fieldDone).duration(heroDur)
      .ease(d3.easeCubicInOut)
      .attr("stroke-dashoffset", 0)
      .on("end", function () { d3.select(this).attr("stroke-dasharray", null); });

    // end labels appear with the lines
    gLbl.selectAll(".fl-endlabel").transition()
      .delay(fieldDone + heroDur - 250).duration(500)
      .attr("opacity", 1);

    // 3) target line + guide + bracket fade in (the reveal)
    var revealAt = fieldDone + heroDur - 50;
    targetGrp.transition().delay(revealAt).duration(550).attr("opacity", 1);
    guideGrp.transition().delay(revealAt + 200).duration(550).attr("opacity", 1);
    brGrp.transition().delay(revealAt + 450).duration(650).attr("opacity", 1);
  };
})();
