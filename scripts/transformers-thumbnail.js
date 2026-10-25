(function () {
    const canvas = document.getElementById('transformers-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // The chapter's Vision Transformer example: the dog photo of its ViT
    // figure is split into a grid of patch tokens, then the class token
    // attends to them, one head at a time. The weights are the chapter's
    // own DINO attention maps for this photo (CLS query, heads 0 to 5),
    // averaged over each patch: bright patches get most of the attention,
    // the beams show where the query looks. Then the patches merge back.
    const SRC = '/assets/publications/transformers_mlbd/vit-dog.webp';
    const G = 6;
    const HEADS = [
        [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.07, 0.08, 0.13, 0.05, 0.00, 0.00, 0.32, 1.00, 0.66, 0.20, 0.05, 0.03, 0.15, 0.42, 0.63, 0.24, 0.08, 0.01, 0.07, 0.11, 0.28, 0.09, 0.03, 0.00, 0.01, 0.03, 0.06, 0.04, 0.02],
        [0.01, 0.01, 0.02, 0.04, 0.05, 0.18, 0.06, 0.25, 0.38, 0.55, 0.29, 0.31, 0.24, 0.47, 0.44, 0.33, 0.29, 0.52, 0.43, 0.53, 0.41, 0.37, 0.31, 0.27, 0.42, 0.72, 0.79, 0.49, 0.33, 0.18, 0.34, 0.68, 0.92, 1.00, 0.42, 0.23],
        [0.00, 0.00, 0.00, 0.02, 0.00, 0.00, 0.00, 0.16, 0.35, 0.74, 0.56, 0.02, 0.00, 0.18, 0.37, 0.57, 1.00, 0.33, 0.08, 0.23, 0.20, 0.34, 0.66, 0.64, 0.03, 0.26, 0.26, 0.23, 0.52, 0.52, 0.00, 0.05, 0.10, 0.12, 0.44, 0.49],
        [0.00, 0.00, 0.00, 0.01, 0.00, 0.00, 0.00, 0.06, 0.05, 0.11, 0.09, 0.01, 0.00, 0.15, 1.00, 0.32, 0.28, 0.07, 0.34, 0.24, 0.27, 0.26, 0.20, 0.09, 0.08, 0.78, 0.93, 0.22, 0.19, 0.06, 0.00, 0.12, 0.27, 0.08, 0.09, 0.05],
        [0.00, 0.00, 0.00, 0.01, 0.00, 0.00, 0.00, 0.03, 0.02, 0.05, 0.04, 0.00, 0.00, 0.23, 0.07, 0.14, 0.14, 0.03, 0.20, 1.00, 0.24, 0.05, 0.07, 0.03, 0.08, 0.19, 0.09, 0.02, 0.02, 0.01, 0.00, 0.01, 0.05, 0.01, 0.01, 0.01],
        [0.00, 0.00, 0.00, 0.05, 0.00, 0.00, 0.00, 0.27, 0.31, 0.53, 0.25, 0.01, 0.00, 0.76, 0.72, 0.50, 0.43, 0.16, 0.34, 0.92, 0.61, 0.45, 0.49, 0.20, 0.12, 0.52, 0.59, 0.88, 0.75, 0.41, 0.00, 0.08, 0.24, 0.74, 1.00, 0.84],
    ];
    const ONES = HEADS[0].map(function () { return 1; });

    const PALETTES = {
        dark: { bg: '#1f2633', attn: '#86a5f5', chipText: '#141a26', muted: '#a0aec0', dim: 0.8 },
        light: { bg: '#eef2f7', attn: '#3d64d4', chipText: '#ffffff', muted: '#5f6b7d', dim: 0.78 },
    };
    let P, BG_RGB;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() {
        P = isDark() ? PALETTES.dark : PALETTES.light;
        BG_RGB = hexToRgb(P.bg);
    }
    const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

    // Layout: the patch grid keeps its outer size while the gaps open, and
    // slides down from the centre to make room for the class token.
    const GX = 30, GY0 = 30, GY1 = 50, GS = 300;
    const GAP = 6;
    const CHIP = { x: 30, y: 10, w: 62, h: 30 };

    // Timeline (seconds within one loop)
    const SPLIT0 = 0.8, SPLIT1 = 1.5;
    const HEAD0 = 1.6, HSTEP = 1.35, HTRANS = 0.45;
    const END0 = HEAD0 + HEADS.length * HSTEP;   // weights fade back to uniform
    const MERGE0 = END0 + 0.4, MERGE1 = END0 + 1.1;
    const CYCLE = END0 + 1.5;

    function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function rgba(rgb, a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')'; }
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

    const img = new Image();
    let ready = false;
    img.onload = function () { ready = true; };
    img.src = SRC;

    // Attention weights shown at time t, blended between consecutive heads.
    // w dims the patches (uniform before and after the heads); b drives the
    // beams, which never blend with the uniform weights so that they fade in
    // on the first head and out on the last one.
    function weightsAt(t) {
        const last = HEADS[HEADS.length - 1];
        if (t < HEAD0) return { w: ONES, b: HEADS[0], head: -1 };
        if (t >= END0) {
            const e = easeInOut((t - END0) / HTRANS);
            return { w: blend(last, ONES, e), b: last, head: -1 };
        }
        const k = Math.floor((t - HEAD0) / HSTEP);
        const e = easeInOut((t - HEAD0 - k * HSTEP) / HTRANS);
        const from = k === 0 ? ONES : HEADS[k - 1];
        const bw = k === 0 ? HEADS[0] : blend(from, HEADS[k], e);
        return { w: blend(from, HEADS[k], e), b: bw, head: k };
    }
    function blend(a, b, e) {
        const out = new Array(a.length);
        for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * e;
        return out;
    }

    function drawFrame(t) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, W, H);
        if (!ready) return;

        const split = easeInOut((t - SPLIT0) / (SPLIT1 - SPLIT0)) * (1 - easeInOut((t - MERGE0) / (MERGE1 - MERGE0)));
        const gap = GAP * split;
        const GY = GY0 + (GY1 - GY0) * split;
        const ts = (GS - (G - 1) * gap) / G;
        const src = img.width / G;
        const r = 5 * split;
        const st = weightsAt(t);
        const w = st.w;

        // Patch tokens, dimmed by how little attention they receive. The
        // outer clip rounds the corners of the whole image while it is intact.
        const centers = [];
        ctx.save();
        roundRect(GX, GY, GS, GS, 8 - 3 * split);
        ctx.clip();
        for (let i = 0; i < G; i++) {
            for (let j = 0; j < G; j++) {
                const x = GX + j * (ts + gap), y = GY + i * (ts + gap);
                const v = Math.pow(w[i * G + j], 0.75);
                const bv = Math.pow(st.b[i * G + j], 0.75);
                centers.push({ x: x + ts / 2, y: y + ts / 2, v: bv, x0: x, y0: y });
                ctx.save();
                if (r > 0.5) {
                    roundRect(x, y, ts, ts, r);
                    ctx.clip();
                }
                ctx.drawImage(img, j * src, i * src, src, src, x, y, ts + (split < 0.02 ? 0.6 : 0), ts + (split < 0.02 ? 0.6 : 0));
                const d = P.dim * (1 - v);
                if (d > 0.002) {
                    ctx.fillStyle = rgba(BG_RGB, d);
                    ctx.fillRect(x, y, ts + 1, ts + 1);
                }
                ctx.restore();
            }
        }
        ctx.restore();

        // Beams from the class token to the patches it attends to
        const beams = ramp(t, HEAD0, HEAD0 + HTRANS) * (1 - ramp(t, END0, END0 + HTRANS));
        const cx = CHIP.x + CHIP.w / 2, cy = CHIP.y + CHIP.h;
        if (beams > 0) {
            ctx.lineCap = 'round';
            ctx.strokeStyle = P.attn;
            for (const c of centers) {
                const a = clamp01((c.v - 0.45) / 0.5);
                if (a <= 0) continue;
                // Stop at the patch border so the patch itself stays clear
                const dx = c.x - cx, dy = c.y - cy;
                const u = 1 - (ts / 2 + 2) / Math.max(Math.abs(dx), Math.abs(dy));
                ctx.globalAlpha = beams * a * 0.9;
                ctx.lineWidth = 1.5 + 3 * a;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + dx * u, cy + dy * u);
                ctx.stroke();
            }
            // Ring around the most attended patches
            for (const c of centers) {
                const a = clamp01((c.v - 0.62) / 0.3);
                if (a <= 0) continue;
                ctx.globalAlpha = beams * a;
                ctx.lineWidth = 3;
                roundRect(c.x0 - 1.5, c.y0 - 1.5, ts + 3, ts + 3, r + 1.5);
                ctx.stroke();
            }
        }

        // Class token (the query) and the current head
        const chip = ramp(t, SPLIT1 - 0.3, SPLIT1 + 0.1) * (1 - ramp(t, MERGE0 - 0.3, MERGE0 + 0.1));
        ctx.globalAlpha = chip;
        roundRect(CHIP.x, CHIP.y, CHIP.w, CHIP.h, 7);
        ctx.fillStyle = P.attn;
        ctx.fill();
        ctx.font = '700 17px ' + MONO;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = P.chipText;
        ctx.fillText('CLS', cx, CHIP.y + CHIP.h / 2 + 1);

        // Head label: the digit cross-fades from one head to the next
        let label = 0;
        const digits = [];
        if (st.head >= 0) {
            const s = t - HEAD0 - st.head * HSTEP;
            label = st.head === 0 ? ramp(s, 0, 0.3) : 1;
            const swap = st.head === 0 ? 1 : ramp(s, 0.1, 0.3);
            digits.push([st.head, swap]);
            if (swap < 1) digits.push([st.head - 1, 1 - ramp(s, 0, 0.15)]);
        } else if (t >= END0) {
            label = 1 - ramp(t, END0, END0 + 0.25);
            digits.push([HEADS.length - 1, 1]);
        }
        if (label > 0) {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'alphabetic';
            ctx.font = '600 21px ' + MONO;
            ctx.fillStyle = P.attn;
            for (const d of digits) {
                ctx.globalAlpha = label * d[1];
                ctx.fillText(String(d[0]), 330, 33);
            }
            ctx.globalAlpha = label;
            ctx.fillStyle = P.muted;
            ctx.font = '500 19px ' + FONT;
            ctx.fillText('head', 310, 33);
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
