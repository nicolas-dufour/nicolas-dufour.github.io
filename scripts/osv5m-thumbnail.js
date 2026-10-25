(function () {
    const canvas = document.getElementById('osv5m-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Global visual geolocation, the OSV-5M way: dashcam street views from
    // the dataset (the paper's supplementary examples) play one after the
    // other, and a pin drops on each image's true location. Underneath, the
    // map is the dataset itself: the density of all 5.1M train and test
    // images per 2 degree cell, on the paper's magma colour map.
    const PALETTES = {
        dark: {
            bg: '#161b24', land: '#2a3241', pin: '#22d3ee', pinDot: '#ffffff',
            ramp: [[85, 15, 109], [136, 34, 106], [186, 54, 85], [227, 89, 64], [249, 140, 10], [252, 191, 73], [251, 231, 136], [252, 253, 191]],
        },
        light: {
            bg: '#eef2f7', land: '#d9e0e9', pin: '#0277b5', pinDot: '#ffffff',
            ramp: [[251, 214, 140], [248, 168, 84], [236, 114, 70], [208, 70, 88], [160, 44, 106]],
        },
    };
    let P;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() {
        P = isDark() ? PALETTES.dark : PALETTES.light;
        mapDirty = true;
    }
    const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    // Street views (384x232 tiles, 2 per row) with their true locations
    // from the OSV-5M test metadata.
    const VIEWS_SRC = '/assets/publications/osv5m/osv5m-streetviews.webp';
    const FW = 384, FH = 232, COLS = 2;
    const VIEWS = [
        { name: 'Finland', lat: 66.83, lon: 25.43 },
        { name: 'Brazil', lat: -16.68, lon: -43.88 },
        { name: 'China', lat: 41.11, lon: 122.99 },
        { name: 'Algeria', lat: 31.43, lon: 6.98 },
        { name: 'New Zealand', lat: -42.66, lon: 171.04 },
        { name: 'USA', lat: 38.54, lon: -110.62 },
        { name: 'India', lat: 9.38, lon: 76.39 },
        { name: 'Mali', lat: 13.33, lon: -7.05 },
        { name: 'Japan', lat: 41.14, lon: 140.82 },
        { name: 'Australia', lat: -34.84, lon: 138.87 },
    ];

    // Coverage: 180x67 cells of 2 degrees (76N to 58S); R = log density
    // level (0 = no image), G = land.
    const COVER_SRC = '/assets/publications/osv5m/osv5m-coverage.png';
    const CW = 180, CH = 67, CELL = 2;
    const LAT_TOP = 76;
    const LON_LEFT = -166;               // map seam in the Pacific, so no pin sits on an edge

    // Layout
    const IH = 222;                      // street view panel height
    const MY = H - CH * CELL;            // map top (map is 360x134)
    const Z0 = Math.max(1, FW * IH / W / FH);   // fit the tile to the panel

    // Timeline (seconds within one view)
    const SLOT = 3.2;
    const FADE = 0.5;                    // cross-fade into the next view
    const ZOOM = 0.07;                   // slow push-in, like driving on
    const DROP0 = 0.7, DROP1 = 1.12;     // pin falls
    const BOUNCE1 = 1.34;
    const RIP0 = 1.1, RIP1 = 1.95;       // ripple on landing
    const CHIP0 = 1.05, CHIP1 = 1.3;
    const SHRINK0 = SLOT - 0.45, SHRINK1 = SLOT + 0.1;
    const LOOP = VIEWS.length * SLOT;

    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
    function ramp(t, a, b) { return smooth((t - a) / (b - a)); }
    function mod(a, n) { return ((a % n) + n) % n; }

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

    const views = new Image();
    let viewsReady = false;
    views.onload = function () { viewsReady = true; };
    views.src = VIEWS_SRC;

    // Coverage map, redrawn into an offscreen canvas for each theme
    const cover = new Image();
    let coverData = null;
    let mapDirty = true;
    const mapCanvas = makeCanvas(W, CH * CELL);
    const mapCtx = mapCanvas.getContext('2d');
    cover.onload = function () {
        try {
            const c = makeCanvas(CW, CH);
            const cx = c.getContext('2d', { willReadFrequently: true });
            cx.drawImage(cover, 0, 0);
            coverData = cx.getImageData(0, 0, CW, CH).data;
            mapDirty = true;
        } catch (e) { /* keep the plain background */ }
    };
    cover.src = COVER_SRC;

    function rampColor(v) {
        const R = P.ramp;
        const x = clamp01(v) * (R.length - 1);
        const i = Math.min(R.length - 2, Math.floor(x));
        const f = x - i;
        return 'rgb(' + Math.round(R[i][0] + (R[i + 1][0] - R[i][0]) * f) + ','
            + Math.round(R[i][1] + (R[i + 1][1] - R[i][1]) * f) + ','
            + Math.round(R[i][2] + (R[i + 1][2] - R[i][2]) * f) + ')';
    }

    function renderMap() {
        mapCtx.fillStyle = P.bg;
        mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
        if (!coverData) return;
        for (let i = 0; i < CW * CH; i++) {
            const lv = coverData[i * 4], land = coverData[i * 4 + 1];
            if (!lv && !land) continue;
            mapCtx.fillStyle = lv ? rampColor(Math.pow((lv - 1) / 254, 0.8)) : P.land;
            const x = mod((i % CW) * 2 - 180 - LON_LEFT, 360) / 360 * W;
            mapCtx.fillRect(x, Math.floor(i / CW) * CELL, CELL, CELL);
        }
        mapDirty = false;
    }

    function mapXY(v) {
        return { x: mod(v.lon - LON_LEFT, 360) / 360 * W, y: MY + (LAT_TOP - v.lat) / 2 * CELL };
    }

    // Street view k with a slow push-in; tau runs from -FADE to SLOT.
    function drawView(k, tau, alpha) {
        if (alpha <= 0 || !viewsReady) return;
        const z = Z0 * (1 + ZOOM * clamp01((tau + FADE) / (SLOT + FADE)));
        const sw = FW / z, sh = sw * IH / W;
        const sx = (k % COLS) * FW + (FW - sw) / 2;
        const sy = Math.floor(k / COLS) * FH + (FH - sh) * 0.55;
        ctx.globalAlpha = alpha;
        ctx.drawImage(views, sx, sy, sw, sh, 0, 0, W, IH);
        ctx.globalAlpha = 1;
    }

    function pinPath(x, y, s) {
        const r = 8.5 * s, hy = y - 17 * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x - 3 * s, y - 6 * s, x - r, y - 11 * s, x - r, hy);
        ctx.arc(x, hy, r, Math.PI, 0);
        ctx.bezierCurveTo(x + r, y - 11 * s, x + 3 * s, y - 6 * s, x, y);
        ctx.closePath();
    }

    function drawPin(x, y, s, alpha) {
        ctx.globalAlpha = alpha;
        pinPath(x, y, s);
        ctx.lineWidth = 3;
        ctx.strokeStyle = P.bg;
        ctx.stroke();
        ctx.fillStyle = P.pin;
        ctx.fill();
        ctx.fillStyle = P.pinDot;
        ctx.beginPath();
        ctx.arc(x, y - 17 * s, 3.3 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    function drawDot(x, y, alpha) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = P.bg;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = P.pin;
        ctx.beginPath();
        ctx.arc(x, y, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Pin of view j, given the time since its slot started (mod the loop)
    function drawMarker(j, age) {
        const p = mapXY(VIEWS[j]);
        if (age < DROP0) return;
        if (age < SHRINK0) {
            // Falling, then a small bounce
            let off;
            if (age < DROP1) {
                const u = (age - DROP0) / (DROP1 - DROP0);
                off = -64 * (1 - u * u);
            } else {
                const u = clamp01((age - DROP1) / (BOUNCE1 - DROP1));
                off = -7 * Math.sin(Math.PI * u);
            }
            const land = clamp01((age - DROP0) / (DROP1 - DROP0));
            ctx.globalAlpha = 0.3 * land;
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, 2 + 5 * land, 1 + 2 * land, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            drawPin(p.x, p.y + off, 1.25, ramp(age, DROP0, DROP0 + 0.12));
            return;
        }
        // Pin shrinks into a dot that lingers for a few views
        const sh = ramp(age, SHRINK0, SHRINK1);
        const fade = 1 - ramp(age, 5 * SLOT, 9 * SLOT);
        if (sh < 1) drawPin(p.x, p.y, 1.25 * (1 - sh), 1 - sh);
        drawDot(p.x, p.y, sh * fade);
    }

    function drawRipple(j, age) {
        const u = (age - RIP0) / (RIP1 - RIP0);
        if (u <= 0 || u >= 1) return;
        const p = mapXY(VIEWS[j]);
        ctx.globalAlpha = 1 - u;
        ctx.strokeStyle = P.pin;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 4 + 24 * u, (4 + 24 * u) * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Country label on the street view once the pin has landed
    function drawChip(k, tau) {
        const a = ramp(tau, CHIP0, CHIP1) * (1 - ramp(tau, SLOT - FADE - 0.2, SLOT - FADE + 0.05));
        if (a <= 0) return;
        const name = VIEWS[k].name;
        ctx.font = '600 21px ' + FONT;
        const tw = ctx.measureText(name).width;
        const h = 36, x = 10, y = IH - 10 - h + (1 - a) * 6;
        const w = tw + 46;
        ctx.globalAlpha = a;
        roundRect(x, y, w, h, h / 2);
        ctx.fillStyle = 'rgba(12, 16, 24, 0.66)';
        ctx.fill();
        // Small pin glyph
        const px = x + 19, py = y + h / 2 + 8;
        pinPath(px, py, 0.82);
        ctx.fillStyle = PALETTES.dark.pin;
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py - 17 * 0.82, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, x + 34, y + h / 2 + 1);
        ctx.globalAlpha = 1;
    }

    function drawFrame(t) {
        if (mapDirty) renderMap();
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, W, H);

        const N = VIEWS.length;
        const k = Math.floor(t / SLOT);
        const tau = t - k * SLOT;

        // Street views
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, IH);
        ctx.clip();
        ctx.fillStyle = P.land;
        ctx.fillRect(0, 0, W, IH);
        drawView(k, tau, 1);
        drawView((k + 1) % N, tau - SLOT, ramp(tau, SLOT - FADE, SLOT));
        ctx.restore();

        // Map of the dataset
        ctx.drawImage(mapCanvas, 0, MY);

        // Earlier pins as dots, then the current pin on top
        for (let j = 0; j < N; j++) {
            if (j === k) continue;
            drawMarker(j, mod(t - j * SLOT, LOOP));
        }
        drawRipple(k, tau);
        drawMarker(k, tau);

        drawChip(k, tau);
    }

    refreshPalette();
    new MutationObserver(refreshPalette).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    const t0 = performance.now();
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
        drawFrame(elapsed % LOOP);

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
