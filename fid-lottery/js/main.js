/* ===================================================================
   main.js — orchestration: nav, scroll-reveal, chart dispatch on
   first view, model-toggle wiring, debounced resize redraw.
   Chart modules register window.FLCharts.<key>(mount, FL, opts).
   =================================================================== */
(function () {
  "use strict";
  var FL = window.FL, Charts = window.FLCharts || {};
  var PLAY = /[?&]play=1/.test(location.search);

  // ---- charts that mount into a single element ----
  var DISPATCH = [
    { sel: "#chart-panel",  key: "panel" },
    { sel: "#chart-decomp", key: "decomp" },
    { sel: "#chart-race",   key: "race",   toggle: "#race-toggle", def: "DiT-XL" },
    { sel: "#chart-floor",  key: "floor" },
    { sel: "#chart-golden", key: "golden" },
    { sel: "#chart-mup",    key: "mup",    toggle: "#mup-toggle",  def: "DiT-B" },
    { sel: "#chart-metrics", key: "metrics" }
  ];
  var drawn = {};   // sel -> true once rendered

  function callChart(d) {
    var mount = document.querySelector(d.sel);
    if (!mount || !Charts[d.key]) return;
    var model = mount.dataset.model || d.def || (FL.models && FL.models[0]);
    try {
      // opts.play === true  -> render final state instantly (headless / resize)
      Charts[d.key](mount, FL, { play: PLAY, model: model });
    } catch (e) { console.error("chart " + d.key + " failed:", e); }
    drawn[d.sel] = true;
  }

  // ---- build model toggles ----
  function buildToggle(d) {
    if (!d.toggle) return;
    var host = document.querySelector(d.toggle);
    var mount = document.querySelector(d.sel);
    if (!host || !mount) return;
    mount.dataset.model = d.def;
    FL.models.forEach(function (m) {
      var disp = (FL.scaling[m] && FL.scaling[m].display) || m;
      var b = document.createElement("button");
      b.className = "chip-toggle" + (m === d.def ? " active" : "");
      b.type = "button"; b.textContent = disp; b.setAttribute("role", "tab");
      b.addEventListener("click", function () {
        host.querySelectorAll(".chip-toggle").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        mount.dataset.model = m;
        Charts[d.key](mount, FL, { play: false, model: m });
      });
      host.appendChild(b);
    });
  }

  // ---- scroll reveal + first-view chart dispatch ----
  function setupObservers() {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("revealed"); revealIO.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { revealIO.observe(el); });

    var chartIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var d = en.target.__fl;
        chartIO.unobserve(en.target);
        callChart(d);
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -5% 0px" });
    DISPATCH.forEach(function (d) {
      var mount = document.querySelector(d.sel);
      if (mount) { mount.__fl = d; chartIO.observe(mount); }
    });
  }

  // ---- nav show/hide: shown from the intro onward, but HIDDEN over the hero and
  //      while the immersive slot floor fills the screen (it reappears on the acts) ----
  function setupNav() {
    var nav = document.getElementById("nav");
    var intro = document.getElementById("intro");
    var floor = document.getElementById("lottery");
    var onScroll = function () {
      var show = false;
      if (intro) {
        var vh = window.innerHeight;
        var reached = intro.getBoundingClientRect().top < vh * 0.5;   // past the hero, into the intro
        var onFloor = false;
        if (floor) {
          var f = floor.getBoundingClientRect();
          onFloor = f.top < vh * 0.5 && f.bottom > vh * 0.5;          // the slot floor fills the screen
        }
        show = reached && !onFloor;                                   // hide over hero AND over the floor
      }
      nav.classList.toggle("show", show);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ---- copy-to-clipboard for the BibTeX card (works over file:// via fallback) ----
  function setupCopy() {
    function fallback(text, ok) {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.top = "-1000px"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); ok(); } catch (e) {}
      document.body.removeChild(ta);
    }
    document.querySelectorAll(".cite__copy").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = document.querySelector(btn.getAttribute("data-copy-target"));
        if (!target) return;
        var text = target.textContent;
        var flash = function () {
          var prev = btn.textContent;
          btn.textContent = "Copied ✓"; btn.classList.add("is-copied");
          setTimeout(function () { btn.textContent = prev; btn.classList.remove("is-copied"); }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(flash, function () { fallback(text, flash); });
        } else { fallback(text, flash); }
      });
    });
  }

  // ---- debounced resize redraw ----
  function setupResize() {
    var t = null, lastW = window.innerWidth;
    window.addEventListener("resize", function () {
      if (Math.abs(window.innerWidth - lastW) < 30) return; // ignore mobile addr-bar jitter
      lastW = window.innerWidth;
      clearTimeout(t);
      t = setTimeout(function () {
        DISPATCH.forEach(function (d) { if (drawn[d.sel]) callChart(d); });
      }, 220);
    });
  }

  function boot() {
    if (!FL) { console.error("FL data missing"); return; }
    Charts = window.FLCharts || {};
    DISPATCH.forEach(buildToggle);

    // slot machine (hero) — init immediately
    if (Charts.slot) {
      try { Charts.slot(document.querySelector(".slot-stage"), FL, { play: PLAY }); }
      catch (e) { console.error("slot failed:", e); }
    }

    // reveal the hero (fades in the gold rays + casino scene)
    var heroEl = document.querySelector(".hero");
    if (heroEl) requestAnimationFrame(function () { heroEl.classList.add("revealed"); });

    setupNav();
    setupCopy();

    if (PLAY) {
      // headless / debug: reveal & draw everything now
      document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("revealed"); });
      DISPATCH.forEach(callChart);
      setupResize();
      return;
    }

    setupObservers();
    setupResize();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
