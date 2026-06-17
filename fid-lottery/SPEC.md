# Chart-module contract — FID Lottery website

You are building ONE self-contained render module for the companion website of the paper
*The FID Lottery*. The site is an antique Monte-Carlo gaming-salon (green baize, gold filigree,
Didone serifs, suit motifs). Charts must look like they belong in that salon: elegant, gold/claret
on felt or claret/ink on ivory, smooth entrance animations, hover tooltips. Use **d3 v7** (already
loaded as global `d3`). No other libraries, no network calls.

## Hard rules
1. Output a single JS file. It must **not** redeclare globals other than registering itself:
   ```js
   window.FLCharts = window.FLCharts || {};
   window.FLCharts.<KEY> = function (mount, FL, opts) { /* ... */ };
   ```
2. Render INTO `mount` (a DOM element). **Clear it first** (`d3.select(mount).selectAll('*').remove()`)
   so re-calls (resize / model toggle) are idempotent.
3. `opts = { play: <bool>, model: <string> }`.
   - `opts.play === true` → render the FINAL state instantly, **no entrance transitions** (used for
     headless screenshots and resize). When false, animate the entrance.
   - `opts.model` → for model-toggle charts (`race`, `mup`), the selected key, one of
     `"DiT-S","DiT-B","DiT-L","DiT-XL"`.
4. Be responsive: size to `mount.clientWidth` via a viewBox; never hard-code pixel width assuming
   desktop. Use `FLUtils.svg(mount, {...})` which sets up a responsive `<svg>` with viewBox.
5. Use the shared palette/theme from `FLUtils` (read `js/utils.js`). Detect light vs dark background
   with `FLUtils.theme(mount)` → returns `{fg, faint, grid, axis, gold, goldBright, train, sample,
   lucky, unlucky, claret, band, bandStroke, surface}`. Axis `<g>` should get class `fl-axis`
   (CSS styles it for both backgrounds). Optional grid lines: class `fl-grid`.
6. Tooltips: `FLUtils.showTip(html, event)`, `FLUtils.moveTip(event)`, `FLUtils.hideTip()`.
7. Respect reduced motion: if `FLUtils.reduced()` is true, skip transitions.
8. Keep it dependency-light and robust: guard against missing data; round displayed numbers sensibly
   (FID 2 dp, CoV 2 dp, σ 3 dp, ratios 1–2 dp). All numbers come from `FL` — never invent values.

## FLUtils API (available globally)
- `FLUtils.svg(mount, {width?, height?, aspect?=0.56, margin?:{top,right,bottom,left}})`
  → `{svg, g, W, H, iw, ih, m}` (g already translated by margins; iw/ih = inner plot size).
- `FLUtils.theme(mount)`, `FLUtils.modelColor("DiT-XL")`, `FLUtils.PAL`, `FLUtils.MODEL_COLOR`.
- `FLUtils.animateCount(el, to, {dur,dec,suffix,prefix,from})`.
- `FLUtils.showTip / moveTip / hideTip`, `FLUtils.reduced()`.

## Data (window.FL) — shapes you may use
```
FL.baseline = {
  panel: [ {seed:int, fids:[10 floats], mean, min, max}, ... 25 ],
  grand_mean:34.744, sigma_between:0.438, sigma_within:0.137,
  cov_between:1.26, cov_within:0.40, ratio:3.2, ci95:0.1717,
  n_train:25, n_sample:10, envelope_sigma:0.44
}
FL.decomposition = {
  conditions:[ {key, label, between, within, pct_of_all, mean, std, min, q1, median, q3, max, dots:[~25 floats]} ],
  // order: "All sources"(0.438,100%), "Training noise"(0.334,76%), "Initialisation"(0.294,67%), "Data order"(0.218,50%)
  naive_sum:0.495, observed_all:0.438
}
FL.models = ["DiT-S","DiT-B","DiT-L","DiT-XL"]
FL.scaling["DiT-XL"] = {
  display:"SiT-XL", params:"675M", speedup:2.0, cov_2m:1.42,
  steps:[200000 ... 2000000] (19), mean:[19], std:[19], cov:[19],
  emin:[19], emax:[19], emean:[19],            // per-step min/max/mean across seeds (envelope)
  seeds:{ "<seedid>":[[step,fid],...19], ... ~25 seeds }
}
FL.golden = {
  gs_means:[25 sorted asc], gs_grand_mean:7.42, gs_sigma_between:0.05, gs_sigma_within:0.027,
  gs_cov:0.67, unguided_cov:1.26, spearman:0.73, ratio_after:1.87, evals_per_cell:14,
  strip:[{x,xj,fid}],                          // GS per-cell jittered dots
  bump_static:[{x:1|2, rank, seed}],           // 17 seeds that DON'T move >=5 places (2 rows each)
  bump_moved:[{x:1|2, rank, seed}]             // 8 seeds that move >=5 places (2 rows each)
  // x=1 -> Unguided rank, x=2 -> GS-FID rank (rank 1 = best/lowest FID)
}
FL.mup["DiT-B"] = {
  display:"SiT-B",
  gs:       {lr:[10 floats], mean:[10], std:[10], cov:[10], ndiv:[10]},
  unguided: {lr:[10], mean:[10], std:[10], cov:[10], ndiv:[10]}
  // lr from 5e-5 to 5e-4 (log). ndiv>0 marks diverged seeds at that lr.
}
FL.covbands = [ {metric, label, min, p10, median, p90, max, n}, ... ]   // incfid median 1.30
```

## The module you build is described in your task prompt.
Match the chart-title/subtitle already present in the HTML card; do not add your own card chrome
(the `.panel-card` frame, corners, title, and subtitle are already in `index.html`). Just render the
plot into the given mount.
