(function () {
    const canvas = document.getElementById('aura-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Miniature of AURA streaming a talking head, in the Kyutai blog palette.
    // Speech arrives one chunk at a time (no audio look-ahead). Once a
    // chunk's audio is in, its 4 latent frames are denoised in 4 steps,
    // attending to a rolling KV cache: the first chunk as a fixed identity
    // anchor (purple) and the most recent chunk (gray), as in the blog's
    // attention-context figure. The finished chunk becomes the recent one
    // and plays on the screen while the next chunk is generated.
    // Frames are real AURA 1.3B output from the blog (16 fps), and the bars
    // are the speech envelope of the same clip.
    const PALETTES = {
        dark: { bg: '#121212', layer: '#191919', line: '#343434', mid: '#656565', muted: '#9d9d9d', text: '#EFEFEF', green: '#39F2AE', anchor: '#a57de8', recent: '#7a828c' },
        light: { bg: '#f1f4f8', layer: '#ffffff', line: '#d3dae3', mid: '#9aa4b1', muted: '#6b7686', text: '#1f2933', green: '#0b9a6b', anchor: '#7a4fd0', recent: '#8a939e' },
    };
    let P, BG_RGB;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() {
        P = isDark() ? PALETTES.dark : PALETTES.light;
        BG_RGB = hexToRgb(P.bg);
    }
    const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    // 64 frames (4 chunks of 1 s at 16 fps), tiled 8×8 at 288×200.
    const SRC = '/assets/publications/aura/stream.webp';
    const FW = 288, FH = 200, COLS = 8, FRAMES = 64;
    const CHUNK_FRAMES = 16, LAT = 4, NCH = FRAMES / CHUNK_FRAMES;
    // Face square inside a frame, for the latent-frame tiles
    const FACE = { x: 92, y: 52, s: 140 };
    // Speech envelope at 24 Hz (sqrt RMS, normalized): 24 bars per chunk
    const AUDIO = [0.48, 0.47, 0.45, 0.32, 0.15, 0.07, 0.63, 0.85, 1, 1, 0.73, 0.6, 0.26, 0.27, 0.63, 0.68, 0.72, 0.99, 0.93, 0.67, 0.23, 0.14, 0.16, 0.46,
        0.68, 0.58, 0.25, 0.18, 0.09, 0.04, 0.62, 0.65, 0.26, 0.06, 0.04, 0.25, 0.69, 0.57, 0.65, 0.47, 0.18, 0.53, 0.56, 0.46, 0.17, 0.21, 0.48, 0.59,
        0.61, 0.34, 0.17, 0.19, 0.33, 0.37, 0.55, 0.55, 0.56, 0.62, 0.5, 0.3, 0.4, 0.73, 0.83, 0.81, 0.76, 0.58, 0.27, 0.25, 0.32, 0.61, 0.75, 0.61,
        0.33, 0.25, 0.06, 0.06, 0.57, 0.65, 0.67, 0.66, 0.68, 0.49, 0.2, 0.12, 0.14, 0.88, 0.9, 0.53, 0.23, 0.1, 0.07, 0.06, 0.06, 0.05, 0.05, 0.05];
    const BARS = 24;

    // Layout
    const SX = 14, SY = 14, SW = 332, SH = 230;     // screen
    const TILE = 22, TGAP = 2, PAD = 3;
    const GW = PAD * 2 + LAT * TILE + (LAT - 1) * TGAP;   // group box width (100)
    const GH = PAD * 2 + TILE;
    const GX = { anchor: 14, recent: 134, next: 246 };
    const GY = 290;
    const AY = 270, AMP = 13;                       // audio lane centre, max half-height
    const LABEL_Y = 339;

    // Timeline within one chunk period (fractions of PERIOD)
    const PERIOD = 1.4;                  // seconds per 1 s chunk (video plays at 0.71×)
    const HAND = 0.16;                   // finished chunk slides into "recent"
    const AUD0 = 0.16, AUD1 = 0.6;       // next chunk's speech arrives
    const DEN0 = 0.62, DEN1 = 0.96;      // 4 denoising steps
    const STEPS = 4;

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
    function lerpHex(a, b, t) {
        const x = hexToRgb(a), y = hexToRgb(b);
        return 'rgb(' + x.map(function (v, i) { return Math.round(v + (y[i] - v) * t); }).join(',') + ')';
    }
    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
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

    function makeCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    }
    const frameCanvas = makeCanvas(FW, FH);
    const frameCtx = frameCanvas.getContext('2d');

    // Gaussian-ish noise tiles (11×11, drawn without smoothing) for the
    // latent frames being denoised; a fresh draw at every step.
    const NOISE_TILES = [];
    (function () {
        const rnd = mulberry32(20261120);
        for (let k = 0; k < 16; k++) {
            const c = makeCanvas(11, 11);
            const cx = c.getContext('2d');
            const img = cx.createImageData(11, 11);
            for (let i = 0; i < 121; i++) {
                const g = 30 + (rnd() + rnd() + rnd()) / 3 * 200;
                img.data[i * 4] = g + (rnd() - 0.5) * 50;
                img.data[i * 4 + 1] = g + (rnd() - 0.5) * 50;
                img.data[i * 4 + 2] = g + (rnd() - 0.5) * 50;
                img.data[i * 4 + 3] = 255;
            }
            cx.putImageData(img, 0, 0);
            NOISE_TILES.push(c);
        }
    })();

    let ready = false;
    const atlas = new Image();
    atlas.onload = function () {
        ready = true;
        t0 = performance.now();
    };
    atlas.src = SRC;

    function frameXY(f) {
        return [(f % COLS) * FW, Math.floor(f / COLS) * FH];
    }

    // Video frame at fractional index x, cross-faded between samples
    function composeFrame(x) {
        const f = Math.floor(x) % FRAMES;
        const g = (f + 1) % FRAMES;
        const a = frameXY(f), b = frameXY(g);
        frameCtx.globalAlpha = 1;
        frameCtx.drawImage(atlas, a[0], a[1], FW, FH, 0, 0, FW, FH);
        const w = x - Math.floor(x);
        if (w > 0.01) {
            frameCtx.globalAlpha = w;
            frameCtx.drawImage(atlas, b[0], b[1], FW, FH, 0, 0, FW, FH);
            frameCtx.globalAlpha = 1;
        }
    }

    function drawScreen(x, now) {
        roundRect(SX, SY, SW, SH, 12);
        ctx.fillStyle = P.layer;
        ctx.fill();
        ctx.save();
        roundRect(SX, SY, SW, SH, 12);
        ctx.clip();
        if (ready) {
            composeFrame(x);
            // The frame is 288×200 (1.44); the screen is a touch wider, so
            // fill its width and trim top and bottom evenly.
            const scale = SW / FW;
            const h = FH * scale;
            ctx.drawImage(frameCanvas, SX, SY + (SH - h) / 2, SW, h);
        } else {
            const cols = 24, rows = 17;
            const rnd = mulberry32(Math.floor(now / 120));
            for (let i = 0; i < cols * rows; i++) {
                ctx.fillStyle = mix(P.text, 0.04 + 0.12 * rnd());
                ctx.fillRect(SX + (i % cols) * SW / cols, SY + Math.floor(i / cols) * SH / rows, SW / cols + 0.5, SH / rows + 0.5);
            }
        }
        ctx.restore();
        roundRect(SX, SY, SW, SH, 12);
        ctx.strokeStyle = P.line;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Live chip
        const pulse = 0.55 + 0.45 * Math.sin(now / 260);
        roundRect(SX + 10, SY + 10, 64, 24, 12);
        ctx.fillStyle = 'rgba(18,18,18,0.62)';
        ctx.fill();
        ctx.fillStyle = 'rgba(57,242,174,' + (0.4 + 0.6 * pulse) + ')';
        ctx.beginPath();
        ctx.arc(SX + 24, SY + 22, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '600 14px ' + FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#EFEFEF';
        ctx.fillText('LIVE', SX + 34, SY + 23);
    }

    // One latent frame: the middle video frame of its 4, cropped to the face
    function drawTile(x, y, chunk, l, noise, noiseSeed) {
        ctx.save();
        roundRect(x, y, TILE, TILE, 3);
        ctx.clip();
        if (ready && noise < 0.999) {
            const f = frameXY(chunk * CHUNK_FRAMES + l * LAT + 2);
            ctx.drawImage(atlas, f[0] + FACE.x, f[1] + FACE.y, FACE.s, FACE.s, x, y, TILE, TILE);
        }
        if (noise > 0.001 || !ready) {
            ctx.globalAlpha *= ready ? noise : 1;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(NOISE_TILES[noiseSeed % NOISE_TILES.length], x, y, TILE, TILE);
            ctx.imageSmoothingEnabled = true;
        }
        ctx.restore();
    }

    // A chunk: group box with its 4 latent frames, and its speech above.
    // bars: how many of the 24 bars have arrived; noise: per-tile level.
    function drawGroup(x, color, chunk, opts) {
        const alpha = opts.alpha === undefined ? 1 : opts.alpha;
        if (alpha <= 0.01) return;
        ctx.save();
        ctx.globalAlpha = alpha;

        // Speech bars over the tiles
        const x0 = x + PAD, span = GW - 2 * PAD;
        const pitch = span / BARS, bw = pitch * 0.62;
        const nb = opts.bars === undefined ? BARS : opts.bars;
        for (let b = 0; b < BARS; b++) {
            if (b >= Math.ceil(nb)) break;
            const grow = clamp01(nb - b);
            const v = AUDIO[chunk * BARS + b];
            const h = Math.max(2.5, v * AMP * 2) * (0.35 + 0.65 * smooth(grow));
            ctx.fillStyle = opts.barColor || color;
            roundRect(x0 + b * pitch + (pitch - bw) / 2, AY - h / 2, bw, h, Math.min(bw / 2, h / 2));
            ctx.fill();
        }

        // Box
        roundRect(x, GY, GW, GH, 5);
        ctx.fillStyle = P.layer;
        ctx.fill();
        ctx.lineWidth = opts.lineWidth || 1.6;
        ctx.strokeStyle = color;
        ctx.stroke();
        for (let l = 0; l < LAT; l++) {
            drawTile(x + PAD + l * (TILE + TGAP), GY + PAD, chunk, l,
                opts.noise === undefined ? 0 : opts.noise, (opts.seed || 0) + l * 5);
        }
        ctx.restore();
    }

    function drawLabel(text, cx, color) {
        ctx.font = '600 16px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = color;
        ctx.fillText(text, cx, LABEL_Y);
    }

    function drawFrame(elapsed, now) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, W, H);

        // Period j: the screen plays chunk j (the recent one) while chunk
        // j+1 is generated. Indices wrap, so the loop is seamless.
        const idx = Math.floor(elapsed / PERIOD);
        const u = elapsed / PERIOD - idx;
        const j = idx % NCH;
        const next = (j + 1) % NCH;
        const prev = (j + NCH - 1) % NCH;

        drawScreen(j * CHUNK_FRAMES + u * CHUNK_FRAMES, now);

        // Anchor: the first chunk, kept for the whole stream
        drawGroup(GX.anchor, P.anchor, 0, { barColor: mix(P.anchor, 0.7) });
        ctx.font = '700 18px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = P.mid;
        ctx.fillText('…', (GX.anchor + GW + GX.recent) / 2, GY + GH / 2 - 2);

        // Hand-over: the finished chunk slides into "recent", the old
        // recent leaves the rolling window first and the empty slot for the
        // next chunk fades in last, so the three never pile up.
        const v = clamp01(u / HAND);
        const e = smooth(v);
        drawGroup(GX.recent - 16 * smooth(v * 2.5), P.recent, prev, { alpha: 1 - smooth(v * 2.5), barColor: mix(P.recent, 0.8) });

        // Next chunk: speech arrives, then 4 denoising steps
        const bars = BARS * clamp01((u - AUD0) / (AUD1 - AUD0));
        let noise = 1, step = -1, inStep = 0;
        if (u >= DEN0) {
            const s = (u - DEN0) / (DEN1 - DEN0) * STEPS;
            step = Math.min(STEPS - 1, Math.floor(s));
            inStep = s - step;
            noise = u >= DEN1 ? 0 : lerp(1 - step / STEPS, 1 - (step + 1) / STEPS, smooth(inStep / 0.4));
        }
        const denoising = u >= DEN0 && u < DEN1;
        drawGroup(GX.next, P.green, next, {
            alpha: smooth((v - 0.55) / 0.45),
            bars: bars,
            noise: noise,
            seed: idx * 7 + Math.max(0, step + 1) * 3,
            lineWidth: denoising ? 2.4 : 1.6,
        });

        const rx = lerp(GX.next, GX.recent, e);
        const rc = lerpHex(P.green, P.recent, e);
        drawGroup(rx, rc, j, { barColor: e < 1 ? lerpHex(P.green, mix(P.recent, 0.8), e) : mix(P.recent, 0.8) });

        // Playhead: the recent chunk is what the screen is showing
        const px = rx + PAD + u * (GW - 2 * PAD);
        ctx.strokeStyle = mix(P.text, 0.85, 0.85);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, AY - AMP - 3);
        ctx.lineTo(px, GY + GH + 3);
        ctx.stroke();

        // Labels; under the new chunk, one dot per denoising step
        drawLabel('anchor', GX.anchor + GW / 2, P.anchor);
        drawLabel('recent', GX.recent + GW / 2, P.muted);
        const done = u >= DEN1 ? STEPS : (step < 0 ? 0 : step + (inStep > 0.4 ? 1 : 0));
        const dcx = GX.next + GW / 2;
        for (let k = 0; k < STEPS; k++) {
            ctx.beginPath();
            ctx.arc(dcx + (k - 1.5) * 16, LABEL_Y - 6, 5, 0, Math.PI * 2);
            if (k < done) {
                ctx.fillStyle = P.green;
                ctx.fill();
            } else {
                ctx.strokeStyle = k === done && denoising ? P.green : P.mid;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
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
        drawFrame(elapsed, now);

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
