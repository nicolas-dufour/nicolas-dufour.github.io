/* GeoGuessr clone — pure client-side game controller.
 * Depends on: config.js, geo.js, recorder.js, leaflet.js
 */
(function () {
  "use strict";

  const C = window.CONFIG;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---- state -------------------------------------------------------------
  const State = {
    manifest: [],
    nickname: "",
    gameId: null,
    rounds: [], // image ids
    current: 0,
    results: [], // per-round result objects
    guessLatLng: null,
    timer: null,
    timeLeft: 0,
    roundStart: 0,
    submitted: false,
  };

  // ---- maps --------------------------------------------------------------
  let guessMap = null;
  let guessMarker = null;
  let resultMap = null;
  let resultLayer = null; // LayerGroup cleared each round
  let methodMarkers = []; // for leaderboard interaction

  const userIcon = L.divIcon({
    className: "pin-wrap",
    html: '<div class="pin pin-user pin-drop" title="Your guess">📍</div>',
    iconSize: [34, 34],
    iconAnchor: [17, 32],
  });
  const gtIcon = L.divIcon({
    className: "pin-wrap",
    html: '<div class="pin pin-gt pin-drop" title="Actual location">🎯</div>',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

  function tileLayer() {
    return L.tileLayer(C.TILE_URL, {
      attribution: C.TILE_ATTRIB,
      maxZoom: 19,
      noWrap: false,
    });
  }

  function ensureGuessMap() {
    if (guessMap) return guessMap;
    guessMap = L.map("guess-map", {
      center: [20, 0],
      zoom: 2,
      worldCopyJump: true,
      minZoom: 1,
    });
    tileLayer().addTo(guessMap);
    guessMap.on("click", (e) => placeGuess(e.latlng));
    // the panel grows on hover / pin; refresh tiles once each resize settles so
    // the newly revealed area is never left blank.
    const panel = document.getElementById("map-panel");
    if (panel) {
      panel.addEventListener("transitionend", (e) => {
        if ((e.propertyName === "width" || e.propertyName === "height") && guessMap) {
          guessMap.invalidateSize();
        }
      });
    }
    return guessMap;
  }

  function ensureResultMap() {
    if (resultMap) return resultMap;
    resultMap = L.map("result-map", {
      center: [20, 0],
      zoom: 2,
      worldCopyJump: true,
      minZoom: 1,
    });
    tileLayer().addTo(resultMap);
    resultLayer = L.layerGroup().addTo(resultMap);
    return resultMap;
  }

  // ---- helpers -----------------------------------------------------------
  // Crossfade between screens: reveal the next one and fade it in while the
  // current one fades out, then hide it. Non-active screens are pointer-events:
  // none, which also prevents double-clicks on a button mid-transition.
  function showScreen(id) {
    const next = document.getElementById(id);
    const current = document.querySelector(".screen.active");
    if (current === next) return;
    next.classList.remove("hidden", "leaving");
    void next.offsetWidth; // reflow so the transition runs from the base state
    next.classList.add("active");
    if (current) {
      current.classList.remove("active");
      current.classList.add("leaving");
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        // only hide if it's still leaving — a fast re-navigation may have
        // re-activated this screen, in which case we must NOT hide it.
        if (current.classList.contains("leaving")) {
          current.classList.add("hidden");
          current.classList.remove("leaving");
        }
      };
      current.addEventListener("transitionend", function te(e) {
        if (e.target === current && e.propertyName === "opacity") {
          current.removeEventListener("transitionend", te);
          finish();
        }
      });
      setTimeout(finish, 650); // fallback if transitionend doesn't fire
    }
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "g-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function fmtDist(km) {
    if (km == null) return "—";
    if (km < 1) return Math.round(km * 1000) + " m";
    if (km < 10) return km.toFixed(1) + " km";
    return Math.round(km).toLocaleString() + " km";
  }

  function fmtScore(s) {
    return Math.round(s).toLocaleString();
  }

  function fmtClock(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function familyColor(source) {
    // stable hue per model family for the method dots
    const fam = (source || "").split("/")[0];
    let h = 0;
    for (let i = 0; i < fam.length; i++) h = (h * 31 + fam.charCodeAt(i)) % 360;
    return "hsl(" + h + ", 70%, 45%)";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function medal(pos) {
    return pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : String(pos);
  }

  // animate a number element from 0 -> value (ease-out cubic)
  function animateNumber(el, to, dur) {
    if (!el) return;
    dur = dur || 800;
    let start = null;
    function step(now) {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(to * eased).toLocaleString();
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = Math.round(to).toLocaleString();
    }
    requestAnimationFrame(step);
  }

  // ---- timer -------------------------------------------------------------
  function startTimer() {
    State.timeLeft = C.ROUND_SECONDS;
    State.roundStart = Date.now();
    updateTimerUI();
    clearInterval(State.timer);
    State.timer = setInterval(() => {
      State.timeLeft -= 1;
      updateTimerUI();
      if (State.timeLeft <= 0) {
        clearInterval(State.timer);
        submitGuess(true);
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(State.timer);
    State.timer = null;
  }

  function updateTimerUI() {
    const el = $("#timer");
    el.textContent = fmtClock(Math.max(0, State.timeLeft));
    el.classList.toggle("warn", State.timeLeft <= 20);
  }

  // ---- game flow ---------------------------------------------------------
  async function loadManifest() {
    const res = await fetch(C.MANIFEST, { cache: "no-store" });
    if (!res.ok) throw new Error("manifest " + res.status);
    const data = await res.json();
    State.manifest = data.images || [];
  }

  function startGame() {
    if (State.manifest.length < C.ROUNDS_PER_GAME) {
      alert("Not enough images to play.");
      return;
    }
    State.nickname = ($("#nickname").value || "").trim();
    State.gameId = uuid();
    State.rounds = shuffle(State.manifest).slice(0, C.ROUNDS_PER_GAME);
    State.current = 0;
    State.results = [];
    Recorder.record("game_start", {
      game_id: State.gameId,
      nickname: State.nickname,
      rounds: State.rounds,
      rounds_count: C.ROUNDS_PER_GAME,
    });
    loadRound(0);
  }

  function loadRound(i) {
    State.current = i;
    State.guessLatLng = null;
    State.submitted = false;
    State.imageReady = false;

    showScreen("screen-round");
    $("#round-num").textContent = i + 1;
    $("#round-total").textContent = C.ROUNDS_PER_GAME;
    $("#score-total").textContent = fmtScore(totalScore());
    $("#guess-btn").disabled = true;
    $("#guess-hint").textContent = "Loading image…";
    // show the full time, frozen, until the clock actually starts
    State.timeLeft = C.ROUND_SECONDS;
    updateTimerUI();

    // map reset
    const map = ensureGuessMap();
    if (guessMarker) {
      map.removeLayer(guessMarker);
      guessMarker = null;
    }
    setMapMode(false);
    map.setView([20, 0], 2);
    setTimeout(() => map.invalidateSize(), 60);
    setTimeout(() => map.invalidateSize(), 500); // after the screen crossfade

    // image — don't start the 2-minute clock (or allow a guess) until the photo
    // is visible, errors, or stalls past a safety timeout.
    const id = State.rounds[i];
    const url = C.DATA_DIR + "/" + C.IMAGES_SUBDIR + "/" + id + ".jpg";
    const img = $("#street-img");
    const spinner = $("#img-spinner");
    img.classList.add("loading");
    img.alt = "Street view";
    spinner.classList.remove("hidden");
    $("#stage-bg").style.backgroundImage = "url('" + url + "')";
    let begun = false;
    const begin = () => {
      if (begun || State.current !== i || State.submitted) return;
      begun = true;
      State.imageReady = true;
      if (!State.guessLatLng) {
        $("#guess-hint").textContent = "Click the map to place your guess";
      }
      startTimer();
    };
    const done = () => {
      img.classList.remove("loading");
      spinner.classList.add("hidden");
      begin();
    };
    img.onload = done;
    img.onerror = done;
    img.src = url;
    // a stalled image must never permanently block the round
    setTimeout(begin, 8000);
    // already-cached image may be complete before onload is wired
    if (img.complete && img.naturalWidth > 0) done();
  }

  function placeGuess(latlng) {
    if (State.submitted || !State.imageReady) return;
    State.guessLatLng = latlng;
    const map = ensureGuessMap();
    if (!guessMarker) {
      guessMarker = L.marker(latlng, { icon: userIcon, draggable: true }).addTo(map);
      guessMarker.on("dragend", () => {
        if (!State.submitted) State.guessLatLng = guessMarker.getLatLng();
      });
    } else {
      guessMarker.setLatLng(latlng);
    }
    $("#guess-btn").disabled = false;
    $("#guess-hint").textContent = "Drag the pin to fine-tune, then Guess";
  }

  async function fetchRecord(id) {
    const url = C.DATA_DIR + "/" + C.CSV_SUBDIR + "/" + id + ".csv";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("csv " + res.status);
    const text = await res.text();
    return GEO.parseRecord(text, id);
  }

  async function submitGuess(timedOut) {
    if (State.submitted) return;
    // a stray/orphaned timer must never drive the UI once we've left the round
    if ($("#screen-round").classList.contains("hidden")) {
      stopTimer();
      return;
    }
    State.submitted = true;
    stopTimer();
    $("#guess-btn").disabled = true;

    const id = State.rounds[State.current];
    const guess = State.guessLatLng;
    const timeTaken = Math.round((Date.now() - State.roundStart) / 1000);

    let record;
    try {
      record = await fetchRecord(id);
    } catch (e) {
      alert("Could not load round data. Skipping.");
      record = null;
    }

    let distanceKm = null;
    let score = 0;
    if (record && guess) {
      distanceKm = GEO.haversineKm(
        guess.lat,
        guess.lng,
        record.ground_truth.lat,
        record.ground_truth.lon
      );
      score = GEO.geoscore(distanceKm);
    }

    const result = {
      image_id: id,
      record: record,
      guess: guess ? { lat: guess.lat, lon: guess.lng } : null,
      distance_km: distanceKm,
      geoscore: score,
      timed_out: !!timedOut,
      no_guess: !guess,
      time_taken_s: timeTaken,
    };
    State.results.push(result);

    Recorder.record("round", {
      game_id: State.gameId,
      nickname: State.nickname,
      round: State.current + 1,
      image_id: id,
      guess_lat: guess ? guess.lat : null,
      guess_lon: guess ? guess.lng : null,
      gt_lat: record ? record.ground_truth.lat : null,
      gt_lon: record ? record.ground_truth.lon : null,
      gt_label: record ? record.ground_truth.label : null,
      distance_km: distanceKm,
      geoscore: score,
      time_taken_s: timeTaken,
      timed_out: !!timedOut,
    });

    showResult(result);
  }

  function totalScore() {
    return State.results.reduce((a, r) => a + (r.geoscore || 0), 0);
  }

  // ---- per-round result --------------------------------------------------
  function showResult(result) {
    showScreen("screen-result");
    const map = ensureResultMap();
    resultLayer.clearLayers();
    methodMarkers = [];
    map.invalidateSize();
    setTimeout(() => map.invalidateSize(), 60);
    setTimeout(() => map.invalidateSize(), 500); // after the screen crossfade

    const rec = result.record;
    const bounds = [];

    if (!rec) {
      $("#result-summary").innerHTML = "<p>Round data unavailable.</p>";
      $("#leaderboard-body").innerHTML = "";
      updateResultNav();
      return;
    }

    const gt = rec.ground_truth;
    L.marker([gt.lat, gt.lon], { icon: gtIcon, zIndexOffset: 1000 })
      .bindPopup("<b>Actual location</b><br>" + esc(gt.label || ""))
      .addTo(resultLayer);
    bounds.push([gt.lat, gt.lon]);

    // method dots
    rec.valid_methods.forEach((m) => {
      const isBest = m.rank === 1;
      const cm = L.circleMarker([m.lat, m.lon], {
        radius: isBest ? 7 : 5,
        color: isBest ? "#f59e0b" : "#222",
        weight: isBest ? 2 : 1,
        fillColor: familyColor(m.source),
        fillOpacity: 0.85,
      })
        .bindTooltip(
          esc(m.name) + " • " + fmtDist(m.distance_km) + " • " + fmtScore(m.geoscore) + " pts",
          { direction: "top" }
        )
        .bindPopup(methodPopup(m))
        .addTo(resultLayer);
      methodMarkers[m.rank] = cm;
      bounds.push([m.lat, m.lon]);
    });

    // user guess + line
    if (result.guess) {
      const u = result.guess;
      L.marker([u.lat, u.lon], { icon: userIcon, zIndexOffset: 2000 })
        .bindPopup("<b>Your guess</b><br>" + fmtScore(result.geoscore) + " pts")
        .addTo(resultLayer);
      bounds.push([u.lat, u.lon]);
      L.polyline(
        [
          [u.lat, u.lon],
          [gt.lat, gt.lon],
        ],
        { color: "#ef4444", weight: 2, dashArray: "6 6" }
      )
        .bindTooltip(fmtDist(result.distance_km) + " away", {
          permanent: true,
          direction: "center",
          className: "dist-label",
        })
        .addTo(resultLayer);
    }

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }

    renderSummary(result);
    renderLeaderboard(result);
    updateResultNav();
  }

  function methodPopup(m) {
    let html =
      "<b>" + esc(m.name) + "</b><br>" +
      fmtDist(m.distance_km) + " • " + fmtScore(m.geoscore) + " pts";
    if (m.country) html += "<br>guessed country: " + esc(m.country);
    if (m.reasoning) {
      html += '<div class="reasoning">' + esc(m.reasoning) + "</div>";
    }
    return html;
  }

  function renderSummary(result) {
    const rec = result.record;
    const valid = rec.valid_methods;
    const total = valid.length;
    let beat = 0;
    let rank = 1;
    if (result.guess) {
      beat = valid.filter((m) => m.geoscore < result.geoscore).length;
      // tie semantics match the leaderboard (tied methods sort above the user)
      rank = valid.filter((m) => m.geoscore >= result.geoscore).length + 1;
    } else {
      rank = total + 1;
    }

    const scoreHTML = result.no_guess
      ? '<div class="score-line"><span class="big-score zero">0</span><span class="score-max">pts / 5000</span></div>'
      : '<div class="score-line"><span class="big-score" id="bigscore">0</span><span class="score-max">pts / 5000</span></div>';

    const subline = result.no_guess
      ? (result.timed_out ? "⏱ Time ran out before you placed a pin." : "You didn't place a pin.")
      : "You were <b>" + fmtDist(result.distance_km) + "</b> from the actual location.";

    const rankLine = result.guess
      ? "You beat <b>" + beat + "</b> of <b>" + total + "</b> AI methods — rank <b>#" + rank + "</b> of " + (total + 1) + "."
      : "All " + total + " AI methods scored higher this round.";

    $("#result-summary").innerHTML =
      scoreHTML +
      "<p>" + subline + "</p>" +
      "<p>" + rankLine + "</p>" +
      '<p class="gt-label">📍 Actual: ' + esc(rec.ground_truth.label || "unknown") + "</p>" +
      (result.timed_out && result.guess ? '<p class="muted">Submitted at time-out.</p>' : "");

    if (!result.no_guess) animateNumber($("#bigscore"), result.geoscore, 850);
  }

  function renderLeaderboard(result) {
    const rec = result.record;
    const rows = rec.valid_methods.map((m) => ({
      name: m.name,
      distance: m.distance_km,
      score: m.geoscore,
      rank: m.rank,
      isUser: false,
    }));
    if (result.guess) {
      rows.push({
        name: "🧑 You" + (State.nickname ? " (" + State.nickname + ")" : ""),
        distance: result.distance_km,
        score: result.geoscore,
        rank: null,
        isUser: true,
      });
    }
    rows.sort((a, b) => b.score - a.score);

    const body = $("#leaderboard-body");
    body.innerHTML = "";
    rows.forEach((row, idx) => {
      const tr = document.createElement("tr");
      if (row.isUser) tr.className = "user-row";
      tr.innerHTML =
        "<td>" + medal(idx + 1) + "</td>" +
        "<td>" + esc(row.name) + "</td>" +
        "<td>" + fmtDist(row.distance) + "</td>" +
        "<td>" + fmtScore(row.score) + "</td>";
      if (!row.isUser && row.rank && methodMarkers[row.rank]) {
        tr.classList.add("clickable");
        tr.addEventListener("click", () => {
          const mk = methodMarkers[row.rank];
          resultMap.panTo(mk.getLatLng());
          mk.openPopup();
        });
      }
      body.appendChild(tr);
    });
  }

  function updateResultNav() {
    const last = State.current >= C.ROUNDS_PER_GAME - 1;
    const btn = $("#next-btn");
    btn.textContent = last ? "See final results →" : "Next round →";
  }

  function nextRound() {
    if (State.current >= C.ROUNDS_PER_GAME - 1) {
      showFinal();
    } else {
      loadRound(State.current + 1);
    }
  }

  // ---- final results -----------------------------------------------------
  function showFinal() {
    showScreen("screen-final");

    const userTotal = totalScore();
    const maxTotal = C.ROUNDS_PER_GAME * 5000;
    animateNumber($("#final-total"), userTotal, 1100);
    $("#final-max").textContent = fmtScore(maxTotal);

    // per-round breakdown
    const breakdown = $("#final-breakdown");
    breakdown.innerHTML = "";
    State.results.forEach((r, i) => {
      const div = document.createElement("div");
      div.className = "round-chip";
      div.innerHTML =
        "<span class='rc-round'>R" + (i + 1) + "</span>" +
        "<span class='rc-score'>" + fmtScore(r.geoscore) + "</span>" +
        "<span class='rc-dist'>" + (r.no_guess ? "no guess" : fmtDist(r.distance_km)) + "</span>";
      breakdown.appendChild(div);
    });

    // overall leaderboard: each method's total geoscore over the same images
    const totals = {}; // name -> {name, total, present}
    State.results.forEach((r) => {
      if (!r.record) return;
      r.record.valid_methods.forEach((m) => {
        if (!totals[m.name]) totals[m.name] = { name: m.name, total: 0, present: 0 };
        totals[m.name].total += m.geoscore;
        totals[m.name].present += 1;
      });
    });
    const board = Object.values(totals);
    board.push({
      name: "🧑 You" + (State.nickname ? " (" + State.nickname + ")" : ""),
      total: userTotal,
      present: State.results.filter((r) => r.guess).length,
      isUser: true,
    });
    board.sort((a, b) => b.total - a.total);
    const userRank = board.findIndex((b) => b.isUser) + 1;

    $("#final-rank").innerHTML =
      "You ranked <b>#" + userRank + "</b> of <b>" + board.length + "</b> (you + " +
      (board.length - 1) + " AI methods).";

    const body = $("#final-board-body");
    body.innerHTML = "";
    board.forEach((row, idx) => {
      const tr = document.createElement("tr");
      if (row.isUser) tr.className = "user-row";
      tr.innerHTML =
        "<td>" + medal(idx + 1) + "</td>" +
        "<td>" + esc(row.name) + "</td>" +
        "<td>" + fmtScore(row.total) + "</td>" +
        "<td>" + row.present + "/" + C.ROUNDS_PER_GAME + "</td>";
      body.appendChild(tr);
    });

    Recorder.record("game_end", {
      game_id: State.gameId,
      nickname: State.nickname,
      total_score: userTotal,
      max_score: maxTotal,
      rank: userRank,
      field_size: board.length,
      rounds: State.results.map((r) => ({
        image_id: r.image_id,
        geoscore: r.geoscore,
        distance_km: r.distance_km,
        no_guess: r.no_guess,
        time_taken_s: r.time_taken_s,
      })),
    });
  }

  // ---- map expand --------------------------------------------------------
  // Photo-focus mode (default): big photo, small map corner that hover-expands.
  // Map-focus mode: fullscreen map (pinned), photo shrinks to a corner thumbnail
  // that hover-expands for a peek — hovering it never collapses the map.
  // Tile refresh on resize is handled by the transitionend listener in
  // ensureGuessMap().
  function setMapMode(on) {
    $("#screen-round").classList.toggle("map-mode", on);
    const btn = $("#expand-btn");
    btn.classList.toggle("on", on);
    btn.textContent = on ? "🖼" : "⛶";
    btn.title = on ? "Photo fullscreen" : "Map fullscreen";
    if (guessMap) guessMap.invalidateSize();
  }

  function toggleMapMode() {
    setMapMode(!$("#screen-round").classList.contains("map-mode"));
  }

  // ---- wire up -----------------------------------------------------------
  function wire() {
    $("#play-btn").addEventListener("click", startGame);
    $("#guess-btn").addEventListener("click", () => submitGuess(false));
    $("#expand-btn").addEventListener("click", toggleMapMode);
    $("#next-btn").addEventListener("click", nextRound);
    $("#play-again-btn").addEventListener("click", startGame);
    $("#quit-btn").addEventListener("click", () => {
      stopTimer();
      State.submitted = true; // neutralize any in-flight timer callback
      showScreen("screen-start");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && $("#screen-round").classList.contains("hidden") === false) {
        if (!$("#guess-btn").disabled) submitGuess(false);
      }
    });
  }

  async function init() {
    wire();
    const playBtn = $("#play-btn");
    playBtn.classList.add("loading-btn");
    try {
      await loadManifest();
      playBtn.classList.remove("loading-btn");
      playBtn.disabled = false;
      $("#start-status").textContent =
        State.manifest.length + " locations ready. Good luck!";
    } catch (e) {
      playBtn.classList.remove("loading-btn");
      $("#start-status").textContent =
        "Failed to load locations (" + e.message + "). Run build_data.py and serve over http.";
      playBtn.disabled = true;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
