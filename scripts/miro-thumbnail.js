(function () {
    const canvas = document.getElementById('miro-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Miniature of the MIRO project page, in its palette: the reward vector
    // (7 bars, one per reward model, page colours) conditions the generator.
    // Act 1 dials every reward from low to high and the same prompt goes from
    // the low-reward output to the high-reward one, then to the guided output
    // (real images of the page's inference animation). Act 2 replays the
    // page's 7D reward random walk: real generations, with each bar showing
    // how much its reward is pushed (1 - negative target, from the CSV).
    // Each loop plays the next half of the walk.
    const PALETTES = {
        dark: {
            bg: '#0b0c10', card: '#15171c', line: '#2a2e37', fg: '#e6e6e6', accent: '#ff9a5c', glow: 0.34,
            rewards: ['#50d2c8', '#69c869', '#ff6978', '#ff96dc', '#6496ff', '#e6d250', '#c869e6'],
        },
        light: {
            bg: '#f2f3f5', card: '#ffffff', line: '#dfe2e7', fg: '#1a1a1a', accent: '#ff6b35', glow: 0.22,
            rewards: ['#26aaa0', '#46a546', '#eb5060', '#e66ebe', '#4678eb', '#cdaf1e', '#aa55d2'],
        },
    };
    let P, BG_RGB;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() {
        P = isDark() ? PALETTES.dark : PALETTES.light;
        BG_RGB = hexToRgb(P.bg);
    }
    const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    // Tiles are 256×256. Dial: low reward, high reward, guided output.
    // Walk: every 4th frame of the page's 200-frame random walk, 10 per row.
    const DIAL = { src: '/assets/publications/miro/reward-dial.webp', cols: 3 };
    const WALK = { src: '/assets/publications/miro/reward-walk.webp', cols: 10 };
    const TILE = 256;
    // Reward emphasis per walk frame (CLIP, Aesthetic, ImageReward, Pick,
    // HPSv2, VQA, SciScore), in percent.
    const WALK_E = (
        '50,50,50,50,50,50,50,54,54,39,52,50,57,65,58,57,47,60,35,60,72,64,54,44,63,32,59,84,' +
        '83,55,33,65,32,82,81,85,43,28,48,37,93,58,75,38,43,40,43,83,47,61,31,47,35,43,67,48,' +
        '56,32,56,52,31,74,44,42,15,62,53,26,79,24,38,31,54,55,11,79,17,40,43,42,53,9,71,8,' +
        '51,42,45,63,6,64,10,53,52,50,58,8,62,8,48,55,68,52,19,76,7,44,68,62,57,23,85,13,35,' +
        '66,72,68,35,88,15,32,57,58,56,29,81,26,44,58,41,40,12,71,28,59,56,40,37,20,49,40,45,' +
        '49,41,29,15,31,45,45,54,53,13,13,28,68,30,63,56,12,19,42,72,39,63,37,10,25,40,65,51,' +
        '58,42,8,17,40,59,41,51,45,16,14,50,62,35,45,44,16,9,54,57,32,43,50,36,25,52,43,33,38,' +
        '55,50,17,45,36,20,34,39,33,16,42,23,18,45,39,34,19,53,9,22,40,44,48,32,54,11,37,34,' +
        '42,52,22,69,19,48,28,49,64,11,78,31,48,39,53,57,16,82,34,50,65,39,33,12,87,23,50,83,' +
        '40,21,6,81,7,40,92,51,12,5,84,21,35,91,59,15,10,91,52,32,87,59,20,14,77,56,38,89,55,' +
        '17,16,69,63,51,92,50,30,29,64,74,56,89,48,52,28,57,86,52,62,49,45,41,47,74,56,44,57,' +
        '32,64,48,71,57,39,49,34,86,55,83,60,42,41,36,79,55,80,45,62,52,31,58,60,62,57,62,46,' +
        '42,53,58,47,58,48,45,43,55,59,44'
    ).split(',').map(function (v) { return Number(v) / 100; });
    const N_REWARDS = 7;
    const WALK_FRAMES = WALK_E.length / N_REWARDS;      // 50
    const SEG = 25;                                     // walk frames per loop

    // Layout
    const IX = 58, IY = 12, IS = 244;                   // generated image
    const BADGE_X = 180, BADGE_Y = 257, BADGE_W = 92, BADGE_H = 32;
    const PX = 14, PY = 282, PW = 332, PH = 66;         // reward panel
    const BAR_W = 28, BAR_MAX = 46, BAR_BASE = PY + PH - 10;
    const LOW = 0.1;

    // Timeline (seconds within one loop)
    const RISE0 = 0.6, STAGGER = 0.13, RISE_DUR = 0.8;
    const GUIDE0 = 2.8, GUIDE1 = 3.6;
    const IN0 = 5.0, IN1 = 5.7;
    const DT = 0.24;
    const WALK_END = IN1 + (SEG - 1) * DT;
    const OUT0 = WALK_END + 0.1, OUT1 = OUT0 + 0.8;
    const CYCLE = OUT1 + 0.2;

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
    function shade(hex, k) {
        const c = hexToRgb(hex);
        return 'rgb(' + Math.round(c[0] * k) + ',' + Math.round(c[1] * k) + ',' + Math.round(c[2] * k) + ')';
    }
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

    let pending = 2;
    [DIAL, WALK].forEach(function (atlas) {
        atlas.ready = false;
        atlas.img = new Image();
        atlas.img.onload = function () {
            atlas.ready = true;
            if (--pending === 0) t0 = performance.now();
        };
        atlas.img.src = atlas.src;
    });

    function walkValues(x) {
        const f = Math.max(0, Math.min(WALK_FRAMES - 1, Math.floor(x)));
        const g = Math.min(WALK_FRAMES - 1, f + 1);
        const a = clamp01(x - f);
        const out = [];
        for (let i = 0; i < N_REWARDS; i++) {
            out.push(WALK_E[f * N_REWARDS + i] + (WALK_E[g * N_REWARDS + i] - WALK_E[f * N_REWARDS + i]) * a);
        }
        return out;
    }

    // Image layers (atlas, tile, alpha) and bar levels at loop time t.
    function stateAt(t, seg) {
        const w0 = seg * SEG;
        const layers = [];
        let bars;
        if (t < IN0) {
            bars = [];
            for (let i = 0; i < N_REWARDS; i++) {
                const s = RISE0 + i * STAGGER;
                bars.push(LOW + (1 - LOW) * ramp(t, s, s + RISE_DUR));
            }
            let mean = 0;
            for (const b of bars) mean += b / N_REWARDS;
            layers.push([DIAL, 0, 1]);
            layers.push([DIAL, 1, smooth((mean - LOW) / (1 - LOW))]);
            layers.push([DIAL, 2, ramp(t, GUIDE0, GUIDE1)]);
        } else if (t < OUT0) {
            const x = w0 + Math.max(0, t - IN1) / DT;
            const vals = walkValues(Math.min(x, w0 + SEG - 1));
            const a = ramp(t, IN0, IN1);
            bars = vals.map(function (v) { return 1 + (v - 1) * a; });
            const f = Math.min(w0 + SEG - 1, Math.floor(x));
            layers.push([DIAL, 2, 1]);
            layers.push([WALK, f, a]);
            if (f < w0 + SEG - 1) layers.push([WALK, f + 1, a * (x - f)]);
        } else {
            const vals = walkValues(w0 + SEG - 1);
            const a = ramp(t, OUT0, OUT1);
            bars = vals.map(function (v) { return v + (LOW - v) * a; });
            layers.push([WALK, w0 + SEG - 1, 1]);
            layers.push([DIAL, 0, a]);
        }
        return { layers: layers, bars: bars };
    }

    function drawGlow(level) {
        const cx = IX + IS / 2, cy = IY + IS / 2;
        const g = ctx.createRadialGradient(cx, cy, IS * 0.3, cx, cy, IS * 0.78);
        g.addColorStop(0, mix(P.accent, 1, P.glow * (0.25 + 0.75 * level)));
        g.addColorStop(1, mix(P.accent, 1, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, PY);
    }

    function drawImage(layers) {
        ctx.save();
        roundRect(IX, IY, IS, IS, 14);
        ctx.fillStyle = P.card;
        ctx.fill();
        ctx.clip();
        for (const l of layers) {
            const atlas = l[0], tile = l[1], alpha = l[2];
            if (!atlas.ready || alpha <= 0.002) continue;
            ctx.globalAlpha = alpha;
            ctx.drawImage(atlas.img, (tile % atlas.cols) * TILE, Math.floor(tile / atlas.cols) * TILE, TILE, TILE, IX, IY, IS, IS);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        roundRect(IX, IY, IS, IS, 14);
        ctx.strokeStyle = mix(P.accent, 0.55);
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function drawBadge(t) {
        // Guidance pulse: a ring leaves the model as the guided output lands
        const p = clamp01((t - GUIDE0) / 1.1);
        if (p > 0 && p < 1) {
            ctx.strokeStyle = mix(P.accent, 1, 0.75 * (1 - p));
            ctx.lineWidth = 3;
            roundRect(BADGE_X - BADGE_W / 2 - 40 * p, BADGE_Y - BADGE_H / 2 - 16 * p, BADGE_W + 80 * p, BADGE_H + 32 * p, BADGE_H / 2 + 16 * p);
            ctx.stroke();
        }
        roundRect(BADGE_X - BADGE_W / 2, BADGE_Y - BADGE_H / 2, BADGE_W, BADGE_H, BADGE_H / 2);
        ctx.fillStyle = P.card;
        ctx.fill();
        ctx.strokeStyle = P.accent;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.font = '700 18px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = P.accent;
        ctx.fillText('MIRO', BADGE_X, BADGE_Y + 1);
    }

    function drawBars(bars) {
        roundRect(PX, PY, PW, PH, 12);
        ctx.fillStyle = P.card;
        ctx.fill();
        ctx.strokeStyle = P.line;
        ctx.lineWidth = 2;
        ctx.stroke();
        const pitch = (PW - 20) / N_REWARDS;
        for (let i = 0; i < N_REWARDS; i++) {
            const x = PX + 10 + pitch * i + (pitch - BAR_W) / 2;
            // Track, then the level
            roundRect(x, BAR_BASE - BAR_MAX, BAR_W, BAR_MAX, 5);
            ctx.fillStyle = mix(P.rewards[i], 0.12);
            ctx.fill();
            const h = Math.max(6, BAR_MAX * clamp01(bars[i]));
            const g = ctx.createLinearGradient(0, BAR_BASE - h, 0, BAR_BASE);
            g.addColorStop(0, P.rewards[i]);
            g.addColorStop(1, shade(P.rewards[i], 0.78));
            roundRect(x, BAR_BASE - h, BAR_W, h, 5);
            ctx.fillStyle = g;
            ctx.fill();
        }
    }

    function drawFrame(t, seg) {
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, W, H);
        const s = stateAt(t, seg);
        let level = 0;
        for (const b of s.bars) level += b / N_REWARDS;
        drawGlow((level - LOW) / (1 - LOW));
        drawImage(s.layers);
        drawBars(s.bars);
        drawBadge(t);
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
        drawFrame(elapsed - idx * CYCLE, idx % (WALK_FRAMES / SEG));

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
