/* ===================================================================
   hero.js — the casino props in real 3D (three.js / WebGL).
     • dice  (#dice-3d):    two dice thrown with simple rigid-body
       physics — they tumble, bounce, and settle face-up on the felt,
       then re-throw on a random cadence. Real directional shadows.
     • roulette (#roulette-3d): a 3D bowl seen from above — wood apron,
       brass rim, a spinning numbered wheel head, raised metal cone,
       and a ball orbiting the track the other way.
   Cards + chips stay as CSS (they're flat props). One shared rAF loop
   drives both renderers and pauses while the hero is off-screen.
   =================================================================== */
(function () {
  "use strict";
  var T = window.THREE;
  if (!T) return;

  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // ---- a die face (ivory ground + engraved pips) baked to a texture ----
  var PIPS = {
    1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.27, .27], [.5, .5], [.73, .73]],
    4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]],
    5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]],
    6: [[.27, .26], [.73, .26], [.27, .5], [.73, .5], [.27, .74], [.73, .74]]
  };
  function faceTexture(value) {
    var S = 256, c = document.createElement("canvas"); c.width = c.height = S;
    var g = c.getContext("2d");
    g.fillStyle = "#f5ecd2"; roundRect(g, 4, 4, S - 8, S - 8, S * 0.17); g.fill();
    var vg = g.createRadialGradient(S * 0.4, S * 0.33, S * 0.08, S * 0.5, S * 0.52, S * 0.72);
    vg.addColorStop(0, "rgba(255,255,255,0.55)"); vg.addColorStop(1, "rgba(120,88,38,0.16)");
    g.fillStyle = vg; roundRect(g, 4, 4, S - 8, S - 8, S * 0.17); g.fill();
    var r = S * 0.088, P = PIPS[value];
    for (var i = 0; i < P.length; i++) {
      var x = P[i][0] * S, y = P[i][1] * S;
      var rg = g.createRadialGradient(x - r * 0.32, y - r * 0.32, r * 0.12, x, y, r);
      rg.addColorStop(0, "#5a5a5a"); rg.addColorStop(1, "#0b0b0b");
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    var t = new T.CanvasTexture(c); t.anisotropy = 8; if (T.sRGBEncoding) t.encoding = T.sRGBEncoding; return t;
  }
  function dieMaterials() {
    // BoxGeometry face order: +x,-x,+y,-y,+z,-z  → opposite faces sum to 7
    return [1, 6, 2, 5, 3, 4].map(function (v) {
      return new T.MeshStandardMaterial({ map: faceTexture(v), roughness: 0.52, metalness: 0.02 });
    });
  }

  function makeRenderer(canvas) {
    var r = new T.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    if (T.sRGBEncoding) r.outputEncoding = T.sRGBEncoding;
    if (T.ACESFilmicToneMapping) { r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; }
    return r;
  }
  function sizeTo(canvas, renderer, camera) {
    var w = canvas.clientWidth || 300, h = canvas.clientHeight || 200;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // snap a quaternion to the nearest axis-aligned (face-up) orientation
  function snapQuat(q) {
    var e = new T.Matrix4().makeRotationFromQuaternion(q).elements;
    var cols = [[e[0], e[1], e[2]], [e[4], e[5], e[6]], [e[8], e[9], e[10]]];
    var axes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    function near(v, avoid) {
      var best = axes[0], bd = -2;
      for (var i = 0; i < axes.length; i++) {
        var a = axes[i];
        if (avoid && Math.abs(a[0]) === Math.abs(avoid[0]) && Math.abs(a[1]) === Math.abs(avoid[1]) && Math.abs(a[2]) === Math.abs(avoid[2])) continue;
        var d = v[0] * a[0] + v[1] * a[1] + v[2] * a[2]; if (d > bd) { bd = d; best = a; }
      }
      return best;
    }
    var X = near(cols[0], null), Y = near(cols[1], X);
    var Z = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]];
    var m = new T.Matrix4();
    m.set(X[0], Y[0], Z[0], 0, X[1], Y[1], Z[1], 0, X[2], Y[2], Z[2], 0, 0, 0, 0, 1);
    return new T.Quaternion().setFromRotationMatrix(m);
  }

  // =================================================================
  // DICE
  // =================================================================
  function initDice(canvas) {
    var renderer = makeRenderer(canvas);
    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(30, 2, 0.1, 100);
    camera.position.set(0, 4.9, 5.9); camera.lookAt(0, -0.35, 0);   // pulled back so dice never clip the canvas edges

    scene.add(new T.HemisphereLight(0xfff4e0, 0x14321f, 0.55));
    var key = new T.DirectionalLight(0xfff1d4, 1.05);
    key.position.set(3.2, 6.5, 3.0); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    var sc = key.shadow.camera; sc.left = -5; sc.right = 5; sc.top = 3.5; sc.bottom = -3.5; sc.near = 0.5; sc.far = 22;
    key.shadow.bias = -0.0006; scene.add(key);
    var fill = new T.DirectionalLight(0xbfe8d2, 0.3); fill.position.set(-3, 2, -2); scene.add(fill);

    var floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ opacity: 0.34 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    var S = 0.9, HALF = S / 2;
    var BX = 2.3, BZ = 0.92;                  // table bounds (world units), kept well inside the frustum
    var mats = dieMaterials();
    var geo = new T.BoxGeometry(S, S, S);
    if (geo.groups) {/* per-face materials supported */}

    function makeDie() {
      var m = new T.Mesh(geo, mats); m.castShadow = true; m.receiveShadow = false; scene.add(m);
      return { mesh: m, vel: new T.Vector3(), ang: new T.Vector3(), state: "rest", timer: rnd(0.2, 1.2), sQ: new T.Quaternion(), tQ: new T.Quaternion(), st: 0 };
    }
    var dice = [makeDie(), makeDie()];
    dice[0].mesh.position.set(-1.2, HALF, 0.12);
    dice[1].mesh.position.set(1.2, HALF, -0.12);
    dice.forEach(function (d) { d.mesh.quaternion.copy(snapQuat(new T.Quaternion().setFromEuler(new T.Euler(rnd(0, 6), rnd(0, 6), rnd(0, 6))))); });

    var G = 22, REST = 0.42, FR = 0.86, ANGD = 0.8;
    function throwDie(d) {
      var p = d.mesh.position;
      p.y = HALF + rnd(0.4, 1.1);
      var dir = rnd(0, Math.PI * 2);
      // aim back toward the centre when near an edge so it stays on the table
      var inward = Math.atan2(-p.z, -p.x);
      if (Math.abs(p.x) > BX * 0.6 || Math.abs(p.z) > BZ * 0.6) dir = inward + rnd(-0.8, 0.8);
      var sp = rnd(1.4, 3.0);
      d.vel.set(Math.cos(dir) * sp, rnd(2.0, 2.8), Math.sin(dir) * sp);
      d.ang.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(9, 16));
      d.state = "roll";
    }
    function step(d, dt) {
      var m = d.mesh, p = m.position;
      if (d.state === "rest") { d.timer -= dt; if (d.timer <= 0) throwDie(d); return; }
      if (d.state === "settle") {
        d.st = Math.min(1, d.st + dt / 0.24); var e = 1 - Math.pow(1 - d.st, 3);
        m.quaternion.copy(d.sQ).slerp(d.tQ, e);
        p.y += (HALF - p.y) * Math.min(1, dt * 12);
        if (d.st >= 1) { p.y = HALF; d.state = "rest"; d.timer = rnd(0.8, 2.2); }
        return;
      }
      // rolling: integrate
      d.vel.y -= G * dt;
      p.addScaledVector(d.vel, dt);
      var a = d.ang.length();
      if (a > 1e-5) m.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(d.ang.clone().normalize(), a * dt));
      // floor
      if (p.y < HALF) {
        p.y = HALF;
        if (d.vel.y < 0) d.vel.y = -d.vel.y * REST;
        d.vel.x *= FR; d.vel.z *= FR; d.ang.multiplyScalar(ANGD);
      }
      // walls
      if (p.x < -BX) { p.x = -BX; d.vel.x = Math.abs(d.vel.x) * 0.5; }
      if (p.x > BX) { p.x = BX; d.vel.x = -Math.abs(d.vel.x) * 0.5; }
      if (p.z < -BZ) { p.z = -BZ; d.vel.z = Math.abs(d.vel.z) * 0.5; }
      if (p.z > BZ) { p.z = BZ; d.vel.z = -Math.abs(d.vel.z) * 0.5; }
      // come to rest?
      if (p.y <= HALF + 0.02 && d.vel.length() < 0.35 && d.ang.length() < 0.9) {
        d.sQ.copy(m.quaternion); d.tQ.copy(snapQuat(m.quaternion)); d.st = 0; d.state = "settle";
      }
    }

    function wake(d) {
      if (d.state !== "roll") { d.state = "roll"; d.ang.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(4, 9)); }
    }
    // sphere-approx die↔die collision so they never interpenetrate
    function collide(a, b) {
      var pa = a.mesh.position, pb = b.mesh.position;
      var dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz), min = S * 1.02;
      if (d < 1e-4 || d >= min) return;
      var nx = dx / d, ny = dy / d, nz = dz / d, ov = (min - d) / 2;
      pa.x -= nx * ov; pa.y -= ny * ov; pa.z -= nz * ov;
      pb.x += nx * ov; pb.y += ny * ov; pb.z += nz * ov;
      if (pa.y < HALF) pa.y = HALF; if (pb.y < HALF) pb.y = HALF;
      var rvn = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny + (b.vel.z - a.vel.z) * nz;
      if (rvn < 0) {                                  // approaching → elastic-ish impulse (e≈0.4, equal mass)
        var j = -1.4 * rvn / 2;
        a.vel.x -= j * nx; a.vel.y -= j * ny; a.vel.z -= j * nz;
        b.vel.x += j * nx; b.vel.y += j * ny; b.vel.z += j * nz;
        wake(a); wake(b);
      }
    }

    return {
      update: function (dt) {
        for (var i = 0; i < dice.length; i++) step(dice[i], dt);
        collide(dice[0], dice[1]);
      },
      render: function () { renderer.render(scene, camera); },
      resize: function () { sizeTo(canvas, renderer, camera); },
      sep: function () { return dice[0].mesh.position.distanceTo(dice[1].mesh.position); },
      dieSize: S
    };
  }

  // =================================================================
  // ROULETTE
  // =================================================================
  function rouletteTexture() {
    var S = 1024, c = document.createElement("canvas"); c.width = c.height = S;
    var g = c.getContext("2d"), cx = S / 2, cy = S / 2;
    var R2 = S * 0.49, R1 = S * 0.30;
    g.clearRect(0, 0, S, S);
    var N = 37, step = (Math.PI * 2) / N;
    // pocket 0 = green, the rest alternate red/black (36 = even, no seam clash)
    for (var i = 0; i < N; i++) {
      var a0 = -Math.PI / 2 + i * step, a1 = a0 + step;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R2, a0, a1); g.closePath();
      g.fillStyle = i === 0 ? "#0a7a45" : (i % 2 ? "#15110f" : "#8f1f1a"); g.fill();
    }
    // recess the centre (cone covers it)
    g.beginPath(); g.arc(cx, cy, R1, 0, 7); g.fillStyle = "#0c0c0c"; g.fill();
    // gold frets between pockets + numbers
    for (var k = 0; k < N; k++) {
      var a = -Math.PI / 2 + k * step;
      g.strokeStyle = "rgba(236,209,133,0.92)"; g.lineWidth = S * 0.006;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * R1, cy + Math.sin(a) * R1); g.lineTo(cx + Math.cos(a) * R2, cy + Math.sin(a) * R2); g.stroke();
      var am = a + step / 2, nr = (R1 + R2) / 2;
      g.save(); g.translate(cx + Math.cos(am) * nr, cy + Math.sin(am) * nr); g.rotate(am + Math.PI / 2);
      g.fillStyle = "#f6efdc"; g.font = "bold " + Math.round(S * 0.038) + "px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(k), 0, 0); g.restore();
    }
    // outer gold ring
    g.strokeStyle = "#caa44c"; g.lineWidth = S * 0.012; g.beginPath(); g.arc(cx, cy, R2, 0, 7); g.stroke();
    var t = new T.CanvasTexture(c); t.anisotropy = 8; if (T.sRGBEncoding) t.encoding = T.sRGBEncoding; return t;
  }

  function initRoulette(canvas) {
    var renderer = makeRenderer(canvas);
    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 3.62, 2.98); camera.lookAt(0, -0.12, 0);   // frames the whole bowl incl. the near/bottom rim

    scene.add(new T.HemisphereLight(0xfff4e0, 0x14321f, 0.62));
    var key = new T.DirectionalLight(0xfff0d0, 1.1);
    key.position.set(1.6, 3.4, 1.8); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    var sc = key.shadow.camera; sc.left = sc.bottom = -2; sc.right = sc.top = 2; sc.near = 0.5; sc.far = 12; key.shadow.bias = -0.0006;
    scene.add(key);
    scene.add(new T.DirectionalLight(0x9fd8c0, 0.25).translateX(-2));

    var floor = new T.Mesh(new T.PlaneGeometry(20, 20), new T.ShadowMaterial({ opacity: 0.3 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.09; floor.receiveShadow = true; scene.add(floor);

    var wood = new T.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.7, metalness: 0.15 });
    var gold = new T.MeshStandardMaterial({ color: 0xcaa44c, roughness: 0.3, metalness: 0.95 });
    var darkMetal = new T.MeshStandardMaterial({ color: 0x2a1e10, roughness: 0.5, metalness: 0.6 });

    var bowl = new T.Group(); scene.add(bowl);
    // apron (wood base)
    var apron = new T.Mesh(new T.CylinderGeometry(1.18, 1.24, 0.18, 64), wood);
    apron.position.y = -0.09; apron.castShadow = true; apron.receiveShadow = true; bowl.add(apron);
    // brass rim
    var rim = new T.Mesh(new T.TorusGeometry(1.15, 0.055, 18, 64), gold);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.01; rim.castShadow = true; bowl.add(rim);
    // spinning wheel head (numbered pockets on the top face)
    var topMat = new T.MeshStandardMaterial({ map: rouletteTexture(), roughness: 0.55, metalness: 0.1 });
    var wheel = new T.Mesh(new T.CylinderGeometry(1.0, 1.0, 0.07, 64), [darkMetal, topMat, darkMetal]);
    wheel.position.y = 0.02; wheel.castShadow = true; bowl.add(wheel);
    // raised metal cone + hub knob (spin with the wheel)
    var cone = new T.Mesh(new T.ConeGeometry(0.42, 0.26, 56), gold);
    cone.position.y = 0.17; cone.castShadow = true; wheel.add(cone);
    var hub = new T.Mesh(new T.SphereGeometry(0.07, 24, 16), gold); hub.position.y = 0.31; wheel.add(hub);
    // the ball
    var ballMat = new T.MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.22, metalness: 0.1 });
    var ball = new T.Mesh(new T.SphereGeometry(0.058, 20, 16), ballMat); ball.castShadow = true; bowl.add(ball);

    bowl.rotation.z = -0.05;
    // ---- a full betting round: wheel accelerates, then both wheel + ball decelerate
    //      while the ball rattles in and drops, then both idle slowly so the winning
    //      number is readable for a beat, then it spins up again. ----
    var R_OUT = 0.96, R_IN = 0.70, Y0 = 0.085, W_IDLE = 0.1;
    var wa = 0, wV = W_IDLE;            // wheel angle + angular velocity
    var ba = 0, bv = 0;                 // ball angle + angular velocity
    var phase = "result", timer = 1.4, drop = 0, launchT = 0, wPeak = 2.4;
    return {
      update: function (dt) {
        if (phase === "launch") {
          launchT += dt;
          wV += (wPeak - wV) * Math.min(1, dt * 3);              // wheel spins up
          ba -= bv * dt;
          ball.position.set(Math.cos(ba) * R_OUT, Y0 + 0.05, Math.sin(ba) * R_OUT);
          if (launchT > 0.8) phase = "spin";
        } else if (phase === "spin") {
          wV -= dt * (0.32 * wV + 0.14); if (wV < W_IDLE) wV = W_IDLE;   // wheel coasts down
          bv -= dt * (1.0 + 0.16 * bv);
          ba -= bv * dt;
          var f = clamp((bv - 1) / 9, 0, 1);                    // 1 = fast/outer, 0 = slow/inner
          var rr = R_IN + (R_OUT - R_IN) * f
            + Math.sin(ba * 6.3) * 0.012 * f + (Math.random() - 0.5) * 0.012 * f;   // rattle
          var hop = Math.abs(Math.sin(ba * 5)) * 0.03 * f;      // clatter over the frets
          ball.position.set(Math.cos(ba) * rr, Y0 + 0.05 * f + hop, Math.sin(ba) * rr);
          if (bv <= 1) { phase = "drop"; drop = 0; }
        } else if (phase === "drop") {
          wV -= dt * (0.3 * wV + 0.1); if (wV < W_IDLE) wV = W_IDLE;
          drop += dt; var t = Math.min(1, drop / 0.6);
          ba -= (1 - t) * dt;
          var rd = R_IN + (0.84 - R_IN) * (1 - t);
          var bounce = Math.abs(Math.sin(t * Math.PI * 3)) * 0.14 * (1 - t);   // ~3 decaying bounces
          ball.position.set(Math.cos(ba) * rd, Y0 + bounce, Math.sin(ba) * rd);
          if (t >= 1) { phase = "result"; timer = rnd(2.6, 4.0); }
        } else {                                                // result: slow idle, ball rides its pocket
          wV += (W_IDLE - wV) * Math.min(1, dt * 1.5);
          ba += wV * dt;
          ball.position.set(Math.cos(ba) * R_IN, Y0, Math.sin(ba) * R_IN);
          timer -= dt;
          if (timer <= 0) { phase = "launch"; launchT = 0; bv = rnd(7, 10); wPeak = rnd(2.0, 2.8); }
        }
        wa += wV * dt; wheel.rotation.y = wa;
      },
      render: function () { renderer.render(scene, camera); },
      resize: function () { sizeTo(canvas, renderer, camera); },
      wspeed: function () { return wV; }, phase: function () { return phase; }
    };
  }

  // =================================================================
  // boot + shared loop
  // =================================================================
  function init() {
    var widgets = [];
    var dc = document.getElementById("dice-3d"), rc = document.getElementById("roulette-3d");
    try { if (dc) widgets.push(initDice(dc)); } catch (e) { console.error("dice 3d failed:", e); }
    try { if (rc) widgets.push(initRoulette(rc)); } catch (e) { console.error("roulette 3d failed:", e); }
    if (!widgets.length) return;
    widgets.forEach(function (w) { w.resize(); });
    if (/[?&]dbg/.test(location.search)) window.__hero = widgets;

    var ro = window.ResizeObserver ? new ResizeObserver(function () { widgets.forEach(function (w) { w.resize(); }); }) : null;
    if (ro) { if (dc) ro.observe(dc); if (rc) ro.observe(rc); }
    else window.addEventListener("resize", function () { widgets.forEach(function (w) { w.resize(); }); });

    // pause the loop while the hero is scrolled out of view
    var visible = true, hero = document.querySelector(".hero");
    if (hero && window.IntersectionObserver) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) last = performance.now(); }, { threshold: 0 }).observe(hero);
    }
    var last = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      var dt = Math.min(1 / 30, (now - last) / 1000); last = now;
      if (!visible) return;
      for (var i = 0; i < widgets.length; i++) { widgets[i].update(dt); widgets[i].render(); }
    })(performance.now());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
