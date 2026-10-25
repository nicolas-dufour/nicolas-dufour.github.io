(function () {
    const canvas = document.getElementById('drifting-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Drifting on the paper's checkerboard toy, simulated offline: 500
    // samples start as a tight blob and move by the Gaussian-kernel drift
    // (mean shift towards the data minus mean shift towards the samples),
    // i.e. sigma^2 grad log(p_sigma / q_sigma), with the bandwidth sigma
    // annealed exponentially (0.8 -> 0.08), the paper's fix for the slow
    // high frequencies. The background is the smoothed target p_sigma,
    // computed exactly, so it sharpens into the checkerboard as sigma
    // shrinks; the inset plots the schedule sigma(t).
    const SRC = '/assets/publications/drifting/drift-keys.bin';
    const KEYS = 61, N = 500, STEP_PER_KEY = 8;
    const LIM = 1.25;                    // quantisation range of the samples
    const SIG0 = 0.8, SIG_MIN = 0.08, RATE = 0.02;
    function sigmaAt(key) { return Math.max(SIG_MIN, SIG0 * Math.exp(-RATE * key * STEP_PER_KEY)); }

    const PALETTES = {
        dark: { bg: '#141a24', heat: [245, 150, 70], heatMax: 0.62, glow: true, dot: '#6cb8ff', arrow: 'rgba(108,184,255,', inset: 'rgba(20,26,36,0.82)', axis: '#56627a', text: '#cbd5e1' },
        light: { bg: '#f5f7fb', heat: [230, 120, 40], heatMax: 0.45, glow: false, dot: '#1d5fd1', arrow: 'rgba(29,95,209,', inset: 'rgba(255,255,255,0.88)', axis: '#a3adbb', text: '#334155' },
    };
    let P;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() { P = isDark() ? PALETTES.dark : PALETTES.light; heatKey = ''; }
    const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    // Domain [-1.1, 1.1]^2 onto the canvas
    const DOM = 1.1, PAD = 8;
    const SCALE = (W - 2 * PAD) / (2 * DOM);
    function cx(x) { return W / 2 + x * SCALE; }
    function cy(y) { return H / 2 - y * SCALE; }

    // Timeline (seconds within one loop). Playback slows the early keys,
    // where the annealing happens, with key = (KEYS - 1) * u^1.6.
    const CYCLE = 11;
    const IN1 = 0.5, PLAY0 = 0.7, PLAY1 = 7.9, OUT0 = 10.2;

    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
    function ramp(t, a, b) { return smooth((t - a) / (b - a)); }

    // Smoothed checkerboard p_sigma: the 8 cells of side 0.5 with (i + j)
    // even, convolved with a Gaussian, is separable into erf factors.
    function erf(x) {
        const s = x < 0 ? -1 : 1;
        x = Math.abs(x);
        const t = 1 / (1 + 0.3275911 * x);
        const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
        return s * y;
    }
    function cellMass(u, a, s) {
        const k = 1 / (Math.SQRT2 * s);
        return 0.5 * (erf((a + 0.5 - u) * k) - erf((a - u) * k));
    }
    const G = 96;
    const heat = document.createElement('canvas');
    heat.width = heat.height = G;
    const heatCtx = heat.getContext('2d');
    const heatImg = heatCtx.createImageData(G, G);
    const fx = new Float32Array(4 * G), fy = new Float32Array(4 * G);
    let heatKey = '';
    function updateHeat(s) {
        const key = s.toFixed(3);
        if (key === heatKey) return;
        heatKey = key;
        for (let c = 0; c < G; c++) {
            const u = -DOM + (c + 0.5) / G * 2 * DOM;
            for (let i = 0; i < 4; i++) {
                fx[i * G + c] = cellMass(u, -1 + 0.5 * i, s);
                fy[i * G + c] = cellMass(-u, -1 + 0.5 * i, s);
            }
        }
        const d = heatImg.data, col = P.heat;
        for (let r = 0; r < G; r++) {
            for (let c = 0; c < G; c++) {
                let p = 0;
                for (let i = 0; i < 4; i++) {
                    for (let j = (i % 2); j < 4; j += 2) p += fx[i * G + c] * fy[j * G + r];
                }
                const o = (r * G + c) * 4;
                d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2];
                // Faint while blurred, strong once sharp
                d[o + 3] = Math.round(255 * P.heatMax * Math.pow(Math.min(1, p), 1.8));
            }
        }
        heatCtx.putImageData(heatImg, 0, 0);
    }

    let keys = null;
    fetch(SRC)
        .then(function (r) { return r.arrayBuffer(); })
        .then(function (buf) {
            keys = new Uint8Array(buf);
            t0 = performance.now();
        })
        .catch(function () { /* keep the smoothed target alone */ });
    function coord(k, i, a) { return keys[(k * N + i) * 2 + a] / 255 * 2 * LIM - LIM; }

    // The schedule sigma(t), drawn in the empty top-left cell
    function drawInset(key, alpha) {
        const x0 = cx(-1) + 6, y0 = cy(1) + 6, w = SCALE * 0.5 - 12, h = SCALE * 0.5 - 12;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(x0 + 8, y0);
        ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, 8);
        ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, 8);
        ctx.arcTo(x0, y0 + h, x0, y0, 8);
        ctx.arcTo(x0, y0, x0 + w, y0, 8);
        ctx.closePath();
        ctx.fillStyle = P.inset;
        ctx.fill();
        const gx = x0 + 18, gy = y0 + 8, gw = w - 26, gh = h - 20;
        const kMax = 24;                 // the plot shows the annealing part
        function px(k) { return gx + Math.min(k, kMax) / kMax * gw; }
        function py(s) { return gy + gh - s / SIG0 * gh; }
        ctx.strokeStyle = P.axis;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx, gy + gh);
        ctx.lineTo(gx + gw, gy + gh);
        ctx.stroke();
        ctx.strokeStyle = P.dot;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let k = 0; k <= kMax; k += 0.5) {
            if (k === 0) ctx.moveTo(px(k), py(sigmaAt(k)));
            else ctx.lineTo(px(k), py(sigmaAt(k)));
        }
        ctx.stroke();
        ctx.fillStyle = P.dot;
        ctx.beginPath();
        ctx.arc(px(key), py(sigmaAt(key)), 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'italic 600 17px ' + FONT;
        ctx.fillStyle = P.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('σ', x0 + 9, y0 + 14);
        ctx.globalAlpha = 1;
    }

    function drawFrame(t) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, W, H);

        const u = clamp01((t - PLAY0) / (PLAY1 - PLAY0));
        const key = keys ? (KEYS - 1) * Math.pow(u, 1.6) : 0;
        // At the end of the loop the target blurs back to sigma_0
        const out = ramp(t, OUT0, CYCLE);
        const s = sigmaAt(key) + (SIG0 - sigmaAt(key)) * out;
        updateHeat(s);
        ctx.imageSmoothingEnabled = true;
        // Additive in the dark theme so the target glows instead of browning
        if (P.glow) ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(heat, cx(-DOM), cy(DOM), 2 * DOM * SCALE, 2 * DOM * SCALE);
        ctx.globalCompositeOperation = 'source-over';

        if (keys) {
            const k0 = Math.min(KEYS - 2, Math.floor(key));
            const f = key - k0;
            const alpha = ramp(t, 0, IN1) * (1 - out);
            // Drift arrows on a subset, fading as the samples settle
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            for (let i = 0; i < N; i += 5) {
                const x = coord(k0, i, 0) + (coord(k0 + 1, i, 0) - coord(k0, i, 0)) * f;
                const y = coord(k0, i, 1) + (coord(k0 + 1, i, 1) - coord(k0, i, 1)) * f;
                const vx = coord(k0 + 1, i, 0) - coord(k0, i, 0);
                const vy = coord(k0 + 1, i, 1) - coord(k0, i, 1);
                const len = Math.hypot(vx, vy) * SCALE;
                if (len < 1.5 || u <= 0 || u >= 1) continue;
                const l = Math.min(14, len * 1.8);
                ctx.strokeStyle = P.arrow + (0.5 * alpha * Math.min(1, len / 6)) + ')';
                ctx.beginPath();
                ctx.moveTo(cx(x), cy(y));
                ctx.lineTo(cx(x) + vx * SCALE / len * l, cy(y) - vy * SCALE / len * l);
                ctx.stroke();
            }
            ctx.globalAlpha = alpha;
            ctx.fillStyle = P.dot;
            for (let i = 0; i < N; i++) {
                const x = coord(k0, i, 0) + (coord(k0 + 1, i, 0) - coord(k0, i, 0)) * f;
                const y = coord(k0, i, 1) + (coord(k0 + 1, i, 1) - coord(k0, i, 1)) * f;
                ctx.beginPath();
                ctx.arc(cx(x), cy(y), 2.7, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        drawInset(keys ? key : 0, 1 - out);
    }

    refreshPalette();
    new MutationObserver(refreshPalette).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    let t0 = performance.now();
    let animId = null;
    let visible = !document.hidden;
    let onScreen = true;
    // Pause while the thumbnail is scrolled out of view.
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            onScreen = entries[0].isIntersecting;
            if (onScreen && visible) start();
        }, { rootMargin: '100px' }).observe(canvas);
    }

    function draw(now) {
        // The first rAF timestamp can precede t0, so clamp to keep idx >= 0.
        const elapsed = Math.max(0, (now - t0) / 1000);
        drawFrame(elapsed % CYCLE);

        if (visible && onScreen) {
            animId = requestAnimationFrame(draw);
        } else {
            animId = null;
        }
    }

    function start() {
        if (animId !== null) return;
        animId = requestAnimationFrame(draw);
    }

    start();
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            visible = true;
            start();
        } else {
            visible = false;
        }
    });
})();
