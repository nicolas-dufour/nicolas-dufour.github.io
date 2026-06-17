/* ===================================================================
   mup.js — hyperparameter (learning-rate) transfer: a window, not a point.
   Learning-rate transfer sweep on FELT. Model-toggle (S/B/L/XL).
   x = learning rate (log), y = mean FID.
   GS-FID curve + ±std seed envelope, min ring, the flat-bottom optimum
   window, and ✗ markers where seeds diverged. y zooms to the GS envelope.
   Registers window.FLCharts.mup(mount, FL, opts).
   =================================================================== */
(function () {
  "use strict";
  window.FLCharts = window.FLCharts || {};

  // pretty learning-rate label: 5e-5, 1e-4, 5e-4 ...
  function fmtLR(v) {
    if (!(v > 0)) return "" + v;
    var exp = Math.floor(Math.log10(v));
    var mant = v / Math.pow(10, exp);
    var mr = Math.round(mant * 10) / 10;
    // collapse 10e-5 style to 1e-4
    if (mr >= 9.95) { mr = 1; exp += 1; }
    var ms = (Math.abs(mr - Math.round(mr)) < 0.05) ? "" + Math.round(mr) : mr.toFixed(1);
    return ms + "e" + (exp >= 0 ? "+" + exp : exp);
  }

  window.FLCharts.mup = function (mount, FL, opts) {
    opts = opts || {};
    var d3 = window.d3, U = window.FLUtils;
    if (!d3 || !U || !mount) return;

    // ---- idempotent reset ----
    d3.select(mount).selectAll("*").remove();

    var modelKey = opts.model || "DiT-B";
    var m = (FL && FL.mup && FL.mup[modelKey]) || null;
    if (!m || !m.gs || !m.gs.lr || !m.gs.lr.length) {
      d3.select(mount).append("div")
        .style("padding", "2rem").style("text-align", "center")
        .style("font-family", "var(--sans)").style("opacity", 0.7)
        .text("No data for " + modelKey + ".");
      return;
    }

    var display = m.display || modelKey;
    var theme = U.theme(mount);
    var play = opts.play === true;
    var still = play || U.reduced();
    var modelCol = U.modelColor(modelKey);

    var gs = m.gs, un = m.unguided || null;
    var n = gs.lr.length;

    // ---- build point arrays (guard NaNs) ----
    function pack(src) {
      if (!src || !src.lr) return [];
      var out = [];
      for (var i = 0; i < src.lr.length; i++) {
        var lr = +src.lr[i], mean = +src.mean[i];
        if (!isFinite(lr) || !isFinite(mean)) continue;
        out.push({
          i: i, lr: lr, mean: mean,
          std: isFinite(+src.std[i]) ? +src.std[i] : 0,
          cov: isFinite(+(src.cov ? src.cov[i] : NaN)) ? +src.cov[i] : null,
          ndiv: (src.ndiv && +src.ndiv[i]) || 0
        });
      }
      return out;
    }
    var gsPts = pack(gs);
    var unPts = pack(un);
    if (!gsPts.length) return;

    // ---- the optimum + flat-bottom window ----
    var minPt = gsPts[0];
    gsPts.forEach(function (p) { if (p.mean < minPt.mean) minPt = p; });
    var loBand = minPt.mean - minPt.std, hiBand = minPt.mean + minPt.std;
    // contiguous run of LRs (around the min) whose mean sits inside the min's seed envelope
    var winLo = minPt.i, winHi = minPt.i;
    while (winLo - 1 >= 0) {
      var pl = gsPts.find(function (p) { return p.i === winLo - 1; });
      if (pl && pl.mean <= hiBand && pl.mean >= loBand) winLo--; else break;
    }
    while (winHi + 1 < n) {
      var pr = gsPts.find(function (p) { return p.i === winHi + 1; });
      if (pr && pr.mean <= hiBand && pr.mean >= loBand) winHi++; else break;
    }
    var winPts = gsPts.filter(function (p) { return p.i >= winLo && p.i <= winHi; });
    var winLrLo = d3.min(winPts, function (p) { return p.lr; });
    var winLrHi = d3.max(winPts, function (p) { return p.lr; });
    var winRatio = winLrLo > 0 ? winLrHi / winLrLo : 0;

    // ---- layout ----
    var dim = U.svg(mount, { aspect: 0.5, margin: { top: 28, right: 26, bottom: 52, left: 60 } });
    var svg = dim.svg, g = dim.g, iw = dim.iw, ih = dim.ih;

    // ---- scales ----
    var x = d3.scaleLog()
      .domain([d3.min(gsPts, function (p) { return p.lr; }), d3.max(gsPts, function (p) { return p.lr; })])
      .range([0, iw]);

    // y covers the mean curve + the STABLE seed error bars (diverged-LR std is
    // excluded so a blow-up can't crush the scale; those LRs get a ✗ instead).
    var ebOK = gsPts.filter(function (p) { return !(p.ndiv > 0) && p.std > 0; });
    var yLo = d3.min(gsPts, function (p) { return p.mean; });
    var yHi = d3.max(gsPts, function (p) { return p.mean; });
    if (ebOK.length) {
      yLo = Math.min(yLo, d3.min(ebOK, function (p) { return p.mean - p.std; }));
      yHi = Math.max(yHi, d3.max(ebOK, function (p) { return p.mean + p.std; }));
    }
    var pad = (yHi - yLo) * 0.12;
    var y = d3.scaleLinear().domain([Math.max(0, yLo - pad), yHi + pad]).range([ih, 0]).nice();

    // ---- grid ----
    g.append("g").attr("class", "fl-grid")
      .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(""))
      .call(function (s) { s.select(".domain").remove(); });

    // ---- axes ----
    var xTickVals = gsPts.map(function (p) { return p.lr; });
    g.append("g").attr("class", "fl-axis").attr("transform", "translate(0," + ih + ")")
      .call(d3.axisBottom(x).tickValues(xTickVals).tickFormat(fmtLR).tickSizeOuter(0))
      .selectAll("text")
      .style("text-anchor", "middle")
      .attr("transform", iw < 460 ? "translate(0,4) rotate(28)" : null)
      .style("text-anchor", iw < 460 ? "start" : "middle");

    g.append("g").attr("class", "fl-axis")
      .call(d3.axisLeft(y).ticks(5).tickSizeOuter(0));

    // axis labels
    g.append("text").attr("class", "fl-axis-label")
      .attr("x", iw / 2).attr("y", ih + 46).attr("text-anchor", "middle")
      .text("learning rate (log)");
    g.append("text").attr("class", "fl-axis-label")
      .attr("transform", "rotate(-90)").attr("x", -ih / 2).attr("y", -46)
      .attr("text-anchor", "middle").text("Mean FID");

    // model display name, top-left of plot
    g.append("text")
      .attr("x", 2).attr("y", -12)
      .style("font-family", "var(--serif-display)").style("font-size", "15px")
      .style("fill", modelCol).style("font-style", "italic")
      .text(display);

    // ===================================================================
    //  WINDOW shading (drawn first, sits behind everything)
    // ===================================================================
    var winX0 = x(winLrLo), winX1 = x(winLrHi);
    // expand the band a touch beyond the dots for breathing room
    var winPad = Math.min(18, (winPts.length > 1 ? (winX1 - winX0) / (winPts.length - 1) : 30) * 0.45);
    var winRect = g.append("rect")
      .attr("x", winX0 - winPad).attr("y", 0)
      .attr("width", (winX1 - winX0) + 2 * winPad).attr("height", ih)
      .attr("fill", "#f6efdc").attr("opacity", 0)        // neutral wash, distinct from the gold curve
      .attr("rx", 4);
    var winTop = g.append("g");   // (dashed min-level line removed — it doubled the flat curve)

    // (the ±std seed envelope area was removed — at diverged LRs it ballooned into a
    //  confusing wedge and muddied the gold curve; the ✗ markers flag seed instability)
    var band = g.append("g");

    // (unguided reference curve dropped — it sat at FID ~65-92 and crushed the
    //  GS-FID scale; this chart is about the GS-FID valley, not the contrast)
    var unLine = null, unEnd = null;

    // ===================================================================
    //  ±seed error bars — where adjacent bars OVERLAP, those learning rates are
    //  within seed noise of each other, so you can't decide between them: that is
    //  what makes the optimum a WINDOW, not a point. (diverged LRs get a ✗.)
    // ===================================================================
    var ebG = g.append("g").attr("class", "mup-eb").attr("opacity", still ? 1 : 0);
    var EB_CAP = 3;
    gsPts.forEach(function (p) {
      if (p.ndiv > 0 || !(p.std > 0)) return;
      var px = x(p.lr);
      var yT = Math.max(0, y(p.mean + p.std));
      var yB = Math.min(ih, y(p.mean - p.std));
      [[px, px, yT, yB], [px - EB_CAP, px + EB_CAP, yT, yT], [px - EB_CAP, px + EB_CAP, yB, yB]]
        .forEach(function (s) {
          ebG.append("line").attr("x1", s[0]).attr("x2", s[1]).attr("y1", s[2]).attr("y2", s[3])
            .attr("stroke", theme.gold).attr("stroke-width", 1.3).attr("stroke-opacity", 0.55);
        });
    });

    // ===================================================================
    //  GS mean line
    // ===================================================================
    var lineGen = d3.line()
      .x(function (p) { return x(p.lr); })
      .y(function (p) { return y(p.mean); })
      .curve(d3.curveMonotoneX);
    var gsLine = g.append("path")
      .datum(gsPts).attr("d", lineGen)
      .attr("fill", "none").attr("stroke", theme.gold)
      .attr("stroke-width", 2.4).attr("stroke-linecap", "round");

    // ===================================================================
    //  GS dots (window dots emphasised) + invisible hover targets
    // ===================================================================
    function inWindow(p) { return p.i >= winLo && p.i <= winHi; }

    var dots = g.selectAll(".mup-dot").data(gsPts).enter()
      .append("circle").attr("class", "mup-dot")
      .attr("cx", function (p) { return x(p.lr); })
      .attr("cy", function (p) { return y(p.mean); })
      .attr("r", function (p) { return inWindow(p) ? 5 : 3.6; })
      .attr("fill", function (p) { return inWindow(p) ? theme.goldBright : theme.gold; })
      .attr("stroke", theme.surface).attr("stroke-width", 1.2)
      .attr("opacity", 0);

    // ✗ markers for diverged learning rates
    var divPts = gsPts.filter(function (p) { return p.ndiv > 0; });
    var divMarks = g.selectAll(".mup-div").data(divPts).enter()
      .append("text").attr("class", "mup-div")
      .attr("x", function (p) { return x(p.lr); })
      .attr("y", function (p) { return y(p.mean) - 12; })
      .attr("text-anchor", "middle")
      .style("font-family", "var(--sans)").style("font-weight", "700")
      .style("font-size", "13px").style("fill", theme.unlucky)
      .style("pointer-events", "none")
      .text("✗").attr("opacity", 0);

    // ===================================================================
    //  Min open ring (the optimum)
    // ===================================================================
    var ring = g.append("circle")
      .attr("cx", x(minPt.lr)).attr("cy", y(minPt.mean)).attr("r", 9)
      .attr("fill", "none").attr("stroke", theme.goldBright).attr("stroke-width", 2)
      .attr("opacity", 0);
    var ringDot = g.append("circle")
      .attr("cx", x(minPt.lr)).attr("cy", y(minPt.mean)).attr("r", 2.2)
      .attr("fill", theme.goldBright).attr("opacity", 0);

    // (window-width annotation removed — the rail states the LR-window width)

    // ---- one tidy caption ABOVE the band, up in the top margin clear of the
    //      gridlines and the curve (no multi-item legend: there is one curve) ----
    var winCx = Math.max(54, Math.min(iw - 54, (winX0 + winX1) / 2));
    var legend = g.append("g").style("opacity", still ? 1 : 0);   // name kept for the entrance
    legend.append("text")
      .attr("x", winCx).attr("y", -9).attr("text-anchor", "middle")
      .style("font-family", "var(--sans)").style("font-size", "9.5px")
      .style("letter-spacing", ".18em").style("text-transform", "uppercase")
      .style("fill", theme.gold).style("opacity", 0.9)
      .text("optimum window");

    // ===================================================================
    //  Hover layer
    // ===================================================================
    var hover = g.selectAll(".mup-hit").data(gsPts).enter()
      .append("circle").attr("class", "mup-hit")
      .attr("cx", function (p) { return x(p.lr); })
      .attr("cy", function (p) { return y(p.mean); })
      .attr("r", 16).attr("fill", "transparent")
      .style("cursor", "pointer");

    hover
      .on("mouseenter", function (ev, p) {
        var html = "<b>" + display + "</b> &middot; lr " + fmtLR(p.lr) +
          "<br>mean FID <b>" + p.mean.toFixed(2) + "</b>";
        if (p.cov != null) html += "<br>CoV " + p.cov.toFixed(2) + "%";
        if (p.std) html += " &middot; σ " + p.std.toFixed(3);
        if (p.ndiv > 0) html += "<br><span style='color:" + theme.unlucky + "'>" +
          p.ndiv + " seed" + (p.ndiv > 1 ? "s" : "") + " diverged</span>";
        if (inWindow(p)) html += "<br><span style='color:" + theme.goldBright +
          "'>inside optimum window</span>";
        U.showTip(html, ev);
        // emphasise the matching dot
        dots.filter(function (d2) { return d2.i === p.i; })
          .transition().duration(120).attr("r", inWindow(p) ? 7 : 5.6);
      })
      .on("mousemove", function (ev) { U.moveTip(ev); })
      .on("mouseleave", function (ev, p) {
        U.hideTip();
        dots.filter(function (d2) { return d2.i === p.i; })
          .transition().duration(160).attr("r", inWindow(p) ? 5 : 3.6);
      });

    if (divPts.length) {
      divMarks
        .style("pointer-events", "all").style("cursor", "pointer")
        .on("mouseenter", function (ev, p) {
          U.showTip("<b>lr " + fmtLR(p.lr) + "</b><br><span style='color:" + theme.unlucky +
            "'>" + p.ndiv + " seed" + (p.ndiv > 1 ? "s" : "") + " diverged</span>", ev);
        })
        .on("mousemove", function (ev) { U.moveTip(ev); })
        .on("mouseleave", function () { U.hideTip(); });
    }

    // ===================================================================
    //  Render: instant (play) or staged entrance
    // ===================================================================
    function showWindow() {
      winRect.transition().duration(still ? 0 : 500).attr("opacity", 0.10);
      ring.transition().duration(still ? 0 : 420).attr("opacity", 1);
      ringDot.transition().duration(still ? 0 : 420).attr("opacity", 1);
      legend.transition().duration(still ? 0 : 400).style("opacity", 1);
    }

    if (still) {
      band.attr("opacity", 1);
      if (unLine) { unLine.attr("opacity", 0.7); unEnd.attr("opacity", 1); }
      dots.attr("opacity", 1);
      divMarks.attr("opacity", 1);
      showWindow();
    } else {
      // 1) error bars fade in under the curve
      ebG.transition().delay(380).duration(500).attr("opacity", 1);
      // 2) GS line draws
      var len = gsLine.node().getTotalLength();
      gsLine.attr("stroke-dasharray", len + " " + len)
        .attr("stroke-dashoffset", len)
        .transition().delay(350).duration(900).ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0)
        .on("end", function () { d3.select(this).attr("stroke-dasharray", null); });
      // dots pop in along the line
      dots.transition().delay(function (p, i) { return 450 + i * 55; }).duration(260)
        .attr("opacity", 1);
      divMarks.transition().delay(1300).duration(400).attr("opacity", 1);
      // 3) min ring + window annotation last
      setTimeout(showWindow, 1350);
    }
  };
})();
