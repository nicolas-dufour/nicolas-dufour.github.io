(function () {
    const canvas = document.getElementById('et-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // The paper's teaser (Fig. 1), brought to life: the E.T. bike flies its
    // arc over the moon and lands, leaving the teaser's stroboscopic copies,
    // while DIRECTOR draws the camera trajectory of each prompt, frustum by
    // frustum from the first (pale) to the last (saturated) camera: trucking
    // right with the character (green), pushing in (red), staying static
    // (purple). All layers are cut from the teaser render, which is a night
    // scene in both themes; the palette only tints the loading placeholder.
    const PALETTES = {
        dark: { wait: '#0a1733' },
        light: { wait: '#dbe3ee' },
    };
    let P;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() { P = isDark() ? PALETTES.dark : PALETTES.light; }

    const BASE = '/assets/publications/et/';
    const IMAGES = { plate: 'et-plate.webp', paths: 'et-paths.webp', reveal: 'et-reveal.webp', bikes: 'et-bikes.webp' };

    // Bike sprites (atlas x, size; canvas position), in flight order
    const BIKES = [
        { sx: 0, sw: 55, sh: 59, x: -26, y: 13 },
        { sx: 57, sw: 50, sh: 57, x: 59, y: 15 },
        { sx: 109, sw: 44, sh: 54, x: 127, y: 57 },
        { sx: 155, sw: 39, sh: 58, x: 191, y: 127 },
        { sx: 196, sw: 41, sh: 51, x: 255, y: 219 },
    ];

    // Trajectories in the reveal map: 1 red, 2 green, 3 purple
    const TRAJ = [
        null,
        { t0: 2.1, t1: 4.9 },
        { t0: 0.8, t1: 3.9 },
        { t0: 3.7, t1: 5.3 },
    ];
    const SOFT = 0.05;                   // width of the reveal front
    const GLOW = 0.12;                   // highlighted span behind the front

    // Timeline (seconds within one loop)
    const FLY0 = 0.2, FLY1 = 4.6;
    const FADE0 = 8.3, FADE1 = 9.2;
    const CYCLE = 9.6;

    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
    function ramp(t, a, b) { return smooth((t - a) / (b - a)); }
    // Enters already flying, slows down to land
    function easeOut(x) {
        x = clamp01(x);
        return 1 - Math.pow(1 - x, 1.7);
    }

    function makeCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    }

    // Flight path: Catmull-Rom through the teaser's bike positions, entering
    // from the left edge. Each sample keeps the copy it heads to (seg), its
    // arc-length fraction (f) and the sprite height there (h), so the flyer
    // matches each copy's perspective.
    const KNOTS = [[-60, 36], [-40, 38]].concat(BIKES.map(function (b) {
        return [b.x + b.sw / 2, b.y + b.sh / 2];
    }));
    KNOTS.push([KNOTS[KNOTS.length - 1][0] + 30, KNOTS[KNOTS.length - 1][1] + 40]);
    function knotH(j) { return BIKES[Math.max(0, Math.min(BIKES.length - 1, j - 2))].sh; }
    function catmull(a, b, c, d, u) {
        return 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
    }
    const PATH = [];
    (function buildPath() {
        const N = 24;
        for (let i = 1; i < KNOTS.length - 2; i++) {
            const p0 = KNOTS[i - 1], p1 = KNOTS[i], p2 = KNOTS[i + 1], p3 = KNOTS[i + 2];
            for (let s = 0; s < N; s++) {
                const u = s / N;
                PATH.push({
                    x: catmull(p0[0], p1[0], p2[0], p3[0], u),
                    y: catmull(p0[1], p1[1], p2[1], p3[1], u),
                    seg: i - 1,
                    h: knotH(i) + (knotH(i + 1) - knotH(i)) * u,
                });
            }
        }
        const last = KNOTS[KNOTS.length - 2];
        PATH.push({ x: last[0], y: last[1], seg: BIKES.length - 1, h: knotH(KNOTS.length - 2) });
        let len = 0;
        PATH[0].f = 0;
        for (let i = 1; i < PATH.length; i++) {
            len += Math.hypot(PATH[i].x - PATH[i - 1].x, PATH[i].y - PATH[i - 1].y);
            PATH[i].f = len;
        }
        for (const p of PATH) p.f /= len;
    })();
    // Fraction of the flight at which the flyer reaches copy k
    const PASS = BIKES.map(function (b, k) {
        for (const p of PATH) if (p.seg >= k + 1) return p.f;
        return 1;
    });

    function pathAt(f) {
        for (let i = 1; i < PATH.length; i++) {
            if (PATH[i].f >= f) {
                const a = PATH[i - 1], b = PATH[i];
                const u = (f - a.f) / Math.max(1e-6, b.f - a.f);
                return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, h: a.h + (b.h - a.h) * u, seg: a.seg };
            }
        }
        return PATH[PATH.length - 1];
    }

    // Assets
    const img = {};
    let loaded = 0, ready = false;
    let pathIdx, pathPar, pathTraj, pathBase, layer, layerCtx, layerData;

    function prepare() {
        // Per-pixel reveal data for the trajectory overlay
        const read = function (im) {
            const c = makeCanvas(W, H);
            const cc = c.getContext('2d', { willReadFrequently: true });
            cc.drawImage(im, 0, 0, W, H);
            return cc.getImageData(0, 0, W, H).data;
        };
        const paths = read(img.paths);
        const rev = read(img.reveal);
        const idx = [];
        for (let i = 0; i < W * H; i++) {
            if (paths[i * 4 + 3] > 0 && rev[i * 4 + 1] > 0) idx.push(i);
        }
        pathIdx = new Int32Array(idx);
        pathPar = new Float32Array(idx.length);
        pathTraj = new Uint8Array(idx.length);
        pathBase = new Uint8ClampedArray(idx.length * 4);
        for (let k = 0; k < idx.length; k++) {
            const i = idx[k];
            pathPar[k] = rev[i * 4] / 255;
            pathTraj[k] = Math.round(rev[i * 4 + 1] / 85);
            for (let c = 0; c < 4; c++) pathBase[k * 4 + c] = paths[i * 4 + c];
        }
        layer = makeCanvas(W, H);
        layerCtx = layer.getContext('2d');
        layerData = layerCtx.createImageData(W, H);
        ready = true;
        t0 = performance.now();
    }

    Object.keys(IMAGES).forEach(function (k) {
        img[k] = new Image();
        img[k].onload = function () {
            if (++loaded === Object.keys(IMAGES).length) {
                try { prepare(); } catch (e) { /* stay on the plate */ }
            }
        };
        img[k].src = BASE + IMAGES[k];
    });

    let layerKey = '';
    function drawPaths(t, fade) {
        // The front runs past the end so the last flash settles too
        const prog = TRAJ.map(function (tr) { return tr ? ramp(t, tr.t0, tr.t1) * (1 + SOFT + GLOW) : 0; });
        const key = prog.join() + ',' + fade;
        if (key === layerKey) {
            ctx.drawImage(layer, 0, 0);
            return;
        }
        layerKey = key;
        const out = layerData.data;
        for (let k = 0; k < pathIdx.length; k++) {
            const o = pathIdx[k] * 4;
            const d = prog[pathTraj[k]] - pathPar[k];
            const a = clamp01(d / SOFT);
            if (a <= 0) {
                out[o + 3] = 0;
                continue;
            }
            // Fresh frustums flash towards white, then settle
            const g = d < GLOW ? 0.45 * (1 - d / GLOW) : 0;
            const b = k * 4;
            out[o] = pathBase[b] + (255 - pathBase[b]) * g;
            out[o + 1] = pathBase[b + 1] + (255 - pathBase[b + 1]) * g;
            out[o + 2] = pathBase[b + 2] + (255 - pathBase[b + 2]) * g;
            out[o + 3] = pathBase[b + 3] * a * fade;
        }
        layerCtx.putImageData(layerData, 0, 0);
        ctx.drawImage(layer, 0, 0);
    }

    function drawSprite(k, x, y, alpha, scale) {
        const b = BIKES[k];
        const s = scale || 1;
        ctx.globalAlpha = alpha;
        ctx.drawImage(img.bikes, b.sx, 0, b.sw, b.sh, x, y, b.sw * s, b.sh * s);
        ctx.globalAlpha = 1;
    }

    function drawBikes(t, fade) {
        const f = easeOut((t - FLY0) / (FLY1 - FLY0));
        // Copies left behind at the teaser's positions. The flyer wears the
        // sprite of the copy it heads to, so it matches each copy exactly
        // when passing over it, and becomes the last one on landing.
        for (let k = 0; k < BIKES.length; k++) {
            const passed = k === BIKES.length - 1 ? t >= FLY1 : f >= PASS[k];
            if (passed && fade > 0) drawSprite(k, BIKES[k].x, BIKES[k].y, fade);
        }
        if (t > FLY0 && t < FLY1) {
            const p = pathAt(f);
            const k = Math.max(0, Math.min(BIKES.length - 1, p.seg));
            const b = BIKES[k];
            const sc = p.h / b.sh;
            drawSprite(k, p.x - b.sw * sc / 2, p.y - b.sh * sc / 2, 1, sc);
        }
    }

    function drawFrame(t) {
        ctx.globalAlpha = 1;
        ctx.drawImage(img.plate, 0, 0, W, H);
        const fade = 1 - ramp(t, FADE0, FADE1);
        drawPaths(t, fade);
        drawBikes(t, fade);
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
        if (ready) {
            drawFrame(elapsed % CYCLE);
        } else {
            ctx.fillStyle = P.wait;
            ctx.fillRect(0, 0, W, H);
        }

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
