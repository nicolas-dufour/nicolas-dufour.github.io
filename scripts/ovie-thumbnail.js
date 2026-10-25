(function () {
    const canvas = document.getElementById('ovie-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Miniature of the OVIE blog hero, in the Kyutai blog palette: one input
    // image (Hopper's "Gas", top-left) and the views OVIE renders from it as
    // the camera is driven around (main screen). Each view is generated from
    // the input image and the target pose alone. The pad (bottom-right) is
    // the camera position, read off the arrow keys of the blog's demo: the
    // grey ring is the input camera, the green dot the camera being rendered.
    // Dark is the blog's palette; light deepens the hues to hold contrast.
    const PALETTES = {
        dark: { bg: '#121212', layer: '#191919', line: '#343434', mid: '#656565', muted: '#9d9d9d', text: '#EFEFEF', green: '#39F2AE' },
        light: { bg: '#f1f4f8', layer: '#ffffff', line: '#d3dae3', mid: '#9aa4b1', muted: '#6b7686', text: '#1f2933', green: '#0b9a6b' },
    };
    let P, BG_RGB;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() {
        P = isDark() ? PALETTES.dark : PALETTES.light;
        BG_RGB = hexToRgb(P.bg);
    }
    const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    // Atlas: the 69 distinct views of the hero demo (8 fps), then the input
    // image, as 256×256 tiles, 8 per row.
    const ATLAS = '/assets/publications/one_view/ovie-views.webp';
    const TILE = 256, COLS = 8, N = 69, SRC = 69, FPS = 8;
    // Camera position per view, in 1/60 s of key press (x right, y up).
    const POSE = [
        0, 0, -1, 0, -9, 0, -16, 0, -24, 0, -31, 0, -39, 0, -46, 0, -54, 0, -61, 0, -65, 0, -58, 0,
        -50, 0, -43, 0, -35, 0, -28, 0, -20, 0, -13, 0, -5, 0, 2, 0, 10, 0, 15, 0, 7, 0, 0, 0,
        -8, 0, -15, 0, -23, 0, -30, 0, -38, 0, -45, 0, -53, 0, -60, 0, -68, 0, -75, 0, -83, 0, -90, 0,
        -94, 0, -87, 0, -79, 0, -72, 0, -64, 0, -57, 0, -49, 0, -42, 0, -34, 0, -28, 0, -19, 0, -13, 2,
        -13, 9, -13, 17, -13, 24, -13, 32, -13, 39, -13, 47, -13, 52, -13, 44, -13, 37, -13, 29, -13, 22, -13, 14,
        -13, 8, -13, -1, -13, -8, -13, -17, -13, -23, -13, -27, -13, -20, -13, -12, -13, -6,
    ];

    // Layout
    const M = 12;                                   // outer margin
    const R = 14;                                   // corner radius
    const GAP = 10;                                 // gap around the notches
    const IN = 100;                                 // input image size
    const IX = M, IY = M;
    const PAD = 92;                                 // camera pad size
    const PX = W - M - PAD, PY = H - M - PAD;
    // The camera mostly moves left and up, so the input camera sits right
    // of and below the pad centre to give the path room.
    const PAD_OX = PX + 56, PAD_OY = PY + 52;       // input camera on the pad
    const PAD_SCALE = 0.45;                         // pad px per pose unit

    // Timeline (seconds)
    const HOLD = 1.1;                               // rest on the input view
    const PLAY = (N - 1) / FPS;
    const BACK = 0.5;                               // ease back to the input pose
    const CYCLE = HOLD + PLAY + BACK;
    const TRAIL = 1.4;

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

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
    // Closed polygon with every corner rounded (concave ones too)
    function roundPoly(pts, r) {
        const n = pts.length;
        ctx.beginPath();
        ctx.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
        for (let i = 1; i <= n; i++) {
            const a = pts[i % n], b = pts[(i + 1) % n];
            ctx.arcTo(a[0], a[1], b[0], b[1], r);
        }
        ctx.closePath();
    }
    // Screen: the canvas minus a notch for the input (top-left) and the pad
    function screenPath() {
        const x0 = M, y0 = M, x1 = W - M, y1 = H - M;
        const nx = IX + IN + GAP, ny = IY + IN + GAP;
        const px = PX - GAP, py = PY - GAP;
        roundPoly([[nx, y0], [x1, y0], [x1, py], [px, py], [px, y1], [x0, y1], [x0, ny], [nx, ny]], R);
    }

    const img = new Image();
    let ready = false;
    img.onload = function () {
        ready = true;
        t0 = performance.now();
    };
    img.src = ATLAS;

    function drawTile(k, x, y, s, alpha) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, (k % COLS) * TILE, Math.floor(k / COLS) * TILE, TILE, TILE, x, y, s, s);
        ctx.globalAlpha = 1;
    }

    // State at cycle time t: two views to cross-fade and the camera pose
    function stateAt(t) {
        if (t < HOLD) return { a: 0, b: 0, e: 0, x: 0, y: 0 };
        if (t < HOLD + PLAY) {
            const u = (t - HOLD) * FPS;
            const f = Math.min(N - 1, Math.floor(u));
            const g = Math.min(N - 1, f + 1);
            const e = u - f;
            return {
                a: f, b: g, e: e,
                x: POSE[2 * f] + (POSE[2 * g] - POSE[2 * f]) * e,
                y: POSE[2 * f + 1] + (POSE[2 * g + 1] - POSE[2 * f + 1]) * e,
            };
        }
        const e = smooth((t - HOLD - PLAY) / BACK);
        return { a: N - 1, b: 0, e: e, x: POSE[2 * N - 2] * (1 - e), y: POSE[2 * N - 1] * (1 - e) };
    }

    function drawScreen(s) {
        const x0 = M, y0 = M, sz = W - 2 * M;
        screenPath();
        ctx.fillStyle = P.layer;
        ctx.fill();
        if (ready) {
            ctx.save();
            screenPath();
            ctx.clip();
            drawTile(s.a, x0, y0, sz, 1);
            if (s.e > 0.001 && s.b !== s.a) drawTile(s.b, x0, y0, sz, s.e);
            ctx.restore();
        }
        // Rim turns green as the camera leaves the input pose
        const away = clamp01(Math.hypot(s.x, s.y) / 14);
        screenPath();
        ctx.strokeStyle = away > 0.01 ? mix(P.green, 0.35 + 0.65 * away) : P.line;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    function drawInput() {
        roundRect(IX, IY, IN, IN, 10);
        ctx.fillStyle = P.layer;
        ctx.fill();
        if (ready) {
            ctx.save();
            roundRect(IX, IY, IN, IN, 10);
            ctx.clip();
            drawTile(SRC, IX, IY, IN, 1);
            ctx.restore();
        }
        roundRect(IX, IY, IN, IN, 10);
        ctx.strokeStyle = P.muted;
        ctx.lineWidth = 3;
        ctx.stroke();

        // "1 view" chip on the input
        const cw = 66, ch = 26, cx = IX + 7, cy = IY + 7;
        roundRect(cx, cy, cw, ch, 13);
        ctx.fillStyle = 'rgba(18,18,18,0.72)';
        ctx.fill();
        ctx.font = '700 16px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#EFEFEF';
        ctx.fillText('1 view', cx + cw / 2, cy + ch / 2 + 1);
    }

    function padPoint(x, y) {
        return [PAD_OX + x * PAD_SCALE, PAD_OY - y * PAD_SCALE];
    }

    function drawPad(s, t) {
        roundRect(PX, PY, PAD, PAD, 12);
        ctx.fillStyle = P.layer;
        ctx.fill();
        ctx.strokeStyle = P.line;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Camera plane: a dot grid through the input camera
        ctx.fillStyle = P.mid;
        for (let i = -3; i <= 2; i++) {
            for (let j = -2; j <= 2; j++) {
                const gx = PAD_OX + i * 16, gy = PAD_OY + j * 16;
                if (gx < PX + 8 || gx > PX + PAD - 8 || gy < PY + 8 || gy > PY + PAD - 8) continue;
                ctx.beginPath();
                ctx.arc(gx, gy, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Trail over the last TRAIL seconds (wraps around the cycle)
        const STEPS = 28;
        ctx.lineCap = 'round';
        ctx.lineWidth = 5;
        let prev = null;
        for (let k = STEPS; k >= 0; k--) {
            let tk = t - (k / STEPS) * TRAIL;
            if (tk < 0) tk += CYCLE;
            const q = stateAt(tk);
            const p = padPoint(q.x, q.y);
            if (prev) {
                ctx.strokeStyle = mix(P.green, 1, 0.6 * (1 - k / STEPS));
                ctx.beginPath();
                ctx.moveTo(prev[0], prev[1]);
                ctx.lineTo(p[0], p[1]);
                ctx.stroke();
            }
            prev = p;
        }

        // Input camera
        ctx.strokeStyle = P.muted;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(PAD_OX, PAD_OY, 9, 0, Math.PI * 2);
        ctx.stroke();

        // Rendered camera
        const p = padPoint(s.x, s.y);
        ctx.fillStyle = P.green;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 7.5, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawFrame(t) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, W, H);
        const s = stateAt(t);
        drawScreen(s);
        drawInput();
        drawPad(s, t);
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
        // The first rAF timestamp can precede t0, so clamp to keep t >= 0.
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
