(function () {
    const canvas = document.getElementById('scam-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Subject transfer with SCAM, on real test-set results from the paper's
    // subject transfer figure. Left: the subject reference (pink) and the
    // background reference (green). The big panel starts as the background
    // reference, turns into its semantic mask (the pose to keep), then the
    // SCAM output fills the mask region by region: background regions take
    // the background reference's appearance, subject regions the subject's.
    // Pink and green follow the paper's teaser figure and mask colours.
    const PALETTES = {
        dark: { bg: '#121212', layer: '#1b1b1b', line: '#343434', text: '#EFEFEF', subject: '#e0489a', scene: '#6cc463' },
        light: { bg: '#f1f4f8', layer: '#ffffff', line: '#d3dae3', text: '#1f2933', subject: '#bc1466', scene: '#3f9a3a' },
    };
    let P;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() { P = isDark() ? PALETTES.dark : PALETTES.light; }

    // Atlas rows are examples; photo columns: subject, background, SCAM output.
    // The mask atlas holds the matching flat-colour semantic masks.
    const PHOTOS = '/assets/publications/scam/transfer-photos.webp';
    const MASKS = '/assets/publications/scam/transfer-masks.png';
    const TW = 132, TH = 198, N = 4;
    const MW = 2 * TW, MH = 2 * TH;     // masks are stored at 2x
    const BG_LABEL = [102, 179, 92];    // background class colour in the masks

    // Layout
    const CX = 14, CW = 92, CH = 138;   // input cards
    const CY1 = 14, CY2 = H - 14 - CH;
    const PX = 126, PY = 14, PW = 220, PH = 332;  // output panel
    const R_CARD = 10, R_PANEL = 14;

    // Timeline (seconds within one example)
    const CYCLE = 7.0;
    const FADE = 0.5;                   // cross-fade from the previous example
    const SCAN0 = 1.2, SCAN1 = 1.9;     // background image -> semantic mask
    const BG0 = 2.15, BG_DUR = 0.8;     // background regions fill
    const SUB0 = 3.1, SUB_SPREAD = 0.6, SUB_DUR = 0.8;   // subject regions fill
    const FILL_END = SUB0 + SUB_SPREAD + SUB_DUR;
    const SOFT = 34;                    // half-width of the soft wipe edge

    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
    function ramp(t, a, b) { return smooth((t - a) / (b - a)); }
    function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function rgba(hex, a) {
        const c = hexToRgb(hex);
        return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
    }

    function roundRect(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    }

    function makeCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    }
    // Whole frame of one example (so examples cross-fade as a unit), and a
    // panel-sized scratch for the masked wipes.
    const stage = makeCanvas(W, H);
    const sctx = stage.getContext('2d');
    const scratch = makeCanvas(PW, PH);
    const xctx = scratch.getContext('2d');
    sctx.imageSmoothingQuality = 'high';
    xctx.imageSmoothingQuality = 'high';

    // Example data: tiles plus one layer per mask class (output pixels of
    // that class, transparent elsewhere), background first, then larger first.
    let examples = null;
    function tile(img, col, row, w, h, sw, sh) {
        const c = makeCanvas(w, h);
        const cc = c.getContext('2d', { willReadFrequently: true });
        cc.imageSmoothingQuality = 'high';
        cc.drawImage(img, col * sw, row * sh, sw, sh, 0, 0, w, h);
        return c;
    }
    function buildExample(photos, masks, i) {
        const ex = {
            subject: tile(photos, 0, i, TW, TH, TW, TH),
            scene: tile(photos, 1, i, TW, TH, TW, TH),
            result: tile(photos, 2, i, TW, TH, TW, TH),
            mask: tile(masks, 0, i, MW, MH, MW, MH),
        };
        // Output upsampled to the mask grid, split by mask class
        const md = ex.mask.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, MW, MH).data;
        const rd = tile(photos, 2, i, MW, MH, TW, TH).getContext('2d', { willReadFrequently: true }).getImageData(0, 0, MW, MH).data;
        const groups = new Map();
        for (let p = 0; p < MW * MH; p++) {
            const key = (md[p * 4] << 16) | (md[p * 4 + 1] << 8) | md[p * 4 + 2];
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(p);
        }
        ex.classes = [];
        groups.forEach(function (pixels, key) {
            const layer = makeCanvas(MW, MH);
            const lctx = layer.getContext('2d');
            const ld = lctx.createImageData(MW, MH);
            for (const p of pixels) {
                for (let k = 0; k < 3; k++) ld.data[p * 4 + k] = rd[p * 4 + k];
                ld.data[p * 4 + 3] = 255;
            }
            lctx.putImageData(ld, 0, 0);
            const rgb = [(key >> 16) & 255, (key >> 8) & 255, key & 255];
            const isBg = Math.abs(rgb[0] - BG_LABEL[0]) + Math.abs(rgb[1] - BG_LABEL[1]) + Math.abs(rgb[2] - BG_LABEL[2]) < 30;
            ex.classes.push({ layer: layer, count: pixels.length, bg: isBg });
        });
        ex.classes.sort(function (a, b) { return (b.bg - a.bg) || (b.count - a.count); });
        // Subject classes start staggered within SUB_SPREAD
        const subs = ex.classes.filter(function (c) { return !c.bg; });
        const step = subs.length > 1 ? Math.min(0.18, SUB_SPREAD / (subs.length - 1)) : 0;
        ex.classes.forEach(function (c) {
            c.start = c.bg ? BG0 : SUB0 + step * subs.indexOf(c);
            c.dur = c.bg ? BG_DUR : SUB_DUR;
        });
        return ex;
    }

    let loaded = 0;
    const photosImg = new Image();
    const masksImg = new Image();
    function onLoad() {
        loaded++;
        if (loaded < 2) return;
        try {
            const list = [];
            for (let i = 0; i < N; i++) list.push(buildExample(photosImg, masksImg, i));
            examples = list;
            t0 = performance.now();
        } catch (e) { /* stay on the empty frames */ }
    }
    photosImg.onload = onLoad;
    masksImg.onload = onLoad;
    photosImg.src = PHOTOS;
    masksImg.src = MASKS;

    // Wipe directions (unit vectors): the background sweeps in from the
    // background card's corner (bottom left), the subject from the subject
    // card's (top left), the mask scans down.
    const DIRS = {
        down: [0, 1],
        bg: [0.6, -0.8],
        subject: [0.6, 0.8],
    };
    function frontRange(dir) {
        const ps = [0, dir[0] * PW, dir[1] * PH, dir[0] * PW + dir[1] * PH];
        return [Math.min.apply(null, ps), Math.max.apply(null, ps)];
    }
    // Gradient across the wipe front at progress p, from the revealed side
    function frontGradient(dir, p, half, stops) {
        const r = frontRange(dir);
        const f = r[0] - half + (r[1] - r[0] + 2 * half) * p;
        const g = xctx.createLinearGradient(dir[0] * (f - half), dir[1] * (f - half), dir[0] * (f + half), dir[1] * (f + half));
        stops.forEach(function (s, i) { g.addColorStop(i / (stops.length - 1), s); });
        return g;
    }

    // Draw src (a mask-grid layer) into the panel, revealed up to the wipe front
    function wipe(src, dir, p) {
        if (p <= 0) return;
        xctx.globalCompositeOperation = 'source-over';
        xctx.clearRect(0, 0, PW, PH);
        xctx.drawImage(src, 0, 0, MW, MH, 0, 0, PW, PH);
        if (p < 1) {
            xctx.globalCompositeOperation = 'destination-in';
            xctx.fillStyle = frontGradient(dir, p, SOFT, ['rgba(0,0,0,1)', 'rgba(0,0,0,0)']);
            xctx.fillRect(0, 0, PW, PH);
            xctx.globalCompositeOperation = 'source-over';
        }
        sctx.drawImage(scratch, PX, PY);
    }
    // Coloured band riding the wipe front, inside the region (the layer's alpha)
    function frontGlow(cover, dir, p, color) {
        if (p <= 0 || p >= 1) return;
        xctx.globalCompositeOperation = 'source-over';
        xctx.clearRect(0, 0, PW, PH);
        if (cover) {
            xctx.drawImage(cover, 0, 0, MW, MH, 0, 0, PW, PH);
            xctx.globalCompositeOperation = 'source-in';
        }
        xctx.fillStyle = frontGradient(dir, p, 16, [rgba(color, 0), rgba(color, 0.95), rgba(color, 0)]);
        xctx.fillRect(0, 0, PW, PH);
        xctx.globalCompositeOperation = 'source-over';
        sctx.drawImage(scratch, PX, PY);
    }

    function drawPanel(ex, t) {
        sctx.save();
        roundRect(sctx, PX, PY, PW, PH, R_PANEL);
        sctx.clip();
        if (t >= FILL_END) {
            sctx.drawImage(ex.result, 0, 0, TW, TH, PX, PY, PW, PH);
        } else {
            const scan = ramp(t, SCAN0, SCAN1);
            if (scan < 1) sctx.drawImage(ex.scene, 0, 0, TW, TH, PX, PY, PW, PH);
            wipe(ex.mask, DIRS.down, scan);
            frontGlow(null, DIRS.down, scan, '#ffffff');
            for (const c of ex.classes) {
                const p = smooth((t - c.start) / c.dur);
                wipe(c.layer, c.bg ? DIRS.bg : DIRS.subject, p);
            }
            for (const c of ex.classes) {
                const p = smooth((t - c.start) / c.dur);
                frontGlow(c.layer, c.bg ? DIRS.bg : DIRS.subject, p, c.bg ? P.scene : P.subject);
            }
        }
        sctx.restore();
        roundRect(sctx, PX, PY, PW, PH, R_PANEL);
        sctx.strokeStyle = P.line;
        sctx.lineWidth = 2;
        sctx.stroke();
    }

    function drawCard(img, y, color, glow) {
        if (glow > 0.01) {
            sctx.save();
            sctx.shadowColor = rgba(color, 0.9 * glow);
            sctx.shadowBlur = 22 * glow;
            roundRect(sctx, CX, y, CW, CH, R_CARD);
            sctx.fillStyle = color;
            sctx.fill();
            sctx.restore();
        }
        sctx.save();
        roundRect(sctx, CX, y, CW, CH, R_CARD);
        sctx.clip();
        if (img) {
            sctx.drawImage(img, 0, 0, TW, TH, CX, y, CW, CH);
        } else {
            sctx.fillStyle = P.layer;
            sctx.fillRect(CX, y, CW, CH);
        }
        sctx.restore();
        roundRect(sctx, CX + 1.5, y + 1.5, CW - 3, CH - 3, R_CARD - 1.5);
        sctx.strokeStyle = color;
        sctx.lineWidth = 3 + 2 * glow;
        sctx.stroke();
    }

    // Arrowhead from a card towards the panel
    function drawFeed(y, color, on) {
        const x = CX + CW + 10, s = 8;
        sctx.fillStyle = rgba(color, 0.5 + 0.5 * on);
        sctx.beginPath();
        sctx.moveTo(x - s * 0.6, y - s);
        sctx.lineTo(x + s * 0.7, y);
        sctx.lineTo(x - s * 0.6, y + s);
        sctx.closePath();
        sctx.fill();
    }

    function renderExample(ex, t) {
        sctx.globalAlpha = 1;
        sctx.fillStyle = P.bg;
        sctx.fillRect(0, 0, W, H);
        const sceneGlow = ramp(t, SCAN0 - 0.2, SCAN0 + 0.2) * (1 - ramp(t, BG0 + BG_DUR - 0.1, BG0 + BG_DUR + 0.3));
        const subjGlow = ramp(t, SUB0 - 0.25, SUB0 + 0.15) * (1 - ramp(t, FILL_END - 0.2, FILL_END + 0.3));
        drawCard(ex ? ex.subject : null, CY1, P.subject, subjGlow);
        drawCard(ex ? ex.scene : null, CY2, P.scene, sceneGlow);
        drawFeed(CY1 + CH / 2, P.subject, subjGlow);
        drawFeed(CY2 + CH / 2, P.scene, sceneGlow);
        if (ex) {
            drawPanel(ex, t);
        } else {
            roundRect(sctx, PX, PY, PW, PH, R_PANEL);
            sctx.fillStyle = P.layer;
            sctx.fill();
        }
    }

    function drawFrame(idx, t) {
        ctx.globalAlpha = 1;
        if (!examples) {
            renderExample(null, 0);
            ctx.drawImage(stage, 0, 0);
            return;
        }
        const cur = examples[idx % N];
        if (t < FADE && idx > 0) {
            renderExample(examples[(idx + N - 1) % N], CYCLE);
            ctx.drawImage(stage, 0, 0);
            ctx.globalAlpha = smooth(t / FADE);
        }
        renderExample(cur, t);
        ctx.drawImage(stage, 0, 0);
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
