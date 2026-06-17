/* ===================================================================
   metrics.js — "The lottery is not just FID."
   Per-metric seed CoV across the six generative-model metrics we score
   (76 cells each). Horizontal range plot: thin min–max whisker, thick
   p10–p90 bar, median dot. Inception FID (the metric this paper studies)
   is drawn in claret; the five others in gold — every one sits well
   clear of zero. On IVORY.  window.FLCharts.metrics(mount, FL, opts)
   =================================================================== */
(function () {
  "use strict";
  window.FLCharts = window.FLCharts || {};

  window.FLCharts.metrics = function (mount, FL, opts) {
    opts = opts || {};
    var U = window.FLUtils, d3 = window.d3;
    if (!mount || !d3 || !U) return;
    d3.select(mount).selectAll("*").remove();
    var play = opts.play === true, still = play || U.reduced();

    var cb = (FL && FL.covbands) || [];
    if (!cb.length) {
      d3.select(mount).append("div").style("padding", "2rem").style("text-align", "center")
        .style("font-family", "var(--sans)").style("opacity", 0.7).text("No metric data.");
      return;
    }

    var th = U.theme(mount);
    var rows = cb.slice().sort(function (a, b) { return b.median - a.median; });  // widest lottery on top
    function isFID(d) { return d.metric === "incfid"; }
    function col(d) { return isFID(d) ? th.claret : th.gold; }

    var dim = U.svg(mount, { aspect: 0.7, margin: { top: 20, right: 46, bottom: 46, left: 108 } });
    var g = dim.g, iw = dim.iw, ih = dim.ih;

    var maxX = d3.max(rows, function (d) { return d.max; }) * 1.05;
    var x = d3.scaleLinear().domain([0, maxX]).range([0, iw]);
    var y = d3.scaleBand().domain(rows.map(function (d) { return d.metric; }))
      .range([0, ih]).paddingInner(0.5).paddingOuter(0.35);
    var bh = y.bandwidth();

    // ---- gridlines + CoV axis ----
    g.append("g").attr("class", "fl-grid").selectAll("line").data(x.ticks(5)).enter().append("line")
      .attr("x1", function (d) { return x(d); }).attr("x2", function (d) { return x(d); })
      .attr("y1", 0).attr("y2", ih);
    g.append("g").attr("class", "fl-axis").attr("transform", "translate(0," + ih + ")")
      .call(d3.axisBottom(x).ticks(5).tickFormat(function (d) { return d + "%"; }).tickSizeOuter(0));
    g.append("text").attr("class", "fl-axis-label")
      .attr("x", iw / 2).attr("y", ih + 38).attr("text-anchor", "middle")
      .text("Seed CoV  (%)");

    // ---- one row per metric ----
    var rowG = g.selectAll(".m-row").data(rows).enter().append("g").attr("class", "m-row")
      .attr("transform", function (d) { return "translate(0," + (y(d.metric) + bh / 2) + ")"; })
      .style("cursor", "pointer");

    // metric label on the left
    rowG.append("text").attr("x", -12).attr("dy", "0.32em").attr("text-anchor", "end")
      .attr("font-family", "var(--sans)").attr("font-size", 12)
      .attr("font-weight", function (d) { return isFID(d) ? 700 : 500; })
      .attr("fill", function (d) { return isFID(d) ? th.claret : th.fg; })
      .text(function (d) { return d.label; });

    // min–max whisker (thin) + end caps
    rowG.append("line").attr("class", "m-whisk")
      .attr("x1", function (d) { return x(d.min); }).attr("x2", function (d) { return x(d.max); })
      .attr("stroke", function (d) { return col(d); }).attr("stroke-width", 1).attr("stroke-opacity", 0.4);
    [["min"], ["max"]].forEach(function (k) {
      rowG.append("line")
        .attr("x1", function (d) { return x(d[k[0]]); }).attr("x2", function (d) { return x(d[k[0]]); })
        .attr("y1", -4).attr("y2", 4)
        .attr("stroke", function (d) { return col(d); }).attr("stroke-width", 1).attr("stroke-opacity", 0.4);
    });

    // p10–p90 thick bar
    var bar = rowG.append("line").attr("class", "m-bar")
      .attr("x1", function (d) { return x(d.p10); })
      .attr("x2", function (d) { return still ? x(d.p90) : x(d.p10); })
      .attr("stroke", function (d) { return col(d); })
      .attr("stroke-width", function (d) { return isFID(d) ? 7 : 5.5; })
      .attr("stroke-linecap", "round").attr("stroke-opacity", 0.85);

    // median dot
    var dot = rowG.append("circle")
      .attr("cx", function (d) { return x(d.median); }).attr("cy", 0)
      .attr("r", function (d) { return isFID(d) ? 5.5 : 4.5; })
      .attr("fill", function (d) { return col(d); })
      .attr("stroke", th.surface).attr("stroke-width", 1.4)
      .attr("opacity", still ? 1 : 0);

    // median value, to the right of the whisker
    rowG.append("text")
      .attr("x", function (d) { return x(d.max) + 8; }).attr("dy", "0.32em")
      .attr("font-family", "var(--mono)").attr("font-size", 10)
      .attr("fill", function (d) { return col(d); }).attr("opacity", still ? 1 : 0).attr("class", "m-val")
      .text(function (d) { return d.median.toFixed(2) + "%"; });

    // ---- hover ----
    rowG.on("mousemove", function (ev, d) {
      U.showTip("<b>" + d.label + "</b><br>median CoV <b>" + d.median.toFixed(2) + "%</b>" +
        "<br>p10–p90 " + d.p10.toFixed(2) + "–" + d.p90.toFixed(2) + "%" +
        "<br><span style='opacity:.7'>range " + d.min.toFixed(2) + "–" + d.max.toFixed(2) + "% · " + d.n + " cells</span>", ev);
    }).on("mouseleave", function () { U.hideTip(); });

    // ---- entrance: bars grow from the left, dots + values pop in ----
    if (still) return;
    var ease = d3.easeCubicOut;
    bar.transition().delay(function (d, i) { return 120 + i * 90; }).duration(620).ease(ease)
      .attr("x2", function (d) { return x(d.p90); });
    dot.transition().delay(function (d, i) { return 360 + i * 90; }).duration(360).attr("opacity", 1);
    rowG.selectAll(".m-val").transition().delay(function (d, i) { return 460 + i * 90; }).duration(360).attr("opacity", 1);
  };
})();
