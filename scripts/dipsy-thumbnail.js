(function () {
    const canvas = document.getElementById('dipsy-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // DIPSY's synthetic images fill the frame, each emerging from noise.
    // The bar below shows the dual image prompting that produced them: the
    // class's real few-shot images as positive prompt (+) and a real image
    // of a similar class as negative prompt (-). The aircraft pair is the
    // paper's own Fig. 2 example; images come from the paper's figures.
    const PALETTES = {
        dark: { bg: '#1f2633', bar: 'rgba(16,20,28,0.70)', chip: 'rgba(16,20,28,0.70)', chipText: '#ffffff', pos: '#3ddc84', neg: '#ff6b6b', badgeText: '#10141c' },
        light: { bg: '#eef2f7', bar: 'rgba(255,255,255,0.82)', chip: 'rgba(255,255,255,0.86)', chipText: '#1f2933', pos: '#16a34a', neg: '#dc2626', badgeText: '#ffffff' },
    };
    let P;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() { P = isDark() ? PALETTES.dark : PALETTES.light; }
    const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    // Atlas rows: 3 synthetic images (360 px), then 3 positive and 1 negative
    // real images (96 px). The aircraft row has a single positive image.
    const SRC = '/assets/publications/dipsy/dipsy-guidance.webp';
    const BIG = 360, SMALL = 96;
    const CLASSES = [{ pos: 1 }, { pos: 3 }, { pos: 3 }, { pos: 3 }];
    const SAMPLES = 3;

    // Layout of the prompt bar
    const BX = 12, BY = 264, BW = 336, BH = 84;
    const CARD = 60;

    // Timeline (seconds within one class)
    const GEN0 = 0.35, GEN_STEP = 1.45, GEN_DUR = 0.75;
    const CLASS_T = GEN0 + SAMPLES * GEN_STEP;
    const SWAP = 0.45;                   // prompt cards cross-fade

    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
    function ramp(t, a, b) { return smooth((t - a) / (b - a)); }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // Blocky colour noise, redrawn with a random offset for a live shimmer
    const noise = document.createElement('canvas');
    noise.width = noise.height = 128;
    (function () {
        const nctx = noise.getContext('2d');
        const img = nctx.createImageData(128, 128);
        for (let i = 0; i < 128 * 128; i++) {
            const g = 60 + Math.random() * 150;
            img.data[i * 4] = g + (Math.random() - 0.5) * 50;
            img.data[i * 4 + 1] = g + (Math.random() - 0.5) * 50;
            img.data[i * 4 + 2] = g + (Math.random() - 0.5) * 50;
            img.data[i * 4 + 3] = 255;
        }
        nctx.putImageData(img, 0, 0);
    })();
    function drawNoise(alpha) {
        if (alpha <= 0) return;
        const ox = Math.floor(Math.random() * 32), oy = Math.floor(Math.random() * 32);
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(noise, ox, oy, 96, 96, 0, 0, W, H);
        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = 1;
    }

    const atlas = new Image();
    let ready = false;
    atlas.onload = function () {
        ready = true;
        t0 = performance.now();
    };
    atlas.src = SRC;

    function drawSynthetic(c, s, alpha, scale) {
        const sc = scale || 1;
        const d = W * sc;
        ctx.globalAlpha = alpha;
        ctx.drawImage(atlas, s * BIG, c * BIG, BIG, BIG, (W - d) / 2, (H - d) / 2, d, d);
        ctx.globalAlpha = 1;
    }

    function card(c, slot, x, y, angle, frame, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x + CARD / 2, y + CARD / 2);
        ctx.rotate(angle);
        roundRect(-CARD / 2 - 3, -CARD / 2 - 3, CARD + 6, CARD + 6, 9);
        ctx.fillStyle = frame;
        ctx.fill();
        ctx.save();
        roundRect(-CARD / 2, -CARD / 2, CARD, CARD, 7);
        ctx.clip();
        ctx.drawImage(atlas, 3 * BIG + slot * SMALL, c * BIG, SMALL, SMALL, -CARD / 2, -CARD / 2, CARD, CARD);
        ctx.restore();
        ctx.restore();
    }

    function badge(x, y, color, sign, glow) {
        if (glow > 0) {
            ctx.globalAlpha = 0.45 * glow;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 13 + 9 * glow, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = P.badgeText;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 6, y);
        ctx.lineTo(x + 6, y);
        if (sign === '+') {
            ctx.moveTo(x, y - 6);
            ctx.lineTo(x, y + 6);
        }
        ctx.stroke();
    }

    // Positive fan on the left, negative card on the right
    function drawPrompts(c, alpha, glow) {
        const cy = BY + (BH - CARD) / 2;
        const n = CLASSES[c].pos;
        const fan = [[-0.12, -18], [0, 0], [0.12, 18]];
        const order = n === 1 ? [1] : [0, 2, 1];
        for (const j of order) {
            const slot = n === 1 ? 0 : j;
            card(c, slot, BX + 58 + fan[j][1] + (n === 1 ? 0 : 18), cy - (j === 1 ? 2 : 0), n === 1 ? 0 : fan[j][0], P.pos, alpha);
        }
        card(c, 3, BX + BW - CARD - 16, cy, 0, P.neg, alpha);
        ctx.globalAlpha = alpha;
        badge(BX + 26, BY + BH / 2, P.pos, '+', glow);
        badge(BX + BW - CARD - 42, BY + BH / 2, P.neg, '-', glow);
        ctx.globalAlpha = 1;
    }

    function drawFrame(elapsed) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, W, H);
        if (!ready) {
            drawNoise(0.5);
            return;
        }

        const idx = Math.floor(elapsed / CLASS_T);
        const c = idx % CLASSES.length;
        const prev = (c + CLASSES.length - 1) % CLASSES.length;
        const t = elapsed - idx * CLASS_T;

        // Current generation and its progress
        const g = Math.max(-1, Math.min(SAMPLES - 1, Math.floor((t - GEN0) / GEN_STEP)));
        const u = g < 0 ? 0 : clamp01((t - GEN0 - g * GEN_STEP) / GEN_DUR);
        // Before the first sample of a class, the last image of the previous
        // class stays up (the very first loop opens on noise)
        const before = g < 0 ? (idx === 0 ? null : [prev, SAMPLES - 1]) : (g === 0 ? (idx === 0 ? null : [prev, SAMPLES - 1]) : [c, g - 1]);
        if (g < 0) {
            if (before) drawSynthetic(before[0], before[1], 1);
            else drawNoise(1);
        } else if (u < 0.3) {
            // The previous image sinks into noise
            if (before) drawSynthetic(before[0], before[1], 1);
            drawNoise(before ? 0.9 * smooth(u / 0.3) : 1);
        } else {
            // and the new sample is denoised out of it
            const e = smooth((u - 0.3) / 0.7);
            drawSynthetic(c, g, 1, 1.04 - 0.04 * e);
            drawNoise(0.9 * (1 - e));
        }

        // Chip: these images are generated
        roundRect(12, 12, 104, 30, 15);
        ctx.fillStyle = P.chip;
        ctx.fill();
        ctx.font = '600 16px ' + FONT;
        ctx.fillStyle = P.chipText;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('synthetic', 26, 28);

        // Prompt bar; the badges glow while a sample is being generated
        roundRect(BX, BY, BW, BH, 16);
        ctx.fillStyle = P.bar;
        ctx.fill();
        const glow = g >= 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
        const swap = idx === 0 ? 1 : ramp(t, 0, SWAP);
        if (swap < 1) drawPrompts(prev, 1 - swap, 0);
        drawPrompts(c, swap, glow);
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
        drawFrame(elapsed);

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
