(function () {
    const canvas = document.getElementById('drifting-thumbnail');
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

    // Box-Muller: standard normal samples
    function gaussian() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    // A smooth, divergence-light flow field (sum of a few sinusoidal modes).
    // This is the "drift" the particles are transported along.
    function driftField(x, y, t) {
        // normalize to roughly [-1, 1] around the centre
        const nx = (x - cx) / R;
        const ny = (y - cy) / R;
        const a1 = Math.sin(1.3 * ny + 0.7 * t) + 0.6 * Math.cos(2.1 * nx - 0.4 * t);
        const a2 = Math.cos(1.1 * nx - 0.5 * t) - 0.6 * Math.sin(1.7 * ny + 0.3 * t);
        return { vx: a1, vy: a2 };
    }

    // Target distribution: a logarithmic spiral, the "structured" state the
    // drift transports the Gaussian cloud toward before dispersing again.
    const N = 220;
    const particles = new Array(N);
    for (let k = 0; k < N; k++) {
        const arm = k % 2;
        const s = k / N;
        const theta = s * Math.PI * 4 + arm * Math.PI;
        const rad = R * (0.12 + 0.82 * s);
        particles[k] = {
            // diffuse Gaussian source position
            sx: cx + gaussian() * R * 0.5,
            sy: cy + gaussian() * R * 0.5,
            // structured target position (spiral)
            tx: cx + Math.cos(theta) * rad,
            ty: cy + Math.sin(theta) * rad,
            phase: Math.random() * Math.PI * 2,
            speed: 0.5 + Math.random() * 0.7,
            seed: Math.random(),
        };
    }

    let animId = null;
    let visible = true;
    let t0 = performance.now();

    function draw(now) {
        const elapsed = (now - t0) / 1000;

        // breathing cycle: disperse (cloud) -> converge (spiral) -> disperse
        const period = 9.0;
        const cyc = (elapsed % period) / period;
        let progress;
        if (cyc < 0.40) progress = cyc / 0.40;          // drift inward
        else if (cyc < 0.66) progress = 1;              // hold structure
        else progress = 1 - (cyc - 0.66) / 0.34;        // drift outward
        const sp = smoothstep(progress);

        // gentle global rotation so the spiral feels alive
        const rot = elapsed * 0.18;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);

        ctx.clearRect(0, 0, W, H);

        // soft glow behind the structured state
        if (sp > 0.05) {
            const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.7);
            g.addColorStop(0, rgba(colorAccent, 0.16 * sp));
            g.addColorStop(1, rgba(colorAccent, 0));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
        }

        for (let k = 0; k < N; k++) {
            const p = particles[k];

            // local drift wobble along the flow field — present at all times
            const f = driftField(p.sx, p.sy, elapsed * 0.6 + p.phase);
            const driftMag = 10 * (1 - 0.7 * sp);
            const dx = f.vx * driftMag + Math.cos(elapsed * p.speed + p.phase) * 4;
            const dy = f.vy * driftMag + Math.sin(elapsed * p.speed * 0.9 + p.phase) * 4;

            const sx = p.sx + dx;
            const sy = p.sy + dy;

            // rotate the spiral target about the centre
            const rx = p.tx - cx;
            const ry = p.ty - cy;
            const tx = cx + rx * cosR - ry * sinR;
            const ty = cy + rx * sinR + ry * cosR;

            // per-particle staggered arrival → particles "flow" in, not snap
            const local = smoothstep((sp - 0.25 * p.seed) / 0.75);

            const x = sx + (tx - sx) * local;
            const y = sy + (ty - sy) * local;

            // short trail in the direction of travel hints at the drift velocity
            const trail = (1 - sp) * 0.6 + 0.15;
            const tlx = x - dx * trail;
            const tly = y - dy * trail;

            const c = mix(colorMuted, mix(colorPrimary, colorAccent, p.seed), local);
            const alpha = 0.28 + 0.5 * (0.4 + 0.6 * local);

            ctx.strokeStyle = rgba(c, alpha * 0.5);
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(tlx, tly);
            ctx.lineTo(x, y);
            ctx.stroke();

            const radius = 1.6 + 1.8 * local;
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
