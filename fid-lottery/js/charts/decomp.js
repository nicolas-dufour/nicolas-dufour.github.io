/* ===================================================================
   Act II — "Which reel spins the FID?"  (variance decomposition)
   Vertical bars of BETWEEN-seed σ per single random source, with a
   constant WITHIN-seed floor marker and a non-additivity annotation
   above "All sources".  On IVORY (light).
   window.FLCharts.decomp(mount, FL, opts)
   =================================================================== */
(function () {
  "use strict";

  window.FLCharts = window.FLCharts || {};

  window.FLCharts.decomp = function (mount, FL, opts) {
    opts = opts || {};
    if (!mount) return;
    var U = window.FLUtils;

    // --- guard data ---------------------------------------------------
    var D = FL && FL.decomposition;
    var conds = D && D.conditions;
    if (!U || !conds || !conds.length) {
      d3.select(mount).selectAll("*").remove();
      d3.select(mount).append("div")
        .style("font-family", "var(--sans)").style("opacity", 0.6)
        .style("padding", "1rem").text("Decomposition data unavailable.");
      return;
    }

    var naiveSum = (D.naive_sum != null) ? D.naive_sum : null;
    var observedAll = (D.observed_all != null) ? D.observed_all : conds[0].between;

    var play = !!opts.play;
    var still = play || U.reduced();
    var th = U.theme(mount);

    // small suit glyph per reel (decorative, tied to the slot machine)
    var SUIT = { vary_all: "♠", vary_noise: "♥", vary_init: "♦", vary_data: "♣" };
    // short labels for narrow (phone) frames — full names collide under the bars
    var SHORT = { vary_all: "All", vary_noise: "Noise", vary_init: "Init", vary_data: "Data" };
    // bar label percentages (match the prose: 100 / 77 / 67 / 51)
    function pctLabel(c) {
      if (c.key === "vary_all") return "100%";
      return Math.round((c.between / observedAll) * 100) + "%";
    }

    // --- layout -------------------------------------------------------
    var dims = U.svg(mount, {
      aspect: 0.7,
      margin: { top: 24, right: 22, bottom: 58, left: 58 }
    });
    var g = dims.g, iw = dims.iw, ih = dims.ih;
    var narrow = dims.W < 480;

    // just enough headroom for the % label above the tallest bar
    var yMax = d3.max(conds, function (c) { return c.between; }) * 1.16;

    var x = d3.scaleBand()
      .domain(conds.map(function (c) { return c.key; }))
      .range([0, iw]).paddingInner(0.42).paddingOuter(0.28);
    var y = d3.scaleLinear().domain([0, yMax]).range([ih, 0]);

    // brass(gold) -> claret ramp by magnitude for the three single sources
    var singles = conds.filter(function (c) { return c.key !== "vary_all"; });
    var bSpan = d3.extent(singles, function (c) { return c.between; });
    var ramp = d3.scaleLinear()
      .domain([bSpan[0], bSpan[1]])
      .range([th.gold, th.claret]);
    function barFill(c) {
      if (c.key === "vary_all") return "none";          // distinct: outlined
      return ramp(c.between);
    }

    // --- defs: soft drop shadow + subtle vertical sheen ---------------
    var defs = dims.svg.append("defs");
    var uid = "decomp" + Math.floor(Math.random() * 1e6);
    var sh = defs.append("filter").attr("id", uid + "-sh")
      .attr("x", "-30%").attr("y", "-30%").attr("width", "160%").attr("height", "160%");
    sh.append("feDropShadow")
      .attr("dx", 0).attr("dy", 3).attr("stdDeviation", 3)
      .attr("flood-color", "#5a2a14").attr("flood-opacity", 0.20);

    // --- gridlines (horizontal) --------------------------------------
    var grid = g.append("g").attr("class", "fl-grid");
    grid.selectAll("line").data(y.ticks(5)).enter().append("line")
      .attr("x1", 0).attr("x2", iw)
      .attr("y1", function (d) { return y(d); })
      .attr("y2", function (d) { return y(d); });

    // --- axes ---------------------------------------------------------
    U.axisLeft(g, y, { ticks: 5 });
    g.append("text").attr("class", "fl-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -ih / 2).attr("y", -42).attr("text-anchor", "middle")
      .text("σ between seeds (FID)");

    // bottom axis: condition labels + suit glyph, no tick lines
    var ax = g.append("g").attr("class", "fl-axis")
      .attr("transform", "translate(0," + ih + ")");
    ax.append("line").attr("x1", 0).attr("x2", iw).attr("y1", 0).attr("y2", 0);
    var labels = ax.selectAll(".cond-lab").data(conds).enter().append("g")
      .attr("class", "cond-lab")
      .attr("transform", function (c) { return "translate(" + (x(c.key) + x.bandwidth() / 2) + ",0)"; });
    labels.append("text")
      .attr("y", 20).attr("text-anchor", "middle")
      .style("font-family", "var(--sans)").style("font-size", "11.5px")
      .style("letter-spacing", "0.02em")
      .attr("fill", th.fg)
      .text(function (c) { return narrow ? (SHORT[c.key] || c.label) : c.label; });
    labels.append("text")
      .attr("y", 38).attr("text-anchor", "middle")
      .style("font-size", "12px")
      .attr("fill", function (c) { return c.key === "vary_all" ? th.claret : th.gold; })
      .text(function (c) { return SUIT[c.key] || ""; });

    // --- WITHIN-seed floor: a faint band + dashed reference line ------
    // mean within across conditions -> "the scoring floor is constant".
    var withinMean = d3.mean(conds, function (c) { return c.within; });
    g.append("rect")
      .attr("x", 0).attr("width", iw)
      .attr("y", y(withinMean)).attr("height", Math.max(0, ih - y(withinMean)))
      .attr("fill", th.band).attr("pointer-events", "none");
    var floor = g.append("g").attr("opacity", still ? 1 : 0);
    floor.append("line")
      .attr("x1", 0).attr("x2", iw)
      .attr("y1", y(withinMean)).attr("y2", y(withinMean))
      .attr("stroke", th.bandStroke).attr("stroke-width", 1.4)
      .attr("stroke-dasharray", "5 4");
    // (the within-seed floor reads as the faint band + dashed line, no label)

    // --- bars ---------------------------------------------------------
    var bw = x.bandwidth();
    var bars = g.selectAll(".reel-bar").data(conds).enter().append("g")
      .attr("class", "reel-bar")
      .attr("transform", function (c) { return "translate(" + x(c.key) + ",0)"; })
      .style("cursor", "pointer");

    // between-seed bar
    var rects = bars.append("rect")
      .attr("x", 0).attr("width", bw).attr("rx", 3)
      .attr("fill", barFill)
      .attr("stroke", function (c) { return c.key === "vary_all" ? th.claret : "none"; })
      .attr("stroke-width", function (c) { return c.key === "vary_all" ? 2 : 0; })
      .attr("stroke-dasharray", function (c) { return c.key === "vary_all" ? "4 3" : null; })
      .style("filter", function (c) { return c.key === "vary_all" ? null : "url(#" + uid + "-sh)"; });

    // a vertical sheen on filled bars
    bars.filter(function (c) { return c.key !== "vary_all"; }).append("rect")
      .attr("x", 0).attr("width", bw).attr("rx", 3)
      .attr("fill", "rgba(255,255,255,0.10)").attr("pointer-events", "none")
      .attr("class", "sheen");

    // within-seed thin marker bar (front, narrow, centred) -> floor per cond
    var inW = Math.max(5, bw * 0.20);
    var wbars = bars.append("rect")
      .attr("class", "within-bar")
      .attr("x", (bw - inW) / 2).attr("width", inW).attr("rx", 1.5)
      .attr("fill", th.fg).attr("opacity", 0.0);

    // pct-of-all label above each bar
    var pct = bars.append("text")
      .attr("class", "pct-lab")
      .attr("x", bw / 2).attr("text-anchor", "middle")
      .style("font-family", "var(--serif-display)")
      .style("font-size", "17px").style("font-weight", "600")
      .attr("fill", function (c) { return c.key === "vary_all" ? th.claret : th.goldBright; })
      .attr("opacity", 0)
      .text(pctLabel);

    // (non-additivity annotation removed — the rail states the real σ 0.44 vs 0.50 predicted)

    // --- tooltip ------------------------------------------------------
    function tip(c) {
      return "<b>" + c.label + "</b> " + (SUIT[c.key] || "") +
        "<br>between-seed σ <b>" + c.between.toFixed(3) + "</b>" +
        " &nbsp;(" + (c.pct_of_all != null ? c.pct_of_all : Math.round(c.between / observedAll * 100)) + "% of all)" +
        "<br>within-seed σ <b>" + c.within.toFixed(3) + "</b>" +
        "<br>median <b>" + c.median.toFixed(2) + "</b>" +
        " &nbsp;<span style='opacity:.75'>q1–q3 " + c.q1.toFixed(2) + "–" + c.q3.toFixed(2) + "</span>";
    }
    bars
      .on("mousemove", function (e, c) {
        d3.select(this).select("rect").attr("opacity", 0.92);
        U.showTip(tip(c), e);
      })
      .on("mouseleave", function () {
        d3.select(this).select("rect").attr("opacity", 1);
        U.hideTip();
      });

    // --- entrance -----------------------------------------------------
    function placeFinal() {
      rects.attr("y", function (c) { return y(c.between); })
        .attr("height", function (c) { return Math.max(0, ih - y(c.between)); });
      bars.selectAll(".sheen").each(function () {
        var c = d3.select(this.parentNode).datum();
        d3.select(this).attr("y", y(c.between)).attr("height", Math.max(0, ih - y(c.between)));
      });
      wbars.attr("y", function (c) { return y(c.within); })
        .attr("height", function (c) { return Math.max(0, ih - y(c.within)); })
        .attr("opacity", 0.85);
      pct.attr("y", function (c) { return y(c.between) - 10; }).attr("opacity", 1);
    }

    if (still) {
      placeFinal();
      return;
    }

    // start collapsed at baseline
    rects.attr("y", ih).attr("height", 0);
    bars.selectAll(".sheen").attr("y", ih).attr("height", 0);
    wbars.attr("y", ih).attr("height", 0);
    pct.attr("y", ih - 10);

    var ease = d3.easeCubicOut;
    rects.transition().duration(820)
      .delay(function (c, i) { return 120 + i * 130; }).ease(ease)
      .attr("y", function (c) { return y(c.between); })
      .attr("height", function (c) { return Math.max(0, ih - y(c.between)); });

    bars.selectAll(".sheen").each(function () {
      var node = this, c = d3.select(node.parentNode).datum();
      var i = conds.indexOf(c);
      d3.select(node).transition().duration(820).delay(120 + i * 130).ease(ease)
        .attr("y", y(c.between)).attr("height", Math.max(0, ih - y(c.between)));
    });

    wbars.transition().duration(640)
      .delay(function (c, i) { return 320 + i * 130; }).ease(ease)
      .attr("y", function (c) { return y(c.within); })
      .attr("height", function (c) { return Math.max(0, ih - y(c.within)); })
      .attr("opacity", 0.85);

    pct.transition().duration(520)
      .delay(function (c, i) { return 560 + i * 130; })
      .attr("y", function (c) { return y(c.between) - 10; })
      .attr("opacity", 1);

    floor.transition().duration(700).delay(180).attr("opacity", 1);
  };
})();
