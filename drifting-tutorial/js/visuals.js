/* Original, code-native visuals for the Drifting Models tutorial. */
(() => {
  const C = {
    ink: '#11151b', muted: '#6c7582', grid: 'rgba(17,21,27,.07)',
    orange: '#df642f', orangeSoft: 'rgba(223,100,47,.18)',
    blue: '#2f6fe0', blueSoft: 'rgba(47,111,224,.17)',
    violet: '#6a48d7', green: '#168a52', red: '#d52e57', paper: '#f1f4f7', white: '#ffffff',
  };

  const state = {
    currentSlide: null,
    enteredAt: performance.now(),
    forceStep: 0,
    pfStep: 0,
    eqStep: 0,
    featureStep: 0,
    bandwidthStep: 0,
    scoreStep: 0,
    spectralStep: 0,
    spectrumStep: 0,
    annealStep: 0,
    wassersteinStep: 0,
    collapseStep: 0,
    spotlightStep: 0,
    gaussianProofStep: 0,
    gaussianIntroStep: 0,
    gaussianBlurStep: 0,
    singleScoreStep: 0,
    scoreSubtractionStep: 0,
    driftTeachingStep: 0,
    ratioProofStep: 0,
    injectivityStep: 0,
    antisymmetryRecipeStep: 0,
    recipeEnergyStep: 0,
    sinkhornForceStep: 0,
    fragmentAt: performance.now(),
    data: null,
    raf: 0,
    staticReady: false,
    titleParticles: null,
    thetaParticles: null,
    forcePoints: null,
    kernelPoints: null,
    featurePhotos: null,
    nfeAnimatedFor: null,
  };

  function mulberry32(a) {
    return function random() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function gaussian(rand) {
    const u = Math.max(rand(), 1e-7);
    const v = Math.max(rand(), 1e-7);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function sizeCanvas(canvas) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height, dpr };
  }

  function clear(ctx, w, h, color = null) {
    ctx.clearRect(0, 0, w, h);
    if (color) { ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); }
  }

  function drawGrid(ctx, w, h, step = 58) {
    ctx.save();
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    for (let x = step; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = step; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.restore();
  }

  function circle(ctx, x, y, r, fill, alpha = 1, stroke = null, line = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); }
    ctx.restore();
  }

  function arrow(ctx, x1, y1, x2, y2, color, width = 6, alpha = 1, label = '') {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = 16 + width;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - .42), y2 - head * Math.sin(angle - .42));
    ctx.lineTo(x2 - head * Math.cos(angle + .42), y2 - head * Math.sin(angle + .42));
    ctx.closePath(); ctx.fill();
    if (label) {
      ctx.font = '600 17px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, (x1 + x2) / 2, (y1 + y2) / 2 - 18);
    }
    ctx.restore();
  }

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val);
    return el;
  }

  function addSvgCircle(svg, x, y, r, color, opacity = 1) {
    svg.appendChild(svgEl('circle', { cx: x, cy: y, r, fill: color, opacity }));
  }

  function drawStaticClouds() {
    document.querySelectorAll('svg[data-cloud]').forEach((svg) => {
      if (svg.dataset.ready) return;
      svg.dataset.ready = '1';
      const kind = svg.dataset.cloud;
      const vb = svg.viewBox.baseVal;
      const w = vb.width || 420, h = vb.height || 420;
      const rand = mulberry32([...kind].reduce((a, c) => a + c.charCodeAt(0), 17));
      const n = kind.includes('large') || kind === 'merged' ? 150 : 92;

      if (kind === 'generated') {
        for (const [cx, cy] of [[128, 190], [292, 230]]) {
          svg.appendChild(svgEl('ellipse', { cx, cy, rx: 68, ry: 112, fill: C.orangeSoft, opacity: .38 }));
          svg.appendChild(svgEl('ellipse', { cx, cy, rx: 48, ry: 86, fill: 'none', stroke: C.orange, 'stroke-width': 2.2, opacity: .22 }));
          svg.appendChild(svgEl('ellipse', { cx, cy, rx: 76, ry: 124, fill: 'none', stroke: C.orange, 'stroke-width': 1.4, opacity: .12 }));
        }
      }

      for (let i = 0; i < n; i++) {
        let x, y, color, opacity = .68, r = kind.includes('large') || kind === 'merged' ? 6.5 : 8;
        if (kind === 'noise') {
          const ang = rand() * Math.PI * 2;
          const rad = Math.min(150, Math.abs(gaussian(rand)) * 62 + rand() * 18);
          x = w / 2 + Math.cos(ang) * rad; y = h / 2 + Math.sin(ang) * rad;
          color = C.ink; opacity = .55;
        } else if (kind === 'generated') {
          const mode = i % 2 ? -1 : 1;
          x = w * (.5 + mode * .195) + gaussian(rand) * w * .052;
          y = h * (.5 - mode * .048) + gaussian(rand) * h * .13;
          color = C.orange; opacity = .76;
        } else if (kind === 'q-large') {
          const mode = rand() < .72 ? -1 : 1;
          x = w * (.5 + mode * .16) + gaussian(rand) * w * .085;
          y = h * .53 + gaussian(rand) * h * .17 + mode * 22;
          color = C.orange;
        } else if (kind === 'p-large') {
          const mode = rand() < .5 ? -1 : 1;
          x = w * (.5 + mode * .25) + gaussian(rand) * w * .055;
          y = h * (.5 + mode * .045) + gaussian(rand) * h * .14;
          color = C.blue;
        } else if (kind === 'merged') {
          const mode = rand() < .5 ? -1 : 1;
          x = w * (.5 + mode * .235) + gaussian(rand) * w * .05;
          y = h * (.5 + mode * .04) + gaussian(rand) * h * .14;
          color = i % 2 ? C.orange : C.blue; opacity = .5;
        }
        addSvgCircle(svg, x, y, r, color, opacity);
      }
    });
  }

  function initTitleParticles() {
    const rand = mulberry32(260204770);
    const particles = [];
    for (let i = 0; i < 120; i++) {
      const mode = rand() < .5 ? -1 : 1;
      const sourceAngle = rand() * Math.PI * 2;
      const sourceRadius = Math.pow(rand(), .78);
      const targetAngle = rand() * Math.PI * 2;
      const targetRadius = Math.pow(rand(), .72);
      particles.push({
        // Both endpoints are sampled inside the visible source/target supports.
        sx: .5 + Math.cos(sourceAngle) * .105 * sourceRadius,
        sy: .76 + Math.sin(sourceAngle) * .09 * sourceRadius,
        tx: .5 + mode * .235 + Math.cos(targetAngle) * .09 * targetRadius,
        ty: .43 + Math.sin(targetAngle) * .078 * targetRadius,
        phase: rand() * Math.PI * 2,
        r: 2.8 + rand() * 3.8,
      });
    }
    state.titleParticles = particles;
  }

  function drawParticleHero(canvas, now, ending = false) {
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s;
    clear(ctx, w, h);
    const raw = ending ? 1 : ((now - state.enteredAt) % 8200) / 8200;
    const hold = raw < .08 ? 0 : raw > .78 ? 1 : ease((raw - .08) / .70);
    const minSide = Math.min(w, h);

    // A compact source distribution: every trajectory begins inside it.
    const sourceAlpha = ending ? 0 : clamp(1 - hold * 1.22, 0, 1);
    circle(ctx, w * .5, h * .76, minSide * .125, C.orangeSoft, .34 * sourceAlpha, C.orange, 2.4);
    circle(ctx, w * .5, h * .76, minSide * .17, null, .12 * sourceAlpha, C.orange, 2);

    // Two target modes: every endpoint is bounded by the inner blue support.
    for (const mode of [-1, 1]) {
      const cx = w * (.5 + mode * .235), cy = h * .43;
      circle(ctx, cx, cy, minSide * .12, C.blueSoft, .16 + hold * .08, C.blue, 2);
      circle(ctx, cx, cy, minSide * .18, null, .1 + hold * .04, C.blue, 2);
    }
    state.titleParticles.forEach((p, i) => {
      const swirl = Math.sin(hold * Math.PI) * (1 - hold);
      const x = lerp(p.sx * w, p.tx * w, hold) + Math.cos(p.phase + hold * 8) * 30 * swirl;
      const y = lerp(p.sy * h, p.ty * h, hold) + Math.sin(p.phase + hold * 7) * 24 * swirl;
      circle(ctx, x, y, p.r, ending && i % 2 ? C.blue : C.orange, ending ? .5 : .72);
    });
  }

  function drawDriftTeaching(now) {
    const canvas = document.getElementById('drift-teaching-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 58);
    const step = state.driftTeachingStep;
    const transition = ease(clamp((now - state.fragmentAt) / 850, 0, 1));
    const pulse = .5 + .5 * Math.sin(now / 420);

    // Generator block and fixed noise probes.
    const gx = w * .12, gy = h * .24, gw = w * .18, gh = h * .52;
    const learned = step >= 2;
    ctx.save();
    ctx.shadowColor = learned ? 'rgba(22,138,82,.25)' : 'rgba(17,21,27,.16)'; ctx.shadowBlur = 24;
    ctx.fillStyle = learned ? 'rgba(22,138,82,.96)' : 'rgba(17,21,27,.94)';
    ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, 28); ctx.fill(); ctx.restore();
    const layers = [gx + gw * .24, gx + gw * .50, gx + gw * .76];
    const ys = [gy + gh * .25, gy + gh * .50, gy + gh * .75];
    ctx.strokeStyle = 'rgba(255,255,255,.24)'; ctx.lineWidth = 2;
    for (let l = 0; l < 2; l++) for (const y1 of ys) for (const y2 of ys) {
      ctx.beginPath(); ctx.moveTo(layers[l], y1); ctx.lineTo(layers[l + 1], y2); ctx.stroke();
    }
    layers.forEach((x) => ys.forEach((y) => circle(ctx, x, y, 7.5, '#fff', .92)));
    ctx.fillStyle = '#fff'; ctx.font = '800 21px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(learned ? 'fθᵢ₊₁' : 'fθᵢ', gx + gw / 2, gy + gh - 18);

    const seedYs = [gy + 35, gy + gh * .35, gy + gh * .64, gy + gh - 35];
    seedYs.forEach((y, i) => {
      circle(ctx, w * .055, y, 9, C.ink, .85, '#fff', 2);
      ctx.strokeStyle = C.muted; ctx.globalAlpha = .28; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w * .065, y); ctx.lineTo(gx - 8, gy + gh * (.18 + i * .21)); ctx.stroke(); ctx.globalAlpha = 1;
    });
    ctx.fillStyle = C.muted; ctx.font = '750 16px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('same ε', w * .055, gy - 18);

    // Target law on the right and current generator outputs in the middle.
    const rand = mulberry32(30303);
    const current = [], target = [];
    for (let i = 0; i < 14; i++) {
      current.push([.43 + gaussian(rand) * .035, .52 + gaussian(rand) * .16]);
      const mode = i % 2 ? -1 : 1;
      target.push([.79 + mode * .075 + gaussian(rand) * .025, .50 + mode * .14 + gaussian(rand) * .075]);
    }
    const modeCenters = [[.715,.64],[.865,.36]];
    modeCenters.forEach(([x, y]) => {
      circle(ctx, x * w, y * h, Math.min(w, h) * .17, C.blueSoft, .38, C.blue, 2.4);
      circle(ctx, x * w, y * h, Math.min(w, h) * (.20 + pulse * .008), null, .14, C.blue, 2);
    });
    target.forEach(([x, y]) => circle(ctx, x * w, y * h, 5.2, C.blue, .4));

    const moveFraction = .37;
    const positions = current.map(([cx, cy], i) => {
      const desired = [lerp(cx, target[i][0], moveFraction), lerp(cy, target[i][1], moveFraction)];
      if (step < 2) return [cx, cy, desired];
      const t = step === 2 ? transition : 1;
      return [lerp(cx, desired[0], t), lerp(cy, desired[1], t), desired];
    });

    if (step >= 1) {
      current.forEach(([cx, cy], i) => {
        const desired = positions[i][2];
        const reveal = step === 1 ? transition : 1;
        const ex = lerp(cx, desired[0], reveal), ey = lerp(cy, desired[1], reveal);
        arrow(ctx, cx * w, cy * h, ex * w, ey * h, C.violet, 3.2, step >= 2 ? .18 : .72);
        circle(ctx, desired[0] * w, desired[1] * h, 8.5, '#fff', .96, C.violet, 3);
      });
    }
    if (step >= 2) current.forEach(([x, y]) => circle(ctx, x * w, y * h, 7, C.orange, .13));
    positions.forEach(([x, y]) => circle(ctx, x * w, y * h, 8.2, learned ? C.green : C.orange, .9, '#fff', 2.2));

    // Visual connection from the learned generator to its output cloud.
    const cloudX = positions.reduce((sum, p) => sum + p[0], 0) / positions.length * w;
    arrow(ctx, gx + gw + 15, gy + gh / 2, cloudX - 34, h * .52, learned ? C.green : C.orange, 5, .55);
    ctx.fillStyle = learned ? C.green : C.orange; ctx.font = '800 18px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(learned ? 'new output  qθᵢ₊₁' : 'current output  qθᵢ', cloudX, h * .16);
    ctx.fillStyle = C.blue; ctx.fillText('data  p', w * .79, h * .12);
    if (step >= 1) { ctx.fillStyle = C.violet; ctx.fillText('better targets  xᵢ★', w * .57, h * .87); }

    const messages = ['sample the current generator','the drift proposes better outputs','SGD makes the generator produce them','repeat—the move stays in θ'];
    const readout = document.querySelector('.drift-stage-readout span');
    if (readout) readout.textContent = messages[Math.min(step, 3)];
    const liveDot = document.querySelector('.drift-stage-readout i');
    if (liveDot) liveDot.style.background = step === 1 ? C.violet : step >= 2 ? C.green : C.orange;
  }

  function initThetaParticles() {
    const rand = mulberry32(7171);
    state.thetaParticles = Array.from({ length: 116 }, (_, i) => {
      const mode = i % 2 ? -1 : 1;
      return {
        sx: .14 + gaussian(rand) * .035,
        sy: .57 + gaussian(rand) * .13,
        tx: .72 + mode * .14 + gaussian(rand) * .035,
        ty: .51 + mode * .04 + gaussian(rand) * .14,
        phase: rand() * Math.PI * 2,
      };
    });
  }

  function drawTheta(now) {
    const canvas = document.getElementById('theta-cloud');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h); drawGrid(ctx, w, h, 64);
    const raw = ((now - state.enteredAt) % 10200) / 10200;
    const p = raw < .08 ? 0 : raw > .84 ? 1 : ease((raw - .08) / .76);
    // target distribution
    const rand = mulberry32(111);
    for (let i = 0; i < 130; i++) {
      const mode = i % 2 ? -1 : 1;
      circle(ctx, w * (.72 + mode * .14 + gaussian(rand) * .035), h * (.51 + mode * .04 + gaussian(rand) * .14), 4.2, C.blue, .22);
    }
    state.thetaParticles.forEach((pt) => {
      const x = lerp(pt.sx, pt.tx, p) * w + Math.sin(pt.phase + p * 9) * 24 * Math.sin(p * Math.PI);
      const y = lerp(pt.sy, pt.ty, p) * h + Math.cos(pt.phase + p * 8) * 18 * Math.sin(p * Math.PI);
      circle(ctx, x, y, 5.1, C.orange, .7);
    });
    const tick = document.querySelector('.theta-timeline i');
    if (tick) tick.style.left = `${p * 100}%`;
  }

  function initForcePoints() {
    const rand = mulberry32(9090);
    const pos = [], neg = [];
    for (let i = 0; i < 56; i++) {
      const mode = i % 2 ? -1 : 1;
      pos.push([.55 + mode * .2 + gaussian(rand) * .045, .48 + mode * .06 + gaussian(rand) * .12]);
    }
    for (let i = 0; i < 42; i++) neg.push([.34 + gaussian(rand) * .095, .58 + gaussian(rand) * .14]);
    state.forcePoints = { pos, neg, probe: [.42, .48] };
  }

  function weightedMean(points, probe, tau) {
    let wx = 0, wy = 0, sum = 0;
    points.forEach(([x, y]) => {
      const d = Math.hypot(x - probe[0], y - probe[1]);
      const w = Math.exp(-d / tau);
      wx += x * w; wy += y * w; sum += w;
    });
    return [wx / sum, wy / sum];
  }

  function drawForce(now) {
    const canvas = document.getElementById('force-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 64);
    const fp = state.forcePoints;
    const probe = fp.probe;
    const attr = weightedMean(fp.pos, probe, .19);
    const negMean = weightedMean(fp.neg, probe, .19);
    const pulse = .75 + .25 * Math.sin(now / 450);
    const forceLabel = (label, x, y, color, alpha = 1, align = 'center') => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '700 19px "JetBrains Mono", monospace';
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      const metrics = ctx.measureText(label);
      const padX = 13;
      const boxX = align === 'left' ? x - padX : align === 'right' ? x - metrics.width - padX : x - metrics.width / 2 - padX;
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.beginPath();
      ctx.roundRect(boxX, y - 17, metrics.width + padX * 2, 34, 10);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillText(label, x, y);
      ctx.restore();
    };

    fp.pos.forEach(([x, y]) => circle(ctx, x * w, y * h, 6.4, C.blue, .5));
    fp.neg.forEach(([x, y]) => circle(ctx, x * w, y * h, 6.4, C.orange, .52));
    circle(ctx, probe[0] * w, probe[1] * h, 14, C.ink, 1, C.white, 4);

    if (state.forceStep >= 1) {
      fp.pos.forEach(([x, y]) => {
        const d = Math.hypot(x - probe[0], y - probe[1]);
        const a = .03 + .14 * Math.exp(-d / .18) * pulse;
        ctx.strokeStyle = C.blue; ctx.globalAlpha = a; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(probe[0] * w, probe[1] * h); ctx.lineTo(x * w, y * h); ctx.stroke();
      }); ctx.globalAlpha = 1;
      const attrAlpha = state.forceStep >= 4 ? 0 : state.forceStep >= 2 ? .5 : 1;
      arrow(ctx, probe[0] * w, probe[1] * h, attr[0] * w, attr[1] * h, C.blue, 7, attrAlpha);
      if (state.forceStep < 4) {
        forceLabel('V⁺p · toward data', probe[0] * w + 42, probe[1] * h - 82, C.blue, attrAlpha, 'left');
      }
    }
    if (state.forceStep >= 2) {
      fp.neg.forEach(([x, y]) => {
        const d = Math.hypot(x - probe[0], y - probe[1]);
        const a = .03 + .13 * Math.exp(-d / .17) * pulse;
        ctx.strokeStyle = C.orange; ctx.globalAlpha = a; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(probe[0] * w, probe[1] * h); ctx.lineTo(x * w, y * h); ctx.stroke();
      }); ctx.globalAlpha = 1;
      ctx.save();
      ctx.setLineDash([11, 10]);
      arrow(ctx, probe[0] * w, probe[1] * h, negMean[0] * w, negMean[1] * h, C.orange, 6, state.forceStep >= 4 ? 0 : state.forceStep >= 3 ? .26 : .95);
      ctx.restore();
      if (state.forceStep === 2) {
        forceLabel('V⁻q · toward generated', probe[0] * w - 48, probe[1] * h + 76, C.orange, .95, 'right');
      }
    }
    if (state.forceStep >= 3) {
      const rx = probe[0] - (negMean[0] - probe[0]);
      const ry = probe[1] - (negMean[1] - probe[1]);
      arrow(ctx, probe[0] * w, probe[1] * h, rx * w, ry * h, C.orange, 8, state.forceStep >= 4 ? 0 : 1);
      if (state.forceStep === 3) {
        forceLabel('−V⁻q · opposite direction', probe[0] * w + 76, probe[1] * h + 82, C.orange, 1, 'left');
        ctx.save();
        ctx.strokeStyle = C.orange; ctx.lineWidth = 3; ctx.globalAlpha = .75;
        ctx.beginPath(); ctx.arc(probe[0] * w, probe[1] * h, 43, -.85, 2.2); ctx.stroke();
        ctx.fillStyle = C.orange; ctx.font = '700 18px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
        ctx.fillText('× −1', probe[0] * w + 5, probe[1] * h + 65);
        ctx.restore();
      }
    }
    if (state.forceStep >= 4) {
      const nx = attr[0] - negMean[0] + probe[0];
      const ny = attr[1] - negMean[1] + probe[1];
      arrow(ctx, probe[0] * w, probe[1] * h, nx * w, ny * h, C.violet, 10, .95, 'net drift V');
      circle(ctx, nx * w, ny * h, 18 + pulse * 5, null, .6, C.violet, 3);
    }
  }

  function initKernelPoints() {
    const rand = mulberry32(1010);
    state.kernelPoints = Array.from({ length: 44 }, () => [.5 + gaussian(rand) * .22, .5 + gaussian(rand) * .25]);
  }

  function initFeaturePhotos() {
    state.featurePhotos = [
      'assets/images/robin.jpg',
      'assets/images/robin-2.jpg',
      'assets/images/sparrow.jpg',
      'assets/images/blue-jay.jpg',
      'assets/images/cat.png',
      'assets/images/flower.jpg',
    ].map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });
  }

  function drawKernel(now) {
    const canvas = document.getElementById('kernel-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 64);
    const t = (Math.sin((now - state.enteredAt) / 1800) + 1) / 2;
    const tau = lerp(.34, 1.55, t);
    const probe = [.48, .5];
    const maxD = Math.hypot(.5, .5);
    state.kernelPoints.forEach(([x, y]) => {
      const d = Math.hypot(x - probe[0], y - probe[1]);
      const wt = Math.exp(-d * 3.2 / tau);
      circle(ctx, x * w, y * h, 4 + wt * 11, C.blue, .12 + wt * .78);
      if (wt > .55) {
        ctx.strokeStyle = C.blue; ctx.globalAlpha = wt * .12; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(probe[0] * w, probe[1] * h); ctx.lineTo(x * w, y * h); ctx.stroke(); ctx.globalAlpha = 1;
      }
    });
    for (let i = 1; i <= 3; i++) circle(ctx, probe[0] * w, probe[1] * h, tau * i * 38, null, .16 / i, C.blue, 2);
    circle(ctx, probe[0] * w, probe[1] * h, 15, C.ink, 1, C.white, 4);
    const readout = document.querySelector('.tau-readout b'); if (readout) readout.textContent = tau.toFixed(2);
    document.querySelectorAll('.weight-meter i').forEach((bar, i) => {
      const d = (i + 1) / 5 * maxD;
      const wt = Math.exp(-d * 3.2 / tau);
      bar.style.height = `${10 + wt * 88}%`;
    });
  }

  function drawMultibandwidth(now) {
    const canvas = document.getElementById('multibandwidth-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 60);
    const panelW = w / 3;
    const pulse = .5 + .5 * Math.sin(now / 520);
    const rand = mulberry32(7210);
    const targets = Array.from({ length: 34 }, (_, i) => {
      const mode = i % 2 ? -.09 : .09;
      return [.76 + mode + gaussian(rand) * .035, .55 + mode * .34 + gaussian(rand) * .10];
    });

    for (let panel = 0; panel < 3; panel++) {
      const ox = panel * panelW;
      const visible = panel === 0 || state.bandwidthStep >= panel;
      const alpha = visible ? 1 : .08;
      if (panel) {
        ctx.strokeStyle = 'rgba(17,21,27,.12)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ox, h * .13); ctx.lineTo(ox, h * .91); ctx.stroke();
      }
      const qx = ox + panelW * .24, qy = h * .57;
      ctx.save(); ctx.globalAlpha = alpha;
      targets.forEach(([tx, ty]) => circle(ctx, ox + tx * panelW, ty * h, 6.2, C.blue, .46));
      circle(ctx, qx, qy, 15, C.ink, 1, C.white, 4);

      if (panel === 0) {
        [42, 62].forEach((r, i) => circle(ctx, qx, qy, r + pulse * 3, null, .28 - i * .1, C.blue, 2));
        arrow(ctx, qx, qy, qx + 22, qy - 5, C.blue, 5, .35);
        ctx.fillStyle = C.orange; ctx.font = '700 21px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
        ctx.fillText('cannot reach data', ox + panelW * .5, h * .84);
      } else if (panel === 1) {
        circle(ctx, qx, qy, panelW * .42 + pulse * 4, null, .2, C.violet, 3);
        targets.forEach(([tx, ty]) => {
          ctx.strokeStyle = C.violet; ctx.globalAlpha = .075 * alpha; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(ox + tx * panelW, ty * h); ctx.stroke();
        });
        ctx.globalAlpha = alpha;
        const blurX = ox + panelW * .76, blurY = h * .55;
        arrow(ctx, qx, qy, blurX, blurY, C.violet, 8, .9);
        ctx.strokeStyle = C.orange; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(blurX - 14, blurY - 14); ctx.lineTo(blurX + 14, blurY + 14); ctx.moveTo(blurX + 14, blurY - 14); ctx.lineTo(blurX - 14, blurY + 14); ctx.stroke();
        ctx.fillStyle = C.orange; ctx.font = '700 21px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
        ctx.fillText('lands between modes', ox + panelW * .5, h * .84);
      } else {
        [54, 112, panelW * .39].forEach((r, i) => circle(ctx, qx, qy, r + pulse * (i + 1) * 2, null, .25 - i * .055, [C.blue,C.violet,C.orange][i], 3));
        const midX = ox + panelW * .56, midY = h * .56;
        arrow(ctx, qx, qy, midX, midY, C.violet, 9, .55);
        arrow(ctx, midX, midY, ox + panelW * .69, h * .515, C.blue, 8, 1);
        circle(ctx, ox + panelW * .69, h * .515, 22 + pulse * 5, null, .45, C.green, 3);
        ctx.fillStyle = C.green; ctx.font = '700 21px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
        ctx.fillText('coarse → fine', ox + panelW * .5, h * .84);
      }
      ctx.restore();
    }
  }

  function drawPushforward(now) {
    const canvas = document.getElementById('pushforward-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h);
    if (state.pfStep < 1) return;

    const elapsed = (now - state.enteredAt) / 1000;
    const x0 = w * .365, x1 = w * .635;
    const rand = mulberry32(2602);
    for (let i = 0; i < 15; i++) {
      const baseY = h * (.18 + rand() * .64);
      const bend = (rand() - .5) * h * .22;
      const phase = (elapsed * .22 + i / 15) % 1;
      const p = ease(phase);
      const x = lerp(x0, x1, p);
      const y = baseY + Math.sin(p * Math.PI) * bend;

      ctx.save();
      ctx.strokeStyle = i % 3 ? C.violet : C.orange;
      ctx.globalAlpha = .08;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 10]);
      ctx.beginPath();
      ctx.moveTo(x0, baseY);
      ctx.quadraticCurveTo((x0 + x1) / 2, baseY + bend * 1.8, x1, baseY);
      ctx.stroke();
      ctx.restore();

      circle(ctx, x, y, 6.5, p < .5 ? C.ink : C.orange, .85, C.white, 2.5);
    }
  }

  function antisymPoints() {
    const rand = mulberry32(4711);
    const p = [], q = [];
    for (let i = 0; i < 28; i++) {
      p.push([.69 + gaussian(rand) * .085, .37 + gaussian(rand) * .11]);
      q.push([.31 + gaussian(rand) * .085, .66 + gaussian(rand) * .11]);
    }
    return { p, q };
  }

  function drawAntisym(canvas, now) {
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 58);
    const swapped = canvas.id === 'antisym-right';
    const pts = antisymPoints();
    const probe = [.5, .53];
    const attractive = swapped ? pts.q : pts.p;
    const repulsive = swapped ? pts.p : pts.q;
    const attrColor = swapped ? C.orange : C.blue;
    const repColor = swapped ? C.blue : C.orange;
    const attrMean = weightedMean(attractive, probe, .32);
    const repMean = weightedMean(repulsive, probe, .32);
    const net = [
      probe[0] + (attrMean[0] - probe[0]) - (repMean[0] - probe[0]),
      probe[1] + (attrMean[1] - probe[1]) - (repMean[1] - probe[1]),
    ];
    const pulse = .75 + .25 * Math.sin(now / 420);

    pts.p.forEach(([x, y]) => circle(ctx, x * w, y * h, 5.7, C.blue, .45));
    pts.q.forEach(([x, y]) => circle(ctx, x * w, y * h, 5.7, C.orange, .46));
    attractive.forEach(([x, y]) => {
      ctx.save(); ctx.globalAlpha = .035 + .08 * pulse; ctx.strokeStyle = attrColor;
      ctx.beginPath(); ctx.moveTo(probe[0] * w, probe[1] * h); ctx.lineTo(x * w, y * h); ctx.stroke(); ctx.restore();
    });
    repulsive.forEach(([x, y]) => {
      ctx.save(); ctx.globalAlpha = .03 + .06 * pulse; ctx.strokeStyle = repColor;
      ctx.beginPath(); ctx.moveTo(probe[0] * w, probe[1] * h); ctx.lineTo(x * w, y * h); ctx.stroke(); ctx.restore();
    });
    circle(ctx, probe[0] * w, probe[1] * h, 13, C.ink, 1, C.white, 4);
    arrow(ctx, probe[0] * w, probe[1] * h, attrMean[0] * w, attrMean[1] * h, attrColor, 5, .78);
    const repelEnd = [probe[0] - (repMean[0] - probe[0]), probe[1] - (repMean[1] - probe[1])];
    arrow(ctx, probe[0] * w, probe[1] * h, repelEnd[0] * w, repelEnd[1] * h, repColor, 5, .78);
    arrow(ctx, probe[0] * w, probe[1] * h, net[0] * w, net[1] * h, C.violet, 9, 1);
  }

  function drawEquilibrium(now) {
    const canvas = document.getElementById('equilibrium-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 62);
    const rand = mulberry32(12012);
    const probe = [.33, .54];
    const points = [];
    for (let i = 0; i < 30; i++) points.push([.34 + gaussian(rand) * .15, .52 + gaussian(rand) * .19]);

    points.forEach(([x, y]) => {
      ctx.save(); ctx.globalAlpha = .055; ctx.strokeStyle = C.blue;
      ctx.beginPath(); ctx.moveTo(probe[0] * w, probe[1] * h); ctx.lineTo(x * w, y * h); ctx.stroke(); ctx.restore();
      circle(ctx, x * w - 3, y * h - 2, 7.2, C.blue, .48);
      circle(ctx, x * w + 3, y * h + 2, 7.2, C.orange, .48);
    });

    const baseX = 115, baseY = -58;
    const shrink = state.eqStep ? .06 + .03 * (1 + Math.sin(now / 330)) : 1;
    circle(ctx, probe[0] * w, probe[1] * h, 15, C.ink, 1, C.white, 4);
    arrow(ctx, probe[0] * w, probe[1] * h, probe[0] * w + baseX * shrink, probe[1] * h + baseY * shrink, C.blue, 7, 1);
    arrow(ctx, probe[0] * w, probe[1] * h, probe[0] * w - baseX * shrink, probe[1] * h - baseY * shrink, C.orange, 7, 1);
    if (state.eqStep) {
      const r = 22 + 7 * (1 + Math.sin(now / 320));
      circle(ctx, probe[0] * w, probe[1] * h, r, null, .5, C.green, 3);
    }
  }

  function drawFixedPoint(now) {
    const canvas = document.getElementById('fixedpoint-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 64);
    const centers = [.18, .5, .82];
    const gaps = [w * .12, w * .062, 5];
    const labels = ['iteration t', 'iteration t + 1', 'fixed point'];
    const phase = (Math.sin((now - state.enteredAt) / 650) + 1) / 2;

    centers.forEach((cx, i) => {
      const mid = cx * w, y = h * .56;
      const gap = gaps[i];
      const predX = mid - gap / 2 + gap * .18 * phase;
      const targetX = mid + gap / 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(17,21,27,.12)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(mid - w * .105, y); ctx.lineTo(mid + w * .105, y); ctx.stroke();
      ctx.restore();
      if (gap > 8) arrow(ctx, predX + 26, y, targetX - 30, y, C.violet, 5, .82);
      circle(ctx, predX, y, 30, C.orange, 1, C.white, 5);
      circle(ctx, targetX, y, 32, C.ink, 1, C.white, 5);
      circle(ctx, targetX, y, 21, null, .8, C.white, 3);
      ctx.fillStyle = i === 2 ? C.green : C.muted;
      ctx.font = '700 18px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], mid, h * .23);
      ctx.font = '600 15px "JetBrains Mono", monospace';
      ctx.fillText(i === 2 ? 'V = 0' : 'recompute V', mid, h * .82);
      if (i < 2) {
        arrow(ctx, mid + w * .115, h * .35, centers[i + 1] * w - w * .115, h * .35, C.muted, 3, .4);
      }
    });
    const meter = document.querySelector('.drift-distance');
    if (meter) meter.style.setProperty('--gap', String(82 - phase * 16) + '%');
  }

  function imageTile(ctx, x, y, photoIndex, scale = 1, alpha = 1) {
    const w = 78 * scale, h = 58 * scale;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = C.white; ctx.strokeStyle = 'rgba(17,21,27,.16)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 10 * scale); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.roundRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, h - 10, 7 * scale); ctx.clip();
    const img = state.featurePhotos?.[photoIndex];
    if (img?.complete && img.naturalWidth) {
      const boxW = w - 10, boxH = h - 10;
      const sourceRatio = img.naturalWidth / img.naturalHeight;
      const boxRatio = boxW / boxH;
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (sourceRatio > boxRatio) {
        sw = img.naturalHeight * boxRatio;
        sx = (img.naturalWidth - sw) / 2;
      } else {
        sh = img.naturalWidth / boxRatio;
        sy = (img.naturalHeight - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, x - w / 2 + 5, y - h / 2 + 5, boxW, boxH);
    } else {
      ctx.fillStyle = C.well; ctx.fillRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, h - 10);
    }
    ctx.restore(); ctx.restore();
  }

  function drawFeatureDistance(now) {
    const canvas = document.getElementById('feature-distance-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 64);
    const leftQ = [w * .24, h * .57], rightQ = [w * .73, h * .57];
    const leftPts = [[.10,.33,1],[.39,.32,2],[.10,.75,3],[.40,.77,4],[.17,.84,5],[.35,.48,2]];
    const rightPts = [[.64,.40,1],[.80,.43,2],[.68,.72,3],[.88,.30,4],[.89,.73,5],[.59,.82,1]];

    leftPts.forEach(([px, py, photo]) => {
      const x = px * w, y = py * h;
      ctx.save(); ctx.strokeStyle = C.red; ctx.globalAlpha = .12; ctx.lineWidth = 2; ctx.setLineDash([6,9]);
      ctx.beginPath(); ctx.moveTo(leftQ[0], leftQ[1]); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
      imageTile(ctx, x, y, photo, 1.1, .9);
    });
    imageTile(ctx, leftQ[0], leftQ[1], 0, 1.08, 1);
    circle(ctx, leftQ[0], leftQ[1], 60, null, .22, C.red, 2);

    const alpha = state.featureStep ? 1 : .14;
    rightPts.forEach(([px, py, photo]) => {
      const x = px * w, y = py * h;
      const near = photo <= 3;
      if (near) {
        ctx.save(); ctx.strokeStyle = C.blue; ctx.globalAlpha = .2 * alpha; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(rightQ[0], rightQ[1]); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
      }
      imageTile(ctx, x, y, photo, 1.1, alpha * (near ? 1 : .7));
    });
    imageTile(ctx, rightQ[0], rightQ[1], 0, 1.08, alpha);
    if (state.featureStep) {
      circle(ctx, rightQ[0], rightQ[1], 82 + 5 * Math.sin(now / 380), null, .28, C.green, 3);
      const travel = ((now - state.enteredAt) / 2600) % 1;
      circle(ctx, lerp(w * .45, w * .55, travel), h * .5 + Math.sin(travel * Math.PI) * 25, 8, C.violet, .9, C.white, 3);
    }
  }

  function drawEstimator(now) {
    const canvas = document.getElementById('estimator-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 62);
    const variances = [.62, .30, .105];
    for (let panel = 0; panel < 3; panel++) {
      const left = panel * w / 3;
      if (panel) {
        ctx.strokeStyle = 'rgba(17,21,27,.12)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(left, h * .14); ctx.lineTo(left, h * .9); ctx.stroke();
      }
      const cx = left + w / 6, cy = h * .58;
      const rand = mulberry32(8200 + panel);
      for (let i = 0; i < 24; i++) {
        const angle = -.28 + gaussian(rand) * variances[panel] + Math.sin(now / 900 + i * 1.7) * variances[panel] * .04;
        const len = 82 + rand() * 62;
        arrow(ctx, cx, cy, cx + Math.cos(angle) * len, cy + Math.sin(angle) * len, C.blue, 2.3, .11);
      }
      circle(ctx, cx, cy, 9, C.ink, 1, C.white, 3);
      arrow(ctx, cx, cy, cx + Math.cos(-.28) * 130, cy + Math.sin(-.28) * 130, C.ink, 7, 1);
      ctx.fillStyle = panel === 2 ? C.green : C.muted;
      ctx.font = '650 16px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(panel === 0 ? 'noisy vote' : panel === 1 ? 'concentrating' : 'stable field', cx, h * .84);
    }
  }

  function drawChase(now) {
    const stage = document.querySelector('.chase-stage'); if (!stage) return;
    const pred = stage.querySelector('.chase-pred');
    const target = stage.querySelector('.chase-target');
    const v = stage.querySelector('.chase-v');
    const iter = stage.querySelector('.chase-iter b');
    const elapsed = (now - state.enteredAt) / 1000;
    const cycle = elapsed % 5.2;
    const iteration = Math.floor(elapsed / 5.2);
    const start = 20 + Math.min(iteration, 4) * 7.5;
    const goal = 74 - Math.min(iteration, 4) * 2.5;
    const chase = cycle < .7 ? 0 : cycle < 3.5 ? ease((cycle - .7) / 2.8) : 1;
    const predX = lerp(start, goal - 7, chase);
    const nextGoal = cycle > 4.0 ? Math.min(80, goal + 4.5) : goal;
    pred.style.left = `${predX}%`;
    target.style.left = `${nextGoal}%`;
    v.style.left = `${(predX + nextGoal) / 2}%`;
    v.style.opacity = String(clamp((nextGoal - predX) / 40, .18, 1));
    iter.textContent = String(iteration);
  }

  async function loadTrajectoryData() {
    try {
      const res = await fetch('data/trajectories.json');
      if (!res.ok) throw new Error(`${res.status}`);
      state.data = await res.json();
      buildDriftCurve();
    } catch (err) {
      console.warn('Trajectory data unavailable; serve the deck over HTTP.', err);
      document.querySelectorAll('.trajectory-panel').forEach((panel) => {
        const msg = document.createElement('div');
        msg.className = 'data-error';
        msg.textContent = 'serve over HTTP to load MPS trajectories';
        panel.appendChild(msg);
      });
    }
  }

  function trajectoryProgress(now, duration = 17500) {
    const raw = ((now - state.enteredAt) % (duration + 2300)) / duration;
    return ease(clamp(raw, 0, 1));
  }

  function pointToCanvas(pt, w, h, padding = .09) {
    const xmin = -3.25, xmax = 3.25, ymin = -3.25, ymax = 3.55;
    const pw = w * (1 - 2 * padding), ph = h * (1 - 2 * padding);
    return [w * padding + (pt[0] - xmin) / (xmax - xmin) * pw, h * (1 - padding) - (pt[1] - ymin) / (ymax - ymin) * ph];
  }

  function interpolatedFrame(run, progress) {
    const n = run.frames.length;
    const f = progress * (n - 1);
    const a = Math.floor(f), b = Math.min(n - 1, a + 1), mix = f - a;
    return run.frames[a].map((pt, i) => [lerp(pt[0], run.frames[b][i][0], mix), lerp(pt[1], run.frames[b][i][1], mix)]);
  }

  function drawTrajectoryPanel(panel, run, progress, now) {
    const canvas = panel.querySelector('canvas');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 58);
    state.data.target.forEach((pt) => { const [x, y] = pointToCanvas(pt, w, h); circle(ctx, x, y, 3.6, C.blue, .20); });
    const frame = interpolatedFrame(run, progress);
    const pulse = .6 + .2 * Math.sin(now / 350);
    frame.forEach((pt, i) => {
      const [x, y] = pointToCanvas(pt, w, h);
      circle(ctx, x, y, 4.6 + (i % 9 === 0 ? pulse : 0), C.orange, .68);
    });
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillStyle = C.muted; ctx.textAlign = 'right';
    ctx.fillText(`step ${Math.round(progress * run.steps[run.steps.length - 1])}`, w - 22, h - 20);
  }

  function drawTrajectories(now) {
    if (!state.data) return;
    const p = trajectoryProgress(now);
    document.querySelectorAll('.trajectory-panel').forEach((panel) => {
      const run = state.data.runs.find((r) => r.name === panel.dataset.run);
      if (run) drawTrajectoryPanel(panel, run, p, now);
    });
    const scrub = document.querySelector('.trajectory-scrub > i');
    const label = document.querySelector('.trajectory-scrub b');
    if (scrub) scrub.style.setProperty('--progress', `${p * 100}%`);
    if (scrub) scrub.style.background = `linear-gradient(90deg, ${C.orange} 0 ${p * 100}%, #e9edf2 ${p * 100}% 100%)`;
    if (label) label.textContent = String(Math.round(p * state.data.meta.steps));
  }

  function drawCollapse(now) {
    if (!state.data) return;
    const run = state.data.runs.find((r) => r.name === 'collapsed');
    const canvas = document.getElementById('collapse-detail');
    const s = sizeCanvas(canvas); if (!s || !run) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 60);
    const p = trajectoryProgress(now, 15500);
    state.data.target.forEach((pt) => { const [x, y] = pointToCanvas(pt, w, h); circle(ctx, x, y, 4, C.blue, .19); });
    const frame = interpolatedFrame(run, p);
    let left = 0;
    frame.forEach((pt) => {
      if (pt[0] < 0) left++;
      const [x, y] = pointToCanvas(pt, w, h); circle(ctx, x, y, 6, C.orange, .72);
    });
    const leftPct = left / frame.length * 100;
    const fill = document.querySelector('.gauge-bar i'); if (fill) fill.style.width = `${leftPct}%`;
    const labels = document.querySelectorAll('.gauge-labels b');
    if (labels[0]) labels[0].textContent = `${leftPct.toFixed(0)}%`;
    if (labels[1]) labels[1].textContent = `${(100 - leftPct).toFixed(0)}%`;
    ctx.font = '600 15px "JetBrains Mono", monospace'; ctx.fillStyle = C.muted; ctx.textAlign = 'right';
    ctx.fillText(`step ${Math.round(p * run.steps[run.steps.length - 1])}`, w - 24, h - 24);
  }

  function buildDriftCurve() {
    const svg = document.getElementById('drift-curve'); if (!svg || !state.data) return;
    svg.innerHTML = '';
    const W = 1500, H = 620, pad = { l: 110, r: 70, t: 60, b: 75 };
    const values = state.data.runs.flatMap((r) => r.drift_norm).filter((v) => v > 0);
    const logMin = Math.log10(Math.min(...values) * .8), logMax = Math.log10(Math.max(...values) * 1.2);
    const x = (i, n) => pad.l + i / (n - 1) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (logMax - Math.log10(v)) / (logMax - logMin) * (H - pad.t - pad.b);
    for (let i = 0; i < 5; i++) {
      const yy = pad.t + i / 4 * (H - pad.t - pad.b);
      svg.appendChild(svgEl('line', { x1: pad.l, y1: yy, x2: W - pad.r, y2: yy, stroke: 'rgba(17,21,27,.09)', 'stroke-width': 2 }));
    }
    const colors = [C.violet, C.blue, C.orange];
    state.data.runs.forEach((run, ri) => {
      const pts = run.drift_norm.map((v, i) => `${x(i, run.drift_norm.length)},${y(v)}`).join(' ');
      svg.appendChild(svgEl('polyline', { points: pts, fill: 'none', stroke: colors[ri], 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: .88 }));
      const labelY = 95 + ri * 42;
      svg.appendChild(svgEl('circle', { cx: 160, cy: labelY, r: 8, fill: colors[ri] }));
      const txt = svgEl('text', { x: 183, y: labelY + 6, fill: C.muted, 'font-family': 'JetBrains Mono', 'font-size': 20, 'font-weight': 600 });
      txt.textContent = run.name; svg.appendChild(txt);
    });
  }

  function animateCurve(now) {
    if (!state.data) return;
    const p = trajectoryProgress(now, 15000);
    const cursor = document.querySelector('.curve-cursor');
    if (cursor) cursor.style.left = `${7.3 + p * 85}%`;
  }

  function initNeighborClouds() {
    document.querySelectorAll('.neighbor-cloud').forEach((cloud, idx) => {
      if (cloud.dataset.ready) return;
      cloud.dataset.ready = '1';
      const n = Number(cloud.dataset.count);
      const rand = mulberry32(500 + n);
      for (let i = 0; i < n; i++) {
        const dot = document.createElement('i');
        const angle = rand() * Math.PI * 2;
        const radius = Math.sqrt(rand()) * 43;
        dot.style.cssText = `position:absolute;left:${50 + Math.cos(angle) * radius}%;top:${50 + Math.sin(angle) * radius}%;width:${12 + rand() * 10}px;height:${12 + rand() * 10}px;border-radius:50%;background:${i % 3 ? C.blue : C.orange};opacity:${.42 + rand() * .45};transform:translate(-50%,-50%);box-shadow:0 0 0 5px rgba(255,255,255,.8)`;
        cloud.appendChild(dot);
      }
    });
  }

  function buildNfeChart() {
    const svg = document.getElementById('nfe-chart'); if (!svg || svg.dataset.ready) return;
    svg.dataset.ready = '1';
    const W = 1500, H = 660, pad = { l: 120, r: 80, t: 70, b: 90 };
    const points = [
      ['MeanFlow', 1, 3.43, C.muted], ['AdvFlow', 1, 2.38, C.muted], ['iMeanFlow', 1, 1.72, C.violet],
      ['Drifting', 1, 1.54, C.green], ['RAE + DiT', 50, 1.13, C.blue], ['LightningDiT', 250, 1.35, C.blue],
      ['SiT + REPA', 250, 1.42, C.blue], ['SiT', 250, 2.06, C.blue], ['DiT', 250, 2.27, C.blue],
    ];
    const x = (n) => pad.l + Math.log10(n) / Math.log10(300) * (W - pad.l - pad.r);
    const y = (fid) => pad.t + (fid - 1) / 2.8 * (H - pad.t - pad.b);
    [1, 10, 100, 250].forEach((tick) => {
      const xx = x(tick);
      svg.appendChild(svgEl('line', { x1: xx, y1: pad.t, x2: xx, y2: H - pad.b, stroke: 'rgba(17,21,27,.09)', 'stroke-width': 2 }));
      const tx = svgEl('text', { x: xx, y: H - 42, 'text-anchor': 'middle', fill: C.muted, 'font-family': 'JetBrains Mono', 'font-size': 22, 'font-weight': 600 }); tx.textContent = tick; svg.appendChild(tx);
    });
    [1, 2, 3, 4].forEach((tick) => {
      const yy = y(tick);
      svg.appendChild(svgEl('line', { x1: pad.l, y1: yy, x2: W - pad.r, y2: yy, stroke: 'rgba(17,21,27,.07)', 'stroke-width': 2 }));
      const tx = svgEl('text', { x: 86, y: yy + 8, 'text-anchor': 'middle', fill: C.muted, 'font-family': 'JetBrains Mono', 'font-size': 22, 'font-weight': 600 }); tx.textContent = tick.toFixed(1); svg.appendChild(tx);
    });
    const xl = svgEl('text', { x: W / 2, y: H - 10, 'text-anchor': 'middle', fill: C.muted, 'font-family': 'JetBrains Mono', 'font-size': 20, 'font-weight': 600, 'letter-spacing': 3 }); xl.textContent = 'NETWORK EVALUATIONS · LOG SCALE'; svg.appendChild(xl);
    const yl = svgEl('text', { x: 28, y: H / 2, transform: `rotate(-90 28 ${H/2})`, 'text-anchor': 'middle', fill: C.muted, 'font-family': 'JetBrains Mono', 'font-size': 20, 'font-weight': 600, 'letter-spacing': 3 }); yl.textContent = 'FID ↓'; svg.appendChild(yl);
    points.forEach(([name, nfe, fid, color], idx) => {
      const g = svgEl('g', { class: 'nfe-point', 'data-index': idx, opacity: 0 });
      const hero = name === 'Drifting';
      g.appendChild(svgEl('circle', { cx: x(nfe), cy: y(fid), r: hero ? 25 : 15, fill: color, stroke: '#fff', 'stroke-width': hero ? 7 : 4 }));
      if (hero) g.appendChild(svgEl('circle', { cx: x(nfe), cy: y(fid), r: 38, fill: 'none', stroke: color, 'stroke-width': 3, opacity: .35 }));
      const txt = svgEl('text', { x: x(nfe) + (nfe === 1 ? 32 : -28), y: y(fid) + (idx % 2 ? -20 : 30), 'text-anchor': nfe === 1 ? 'start' : 'end', fill: hero ? C.green : C.muted, 'font-family': 'JetBrains Mono', 'font-size': hero ? 24 : 18, 'font-weight': hero ? 700 : 600 }); txt.textContent = `${name} · ${fid}`; g.appendChild(txt);
      svg.appendChild(g);
    });
  }

  function animateNfeChart() {
    const slide = document.querySelector('#nfe-chart')?.closest('section');
    if (!slide || state.nfeAnimatedFor === slide) return;
    state.nfeAnimatedFor = slide;
    slide.querySelectorAll('.nfe-point').forEach((g, i) => {
      g.animate([{ opacity: 0, transform: 'translateY(25px)' }, { opacity: 1, transform: 'translateY(0)' }], {
        duration: 650, delay: 120 + i * 130, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards',
      });
    });
  }

  /* ---------- paper section: score, spectrum, and gradient flow ---------- */
  function miniArrow(ctx, x, y, dx, dy, color, alpha = 1, width = 2.2) {
    const mag = Math.hypot(dx, dy);
    if (mag < .2) return;
    const x2 = x + dx, y2 = y + dy;
    const angle = Math.atan2(dy, dx);
    const head = 5 + width * 1.5;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - .52), y2 - head * Math.sin(angle - .52));
    ctx.lineTo(x2 - head * Math.cos(angle + .52), y2 - head * Math.sin(angle + .52));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function mixtureScore(x, y, centers, sigma = .19) {
    let wx = 0, wy = 0, sum = 0;
    centers.forEach(([cx, cy]) => {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      const weight = Math.exp(-d2 / (2 * sigma * sigma));
      wx += weight * cx; wy += weight * cy; sum += weight;
    });
    if (sum < 1e-8) return [0, 0];
    return [(wx / sum - x) / (sigma * sigma), (wy / sum - y) / (sigma * sigma)];
  }

  function scaledVector(vec, maxLength) {
    const mag = Math.hypot(vec[0], vec[1]);
    const length = maxLength * Math.tanh(mag * .045);
    return mag < 1e-7 ? [0, 0] : [vec[0] / mag * length, vec[1] / mag * length];
  }

  function drawMixtureCloud(ctx, w, h, centers, color, seed, n = 90, alpha = .45) {
    const rand = mulberry32(seed);
    centers.forEach(([cx, cy], ci) => {
      circle(ctx, cx * w, cy * h, Math.min(w, h) * .12, color === C.blue ? C.blueSoft : C.orangeSoft, .18, color, 1.4);
      for (let i = ci; i < n; i += centers.length) {
        const x = (cx + gaussian(rand) * .045) * w;
        const y = (cy + gaussian(rand) * .07) * h;
        circle(ctx, x, y, 4.2, color, alpha);
      }
    });
  }

  function drawGaussianKernelIntro(now) {
    const canvas = document.getElementById('gaussian-kernel-intro-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 60);
    const probe = [w * .48, h * .60], sigma = Math.min(w, h) * .17;
    const glow = ctx.createRadialGradient(probe[0], probe[1], 0, probe[0], probe[1], sigma * 2.8);
    glow.addColorStop(0, 'rgba(47,111,224,.23)'); glow.addColorStop(.36, 'rgba(47,111,224,.12)'); glow.addColorStop(.72, 'rgba(47,111,224,.045)'); glow.addColorStop(1, 'rgba(47,111,224,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    [1, 2].forEach((scale) => {
      ctx.strokeStyle = scale === 1 ? 'rgba(47,111,224,.42)' : 'rgba(47,111,224,.18)'; ctx.lineWidth = scale === 1 ? 4 : 2; ctx.setLineDash(scale === 1 ? [10, 9] : [6, 11]);
      ctx.beginPath(); ctx.arc(probe[0], probe[1], sigma * scale, 0, Math.PI * 2); ctx.stroke();
    }); ctx.setLineDash([]);
    const rand = mulberry32(320032);
    const points = Array.from({ length: 42 }, () => {
      const angle = rand() * Math.PI * 2, radius = Math.sqrt(rand()) * sigma * 2.65;
      return [probe[0] + Math.cos(angle) * radius, probe[1] + Math.sin(angle) * radius];
    });
    const weighted = state.gaussianIntroStep >= 1;
    const pulse = .94 + .06 * Math.sin(now / 430);
    points.forEach(([x, y], index) => {
      const distance = Math.hypot(x - probe[0], y - probe[1]);
      const weight = Math.exp(-(distance ** 2) / (2 * sigma * sigma));
      if (weighted && weight > .12) {
        ctx.strokeStyle = C.blue; ctx.globalAlpha = .025 + weight * .12; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(probe[0], probe[1]); ctx.lineTo(x, y); ctx.stroke(); ctx.globalAlpha = 1;
      }
      circle(ctx, x, y, weighted ? 4.5 + weight * 13 * pulse : 7, C.blue, weighted ? .12 + .82 * weight : .38, '#fff', 2);
      if (weighted && index % 13 === 0) {
        ctx.fillStyle = C.blue; ctx.font = '700 14px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(weight.toFixed(2), x, y - 18);
      }
    });
    circle(ctx, probe[0], probe[1], 15, C.ink, 1, '#fff', 5);
    ctx.fillStyle = C.ink; ctx.font = '800 20px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('x', probe[0], probe[1] - 28);
    ctx.fillStyle = C.blue; ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillText('1σ', probe[0] + sigma * .72, probe[1] - sigma * .72 - 10);
    ctx.fillStyle = C.muted; ctx.fillText('2σ', probe[0] + sigma * 1.42, probe[1] - sigma * 1.42 - 8);
    if (state.gaussianIntroStep >= 3) {
      const label = 'smooth weights  →  exact score identity';
      const boxW = 430, boxH = 58, bx = w - boxW - 24, by = 24;
      ctx.fillStyle = 'rgba(17,21,27,.93)'; ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 16); ctx.fill();
      ctx.fillStyle = '#bcaeff'; ctx.font = '700 16px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(label, bx + boxW / 2, by + 36);
    }
  }

  function spotlightPoints(seed, centers, count = 34) {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, (_, i) => {
      const center = centers[i % centers.length];
      return [center[0] + gaussian(rand) * .085, center[1] + gaussian(rand) * .105];
    });
  }

  function weightedCenter2d(points, probe, sigma) {
    let sx = 0, sy = 0, sw = 0;
    points.forEach(([x, y]) => {
      const weight = Math.exp(-((x - probe[0]) ** 2 + (y - probe[1]) ** 2) / (2 * sigma * sigma));
      sx += weight * x; sy += weight * y; sw += weight;
    });
    return [sx / sw, sy / sw];
  }

  function drawSpotlightPanel(ctx, bounds, points, probe, sigma, color, label, active, showCenter, now) {
    const { x: bx, y: by, w: bw, h: bh } = bounds;
    const px = bx + probe[0] * bw, py = by + probe[1] * bh;
    const radius = sigma * Math.min(bw, bh) * 2.25;
    ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
    const glow = ctx.createRadialGradient(px, py, 0, px, py, radius);
    glow.addColorStop(0, 'rgba(106,72,215,.18)'); glow.addColorStop(.45, 'rgba(106,72,215,.09)'); glow.addColorStop(1, 'rgba(106,72,215,0)');
    ctx.fillStyle = glow; ctx.fillRect(bx, by, bw, bh);
    [1, 2].forEach((scale) => {
      ctx.strokeStyle = `rgba(106,72,215,${scale === 1 ? .34 : .16})`; ctx.lineWidth = scale === 1 ? 3 : 2; ctx.setLineDash(scale === 1 ? [9, 8] : [5, 9]);
      ctx.beginPath(); ctx.arc(px, py, sigma * Math.min(bw, bh) * scale, 0, Math.PI * 2); ctx.stroke();
    }); ctx.setLineDash([]);
    const pulse = .93 + .07 * Math.sin(now / 420);
    points.forEach(([x, y]) => {
      const d2 = (x - probe[0]) ** 2 + (y - probe[1]) ** 2;
      const weight = Math.exp(-d2 / (2 * sigma * sigma));
      const cx = bx + x * bw, cy = by + y * bh;
      if (active && weight > .13) {
        ctx.strokeStyle = color; ctx.globalAlpha = .04 + weight * .13; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx, cy); ctx.stroke();
      }
      const r = active ? 4.5 + weight * 12 * pulse : 6.2;
      circle(ctx, cx, cy, r, color, active ? .16 + weight * .80 : .34, '#fff', active ? 2 : 1.5);
    }); ctx.globalAlpha = 1;
    circle(ctx, px, py, 13, C.ink, 1, '#fff', 5);
    ctx.fillStyle = C.ink; ctx.font = '800 18px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('x', px, py - 24);
    ctx.fillStyle = C.violet; ctx.font = '700 16px "JetBrains Mono", monospace'; ctx.fillText('same Gaussian σ', px, py + radius + 30);
    if (showCenter) {
      const mu = weightedCenter2d(points, probe, sigma);
      const mx = bx + mu[0] * bw, my = by + mu[1] * bh;
      arrow(ctx, px, py, mx, my, color, 8, .94);
      circle(ctx, mx, my, 17, color, .98, '#fff', 5);
      ctx.fillStyle = color; ctx.font = '800 20px "JetBrains Mono", monospace'; ctx.fillText(label, mx, my - 27);
      ctx.fillStyle = C.muted; ctx.font = '650 15px "JetBrains Mono", monospace'; ctx.fillText(`${label} − x`, (px + mx) / 2, (py + my) / 2 - 20);
    }
    ctx.restore();
  }

  function drawGaussianSpotlight(now) {
    const canvas = document.getElementById('gaussian-spotlight-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 62);
    const top = 82, bottom = 52, gap = 22, half = (w - gap) / 2;
    ctx.fillStyle = 'rgba(47,111,224,.035)'; ctx.fillRect(0, 0, half, h);
    ctx.fillStyle = 'rgba(223,100,47,.035)'; ctx.fillRect(half + gap, 0, half, h);
    ctx.strokeStyle = 'rgba(17,21,27,.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w / 2, 22); ctx.lineTo(w / 2, h - 22); ctx.stroke();
    const probe = [.46, .56], sigma = .22;
    const pPoints = spotlightPoints(3201, [[.67, .34], [.72, .67], [.34, .25]], 38);
    const qPoints = spotlightPoints(3202, [[.22, .36], [.29, .68], [.20, .78]], 38);
    drawSpotlightPanel(ctx, { x: 0, y: top, w: half, h: h - top - bottom }, pPoints, probe, sigma, C.blue, 'μp', state.spotlightStep >= 1, state.spotlightStep >= 3, now);
    drawSpotlightPanel(ctx, { x: half + gap, y: top, w: half, h: h - top - bottom }, qPoints, probe, sigma, C.orange, 'μq', state.spotlightStep >= 2, state.spotlightStep >= 3, now);
  }

  function gaussian1d(x, center, sigma) { return Math.exp(-((x - center) ** 2) / (2 * sigma * sigma)); }

  function drawGaussianBlur(now) {
    const canvas = document.getElementById('gaussian-blur-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 62);
    const samples = [.11, .20, .29, .48, .56, .64, .78, .86];
    const sigma = .065, axisY = h * .79, topY = h * .20;
    const X = (u) => w * (.055 + .89 * u);
    const bumpY = (u, center) => axisY - gaussian1d(u, center, sigma) * (axisY - topY) * .44;
    const density = (u) => samples.reduce((sum, sample) => sum + gaussian1d(u, sample, sigma), 0);
    let maxDensity = 0;
    for (let i = 0; i <= 240; i++) maxDensity = Math.max(maxDensity, density(i / 240));
    const densityY = (u) => axisY - density(u) / maxDensity * (axisY - topY) * .88;
    const progress = ease(clamp((now - state.fragmentAt) / 720, 0, 1));

    ctx.strokeStyle = 'rgba(17,21,27,.20)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(0), axisY); ctx.lineTo(X(1), axisY); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.font = '650 15px "JetBrains Mono", monospace'; ctx.textAlign = 'right';
    ctx.fillText('sample space', X(1), axisY + 52);

    if (state.gaussianBlurStep >= 1) {
      samples.forEach((sample, sampleIndex) => {
        const local = clamp(progress * 1.8 - sampleIndex * .08, 0, 1);
        ctx.strokeStyle = C.blue; ctx.globalAlpha = .13 + .20 * local; ctx.lineWidth = 2.5;
        ctx.beginPath();
        const start = Math.max(0, sample - sigma * 3.5), end = Math.min(1, sample + sigma * 3.5);
        for (let i = 0; i <= 70; i++) {
          const u = start + (end - start) * (i / 70);
          const y = axisY - (axisY - bumpY(u, sample)) * local;
          if (i === 0) ctx.moveTo(X(u), y); else ctx.lineTo(X(u), y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }

    if (state.gaussianBlurStep >= 2) {
      const reveal = progress;
      ctx.beginPath(); ctx.moveTo(X(0), axisY);
      const count = Math.max(1, Math.floor(240 * reveal));
      for (let i = 0; i <= count; i++) { const u = i / 240; ctx.lineTo(X(u), densityY(u)); }
      ctx.lineTo(X(count / 240), axisY); ctx.closePath();
      ctx.fillStyle = 'rgba(47,111,224,.12)'; ctx.fill();
      ctx.strokeStyle = C.blue; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      for (let i = 0; i <= count; i++) { const u = i / 240; if (i === 0) ctx.moveTo(X(u), densityY(u)); else ctx.lineTo(X(u), densityY(u)); }
      ctx.stroke();
      if (reveal > .72) {
        ctx.fillStyle = C.blue; ctx.font = '800 25px "JetBrains Mono", monospace'; ctx.textAlign = 'right';
        ctx.fillText('pσ', X(.97), topY + 16);
      }
    }

    samples.forEach((sample, index) => {
      const pulse = 1 + .07 * Math.sin(now / 420 + index);
      circle(ctx, X(sample), axisY + 8, 10 * pulse, C.blue, .92, '#fff', 4);
      if (state.gaussianBlurStep >= 1) {
        ctx.strokeStyle = 'rgba(47,111,224,.22)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]);
        ctx.beginPath(); ctx.moveTo(X(sample), axisY - 2); ctx.lineTo(X(sample), bumpY(sample, sample) + 8); ctx.stroke(); ctx.setLineDash([]);
      }
    });
  }

  function drawGaussianSingleScore(now) {
    const canvas = document.getElementById('gaussian-single-score-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 58);
    const samples = [.13, .21, .28, .52, .59, .67, .75, .82];
    const sigma = .105, probe = .41, axisY = h * .79, topY = h * .17;
    const X = (u) => w * (.08 + .84 * u);
    const density = (u) => samples.reduce((sum, sample) => sum + gaussian1d(u, sample, sigma), 0);
    let maxDensity = 0;
    for (let i = 0; i <= 240; i++) maxDensity = Math.max(maxDensity, density(i / 240));
    const Y = (d) => axisY - d / maxDensity * (axisY - topY) * .88;
    const curveY = Y(density(probe)), probeX = X(probe);

    ctx.strokeStyle = 'rgba(17,21,27,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(0), axisY); ctx.lineTo(X(1), axisY); ctx.stroke();
    samples.forEach((sample) => {
      ctx.strokeStyle = 'rgba(47,111,224,.12)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const u = i / 100, yy = axisY - gaussian1d(u, sample, sigma) / maxDensity * (axisY - topY) * .88;
        if (i === 0) ctx.moveTo(X(u), yy); else ctx.lineTo(X(u), yy);
      }
      ctx.stroke();
      circle(ctx, X(sample), axisY + 13, 7, C.blue, .58, '#fff', 2);
    });
    ctx.beginPath(); ctx.moveTo(X(0), axisY);
    for (let i = 0; i <= 240; i++) { const u = i / 240; ctx.lineTo(X(u), Y(density(u))); }
    ctx.lineTo(X(1), axisY); ctx.closePath(); ctx.fillStyle = 'rgba(47,111,224,.10)'; ctx.fill();
    ctx.strokeStyle = C.blue; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let i = 0; i <= 240; i++) { const u = i / 240; if (i === 0) ctx.moveTo(X(u), Y(density(u))); else ctx.lineTo(X(u), Y(density(u))); } ctx.stroke();
    ctx.fillStyle = C.blue; ctx.font = '800 23px "JetBrains Mono", monospace'; ctx.textAlign = 'right'; ctx.fillText('pσ', X(.98), topY + 10);

    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(probeX, topY - 10); ctx.lineTo(probeX, axisY + 45); ctx.stroke(); ctx.setLineDash([]);
    circle(ctx, probeX, axisY, 10, C.ink, 1, '#fff', 4);
    ctx.fillStyle = C.ink; ctx.font = '800 19px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('x', probeX, axisY + 48);

    if (state.singleScoreStep >= 1) {
      const reveal = ease(clamp((now - state.fragmentAt) / 650, 0, 1));
      ctx.strokeStyle = C.blue; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(probeX, axisY); ctx.lineTo(probeX, lerp(axisY, curveY, reveal)); ctx.stroke();
      circle(ctx, probeX, curveY, 10, C.blue, 1, '#fff', 4);
      const midY = (axisY + curveY) / 2;
      ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.beginPath(); ctx.roundRect(probeX - 145, midY - 29, 125, 50, 13); ctx.fill();
      ctx.fillStyle = C.blue; ctx.font = '750 16px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('height', probeX - 82, midY + 3);
    }

    if (state.singleScoreStep >= 2) {
      const eps = .003, derivative = (density(probe + eps) - density(probe - eps)) / (2 * eps);
      const slopePx = derivative / maxDensity * (axisY - topY) * .88 / (w * .84);
      const half = 92, reveal = ease(clamp((now - state.fragmentAt) / 650, 0, 1));
      ctx.strokeStyle = C.violet; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(probeX - half * reveal, curveY + slopePx * half * reveal); ctx.lineTo(probeX + half * reveal, curveY - slopePx * half * reveal); ctx.stroke();
      arrow(ctx, probeX + 25, curveY - slopePx * 25, probeX + 105, curveY - slopePx * 105, C.violet, 7, reveal);
      ctx.fillStyle = C.violet; ctx.font = '750 16px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText('slope', probeX + 120, curveY - slopePx * 105 + 5);
    }

    if (state.singleScoreStep >= 3) {
      const boxW = Math.min(470, w * .68), boxH = 76, bx = (w - boxW) / 2, by = 22;
      ctx.fillStyle = 'rgba(17,21,27,.94)'; ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 19); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '750 18px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('slope  ÷  height', bx + boxW * .34, by + 46);
      ctx.fillStyle = '#bcaeff'; ctx.font = '800 21px "JetBrains Mono", monospace'; ctx.fillText('= score', bx + boxW * .78, by + 47);
    }
  }

  function drawScoreSubtraction(now) {
    const canvas = document.getElementById('score-subtraction-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 60);
    const rows = [h * .24, h * .51, h * .79], origin = w * .38;
    const rowInfo = [
      { label: 'DATA SCORE', hint: 'where pσ rises', color: C.blue, soft: 'rgba(47,111,224,.08)' },
      { label: 'MODEL SCORE', hint: 'where qσ rises', color: C.orange, soft: 'rgba(223,100,47,.08)' },
      { label: 'DRIFT', hint: 'data − model', color: C.violet, soft: 'rgba(106,72,215,.09)' },
    ];
    rowInfo.forEach((row, index) => {
      const y = rows[index], rh = h * .20;
      ctx.fillStyle = row.soft; ctx.beginPath(); ctx.roundRect(22, y - rh / 2, w - 44, rh, 22); ctx.fill();
      ctx.fillStyle = row.color; ctx.font = '800 18px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText(row.label, 52, y - 6);
      ctx.fillStyle = C.muted; ctx.font = '600 14px "JetBrains Mono", monospace'; ctx.fillText(row.hint, 52, y + 22);
      circle(ctx, origin, y, 10, C.ink, 1, '#fff', 4);
      ctx.fillStyle = C.ink; ctx.font = '800 16px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('x', origin, y - 22);
    });
    const progress = ease(clamp((now - state.fragmentAt) / 620, 0, 1));
    if (state.scoreSubtractionStep >= 1) {
      arrow(ctx, origin, rows[0], lerp(origin, origin + w * .22, progress), rows[0], C.blue, 10, .96);
      ctx.fillStyle = C.blue; ctx.font = '750 17px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText('∇ log pσ', origin + w * .24, rows[0] + 6);
    }
    if (state.scoreSubtractionStep >= 2) {
      arrow(ctx, origin, rows[1], lerp(origin, origin - w * .12, progress), rows[1], C.orange, 10, .96);
      ctx.fillStyle = C.orange; ctx.font = '750 17px "JetBrains Mono", monospace'; ctx.textAlign = 'right'; ctx.fillText('∇ log qσ', origin - w * .14, rows[1] + 6);
    }
    if (state.scoreSubtractionStep >= 3) {
      arrow(ctx, origin, rows[2], lerp(origin, origin + w * .34, progress), rows[2], C.violet, 12, .98);
      ctx.fillStyle = C.violet; ctx.font = '800 19px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText('∇ log pσ  −  ∇ log qσ', origin + w * .36, rows[2] + 7);
      ctx.fillStyle = C.violet; ctx.font = '800 18px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText('subtracting a left arrow makes a longer right arrow', w * .69, rows[2] - h * .075);
    }
  }

  function drawRatioFlatProof(now) {
    const canvas = document.getElementById('ratio-flat-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 58);
    const left = w * .09, right = w * .93, constantY = h * .43, zeroY = h * .72;
    const progress = ease(clamp((now - state.fragmentAt) / 760, 0, 1));
    let amplitude = 1;
    if (state.ratioProofStep === 1) amplitude = 1 - progress;
    if (state.ratioProofStep >= 2) amplitude = 0;
    let level = constantY;
    if (state.ratioProofStep === 3) level = lerp(constantY, zeroY, progress);
    if (state.ratioProofStep > 3) level = zeroY;
    const curveY = (u) => level - amplitude * h * (.115 * Math.sin(u * Math.PI * 2.2) + .055 * Math.sin(u * Math.PI * 5.1 + .4));

    ctx.fillStyle = C.violet; ctx.font = '800 18px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
    ctx.fillText('r(x) = log [ pσ(x) / qσ(x) ]', left, 54);
    ctx.strokeStyle = 'rgba(17,21,27,.24)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(left, zeroY); ctx.lineTo(right, zeroY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.muted; ctx.font = '650 15px "JetBrains Mono", monospace'; ctx.textAlign = 'right';
    ctx.fillText('0 = log 1', right, zeroY - 13); ctx.fillText('x', right, h - 35);

    ctx.beginPath(); ctx.moveTo(left, curveY(0));
    for (let i = 1; i <= 260; i++) { const u = i / 260; ctx.lineTo(lerp(left, right, u), curveY(u)); }
    ctx.strokeStyle = C.violet; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();

    if (amplitude > .04) {
      [.17, .35, .55, .73, .88].forEach((u) => {
        const eps = .004, slope = (curveY(u + eps) - curveY(u - eps)) / (2 * eps * (right - left));
        const x = lerp(left, right, u), y = curveY(u), dx = 55, dy = slope * dx;
        miniArrow(ctx, x - dx / 2, y - dy / 2, dx, dy, C.orange, .82, 3.8);
      });
      ctx.fillStyle = C.orange; ctx.font = '750 16px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText('a changing ratio has a non-zero slope somewhere', w * .52, h * .20);
    }

    if (state.ratioProofStep >= 1) {
      ctx.fillStyle = C.violet; ctx.font = '800 19px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText('zero slope everywhere', w * .52, constantY - 42);
    }
    if (state.ratioProofStep === 2) {
      ctx.fillStyle = 'rgba(106,72,215,.10)'; ctx.beginPath(); ctx.roundRect(w * .32, constantY + 30, w * .40, 64, 17); ctx.fill();
      ctx.fillStyle = C.violet; ctx.font = '800 18px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText('flat ratio = log C', w * .52, constantY + 70);
    }
    if (state.ratioProofStep >= 3 && progress > .60) {
      ctx.fillStyle = C.blue; ctx.font = '800 22px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText('normalization forces C = 1', w * .52, zeroY - 42);
    }
  }

  function drawGaussianInjectivity(now) {
    const canvas = document.getElementById('gaussian-injectivity-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 60);
    const progress = ease(clamp((now - state.fragmentAt) / 760, 0, 1));
    const left = { x: w * .10, width: w * .30 };
    const right = { x: w * .62, width: w * .28 };
    const axisY = h * .54;
    const outputZero = state.injectivityStep >= 1 ? clamp(progress / .48, 0, 1) : 0;
    const inputZero = state.injectivityStep >= 1 ? clamp((progress - .38) / .62, 0, 1) : 0;
    const inputAmplitude = h * .17 * (1 - inputZero);
    const outputAmplitude = h * .032 * (1 - outputZero);

    ctx.fillStyle = C.violet; ctx.font = '800 19px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(state.injectivityStep >= 1 ? 'therefore p − q = 0' : 'suppose p and q still differ', left.x + left.width / 2, 58);
    ctx.fillStyle = C.blue;
    ctx.fillText(state.injectivityStep >= 1 ? 'but the blurred difference is zero' : 'after Gaussian blur', right.x + right.width / 2, 58);

    ctx.strokeStyle = 'rgba(17,21,27,.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(left.x, axisY); ctx.lineTo(left.x + left.width, axisY); ctx.moveTo(right.x, axisY); ctx.lineTo(right.x + right.width, axisY); ctx.stroke();
    wavePath(ctx, left.x, axisY, left.width, inputAmplitude, 3.25, C.violet, 1, 8, .25);
    wavePath(ctx, right.x, axisY, right.width, outputAmplitude, 3.25, C.blue, 1, 8, .25);

    arrow(ctx, w * .42, axisY, w * .58, axisY, C.green, 5, .9);
    const pillX = w * .445, pillY = axisY - 94, pillW = w * .11, pillH = 66;
    ctx.fillStyle = 'rgba(22,138,82,.12)';
    ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, pillH, 18); ctx.fill();
    ctx.strokeStyle = C.green; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = C.green; ctx.font = '800 18px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText('× 0.12  > 0', pillX + pillW / 2, pillY + 41);

    if (state.injectivityStep < 1) {
      ctx.fillStyle = C.violet; ctx.font = '700 16px "JetBrains Mono", monospace';
      ctx.fillText('visible mismatch', left.x + left.width / 2, axisY + inputAmplitude + 58);
      ctx.fillStyle = C.green;
      ctx.fillText('tiny ≠ zero', right.x + right.width / 2, axisY + 65);
    } else if (progress > .72) {
      ctx.fillStyle = C.green; ctx.font = '800 18px "JetBrains Mono", monospace';
      ctx.fillText('zero output forces zero input', w * .5, h - 42);
    }
  }

  function drawDensityPanel(ctx, bounds, samples, probe, sigma, color, name, showBlur, showSlope) {
    const { x: bx, y: by, w: bw, h: bh } = bounds;
    const axisY = by + bh * .70, topY = by + bh * .18;
    const density = (u) => samples.reduce((sum, sample) => sum + gaussian1d(u, sample, sigma), 0);
    let maxDensity = 0;
    for (let i = 0; i <= 200; i++) maxDensity = Math.max(maxDensity, density(i / 200));
    const X = (u) => bx + bw * (.07 + .86 * u);
    const Y = (d) => axisY - d / maxDensity * (axisY - topY);
    ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
    ctx.strokeStyle = 'rgba(17,21,27,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(0), axisY); ctx.lineTo(X(1), axisY); ctx.stroke();
    samples.forEach((sample) => { circle(ctx, X(sample), axisY + 18, 6, color, .66, '#fff', 2); });
    const probeX = X(probe);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(probeX, topY - 12); ctx.lineTo(probeX, axisY + 35); ctx.stroke(); ctx.setLineDash([]);
    circle(ctx, probeX, axisY, 10, C.ink, 1, '#fff', 4);
    ctx.fillStyle = C.ink; ctx.font = '800 17px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('x', probeX, axisY + 55);
    if (showBlur) {
      samples.forEach((sample) => {
        ctx.strokeStyle = color; ctx.globalAlpha = .12; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i <= 100; i++) { const u = i / 100; const xx = X(u), yy = axisY - gaussian1d(u, sample, sigma) / maxDensity * (axisY - topY); if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); } ctx.stroke();
      }); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(X(0), axisY);
      for (let i = 0; i <= 200; i++) { const u = i / 200; ctx.lineTo(X(u), Y(density(u))); }
      ctx.lineTo(X(1), axisY); ctx.closePath(); ctx.fillStyle = color === C.blue ? 'rgba(47,111,224,.10)' : 'rgba(223,100,47,.10)'; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const u = i / 200; if (i === 0) ctx.moveTo(X(u), Y(density(u))); else ctx.lineTo(X(u), Y(density(u))); } ctx.stroke();
      ctx.fillStyle = color; ctx.font = '800 18px "JetBrains Mono", monospace'; ctx.textAlign = 'right'; ctx.fillText(name, X(.95), topY + 18);
    }
    if (showSlope) {
      let sw = 0, sm = 0; samples.forEach((sample) => { const weight = gaussian1d(probe, sample, sigma); sw += weight; sm += weight * sample; });
      const mu = sm / sw, muX = X(mu);
      const d0 = density(probe), eps = .003, derivative = (density(probe + eps) - density(probe - eps)) / (2 * eps);
      const slopePx = derivative / maxDensity * (axisY - topY) / (bw * .86);
      const curveY = Y(d0), tangentHalf = 58;
      ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(probeX - tangentHalf, curveY + slopePx * tangentHalf); ctx.lineTo(probeX + tangentHalf, curveY - slopePx * tangentHalf); ctx.stroke();
      circle(ctx, probeX, curveY, 9, color, 1, '#fff', 3);
      arrow(ctx, probeX, axisY - 30, muX, axisY - 30, color, 8, .96);
      circle(ctx, muX, axisY - 30, 13, color, .98, '#fff', 4);
      ctx.fillStyle = color; ctx.font = '750 16px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(`μ${name[0]} − x`, (probeX + muX) / 2, axisY - 57);
      ctx.fillText('same direction as slope', probeX, curveY - 35);
    }
    ctx.restore();
  }

  function drawGaussianProof(now) {
    const canvas = document.getElementById('gaussian-proof-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 62);
    const gap = 24, half = (w - gap) / 2, probe = .43, sigma = .12;
    drawDensityPanel(ctx, { x: 0, y: 56, w: half, h: h - 76 }, [.18,.26,.55,.61,.67,.74,.80], probe, sigma, C.blue, 'pσ', state.gaussianProofStep >= 1, state.gaussianProofStep >= 2);
    drawDensityPanel(ctx, { x: half + gap, y: 56, w: half, h: h - 76 }, [.11,.18,.24,.30,.34,.72,.78], probe, sigma, C.orange, 'qσ', state.gaussianProofStep >= 1, state.gaussianProofStep >= 2);
    ctx.strokeStyle = 'rgba(17,21,27,.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w / 2, 18); ctx.lineTo(w / 2, h - 18); ctx.stroke();
    if (state.gaussianProofStep >= 3) {
      const bandW = Math.min(820, w * .50), bandH = 98, bx = (w - bandW) / 2, by = h - bandH - 18;
      ctx.fillStyle = 'rgba(17,21,27,.94)'; ctx.beginPath(); ctx.roundRect(bx, by, bandW, bandH, 22); ctx.fill();
      const ox = bx + 150, oy = by + bandH / 2;
      circle(ctx, ox, oy, 11, '#fff', 1);
      miniArrow(ctx, ox, oy - 15, 125, 0, C.blue, .95, 7);
      miniArrow(ctx, ox, oy + 15, -72, 0, C.orange, .95, 7);
      ctx.fillStyle = '#fff'; ctx.font = '800 21px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('−', ox + 166, oy + 7);
      miniArrow(ctx, ox + 205, oy, 190, 0, C.violet, .98, 9);
      ctx.fillStyle = '#bcaeff'; ctx.font = '750 17px "JetBrains Mono", monospace'; ctx.fillText('blue slope − orange slope = drift', bx + bandW * .68, by + 23);
    }
  }

  function drawPaperTitle(now) {
    const canvas = document.getElementById('paper-title-field');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h); drawGrid(ctx, w, h, 54);
    const t = now / 1000;
    const pCenters = [
      [.34 + Math.sin(t * .52) * .012, .31 + Math.cos(t * .43) * .010],
      [.68 + Math.cos(t * .46) * .013, .36 + Math.sin(t * .39) * .011],
      [.58 + Math.sin(t * .41 + 1.2) * .012, .72 + Math.cos(t * .48) * .010],
    ];
    const qCenters = [
      [.30 + Math.cos(t * .45 + .8) * .014, .52 + Math.sin(t * .40) * .012],
      [.62 + Math.sin(t * .49 + .4) * .014, .58 + Math.cos(t * .37) * .012],
    ];
    drawMixtureCloud(ctx, w, h, pCenters, C.blue, 260309936, 72, .30);
    drawMixtureCloud(ctx, w, h, qCenters, C.orange, 260309937, 62, .28);
    const pulse = .78 + .18 * Math.sin(now / 600);
    for (let gy = .14; gy <= .86; gy += .105) {
      for (let gx = .12; gx <= .88; gx += .105) {
        const sp = mixtureScore(gx, gy, pCenters, .21);
        const sq = mixtureScore(gx, gy, qCenters, .21);
        const net = scaledVector([sp[0] - sq[0], sp[1] - sq[1]], 24 * pulse);
        miniArrow(ctx, gx * w, gy * h, net[0], net[1], C.violet, .55, 2.2);
      }
    }
    const px = .5 + Math.cos(t * .62) * .26;
    const py = .5 + Math.sin(t * .83) * .22;
    const sp = mixtureScore(px, py, pCenters, .21);
    const sq = mixtureScore(px, py, qCenters, .21);
    const probeVector = scaledVector([sp[0] - sq[0], sp[1] - sq[1]], 54);
    circle(ctx, px * w, py * h, 25 + 5 * pulse, C.violet, .10);
    circle(ctx, px * w, py * h, 10, C.white, 1, C.violet, 4);
    miniArrow(ctx, px * w, py * h, probeVector[0], probeVector[1], C.violet, .95, 5);
  }

  function drawScoreField(now) {
    const canvas = document.getElementById('score-field-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 58);
    const pCenters = [[.65, .31], [.73, .66]];
    const qCenters = [[.31, .43], [.51, .70]];
    drawMixtureCloud(ctx, w, h, pCenters, C.blue, 331, 96, .36);
    drawMixtureCloud(ctx, w, h, qCenters, C.orange, 332, 86, .34);
    const pulse = .92 + .08 * Math.sin(now / 420);
    const final = state.scoreStep >= 3;
    for (let gy = .16; gy <= .88; gy += .105) {
      for (let gx = .09; gx <= .91; gx += .075) {
        const sp = mixtureScore(gx, gy, pCenters, .19);
        const sq = mixtureScore(gx, gy, qCenters, .19);
        const vp = scaledVector(sp, 25 * pulse);
        const vq = scaledVector(sq, 25 * pulse);
        const vn = scaledVector([sp[0] - sq[0], sp[1] - sq[1]], 31 * pulse);
        if (state.scoreStep >= 1) miniArrow(ctx, gx * w, gy * h, vp[0], vp[1], C.blue, final ? .12 : .55, final ? 1.2 : 2);
        if (state.scoreStep >= 2) miniArrow(ctx, gx * w, gy * h, vq[0], vq[1], C.orange, final ? .12 : .52, final ? 1.2 : 2);
        if (final) miniArrow(ctx, gx * w, gy * h, vn[0], vn[1], C.violet, .78, 2.8);
      }
    }
    ctx.save(); ctx.font = '700 17px "JetBrains Mono", monospace';
    ctx.fillStyle = C.blue; ctx.fillText('pσ · data', w * .73, h * .12);
    ctx.fillStyle = C.orange; ctx.fillText('qσ · model', w * .24, h * .12); ctx.restore();
  }

  function wavePath(ctx, x0, y0, width, amplitude, cycles, color, alpha = 1, lineWidth = 4, phase = 0) {
    ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = lineWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 180; i++) {
      const t = i / 180;
      const x = x0 + t * width;
      const y = y0 + Math.sin(t * Math.PI * 2 * cycles + phase) * amplitude;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.restore();
  }

  function drawSpectralModes(now) {
    const canvas = document.getElementById('spectral-modes-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 64);
    const left = w * .12, right = w * .82, width = right - left, centerY = h * .52;
    const rows = [h * .25, h * .51, h * .77], cycles = [1, 3, 8];
    const amplitudes = [h * .13, h * .085, h * .045];
    const colors = [C.blue, C.violet, C.orange];
    const names = ['coarse', 'medium', 'fine'];
    const split = state.spectralStep === 1 ? ease(clamp((now - state.fragmentAt) / 760, 0, 1)) : state.spectralStep >= 2 ? 1 : 0;
    const sumAt = (u) => cycles.reduce((sum, cycle, index) => sum + Math.sin(u * Math.PI * 2 * cycle + index * .45) * amplitudes[index], 0);

    ctx.strokeStyle = 'rgba(17,21,27,.16)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(left, centerY); ctx.lineTo(right, centerY); ctx.stroke();
    if (split < .98) {
      ctx.save(); ctx.globalAlpha = 1 - split; ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      for (let i = 0; i <= 220; i++) { const u = i / 220, x = lerp(left, right, u), y = centerY + sumAt(u); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke(); ctx.fillStyle = C.ink; ctx.font = '800 19px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText('one visible residual  δ = q − p', (left + right) / 2, h * .16); ctx.restore();
    }

    for (let i = 0; i < 3; i++) {
      if (split <= .01) continue;
      const y = lerp(centerY, rows[i], split);
      ctx.strokeStyle = 'rgba(17,21,27,.14)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      wavePath(ctx, left, y, width, amplitudes[i], cycles[i], colors[i], split, 6, i * .45);
      ctx.fillStyle = colors[i]; ctx.font = '800 17px "JetBrains Mono", monospace'; ctx.textAlign = 'right'; ctx.fillText(names[i], left - 25, y + 6);
      if (state.spectralStep >= 2) {
        const cx = w * .91, cy = y, r = 33;
        circle(ctx, cx, cy, r, '#fff', 1, colors[i], 4);
        ctx.strokeStyle = colors[i]; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(now / 900 + i) * r * .66, cy + Math.sin(now / 900 + i) * r * .66); ctx.stroke();
        circle(ctx, cx, cy, 5, colors[i]);
        ctx.fillStyle = colors[i]; ctx.font = '750 14px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(`λκ(k${i + 1})`, cx, cy + 55);
      }
    }
    if (state.spectralStep >= 2) {
      ctx.fillStyle = C.violet; ctx.font = '800 18px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText('the kernel sets every clock speed', w * .52, h * .10);
    }
  }

  function chartAxes(ctx, w, h, pad) {
    ctx.save(); ctx.strokeStyle = 'rgba(17,21,27,.16)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, h - pad.b); ctx.lineTo(w - pad.r, h - pad.b); ctx.stroke();
    for (let i = 0; i <= 5; i++) {
      const yy = pad.t + i / 5 * (h - pad.t - pad.b);
      ctx.strokeStyle = 'rgba(17,21,27,.07)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    }
    ctx.restore();
  }

  function drawKernelSpectrum(now) {
    const canvas = document.getElementById('kernel-spectrum-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 62);
    const pad = { l: 115, r: 65, t: 52, b: 82 }, sigma = .32, kMax = 12;
    const x = (k) => pad.l + k / kMax * (w - pad.l - pad.r), y = (rate) => h - pad.b - rate * (h - pad.t - pad.b);
    const raw = (k) => (sigma * k) ** 2 * Math.exp(-.5 * (sigma * k) ** 2);
    const peakRate = 2 / Math.E, rate = (k) => raw(k) / peakRate;
    const peak = Math.sqrt(2) / sigma;
    ctx.strokeStyle = 'rgba(17,21,27,.22)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, h - pad.b); ctx.lineTo(w - pad.r, h - pad.b); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.font = '700 15px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText('update strength  λσ(k)', pad.l, 32); ctx.textAlign = 'right'; ctx.fillText('frequency  ·  coarse  →  fine', w - pad.r, h - 25);
    const reveal = state.spectrumStep === 1 ? ease(clamp((now - state.fragmentAt) / 850, 0, 1)) : state.spectrumStep >= 1 ? 1 : 0;
    if (reveal > 0) {
      const lo = x(peak * .72), hi = x(peak * 1.34), grad = ctx.createLinearGradient(lo, 0, hi, 0);
      grad.addColorStop(0, 'rgba(223,100,47,0)'); grad.addColorStop(.5, 'rgba(223,100,47,.16)'); grad.addColorStop(1, 'rgba(223,100,47,0)');
      ctx.fillStyle = grad; ctx.fillRect(lo, pad.t, hi - lo, h - pad.t - pad.b);
      ctx.strokeStyle = C.orange; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      const count = Math.max(2, Math.floor(220 * reveal));
      for (let i = 0; i <= count; i++) { const k = i / 220 * kMax; if (i === 0) ctx.moveTo(x(k), y(rate(k))); else ctx.lineTo(x(k), y(rate(k))); } ctx.stroke();
      circle(ctx, x(peak), y(1), 11, C.orange, 1, '#fff', 4);
      ctx.fillStyle = C.orange; ctx.font = '800 18px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('sweet spot  k* = √2 / σ', x(peak), y(1) - 30);
    }
    if (state.spectrumStep >= 2) {
      const fineK = 10.2, fineRate = rate(fineK);
      ctx.fillStyle = 'rgba(213,46,87,.06)'; ctx.fillRect(x(7.3), pad.t, x(kMax) - x(7.3), h - pad.t - pad.b);
      circle(ctx, x(fineK), y(fineRate), 10, C.red, 1, '#fff', 4);
      ctx.strokeStyle = C.red; ctx.lineWidth = 3; ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.moveTo(x(fineK), y(fineRate)); ctx.lineTo(x(fineK), h - pad.b); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.red; ctx.font = '800 18px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('positive—but exponentially tiny', x(fineK) - 70, y(fineRate) - 35);
    }
    if (state.spectrumStep >= 3) {
      const laplace = (k) => .9 * (1 - Math.exp(-k * .9)) / (1 + .06 * k);
      ctx.strokeStyle = C.green; ctx.lineWidth = 5; ctx.setLineDash([12, 9]); ctx.beginPath();
      for (let i = 0; i <= 220; i++) { const k = i / 220 * kMax; if (i === 0) ctx.moveTo(x(k), y(laplace(k))); else ctx.lineTo(x(k), y(laplace(k))); } ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.green; ctx.font = '800 17px "JetBrains Mono", monospace'; ctx.textAlign = 'right'; ctx.fillText('Laplacian · heavier tail', x(11.6), y(laplace(11.6)) - 18);
    }
  }

  function drawAnnealing(now) {
    const canvas = document.getElementById('annealing-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 62);
    const pad = { l: 110, r: 70, t: 75, b: 80 }, kMax = 12;
    const centers = [3.0, 6.0, 9.4], labels = ['large σ', 'medium σ', 'small σ'];
    const stage = clamp(state.annealStep, 0, 2), progress = ease(clamp((now - state.fragmentAt) / 800, 0, 1));
    const from = centers[Math.max(0, stage - 1)], to = centers[stage], center = stage === 0 ? to : lerp(from, to, progress);
    const x = (k) => pad.l + k / kMax * (w - pad.l - pad.r), y = (v) => h - pad.b - v * (h - pad.t - pad.b);
    const rate = (k) => { const r = k / center; return r * r * Math.exp(1 - r * r); };
    ctx.strokeStyle = 'rgba(17,21,27,.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, h - pad.b); ctx.lineTo(w - pad.r, h - pad.b); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.font = '700 15px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText('update strength', pad.l, 42); ctx.textAlign = 'right'; ctx.fillText('frequency  ·  coarse  →  fine', w - pad.r, h - 25);
    ctx.fillStyle = 'rgba(22,138,82,.08)'; ctx.fillRect(pad.l, pad.t, Math.max(0, x(center * .72) - pad.l), h - pad.t - pad.b);
    const lo = x(center * .72), hi = x(Math.min(kMax, center * 1.32)), grad = ctx.createLinearGradient(lo, 0, hi, 0);
    grad.addColorStop(0, 'rgba(223,100,47,0)'); grad.addColorStop(.5, 'rgba(223,100,47,.19)'); grad.addColorStop(1, 'rgba(223,100,47,0)'); ctx.fillStyle = grad; ctx.fillRect(lo, pad.t, hi - lo, h - pad.t - pad.b);
    ctx.strokeStyle = C.orange; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let i = 0; i <= 240; i++) { const k = i / 240 * kMax; if (i === 0) ctx.moveTo(x(k), y(rate(k))); else ctx.lineTo(x(k), y(rate(k))); } ctx.stroke();
    circle(ctx, x(center), y(1), 12, C.orange, 1, '#fff', 4);
    ctx.strokeStyle = C.orange; ctx.lineWidth = 3; ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.moveTo(x(center), y(1)); ctx.lineTo(x(center), h - pad.b); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.orange; ctx.font = '800 21px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(`${labels[stage]}  →  k* moves right`, x(center), y(1) - 34);
    [['shape', 2.4, C.blue], ['structure', 5.8, C.violet], ['texture', 9.5, C.orange]].forEach(([name, k, color]) => {
      const learned = Number(k) < center * .78;
      circle(ctx, x(Number(k)), h - pad.b + 25, 10, learned ? C.green : String(color), learned ? .94 : .55, '#fff', 3);
      ctx.fillStyle = learned ? C.green : String(color); ctx.font = '750 14px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(learned ? `${name} ✓` : String(name), x(Number(k)), h - pad.b + 55);
    });
  }

  function drawAntisymmetryRecipe(now) {
    const canvas = document.getElementById('antisymmetry-recipe-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 62);
    const step = state.antisymmetryRecipeStep, progress = ease(clamp((now - state.fragmentAt) / 650, 0, 1));
    let angle = 0;
    if (step === 1) angle = lerp(0, -.13, progress);
    if (step === 2) angle = lerp(-.13, .13, progress);
    if (step >= 3) angle = .13 * (1 - progress);
    const cx = w * .5, cy = h * .58, beam = w * .55;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-beam / 2, 0); ctx.lineTo(beam / 2, 0); ctx.stroke();
    const drawWeight = (x, color, label, scale) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x - 100 * scale, -135 * scale, 200 * scale, 105 * scale, 22); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${20 * scale}px "JetBrains Mono", monospace`; ctx.textAlign = 'center'; ctx.fillText(label, x, -77 * scale);
      ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, -28); ctx.lineTo(x, 0); ctx.stroke();
    };
    drawWeight(-beam * .36, C.blue, step === 1 ? '1.5 × V⁺' : '1.0 × V⁺', step === 1 ? 1.12 : 1);
    drawWeight(beam * .36, C.orange, step === 2 ? '1.5 × V⁻' : '1.0 × V⁻', step === 2 ? 1.12 : 1);
    ctx.restore();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(cx, cy + 5); ctx.lineTo(cx - 55, cy + 115); ctx.lineTo(cx + 55, cy + 115); ctx.closePath(); ctx.fill();
    ctx.fillStyle = step === 0 ? C.green : step < 3 ? C.red : C.violet; ctx.font = '800 21px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(step === 0 ? 'one hand-tuned balance' : step < 3 ? 'small coefficient change → large failure' : 'what objective should define the balance?', cx, h * .18);
    if (step >= 3) { ctx.fillStyle = C.violet; ctx.font = '800 110px Inter, sans-serif'; ctx.fillText('?', w * .84, h * .48); }
  }

  function drawRecipeEnergy(now) {
    const canvas = document.getElementById('recipe-energy-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 58);
    const step = state.recipeEnergyStep, progress = ease(clamp((now - state.fragmentAt) / 850, 0, 1));
    const levels = [0, .55, 1], from = levels[Math.max(0, step - 1)], to = levels[Math.min(step, 2)], match = step === 0 ? 0 : lerp(from, to, progress);
    const targets = [[.28,.31],[.69,.34],[.52,.72]], starts = [[.18,.67],[.43,.26],[.78,.70]];
    targets.forEach(([tx, ty]) => circle(ctx, tx * w, ty * h, 54, C.blueSoft, .45, C.blue, 3));
    const rand = mulberry32(460046);
    for (let i = 0; i < 72; i++) {
      const target = targets[i % targets.length], start = starts[i % starts.length];
      const jx = gaussian(rand) * .035, jy = gaussian(rand) * .045;
      const x0 = (start[0] + jx) * w, y0 = (start[1] + jy) * h, x1 = (target[0] + jx) * w, y1 = (target[1] + jy) * h;
      circle(ctx, lerp(x0, x1, match), lerp(y0, y1, match), 6, C.orange, .58, '#fff', 1.5);
    }
    const gaugeX = w * .11, gaugeY = h * .10, gaugeW = w * .58, gaugeH = 74, value = Math.max(0, .82 * (1 - match));
    ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.beginPath(); ctx.roundRect(gaugeX, gaugeY, gaugeW, gaugeH, 18); ctx.fill();
    ctx.fillStyle = 'rgba(17,21,27,.10)'; ctx.beginPath(); ctx.roundRect(gaugeX + 18, gaugeY + 42, gaugeW - 150, 14, 7); ctx.fill();
    ctx.fillStyle = value < .02 ? C.green : C.orange; ctx.beginPath(); ctx.roundRect(gaugeX + 18, gaugeY + 42, (gaugeW - 150) * value / .82, 14, 7); ctx.fill();
    ctx.fillStyle = value < .02 ? C.green : C.ink; ctx.font = '800 19px "JetBrains Mono", monospace'; ctx.textAlign = 'right'; ctx.fillText(`F[q,p] = ${value.toFixed(2)}`, gaugeX + gaugeW - 18, gaugeY + 53);
    ctx.fillStyle = C.blue; ctx.font = '800 16px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText('data p', 28, h - 30);
    ctx.fillStyle = C.orange; ctx.fillText('model q', 130, h - 30);
    if (match > .97) { ctx.fillStyle = C.green; ctx.font = '800 22px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('the meter clicks to zero only at q = p', w * .5, h * .90); }
  }

  function drawOTIntro(now) {
    const canvas = document.getElementById('ot-intro-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 58);
    const source = [[.16,.22],[.25,.30],[.13,.39],[.28,.48],[.16,.58],[.27,.67],[.12,.76],[.24,.84]];
    const target = [[.73,.18],[.85,.27],[.70,.37],[.84,.46],[.72,.57],[.86,.66],[.70,.76],[.83,.84]];
    const crossed = [5,0,6,2,7,1,4,3];
    const raw = ((now - state.enteredAt) % 8200) / 8200;
    const blend = raw < .18 ? 0 : raw < .48 ? ease((raw - .18) / .30) : raw < .78 ? 1 : 1 - ease((raw - .78) / .22);
    const endpoints = source.map((_, i) => [
      lerp(target[crossed[i]][0], target[i][0], blend),
      lerp(target[crossed[i]][1], target[i][1], blend),
    ]);
    let work = 0;

    source.forEach(([sx, sy], i) => {
      const [tx, ty] = endpoints[i];
      work += Math.hypot(tx - sx, ty - sy);
      ctx.save();
      ctx.strokeStyle = blend > .72 ? C.green : C.violet;
      ctx.globalAlpha = .18 + blend * .34;
      ctx.lineWidth = 3 + blend * 2;
      ctx.beginPath(); ctx.moveTo(sx * w, sy * h); ctx.lineTo(tx * w, ty * h); ctx.stroke();
      ctx.restore();
      const travel = ((now / 1500) + i * .14) % 1;
      circle(ctx, lerp(sx, tx, travel) * w, lerp(sy, ty, travel) * h, 5.5, blend > .72 ? C.green : C.violet, .82, '#fff', 1.5);
    });

    source.forEach(([x, y]) => circle(ctx, x * w, y * h, 14, C.orange, .9, '#fff', 3));
    target.forEach(([x, y]) => circle(ctx, x * w, y * h, 18, C.blueSoft, .95, C.blue, 4));

    const pillW = 430, pillH = 66, px = (w - pillW) / 2, py = 22;
    ctx.fillStyle = blend > .72 ? 'rgba(22,138,82,.94)' : 'rgba(17,21,27,.92)';
    ctx.beginPath(); ctx.roundRect(px, py, pillW, pillH, 18); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '750 19px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(blend > .72 ? 'least-work plan' : 'one possible plan', w / 2, py + 28);
    ctx.font = '650 15px "JetBrains Mono", monospace'; ctx.globalAlpha = .72;
    ctx.fillText(`total travel  ${work.toFixed(2)}`, w / 2, py + 51); ctx.globalAlpha = 1;

    ctx.fillStyle = C.orange; ctx.font = '800 18px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText('model mass q', 28, h - 28);
    ctx.fillStyle = C.blue; ctx.textAlign = 'right'; ctx.fillText('data mass p', w - 28, h - 28);
  }

  function drawSinkhornIntro(now) {
    const canvas = document.getElementById('sinkhorn-intro-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 58);
    const n = 6;
    const size = Math.min(w * .66, h * .69);
    const cell = size / n, mx = (w - size) / 2 + 18, my = h * .18;
    const elapsed = now - state.enteredAt;
    const rowPhase = Math.floor(elapsed / 3600) % 2 === 0;
    const active = Math.floor((elapsed % 3600) / (3600 / n));
    const pulse = .82 + .18 * Math.sin(now / 260);

    for (let i = 0; i < n; i++) {
      const cy = my + (i + .5) * cell;
      const cx = mx + (i + .5) * cell;
      circle(ctx, mx - 34, cy, 10, C.orange, .85, '#fff', 2);
      circle(ctx, cx, my - 34, 11, C.blue, .78, '#fff', 2);
    }

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const distance = Math.abs(r - c) + .35 * Math.abs((r % 2) - (c % 2));
        const weight = Math.exp(-distance * .72);
        const selected = rowPhase ? r === active : c === active;
        const x = mx + c * cell, y = my + r * cell;
        ctx.fillStyle = `rgba(22,138,82,${.07 + weight * .72 * (selected ? pulse : .76)})`;
        ctx.beginPath(); ctx.roundRect(x + 5, y + 5, cell - 10, cell - 10, 12); ctx.fill();
        if (selected) {
          ctx.strokeStyle = rowPhase ? C.orange : C.blue; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.roundRect(x + 5, y + 5, cell - 10, cell - 10, 12); ctx.stroke();
        }
      }
    }

    const pillW = 470, pillH = 70, px = (w - pillW) / 2, py = 20;
    ctx.fillStyle = rowPhase ? 'rgba(223,100,47,.94)' : 'rgba(47,111,224,.94)';
    ctx.beginPath(); ctx.roundRect(px, py, pillW, pillH, 18); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '800 20px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(rowPhase ? 'normalize source rows' : 'normalize target columns', w / 2, py + 31);
    ctx.font = '650 14px "JetBrains Mono", monospace'; ctx.globalAlpha = .78;
    ctx.fillText('alternate · repeat · balance', w / 2, py + 55); ctx.globalAlpha = 1;

    ctx.fillStyle = C.orange; ctx.font = '800 16px "JetBrains Mono", monospace'; ctx.textAlign = 'right'; ctx.fillText('q', mx - 58, my + size / 2 + 6);
    ctx.fillStyle = C.blue; ctx.textAlign = 'center'; ctx.fillText('p', mx + size / 2, my - 55);
    ctx.fillStyle = C.green; ctx.font = '750 17px "JetBrains Mono", monospace';
    ctx.fillText('brighter cell = more transported mass', w / 2, h - 28);
  }

  function drawSinkhornForce(now) {
    const canvas = document.getElementById('sinkhorn-force-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff'); drawGrid(ctx, w, h, 58);
    const rand = mulberry32(480048), pCenters = [[.70,.28],[.76,.68]], qCenters = [[.35,.42],[.43,.70]];
    drawMixtureCloud(ctx, w, h, pCenters, C.blue, 4801, 60, .35);
    drawMixtureCloud(ctx, w, h, qCenters, C.orange, 4802, 58, .34);
    const x = [w * .42, h * .57], toData = [w * .70, h * .35], toSelf = [w * .34, h * .62];
    circle(ctx, x[0], x[1], 15, C.ink, 1, '#fff', 5);
    ctx.fillStyle = C.ink; ctx.font = '800 18px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('x', x[0], x[1] - 28);
    const hasBuild = state.currentSlide.querySelector('.sinkhorn-recipe-story .fragment');
    const autoElapsed = now - state.enteredAt;
    const step = hasBuild ? state.sinkhornForceStep : Math.min(3, 1 + Math.floor(autoElapsed / 1150));
    const stepStartedAt = hasBuild ? state.fragmentAt : state.enteredAt + Math.max(0, step - 1) * 1150;
    const progress = ease(clamp((now - stepStartedAt) / 700, 0, 1));
    if (step >= 1) {
      arrow(ctx, x[0], x[1], lerp(x[0], toData[0], progress), lerp(x[1], toData[1], progress), C.blue, 9, .94);
      ctx.fillStyle = C.blue; ctx.font = '800 16px "JetBrains Mono", monospace'; ctx.fillText('cross-transport', (x[0] + toData[0]) / 2, (x[1] + toData[1]) / 2 - 28);
    }
    if (step >= 2) {
      arrow(ctx, x[0], x[1], lerp(x[0], toSelf[0], progress), lerp(x[1], toSelf[1], progress), C.orange, 9, .92);
      ctx.fillStyle = C.orange; ctx.textAlign = 'right'; ctx.fillText('self-transport', toSelf[0] - 15, toSelf[1] + 4);
    }
    if (step >= 3) {
      const result = [x[0] + (toData[0] - toSelf[0]), x[1] + (toData[1] - toSelf[1])];
      ctx.globalAlpha = .18; arrow(ctx, x[0], x[1], toData[0], toData[1], C.blue, 7, 1); arrow(ctx, x[0], x[1], toSelf[0], toSelf[1], C.orange, 7, 1); ctx.globalAlpha = 1;
      arrow(ctx, x[0], x[1], lerp(x[0], result[0], progress), lerp(x[1], result[1], progress), C.violet, 12, .98);
      ctx.fillStyle = C.violet; ctx.font = '800 18px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('derived Sinkhorn drift', (x[0] + result[0]) / 2, (x[1] + result[1]) / 2 - 36);
    }
    ctx.fillStyle = C.blue; ctx.font = '800 17px "JetBrains Mono", monospace'; ctx.textAlign = 'right'; ctx.fillText('data p', w - 28, 38);
    ctx.fillStyle = C.orange; ctx.textAlign = 'left'; ctx.fillText('model q', 28, 38);
  }

  function drawWasserstein(now) {
    const canvas = document.getElementById('wasserstein-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h); drawGrid(ctx, w, h, 62);
    const E = (t) => .17 + .58 * (t - .74) ** 2 + .035 * Math.sin(t * Math.PI * 4) * (1 - t);
    const x = (t) => 55 + t * (w - 110), y = (e) => h - 85 - e * (h - 170);
    ctx.save(); ctx.strokeStyle = C.violet; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i <= 220; i++) { const t = i / 220; if (i === 0) ctx.moveTo(x(t), y(E(t))); else ctx.lineTo(x(t), y(E(t))); } ctx.stroke(); ctx.restore();
    const moving = state.wassersteinStep >= 2;
    const progress = moving ? ease(clamp((now - state.fragmentAt) / 5200, 0, 1)) : 0;
    const pos = lerp(.18, .74, progress);
    const rand = mulberry32(3939);
    for (let i = 0; i < 42; i++) {
      const px = x(pos) + gaussian(rand) * 25;
      const py = y(E(pos)) - 28 - Math.abs(gaussian(rand)) * 18;
      circle(ctx, px, py, 5.2, C.orange, .65);
    }
    circle(ctx, x(pos), y(E(pos)) - 28, 22, C.orange, .95, '#fff', 5);
    circle(ctx, x(.74), y(E(.74)) - 28, 34, null, .8, C.green, 5);
    ctx.fillStyle = C.green; ctx.font = '700 17px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('p · minimum', x(.74), y(E(.74)) + 40);
    if (moving) arrow(ctx, x(pos) - 10, y(E(pos)) - 78, x(Math.min(.74, pos + .09)), y(E(Math.min(.74, pos + .09))) - 48, C.violet, 5, .8, '−grad F');
  }

  function drawChartCurve(ctx, points, x, y, color, width, dash, progress) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); const count = Math.max(2, Math.floor(points.length * progress));
    for (let i = 0; i < count; i++) { const [px, py] = points[i]; if (i === 0) ctx.moveTo(x(px), y(py)); else ctx.lineTo(x(px), y(py)); } ctx.stroke(); ctx.restore();
  }

  function drawDriftCollapse(now) {
    const canvas = document.getElementById('drift-collapse-demo');
    const s = sizeCanvas(canvas); if (!s) return;
    const { ctx, w, h } = s; clear(ctx, w, h, '#fff');
    const pad = { l: 115, r: 60, t: 45, b: 70 }; chartAxes(ctx, w, h, pad);
    const x = (t) => pad.l + t * (w - pad.l - pad.r);
    const y = (v) => pad.t + (-Math.log10(clamp(v, 1e-9, 1)) / 9) * (h - pad.t - pad.b);
    ctx.fillStyle = C.muted; ctx.font = '600 14px "JetBrains Mono", monospace'; ctx.textAlign = 'right';
    for (let i = 0; i <= 8; i += 2) ctx.fillText(i === 0 ? '1' : `10^−${i}`, pad.l - 18, y(10 ** -i) + 5);
    ctx.textAlign = 'center'; ctx.fillText('training →', w / 2, h - 20);
    const points = Array.from({ length: 220 }, (_, i) => i / 219);
    const withDrift = points.map((t) => [t, 1.0 * Math.exp(-6.1 * t) + .0012]);
    const withErr = points.map((t) => [t, .82 * Math.exp(-5.0 * t) + .008]);
    const noDrift = points.map((t) => [t, .011 * Math.exp(-14.5 * t) + 1e-8]);
    const noErr = points.map((t) => [t, .389 + .47 * Math.exp(-11 * t)]);
    const progress = clamp((now - state.fragmentAt) / 1400, 0, 1);
    if (state.collapseStep >= 1) {
      drawChartCurve(ctx, withDrift, x, y, C.green, 6, null, progress);
      drawChartCurve(ctx, withErr, x, y, C.blue, 6, null, progress);
    }
    if (state.collapseStep >= 2) {
      drawChartCurve(ctx, noDrift, x, y, C.red, 6, [12, 9], progress);
      drawChartCurve(ctx, noErr, x, y, C.orange, 6, [12, 9], progress);
      if (progress > .85) {
        ctx.fillStyle = C.red; ctx.textAlign = 'right'; ctx.font = '700 17px "JetBrains Mono", monospace'; ctx.fillText('10⁻⁸', x(.98), y(1e-8) - 14);
        ctx.fillStyle = C.orange; ctx.fillText('W₂ = .389', x(.98), y(.389) - 14);
      }
    }
  }

  function updateSteps() {
    if (!state.currentSlide) return;
    state.forceStep = state.currentSlide.querySelectorAll('.force-step.visible').length;
    state.pfStep = state.currentSlide.querySelectorAll('.pf-step.visible').length;
    state.eqStep = state.currentSlide.querySelectorAll('.eq-step.visible').length;
    state.featureStep = state.currentSlide.querySelectorAll('.feature-geometry-step.visible').length;
    state.bandwidthStep = state.currentSlide.querySelectorAll('.bandwidth-step.visible').length;
    state.scoreStep = state.currentSlide.querySelectorAll('.score-step.visible').length;
    state.spectralStep = state.currentSlide.querySelectorAll('.spectral-step.visible').length;
    state.spectrumStep = state.currentSlide.querySelectorAll('.spectrum-step.visible').length;
    state.annealStep = state.currentSlide.querySelectorAll('.anneal-step.visible').length;
    state.wassersteinStep = state.currentSlide.querySelectorAll('.w-story-step.visible').length;
    state.collapseStep = state.currentSlide.querySelectorAll('.collapse-step.visible').length;
    state.spotlightStep = state.currentSlide.querySelectorAll('.spotlight-step.visible').length;
    state.gaussianProofStep = state.currentSlide.querySelectorAll('.gaussian-proof-step.visible').length;
    state.gaussianIntroStep = state.currentSlide.querySelectorAll('.gaussian-intro-step.visible').length;
    state.gaussianBlurStep = state.currentSlide.querySelectorAll('.gaussian-blur-step.visible').length;
    state.singleScoreStep = state.currentSlide.querySelectorAll('.single-score-step.visible').length;
    state.scoreSubtractionStep = state.currentSlide.querySelectorAll('.score-subtraction-step.visible').length;
    state.driftTeachingStep = state.currentSlide.querySelectorAll('.drift-teaching-step.visible').length;
    state.ratioProofStep = state.currentSlide.querySelectorAll('.ratio-proof-step.visible').length;
    state.injectivityStep = state.currentSlide.querySelectorAll('.injectivity-proof-step.visible').length;
    state.antisymmetryRecipeStep = state.currentSlide.querySelectorAll('.balance-score-row .fragment.visible').length;
    state.recipeEnergyStep = state.currentSlide.querySelectorAll('.recipe-energy-step.visible').length;
    state.sinkhornForceStep = state.currentSlide.querySelectorAll('.sinkhorn-recipe-story .fragment.visible').length;
  }

  function enter(slide) {
    state.currentSlide = slide;
    state.enteredAt = performance.now();
    state.fragmentAt = state.enteredAt;
    updateSteps();
    if (slide?.querySelector('#nfe-chart')) animateNfeChart();
  }

  function fragment() { state.fragmentAt = performance.now(); updateSteps(); }

  function frame(now) {
    const slide = state.currentSlide;
    if (slide) {
      if (slide.querySelector('#title-drift')) drawParticleHero(document.getElementById('title-drift'), now, false);
      if (slide.querySelector('#end-drift')) drawParticleHero(document.getElementById('end-drift'), now, true);
      if (slide.querySelector('#drift-teaching-demo')) drawDriftTeaching(now);
      if (slide.querySelector('#pushforward-demo')) drawPushforward(now);
      if (slide.querySelector('#theta-cloud')) drawTheta(now);
      if (slide.querySelector('#force-demo')) drawForce(now);
      if (slide.querySelector('#kernel-demo')) drawKernel(now);
      if (slide.querySelector('#multibandwidth-demo')) drawMultibandwidth(now);
      if (slide.querySelector('#antisym-left')) drawAntisym(document.getElementById('antisym-left'), now);
      if (slide.querySelector('#antisym-right')) drawAntisym(document.getElementById('antisym-right'), now);
      if (slide.querySelector('#equilibrium-demo')) drawEquilibrium(now);
      if (slide.querySelector('#fixedpoint-demo')) drawFixedPoint(now);
      if (slide.querySelector('.trajectory-grid')) drawTrajectories(now);
      if (slide.querySelector('#collapse-detail')) drawCollapse(now);
      if (slide.querySelector('#feature-distance-demo')) drawFeatureDistance(now);
      if (slide.querySelector('#estimator-demo')) drawEstimator(now);
      if (slide.querySelector('#paper-title-field')) drawPaperTitle(now);
      if (slide.querySelector('#score-field-demo')) drawScoreField(now);
      if (slide.querySelector('#gaussian-kernel-intro-demo')) drawGaussianKernelIntro(now);
      if (slide.querySelector('#gaussian-blur-demo')) drawGaussianBlur(now);
      if (slide.querySelector('#gaussian-single-score-demo')) drawGaussianSingleScore(now);
      if (slide.querySelector('#score-subtraction-demo')) drawScoreSubtraction(now);
      if (slide.querySelector('#ratio-flat-demo')) drawRatioFlatProof(now);
      if (slide.querySelector('#gaussian-injectivity-demo')) drawGaussianInjectivity(now);
      if (slide.querySelector('#antisymmetry-recipe-demo')) drawAntisymmetryRecipe(now);
      if (slide.querySelector('#recipe-energy-demo')) drawRecipeEnergy(now);
      if (slide.querySelector('#ot-intro-demo')) drawOTIntro(now);
      if (slide.querySelector('#sinkhorn-intro-demo')) drawSinkhornIntro(now);
      if (slide.querySelector('#sinkhorn-force-demo')) drawSinkhornForce(now);
      if (slide.querySelector('#gaussian-spotlight-demo')) drawGaussianSpotlight(now);
      if (slide.querySelector('#gaussian-proof-demo')) drawGaussianProof(now);
      if (slide.querySelector('#spectral-modes-demo')) drawSpectralModes(now);
      if (slide.querySelector('#kernel-spectrum-demo')) drawKernelSpectrum(now);
      if (slide.querySelector('#annealing-demo')) drawAnnealing(now);
      if (slide.querySelector('#wasserstein-demo')) drawWasserstein(now);
      if (slide.querySelector('#drift-collapse-demo')) drawDriftCollapse(now);
    }
    state.raf = requestAnimationFrame(frame);
  }

  function init() {
    if (state.staticReady) return;
    state.staticReady = true;
    drawStaticClouds();
    initTitleParticles(); initThetaParticles(); initForcePoints(); initKernelPoints(); initFeaturePhotos();
    initNeighborClouds(); buildNfeChart(); loadTrajectoryData();
    state.raf = requestAnimationFrame(frame);
  }

  window.DriftVisuals = { init, enter, fragment };
})();
