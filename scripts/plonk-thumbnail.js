(function () {
    const canvas = document.getElementById('plonk-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // PLONK geolocates a photo by denoising coordinates on the sphere: a
    // cloud of uniform random points flows along geodesics onto the
    // locations predicted for the image. Three examples from the paper, in
    // its dataset colours: the Eiffel Tower (YFCC, one sharp mode), a dirt
    // road (OSV-5M, two modes in East and Southern Africa) and a pigeon
    // (iNat-21, spread over the world). Targets are sampled from the paper's
    // density maps; noise and targets are paired by optimal transport so the
    // paths read like a learned flow. Land: Natural Earth 50m.
    const BASE = '/assets/publications/plonk/';
    const PALETTES = {
        dark: { bg: '#131a25', ocean: '#15263c', land: '#3f6088', halo: '#4f86c6', shadow: 'rgba(0,0,0,0.55)' },
        light: { bg: '#eef2f7', ocean: '#1a2f4b', land: '#4d73a0', halo: '#6b9ad4', shadow: 'rgba(25,40,65,0.35)' },
    };
    let P;
    function isDark() { return document.body.classList.contains('dark-theme'); }
    function refreshPalette() {
        P = isDark() ? PALETTES.dark : PALETTES.light;
        globeKey = '';
    }

    // Paper colours for the frames (YFCC, OSV, iNat), brightened for the dots.
    // Modes get a landing ping; the Africa ones are the centres read off the
    // paper's 3D render, the pigeon has none to show.
    const SCENES = [
        { tile: 0, frame: '#fd8d3c', dot: [255, 160, 82], view: [4, 38], modes: [[2.29, 48.86]] },
        { tile: 1, frame: '#4292c6', dot: [92, 204, 255], view: [31, -10], modes: [[37.0, -2.8], [28.6, -18.2]] },
        { tile: 2, frame: '#8856a7', dot: [192, 146, 250], view: [-42, 32], modes: [] },
    ];

    // Layout
    const GX = 208, GY = 208, R = 140;    // globe
    const PX = 14, PY = 14, PS = 116;     // photo
    const TILE = 240;

    // Timeline (seconds within one scene)
    const SCENE = 5.2;
    const LOOP = SCENE * SCENES.length;
    const SWAP0 = 0.0, SWAP1 = 0.5;       // photo card flip
    const BACK0 = 0.1, BACK1 = 1.0;       // previous samples back to noise
    const ROT0 = 0.3, ROT1 = 1.4;         // globe turns to the new view
    const FLOW0 = 1.2, FLOW1 = 3.4;       // noise flows onto the new samples
    const PING0 = 3.15;                   // rings once the samples have landed
    const DRIFT = 7;                      // degrees of slow sway

    function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
    function easeInOut(x) {
        x = clamp01(x);
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
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

    // ---- Assets ----------------------------------------------------------

    let land = null, TW = 0, TH = 0;      // land mask, equirectangular
    let photos = null;
    let flow = null;
    let pending = 3;
    function loaded() {
        pending -= 1;
        if (pending === 0) t0 = performance.now();
    }

    const landImg = new Image();
    landImg.onload = function () {
        try {
            const c = makeCanvas(landImg.width, landImg.height);
            const cc = c.getContext('2d', { willReadFrequently: true });
            cc.drawImage(landImg, 0, 0);
            const d = cc.getImageData(0, 0, c.width, c.height).data;
            TW = c.width;
            TH = c.height;
            land = new Uint8Array(TW * TH);
            for (let i = 0; i < land.length; i++) land[i] = d[i * 4];
            globeKey = '';
        } catch (e) { /* keep the plain ocean globe */ }
        loaded();
    };
    landImg.onerror = loaded;
    landImg.src = BASE + 'thumbnail-land.png';

    const photoImg = new Image();
    photoImg.onload = function () { photos = photoImg; loaded(); };
    photoImg.onerror = loaded;
    photoImg.src = BASE + 'thumbnail-photos.webp';

    fetch(BASE + 'thumbnail-flow.json')
        .then(function (r) { return r.json(); })
        .then(function (d) { flow = prepareFlow(d); loaded(); })
        .catch(loaded);

    function toVec(ll, out, i) {
        const lon = ll[2 * i] * Math.PI / 180, lat = ll[2 * i + 1] * Math.PI / 180;
        out[3 * i] = Math.cos(lat) * Math.sin(lon);
        out[3 * i + 1] = Math.sin(lat);
        out[3 * i + 2] = Math.cos(lat) * Math.cos(lon);
    }

    // Unit vectors for the noise and, per scene, the paired targets
    function prepareFlow(d) {
        const n = d.noise.length / 2;
        const noise = new Float32Array(3 * n);
        for (let i = 0; i < n; i++) toVec(d.noise, noise, i);
        const scenes = d.scenes.map(function (s) {
            const tg = new Float32Array(3 * n);
            const om = new Float32Array(n);
            for (let i = 0; i < n; i++) {
                toVec(s.lonlat, tg, i);
                const dot = noise[3 * i] * tg[3 * i] + noise[3 * i + 1] * tg[3 * i + 1] + noise[3 * i + 2] * tg[3 * i + 2];
                om[i] = Math.acos(Math.max(-1, Math.min(1, dot)));
            }
            return { tg: tg, om: om };
        });
        return { n: n, noise: noise, scenes: scenes };
    }

    // ---- Globe -------------------------------------------------------------

    // Per-pixel view normals of the disc, its edge coverage and lighting,
    // computed once; each view then only rotates normals into lon/lat.
    const GD = 2 * R + 2;
    const globe = makeCanvas(GD, GD);
    const gctx = globe.getContext('2d');
    const gimg = gctx.createImageData(GD, GD);
    const gpix = new Uint32Array(gimg.data.buffer);
    const gIdx = [], gN = [], gShade = [], gRim = [], gCov = [];
    (function buildDisc() {
        const L = [-0.48, 0.58, 0.66];
        const ll = Math.hypot(L[0], L[1], L[2]);
        for (let y = 0; y < GD; y++) {
            for (let x = 0; x < GD; x++) {
                let u = (x + 0.5 - GD / 2) / R, v = -(y + 0.5 - GD / 2) / R;
                const r = Math.hypot(u, v);
                const cov = clamp01((1 - r) * R + 0.5);
                if (cov <= 0) continue;
                if (r > 1) { u /= r; v /= r; }
                const z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
                const diff = Math.max(0, (u * L[0] + v * L[1] + z * L[2]) / ll);
                gIdx.push(y * GD + x);
                gN.push(u, v, z);
                gShade.push(0.5 + 0.62 * diff);
                gRim.push(Math.pow(1 - z, 2.5));
                gCov.push(cov);
            }
        }
    })();
    const G_IDX = Int32Array.from(gIdx), G_N = Float32Array.from(gN);
    const G_SHADE = Float32Array.from(gShade), G_RIM = Float32Array.from(gRim), G_COV = Float32Array.from(gCov);
    let globeKey = '';

    // Tilt (view latitude) fixes each pixel's latitude and its longitude
    // relative to the view centre; spinning only shifts the longitude, so
    // the trigonometry is redone only while the tilt changes.
    const G_V = new Float32Array(G_IDX.length), G_U = new Float32Array(G_IDX.length);
    let tiltKey = NaN;
    function setTilt(lat0) {
        if (lat0 === tiltKey) return;
        tiltKey = lat0;
        const cp = Math.cos(lat0), sp = Math.sin(lat0);
        for (let i = 0; i < G_IDX.length; i++) {
            const x = G_N[3 * i], y = G_N[3 * i + 1], z = G_N[3 * i + 2];
            const y1 = y * cp + z * sp, z1 = -y * sp + z * cp;
            G_V[i] = 0.5 - Math.asin(Math.max(-1, Math.min(1, y1))) / Math.PI;
            G_U[i] = Math.atan2(x, z1) / (2 * Math.PI);
        }
    }

    function renderGlobe(lon0, lat0) {
        const key = lon0.toFixed(4) + ',' + lat0.toFixed(4) + ',' + (land ? 1 : 0) + P.bg;
        if (key === globeKey) return;
        globeKey = key;
        const oc = hexToRgb(P.ocean), ld = hexToRgb(P.land), ha = hexToRgb(P.halo);
        if (land) setTilt(lat0);
        const u0 = lon0 / (2 * Math.PI) + 0.5;
        const n = G_IDX.length;
        for (let i = 0; i < n; i++) {
            let m = 0;
            if (land) {
                const fu = (G_U[i] + u0) * TW - 0.5;
                const fv = G_V[i] * TH - 0.5;
                let iu = Math.floor(fu), iv = Math.floor(fv);
                const du = fu - iu, dv = fv - iv;
                if (iv < 0) iv = 0; else if (iv > TH - 2) iv = TH - 2;
                iu = ((iu % TW) + TW) % TW;
                const iu1 = iu + 1 === TW ? 0 : iu + 1;
                const r0 = iv * TW, r1 = r0 + TW;
                const a = land[r0 + iu], b = land[r0 + iu1], c = land[r1 + iu], d = land[r1 + iu1];
                const top = a + (b - a) * du, bot = c + (d - c) * du;
                m = (top + (bot - top) * dv) / 255;
            }
            const s = G_SHADE[i], rim = G_RIM[i] * 0.85;
            const rr = (oc[0] + (ld[0] - oc[0]) * m) * s + ha[0] * rim;
            const gg = (oc[1] + (ld[1] - oc[1]) * m) * s + ha[1] * rim;
            const bb = (oc[2] + (ld[2] - oc[2]) * m) * s + ha[2] * rim;
            const al = Math.round(255 * G_COV[i]);
            gpix[G_IDX[i]] = (al << 24) | (Math.min(255, bb) << 16) | (Math.min(255, gg) << 8) | Math.min(255, rr);
        }
        gctx.putImageData(gimg, 0, 0);
    }

    // ---- Particles -----------------------------------------------------------

    // Noise is drawn neutral and takes the dataset colour as it lands
    const NOISE_RGB = [214, 226, 244];
    function dotRgb(s, u) {
        const c = SCENES[s].dot;
        return [
            Math.round(NOISE_RGB[0] + (c[0] - NOISE_RGB[0]) * u),
            Math.round(NOISE_RGB[1] + (c[1] - NOISE_RGB[1]) * u),
            Math.round(NOISE_RGB[2] + (c[2] - NOISE_RGB[2]) * u),
        ];
    }

    // Soft glow sprite, tinted per frame
    const SPR = 48;
    const sprite = makeCanvas(SPR, SPR);
    const sctx = sprite.getContext('2d');
    let spriteKey = '';
    function tintSprite(rgb) {
        const key = rgb.join(',');
        if (key === spriteKey) return;
        spriteKey = key;
        sctx.clearRect(0, 0, SPR, SPR);
        const g = sctx.createRadialGradient(SPR / 2, SPR / 2, 0, SPR / 2, SPR / 2, SPR / 2);
        g.addColorStop(0, 'rgba(' + key + ',1)');
        g.addColorStop(0.3, 'rgba(' + key + ',0.55)');
        g.addColorStop(1, 'rgba(' + key + ',0)');
        sctx.fillStyle = g;
        sctx.fillRect(0, 0, SPR, SPR);
    }

    // Which scene the particles follow at scene time t, and how far along
    // the noise -> sample path they are (0 = noise, 1 = sample).
    function stateAt(k, t) {
        if (t < BACK1) return { s: (k + SCENES.length - 1) % SCENES.length, u: 1 - easeInOut((t - BACK0) / (BACK1 - BACK0)) };
        return { s: k, u: easeInOut((t - FLOW0) / (FLOW1 - FLOW0)) };
    }

    let cl = 1, sl = 0, cp = 1, sp = 0;
    const out = { x: 0, y: 0, z: 0 };
    // Geodesic (slerp) between noise i and its sample, then the view rotation
    function project(s, i, u) {
        const nz = flow.noise, tg = flow.scenes[s].tg, om = flow.scenes[s].om[i];
        let x, y, z;
        if (om < 1e-4 || u <= 0) {
            x = nz[3 * i]; y = nz[3 * i + 1]; z = nz[3 * i + 2];
        } else {
            const so = Math.sin(om);
            const a = Math.sin((1 - u) * om) / so, b = Math.sin(u * om) / so;
            x = a * nz[3 * i] + b * tg[3 * i];
            y = a * nz[3 * i + 1] + b * tg[3 * i + 1];
            z = a * nz[3 * i + 2] + b * tg[3 * i + 2];
        }
        const x1 = x * cl - z * sl, z1 = x * sl + z * cl;
        out.x = GX + R * x1;
        out.y = GY - R * (y * cp - z1 * sp);
        out.z = y * sp + z1 * cp;
        return out;
    }

    // Trails: earlier positions along the same path (seconds back)
    const TAIL = [0.06, 0.12];
    let bufs = null;
    function drawParticles(k, t) {
        const st = stateAt(k, t);
        const n = flow.n;
        if (!bufs) bufs = [0, 1, 2, 3].map(function () { return [new Float32Array(n), new Float32Array(n)]; });
        const hx = bufs[0][0], hy = bufs[0][1], ha = bufs[3][0];
        for (let i = 0; i < n; i++) {
            const p = project(st.s, i, st.u);
            hx[i] = p.x; hy[i] = p.y;
            ha[i] = smooth((p.z + 0.02) / 0.16);
        }
        const rgb = dotRgb(st.s, st.u);
        const key = rgb.join(',');

        ctx.save();
        ctx.lineCap = 'round';
        let px = hx, py = hy;
        const tails = st.s === k ? TAIL.length : 0;   // only on the way in
        for (let j = 0; j < tails; j++) {
            const sj = stateAt(k, t - TAIL[j]);
            const uj = sj.s === st.s ? sj.u : 0;
            if (Math.abs(uj - st.u) < 2e-3) break;
            const qx = bufs[j + 1][0], qy = bufs[j + 1][1];
            ctx.strokeStyle = 'rgba(' + key + ',' + (0.42 - 0.2 * j) + ')';
            ctx.lineWidth = 2.4 - 0.8 * j;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const p = project(st.s, i, uj);
                qx[i] = p.x; qy[i] = p.y;
                if (ha[i] > 0.3 && p.z > 0) {
                    ctx.moveTo(px[i], py[i]);
                    ctx.lineTo(p.x, p.y);
                }
            }
            ctx.stroke();
            px = qx; py = qy;
        }

        // Glow: where samples pile up it builds into a density blob
        tintSprite(rgb);
        const gs = 16 + 20 * st.u;
        for (let i = 0; i < n; i++) {
            if (ha[i] <= 0) continue;
            ctx.globalAlpha = 0.3 * ha[i];
            ctx.drawImage(sprite, hx[i] - gs / 2, hy[i] - gs / 2, gs, gs);
        }
        ctx.globalAlpha = 1;
        const core = rgb.map(function (c) { return Math.round(c + (255 - c) * 0.35); });
        ctx.fillStyle = 'rgb(' + core.join(',') + ')';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            if (ha[i] < 0.5) continue;
            ctx.moveTo(hx[i] + 2.4, hy[i]);
            ctx.arc(hx[i], hy[i], 2.4, 0, Math.PI * 2);
        }
        ctx.fill();

        // Landing pings on the modes of a localizable image
        if (st.s === k && t > PING0) {
            for (const m of SCENES[k].modes) {
                const lon = m[0] * Math.PI / 180, lat = m[1] * Math.PI / 180;
                const x = Math.cos(lat) * Math.sin(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon);
                const x1 = x * cl - z * sl, z1 = x * sl + z * cl;
                const depth = y * sp + z1 * cp;
                if (depth <= 0.1) continue;
                const mx = GX + R * x1, my = GY - R * (y * cp - z1 * sp);
                for (let r = 0; r < 2; r++) {
                    const a = (t - PING0 - r * 0.45) / 1.1;
                    if (a <= 0 || a >= 1) continue;
                    ctx.globalAlpha = (1 - a) * (1 - a) * 0.9;
                    ctx.strokeStyle = 'rgb(' + core.join(',') + ')';
                    ctx.lineWidth = 3.2 - 1.6 * a;
                    ctx.beginPath();
                    ctx.arc(mx, my, 10 + 30 * Math.sqrt(a), 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }

    // ---- Frame -----------------------------------------------------------------

    function viewAt(k, t, elapsed) {
        const a = SCENES[(k + SCENES.length - 1) % SCENES.length].view, b = SCENES[k].view;
        const e = easeInOut((t - ROT0) / (ROT1 - ROT0));
        let dl = b[0] - a[0];
        if (dl > 180) dl -= 360; else if (dl < -180) dl += 360;
        const sway = DRIFT * Math.sin(2 * Math.PI * elapsed / LOOP);
        return [(a[0] + dl * e + sway) * Math.PI / 180, (a[1] + (b[1] - a[1]) * e) * Math.PI / 180];
    }

    // The photo card flips over to the next image
    function drawPhoto(k, t) {
        const f = smooth((t - SWAP0) / (SWAP1 - SWAP0));
        const sc = SCENES[f < 0.5 ? (k + SCENES.length - 1) % SCENES.length : k];
        const sx = Math.abs(Math.cos(Math.PI * f));
        if (sx < 0.02) return;
        const cx = PX + PS / 2;
        ctx.save();
        ctx.translate(cx, 0);
        ctx.scale(sx, 1);
        ctx.translate(-cx, 0);
        ctx.save();
        ctx.shadowColor = P.shadow;
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 4;
        roundRect(ctx, PX - 5, PY - 5, PS + 10, PS + 10, 14);
        ctx.fillStyle = sc.frame;
        ctx.fill();
        ctx.restore();
        roundRect(ctx, PX, PY, PS, PS, 10);
        ctx.clip();
        if (photos) {
            ctx.drawImage(photos, sc.tile * TILE, 0, TILE, TILE, PX, PY, PS, PS);
        } else {
            ctx.fillStyle = P.ocean;
            ctx.fillRect(PX, PY, PS, PS);
        }
        ctx.restore();
    }

    function drawFrame(elapsed) {
        const k = Math.floor(elapsed / SCENE) % SCENES.length;
        const t = elapsed - Math.floor(elapsed / SCENE) * SCENE;

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, W, H);

        // Atmosphere
        const halo = ctx.createRadialGradient(GX, GY, R * 0.92, GX, GY, R + 18);
        const hc = hexToRgb(P.halo).join(',');
        halo.addColorStop(0, 'rgba(' + hc + ',0.45)');
        halo.addColorStop(0.45, 'rgba(' + hc + ',0.16)');
        halo.addColorStop(1, 'rgba(' + hc + ',0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(GX, GY, R + 18, 0, Math.PI * 2);
        ctx.fill();

        const v = viewAt(k, t, elapsed);
        cl = Math.cos(v[0]); sl = Math.sin(v[0]); cp = Math.cos(v[1]); sp = Math.sin(v[1]);
        renderGlobe(v[0], v[1]);
        ctx.drawImage(globe, GX - GD / 2, GY - GD / 2);

        if (flow) drawParticles(k, t);
        drawPhoto(k, t);
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
        drawFrame(elapsed % LOOP);

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
