/* ===================================================================
   FLCharts.panel — Act I flagship two-axis panel (paper fig:overview).
   Mount: #chart-panel · FELT (dark).
   25 trained networks (columns, sorted by mean asc) × 10 sampling-seed
   FIDs (jittered dots). A horizontal gold band shows the training-lottery
   ±1σ envelope; a right-hand bracket sells the "3.2× wider" headline.
   All numbers come from FL.baseline — nothing is invented.
   =================================================================== */
(function () {
  "use strict";
  window.FLCharts = window.FLCharts || {};

  window.FLCharts.panel = function (mount, FL, opts) {
    opts = opts || {};
    var play = opts.play === true;
    if (!mount || !window.d3 || !window.FLUtils) return;

    var U = window.FLUtils, d3 = window.d3;
    var B = FL && FL.baseline;
    if (!B || !Array.isArray(B.panel) || !B.panel.length) {
      d3.select(mount).selectAll("*").remove();
      return;
    }

    var th = U.theme(mount);
    var reduced = U.reduced();
    var anim = !play && !reduced;

    // ---- data: sort columns by mean ascending (graceful staircase) ----
    var cols = B.panel
      .filter(function (p) { return p && Array.isArray(p.fids) && p.fids.length; })
      .slice()
      .sort(function (a, b) { return a.mean - b.mean; });
    var n = cols.length;

    var grandMean = B.grand_mean;
    var sigB = B.sigma_between;       // training-lottery ±1σ (the wide band)
    var sigW = B.sigma_within;        // within-seed spread (representative)
    var ratio = B.ratio;             // 3.2×
    var nSample = B.n_sample || (cols[0] && cols[0].fids.length) || 10;

    // ---- responsive frame (extra right margin for the comparison bracket) ----
    // narrow (phone): a taller frame + tighter side margins so the band sits
    // below the legend and the variance gauge isn't crushed off the right edge.
    var W0 = Math.max(320, Math.round(mount.clientWidth || 720));
    var narrow = W0 < 480;
    var frame = U.svg(mount, {
      aspect: narrow ? 0.82 : 0.5,
      margin: narrow
        ? { top: 24, right: 16, bottom: 46, left: 54 }
        : { top: 26, right: 110, bottom: 48, left: 58 }
    });
    var svg = frame.svg, g = frame.g, iw = frame.iw, ih = frame.ih;

    svg.attr("aria-label",
      "Two-axis panel: 25 trained networks versus 10 sampling seeds each. " +
      "The between-training spread is " + (ratio != null ? ratio.toFixed(1) : "3.2") +
      " times wider than the within-network sampling spread.");

    // ---- scales ----
    var x = d3.scaleBand()
      .domain(d3.range(n))
      .range([0, iw])
      .paddingInner(0.45)
      .paddingOuter(0.5);

    // y domain: cover all dots AND the full gold band, with a little air.
    var dataMin = d3.min(cols, function (c) { return c.min; });
    var dataMax = d3.max(cols, function (c) { return c.max; });
    var lo = Math.min(dataMin, grandMean - sigB);
    var hi = Math.max(dataMax, grandMean + sigB);
    var padY = (hi - lo) * 0.14;
    var y = d3.scaleLinear()
      .domain([lo - padY, hi + padY])
      .nice()
      .range([ih, 0]);

    // jitter is deterministic per (column, sample) so re-renders are stable.
    function jitter(ci, si) {
      var s = Math.sin((ci + 1) * 12.9898 + (si + 1) * 78.233) * 43758.5453;
      return (s - Math.floor(s)) - 0.5; // [-0.5, 0.5)
    }

    // ===================================================================
    // 1) GOLD BAND — training-lottery ±1σ envelope (behind everything)
    // ===================================================================
    var bandTop = y(grandMean + sigB);
    var bandBot = y(grandMean - sigB);
    var bandMid = y(grandMean);
    var bandH = bandBot - bandTop;

    var bandG = g.append("g").attr("class", "fl-band");
    var band = bandG.append("rect")
      .attr("x", 0)
      .attr("width", iw)
      .attr("fill", th.band)
      .attr("stroke", th.bandStroke)
      .attr("stroke-width", 1)
      .attr("rx", 2);

    // top & bottom edge accents
    var edgeTop = bandG.append("line")
      .attr("x1", 0).attr("x2", iw)
      .attr("stroke", th.bandStroke).attr("stroke-width", 1).attr("opacity", 0.8);
    var edgeBot = bandG.append("line")
      .attr("x1", 0).attr("x2", iw)
      .attr("stroke", th.bandStroke).attr("stroke-width", 1).attr("opacity", 0.8);

    // dashed grand-mean center line
    var midLine = bandG.append("line")
      .attr("x1", 0).attr("x2", iw)
      .attr("y1", bandMid).attr("y2", bandMid)
      .attr("stroke", th.gold).attr("stroke-width", 1.25)
      .attr("stroke-dasharray", "5 5").attr("opacity", 0.9);

    // grand-mean label riding the dashed line
    var midLabel = g.append("text")
      .attr("class", "fl-band-label")
      .attr("x", 4).attr("y", bandMid - 6)
      .attr("fill", th.goldBright)
      .attr("font-family", "var(--sans)")
      .attr("font-size", 10)
      .attr("letter-spacing", "0.06em")
      .attr("opacity", 0.92)
      .text("grand mean " + grandMean.toFixed(2));

    function setBand(p) {
      // p in [0,1]: 0 = collapsed to center line, 1 = full height
      var t = bandTop + (1 - p) * (bandMid - bandTop);
      var b = bandBot + (1 - p) * (bandMid - bandBot);
      band.attr("y", t).attr("height", Math.max(0, b - t));
      edgeTop.attr("y1", t).attr("y2", t);
      edgeBot.attr("y1", b).attr("y2", b);
    }

    // ===================================================================
    // 2) AXES
    // ===================================================================
    var yAxis = g.append("g").attr("class", "fl-axis")
      .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));

    g.append("text")
      .attr("class", "fl-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -ih / 2).attr("y", -42)
      .attr("text-anchor", "middle")
      .text("Inception FID");

    // sparse x ticks: every 5th column index (positional, "staircase →")
    var xAxisG = g.append("g").attr("class", "fl-axis")
      .attr("transform", "translate(0," + ih + ")");
    var xTickVals = x.domain().filter(function (d) { return d % 5 === 0; });
    xAxisG.call(
      d3.axisBottom(x)
        .tickValues(xTickVals)
        .tickFormat(function (d) { return "#" + (d + 1); })
        .tickSizeOuter(0)
    );

    g.append("text")
      .attr("class", "fl-axis-label")
      .attr("x", iw / 2).attr("y", ih + 42)
      .attr("text-anchor", "middle")
      .text(narrow ? "sorted by mean FID  →" : "trained networks, sorted by mean FID  →");

    // ===================================================================
    // 3) COLUMNS — sample dots (jittered) + trained-network mean diamond
    // ===================================================================
    var colW = x.bandwidth();
    var jitterW = Math.min(colW, 22);
    var dotR = Math.max(2, Math.min(3.4, colW * 0.34));
    var diamond = d3.symbol().type(d3.symbolDiamond)
      .size(Math.max(46, Math.min(120, colW * colW * 0.9)));

    var colG = g.selectAll(".fl-col")
      .data(cols)
      .join("g")
      .attr("class", "fl-col")
      .attr("transform", function (d, i) {
        return "translate(" + (x(i) + colW / 2) + ",0)";
      });

    // faint vertical guide showing each column's within-seed extent
    colG.append("line")
      .attr("class", "fl-col-extent")
      .attr("x1", 0).attr("x2", 0)
      .attr("y1", function (d) { return y(d.min); })
      .attr("y2", function (d) { return y(d.max); })
      .attr("stroke", th.sample)
      .attr("stroke-width", 1)
      .attr("opacity", 0.18);

    // sample-seed dots
    var dots = colG.selectAll(".fl-dot")
      .data(function (d, ci) {
        return d.fids.map(function (f, si) {
          return { fid: f, ci: ci, si: si };
        });
      })
      .join("circle")
      .attr("class", "fl-dot")
      .attr("cx", function (d) { return jitter(d.ci, d.si) * jitterW; })
      .attr("r", dotR)
      .attr("fill", th.sample)
      .attr("fill-opacity", 0.5)
      .attr("stroke", th.sample)
      .attr("stroke-opacity", 0.35)
      .attr("stroke-width", 0.5);

    // trained-network mean diamond (gold)
    var means = colG.append("path")
      .attr("class", "fl-mean")
      .attr("d", diamond())
      .attr("fill", th.train)
      .attr("stroke", th.goldBright)
      .attr("stroke-width", 1)
      .attr("transform", function (d) { return "translate(0," + y(d.mean) + ")"; });

    // ---- hover: invisible hit-rect per column ----
    colG.append("rect")
      .attr("class", "fl-hit")
      .attr("x", -colW / 2)
      .attr("width", colW)
      .attr("y", 0)
      .attr("height", ih)
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("mouseenter", function (ev, d) {
        d3.select(this.parentNode).select(".fl-mean")
          .attr("fill", th.goldBright)
          .attr("transform", "translate(0," + y(d.mean) + ") scale(1.35)");
        d3.select(this.parentNode).selectAll(".fl-dot").attr("fill-opacity", 0.85);
        d3.select(this.parentNode).select(".fl-col-extent").attr("opacity", 0.5);
        var spread = (d.max - d.min);
        U.showTip(
          "<b>Seed " + d.seed + "</b><br>" +
          "mean FID&nbsp;&nbsp;<b>" + d.mean.toFixed(2) + "</b><br>" +
          "range&nbsp;&nbsp;" + d.min.toFixed(2) + "&ndash;" + d.max.toFixed(2) +
          "&nbsp;<span style='opacity:.7'>(Δ " + spread.toFixed(2) + ")</span><br>" +
          "<span style='opacity:.7'>" + nSample + " sampling seeds</span>",
          ev
        );
      })
      .on("mousemove", function (ev) { U.moveTip(ev); })
      .on("mouseleave", function (ev, d) {
        d3.select(this.parentNode).select(".fl-mean")
          .attr("fill", th.train)
          .attr("transform", "translate(0," + y(d.mean) + ") scale(1)");
        d3.select(this.parentNode).selectAll(".fl-dot").attr("fill-opacity", 0.5);
        d3.select(this.parentNode).select(".fl-col-extent").attr("opacity", 0.18);
        U.hideTip();
      });

    // ===================================================================
    // 4) VARIANCE GAUGE (right margin) — sells the "3.2× wider" headline.
    //    Two filled bars on a SHARED baseline, drawn to the plot's own
    //    y-scale: gold = between-network ±1σ (the band height itself), blue
    //    = within-network ±1σ. Same bottom edge → the height ratio you see
    //    IS the 3.2×. Both are the real σ's to the same scale (honest).
    // ===================================================================
    // On narrow (phone) the gauge is dropped entirely: it crowds the right margin
    // and collides with itself, while the rail below already states 3.2× / 0.44 /
    // within-vs-between. Dropping it lets the staircase use the full width.
    var brk = null, goldBar = null, blueBar = null;
    if (!narrow) {
    brk = g.append("g").attr("class", "fl-gauge");
    var barW = 15, gap = 9;
    var goldX = iw + 16, blueX = goldX + barW + gap;
    var gBase = bandBot;                                       // common baseline
    var goldH0 = gBase - bandTop;                              // = full band (2σ_between)
    var blueH0 = sigB ? goldH0 * (sigW / sigB) : goldH0 / 3.2; // → band ÷ 3.2
    var blueTop = gBase - blueH0;

    brk.append("line")
      .attr("x1", goldX - 3).attr("x2", blueX + barW + 3)
      .attr("y1", gBase).attr("y2", gBase)
      .attr("stroke", th.faint).attr("stroke-width", 1).attr("opacity", 0.55);

    goldBar = brk.append("rect")
      .attr("x", goldX).attr("width", barW)
      .attr("y", bandTop).attr("height", goldH0)
      .attr("fill", th.band).attr("stroke", th.bandStroke).attr("stroke-width", 1).attr("rx", 1.5);
    blueBar = brk.append("rect")
      .attr("x", blueX).attr("width", barW)
      .attr("y", blueTop).attr("height", blueH0)
      .attr("fill", th.sample).attr("fill-opacity", 0.22)
      .attr("stroke", th.sample).attr("stroke-width", 1).attr("rx", 1.5);

    // σ value above each bar
    brk.append("text").attr("x", goldX + barW / 2).attr("y", bandTop - 6)
      .attr("text-anchor", "middle").attr("fill", th.goldBright)
      .attr("font-family", "var(--sans)").attr("font-size", 9.5)
      .text(sigB != null ? sigB.toFixed(2) : "0.44");
    brk.append("text").attr("x", blueX + barW / 2).attr("y", blueTop - 6)
      .attr("text-anchor", "middle").attr("fill", th.sample)
      .attr("font-family", "var(--sans)").attr("font-size", 9)
      .text(sigW != null ? sigW.toFixed(2) : "0.14");

    // two-line tag under each bar
    function gaugeTag(cx, l1, l2) {
      var t = brk.append("text").attr("x", cx).attr("y", gBase + 13)
        .attr("text-anchor", "middle").attr("fill", th.faint)
        .attr("font-family", "var(--sans)").attr("font-size", 7).attr("letter-spacing", "0.07em");
      t.append("tspan").attr("x", cx).text(l1);
      t.append("tspan").attr("x", cx).attr("dy", 8.5).text(l2);
    }
    // (bar tags dropped — the σ values + the legend colours identify the two bars)

    // headline ratio: beside the bars on desktop; on narrow it would clip off the
    // right edge, so stack it ABOVE the two bars (centred) instead.
    var ratioTxt = (ratio != null ? ratio.toFixed(1) : "3.2") + "×";
    var ratioCx = narrow ? ((goldX + blueX + barW) / 2) : (blueX + barW + 8);
    var ratioCy = narrow ? (bandTop - 26) : ((bandTop + gBase) / 2);
    var ratioAnchor = narrow ? "middle" : "start";
    var ratioG = brk.append("g")
      .attr("transform", "translate(" + ratioCx + "," + ratioCy + ")");
    ratioG.append("text")
      .attr("text-anchor", ratioAnchor)
      .attr("fill", th.goldBright).attr("font-family", "var(--serif-display)")
      .attr("font-size", narrow ? 15 : 18).attr("font-style", "italic").attr("dominant-baseline", "middle")
      .text(ratioTxt);
    ratioG.append("text")
      .attr("text-anchor", ratioAnchor)
      .attr("y", 13).attr("fill", th.faint)
      .attr("font-family", "var(--sans)").attr("font-size", 8).attr("letter-spacing", "0.14em")
      .text("WIDER");
    }  // end gauge (desktop only)

    // ===================================================================
    // 5) LEGEND (top-left, on the felt)
    // ===================================================================
    var legend = g.append("g").attr("class", "fl-legend")
      .attr("transform", "translate(2,2)");
    var items = [
      { type: "dot", color: th.sample, label: "sampling seed" },
      { type: "diamond", color: th.train, label: "trained-network mean" },
      { type: "band", color: th.bandStroke, label: "training-lottery ±1σ" }
    ];
    var lg = legend.selectAll(".fl-leg-item")
      .data(items).join("g")
      .attr("class", "fl-leg-item")
      .attr("transform", function (d, i) { return "translate(0," + (i * 15) + ")"; });
    lg.each(function (d) {
      var s = d3.select(this);
      if (d.type === "dot") {
        s.append("circle").attr("cx", 5).attr("cy", 0).attr("r", 3.4)
          .attr("fill", d.color).attr("fill-opacity", 0.6);
      } else if (d.type === "diamond") {
        s.append("path")
          .attr("d", d3.symbol().type(d3.symbolDiamond).size(60)())
          .attr("transform", "translate(5,0)")
          .attr("fill", d.color).attr("stroke", th.goldBright).attr("stroke-width", 0.8);
      } else {
        s.append("rect").attr("x", 1).attr("y", -4).attr("width", 9).attr("height", 8)
          .attr("fill", th.band).attr("stroke", d.color).attr("stroke-width", 1);
      }
    });
    lg.append("text")
      .attr("x", 14).attr("y", 0).attr("dominant-baseline", "middle")
      .attr("fill", th.faint)
      .attr("font-family", "var(--sans)").attr("font-size", 10)
      .text(function (d) { return d.label; });

    // ===================================================================
    // 6) ENTRANCE ANIMATION
    //    band expands from the center line, dots rise into place with a
    //    per-column stagger, means pop in. play / reduced -> instant.
    // ===================================================================
    if (!anim) {
      setBand(1);
      dots.attr("cy", function (d) { return y(d.fid); });
      means.attr("opacity", 1);
      midLine.attr("opacity", 0.9);
      midLabel.attr("opacity", 0.92);
      legend.attr("opacity", 1);
      if (brk) brk.attr("opacity", 1);
      return;
    }

    var ease = d3.easeCubicOut;

    // band collapsed to the center line, then expands open
    setBand(0);
    midLine.attr("opacity", 0);
    midLabel.attr("opacity", 0);
    legend.attr("opacity", 0);
    if (brk) {
      brk.attr("opacity", 0);
      goldBar.attr("y", gBase).attr("height", 0);
      blueBar.attr("y", gBase).attr("height", 0);
    }

    bandG.transition().duration(700).ease(d3.easeCubicInOut)
      .tween("band", function () {
        var I = d3.interpolateNumber(0, 1);
        return function (t) { setBand(I(t)); };
      });
    midLine.transition().delay(420).duration(500).attr("opacity", 0.9);
    midLabel.transition().delay(560).duration(400).attr("opacity", 0.92);

    // dots: start at the center line, rise (with stagger by column) to value
    dots
      .attr("cy", bandMid)
      .attr("opacity", 0)
      .transition()
      .delay(function (d) { return 460 + d.ci * 22 + d.si * 8; })
      .duration(620)
      .ease(ease)
      .attr("opacity", 0.5)
      .attr("cy", function (d) { return y(d.fid); });

    // means: pop in after their column's dots have mostly settled
    means
      .attr("opacity", 0)
      .attr("transform", function (d) { return "translate(0," + bandMid + ") scale(0.2)"; })
      .transition()
      .delay(function (d, i) { return 760 + i * 22; })
      .duration(420)
      .ease(d3.easeBackOut.overshoot(2))
      .attr("opacity", 1)
      .attr("transform", function (d) { return "translate(0," + y(d.mean) + ") scale(1)"; });

    // legend fades in; the variance gauge fades in and its bars grow last
    legend.transition().delay(1080).duration(500).attr("opacity", 1);
    if (brk) {
      brk.transition().delay(1120).duration(450).attr("opacity", 1);
      goldBar.transition().delay(1160).duration(720).ease(ease).attr("y", bandTop).attr("height", goldH0);
      blueBar.transition().delay(1320).duration(620).ease(ease).attr("y", blueTop).attr("height", blueH0);
    }
  };
})();
