(function () {
    const canvas = document.getElementById('surflo-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Truck point cloud from the paper's monodepth-expert guidance result,
    // voxel-downsampled, int16-quantised, coloured by surface normal.
    // Styled as a miniature Surflo viewer: dark viewport, pastel-softened
    // normal colours, and the site's particle-assembly reveal (points are
    // transported from noise onto the surface, like the method itself).
    const SRC = '/assets/publications/surflo/truck_points.bin';
    const QUANT = 1 / 8000;

    const CAM_Z = 3.0;
    const FOCAL = 565;
    const Y_SHIFT = 12;
    const PITCH = 0.30;
    const YAW_SPEED = 0.4;

    // Surflo site palette
    const BG = { r: 26, g: 26, b: 26 };          // #1a1a1a
    const TEAL = { r: 94, g: 224, b: 214 };      // #5ee0d6
    const LAV = { r: 184, g: 156, b: 255 };      // #b89cff

    // Diffusion cycle, repeated forever: points gather from noise onto the
    // surface (generation), hold while rotating, then diffuse back to noise.
    const PERIOD = 10.0;
    const GATHER_END = 2.6;
    const DISPERSE_START = 7.4;

    let pts = null;     // assembled positions
    let noisePts = null; // scattered positions
    let cols = null;    // pastel-softened colours
    let count = 0;

    const img = ctx.createImageData(W, H);
    const data = img.data;
    const bg = new Uint8ClampedArray(W * H * 4);

    // Painter's order via counting sort on depth
    const BUCKETS = 128;
    const bucketCount = new Int32Array(BUCKETS);
    const bucketStart = new Int32Array(BUCKETS);
    let order = null;
    let depthArr = null;
    let projX = null;
    let projY = null;

    // Soft round splat kernels, one per integer size
    const kernels = {};
    function kernel(s) {
        if (kernels[s]) return kernels[s];
        const k = new Float32Array(s * s);
        const c = (s - 1) / 2;
        const r = s / 2;
        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const d = Math.sqrt((x - c) * (x - c) + (y - c) * (y - c));
                let a = 1.25 * (1 - d / r);
                if (a < 0) a = 0; else if (a > 1) a = 1;
                k[y * s + x] = a * a * (3 - 2 * a);
            }
        }
        kernels[s] = k;
        return k;
    }
    kernel(3); kernel(4); kernel(5); kernel(6);

    // Static backdrop: near-black viewport with a faint teal glow low in the
    // frame (where the cloud sits) and a lavender breath in the top corner.
    function paintBackdrop() {
        const b = document.createElement('canvas');
        b.width = W; b.height = H;
        const bctx = b.getContext('2d');
        bctx.fillStyle = 'rgb(' + BG.r + ',' + BG.g + ',' + BG.b + ')';
        bctx.fillRect(0, 0, W, H);

        let g = bctx.createRadialGradient(W * 0.5, H * 0.62, W * 0.05, W * 0.5, H * 0.62, W * 0.72);
        g.addColorStop(0, 'rgba(' + TEAL.r + ',' + TEAL.g + ',' + TEAL.b + ',0.14)');
        g.addColorStop(1, 'rgba(' + TEAL.r + ',' + TEAL.g + ',' + TEAL.b + ',0)');
        bctx.fillStyle = g;
        bctx.fillRect(0, 0, W, H);

        g = bctx.createRadialGradient(W * 0.18, H * 0.12, 0, W * 0.18, H * 0.12, W * 0.55);
        g.addColorStop(0, 'rgba(' + LAV.r + ',' + LAV.g + ',' + LAV.b + ',0.06)');
        g.addColorStop(1, 'rgba(' + LAV.r + ',' + LAV.g + ',' + LAV.b + ',0)');
        bctx.fillStyle = g;
        bctx.fillRect(0, 0, W, H);

        bg.set(bctx.getImageData(0, 0, W, H).data);
    }
    paintBackdrop();

    let animId = null;
    let visible = true;
    let t0 = performance.now();

    function regenNoise() {
        for (let i = 0; i < count; i++) {
            const u = Math.random(), v = Math.random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);
            const r = 1.3 + Math.random() * 0.9;
            noisePts[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            noisePts[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            noisePts[i * 3 + 2] = r * Math.cos(phi);
        }
    }

    function draw(now) {
        const elapsed = (now - t0) / 1000;
        const yaw = elapsed * YAW_SPEED;
        const pitch = PITCH + Math.sin(elapsed * 0.45) * 0.05;

        // Assembly progress for this point in the cycle
        const cyc = elapsed % PERIOD;
        let eG; // 1 = on the surface, 0 = pure noise
        if (cyc < GATHER_END) {
            const t = cyc / GATHER_END;
            eG = 1 - Math.pow(1 - t, 4); // quartic ease-out, as on the site
        } else if (cyc < DISPERSE_START) {
            eG = 1;
        } else {
            const t = (cyc - DISPERSE_START) / (PERIOD - DISPERSE_START);
            eG = 1 - Math.pow(t, 3);
            if (t > 0.995) regenNoise();
        }

        const cyw = Math.cos(yaw), syw = Math.sin(yaw);
        const cp = Math.cos(pitch), sp = Math.sin(pitch);

        data.set(bg);
        bucketCount.fill(0);

        // Pass 1: interpolate noise->surface, rotate, project, bucket by depth
        for (let i = 0; i < count; i++) {
            const j = i * 3;
            const x = noisePts[j] + (pts[j] - noisePts[j]) * eG;
            const y = noisePts[j + 1] + (pts[j + 1] - noisePts[j + 1]) * eG;
            const z = noisePts[j + 2] + (pts[j + 2] - noisePts[j + 2]) * eG;

            const rx = cyw * x + syw * z;
            const rz0 = -syw * x + cyw * z;
            const ry = cp * y - sp * rz0;
            const rz = sp * y + cp * rz0;

            const depth = CAM_Z - rz;
            if (depth <= 0.5) { depthArr[i] = -1; continue; }
            const inv = FOCAL / depth;
            const u = (W / 2 + rx * inv) | 0;
            const v = (H / 2 + Y_SHIFT - ry * inv) | 0;
            if (u < 0 || v < 0 || u >= W - 6 || v >= H - 6) { depthArr[i] = -1; continue; }

            depthArr[i] = depth;
            projX[i] = u;
            projY[i] = v;
            let bi = ((depth - 0.5) * (BUCKETS / 5)) | 0;
            if (bi < 0) bi = 0; else if (bi >= BUCKETS) bi = BUCKETS - 1;
            bucketCount[bi]++;
        }
        let acc = 0;
        for (let b = BUCKETS - 1; b >= 0; b--) { // far buckets first
            bucketStart[b] = acc;
            acc += bucketCount[b];
        }
        bucketCount.fill(0);
        for (let i = 0; i < count; i++) {
            const depth = depthArr[i];
            if (depth < 0) continue;
            let bi = ((depth - 0.5) * (BUCKETS / 5)) | 0;
            if (bi < 0) bi = 0; else if (bi >= BUCKETS) bi = BUCKETS - 1;
            order[bucketStart[bi] + bucketCount[bi]++] = i;
        }

        // Pass 2: splat back-to-front with soft round kernels
        // (sub-linear curve so the teal reads even late in the gather)
        const noise = Math.pow(1 - eG, 0.4);
        for (let oi = 0; oi < acc; oi++) {
            const i = order[oi];
            const j = i * 3;
            const depth = depthArr[i];

            let fog = (depth - CAM_Z + 1.3) / 2.6;
            if (fog < 0) fog = 0; else if (fog > 1) fog = 1;
            const shade = 1 - 0.30 * fog;

            // Scattered points glow teal (hero style); they take on their
            // surface colour as they land.
            const r8 = (cols[j] + (TEAL.r - cols[j]) * noise) * shade;
            const g8 = (cols[j + 1] + (TEAL.g - cols[j + 1]) * noise) * shade;
            const b8 = (cols[j + 2] + (TEAL.b - cols[j + 2]) * noise) * shade;
            const aPt = (0.95 - 0.40 * fog) * (0.45 + 0.55 * eG);

            const s = depth < CAM_Z ? 4 : 3;
            const k = kernels[s];
            const u = projX[i], v = projY[i];
            let ki = 0;
            for (let dy = 0; dy < s; dy++) {
                let p = ((v + dy) * W + u) * 4;
                for (let dx = 0; dx < s; dx++, ki++, p += 4) {
                    const a = k[ki] * aPt;
                    if (a <= 0.004) continue;
                    const ia = 1 - a;
                    data[p] = r8 * a + data[p] * ia;
                    data[p + 1] = g8 * a + data[p + 1] * ia;
                    data[p + 2] = b8 * a + data[p + 2] * ia;
                    data[p + 3] = 255;
                }
            }
        }
        ctx.putImageData(img, 0, 0);

        if (visible) {
            animId = requestAnimationFrame(draw);
        } else {
            animId = null;
        }
    }

    function start() {
        if (animId !== null || !pts) return;
        animId = requestAnimationFrame(draw);
    }

    fetch(SRC)
        .then(function (r) { return r.arrayBuffer(); })
        .then(function (buf) {
            const n = new Uint32Array(buf, 0, 1)[0];
            const q = new Int16Array(buf, 4, n * 3);
            const raw = new Uint8Array(buf, 4 + n * 6, n * 3);
            pts = new Float32Array(n * 3);
            for (let i = 0; i < n * 3; i++) pts[i] = q[i] * QUANT;

            // The site's point viewers draw the raw normal colours; we only
            // desaturate a touch so they don't read harsh on the dark bg.
            cols = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) {
                const j = i * 3;
                const gray = (raw[j] + raw[j + 1] + raw[j + 2]) / 3;
                cols[j] = raw[j] + (gray - raw[j]) * 0.12;
                cols[j + 1] = raw[j + 1] + (gray - raw[j + 1]) * 0.12;
                cols[j + 2] = raw[j + 2] + (gray - raw[j + 2]) * 0.12;
            }

            count = n;
            noisePts = new Float32Array(n * 3);
            order = new Int32Array(n);
            depthArr = new Float32Array(n);
            projX = new Int32Array(n);
            projY = new Int32Array(n);
            regenNoise();
            t0 = performance.now();
            start();
        })
        .catch(function () { /* leave the canvas blank if the fetch fails */ });

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            visible = true;
            start();
        } else {
            visible = false;
        }
    });
})();
