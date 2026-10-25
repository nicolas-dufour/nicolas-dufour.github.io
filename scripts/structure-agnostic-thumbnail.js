(function () {
    const canvas = document.getElementById('structure-agnostic-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Miniature of the blog post's Figure 1 (Pool-Align path), in its palette:
    // the latent (blue) and the frozen teacher (green) are each averaged over
    // positions into one vector, then the latent vector swings onto the
    // teacher's (cosine). Each loop uses another latent / teacher shape, since
    // pooling does not care about the layout.
    // Dark is the blog's palette; light deepens the hues to hold contrast.
    const PALETTES = {
        dark: { bg: '#121212', layer: '#191919', blue: '#7cc4ea', green: '#39F2AE', muted: '#9d9d9d', readout0: 0.45, dim: 0.62 },
        light: { bg: '#f1f4f8', layer: '#ffffff', blue: '#2b7fc0', green: '#0b9a6b', muted: '#6b7686', readout0: 0.7, dim: 0.5 },
    };
    let P, BG_RGB;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() {
        P = isDark() ? PALETTES.dark : PALETTES.light;
        BG_RGB = hexToRgb(P.bg);
    }
    const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    const CONFIGS = [
        { latent: 'grid', teacher: 'image' },
        { latent: 'seq', teacher: 'image' },
        { latent: 'grid', teacher: 'text' },
        { latent: 'seq', teacher: 'text' },
    ];
    const CAPTION = ['“a black dog', 'in mid-air…”'];

    // Layout
    const LX = 92, RX = 268, SY = 128;  // stack centres
    const LABEL_Y = 40;
    const PY = 214;                      // pooled vectors
    const OX = 180, OY = 326;            // origin of the cosine diagram
    const ARROW = 104;
    const LAYER_D = 4;                   // offset between channel layers

    // Timeline (seconds within one loop)
    const CYCLE = 8.4;
    const IN_END = 0.6;
    const POOL0 = 0.9, POOL_DUR = 0.8;
    const POOLED0 = 1.6, POOLED1 = 2.1;
    const DIM0 = 1.7, DIM1 = 2.3;
    const ARROW0 = 2.3, ARROW1 = 2.9;
    const ALIGN0 = 3.2, ALIGN1 = 5.0;
    const OUT0 = 7.6, OUT1 = 8.3;

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
    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
    function ramp(t, a, b) { return smooth((t - a) / (b - a)); }
    function easeInOut(x) {
        x = clamp01(x);
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function gridCells(cx, cy) {
        const s = 16, gap = 4, cells = [];
        for (let i = 0; i < 16; i++) {
            cells.push({
                x: cx + ((i % 4) - 1.5) * (s + gap),
                y: cy + (Math.floor(i / 4) - 1.5) * (s + gap),
                s: s,
            });
        }
        return cells;
    }
    function seqCells(cx, cy) {
        const s = 13, gap = 3, cells = [];
        for (let i = 0; i < 8; i++) {
            cells.push({ x: cx + (i - 3.5) * (s + gap), y: cy, s: s });
        }
        return cells;
    }
    function bounds(cells, pad) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const c of cells) {
            x0 = Math.min(x0, c.x - c.s / 2); y0 = Math.min(y0, c.y - c.s / 2);
            x1 = Math.max(x1, c.x + c.s / 2); y1 = Math.max(y1, c.y + c.s / 2);
        }
        return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
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

    // A stack of channel layers behind a slab of cells, as in the blog figure.
    function drawStack(cells, levels, layers, color, pad, t) {
        const b = bounds(cells, pad);
        for (let k = layers - 1; k >= 1; k--) {
            roundRect(b.x + k * LAYER_D, b.y - k * LAYER_D, b.w, b.h, 3);
            ctx.fillStyle = P.layer;
            ctx.fill();
            ctx.strokeStyle = mix(color, 0.42);
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        roundRect(b.x, b.y, b.w, b.h, 3);
        ctx.fillStyle = mix(color, 0.12);
        ctx.fill();
        ctx.strokeStyle = mix(color, 0.7);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        for (let i = 0; i < cells.length; i++) {
            const c = cells[i];
            const lv = levels[i].base + 0.06 * Math.sin(t * 1.4 + levels[i].phase);
            roundRect(c.x - c.s / 2, c.y - c.s / 2, c.s, c.s, 2);
            ctx.fillStyle = mix(color, clamp01(lv));
            ctx.fill();
        }
    }

    function drawArrow(angle, len, color, width) {
        const tx = OX + Math.cos(angle) * len;
        const ty = OY - Math.sin(angle) * len;
        const head = Math.min(14, len * 0.4);
        const bx = tx - Math.cos(angle) * head;
        const by = ty + Math.sin(angle) * head;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(OX, OY);
        ctx.lineTo(bx, by);
        ctx.stroke();
        const nx = Math.sin(angle) * head * 0.5;
        const ny = Math.cos(angle) * head * 0.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(bx + nx, by + ny);
        ctx.lineTo(bx - nx, by - ny);
        ctx.closePath();
        ctx.fill();
        return { x: tx, y: ty };
    }

    // Per-loop state
    let cycleIdx = -1;
    let cfg, latentCells, teacherCells, latentLevels, teacherLevels, dots;
    let latentPooled, teacherPooled, latentMean, teacherMean;
    // Arrows start pointing at their pooled vector; the latent one ends a few
    // degrees off the teacher so both stay visible once aligned.
    const A_TEACHER = Math.atan2(OY - PY, RX - OX);
    const A_LATENT0 = Math.atan2(OY - PY, LX - OX);
    const A_LATENT1 = A_TEACHER + 6 * Math.PI / 180;

    function levelsFor(n, rnd) {
        const out = [];
        for (let i = 0; i < n; i++) {
            out.push({ base: 0.38 + rnd() * 0.55, phase: rnd() * Math.PI * 2 });
        }
        return out;
    }
    function mean(levels) {
        let s = 0;
        for (const l of levels) s += l.base;
        return s / levels.length;
    }

    function regen(idx) {
        const rnd = mulberry32(1013 + idx * 7919);
        cfg = CONFIGS[idx % CONFIGS.length];
        latentCells = cfg.latent === 'grid' ? gridCells(LX, SY) : seqCells(LX, SY);
        teacherCells = cfg.teacher === 'image' ? gridCells(RX, SY)
            : [{ x: RX, y: SY + 22, s: 18 }];
        latentLevels = levelsFor(latentCells.length, rnd);
        teacherLevels = levelsFor(teacherCells.length, rnd);
        latentMean = mean(latentLevels);
        teacherMean = mean(teacherLevels);
        latentPooled = [{ x: LX, y: PY, s: 18 }];
        teacherPooled = [{ x: RX, y: PY, s: 18 }];

        // Ghost dots that carry every position into the mean.
        dots = [];
        latentCells.forEach(function (c, i) {
            dots.push({ x0: c.x, y0: c.y, x1: LX, y1: PY, t0: POOL0 + i * 0.04, color: 'blue' });
        });
        if (cfg.teacher === 'image') {
            teacherCells.forEach(function (c, i) {
                dots.push({ x0: c.x, y0: c.y, x1: RX, y1: PY, t0: POOL0 + 0.1 + i * 0.04, color: 'green' });
            });
        } else {
            for (let i = 0; i < 5; i++) {
                const c = teacherCells[0];
                dots.push({ x0: c.x, y0: c.y, x1: RX, y1: PY, t0: POOL0 + 0.1 + i * 0.12, color: 'green' });
            }
        }
    }

    function drawFrame(t) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, W, H);

        const fade = ramp(t, 0, IN_END) * (1 - ramp(t, OUT0, OUT1));
        ctx.globalAlpha = fade;

        ctx.font = '500 21px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = mix(P.blue, 0.95);
        ctx.fillText('latent', LX, LABEL_Y);
        ctx.fillStyle = mix(P.green, 0.95);
        ctx.fillText('teacher', RX, LABEL_Y);

        // Feature stacks, dimmed once they have been pooled
        const dim = 1 - P.dim * ramp(t, DIM0, DIM1);
        ctx.globalAlpha = fade * dim;
        drawStack(latentCells, latentLevels, 3, P.blue, 6, t);
        drawStack(teacherCells, teacherLevels, 6, P.green, cfg.teacher === 'image' ? 6 : 4, t);
        if (cfg.teacher === 'text') {
            ctx.font = 'italic 16px ' + FONT;
            ctx.fillStyle = P.muted;
            ctx.fillText(CAPTION[0], RX, SY - 30);
            ctx.fillText(CAPTION[1], RX, SY - 10);
        }

        // Pooling: every position flies into one vector per side
        for (const d of dots) {
            const u = (t - d.t0) / POOL_DUR;
            if (u <= 0 || u >= 1) continue;
            const e = easeInOut(u);
            const a = Math.min(1, u / 0.15, (1 - u) / 0.15);
            ctx.globalAlpha = fade * a;
            ctx.fillStyle = P[d.color];
            ctx.beginPath();
            ctx.arc(d.x0 + (d.x1 - d.x0) * e, d.y0 + (d.y1 - d.y0) * e, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        const pooled = ramp(t, POOLED0, POOLED1);
        if (pooled > 0) {
            ctx.globalAlpha = fade * pooled;
            drawStack(latentPooled, [{ base: latentMean, phase: 0 }], 3, P.blue, 4, 0);
            drawStack(teacherPooled, [{ base: teacherMean, phase: 0 }], 6, P.green, 4, 0);
        }

        // Cosine diagram: the latent vector rotates onto the teacher's
        const grow = ramp(t, ARROW0, ARROW1);
        if (grow > 0) {
            const align = easeInOut((t - ALIGN0) / (ALIGN1 - ALIGN0));
            const aL = A_LATENT0 + (A_LATENT1 - A_LATENT0) * align;
            const len = ARROW * grow;

            // Faint guides from each pooled vector down to its arrow
            ctx.globalAlpha = fade * grow * (1 - ramp(t, ALIGN0, ALIGN0 + 0.6)) * 0.8;
            ctx.setLineDash([3, 5]);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = mix(P.blue, 0.6);
            ctx.beginPath();
            ctx.moveTo(LX, PY + 16);
            ctx.lineTo(OX + Math.cos(A_LATENT0) * ARROW, OY - Math.sin(A_LATENT0) * ARROW);
            ctx.stroke();
            ctx.strokeStyle = mix(P.green, 0.6);
            ctx.beginPath();
            ctx.moveTo(RX, PY + 16);
            ctx.lineTo(OX + Math.cos(A_TEACHER) * ARROW, OY - Math.sin(A_TEACHER) * ARROW);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.globalAlpha = fade * grow;
            // Angle between the two vectors
            const theta = aL - A_TEACHER;
            if (theta > 0.02) {
                ctx.strokeStyle = mix(P.muted, 0.8);
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(OX, OY, 34, -aL, -A_TEACHER);
                ctx.stroke();
                const mid = (aL + A_TEACHER) / 2;
                ctx.globalAlpha = fade * grow * smooth((theta - 0.12) / 0.25);
                ctx.font = 'italic 18px ' + FONT;
                ctx.fillStyle = P.muted;
                ctx.textBaseline = 'middle';
                ctx.fillText('θ', OX + Math.cos(mid) * 50, OY - Math.sin(mid) * 50);
                ctx.textBaseline = 'alphabetic';
                ctx.globalAlpha = fade * grow;
            }

            const tipT = drawArrow(A_TEACHER, len, P.green, 3.5);
            const tipL = drawArrow(aL, len, P.blue, 3.5);

            // Brief glow once the latent has landed on the teacher
            const glow = ramp(t, ALIGN1 - 0.3, ALIGN1 + 0.2) * (1 - ramp(t, ALIGN1 + 0.4, ALIGN1 + 1.4));
            if (glow > 0) {
                const gx = (tipT.x + tipL.x) / 2, gy = (tipT.y + tipL.y) / 2;
                const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 30);
                g.addColorStop(0, mix(P.green, 1, 0.55 * glow));
                g.addColorStop(1, mix(P.green, 1, 0));
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(gx, gy, 30, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = P.muted;
            ctx.beginPath();
            ctx.arc(OX, OY, 3, 0, Math.PI * 2);
            ctx.fill();

            // Readout
            const cos = Math.cos(theta);
            ctx.textAlign = 'left';
            ctx.font = 'italic 18px ' + FONT;
            ctx.fillStyle = P.muted;
            ctx.fillText('cos θ', 22, OY + 2);
            ctx.font = '500 22px "JetBrains Mono", ui-monospace, monospace';
            ctx.fillStyle = mix(P.green, P.readout0 + (1 - P.readout0) * align);
            ctx.fillText(cos.toFixed(2), 22, OY - 22);
            ctx.textAlign = 'center';
        }
        ctx.globalAlpha = 1;
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
        if (idx !== cycleIdx) {
            cycleIdx = idx;
            regen(idx);
        }
        drawFrame(elapsed - idx * CYCLE);

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
