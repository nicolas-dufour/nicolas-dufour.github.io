/* ===================================================================
   golden.js — Act V — "Guidance halves the floor and reshuffles
   the winners." A slopegraph / bump chart of the seed-ranking change
   from Unguided FID to GS-FID. On felt.
   window.FLCharts.golden(mount, FL, opts)
   =================================================================== */
(function () {
  "use strict";
  window.FLCharts = window.FLCharts || {};

  window.FLCharts.golden = function (mount, FL, opts) {
    opts = opts || {};
    var play = opts.play === true;
    var reduce = (window.FLUtils && FLUtils.reduced && FLUtils.reduced()) || false;
    var instant = play || reduce;

    // ---- guard data ----
    var G = (FL && FL.golden) || {};
    var staticRows = Array.isArray(G.bump_static) ? G.bump_static : [];
    var movedRows = Array.isArray(G.bump_moved) ? G.bump_moved : [];
    if (!staticRows.length && !movedRows.length) {
      d3.select(mount).selectAll("*").remove();
      d3.select(mount).append("div")
        .style("padding", "2rem").style("text-align", "center")
        .style("font-family", "var(--sans)").style("opacity", "0.7")
        .text("Ranking data unavailable.");
      return;
    }

    var theme = FLUtils.theme(mount);

    // ---- fold the {x,rank,seed} rows into one record per seed ----
    function fold(rows, moved) {
      var by = {};
      rows.forEach(function (r) {
        var s = String(r.seed);
        if (!by[s]) by[s] = { seed: r.seed, moved: moved };
        if (r.x === 1) by[s].r1 = r.rank;
        else if (r.x === 2) by[s].r2 = r.rank;
      });
      return Object.keys(by).map(function (k) { return by[k]; })
        .filter(function (d) { return d.r1 != null && d.r2 != null; });
    }
    var statics = fold(staticRows, false);
    var moved = fold(movedRows, true);
    var all = statics.concat(moved);
    if (!all.length) { d3.select(mount).selectAll("*").remove(); return; }

    // rank domain (rank 1 = best/top). cover the full set.
    var ranks = [];
    all.forEach(function (d) { ranks.push(d.r1, d.r2); });
    var rMax = Math.max.apply(null, ranks);
    var rMin = Math.min.apply(null, ranks);

    // direction: rose UP in rank (toward best = smaller number) -> lucky green; fell -> claret
    moved.forEach(function (d) {
      d.delta = d.r1 - d.r2;            // >0 = improved (moved toward rank 1)
      d.places = Math.abs(d.delta);
      d.col = d.delta > 0 ? theme.lucky : theme.unlucky;
    });
    // draw the largest movers last so they sit on top
    moved.sort(function (a, b) { return a.places - b.places; });

    // ---- responsive svg ----
    // narrow (phone): a much taller frame so the 25 rank rows spread out, since
    // the seed-id labels are dropped and only the crossings need to read.
    var W0 = Math.max(320, Math.round(mount.clientWidth || 720));
    var narrow = W0 < 480;
    var dim = FLUtils.svg(mount, {
      aspect: narrow ? 0.92 : 0.54,
      margin: { top: 34, right: 44, bottom: 30, left: 44 }
    });
    var svg = dim.svg, g = dim.g, iw = dim.iw, ih = dim.ih, W = dim.W;

    // the slopegraph uses the full width now (CoV halving + ρ live in the rail)
    var insetW = 0, gap = 0, plotW = iw;

    // column x positions inside the slopegraph (leave room for labels)
    var labPad = 30;
    var xL = labPad;
    var xR = plotW - labPad;
    if (xR <= xL) { xL = plotW * 0.18; xR = plotW * 0.82; }

    var y = d3.scaleLinear().domain([rMin, rMax]).range([0, ih]); // rank1 at top
    var dotR = 4.2;

    // (header removed — ρ = 0.73 and "8 of 25 move ≥ 5 places" live in the rail and chart-sub)

    // ===================================================================
    // axis spines + endpoint titles + a few rank ticks
    // ===================================================================
    function spine(x, title) {
      g.append("line")
        .attr("x1", x).attr("x2", x).attr("y1", -6).attr("y2", ih + 6)
        .attr("stroke", theme.axis).attr("stroke-width", 1);
      g.append("text")
        .attr("x", x).attr("y", -20).attr("text-anchor", "middle")
        .attr("class", "fl-axis-label")
        .attr("font-size", narrow ? 9.5 : 11).attr("fill", theme.gold)
        .text(title);
    }
    // short titles on narrow so they don't run off the edges
    spine(xL, narrow ? "Unguided" : "Unguided FID rank");
    spine(xR, narrow ? "GS-FID" : "GS-FID rank");

    // "best / worst" cues at the ends of the left axis
    g.append("text").attr("x", xL - 16).attr("y", y(rMin) + 3)
      .attr("text-anchor", "end").attr("font-family", "var(--sans)")
      .attr("font-size", 9).attr("letter-spacing", "0.16em")
      .attr("fill", theme.faint).text("BEST");
    g.append("text").attr("x", xL - 16).attr("y", y(rMax) + 3)
      .attr("text-anchor", "end").attr("font-family", "var(--sans)")
      .attr("font-size", 9).attr("letter-spacing", "0.16em")
      .attr("fill", theme.faint).text("WORST");

    // ===================================================================
    // STATIC lines — faint thin gold (the stable majority)
    // ===================================================================
    var staticG = g.append("g").attr("class", "fl-golden-static");
    var sLines = staticG.selectAll("line").data(statics).enter()
      .append("line")
      .attr("x1", xL).attr("y1", function (d) { return y(d.r1); })
      .attr("x2", xR).attr("y2", function (d) { return y(d.r2); })
      .attr("stroke", theme.gold).attr("stroke-width", 1)
      .attr("stroke-opacity", instant ? 0.18 : 0)
      .attr("stroke-linecap", "round");

    // static endpoint dots (tiny, faint)
    function endpoints(sel, data, side) {
      return sel.selectAll(null).data(data).enter().append("circle")
        .attr("cx", side === "L" ? xL : xR)
        .attr("cy", function (d) { return y(side === "L" ? d.r1 : d.r2); });
    }
    var sDotL = endpoints(staticG.append("g"), statics, "L")
      .attr("r", 1.8).attr("fill", theme.gold).attr("fill-opacity", instant ? 0.3 : 0);
    var sDotR = endpoints(staticG.append("g"), statics, "R")
      .attr("r", 1.8).attr("fill", theme.gold).attr("fill-opacity", instant ? 0.3 : 0);

    // ===================================================================
    // MOVED lines — bold, coloured by direction. The visual story.
    // ===================================================================
    var movedG = g.append("g").attr("class", "fl-golden-moved");

    var lineGen = function (d) {
      return "M" + xL + "," + y(d.r1) + "L" + xR + "," + y(d.r2);
    };

    var mPaths = movedG.selectAll("path.fl-bump").data(moved).enter()
      .append("path")
      .attr("class", "fl-bump")
      .attr("d", lineGen)
      .attr("fill", "none")
      .attr("stroke", function (d) { return d.col; })
      .attr("stroke-width", 2.4)
      .attr("stroke-linecap", "round")
      .attr("stroke-opacity", instant ? 0.95 : 0)
      .style("cursor", "pointer")
      .style("filter", "drop-shadow(0 1px 3px rgba(0,0,0,0.45))");

    // moved endpoint dots
    function bigDots(host, side) {
      return host.selectAll(null).data(moved).enter().append("circle")
        .attr("cx", side === "L" ? xL : xR)
        .attr("cy", function (d) { return y(side === "L" ? d.r1 : d.r2); })
        .attr("r", dotR)
        .attr("fill", theme.surface)
        .attr("stroke", function (d) { return d.col; })
        .attr("stroke-width", 2)
        .attr("opacity", instant ? 1 : 0);
    }
    var mDotL = bigDots(movedG.append("g"), "L");
    var mDotR = bigDots(movedG.append("g"), "R");

    // seed id labels at both ends of moved lines — dropped on narrow (the 5-digit
    // mono ids collide when ranks are close; the crossings carry the story there).
    var labL, labR;
    if (narrow) {
      labL = movedG.append("g").selectAll("text");   // empty selections keep the
      labR = movedG.append("g").selectAll("text");   // entrance transitions safe
    } else {
      labL = movedG.append("g").selectAll("text").data(moved).enter()
        .append("text")
        .attr("x", xL - 12).attr("y", function (d) { return y(d.r1) + 3.2; })
        .attr("text-anchor", "end")
        .attr("font-family", "var(--mono)").attr("font-size", 9.5)
        .attr("fill", function (d) { return d.col; })
        .attr("opacity", instant ? 0.95 : 0)
        .text(function (d) { return d.seed; });
      labR = movedG.append("g").selectAll("text").data(moved).enter()
        .append("text")
        .attr("x", xR + 12).attr("y", function (d) { return y(d.r2) + 3.2; })
        .attr("text-anchor", "start")
        .attr("font-family", "var(--mono)").attr("font-size", 9.5)
        .attr("fill", function (d) { return d.col; })
        .attr("opacity", instant ? 0.95 : 0)
        .text(function (d) { return d.seed; });
    }

    // ---- hover (whole-line hit areas, slightly fatter than the visible stroke) ----
    var hit = movedG.append("g").selectAll("path").data(moved).enter()
      .append("path")
      .attr("d", lineGen).attr("fill", "none")
      .attr("stroke", "transparent").attr("stroke-width", 14)
      .style("cursor", "pointer");

    function highlight(d, on) {
      mPaths.filter(function (p) { return p === d; })
        .attr("stroke-width", on ? 3.6 : 2.4)
        .attr("stroke-opacity", on ? 1 : 0.95);
      // dim the others a touch
      mPaths.filter(function (p) { return p !== d; })
        .attr("stroke-opacity", on ? 0.32 : 0.95);
      sLines.attr("stroke-opacity", on ? 0.07 : 0.18);
    }
    hit
      .on("mouseenter", function (ev, d) {
        highlight(d, true);
        var dir = d.delta > 0 ? "climbed" : "fell";
        var arrow = d.delta > 0 ? "▲" : "▼";
        var html =
          "<b>Seed " + d.seed + "</b><br>" +
          "Unguided #" + d.r1 + " → GS-FID #" + d.r2 + "<br>" +
          "<span style='color:" + d.col + "'>" + arrow + " " + dir + " " +
          d.places + " place" + (d.places === 1 ? "" : "s") + "</span>";
        FLUtils.showTip(html, ev);
      })
      .on("mousemove", function (ev) { FLUtils.moveTip(ev); })
      .on("mouseleave", function (ev, d) { highlight(d, false); FLUtils.hideTip(); });

    // ===================================================================
    // CoV inset — the floor halving: 1.26% -> 0.67%
    // ===================================================================
    if (insetW > 0) {
      var ucov = (G.unguided_cov != null) ? G.unguided_cov : 1.26;
      var gcov = (G.gs_cov != null) ? G.gs_cov : 0.67;
      var ix = dim.m.left + plotW + gap;
      var inset = svg.append("g").attr("transform", "translate(" + ix + "," + dim.m.top + ")");
      var cx = insetW / 2;

      // framed card hairline
      inset.append("rect")
        .attr("x", 0).attr("y", -6).attr("width", insetW).attr("height", ih + 12)
        .attr("rx", 4).attr("fill", "none")
        .attr("stroke", theme.bandStroke).attr("stroke-opacity", 0.45)
        .attr("stroke-width", 1);

      inset.append("text")
        .attr("x", cx).attr("y", 16).attr("text-anchor", "middle")
        .attr("class", "fl-axis-label").attr("font-size", 10).attr("fill", theme.gold)
        .text("Relative spread (CoV)");

      // big number — before
      var yTop = ih * 0.30, yBot = ih * 0.74;
      var numU = inset.append("text")
        .attr("x", cx).attr("y", yTop).attr("text-anchor", "middle")
        .attr("font-family", "var(--serif-display)").attr("font-size", 34)
        .attr("fill", theme.fg).attr("opacity", 0.78);
      inset.append("text")
        .attr("x", cx).attr("y", yTop + 18).attr("text-anchor", "middle")
        .attr("font-family", "var(--sans)").attr("font-size", 9)
        .attr("letter-spacing", "0.18em").attr("fill", theme.faint)
        .text("UNGUIDED");

      // arrow between the two numbers
      var ay1 = yTop + 28, ay2 = yBot - 46;
      inset.append("line")
        .attr("x1", cx).attr("x2", cx).attr("y1", ay1).attr("y2", ay2)
        .attr("stroke", theme.lucky).attr("stroke-width", 2)
        .attr("marker-end", null);
      inset.append("path")
        .attr("d", "M" + (cx - 5) + "," + (ay2 - 7) + "L" + cx + "," + ay2 +
                   "L" + (cx + 5) + "," + (ay2 - 7))
        .attr("fill", "none").attr("stroke", theme.lucky).attr("stroke-width", 2)
        .attr("stroke-linecap", "round").attr("stroke-linejoin", "round");

      // big number — after (gold, the win)
      var numG = inset.append("text")
        .attr("x", cx).attr("y", yBot).attr("text-anchor", "middle")
        .attr("font-family", "var(--serif-display)").attr("font-size", 42)
        .attr("fill", theme.goldBright)
        .style("text-shadow", "0 0 18px rgba(236,209,133,0.35)");
      inset.append("text")
        .attr("x", cx).attr("y", yBot + 18).attr("text-anchor", "middle")
        .attr("font-family", "var(--sans)").attr("font-size", 9)
        .attr("letter-spacing", "0.18em").attr("fill", theme.gold)
        .text("GS-FID · HALVED");

      // animate the counts (animateCount respects reduced motion)
      if (instant) {
        numU.text(ucov.toFixed(2) + "%");
        numG.text(gcov.toFixed(2) + "%");
      } else {
        FLUtils.animateCount(numU.node(), ucov, { dur: 900, dec: 2, suffix: "%" });
        FLUtils.animateCount(numG.node(), gcov, { dur: 1300, dec: 2, suffix: "%", from: ucov });
      }
    }

    // ===================================================================
    // ENTRANCE
    // endpoints drop onto each axis -> then the lines draw across.
    // ===================================================================
    if (!instant) {
      var ease = d3.easeCubicOut;
      var dropDur = 620, drawDur = 820;

      // 1) endpoints drop in from above, on both axes (static + moved)
      function dropIn(sel, side, finalFill, fillKey) {
        sel
          .attr("cy", -14)
          .transition().delay(function (d, i) { return i * 14; })
          .duration(dropDur).ease(d3.easeBounceOut)
          .attr("cy", function (d) { return y(side === "L" ? d.r1 : d.r2); });
      }
      // static dots fade + settle
      sDotL.attr("cy", -14).transition().delay(function (d, i) { return i * 8; })
        .duration(dropDur).ease(ease)
        .attr("cy", function (d) { return y(d.r1); })
        .attr("fill-opacity", 0.3);
      sDotR.attr("cy", -14).transition().delay(function (d, i) { return i * 8; })
        .duration(dropDur).ease(ease)
        .attr("cy", function (d) { return y(d.r2); })
        .attr("fill-opacity", 0.3);

      mDotL.attr("cy", -14).transition().delay(function (d, i) { return 120 + i * 24; })
        .duration(dropDur).ease(d3.easeBounceOut)
        .attr("cy", function (d) { return y(d.r1); })
        .attr("opacity", 1);
      mDotR.attr("cy", -14).transition().delay(function (d, i) { return 120 + i * 24; })
        .duration(dropDur).ease(d3.easeBounceOut)
        .attr("cy", function (d) { return y(d.r2); })
        .attr("opacity", 1);

      var dropEnd = 120 + (moved.length * 24) + dropDur;

      // 2) static lines fade in quietly while endpoints settle
      sLines.transition().delay(dropEnd * 0.55).duration(600)
        .attr("stroke-opacity", 0.18);

      // 3) moved lines DRAW across (the crossings are the reveal)
      mPaths.each(function () {
        var len = this.getTotalLength();
        d3.select(this)
          .attr("stroke-dasharray", len + " " + len)
          .attr("stroke-dashoffset", len)
          .attr("stroke-opacity", 0.95);
      });
      mPaths.transition()
        .delay(function (d, i) { return dropEnd + i * 70; })
        .duration(drawDur).ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0)
        .on("end", function () { d3.select(this).attr("stroke-dasharray", null); });

      // 4) seed labels fade in as each line finishes
      labL.transition().delay(function (d, i) { return dropEnd + i * 70 + drawDur * 0.5; })
        .duration(420).attr("opacity", 0.95);
      labR.transition().delay(function (d, i) { return dropEnd + i * 70 + drawDur * 0.5; })
        .duration(420).attr("opacity", 0.95);
    }
  };
})();
