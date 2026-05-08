(function () {
    const canvas = document.getElementById('thesis-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.36;

    let colorMuted, colorPrimary, colorAccent;

    function readVar(name, fallback) {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
    }
    function refreshColors() {
        colorMuted = hexToRgb(readVar('--color-muted', '#718096'));
        colorPrimary = hexToRgb(readVar('--color-primary', '#4299e1'));
        colorAccent = hexToRgb(readVar('--color-accent', '#2c7a7b'));
    }

    function hexToRgb(hex) {
        let h = (hex || '').replace('#', '').trim();
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        if (h.length !== 6) return { r: 113, g: 128, b: 150 };
        const n = parseInt(h, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function rgba(c, a) {
        return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
    }
    function mix(a, b, t) {
        return {
            r: Math.round(a.r + (b.r - a.r) * t),
            g: Math.round(a.g + (b.g - a.g) * t),
            b: Math.round(a.b + (b.b - a.b) * t),
        };
    }
    function smoothstep(x) {
        x = Math.max(0, Math.min(1, x));
        return x * x * (3 - 2 * x);
    }

    refreshColors();
    const themeObserver = new MutationObserver(refreshColors);
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'class', 'style'],
    });

    // Target points on a unit sphere — lat/lon grid; produces a wireframe globe feel
    const targets = [];
    const latSteps = 11;
    const lonStepsEq = 22;
    for (let i = 0; i <= latSteps; i++) {
        const lat = (i / latSteps - 0.5) * Math.PI;
        const ring = Math.max(4, Math.round(lonStepsEq * Math.cos(lat)));
        for (let j = 0; j < ring; j++) {
            const lon = (j / ring) * 2 * Math.PI;
            targets.push({ lat: lat, lon: lon });
        }
    }

    // Box-Muller: standard normal samples
    function gaussian() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    const N = targets.length;
    const noise = new Array(N);
    const gaussianSigma = R * 0.6; // ~3σ ≈ canvas radius, so Gaussian fills the frame
    for (let k = 0; k < N; k++) {
        noise[k] = {
            x: gaussian() * gaussianSigma,
            y: gaussian() * gaussianSigma,
            phase: Math.random() * Math.PI * 2,
            speed: 0.4 + Math.random() * 0.6,
        };
    }

    let animId = null;
    let visible = true;
    let t0 = performance.now();

    function draw(now) {
        const elapsed = (now - t0) / 1000;

        const period = 7.5;
        const cyc = (elapsed % period) / period;
        let progress;
        if (cyc < 0.42) progress = cyc / 0.42;
        else if (cyc < 0.72) progress = 1;
        else progress = 1 - (cyc - 0.72) / 0.28;
        const sp = smoothstep(progress);
        const rotY = elapsed * 0.35;

        ctx.clearRect(0, 0, W, H);

        if (sp > 0.05) {
            const g = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R * 1.7);
            g.addColorStop(0, rgba(colorAccent, 0.18 * sp));
            g.addColorStop(1, rgba(colorAccent, 0));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
        }

        for (let k = 0; k < N; k++) {
            const tgt = targets[k];
            const cosLat = Math.cos(tgt.lat);
            const x3 = Math.cos(tgt.lon + rotY) * cosLat;
            const y3 = Math.sin(tgt.lat);
            const z3 = Math.sin(tgt.lon + rotY) * cosLat;

            const px = cx + x3 * R;
            const py = cy + y3 * R;
            const depth = (z3 + 1) * 0.5;

            const np = noise[k];
            const drift = 7;
            const nx = cx + np.x + Math.cos(elapsed * np.speed + np.phase) * drift;
            const ny = cy + np.y + Math.sin(elapsed * np.speed * 0.9 + np.phase) * drift;

            const x = nx + (px - nx) * sp;
            const y = ny + (py - ny) * sp;

            const cStruct = mix(colorPrimary, colorAccent, depth);
            const c = mix(colorMuted, cStruct, sp);

            const alpha = 0.30 + 0.55 * (sp * (0.35 + 0.65 * depth) + (1 - sp) * 0.55);
            const radius = 1.8 + 2.6 * (sp * (0.5 + 0.5 * depth) + (1 - sp) * 0.45);

            ctx.beginPath();
            ctx.fillStyle = rgba(c, alpha);
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        if (visible) {
            animId = requestAnimationFrame(draw);
        } else {
            animId = null;
        }
    }

    function start() {
        if (animId !== null) return;
        animId = requestAnimationFrame(draw);
    }
    function stop() {
        if (animId !== null) cancelAnimationFrame(animId);
        animId = null;
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
