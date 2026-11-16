// Illustrations for the About section's research-theme cards. They are general
// pictures of each theme, not paper figures. Each <canvas class="theme-canvas"
// data-visual="..."> gets one scene:
//   tree    - Training with less: a tree grows out of a handful of seed points.
//   globe   - Generative geolocation: samples start as noise over the globe and
//             flow into the few regions a photo could come from.
//   views   - Generation beyond images: one front view (a square) matches a cube,
//             a cylinder and a prism; they turn to show how different they are.
//   flow    - How generative models work: noise samples follow curved
//             probability-flow paths into a multi-modal data distribution.
// Colors come from the site tokens on <body> (they switch with .dark-theme).
// Scenes only draw while on screen and the tab is visible.
(function () {
    const canvases = [...document.querySelectorAll('canvas.theme-canvas[data-visual]')];
    if (!canvases.length) return;

    const C = {};
    const TOKENS = {
        primary: '--color-primary', strong: '--color-primary-strong', accent: '--color-accent',
        warm: '--color-accent-warm', muted: '--color-muted', border: '--color-border', surface: '--color-surface',
    };
    function refreshPalette() {
        const cs = getComputedStyle(document.body);
        for (const [k, v] of Object.entries(TOKENS)) C[k] = cs.getPropertyValue(v).trim() || '#888888';
    }
    refreshPalette();
    new MutationObserver(refreshPalette).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    function rgba(hex, a) {
        const n = parseInt(hex.replace('#', ''), 16);
        return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
    }
    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
    const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function line(ctx, x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    function arrow(ctx, x0, y0, x1, y1, head) {
        line(ctx, x0, y0, x1, y1);
        const a = Math.atan2(y1 - y0, x1 - x0);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - head * Math.cos(a - 0.5), y1 - head * Math.sin(a - 0.5));
        ctx.lineTo(x1 - head * Math.cos(a + 0.5), y1 - head * Math.sin(a + 0.5));
        ctx.closePath(); ctx.fill();
    }
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    // All scenes draw in a 100 x 100 box.

    function treeScene() {
        const CYCLE = 9;
        let cycleIdx = -1, root = null;
        function build(seed) {
            const rnd = mulberry32(seed);
            function node(rel, len, depth, t0) {
                const n = { rel, len, depth, t0, dur: 0.36 + rnd() * 0.12, phase: rnd() * 6.28, kids: [] };
                if (depth >= 6 || len < 3) {
                    const r = rnd();
                    n.leaf = r < 0.6 ? 'accent' : r < 0.86 ? 'primary' : 'warm';
                    n.leafR = 1.1 + rnd() * 1.1;
                    return n;
                }
                const k = depth < 1 ? 2 : (rnd() < 0.22 ? 3 : 2);
                const spread = 0.34 + rnd() * 0.22;
                for (let i = 0; i < k; i++) {
                    const base = k === 2 ? (i ? spread : -spread) : (i - 1) * spread * 1.1;
                    n.kids.push(node(base + (rnd() - 0.5) * 0.22, len * (0.68 + rnd() * 0.12), depth + 1,
                        t0 + n.dur * (0.9 + rnd() * 0.25)));
                }
                return n;
            }
            return node(-Math.PI / 2 + (rnd() - 0.5) * 0.1, 15.5 + rnd() * 2.5, 0, 0.9);
        }
        function drawNode(ctx, n, x, y, parentAng, t) {
            const ang = parentAng + n.rel + Math.sin(t * 1.1 + n.phase) * 0.012 * (n.depth + 1);
            const p = easeOut((t - n.t0) / n.dur);
            if (p <= 0) return;
            const ex = x + Math.cos(ang) * n.len * p, ey = y + Math.sin(ang) * n.len * p;
            ctx.strokeStyle = n.depth < 2 ? C.strong : rgba(C.primary, 0.9 - n.depth * 0.06);
            ctx.lineWidth = Math.max(0.35, 2.3 * Math.pow(0.68, n.depth));
            line(ctx, x, y, ex, ey);
            if (p < 1) return;
            if (n.leaf) {
                const lp = easeOut((t - n.t0 - n.dur) / 0.5);
                ctx.fillStyle = rgba(C[n.leaf], 0.85);
                dot(ctx, ex, ey, n.leafR * lp);
            }
            for (const kid of n.kids) drawNode(ctx, kid, ex, ey, ang, t);
        }
        return function draw(ctx, t) {
            const idx = Math.floor(t / CYCLE), u = t - idx * CYCLE;
            if (idx !== cycleIdx) { cycleIdx = idx; root = build(1000 + idx * 7919); }
            ctx.lineCap = 'round';
            ctx.strokeStyle = rgba(C.muted, 0.45); ctx.lineWidth = 0.6;
            line(ctx, 26, 91, 74, 91);
            ctx.globalAlpha = 1 - smooth((u - 7.9) / 0.9);
            drawNode(ctx, root, 50, 90, 0, u);
            ctx.globalAlpha = 1;
            // the few data points the tree grows from (always there)
            for (let i = 0; i < 4; i++) {
                ctx.fillStyle = rgba(C.warm, 0.75 + 0.25 * Math.sin(u * 3 + i));
                dot(ctx, 50 + (i - 1.5) * 3.4, 91, 1.2);
            }
            ctx.globalAlpha = 1;
        };
    }

    function globeScene() {
        // Generative geolocation: samples start as noise spread over the globe and
        // flow (along great circles) into the few regions a photo could come from.
        const CYC = 9.5, N = 190, RAD = 36, CX = 50, CY = 52, SPIN = 0.16;
        let cycleIdx = -1, parts = [], modes = [];
        const unit = (lat, lon) => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
        function slerp(a, b, f) {
            const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
            const om = Math.acos(d);
            if (om < 1e-4) return b;
            const sa = Math.sin((1 - f) * om) / Math.sin(om), sb = Math.sin(f * om) / Math.sin(om);
            return [a[0] * sa + b[0] * sb, a[1] * sa + b[1] * sb, a[2] * sa + b[2] * sb];
        }
        function build(seed, tMid) {
            const rnd = mulberry32(seed);
            const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
            const k = 3 + (rnd() < 0.5 ? 1 : 0);
            // centre the modes on the longitude that faces the viewer mid-hold
            const lonFace = -SPIN * tMid;
            modes = [];
            for (let i = 0; i < k; i++) {
                modes.push({
                    lat: (-20 + rnd() * 65) * Math.PI / 180,
                    lon: lonFace + (i - (k - 1) / 2) * 0.62 + (rnd() - 0.5) * 0.3,
                    w: 0.5 + rnd(),
                });
            }
            const wsum = modes.reduce((a, m) => a + m.w, 0);
            parts = [];
            for (let i = 0; i < N; i++) {
                let r = rnd() * wsum, m = modes[0];
                for (const mm of modes) { r -= mm.w; if (r <= 0) { m = mm; break; } }
                const z = 2 * rnd() - 1, ph = rnd() * Math.PI * 2, q = Math.sqrt(1 - z * z);
                parts.push({
                    a: [q * Math.cos(ph), z, q * Math.sin(ph)],
                    b: unit(m.lat + gauss() * 0.12, m.lon + gauss() * 0.17),
                    t0: 0.9 + rnd() * 0.9, dur: 2.0 + rnd() * 1.1,
                });
            }
        }
        function project(v, th, ph) {
            const x1 = v[0] * Math.cos(th) + v[2] * Math.sin(th), z1 = -v[0] * Math.sin(th) + v[2] * Math.cos(th);
            return [CX + RAD * x1, CY - RAD * (v[1] * Math.cos(ph) - z1 * Math.sin(ph)), v[1] * Math.sin(ph) + z1 * Math.cos(ph)];
        }
        return function draw(ctx, t) {
            const idx = Math.floor(t / CYC), u = t - idx * CYC;
            if (idx !== cycleIdx) { cycleIdx = idx; build(777 + idx * 15485863, idx * CYC + 6); }
            const th = t * SPIN, ph = 0.38;
            ctx.lineCap = 'round';
            // globe outline and graticule (back half faint)
            ctx.fillStyle = rgba(C.primary, 0.06);
            dot(ctx, CX, CY, RAD);
            ctx.strokeStyle = rgba(C.muted, 0.55); ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.arc(CX, CY, RAD, 0, Math.PI * 2); ctx.stroke();
            const seg = (pts) => {
                for (let i = 0; i < pts.length - 1; i++) {
                    const z = (pts[i][2] + pts[i + 1][2]) / 2;
                    ctx.strokeStyle = rgba(C.primary, z > 0 ? 0.32 : 0.08);
                    line(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
                }
            };
            ctx.lineWidth = 0.45;
            for (let lat = -60; lat <= 60; lat += 30) {
                const pts = [];
                for (let lo = 0; lo <= 360; lo += 10) pts.push(project(unit(lat * Math.PI / 180, lo * Math.PI / 180), th, ph));
                seg(pts);
            }
            for (let lo = 0; lo < 180; lo += 30) {
                const pts = [];
                for (let la = 0; la <= 360; la += 10) pts.push(project(unit(la * Math.PI / 180, lo * Math.PI / 180), th, ph));
                seg(pts);
            }
            const fade = 1 - smooth((u - 8.4) / 0.9);
            // glow where the samples settle
            const settled = smooth((u - 3.6) / 1.2) * fade;
            if (settled > 0) {
                for (const m of modes) {
                    const [x, y, z] = project(unit(m.lat, m.lon), th, ph);
                    if (z <= 0) continue;
                    const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
                    g.addColorStop(0, rgba(C.warm, 0.45 * settled * z));
                    g.addColorStop(1, rgba(C.warm, 0));
                    ctx.fillStyle = g; dot(ctx, x, y, 9);
                }
            }
            for (const p of parts) {
                const appear = smooth(u / 0.7) * fade;
                const f = smooth((u - p.t0) / p.dur);
                const [x, y, z] = project(slerp(p.a, p.b, f), th, ph);
                if (z <= -0.05) continue;
                const vis = appear * (0.35 + 0.65 * clamp01(z * 3));
                ctx.fillStyle = f < 1 ? rgba(C.primary, (0.45 + 0.4 * f) * vis) : rgba(C.warm, 0.9 * vis);
                if (f > 0.98) ctx.fillStyle = rgba(C.warm, 0.9 * vis);
                dot(ctx, x, y, 0.75 + 0.35 * f);
            }
        };
    }

    function viewsScene() {
        const CYC = 8, H = 9, CY = 70;
        const XS = [20, 50, 80];
        const cube = (() => {
            const V = [];
            for (const x of [-H, H]) for (const y of [-H, H]) for (const z of [-H, H]) V.push([x, y, z]);
            const E = [];
            for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
                const d = V[i].reduce((acc, v, k) => acc + (v !== V[j][k] ? 1 : 0), 0);
                if (d === 1) E.push([V[i], V[j]]);
            }
            return E;
        })();
        const cylinder = (() => {
            const E = [], N = 24;
            const P = (a, y) => [H * Math.sin(a), y, H * Math.cos(a)];
            for (let i = 0; i < N; i++) {
                const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
                E.push([P(a0, -H), P(a1, -H)], [P(a0, H), P(a1, H)]);
            }
            for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; E.push([P(a, -H), P(a, H)]); }
            return E;
        })();
        const prism = (() => {
            const tri = (x) => [[x, -H, H], [x, -H, -H], [x, H, 0]];
            const L = tri(-H), R = tri(H), E = [];
            for (let i = 0; i < 3; i++) E.push([L[i], L[(i + 1) % 3]], [R[i], R[(i + 1) % 3]], [L[i], R[i]]);
            return E;
        })();
        const shapes = [[cube, 'primary'], [cylinder, 'accent'], [prism, 'warm']];
        function project([x, y, z], th, ph) {
            const x1 = x * Math.cos(th) + z * Math.sin(th), z1 = -x * Math.sin(th) + z * Math.cos(th);
            return [x1, y * Math.cos(ph) - z1 * Math.sin(ph), y * Math.sin(ph) + z1 * Math.cos(ph)];
        }
        return function draw(ctx, t) {
            const u = t % CYC;
            const k = u < 1.5 ? 0 : u < 2.9 ? smooth((u - 1.5) / 1.4) : u < 6.3 ? 1 : u < 7.7 ? 1 - smooth((u - 6.3) / 1.4) : 0;
            const th = k * (0.8 + 0.35 * Math.sin(Math.PI * clamp01((u - 2.9) / 3.4)));
            const ph = k * 0.42;
            const front = 1 - k;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            // the observation: one front view
            roundRect(ctx, 41, 6, 18, 18, 2.5);
            ctx.fillStyle = C.surface; ctx.fill();
            ctx.strokeStyle = rgba(C.muted, 0.6); ctx.lineWidth = 0.6; ctx.stroke();
            ctx.fillStyle = rgba(C.strong, 0.75);
            ctx.fillRect(45.5, 10.5, 9, 9);
            // one view, several answers
            ctx.setLineDash([1.4, 1.6]);
            ctx.strokeStyle = rgba(C.muted, 0.35 + 0.35 * front); ctx.lineWidth = 0.6;
            for (const cx of XS) line(ctx, 50, 25.5, cx, CY - H - 6);
            if (front > 0.02) {
                ctx.strokeStyle = rgba(C.muted, 0.7 * front);
                for (const cx of XS) { ctx.strokeRect(cx - H - 2.5, CY - H - 2.5, 2 * H + 5, 2 * H + 5); }
            }
            ctx.setLineDash([]);
            shapes.forEach(([edges, tone], i) => {
                const cx = XS[i];
                for (const [a, b] of edges) {
                    const pa = project(a, th, ph), pb = project(b, th, ph);
                    const depth = clamp01(((pa[2] + pb[2]) / 2 + H) / (2 * H));
                    ctx.strokeStyle = rgba(C[tone], 0.28 + 0.72 * depth);
                    ctx.lineWidth = 0.55 + 0.45 * depth;
                    line(ctx, cx + pa[0], CY - pa[1], cx + pb[0], CY - pb[1]);
                }
            });
        };
    }

    function flowScene() {
        // How generative models work: samples start as Gaussian noise (right) and
        // follow the probability-flow paths of a linear interpolant
        // x_t = (1 - t) x0 + t z back to a multi-modal data distribution (left).
        // The paths are integrated from the exact velocity field of a 1D Gaussian
        // mixture, so they bend and split like a trained model's would.
        const CYC = 8.5, N = 34, XD = 17, XN = 83, Y0 = 50, SC = 11.5, STEPS = 48;
        let cycleIdx = -1, paths = [], comps = [];
        const yOf = (v) => Y0 - v * SC;
        const xOf = (t) => XD + (XN - XD) * t;
        function velocity(x, t) {
            // E[z - x0 | x_t = x], summed over mixture components
            let wsum = 0, vsum = 0;
            for (const c of comps) {
                const mt = (1 - t) * c.m, vr = (1 - t) ** 2 * c.s * c.s + t * t;
                const w = c.w * Math.exp(-((x - mt) ** 2) / (2 * vr)) / Math.sqrt(vr);
                const r = (x - mt) / vr;
                wsum += w; vsum += w * (t * r - (c.m + (1 - t) * c.s * c.s * r));
            }
            return wsum > 0 ? vsum / wsum : 0;
        }
        function dataDensity(v) {
            let d = 0;
            for (const c of comps) d += c.w * Math.exp(-((v - c.m) ** 2) / (2 * c.s * c.s)) / c.s;
            return d;
        }
        function build(seed) {
            const rnd = mulberry32(seed);
            const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
            const k = 2 + (rnd() < 0.6 ? 1 : 0);
            comps = [];
            for (let i = 0; i < k; i++) {
                comps.push({ m: -1.9 + (i + 0.5) * (3.8 / k) + (rnd() - 0.5) * 0.5, s: 0.17 + rnd() * 0.1, w: 0.6 + rnd() * 0.8 });
            }
            paths = [];
            for (let i = 0; i < N; i++) {
                let x = Math.max(-2.8, Math.min(2.8, gauss()));
                const pts = [x];
                const dt = 1 / STEPS;
                for (let j = 0; j < STEPS; j++) {
                    const t = 1 - j * dt;
                    const xm = x - 0.5 * dt * velocity(x, t);
                    x -= dt * velocity(xm, t - 0.5 * dt);
                    pts.push(x);
                }
                paths.push({ pts, t0: 0.7 + rnd() * 0.6 });
            }
        }
        function profile(ctx, x0, dir, amp, f) {
            ctx.beginPath();
            ctx.moveTo(x0, yOf(-3));
            for (let v = -3; v <= 3.001; v += 0.05) ctx.lineTo(x0 + dir * amp * f(v), yOf(v));
            ctx.lineTo(x0, yOf(3));
            ctx.closePath();
        }
        return function draw(ctx, t) {
            const idx = Math.floor(t / CYC), u = t - idx * CYC;
            if (idx !== cycleIdx) { cycleIdx = idx; build(31337 + idx * 2654435761 % 1000003); }
            const fade = 1 - smooth((u - 7.4) / 0.9);
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            // noise on the right (always there)
            profile(ctx, XN, 1, 10, (v) => Math.exp(-v * v / 2));
            ctx.fillStyle = rgba(C.primary, 0.12); ctx.fill();
            ctx.strokeStyle = rgba(C.primary, 0.6); ctx.lineWidth = 0.6; ctx.stroke();
            ctx.strokeStyle = rgba(C.muted, 0.45); ctx.lineWidth = 0.5;
            line(ctx, XN, yOf(-3.1), XN, yOf(3.1));
            line(ctx, XD, yOf(-3.1), XD, yOf(3.1));
            // data on the left: outline shows the target, it fills as samples land
            let peak = 0;
            for (let v = -3; v <= 3; v += 0.05) peak = Math.max(peak, dataDensity(v));
            const landed = smooth((u - 2.9) / 1.0) * fade;
            profile(ctx, XD, -1, 13, (v) => dataDensity(v) / peak);
            ctx.fillStyle = rgba(C.accent, 0.22 * landed); ctx.fill();
            ctx.strokeStyle = rgba(C.accent, (0.3 + 0.6 * landed) * smooth(u / 0.6) * fade); ctx.lineWidth = 0.6; ctx.stroke();
            // sampling direction
            ctx.strokeStyle = rgba(C.muted, 0.5); ctx.fillStyle = rgba(C.muted, 0.5); ctx.lineWidth = 0.5;
            arrow(ctx, 70, 93, 30, 93, 2);
            // trajectories
            for (const p of paths) {
                const f = smooth((u - p.t0) / 2.6);
                const appear = smooth((u - p.t0 + 0.5) / 0.4) * fade;
                if (appear <= 0) continue;
                const reach = f * STEPS, n = Math.floor(reach);
                ctx.strokeStyle = rgba(C.primary, 0.3 * appear); ctx.lineWidth = 0.45;
                ctx.beginPath();
                ctx.moveTo(xOf(1), yOf(p.pts[0]));
                for (let j = 1; j <= n; j++) ctx.lineTo(xOf(1 - j / STEPS), yOf(p.pts[j]));
                let hx = xOf(1 - n / STEPS), hy = yOf(p.pts[n]);
                if (n < STEPS) {
                    const fr = reach - n;
                    hx = xOf(1 - (n + fr) / STEPS);
                    hy = yOf(p.pts[n] + (p.pts[n + 1] - p.pts[n]) * fr);
                    ctx.lineTo(hx, hy);
                }
                ctx.stroke();
                ctx.fillStyle = f >= 1 ? rgba(C.warm, 0.95 * appear) : rgba(C.primary, 0.9 * appear);
                dot(ctx, hx, hy, 1.05);
            }
        };
    }

    const SCENES = { tree: treeScene, globe: globeScene, views: viewsScene, flow: flowScene };
    const items = canvases.map((c, i) => {
        const make = SCENES[c.dataset.visual];
        return make ? { c, ctx: c.getContext('2d'), draw: make(), offset: i * 1.7, onScreen: false } : null;
    }).filter(Boolean);

    let raf = 0;
    const t0 = performance.now();
    function frame(now) {
        raf = 0;
        const elapsed = Math.max(0, (now - t0) / 1000);
        let any = false;
        for (const it of items) {
            if (!it.onScreen) continue;
            any = true;
            const { c, ctx } = it;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.setTransform(c.width / 100, 0, 0, c.height / 100, 0, 0);
            it.draw(ctx, elapsed + it.offset);
        }
        if (any && !document.hidden) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf && !document.hidden && items.some((it) => it.onScreen)) raf = requestAnimationFrame(frame); };
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            for (const e of entries) { const it = items.find((x) => x.c === e.target); if (it) it.onScreen = e.isIntersecting; }
            kick();
        });
        items.forEach((it) => io.observe(it.c));
    } else {
        items.forEach((it) => { it.onScreen = true; });
    }
    document.addEventListener('visibilitychange', kick);
    kick();
})();
