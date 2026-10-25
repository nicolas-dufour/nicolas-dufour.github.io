(function () {
    const canvas = document.getElementById('cfg-schedulers-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // The paper's message in one loop: the same prompt and seed are sampled
    // twice with the same total guidance, first with a static weight w, then
    // with a weight rising linearly from 0 to 2w over the sampling steps (the
    // flat line pivots about its midpoint, so the area is kept, as in the
    // paper's normalisation). A playhead walks the sampling steps while the
    // image denoises from the shared noise, coarse to fine. Images are the
    // paper's SD3 comparisons, baseline vs linear (arXiv 2404.13040).
    const PALETTES = {
        dark: { bg: '#1f2633', axis: '#5b6678', muted: '#a0aec0', warm: '#f6a04d', teal: '#4fd1c5' },
        light: { bg: '#eef2f7', axis: '#a9b4c2', muted: '#718096', warm: '#dd6b20', teal: '#2c7a7b' },
    };
    let P, BG_RGB;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() {
        P = isDark() ? PALETTES.dark : PALETTES.light;
        BG_RGB = hexToRgb(P.bg);
    }
    const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    // Atlas: one row per prompt, columns = static (baseline), linear.
    const ATLAS = '/assets/publications/guidance_schedulers/static-vs-linear.webp';
    const TW = 332, TH = 222, PROMPTS = 3;

    // Layout
    const IX = 14, IY = 14, IW = TW, IH = TH;       // image panel
    const PX0 = 50, PX1 = 336;                      // plot x range
    const PY0 = 334, PY1 = 258;                     // w = 0 and w = 2w
    const NOISE_PX = 3;                             // canvas px per noise sample

    // Timeline (seconds within one prompt)
    const SWEEP = 1.9, HOLD = 1.8, MORPH = 0.9, EXTRA = 0.5;
    const T_HOLD_S = SWEEP;
    const T_MORPH_1 = T_HOLD_S + HOLD;
    const T_SWEEP_L = T_MORPH_1 + MORPH;
    const T_HOLD_L = T_SWEEP_L + SWEEP;
    const T_MORPH_2 = T_HOLD_L + HOLD + EXTRA;
    const CYCLE = T_MORPH_2 + MORPH;

    function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function mix(hex, t, alpha) {
        const c = hexToRgb(hex);
        const r = Math.round(BG_RGB[0] + (c[0] - BG_RGB[0]) * t);
        const g = Math.round(BG_RGB[1] + (c[1] - BG_RGB[1]) * t);
        const b = Math.round(BG_RGB[2] + (c[2] - BG_RGB[2]) * t);
        return alpha === undefined ? 'rgb(' + r + ',' + g + ',' + b + ')'
            : 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }
    // Hue-space blend, so the morph passes through green, not grey
    function hsl(hex) {
        const c = hexToRgb(hex).map(function (v) { return v / 255; });
        const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]);
        const l = (mx + mn) / 2, d = mx - mn;
        let h = 0, s = 0;
        if (d > 0) {
            s = d / (1 - Math.abs(2 * l - 1));
            if (mx === c[0]) h = ((c[1] - c[2]) / d + 6) % 6;
            else if (mx === c[1]) h = (c[2] - c[0]) / d + 2;
            else h = (c[0] - c[1]) / d + 4;
        }
        return [h * 60, s * 100, l * 100];
    }
    function lerpColor(a, b, t, alpha) {
        const x = hsl(a), y = hsl(b);
        t = smooth((t - 0.3) / 0.4);
        return 'hsla(' + (x[0] + (y[0] - x[0]) * t).toFixed(1) + ',' + (x[1] + (y[1] - x[1]) * t).toFixed(1) + '%,'
            + (x[2] + (y[2] - x[2]) * t).toFixed(1) + '%,' + (alpha === undefined ? 1 : alpha) + ')';
    }
    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
    function easeSweep(x) { x = clamp01(x); return 0.5 - 0.5 * Math.cos(Math.PI * x); }
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
    function makeCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    }

    // One fixed Gaussian-ish noise image per prompt: both runs share it.
    const NW = Math.ceil(IW / NOISE_PX), NH = Math.ceil(IH / NOISE_PX);
    const noises = [];
    for (let k = 0; k < PROMPTS; k++) {
        const c = makeCanvas(NW, NH);
        const cx = c.getContext('2d');
        const data = cx.createImageData(NW, NH);
        const rnd = mulberry32(4099 + k * 7919);
        for (let i = 0; i < NW * NH; i++) {
            const g = (rnd() + rnd() + rnd() - 1.5) * 150;
            for (let ch = 0; ch < 3; ch++) {
                const v = 128 + g + (rnd() - 0.5) * 36;
                data.data[i * 4 + ch] = Math.max(0, Math.min(255, v));
            }
            data.data[i * 4 + 3] = 255;
        }
        cx.putImageData(data, 0, 0);
        noises.push(c);
    }

    // Each result as a pyramid: full tile, then halvings down to 4 px wide.
    // Upscaling a small level with smoothing gives the coarse early estimate.
    let tiles = null;
    const atlas = new Image();
    atlas.onload = function () {
        try {
            const out = [];
            for (let r = 0; r < PROMPTS; r++) {
                const row = [];
                for (let col = 0; col < 2; col++) {
                    const levels = [];
                    let c = makeCanvas(TW, TH);
                    c.getContext('2d').drawImage(atlas, col * TW, r * TH, TW, TH, 0, 0, TW, TH);
                    levels.push(c);
                    let w = TW, h = TH;
                    while (w > 5) {
                        w = Math.max(4, Math.round(w / 2));
                        h = Math.max(3, Math.round(h / 2));
                        const d = makeCanvas(w, h);
                        const dc = d.getContext('2d');
                        dc.imageSmoothingEnabled = true;
                        dc.imageSmoothingQuality = 'high';
                        dc.drawImage(c, 0, 0, w, h);
                        levels.push(d);
                        c = d;
                    }
                    row.push(levels);
                }
                out.push(row);
            }
            tiles = out;
        } catch (e) { /* stay on noise */ }
    };
    atlas.src = ATLAS;

    // Image at denoising progress s in [0, 1]: coarse-to-fine estimate,
    // blended with the shared noise. nextNoise / k cross-fade the noise.
    function drawImagePanel(prompt, col, s, nextNoise, k) {
        ctx.save();
        roundRect(IX, IY, IW, IH, 12);
        ctx.clip();
        ctx.fillStyle = '#808080';
        ctx.fillRect(IX, IY, IW, IH);
        const a = Math.pow(1 - clamp01(s), 2);
        if (tiles && a < 0.999) {
            const levels = tiles[prompt][col];
            const top = levels.length - 1;
            const L = top * (1 - Math.pow(clamp01(s), 0.55));   // 0 = sharp
            const lo = Math.floor(L), hi = Math.min(top, lo + 1);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.globalAlpha = 1;
            ctx.drawImage(levels[lo], IX, IY, IW, IH);
            if (L > lo) {
                ctx.globalAlpha = L - lo;
                ctx.drawImage(levels[hi], IX, IY, IW, IH);
            }
        }
        if (a > 0.001 || !tiles) {
            ctx.imageSmoothingEnabled = false;
            ctx.globalAlpha = tiles ? a : 1;
            ctx.drawImage(noises[prompt], IX, IY, NW * NOISE_PX, NH * NOISE_PX);
            if (nextNoise && k > 0) {
                ctx.globalAlpha = (tiles ? a : 1) * k;
                ctx.drawImage(nextNoise, IX, IY, NW * NOISE_PX, NH * NOISE_PX);
            }
            ctx.imageSmoothingEnabled = true;
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // Schedule: m = 0 static (w everywhere), m = 1 linear (0 to 2w).
    // Both pass through the midpoint, so the area under them is the same.
    function level(u, m) { return 0.5 + m * (u - 0.5); }
    function px(u) { return PX0 + u * (PX1 - PX0); }
    function py(v) { return PY0 - v * (PY0 - PY1); }

    function drawPlot(m, p, color, tick) {
        // Axes
        ctx.strokeStyle = P.axis;
        ctx.fillStyle = P.axis;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(PX0, PY1 - 10);
        ctx.lineTo(PX0, PY0);
        ctx.lineTo(PX1 + 8, PY0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(PX1 + 16, PY0);
        ctx.lineTo(PX1 + 6, PY0 - 6);
        ctx.lineTo(PX1 + 6, PY0 + 6);
        ctx.closePath();
        ctx.fill();

        ctx.font = 'italic 600 24px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = P.muted;
        ctx.fillText('w', 29, py(0.5));

        // Area accumulated up to the playhead
        if (p > 0.002) {
            ctx.beginPath();
            ctx.moveTo(px(0), PY0);
            ctx.lineTo(px(0), py(level(0, m)));
            ctx.lineTo(px(p), py(level(p, m)));
            ctx.lineTo(px(p), PY0);
            ctx.closePath();
            ctx.fillStyle = lerpColor(P.warm, P.teal, m, 0.22);
            ctx.fill();
        }

        // Ghost of the static line once the schedule tilts
        if (m > 0.01) {
            ctx.setLineDash([7, 8]);
            ctx.lineWidth = 3;
            ctx.strokeStyle = mix(P.warm, 0.55, Math.min(1, m) * 0.9);
            ctx.beginPath();
            ctx.moveTo(px(0), py(0.5));
            ctx.lineTo(px(1), py(0.5));
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Schedule
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(px(0), py(level(0, m)));
        ctx.lineTo(px(1), py(level(1, m)));
        ctx.stroke();

        // Playhead
        const hx = px(p), hy = py(level(p, m));
        ctx.fillStyle = P.bg;
        ctx.beginPath();
        ctx.arc(hx, hy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(hx, hy, 7.5, 0, Math.PI * 2);
        ctx.fill();

        // Name of the schedule, cross-faded during the morph
        ctx.font = '600 22px ' + FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        if (m < 0.99) {
            ctx.globalAlpha = 1 - smooth(m * 1.6);
            ctx.fillStyle = P.warm;
            ctx.fillText('static', PX0 + 16, PY1 + 12 - 6 * m);
        }
        if (m > 0.01) {
            ctx.globalAlpha = smooth((m - 0.35) / 0.65);
            ctx.fillStyle = P.teal;
            ctx.fillText('linear', PX0 + 16, PY1 + 12 + 6 * (1 - m));
        }
        ctx.globalAlpha = 1;
        if (tick > 0) drawTick(PX0 + 16 + ctx.measureText('linear').width + 20, PY1 + 4, tick);
    }

    // Check mark that pops in once the linear result is out
    function drawTick(cx, cy, e) {
        const s = 0.6 + 0.4 * e + 0.25 * Math.sin(Math.PI * e);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.globalAlpha = clamp01(e * 2);
        ctx.strokeStyle = P.teal;
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(-2.5, 6);
        ctx.lineTo(9, -7);
        ctx.stroke();
        ctx.restore();
    }

    function drawFrame(prompt, t) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, W, H);

        // m: schedule shape, p: playhead (= denoising progress), col: result
        let m, p, col, k = 0, tick = 0;
        if (t < T_HOLD_S) {
            m = 0; p = easeSweep(t / SWEEP); col = 0;
        } else if (t < T_MORPH_1) {
            m = 0; p = 1; col = 0;
        } else if (t < T_SWEEP_L) {
            const e = smooth((t - T_MORPH_1) / MORPH);
            m = e; p = 1 - e; col = 0;
        } else if (t < T_HOLD_L) {
            m = 1; p = easeSweep((t - T_SWEEP_L) / SWEEP); col = 1;
        } else if (t < T_MORPH_2) {
            m = 1; p = 1; col = 1;
            tick = clamp01((t - T_HOLD_L - 0.15) / 0.35);
        } else {
            const e = smooth((t - T_MORPH_2) / MORPH);
            m = 1 - e; p = 1 - e; col = 1; k = e;
            tick = 1 - clamp01(e * 2.5);
        }
        const color = lerpColor(P.warm, P.teal, m);

        drawImagePanel(prompt, col, p, k > 0 ? noises[(prompt + 1) % PROMPTS] : null, k);
        roundRect(IX, IY, IW, IH, 12);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();

        drawPlot(m, p, color, tick);
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
        const idx = Math.floor(elapsed / CYCLE);
        drawFrame(idx % PROMPTS, elapsed - idx * CYCLE);

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
