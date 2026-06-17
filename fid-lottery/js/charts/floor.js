/* ===================================================================
   FLCharts.floor — Act IV · "The 1–2% floor that won't move"
   CoV (%) trajectories across compute (200k→2M) for the four models,
   inside the house-edge band [0.74%, 2.06%] with a dashed median at
   1.30%. On IVORY: claret/ink text, gold accents. d3 v7.
   =================================================================== */
(function () {
  "use strict";
  window.FLCharts = window.FLCharts || {};

  window.FLCharts.floor = function (mount, FL, opts) {
    opts = opts || {};
    var play = opts.play === true;
    if (!mount || !FL || !FL.models || !FL.scaling) return;

    // ---- idempotent: clear mount ----
    d3.select(mount).selectAll("*").remove();

    var th = FLUtils.theme(mount);
    var reduced = FLUtils.reduced();
    var instant = play || reduced;

    // ---- band extent + median (prefer FL.covbands incfid; fall back to spec) ----
    var inc = (FL.covbands || []).filter(function (b) { return b.metric === "incfid"; })[0];
    var bandLo = inc ? inc.min : 0.744;
    var bandHi = inc ? inc.max : 2.057;
    var median = inc ? inc.median : 1.298;

    // ---- assemble per-model series from scaling data ----
    var series = [];
    FL.models.forEach(function (m) {
      var s = FL.scaling[m];
      if (!s || !s.steps || !s.cov) return;
      var pts = [];
      var n = Math.min(s.steps.length, s.cov.length);
      for (var i = 0; i < n; i++) {
        var st = +s.steps[i], cv = +s.cov[i];
        if (!isFinite(st) || !isFinite(cv)) continue;
        pts.push({ step: st, cov: cv });
      }
      if (!pts.length) return;
      series.push({
        key: m,
        label: s.display || m,
        color: FLUtils.modelColor(m),
        cov2m: (s.cov_2m != null ? +s.cov_2m : pts[pts.length - 1].cov),
        pts: pts
      });
    });
    if (!series.length) return;

    // ---- responsive frame (extra right margin for inline model labels) ----
    // aspect tuned so the svg fills the act-card (the rail sets the card height;
    // a shorter chart left dead space below it and squashed the band flat)
    var dim = FLUtils.svg(mount, {
      aspect: 0.62,
      margin: { top: 26, right: 92, bottom: 48, left: 56 }
    });
    var g = dim.g, iw = dim.iw, ih = dim.ih;
    var narrow = dim.W < 560;

    // ---- scales ----
    var allSteps = [].concat.apply([], series.map(function (d) {
      return d.pts.map(function (p) { return p.step; });
    }));
    var xDom = d3.extent(allSteps);
    var x = d3.scaleLinear().domain(xDom).range([0, iw]);

    // y spans the band comfortably so every line stays clearly inside
    var yLo = Math.min(bandLo, d3.min(series, function (d) {
      return d3.min(d.pts, function (p) { return p.cov; });
    }));
    var yHi = Math.max(bandHi, d3.max(series, function (d) {
      return d3.max(d.pts, function (p) { return p.cov; });
    }));
    // margin around the band so it reads as a bounded zone (not the full background);
    // the taller frame keeps the four lines well separated even with this headroom
    var pad = (yHi - yLo) * 0.16;
    var y = d3.scaleLinear().domain([Math.max(0, yLo - pad), yHi + pad]).range([ih, 0]);

    // ---- gridlines (horizontal, faint) ----
    g.append("g").attr("class", "fl-grid")
      .selectAll("line").data(y.ticks(5)).enter().append("line")
      .attr("x1", 0).attr("x2", iw)
      .attr("y1", function (d) { return y(d); })
      .attr("y2", function (d) { return y(d); });

    // ---- house-edge band (soft horizontal shade) ----
    var bandG = g.append("g");
    var bandRect = bandG.append("rect")
      .attr("x", 0).attr("width", iw)
      .attr("y", y(bandHi))
      .attr("height", Math.max(0, y(bandLo) - y(bandHi)))
      .attr("fill", th.band)
      .attr("stroke", th.bandStroke)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "1 3")
      .attr("rx", 2);

    // band edge labels (min / max of the house edge)
    var edgeLab = bandG.append("g")
      .attr("font-family", "var(--sans)")
      .attr("fill", th.faint)
      .attr("font-size", 9.5)
      .style("letter-spacing", ".1em");
    edgeLab.append("text")
      .attr("x", 4).attr("y", y(bandHi) - 4)
      .text("NOISE FLOOR  " + bandHi.toFixed(2) + "%");
    edgeLab.append("text")
      .attr("x", 4).attr("y", y(bandLo) + 12)
      .text(bandLo.toFixed(2) + "%");

    // ---- axes ----
    var xTickVals = [500000, 1000000, 2000000].filter(function (v) {
      return v >= xDom[0] && v <= xDom[1];
    });
    var xFmt = function (v) {
      var mn = v / 1e6;
      return (mn % 1 === 0 ? mn.toFixed(0) : mn.toFixed(1)) + "M";
    };
    g.append("g").attr("class", "fl-axis")
      .attr("transform", "translate(0," + ih + ")")
      .call(d3.axisBottom(x).tickValues(xTickVals).tickFormat(xFmt).tickSizeOuter(0));

    g.append("g").attr("class", "fl-axis")
      .call(d3.axisLeft(y).ticks(5).tickFormat(function (d) { return d + "%"; }).tickSizeOuter(0));

    // axis labels
    g.append("text").attr("class", "fl-axis-label")
      .attr("x", iw).attr("y", ih + 38).attr("text-anchor", "end")
      .text("Training steps");
    g.append("text").attr("class", "fl-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", 0).attr("y", -42).attr("text-anchor", "end")
      .text("CoV of FID  (%)");

    // ---- median line (drawn into its own group so it can come in last) ----
    var medG = g.append("g");
    var medLine = medG.append("line")
      .attr("x1", 0).attr("x2", iw)
      .attr("y1", y(median)).attr("y2", y(median))
      .attr("stroke", th.claret)
      .attr("stroke-width", 1.8)
      .attr("stroke-dasharray", "6 4");
    // (median value is labelled in the de-collided right-edge labels below)

    // ---- line generator ----
    var line = d3.line()
      .x(function (p) { return x(p.step); })
      .y(function (p) { return y(p.cov); })
      .curve(d3.curveMonotoneX);

    // ---- per-model trajectories (clean thin lines, no per-checkpoint dots) ----
    var lineG = g.append("g");
    var labG = g.append("g");

    function tipHtml(d, p) {
      return "<b>" + d.label + "</b><br>" +
        xFmt(p.step) + " steps<br>" +
        "CoV " + p.cov.toFixed(2) + "%";
    }

    series.forEach(function (d) {
      // trajectory path — thin, no shadow, so overlaps stay legible
      d._path = lineG.append("path")
        .datum(d.pts)
        .attr("fill", "none")
        .attr("stroke", d.color)
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.92)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("d", line);

      // a fat transparent hit area gives a tooltip anywhere along the line
      lineG.append("path")
        .datum(d.pts)
        .attr("fill", "none").attr("stroke", "transparent").attr("stroke-width", 14)
        .attr("d", line).style("cursor", "pointer")
        .on("mousemove", function (event) {
          var mx = d3.pointer(event, g.node())[0];
          var best = d.pts[0], bd = Infinity;
          d.pts.forEach(function (p) { var dd = Math.abs(x(p.step) - mx); if (dd < bd) { bd = dd; best = p; } });
          FLUtils.showTip(tipHtml(d, best), event);
        })
        .on("mouseleave", FLUtils.hideTip);

      d._end = d.pts[d.pts.length - 1];
    });

    // the median reference reads on top of the lines
    medG.raise();

    // ---- direct labels at the right, de-collided so they never overlap ----
    var labX = iw + 9;
    var specs = series.map(function (d) {
      return { text: d.label, color: d.color, yData: y(d._end.cov), dot: true, italic: false };
    });
    specs.push({ text: "median " + median.toFixed(2) + "%", color: th.claret, yData: y(median), dot: false, italic: true });
    specs.sort(function (a, b) { return a.yData - b.yData; });
    var GAP = 15, prev = -Infinity;
    specs.forEach(function (sp) { sp.yLab = Math.max(sp.yData, prev + GAP); prev = sp.yLab; });
    var over = specs.length ? specs[specs.length - 1].yLab - ih : 0;
    if (over > 0) specs.forEach(function (sp) { sp.yLab -= over; });

    specs.forEach(function (sp) {
      if (sp.dot) labG.append("circle").attr("cx", iw).attr("cy", sp.yData).attr("r", 3)
        .attr("fill", th.surface).attr("stroke", sp.color).attr("stroke-width", 1.6);
      if (Math.abs(sp.yLab - sp.yData) > 1)
        labG.append("line").attr("x1", iw + 1).attr("y1", sp.yData).attr("x2", labX - 2).attr("y2", sp.yLab)
          .attr("stroke", sp.color).attr("stroke-width", 1).attr("stroke-opacity", 0.45);
      labG.append("text")
        .attr("x", labX).attr("y", sp.yLab).attr("dy", "0.32em")
        .attr("font-family", sp.italic ? "var(--serif-body)" : "var(--sans)")
        .attr("font-style", sp.italic ? "italic" : "normal")
        .attr("font-size", narrow ? 9.5 : 11)
        .attr("font-weight", 600)
        .style("letter-spacing", sp.italic ? "0" : ".04em")
        .attr("fill", sp.color)
        .text(sp.text);
    });

    // (top legend dropped — each line is named inline at its right end;
    //  the ≈2×CoV rule lives in the rail)

    // ===================================================================
    // ENTRANCE: band fades in → lines draw left→right → median line + label last
    // play / reduced-motion → instant final state.
    // ===================================================================
    if (instant) return;

    var TBAND = 600, TLINE = 1100;

    bandRect.attr("opacity", 0);
    edgeLab.attr("opacity", 0);
    bandRect.transition().duration(TBAND).attr("opacity", 1);
    edgeLab.transition().delay(TBAND * 0.4).duration(TBAND).attr("opacity", 1);

    medG.attr("opacity", 0);
    labG.attr("opacity", 0);

    // lines draw left→right via stroke-dashoffset, staggered by model
    series.forEach(function (d, i) {
      var node = d._path.node();
      var len = node.getTotalLength ? node.getTotalLength() : iw;
      var delay = TBAND * 0.5 + i * 130;
      d._path
        .attr("stroke-dasharray", len + " " + len)
        .attr("stroke-dashoffset", len)
        .transition().delay(delay).duration(TLINE).ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0)
        .on("end", function () { d3.select(this).attr("stroke-dasharray", null); });
    });

    // median line + the de-collided labels come in once the lines have drawn
    var endDelay = TBAND * 0.5 + (series.length - 1) * 130 + TLINE;
    medG.transition().delay(endDelay - 220).duration(500).attr("opacity", 1);
    labG.transition().delay(endDelay).duration(450).attr("opacity", 1);
  };
})();
