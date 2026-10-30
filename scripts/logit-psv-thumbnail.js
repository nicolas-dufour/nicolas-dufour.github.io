(function () {
    const canvas = document.getElementById('logit-psv-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Miniature of the project page's hero, in its palette: perturbed members
    // are traced through the network and pile up where their logits land, then
    // fill a test-accuracy gauge. Top band: noise on every block (the shift
    // builds up along the way). Bottom band: noise on the output bias only
    // (the shift is added at the end). Both give a similar spread and accuracy.
    // Dark is the page's own dark theme.
    const PALETTES = {
        light: { bg: '#F4F3EC', ink: '#1D1D1B', grey: '#6C6A62', brown: '#7C4A1D', blue: '#2D6E9E', red: '#C2392B' },
        dark: { bg: '#181715', ink: '#ECE9DF', grey: '#A39F93', brown: '#D9AD7E', blue: '#6AA8D6', red: '#E5634F' },
    };
    let P;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() { P = isDark() ? PALETTES.dark : PALETTES.light; }
    const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    // Layout
    const X0 = 18, X1 = 222, XE = 244;     // network start, output bias, end of traces
    const XH = 254, HW = 60;               // logit histogram
    const XG0 = 326, XG1 = 344;            // test-accuracy gauge
    const NB = 12;                         // blocks drawn per band
    const HH = 50;                         // band half-height
    const SP = 23;                         // spread of the final logit shift
    const BIN = 7;
    const BANDS = [
        { yc: 112, label: 'Every weight', color: 'blue', top: 0.76 },
        { yc: 278, label: 'Logit bias only', color: 'red', top: 0.80 },
    ];
    const BASE = 0.3;                      // unperturbed model on the gauge

    // Timeline (seconds within one loop)
    const CYCLE = 9.4;
    const N = 26, SPAWN0 = 0.2, EVERY = 0.21, TRAVEL = 1.7;
    const OUT0 = 8.6, OUT1 = 9.3;

    function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function rgba(hex, a) {
        const c = hexToRgb(hex);
        return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
    }
    function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
    function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
    function ramp(t, a, b) { return smooth((t - a) / (b - a)); }
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function gauss(r) {
        let u = 0, v = 0;
        while (u === 0) u = r();
        while (v === 0) v = r();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    function blockX(k) { return X0 + (k + 1) * (X1 - X0) / (NB + 1); }
    function pointAt(pts, x) {
        for (let i = 1; i < pts.length; i++) {
            if (pts[i][0] >= x) {
                const a = pts[i - 1], b = pts[i];
                const k = b[0] > a[0] ? (x - a[0]) / (b[0] - a[0]) : 1;
                return a[1] + (b[1] - a[1]) * k;
            }
        }
        return pts[pts.length - 1][1];
    }

    // Per-loop state: each member draws its own final shift in each band.
    let cycleIdx = -1;
    let members;

    function regen(idx) {
        const rnd = mulberry32(2026 + idx * 7919);
        members = [];
        for (let i = 0; i < N; i++) {
            const d = [clamp(gauss(rnd), -1.8, 1.8) * SP, clamp(gauss(rnd), -1.8, 1.8) * SP];
            // Top: a random walk over the blocks, pinned to end at d (a bridge).
            const w = [0];
            for (let k = 0; k < NB; k++) w.push(w[k] + gauss(rnd));
            const top = [];
            for (let k = 0; k <= NB; k++) {
                const f = k / NB;
                const y = (w[k] - f * w[NB]) * SP * 0.32 + f * d[0];
                top.push([k === 0 ? X0 : blockX(k - 1), BANDS[0].yc + clamp(y, -0.95 * HH, 0.95 * HH)]);
            }
            top.push([XE, BANDS[0].yc + d[0]]);
            // Bottom: flat until the output bias, then a single jump.
            const yb = BANDS[1].yc;
            const bot = [[X0, yb], [X1, yb], [X1 + (XE - X1) * 0.45, yb + d[1]], [XE, yb + d[1]]];
            members.push({ t0: SPAWN0 + i * EVERY, d: d, p: [top, bot] });
        }
    }

    function drawScaffold() {
        ctx.font = '600 21px ' + FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        BANDS.forEach(function (b, bi) {
            const y = b.yc;
            ctx.fillStyle = P[b.color];
            ctx.fillText(b.label, X0 - 2, y - HH - 16);

            // The network: faint blocks, a dashed centre line
            ctx.strokeStyle = rgba(P.brown, 0.28);
            ctx.lineWidth = 1.5;
            for (let k = 0; k < NB; k++) {
                const x = blockX(k);
                ctx.beginPath();
                ctx.moveTo(x, y - HH);
                ctx.lineTo(x, y + HH);
                ctx.stroke();
            }
            ctx.setLineDash([3, 5]);
            ctx.strokeStyle = rgba(P.ink, 0.3);
            ctx.beginPath();
            ctx.moveTo(X0, y);
            ctx.lineTo(XE, y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Output bias, only perturbed in the bottom band
            if (bi === 1) {
                ctx.fillStyle = rgba(P.red, 0.16);
                ctx.strokeStyle = rgba(P.red, 0.7);
                ctx.lineWidth = 2;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(X1 - 6, y - HH, 12, 2 * HH, 6);
                else ctx.rect(X1 - 6, y - HH, 12, 2 * HH);
                ctx.fill();
                ctx.stroke();
            }

            // Histogram axis and gauge frame
            ctx.strokeStyle = rgba(P.ink, 0.5);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(XH, y - HH);
            ctx.lineTo(XH, y + HH);
            ctx.stroke();
            ctx.fillStyle = rgba(P.ink, 0.05);
            ctx.fillRect(XG0, y - HH, XG1 - XG0, 2 * HH);
        });

        ctx.fillStyle = P.grey;
        ctx.font = '400 34px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('≈', (XH + XG1) / 2, (BANDS[0].yc + BANDS[1].yc) / 2 + 6);
        ctx.textBaseline = 'alphabetic';
    }

    function drawFrame(t) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, W, H);
        drawScaffold();

        const fade = 1 - ramp(t, OUT0, OUT1);
        const landed = [0, 0];
        const hist = [new Map(), new Map()];
        let peak = 4;

        // Trails: bright while travelling, then settling into a faint thicket
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (const m of members) {
            const age = t - m.t0;
            if (age <= 0) continue;
            const k = Math.min(1, age / TRAVEL);
            const xn = X0 + (XE - X0) * k;
            const a = fade * (0.12 + 0.5 * (1 - ramp(age, TRAVEL, TRAVEL + 1.6)));
            for (let b = 0; b < 2; b++) {
                const pts = m.p[b];
                ctx.strokeStyle = rgba(P[BANDS[b].color], a);
                ctx.beginPath();
                ctx.moveTo(pts[0][0], pts[0][1]);
                for (const q of pts) {
                    if (q[0] > pts[0][0] && q[0] < xn) ctx.lineTo(q[0], q[1]);
                }
                ctx.lineTo(xn, pointAt(pts, xn));
                ctx.stroke();
                if (k < 1) {
                    ctx.fillStyle = rgba(P[BANDS[b].color], fade);
                    ctx.beginPath();
                    ctx.arc(xn, pointAt(pts, xn), 3.2, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Each landing grows its histogram bin and the band's count
                const s = smooth((age - TRAVEL) / 0.3);
                if (s > 0) {
                    const bin = Math.round(m.d[b] / BIN);
                    const v = (hist[b].get(bin) || 0) + s;
                    hist[b].set(bin, v);
                    peak = Math.max(peak, v);
                    landed[b] += s;
                }
            }
        }

        BANDS.forEach(function (band, b) {
            const y = band.yc;
            ctx.fillStyle = rgba(P[band.color], 0.78 * fade);
            hist[b].forEach(function (v, bin) {
                const yy = y + bin * BIN;
                if (Math.abs(yy - y) > HH) return;
                ctx.fillRect(XH + 1, yy - BIN / 2 + 0.8, HW * v / peak, BIN - 1.6);
            });

            // Test accuracy rises from the unperturbed level as members land
            const n = landed[b];
            const wiggle = 0.025 * Math.sin(t * 2.1 + b * 1.9) * Math.min(1, n / 6);
            const acc = BASE + (band.top - BASE) * (1 - Math.exp(-n / 7)) + wiggle;
            const v = BASE + (acc - BASE) * fade;
            const gt = y - HH, gh = 2 * HH;
            ctx.fillStyle = rgba(P[band.color], 0.8);
            ctx.fillRect(XG0, gt + gh * (1 - v), XG1 - XG0, gh * v);
            ctx.strokeStyle = rgba(P.ink, 0.5);
            ctx.lineWidth = 1.5;
            ctx.strokeRect(XG0 + 0.75, gt + 0.75, XG1 - XG0 - 1.5, gh - 1.5);
            ctx.setLineDash([4, 3]);
            ctx.strokeStyle = rgba(P.ink, 0.85);
            ctx.beginPath();
            ctx.moveTo(XG0 - 6, gt + gh * (1 - BASE));
            ctx.lineTo(XG1, gt + gh * (1 - BASE));
            ctx.stroke();
            ctx.setLineDash([]);
        });
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
