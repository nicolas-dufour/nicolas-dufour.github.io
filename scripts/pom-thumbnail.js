(function () {
    const canvas = document.getElementById('pom-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Top: a film strip of SiPoM-XL/2 samples (the paper's class-conditional
    // ImageNet 256 mosaic, attention replaced by PoM). Bottom: the paper's
    // teaser plot (a), H100 time of the token mixer against sequence length.
    // A playhead sweeps from 2^8 to 2^16 tokens: plain self-attention runs
    // out of memory after 2^10, FlashAttention climbs, PoM stays flat; the
    // gap at 2^16 tokens is shown at the end. Colours follow the paper.
    const PALETTES = {
        dark: { bg: '#1f2633', grid: '#2f3a4c', axis: '#6b7686', muted: '#a0aec0', pom: '#7ddc1f', attn: '#7f9cf5', flash: '#c58af0', oom: '#ff6b6b', chip: 'rgba(18,22,30,0.72)' },
        light: { bg: '#eef2f7', grid: '#dce3ec', axis: '#9aa4b1', muted: '#6b7686', pom: '#4f9e00', attn: '#466edc', flash: '#8b1f9b', oom: '#d93636', chip: 'rgba(18,22,30,0.62)' },
    };
    let P;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() { P = isDark() ? PALETTES.dark : PALETTES.light; }
    const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    // Teaser (a): execution time (ms per batch of 2^18 tokens) at log2(length)
    const POM = [[8, 5.415], [9, 5.403], [10, 5.411], [11, 5.437], [12, 5.594], [13, 5.985], [14, 6.934], [15, 8.970], [16, 13.171]];
    const ATTN = [[8, 23.002], [9, 35.250], [10, 59.793]];
    const FLASH = [[8, 4.756], [9, 5.681], [10, 7.511], [11, 11.099], [12, 18.207], [13, 32.317], [14, 60.612], [15, 117.260], [16, 230.486]];
    const YMAX = 250;

    // Layout
    const IX = 14, IY = 14, IW = 332, IH = 170;       // image strip
    const TILE = IH, GAP = 6, SAMPLES = 10, SRC_T = 192;
    const STRIP_SPEED = 22;                           // px per second
    const PX0 = 30, PX1 = 336, PY0 = 210, PY1 = 324;  // plot area
    const AXIS_Y = PY1 + 8;                           // x axis, below zero so PoM's flat line stays visible

    // Timeline (seconds within one loop)
    const CYCLE = 9.5;
    const IN1 = 0.4;
    const SWEEP0 = 0.6, SWEEP1 = 5.4;
    const GAP0 = 5.6, GAP1 = 6.2;
    const OUT0 = 8.8, OUT1 = 9.5;

    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
    function ramp(t, a, b) { return smooth((t - a) / (b - a)); }
    function easeInOut(x) {
        x = clamp01(x);
        return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    }
    function px(l) { return PX0 + (l - 8) / 8 * (PX1 - PX0); }
    function py(v) { return PY1 - Math.min(v, YMAX) / YMAX * (PY1 - PY0); }
    function valueAt(data, l) {
        for (let i = 1; i < data.length; i++) {
            if (l <= data[i][0]) {
                const a = data[i - 1], b = data[i];
                return a[1] + (b[1] - a[1]) * (l - a[0]) / (b[0] - a[0]);
            }
        }
        return data[data.length - 1][1];
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

    const strip = new Image();
    let stripReady = false;
    strip.onload = function () { stripReady = true; };
    strip.src = '/assets/publications/pom/sipom-samples.webp';
    const apple = new Image();
    let appleReady = false;
    apple.onload = function () { appleReady = true; };
    apple.src = '/assets/publications/pom/apple.webp';

    function drawStrip(elapsed) {
        ctx.save();
        roundRect(IX, IY, IW, IH, 12);
        ctx.fillStyle = P.grid;
        ctx.fill();
        ctx.clip();
        if (stripReady) {
            const period = SAMPLES * (TILE + GAP);
            const off = (elapsed * STRIP_SPEED) % period;
            for (let j = 0; j < SAMPLES + 3; j++) {
                const x = IX + j * (TILE + GAP) - off;
                if (x > IX + IW || x + TILE < IX) continue;
                const k = j % SAMPLES;
                ctx.drawImage(strip, k * SRC_T, 0, SRC_T, SRC_T, x, IY, TILE, TILE);
            }
        }
        ctx.restore();

        // Chip: the samples come from the PoM model
        roundRect(IX + 10, IY + 10, 88, 28, 14);
        ctx.fillStyle = P.chip;
        ctx.fill();
        if (appleReady) ctx.drawImage(apple, IX + 15, IY + 13, 22, 22);
        ctx.font = '600 15px ' + FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('SiPoM', IX + 41, IY + 25);
    }

    function curve(data, upTo, color, width, dash) {
        if (upTo <= data[0][0]) return null;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash(dash || []);
        ctx.beginPath();
        ctx.moveTo(px(data[0][0]), py(data[0][1]));
        const end = Math.min(upTo, data[data.length - 1][0]);
        for (let i = 1; i < data.length && data[i][0] < end; i++) ctx.lineTo(px(data[i][0]), py(data[i][1]));
        const head = { x: px(end), y: py(valueAt(data, end)) };
        ctx.lineTo(head.x, head.y);
        ctx.stroke();
        ctx.setLineDash([]);
        return head;
    }

    function drawPlot(t) {
        // Axes and a light grid (one line per doubling of the length)
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = P.grid;
        for (let l = 9; l <= 16; l++) {
            ctx.beginPath();
            ctx.moveTo(px(l), PY0);
            ctx.lineTo(px(l), AXIS_Y);
            ctx.stroke();
        }
        ctx.strokeStyle = P.axis;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PX0, PY0 - 4);
        ctx.lineTo(PX0, AXIS_Y);
        ctx.lineTo(PX1 + 4, AXIS_Y);
        ctx.stroke();

        ctx.font = '500 14px ' + FONT;
        ctx.fillStyle = P.muted;
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        ctx.fillText('256', PX0 - 2, AXIS_Y + 19);
        ctx.textAlign = 'right';
        ctx.fillText('65k tokens', PX1 + 4, AXIS_Y + 19);
        ctx.save();
        ctx.translate(PX0 - 9, PY0 + 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'right';
        ctx.fillText('time', 0, 0);
        ctx.restore();

        // Playhead in log2(length)
        const l = 8 + 8 * easeInOut((t - SWEEP0) / (SWEEP1 - SWEEP0));
        const sweeping = t > SWEEP0 && t < SWEEP1 + 0.2;
        if (sweeping) {
            ctx.strokeStyle = P.axis;
            ctx.globalAlpha *= 0.6;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 5]);
            ctx.beginPath();
            ctx.moveTo(px(l), PY0);
            ctx.lineTo(px(l), PY1);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha /= 0.6;
        }

        curve(FLASH, l, P.flash, 4.5);
        curve(ATTN, l, P.attn, 4.5);
        const pomHead = curve(POM, l, P.pom, 6);

        // Self-attention runs out of memory past 2^10 tokens
        const oom = ramp(l, 10.05, 10.5);
        if (oom > 0) {
            const x = px(10), y = py(ATTN[2][1]);
            const s = 7 * (0.6 + 0.4 * oom);
            ctx.strokeStyle = P.oom;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
            ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
            ctx.stroke();
            const a = ctx.globalAlpha;
            ctx.globalAlpha = a * oom;
            ctx.font = '700 16px ' + FONT;
            ctx.fillStyle = P.oom;
            ctx.textAlign = 'center';
            ctx.fillText('OOM', x, y - 14);
            ctx.globalAlpha = a;
        }

        // PoM's apple rides the head of its curve
        if (pomHead && appleReady) ctx.drawImage(apple, pomHead.x - 12, pomHead.y - 26, 24, 24);

        // Final gap at 2^16 tokens
        const g = ramp(t, GAP0, GAP1);
        if (g > 0) {
            const a = ctx.globalAlpha;
            ctx.globalAlpha = a * g;
            const x = px(16) - 4;
            const yTop = py(FLASH[8][1]) + 6, yBot = py(POM[8][1]) - 30;
            ctx.strokeStyle = P.muted;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(x, yTop);
            ctx.lineTo(x, yTop + (yBot - yTop) * g);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = '700 24px ' + FONT;
            ctx.fillStyle = P.pom;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText('17× faster', px(14.8), py(150));
            ctx.textBaseline = 'alphabetic';
            ctx.globalAlpha = a;
        }
    }

    function drawFrame(t, elapsed) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, W, H);
        drawStrip(elapsed);
        ctx.globalAlpha = ramp(t, 0, IN1) * (1 - ramp(t, OUT0, OUT1));
        drawPlot(t);
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
        drawFrame(elapsed % CYCLE, elapsed);

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
