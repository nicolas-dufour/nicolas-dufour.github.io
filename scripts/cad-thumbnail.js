(function () {
    const canvas = document.getElementById('cad-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // The coherence score is CAD's knob: the paper's Figure 1 samples one
    // prompt at five coherence scores from 0 to 1. Here a slider steps
    // through them while the image shows the sample for each step; at low
    // coherence the model drifts from the prompt, at 1 it follows it.
    const PALETTES = {
        dark: { hud: 'rgba(18,18,18,0.7)', text: '#EFEFEF', muted: '#b9b9b9', track: 'rgba(255,255,255,0.26)', accent: '#4aa3ff', ring: '#ffffff' },
        light: { hud: 'rgba(255,255,255,0.86)', text: '#1f2933', muted: '#5d6878', track: 'rgba(31,41,51,0.17)', accent: '#1f6fd1', ring: '#ffffff' },
    };
    let P;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() { P = isDark() ? PALETTES.dark : PALETTES.light; }
    const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    // Atlas: one row per prompt, five 360x360 samples at coherence 0 -> 1
    const ATLAS = '/assets/publications/cad_cvpr/coherence-sweep.webp';
    const S = 360, STEPS = 5;
    const PROMPTS = [
        '“An armchair in the shape of an avocado”',
        '“a raccoon wearing an astronaut suit…”',
    ];

    // Layout
    const M = 12;                                   // HUD margin
    const HUD_H = 48, HUD_Y = H - M - HUD_H;
    const TX0 = 150, TX1 = 310, TY = HUD_Y + HUD_H / 2;  // slider track
    const PROMPT_FONT = '500 20px ' + FONT, LINE = 25;
    const WIPE_SOFT = 46;               // soft edge of the prompt hand-over

    // Timeline (seconds within one prompt)
    const CYCLE = 7.4;
    const RESET = 0.7;                  // slider back to 0, next prompt fades in
    const SWEEP0 = 1.7, STEP = 0.95, MOVE = 0.5;
    const SWEEP1 = SWEEP0 + (STEPS - 1) * STEP;
    const PROMPT_OUT0 = 6.3, PROMPT_OUT1 = 6.8;

    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
    function ramp(t, a, b) { return smooth((t - a) / (b - a)); }
    function easeInOut(x) {
        x = clamp01(x);
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
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

    const wipeCanvas = document.createElement('canvas');
    wipeCanvas.width = W;
    wipeCanvas.height = H;
    const wctx = wipeCanvas.getContext('2d');

    let ready = false;
    const atlas = new Image();
    atlas.onload = function () {
        ready = true;
        t0 = performance.now();
    };
    atlas.src = ATLAS;

    function drawSample(row, k, alpha) {
        if (alpha <= 0) return;
        ctx.globalAlpha = alpha;
        ctx.drawImage(atlas, k * S, row * S, S, S, 0, 0, W, H);
        ctx.globalAlpha = 1;
    }

    // Sample revealed from the right edge, the front at progress p
    function drawWipe(row, k, p) {
        if (p <= 0) return;
        const f = W + WIPE_SOFT - (W + 2 * WIPE_SOFT) * p;
        wctx.globalCompositeOperation = 'source-over';
        wctx.clearRect(0, 0, W, H);
        wctx.drawImage(atlas, k * S, row * S, S, S, 0, 0, W, H);
        if (p < 1) {
            const g = wctx.createLinearGradient(f - WIPE_SOFT, 0, f + WIPE_SOFT, 0);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, 'rgba(0,0,0,1)');
            wctx.globalCompositeOperation = 'destination-in';
            wctx.fillStyle = g;
            wctx.fillRect(0, 0, W, H);
            wctx.globalCompositeOperation = 'source-over';
        }
        ctx.drawImage(wipeCanvas, 0, 0);
    }

    // Slider position (0..STEPS-1) and the sample cross-fade at time t
    function sweepAt(t) {
        if (t < SWEEP0) return { pos: 0, k: 0, mixNext: 0 };
        if (t >= SWEEP1) return { pos: STEPS - 1, k: STEPS - 1, mixNext: 0 };
        const k = Math.floor((t - SWEEP0) / STEP);
        const u = clamp01((t - SWEEP0 - k * STEP) / MOVE);
        return { pos: k + easeInOut(u), k: k, mixNext: smooth((u - 0.15) / 0.7) };
    }

    // One line if it fits, else the most balanced two-line split
    function wrapLines(text, maxW) {
        if (ctx.measureText(text).width <= maxW) return [text];
        const words = text.split(' ');
        let best = null, bestW = Infinity;
        for (let i = 1; i < words.length; i++) {
            const a = words.slice(0, i).join(' ');
            const b = words.slice(i).join(' ');
            const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
            if (w < bestW) { bestW = w; best = [a, b]; }
        }
        return best;
    }

    function drawPrompt(text, alpha) {
        if (alpha <= 0.01) return;
        ctx.font = PROMPT_FONT;
        const lines = wrapLines(text, W - 2 * M - 32);
        const w = Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; })) + 32;
        const h = lines.length * LINE + 20;
        ctx.globalAlpha = alpha;
        roundRect(M, M, w, h, 14);
        ctx.fillStyle = P.hud;
        ctx.fill();
        ctx.fillStyle = P.text;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        lines.forEach(function (l, i) { ctx.fillText(l, M + 16, M + 10 + LINE * (i + 0.78)); });
        ctx.globalAlpha = 1;
    }

    function drawSlider(pos) {
        roundRect(M, HUD_Y, W - 2 * M, HUD_H, 14);
        ctx.fillStyle = P.hud;
        ctx.fill();

        ctx.font = '600 18px ' + FONT;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillStyle = P.text;
        ctx.fillText('coherence', M + 14, TY + 1);
        ctx.textAlign = 'center';
        ctx.fillStyle = P.muted;
        ctx.fillText('0', TX0 - 20, TY + 1);
        ctx.fillText('1', TX1 + 20, TY + 1);

        const x = TX0 + (TX1 - TX0) * pos / (STEPS - 1);
        ctx.lineCap = 'round';
        ctx.lineWidth = 7;
        ctx.strokeStyle = P.track;
        ctx.beginPath();
        ctx.moveTo(TX0, TY);
        ctx.lineTo(TX1, TY);
        ctx.stroke();
        ctx.strokeStyle = P.accent;
        ctx.beginPath();
        ctx.moveTo(TX0, TY);
        ctx.lineTo(Math.max(TX0 + 0.1, x), TY);
        ctx.stroke();

        // One tick per generated sample
        for (let k = 0; k < STEPS; k++) {
            const tx = TX0 + (TX1 - TX0) * k / (STEPS - 1);
            ctx.fillStyle = k <= pos + 0.01 ? P.ring : P.track;
            ctx.beginPath();
            ctx.arc(tx, TY, 3.2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = P.ring;
        ctx.beginPath();
        ctx.arc(x, TY, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = P.accent;
        ctx.beginPath();
        ctx.arc(x, TY, 8.5, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawFrame(idx, t) {
        ctx.globalAlpha = 1;
        const row = idx % PROMPTS.length;
        const prev = (idx + PROMPTS.length - 1) % PROMPTS.length;
        if (!ready) {
            ctx.fillStyle = isDark() ? '#121212' : '#f1f4f8';
            ctx.fillRect(0, 0, W, H);
            drawSlider(0);
            return;
        }

        let pos;
        let promptAlpha = 1 - ramp(t, PROMPT_OUT0, PROMPT_OUT1);
        if (t < RESET && idx > 0) {
            // Previous prompt's last sample hands over to this one's first,
            // wiped right to left as the slider returns to 0
            const r = easeInOut(t / RESET);
            drawSample(prev, STEPS - 1, 1);
            drawWipe(row, 0, r);
            pos = (STEPS - 1) * (1 - r);
            promptAlpha = ramp(t, 0.3, RESET + 0.1);
        } else {
            const s = sweepAt(t);
            drawSample(row, s.k, 1);
            if (s.mixNext > 0) drawSample(row, s.k + 1, s.mixNext);
            pos = s.pos;
            if (t < RESET) promptAlpha = 1;
        }
        drawPrompt(PROMPTS[row], promptAlpha);
        drawSlider(pos);
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
        drawFrame(idx, elapsed - idx * CYCLE);

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
