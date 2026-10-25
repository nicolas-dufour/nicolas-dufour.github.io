(function () {
    const canvas = document.getElementById('cadre-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Miniature of the CADRE live demo, in the Kyutai blog palette: the
    // blog's counterfactual rollouts (we steer, the world model follows)
    // play on a screen, the arrow keys light up with the steering read off
    // the camera yaw, and the CADRE latent beside them is the frame's 16×9
    // grid of tokens (32× spatial), regenerated from noise every 2 frames
    // (2× temporal). Clips hand over by encoding to tokens and decoding back.
    // Dark is the blog's palette; light deepens the hues to hold contrast.
    const PALETTES = {
        dark: { bg: '#121212', layer: '#191919', line: '#343434', mid: '#656565', muted: '#9d9d9d', text: '#EFEFEF', green: '#39F2AE', keyText: '#121212' },
        light: { bg: '#f1f4f8', layer: '#ffffff', line: '#d3dae3', mid: '#9aa4b1', muted: '#6b7686', text: '#1f2933', green: '#0b9a6b', keyText: '#ffffff' },
    };
    let P, BG_RGB;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() {
        P = isDark() ? PALETTES.dark : PALETTES.light;
        BG_RGB = hexToRgb(P.bg);
    }
    const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    // 48 frames at 10 fps per clip, tiled 8×6 at 320×180.
    // Steering intervals are in clip seconds.
    const CLIPS = [
        { src: '/assets/publications/cadre/rollout-snow.webp', steer: [[1.0, 4.2, 'left']] },
        { src: '/assets/publications/cadre/rollout-pedestrians.webp', steer: [[0.5, 3.1, 'right']] },
        { src: '/assets/publications/cadre/rollout-hedge.webp', steer: [[0.8, 3.0, 'left']] },
    ];
    const FW = 320, FH = 180, COLS = 8, FRAMES = 48, FPS = 10;
    const TX = 16, TY = 9;               // latent tokens per frame
    const T_COMP = 2;                    // frames per latent frame

    // Layout
    const SX = 14, SY = 14, SW = 332, SH = 187;     // screen
    const KEY_W = 40, KEY_H = 36, KEY_GAP = 6;
    const KX = 16, KY = 236;                        // key cluster top-left
    const PITCH = 9, TOKEN = 8;
    const LX = 188, LY = 232;                       // latent grid top-left
    const LW = TX * PITCH, LH = TY * PITCH;
    const LAYER_D = 4;

    // Timeline (seconds within one clip)
    const CLIP = FRAMES / FPS;
    const ENC = 0.45;                    // pixelate in / out at clip edges
    const DENOISE = 0.12;                // noisy -> clean tokens for a new latent
    const NOISE_MIX = 0.6;

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
    const pixCanvas = makeCanvas(FW, FH);
    const pixCtx = pixCanvas.getContext('2d');

    // Token colours of every frame: box-filter each frame down to 16×9.
    function tokensOf(img) {
        const mid = makeCanvas(TX * 4, TY * 4);
        const midCtx = mid.getContext('2d');
        const small = makeCanvas(TX, TY);
        const smallCtx = small.getContext('2d', { willReadFrequently: true });
        const out = [];
        for (let f = 0; f < FRAMES; f++) {
            midCtx.drawImage(img, (f % COLS) * FW, Math.floor(f / COLS) * FH, FW, FH, 0, 0, mid.width, mid.height);
            smallCtx.drawImage(mid, 0, 0, TX, TY);
            out.push(smallCtx.getImageData(0, 0, TX, TY).data);
        }
        return out;
    }

    CLIPS.forEach(function (clip) {
        clip.ready = false;
        clip.img = new Image();
        clip.img.onload = function () {
            try {
                clip.tokens = tokensOf(clip.img);
                clip.ready = true;
                if (clip === CLIPS[0]) t0 = performance.now();
            } catch (e) { /* stay on the noise placeholder */ }
        };
        clip.img.src = clip.src;
    });

    // Latent frame: per-token RGB, averaged over its T_COMP video frames
    function latentOf(clip, l) {
        const a = clip.tokens[Math.min(FRAMES - 1, l * T_COMP)];
        const b = clip.tokens[Math.min(FRAMES - 1, l * T_COMP + 1)];
        const out = new Float32Array(TX * TY * 3);
        for (let i = 0; i < TX * TY; i++) {
            for (let k = 0; k < 3; k++) out[i * 3 + k] = (a[i * 4 + k] + b[i * 4 + k]) / 2;
        }
        return out;
    }
    function noiseOf(seed) {
        const rnd = mulberry32(seed);
        const out = new Float32Array(TX * TY * 3);
        for (let i = 0; i < TX * TY; i++) {
            const g = 40 + rnd() * 150;
            out[i * 3] = g + (rnd() - 0.5) * 30;
            out[i * 3 + 1] = g + (rnd() - 0.5) * 30;
            out[i * 3 + 2] = g + (rnd() - 0.5) * 30;
        }
        return out;
    }

    function steerAt(clip, t) {
        for (const s of clip.steer) {
            if (t >= s[0] && t < s[1]) return s[2];
        }
        return null;
    }

    // Video frame at clip time t, cross-faded between the 10 fps samples
    function composeFrame(clip, t) {
        const x = Math.min(FRAMES - 1, t * FPS);
        const f = Math.floor(x);
        const g = Math.min(FRAMES - 1, f + 1);
        const img = clip.img;
        frameCtx.globalAlpha = 1;
        frameCtx.drawImage(img, (f % COLS) * FW, Math.floor(f / COLS) * FH, FW, FH, 0, 0, FW, FH);
        if (g !== f && x > f) {
            frameCtx.globalAlpha = x - f;
            frameCtx.drawImage(img, (g % COLS) * FW, Math.floor(g / COLS) * FH, FW, FH, 0, 0, FW, FH);
            frameCtx.globalAlpha = 1;
        }
    }

    function drawScreen(clip, t, now) {
        roundRect(SX, SY, SW, SH, 12);
        ctx.fillStyle = P.layer;
        ctx.fill();
        ctx.save();
        roundRect(SX, SY, SW, SH, 12);
        ctx.clip();
        if (clip && clip.ready) {
            composeFrame(clip, t);
            // Tokens at the clip edges: block size grows to one 32×32 patch
            const enc = Math.max(1 - ramp(t, 0, ENC), ramp(t, CLIP - ENC, CLIP));
            if (enc > 0.01) {
                const block = Math.pow(FW / TX, enc);
                const w = Math.max(TX, Math.round(FW / block));
                const h = Math.max(TY, Math.round(FH / block));
                pixCtx.imageSmoothingEnabled = true;
                pixCtx.drawImage(frameCanvas, 0, 0, w, h);
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(pixCanvas, 0, 0, w, h, SX, SY, SW, SH);
                ctx.imageSmoothingEnabled = true;
            } else {
                ctx.drawImage(frameCanvas, SX, SY, SW, SH);
            }
        } else {
            const cw = SW / TX, ch = SH / TY;
            const noise = noiseOf(Math.floor(now / 120));
            for (let i = 0; i < TX * TY; i++) {
                ctx.fillStyle = mix('#ffffff', 0.04 + 0.1 * noise[i * 3] / 255);
                ctx.fillRect(SX + (i % TX) * cw, SY + Math.floor(i / TX) * ch, cw + 0.5, ch + 0.5);
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
        ctx.fillStyle = mix(P.green, 1, 0.4 + 0.6 * pulse);
        ctx.beginPath();
        ctx.arc(SX + 24, SY + 22, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '600 14px ' + FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#EFEFEF';
        ctx.fillText('LIVE', SX + 34, SY + 23);
    }

    function drawArrowGlyph(cx, cy, dir, color) {
        const s = 7;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[dir]);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s, 1);
        ctx.lineTo(2.6, 1);
        ctx.lineTo(2.6, s);
        ctx.lineTo(-2.6, s);
        ctx.lineTo(-2.6, 1);
        ctx.lineTo(-s, 1);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawKey(x, y, dir, on) {
        const press = on ? 2 : 0;
        // Key side, then the cap (lit keys sink onto it)
        roundRect(x, y + 4, KEY_W, KEY_H - 4, 7);
        ctx.fillStyle = on ? mix(P.green, 0.6) : P.line;
        ctx.fill();
        roundRect(x, y + press, KEY_W, KEY_H - 4, 7);
        ctx.fillStyle = on ? P.green : P.layer;
        ctx.fill();
        if (!on) {
            ctx.strokeStyle = P.line;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        drawArrowGlyph(x + KEY_W / 2, y + press + (KEY_H - 4) / 2, dir, on ? P.keyText : P.muted);
    }

    function drawKeys(keys) {
        const x1 = KX + KEY_W + KEY_GAP;
        drawKey(x1, KY, 'up', keys.up);
        const y2 = KY + KEY_H + KEY_GAP;
        drawKey(KX, y2, 'left', keys.left);
        drawKey(x1, y2, 'down', false);
        drawKey(x1 + KEY_W + KEY_GAP, y2, 'right', keys.right);
    }

    let shownLatent = -1, shownClip = null, latentFrom = null, latentTo = null, latentT0 = 0;

    function drawLatent(clip, t, now) {
        // Channel layers behind the front grid, as in the blog figures
        for (let k = 2; k >= 1; k--) {
            roundRect(LX - 5 + k * LAYER_D, LY - 5 - k * LAYER_D, LW + 10, LH + 10, 4);
            ctx.fillStyle = P.layer;
            ctx.fill();
            ctx.strokeStyle = mix(P.green, 0.35);
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        roundRect(LX - 5, LY - 5, LW + 10, LH + 10, 4);
        ctx.fillStyle = P.layer;
        ctx.fill();
        ctx.strokeStyle = mix(P.green, 0.7);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        let cols;
        if (clip && clip.ready) {
            const l = Math.min(FRAMES / T_COMP - 1, Math.floor(t * FPS / T_COMP));
            if (l !== shownLatent || clip !== shownClip) {
                latentTo = latentOf(clip, l);
                latentFrom = noiseOf(1013 + l * 7919);
                for (let i = 0; i < latentFrom.length; i++) {
                    latentFrom[i] = latentTo[i] + (latentFrom[i] - latentTo[i]) * NOISE_MIX;
                }
                latentT0 = now;
                shownLatent = l;
                shownClip = clip;
            }
            const e = smooth((now - latentT0) / 1000 / DENOISE);
            cols = new Float32Array(TX * TY * 3);
            for (let i = 0; i < cols.length; i++) cols[i] = latentFrom[i] + (latentTo[i] - latentFrom[i]) * e;
        } else {
            cols = noiseOf(Math.floor(now / 120));
        }
        for (let i = 0; i < TX * TY; i++) {
            ctx.fillStyle = 'rgb(' + Math.round(cols[i * 3]) + ',' + Math.round(cols[i * 3 + 1]) + ',' + Math.round(cols[i * 3 + 2]) + ')';
            ctx.fillRect(LX + (i % TX) * PITCH + (PITCH - TOKEN) / 2, LY + Math.floor(i / TX) * PITCH + (PITCH - TOKEN) / 2, TOKEN, TOKEN);
        }

        ctx.font = '500 17px ' + FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = mix(P.green, 0.95);
        ctx.fillText('CADRE', LX - 5, LY + LH + 30);
        ctx.fillStyle = P.muted;
        ctx.textAlign = 'right';
        ctx.fillText('2×32×32', LX + LW + 5, LY + LH + 30);
    }

    // Actions go into the world model, which generates the next latent
    function drawFlow(active) {
        const ax0 = KX + 3 * KEY_W + 2 * KEY_GAP + 8, ax1 = LX - 14, ay = KY + KEY_H + KEY_GAP / 2;
        ctx.strokeStyle = active ? P.green : P.mid;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ax0, ay);
        ctx.lineTo(ax1 - 6, ay);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax1, ay);
        ctx.lineTo(ax1 - 8, ay - 5);
        ctx.lineTo(ax1 - 8, ay + 5);
        ctx.closePath();
        ctx.fill();
    }

    function drawFrame(clip, t, now) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, W, H);

        const playing = clip && clip.ready && t > ENC * 0.6 && t < CLIP - ENC * 0.6;
        const steer = playing ? steerAt(clip, t) : null;
        drawScreen(clip, t, now);
        drawFlow(!!steer);
        drawKeys({ up: playing, left: steer === 'left', right: steer === 'right' });
        drawLatent(clip, t, now);
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
        const idx = Math.floor(elapsed / CLIP);
        drawFrame(CLIPS[idx % CLIPS.length], elapsed - idx * CLIP, now);

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
