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

    // Low-resolution field we compute the smoothed density on, then upscale.
    // The upscale blur reinforces the kernel-smoothing look.
    const G = 84;
    const off = document.createElement('canvas');
    off.width = G;
    off.height = G;
    const offCtx = off.getContext('2d');
    const img = offCtx.createImageData(G, G);
    const data = img.data;
    const dens = new Float32Array(G * G);
    const gcx = G / 2;
    const gcy = G / 2;

    // "Data" modes: a constellation of Gaussian peaks (centre + two rings).
    // They drift slowly, so the resolved state is alive rather than static.
    const modes = [{ ang: 0, rad: 0, w: 1.0, dir: 0, phase: 0, wob: 0 }];
    const ringInner = 6;
    for (let i = 0; i < ringInner; i++) {
        modes.push({
            ang: (i / ringInner) * Math.PI * 2,
            rad: G * 0.20,
            w: 0.9,
            dir: 1,
            phase: Math.random() * Math.PI * 2,
            wob: G * 0.018,
        });
    }
    const ringOuter = 5;
    for (let i = 0; i < ringOuter; i++) {
        modes.push({
            ang: (i / ringOuter) * Math.PI * 2 + 0.3,
            rad: G * 0.36,
            w: 0.6,
            dir: -1,
            phase: Math.random() * Math.PI * 2,
            wob: G * 0.025,
        });
    }

    const SIGMA_MAX = G * 0.40;   // wide kernel — everything is one soft blob
    const SIGMA_MIN = G * 0.045;  // narrow kernel — sharp, resolved peaks

    let animId = null;
    let visible = true;
    let t0 = performance.now();

    function draw(now) {
        const elapsed = (now - t0) / 1000;

        // Annealing cycle: sharpen -> hold -> smooth back out -> repeat.
        const period = 9.5;
        const cyc = (elapsed % period) / period;
        let s;
        if (cyc < 0.45) s = cyc / 0.45;
        else if (cyc < 0.72) s = 1;
        else s = 1 - (cyc - 0.72) / 0.28;
        const sp = smoothstep(s);

        // Exponential bandwidth annealing: sigma = max * (min/max)^sp
        const sigma = SIGMA_MAX * Math.pow(SIGMA_MIN / SIGMA_MAX, sp);
        const inv2s2 = 1 / (2 * sigma * sigma);

        // Slow drift of the peaks about the centre.
        const rot = elapsed * 0.16;

        // Precompute current mode centres.
        for (let m = 0; m < modes.length; m++) {
            const md = modes[m];
            const a = md.ang + md.dir * rot;
            const r = md.rad + Math.sin(elapsed * 0.6 + md.phase) * md.wob;
            md.mx = gcx + Math.cos(a) * r;
            md.my = gcy + Math.sin(a) * r;
        }

        // Evaluate the kernel-smoothed density on the grid.
        let maxd = 1e-6;
        let idx = 0;
        for (let y = 0; y < G; y++) {
            for (let x = 0; x < G; x++) {
                let d = 0;
                for (let m = 0; m < modes.length; m++) {
                    const md = modes[m];
                    const dx = x - md.mx;
                    const dy = y - md.my;
                    d += md.w * Math.exp(-(dx * dx + dy * dy) * inv2s2);
                }
                dens[idx++] = d;
                if (d > maxd) maxd = d;
            }
        }
        const invMax = 1 / maxd;

        // Contrast rises as the field resolves, so peaks read as crisp.
        const gamma = 1.2 + 1.6 * sp;

        for (let i = 0; i < G * G; i++) {
            let t = dens[i] * invMax;
            t = Math.pow(t, gamma);

            // muted -> primary -> accent ramp by intensity
            let cr, cg, cb;
            if (t < 0.5) {
                const u = t * 2;
                cr = colorMuted.r + (colorPrimary.r - colorMuted.r) * u;
                cg = colorMuted.g + (colorPrimary.g - colorMuted.g) * u;
                cb = colorMuted.b + (colorPrimary.b - colorMuted.b) * u;
            } else {
                const u = (t - 0.5) * 2;
                cr = colorPrimary.r + (colorAccent.r - colorPrimary.r) * u;
                cg = colorPrimary.g + (colorAccent.g - colorPrimary.g) * u;
                cb = colorPrimary.b + (colorAccent.b - colorPrimary.b) * u;
            }

            // keep the page background clean where density is low
            const alpha = smoothstep((t - 0.04) / 0.55);

            const o = i * 4;
            data[o] = cr;
            data[o + 1] = cg;
            data[o + 2] = cb;
            data[o + 3] = Math.round(alpha * 235);
        }
        offCtx.putImageData(img, 0, 0);

        ctx.clearRect(0, 0, W, H);

        // soft glow that intensifies as structure emerges
        if (sp > 0.05) {
            const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.7);
            g.addColorStop(0, rgba(colorAccent, 0.14 * sp));
            g.addColorStop(1, rgba(colorAccent, 0));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(off, 0, 0, G, G, 0, 0, W, H);

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
