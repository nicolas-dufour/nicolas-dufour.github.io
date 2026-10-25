(function () {
    const canvas = document.getElementById('t2i-imagenet-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // A miniature text-to-image prompt box: a prompt types out, is sent, and
    // the sample denoises from noise, coarse to fine. Prompts and samples are
    // the paper's own (project page and paper figures), all from models
    // trained on ImageNet alone, which the chip in the corner recalls.
    const PALETTES = {
        dark: { panel: 'rgba(17,21,30,0.78)', edge: 'rgba(255,255,255,0.12)', text: '#f1f5f9', accent: '#63b3ed', icon: '#11151e' },
        light: { panel: 'rgba(255,255,255,0.88)', edge: 'rgba(15,23,42,0.10)', text: '#1f2933', accent: '#2b6cb0', icon: '#ffffff' },
    };
    let P;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() { P = isDark() ? PALETTES.dark : PALETTES.light; }
    const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    // Atlas of 360×360 tiles, 3 per row, in this order.
    const ATLAS = '/assets/publications/t2i_imagenet/samples.webp';
    const T = 360, COLS = 3;
    const SAMPLES = [
        'a fluffy corgi dog mid-flight with a red superhero cape',
        'A teddy bear driving a motorbike',
        'A hybrid creature with the body and shell of a tortoise and the head and neck of a giraffe.',
        'Multicolored butterfly atop a vibrant tangerine',
        'A metallic robot standing with faint blue light eyes',
        'A hedgehog and an hourglass',
    ];
    const N = SAMPLES.length;

    // Layout
    const BX = 12, BW = W - 24, BOTTOM = H - 12;     // prompt bar
    const PAD = 12, LINE = 24, BTN_R = 15;
    const TEXT_W = BW - 2 * PAD - 4;                // full lines
    const LAST_W = TEXT_W - 2 * BTN_R - 8;          // last line, beside the button
    const NOISE_PX = 3;

    // Timeline (seconds within one sample)
    const CLEAR = 0.25;          // old prompt fades, image blurs
    const CPS = 30;              // typing speed, characters per second
    const PAUSE = 0.35;          // before the prompt is sent
    const RENOISE = 0.25, DENOISE = 1.25;
    const HOLD = 2.4;
    const starts = [];
    let total = 0;
    for (let i = 0; i < N; i++) {
        starts.push(total);
        total += CLEAR + SAMPLES[i].length / CPS + PAUSE + RENOISE + DENOISE + HOLD;
    }
    const CYCLE = total;

    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
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

    // One fixed noise image per sample, the starting point of its sampling.
    const NW = Math.ceil(W / NOISE_PX), NH = Math.ceil(H / NOISE_PX);
    const noises = [];
    for (let k = 0; k < N; k++) {
        const c = makeCanvas(NW, NH);
        const cx = c.getContext('2d');
        const data = cx.createImageData(NW, NH);
        const rnd = mulberry32(2027 + k * 7919);
        for (let i = 0; i < NW * NH; i++) {
            const g = (rnd() + rnd() + rnd() - 1.5) * 150;
            for (let ch = 0; ch < 3; ch++) {
                data.data[i * 4 + ch] = Math.max(0, Math.min(255, 128 + g + (rnd() - 0.5) * 36));
            }
            data.data[i * 4 + 3] = 255;
        }
        cx.putImageData(data, 0, 0);
        noises.push(c);
    }

    // Each sample as a pyramid (full size, then halvings down to ~6 px):
    // upscaling a small level gives the coarse early estimate, or a blur.
    let pyramids = null;
    const atlas = new Image();
    atlas.onload = function () {
        try {
            const out = [];
            for (let i = 0; i < N; i++) {
                const levels = [];
                let c = makeCanvas(T, T);
                c.getContext('2d').drawImage(atlas, (i % COLS) * T, Math.floor(i / COLS) * T, T, T, 0, 0, T, T);
                levels.push(c);
                let s = T;
                while (s > 8) {
                    s = Math.round(s / 2);
                    const d = makeCanvas(s, s);
                    const dc = d.getContext('2d');
                    dc.imageSmoothingEnabled = true;
                    dc.imageSmoothingQuality = 'high';
                    dc.drawImage(c, 0, 0, s, s);
                    levels.push(d);
                    c = d;
                }
                out.push(levels);
            }
            pyramids = out;
        } catch (e) { /* stay on noise */ }
    };
    atlas.src = ATLAS;

    // Sample i at blur level L (0 = sharp, fractional levels cross-fade)
    function drawLevel(i, L) {
        const levels = pyramids[i];
        L = Math.max(0, Math.min(levels.length - 1, L));
        const lo = Math.floor(L), hi = Math.min(levels.length - 1, lo + 1);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.globalAlpha = 1;
        ctx.drawImage(levels[lo], 0, 0, W, H);
        if (L > lo) {
            ctx.globalAlpha = L - lo;
            ctx.drawImage(levels[hi], 0, 0, W, H);
        }
        ctx.globalAlpha = 1;
    }
    function drawNoise(k, alpha) {
        if (alpha <= 0.001) return;
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = alpha;
        ctx.drawImage(noises[k], 0, 0, NW * NOISE_PX, NH * NOISE_PX);
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = true;
    }

    // Greedy word wrap of a prompt to the bar width; the last line keeps
    // clear of the send button.
    function wrap(text) {
        const words = text.split(' ');
        const lines = [];
        let cur = '';
        for (const w of words) {
            const next = cur ? cur + ' ' + w : w;
            if (cur && ctx.measureText(next).width > TEXT_W) {
                lines.push(cur);
                cur = w;
            } else {
                cur = next;
            }
        }
        if (ctx.measureText(cur).width > LAST_W) {
            const cut = cur.lastIndexOf(' ');
            if (cut > 0) {
                lines.push(cur.slice(0, cut));
                cur = cur.slice(cut + 1);
            }
        }
        if (cur) lines.push(cur);
        return lines;
    }

    function drawChip() {
        ctx.font = '600 16px ' + FONT;
        const label = 'ImageNet only';
        const w = ctx.measureText(label).width + 36;
        roundRect(12, 12, w, 30, 15);
        ctx.fillStyle = P.panel;
        ctx.fill();
        ctx.strokeStyle = P.edge;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = P.accent;
        ctx.beginPath();
        ctx.arc(27, 27, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = P.text;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 38, 28);
    }

    // Prompt bar: typed text, caret, and a send button that turns into a
    // progress ring while the sample denoises.
    function drawBar(st) {
        ctx.font = '500 19px ' + FONT;
        const lines = wrap(st.text);
        const prevLines = st.prevText ? wrap(st.prevText).length : lines.length;
        const nLines = prevLines + (lines.length - prevLines) * smooth(st.grow);
        const h = nLines * LINE + 2 * PAD + 4;
        const y = BOTTOM - h;

        roundRect(BX, y, BW, h, 14);
        ctx.fillStyle = P.panel;
        ctx.fill();
        ctx.strokeStyle = P.edge;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Text: the old prompt fading out, or the new one typing in
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = P.text;
        const tx = BX + PAD + 2;
        const ty0 = BOTTOM - PAD - 8 - (lines.length - 1) * LINE;
        if (st.oldAlpha > 0 && st.prevText) {
            const old = wrap(st.prevText);
            ctx.globalAlpha = st.oldAlpha;
            const oy0 = BOTTOM - PAD - 8 - (old.length - 1) * LINE;
            old.forEach(function (l, j) { ctx.fillText(l, tx, oy0 + j * LINE); });
            ctx.globalAlpha = 1;
        }
        let left = st.typed, caretX = tx, caretY = ty0;
        if (st.oldAlpha <= 0) {
            for (let j = 0; j < lines.length && left > 0; j++) {
                const part = lines[j].slice(0, left);
                ctx.fillText(part, tx, ty0 + j * LINE);
                caretX = tx + ctx.measureText(part).width + 2;
                caretY = ty0 + j * LINE;
                left -= lines[j].length + 1;
            }
            if (st.caret) {
                ctx.fillStyle = P.accent;
                ctx.fillRect(caretX, caretY - 17, 2.5, 21);
            }
        }

        // Send button / progress ring
        const cx = BX + BW - PAD - BTN_R, cy = BOTTOM - PAD - BTN_R + 1;
        const r = BTN_R * (1 + 0.18 * Math.sin(Math.PI * clamp01(st.press)));
        ctx.globalAlpha = st.ready;
        ctx.fillStyle = P.accent;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (st.progress > 0 && st.progress < 1) {
            ctx.strokeStyle = P.icon;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(cx, cy, r - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * st.progress);
            ctx.stroke();
        } else {
            ctx.strokeStyle = P.icon;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(cx, cy + 7);
            ctx.lineTo(cx, cy - 7);
            ctx.moveTo(cx - 6, cy - 1);
            ctx.lineTo(cx, cy - 7);
            ctx.lineTo(cx + 6, cy - 1);
            ctx.stroke();
        }
    }

    function drawFrame(elapsed) {
        const tc = elapsed % CYCLE;
        let i = N - 1;
        while (i > 0 && starts[i] > tc) i--;
        const t = tc - starts[i];
        const prev = (i + N - 1) % N;
        const text = SAMPLES[i];
        const typeDur = text.length / CPS;
        const tType = CLEAR, tSend = CLEAR + typeDur + PAUSE;
        const tGen = tSend + RENOISE, tHold = tGen + DENOISE;

        // Image
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, W, H);
        if (pyramids) {
            if (t < tSend) {
                // The last sample blurs into the background while typing
                drawLevel(prev, 3.4 * smooth(t / 0.6));
            } else if (t < tGen) {
                drawLevel(prev, 3.4);
                drawNoise(i, smooth((t - tSend) / RENOISE));
            } else {
                const s = clamp01((t - tGen) / DENOISE);
                if (s < 1) {
                    drawLevel(i, (pyramids[i].length - 1) * (1 - Math.pow(s, 0.55)));
                    drawNoise(i, Math.pow(1 - s, 2));
                } else {
                    drawLevel(i, 0);
                }
            }
        } else {
            drawNoise(i, 1);
        }

        drawChip();

        const typed = Math.floor(clamp01((t - tType) / typeDur) * text.length + 1e-6);
        const blink = (Math.floor((t - tType) / 0.45) % 2) === 0;
        drawBar({
            text: text,
            prevText: SAMPLES[prev],
            grow: (t - 0.05) / 0.3,
            oldAlpha: 1 - smooth(t / CLEAR),
            typed: t < tType ? 0 : typed,
            caret: t >= tType && t < tSend && (typed < text.length || blink),
            ready: t < tType ? 1 - 0.6 * smooth(t / CLEAR) : 0.4 + 0.6 * smooth((t - tType - typeDur) / 0.2),
            press: (t - tSend + 0.1) / 0.3,
            progress: t >= tSend && t < tHold ? (t - tSend) / (tHold - tSend) : 0,
        });
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
        drawFrame(elapsed);

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
