(function () {
    const canvas = document.getElementById('thesis-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Images from the thesis's papers (CAD generations, a Plonk geolocation
    // sample) generated in turn: every pixel is a particle that travels from
    // Gaussian noise to its place along a straight flow-matching path, holds,
    // then dissolves back into noise for the next image.
    const SRC = '/assets/publications/thesis/flow-images.webp';
    const N = 72;                        // pixels per side
    const IMAGES = 4;
    const CELL = W / N;

    const PALETTES = {
        dark: { bg: '#1f2633', noise: [160, 174, 192] },
        light: { bg: '#eef2f7', noise: [113, 128, 150] },
    };
    let P;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() { P = isDark() ? PALETTES.dark : PALETTES.light; }

    // Timeline (seconds within one image)
    const CYCLE = 5.2;
    const IN0 = 0.2, IN1 = 1.9;
    const OUT0 = 4.0, OUT1 = 5.2;
    const SPREAD = 0.35;                 // per-particle start offsets

    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function easeInOut(x) {
        x = clamp01(x);
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    // One noise sample per particle, shared by every image so that the end
    // of one cycle is exactly the start of the next.
    const rnd = mulberry32(2025);
    function gaussian() {
        const u = Math.max(rnd(), 1e-9), v = rnd();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    const COUNT = N * N;
    const nx = new Float32Array(COUNT), ny = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT), delay = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
        nx[i] = W / 2 + gaussian() * W * 0.2;
        ny[i] = H / 2 + gaussian() * H * 0.2;
        phase[i] = rnd() * Math.PI * 2;
        delay[i] = rnd() * SPREAD;
    }

    let pixels = null;                   // RGB per image per particle
    const img = new Image();
    img.onload = function () {
        try {
            const c = document.createElement('canvas');
            c.width = N * IMAGES;
            c.height = N;
            const cctx = c.getContext('2d', { willReadFrequently: true });
            cctx.drawImage(img, 0, 0);
            const data = cctx.getImageData(0, 0, c.width, c.height).data;
            pixels = [];
            for (let k = 0; k < IMAGES; k++) {
                const px = new Uint8Array(COUNT * 3);
                for (let i = 0; i < COUNT; i++) {
                    const o = ((i / N | 0) * c.width + k * N + i % N) * 4;
                    px[i * 3] = data[o];
                    px[i * 3 + 1] = data[o + 1];
                    px[i * 3 + 2] = data[o + 2];
                }
                pixels.push(px);
            }
            t0 = performance.now();
        } catch (e) { /* keep drawing noise */ }
    };
    img.src = SRC;

    function drawFrame(k, t, elapsed) {
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, W, H);

        const px = pixels ? pixels[k] : null;
        const nc = P.noise;
        for (let i = 0; i < COUNT; i++) {
            // Flow time of this particle: 0 = noise, 1 = image
            let s = 0;
            if (px) {
                const d = delay[i];
                s = t < OUT0
                    ? easeInOut((t - IN0 - d) / (IN1 - IN0 - SPREAD))
                    : 1 - easeInOut((t - OUT0 - d * 0.6) / (OUT1 - OUT0 - SPREAD * 0.6));
            }
            const wob = 3 * (1 - s);
            const x0 = nx[i] + Math.cos(elapsed * 0.9 + phase[i]) * wob;
            const y0 = ny[i] + Math.sin(elapsed * 0.8 + phase[i]) * wob;
            const x1 = (i % N) * CELL, y1 = (i / N | 0) * CELL;
            const size = 2.6 + (CELL + 0.35 - 2.6) * s;
            let r = nc[0], g = nc[1], b = nc[2];
            if (px) {
                r += (px[i * 3] - r) * s;
                g += (px[i * 3 + 1] - g) * s;
                b += (px[i * 3 + 2] - b) * s;
            }
            ctx.fillStyle = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
            ctx.fillRect(x0 + (x1 - x0) * s - (1 - s) * size / 2, y0 + (y1 - y0) * s - (1 - s) * size / 2, size, size);
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
        const idx = Math.floor(elapsed / CYCLE);
        drawFrame(idx % IMAGES, elapsed - idx * CYCLE, elapsed);

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
