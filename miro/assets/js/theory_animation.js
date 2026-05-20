/**
 * Theorem visualization for MIRO.
 *
 * Illustrates Theorem 1 (Guidance as Sampling from a Reward-Tilted Distribution)
 * and the Implicit Classifier proposition:
 *     v(x_t, c, s⁺) − v(x_t, c, s⁻)  ≈  −(1−t) ∇_x log [ p(s⁺|x,c) / p(s⁻|x,c) ]
 *
 * Visuals:
 *   - 2D synthetic log-odds landscape  log p(s⁺|x) / p(s⁻|x)  rendered as a heatmap.
 *   - Gradient vector field overlaid (the "implicit guidance direction").
 *   - Particles initialized from the base conditional p(x|c, s⁺) flow along
 *     the gradient as ω increases — visualizing the reward-tilted distribution
 *         p_ω ∝ p(x|s⁺) · [p(s⁺|x) / p(s⁻|x)]^ω
 *     concentrating on the high-log-odds peak as ω → ∞.
 */
(function () {
    'use strict';

    // ============================================================================
    // CONFIGURATION
    // ============================================================================
    const CONFIG = {
        visual: {
            mobileBreakpoint: 720,
            margin: 16,
            // Use device pixel ratio so heatmap and arrows render crisp on Retina.
            // Capped at 2 to keep the offscreen heatmap render time reasonable.
            pixelDensity: Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1),
        },
        // Log-odds landscape: log p(s⁺|x) / p(s⁻|x) as a sum of signed Gaussian bumps.
        // Positive amplitudes = high reward favored (s⁺ more likely than s⁻).
        // Negative amplitudes = low reward dominates (s⁻ more likely than s⁺).
        landscape: [
            // [normX, normY, amp, sigma]
            [0.74, 0.34, +1.00, 0.135],   // global peak — best reward region
            [0.50, 0.74, +0.55, 0.145],   // secondary positive peak
            [0.22, 0.56, -0.65, 0.180],   // low-reward valley
            [0.40, 0.22, -0.35, 0.130],   // small valley
        ],
        field: {
            cols: 18,
            rows: 11,
            colsMobile: 11,
            rowsMobile: 13,
            arrowMinMag: 0.45,
            arrowMaxLen: 0.42,   // fraction of cell size
        },
        particles: {
            count: 90,
            countMobile: 55,
            // Particle dynamics:  dx/dt = η · ω · ∇log-odds  +  noise
            stepBase: 0.0055,
            noiseBase: 0.0028,
            radius: 2.4,
            trailLen: 26,
            trailWidth: 1.1,
        },
        timeline: [
            ['landscape_reveal',  1600],   // heatmap fades in
            ['field_reveal',      1500],   // vector field arrows appear
            ['particles_spawn',   1100],   // particles drop in from p(x|s⁺)
            ['omega_zero',        1800],   // ω=0 — Brownian drift, no guidance
            ['omega_low',         2200],   // ω ramps to ~1.5
            ['omega_high',        3000],   // ω ramps to ~5 — strong concentration
            ['concentrated',      2300],   // tightly clustered around peak
            ['pause',             1600],
        ],
        easing: {
            outQuart: (t) => 1 - Math.pow(1 - t, 4),
            outCubic: (t) => 1 - Math.pow(1 - t, 3),
            inOut:    (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
        },
    };

    // ============================================================================
    // PALETTE
    // ============================================================================
    function getPalette() {
        const s = getComputedStyle(document.documentElement);
        return {
            bg:     s.getPropertyValue('--bg').trim() || '#0b0c10',
            fg:     s.getPropertyValue('--fg').trim() || '#e6e6e6',
            card:   s.getPropertyValue('--card').trim() || '#15171c',
            accent: s.getPropertyValue('--accent').trim() || '#ff9a5c',
            muted:  s.getPropertyValue('--muted').trim() || '#b5b5b5',
        };
    }

    // Heatmap gradient: deep navy (low log-odds, s⁻ region) → warm peak (high log-odds, s⁺ region)
    const HEATMAP_STOPS = [
        { r:  10, g:  16, b:  44, t: 0.00 },
        { r:  32, g:  44, b: 102, t: 0.22 },
        { r:  92, g:  60, b: 132, t: 0.42 },
        { r: 172, g:  68, b: 114, t: 0.60 },
        { r: 230, g: 116, b:  80, t: 0.78 },
        { r: 255, g: 200, b: 130, t: 0.92 },
        { r: 255, g: 240, b: 200, t: 1.00 },
    ];

    function sampleHeatmap(t) {
        const tc = Math.max(0, Math.min(1, t));
        for (let i = 0; i < HEATMAP_STOPS.length - 1; i++) {
            const a = HEATMAP_STOPS[i];
            const b = HEATMAP_STOPS[i + 1];
            if (tc >= a.t && tc <= b.t) {
                const lt = (b.t === a.t) ? 0 : (tc - a.t) / (b.t - a.t);
                return [
                    a.r + (b.r - a.r) * lt,
                    a.g + (b.g - a.g) * lt,
                    a.b + (b.b - a.b) * lt,
                ];
            }
        }
        const last = HEATMAP_STOPS[HEATMAP_STOPS.length - 1];
        return [last.r, last.g, last.b];
    }

    // ============================================================================
    // LANDSCAPE MATH — log-odds and its gradient
    // ============================================================================
    function logOdds(x, y) {
        let v = 0;
        for (let i = 0; i < CONFIG.landscape.length; i++) {
            const peak = CONFIG.landscape[i];
            const dx = x - peak[0];
            const dy = y - peak[1];
            const sigma2 = peak[3] * peak[3];
            v += peak[2] * Math.exp(-(dx * dx + dy * dy) / (2 * sigma2));
        }
        return v;
    }

    function gradLogOdds(x, y) {
        let gx = 0, gy = 0;
        for (let i = 0; i < CONFIG.landscape.length; i++) {
            const peak = CONFIG.landscape[i];
            const dx = x - peak[0];
            const dy = y - peak[1];
            const sigma2 = peak[3] * peak[3];
            const k = -peak[2] * Math.exp(-(dx * dx + dy * dy) / (2 * sigma2)) / sigma2;
            gx += k * dx;
            gy += k * dy;
        }
        return { gx, gy };
    }

    // Find observed log-odds range for normalization (sampled once at setup)
    let LO_MIN = -1, LO_MAX = 1;
    function computeLogOddsRange() {
        let lo = +Infinity, hi = -Infinity;
        const N = 64;
        for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {
                const v = logOdds(i / (N - 1), j / (N - 1));
                if (v < lo) lo = v;
                if (v > hi) hi = v;
            }
        }
        LO_MIN = lo;
        LO_MAX = hi;
    }

    function normLogOdds(x, y) {
        const v = logOdds(x, y);
        return (v - LO_MIN) / Math.max(1e-6, LO_MAX - LO_MIN);
    }

    // ============================================================================
    // SKETCH
    // ============================================================================
    const sketch = (p) => {
        let pal = getPalette();
        let isMobile = false;
        let W = 800, H = 480;
        let heatmap = null;
        let contours = null;
        let particles = [];
        let t0 = 0;
        let playing = false;
        let omegaCurrent = 0;
        const totalMs = CONFIG.timeline.reduce((a, [, d]) => a + d, 0);

        function getStage(elapsed) {
            const t = elapsed % totalMs;
            let acc = 0;
            for (let i = 0; i < CONFIG.timeline.length; i++) {
                const [name, dur] = CONFIG.timeline[i];
                if (t < acc + dur) return { name, prog: (t - acc) / dur, index: i };
                acc += dur;
            }
            return { name: 'pause', prog: 0, index: CONFIG.timeline.length - 1 };
        }

        function getParticleCount() {
            return isMobile ? CONFIG.particles.countMobile : CONFIG.particles.count;
        }

        function getFieldGrid() {
            return isMobile
                ? { cols: CONFIG.field.colsMobile, rows: CONFIG.field.rowsMobile }
                : { cols: CONFIG.field.cols,       rows: CONFIG.field.rows };
        }

        // Sample initial position from the base distribution p(x|c, s⁺).
        // We approximate p ∝ sum of positive landscape peaks (high-reward conditional
        // is concentrated near s⁺ peaks). Use rejection sampling on a uniform grid.
        function sampleBase() {
            // Use only positive peaks as the base distribution
            const posPeaks = CONFIG.landscape.filter(p => p[2] > 0);
            // Rejection sampling
            for (let attempts = 0; attempts < 40; attempts++) {
                const x = 0.06 + Math.random() * 0.88;
                const y = 0.06 + Math.random() * 0.88;
                let v = 0;
                for (const peak of posPeaks) {
                    const dx = x - peak[0];
                    const dy = y - peak[1];
                    const sigma2 = peak[3] * peak[3];
                    v += peak[2] * Math.exp(-(dx * dx + dy * dy) / (2 * sigma2));
                }
                const maxAmp = posPeaks.reduce((a, p) => a + p[2], 0);
                if (Math.random() * maxAmp < v) return { x, y };
            }
            // Fallback uniform
            return { x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8 };
        }

        function spawnParticles() {
            particles = [];
            const n = getParticleCount();
            for (let i = 0; i < n; i++) {
                const pos = sampleBase();
                particles.push({
                    x: pos.x,
                    y: pos.y,
                    trail: [],
                    spawnTime: Math.random() * 0.85,   // staggered appearance
                    seedX: pos.x,
                    seedY: pos.y,
                });
            }
        }

        // -- Offscreen heatmap render (once per setup) -------------------------------
        function renderHeatmap() {
            const dpr = CONFIG.visual.pixelDensity;
            const g = p.createGraphics(W, H);
            g.pixelDensity(dpr);
            g.noStroke();
            // Render at the offscreen's physical resolution so the heatmap stays crisp
            // when the main canvas is also at the same density.
            const physW = Math.round(W * dpr);
            const physH = Math.round(H * dpr);
            const step = isMobile ? Math.max(2, Math.round(2 * dpr)) : Math.max(1, Math.round(1.5 * dpr));
            const buf = g.drawingContext.createImageData(physW, physH);
            for (let py = 0; py < physH; py += step) {
                for (let px = 0; px < physW; px += step) {
                    const nx = px / physW;
                    const ny = py / physH;
                    const u = normLogOdds(nx, ny);
                    const [r, gg, bb] = sampleHeatmap(u);
                    for (let dy = 0; dy < step && py + dy < physH; dy++) {
                        const rowOff = (py + dy) * physW;
                        for (let dx = 0; dx < step && px + dx < physW; dx++) {
                            const idx = (rowOff + (px + dx)) * 4;
                            buf.data[idx]     = r;
                            buf.data[idx + 1] = gg;
                            buf.data[idx + 2] = bb;
                            buf.data[idx + 3] = 255;
                        }
                    }
                }
            }
            g.drawingContext.putImageData(buf, 0, 0);
            return g;
        }

        // -- Offscreen iso-contour overlay (marching squares) ------------------------
        function renderContours() {
            const g = p.createGraphics(W, H);
            g.pixelDensity(CONFIG.visual.pixelDensity);
            g.noFill();
            g.stroke(255, 255, 255, 28);
            g.strokeWeight(0.9);

            const cols = isMobile ? 70 : 110;
            const rows = isMobile ? 50 : 70;
            const cellW = W / cols;
            const cellH = H / rows;
            const levels = [-0.6, -0.3, 0.0, 0.25, 0.5, 0.75];

            for (const lvl of levels) {
                // Highlight the zero-level (p(s⁺|x) = p(s⁻|x))
                if (Math.abs(lvl) < 1e-3) {
                    g.stroke(255, 255, 255, 80);
                    g.strokeWeight(1.2);
                } else {
                    g.stroke(255, 255, 255, 32);
                    g.strokeWeight(0.9);
                }
                for (let cy = 0; cy < rows; cy++) {
                    for (let cx = 0; cx < cols; cx++) {
                        const x0 = cx * cellW;
                        const y0 = cy * cellH;
                        const x1 = x0 + cellW;
                        const y1 = y0 + cellH;
                        const v00 = logOdds(x0 / W, y0 / H);
                        const v10 = logOdds(x1 / W, y0 / H);
                        const v11 = logOdds(x1 / W, y1 / H);
                        const v01 = logOdds(x0 / W, y1 / H);

                        const edges = [];
                        // top
                        if ((v00 > lvl) !== (v10 > lvl)) {
                            const t = (lvl - v00) / (v10 - v00);
                            edges.push([x0 + t * cellW, y0]);
                        }
                        // right
                        if ((v10 > lvl) !== (v11 > lvl)) {
                            const t = (lvl - v10) / (v11 - v10);
                            edges.push([x1, y0 + t * cellH]);
                        }
                        // bottom
                        if ((v01 > lvl) !== (v11 > lvl)) {
                            const t = (lvl - v01) / (v11 - v01);
                            edges.push([x0 + t * cellW, y1]);
                        }
                        // left
                        if ((v00 > lvl) !== (v01 > lvl)) {
                            const t = (lvl - v00) / (v01 - v00);
                            edges.push([x0, y0 + t * cellH]);
                        }
                        if (edges.length === 2) {
                            g.line(edges[0][0], edges[0][1], edges[1][0], edges[1][1]);
                        }
                    }
                }
            }
            return g;
        }

        // -- Vector field arrows ------------------------------------------------------
        function drawVectorField(alpha) {
            const { cols, rows } = getFieldGrid();
            const cellW = W / cols;
            const cellH = H / rows;
            const arrowLen = Math.min(cellW, cellH) * CONFIG.field.arrowMaxLen;
            // Reference max gradient magnitude for normalization
            let maxMag = 0;
            for (let cy = 0; cy < rows; cy++) {
                for (let cx = 0; cx < cols; cx++) {
                    const nx = (cx + 0.5) / cols;
                    const ny = (cy + 0.5) / rows;
                    const { gx, gy } = gradLogOdds(nx, ny);
                    const m = Math.sqrt(gx * gx + gy * gy);
                    if (m > maxMag) maxMag = m;
                }
            }
            if (maxMag < 1e-3) return;

            const ctx = p.drawingContext;
            for (let cy = 0; cy < rows; cy++) {
                for (let cx = 0; cx < cols; cx++) {
                    const px = (cx + 0.5) * cellW;
                    const py = (cy + 0.5) * cellH;
                    const nx = px / W;
                    const ny = py / H;
                    const { gx, gy } = gradLogOdds(nx, ny);
                    const mag = Math.sqrt(gx * gx + gy * gy) / maxMag;
                    if (mag < CONFIG.field.arrowMinMag * 0.4) continue;

                    const angle = Math.atan2(gy, gx);
                    const len = arrowLen * Math.min(1, mag * 1.2 + 0.15);
                    const aAlpha = alpha * Math.min(1, mag * 0.85 + 0.15);

                    ctx.save();
                    ctx.translate(px, py);
                    ctx.rotate(angle);

                    // Shaft
                    ctx.globalAlpha = aAlpha * 0.85;
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
                    ctx.lineWidth = 1.1;
                    ctx.beginPath();
                    ctx.moveTo(-len * 0.45, 0);
                    ctx.lineTo(len * 0.45, 0);
                    ctx.stroke();

                    // Head
                    ctx.globalAlpha = aAlpha;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                    ctx.beginPath();
                    ctx.moveTo(len * 0.55, 0);
                    ctx.lineTo(len * 0.32, -2.6);
                    ctx.lineTo(len * 0.32,  2.6);
                    ctx.closePath();
                    ctx.fill();

                    ctx.restore();
                }
            }
        }

        // -- Particles ----------------------------------------------------------------
        function updateParticles(omega, dtScale) {
            const step = CONFIG.particles.stepBase * dtScale;
            const noise = CONFIG.particles.noiseBase * dtScale;
            const cap = step * 18;
            for (let i = 0; i < particles.length; i++) {
                const pt = particles[i];
                const { gx, gy } = gradLogOdds(pt.x, pt.y);
                let dx = step * omega * gx + (Math.random() - 0.5) * noise * 2;
                let dy = step * omega * gy + (Math.random() - 0.5) * noise * 2;
                // Cap per-step displacement (prevents launching off when omega is high)
                if (dx >  cap) dx =  cap; if (dx < -cap) dx = -cap;
                if (dy >  cap) dy =  cap; if (dy < -cap) dy = -cap;
                pt.x += dx;
                pt.y += dy;
                // Soft clamp
                if (pt.x < 0.02) pt.x = 0.02; if (pt.x > 0.98) pt.x = 0.98;
                if (pt.y < 0.02) pt.y = 0.02; if (pt.y > 0.98) pt.y = 0.98;
                // Trail
                pt.trail.push({ x: pt.x, y: pt.y });
                if (pt.trail.length > CONFIG.particles.trailLen) pt.trail.shift();
            }
        }

        function drawParticles(spawnT, alpha) {
            const ctx = p.drawingContext;
            const r = CONFIG.particles.radius;

            for (let i = 0; i < particles.length; i++) {
                const pt = particles[i];
                // Per-particle staggered appearance during particles_spawn stage
                const visibility = Math.max(0, Math.min(1, (spawnT - pt.spawnTime) * 4));
                if (visibility <= 0) continue;

                // Trail
                if (pt.trail.length > 1) {
                    ctx.save();
                    ctx.lineCap = 'round';
                    for (let j = 1; j < pt.trail.length; j++) {
                        const t0p = pt.trail[j - 1];
                        const t1p = pt.trail[j];
                        const ta = (j / pt.trail.length);
                        ctx.globalAlpha = ta * 0.42 * alpha * visibility;
                        ctx.strokeStyle = 'rgba(255, 220, 180, 1)';
                        ctx.lineWidth = CONFIG.particles.trailWidth;
                        ctx.beginPath();
                        ctx.moveTo(t0p.x * W, t0p.y * H);
                        ctx.lineTo(t1p.x * W, t1p.y * H);
                        ctx.stroke();
                    }
                    ctx.restore();
                }

                // Glow halo
                ctx.save();
                ctx.globalAlpha = 0.55 * alpha * visibility;
                ctx.shadowColor = '#ffd9a8';
                ctx.shadowBlur = 10;
                ctx.fillStyle = '#ffd9a8';
                ctx.beginPath();
                ctx.arc(pt.x * W, pt.y * H, r * 1.6, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // Bright core
                ctx.save();
                ctx.globalAlpha = alpha * visibility;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(pt.x * W, pt.y * H, r * 0.95, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        // -- Annotations / labels ----------------------------------------------------
        function drawAnnotations(stageName, omegaShown, alphaHero, alphaLandscape) {
            const ctx = p.drawingContext;
            const M = CONFIG.visual.margin;

            // Color-scale legend (top-right) — appears once landscape is up
            if (alphaLandscape > 0.4) {
                const legendW = isMobile ? 110 : 150;
                const legendH = 10;
                const lx = W - legendW - M;
                const ly = M + 4;
                const grad = ctx.createLinearGradient(lx, ly, lx + legendW, ly);
                for (const stop of HEATMAP_STOPS) {
                    const [r, g, b] = sampleHeatmap(stop.t);
                    grad.addColorStop(stop.t, `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`);
                }
                ctx.save();
                ctx.globalAlpha = alphaLandscape;
                ctx.fillStyle = grad;
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(lx, ly, legendW, legendH, 4);
                    ctx.fill();
                } else {
                    ctx.fillRect(lx, ly, legendW, legendH);
                }
                // Tick labels
                ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
                ctx.font = `${isMobile ? 9 : 10}px system-ui, -apple-system, sans-serif`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText('low', lx, ly + legendH + 3);
                ctx.textAlign = 'right';
                ctx.fillText('high', lx + legendW, ly + legendH + 3);
                ctx.textAlign = 'center';
                ctx.fillText('log p(s⁺|x) / p(s⁻|x)', lx + legendW / 2, ly - 12);
                ctx.restore();
            }

            // Title (top-left)
            ctx.save();
            ctx.globalAlpha = alphaHero;
            ctx.fillStyle = pal.fg;
            ctx.font = `600 ${isMobile ? 12 : 14}px system-ui, -apple-system, sans-serif`;
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.fillText('Implicit log-odds landscape', M, M);
            ctx.fillStyle = pal.muted;
            ctx.font = `400 ${isMobile ? 10 : 11}px system-ui, -apple-system, sans-serif`;
            ctx.fillText('learned by MIRO without an external classifier', M, M + (isMobile ? 16 : 19));
            ctx.restore();

            // ω indicator (bottom-left)
            if (omegaShown != null) {
                const bx = M;
                const by = H - M - (isMobile ? 38 : 44);
                const labelText = 'guidance ω';
                const valueText = omegaShown.toFixed(1);
                ctx.save();
                // Pill background
                ctx.globalAlpha = 0.85;
                ctx.fillStyle = 'rgba(11, 12, 16, 0.65)';
                const padX = 12;
                const padY = 8;
                ctx.font = `600 ${isMobile ? 20 : 24}px system-ui, -apple-system, sans-serif`;
                const vw = ctx.measureText(valueText).width;
                ctx.font = `500 ${isMobile ? 10 : 11}px system-ui, -apple-system, sans-serif`;
                const lw = ctx.measureText(labelText).width;
                const pillW = Math.max(vw, lw) + padX * 2;
                const pillH = (isMobile ? 38 : 44);
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(bx, by, pillW, pillH, 8);
                    ctx.fill();
                } else {
                    ctx.fillRect(bx, by, pillW, pillH);
                }
                // border accent
                ctx.globalAlpha = 1;
                ctx.strokeStyle = pal.accent;
                ctx.lineWidth = 1;
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(bx + 0.5, by + 0.5, pillW - 1, pillH - 1, 8);
                    ctx.stroke();
                }
                // Label
                ctx.fillStyle = pal.muted;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(labelText, bx + padX, by + padY - 2);
                // Value
                ctx.fillStyle = pal.accent;
                ctx.font = `700 ${isMobile ? 20 : 24}px system-ui, -apple-system, sans-serif`;
                ctx.fillText(valueText, bx + padX, by + padY + (isMobile ? 8 : 10));
                ctx.restore();
            }

            // Caption hint (bottom center, fades in when particles flow)
            if (stageName === 'omega_low' || stageName === 'omega_high' || stageName === 'concentrated') {
                ctx.save();
                ctx.globalAlpha = 0.9;
                ctx.fillStyle = 'rgba(255,255,255,0.78)';
                ctx.font = `italic 400 ${isMobile ? 10 : 12}px system-ui, -apple-system, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                const hintY = H - M;
                const hintX = W / 2 + (isMobile ? 0 : 40);
                ctx.fillText('samples flow along  ∇ log-odds  ≈  v(s⁺) − v(s⁻)', hintX, hintY);
                ctx.restore();
            }

            // Pin annotations on the high-reward and low-reward peaks
            if (alphaLandscape > 0.6) {
                const highPeak = CONFIG.landscape[0]; // global positive peak
                const lowPeak  = CONFIG.landscape[2]; // dominant negative valley
                drawPinLabel(ctx, highPeak[0] * W, highPeak[1] * H, 'high reward  (s⁺)', '#ffd9a8', alphaLandscape);
                drawPinLabel(ctx, lowPeak[0]  * W, lowPeak[1]  * H, 'low reward  (s⁻)',  '#7a90c8', alphaLandscape * 0.85);
            }
        }

        function drawPinLabel(ctx, x, y, text, color, alpha) {
            ctx.save();
            ctx.globalAlpha = alpha;
            // dot
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            // label
            ctx.font = `500 ${isMobile ? 10 : 11}px system-ui, -apple-system, sans-serif`;
            const tw = ctx.measureText(text).width;
            const ox = x + 8;
            const oy = y - 6;
            ctx.fillStyle = 'rgba(11, 12, 16, 0.55)';
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(ox - 4, oy - (isMobile ? 9 : 10), tw + 8, isMobile ? 14 : 16, 4);
                ctx.fill();
            } else {
                ctx.fillRect(ox - 4, oy - (isMobile ? 9 : 10), tw + 8, isMobile ? 14 : 16);
            }
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, ox, oy - 1);
            ctx.restore();
        }

        // -- Layout -------------------------------------------------------------------
        function pickSize() {
            const parent = p.select('#theoryAnimation').elt;
            const W0 = Math.min(parent.clientWidth || 960, 980);
            isMobile = W0 < CONFIG.visual.mobileBreakpoint;
            W = W0;
            H = isMobile ? Math.round(W * 1.05) : Math.round(W * 0.56);
            // Caps to keep things reasonable
            H = Math.max(360, Math.min(620, H));
        }

        // ============================================================================
        // P5 LIFECYCLE
        // ============================================================================
        p.setup = () => {
            computeLogOddsRange();
            pickSize();
            const canvas = p.createCanvas(W, H);
            canvas.style('display', 'block');
            canvas.style('margin', '0 auto');
            canvas.style('border-radius', '14px');
            canvas.style('cursor', 'pointer');
            const parent = p.select('#theoryAnimation');
            parent.elt.insertBefore(canvas.elt, parent.elt.firstChild);
            p.pixelDensity(CONFIG.visual.pixelDensity);

            heatmap = renderHeatmap();
            contours = renderContours();
            pal = getPalette();
            spawnParticles();

            // Pause/play via intersection observer
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
                        if (!playing) {
                            t0 = p.millis();
                            spawnParticles();
                            playing = true;
                            p.loop();
                        }
                    } else {
                        playing = false;
                        p.noLoop();
                    }
                });
            }, { threshold: 0.3 });
            observer.observe(canvas.elt);

            // Click to restart loop
            parent.elt.addEventListener('click', () => {
                t0 = p.millis();
                spawnParticles();
                playing = true;
                p.loop();
            });

            p.noLoop();
        };

        p.windowResized = () => {
            const prevW = W, prevH = H;
            pickSize();
            if (prevW !== W || prevH !== H) {
                p.resizeCanvas(W, H);
                heatmap = renderHeatmap();
                contours = renderContours();
                spawnParticles();
            }
        };

        p.draw = () => {
            if (!playing) return;
            const elapsed = p.millis() - t0;
            const { name: stageName, prog } = getStage(elapsed);
            pal = getPalette();

            // Stage-driven alphas + omega target
            let heatA = 1, contA = 1, fieldA = 1, partA = 1;
            let omegaTarget = 0;
            let spawnT = 1;

            if (stageName === 'landscape_reveal') {
                heatA = CONFIG.easing.outQuart(prog);
                contA = heatA * 0.85;
                fieldA = 0; partA = 0; omegaTarget = 0; spawnT = 0;
            } else if (stageName === 'field_reveal') {
                heatA = 1; contA = 0.85;
                fieldA = CONFIG.easing.outQuart(prog);
                partA = 0; omegaTarget = 0; spawnT = 0;
            } else if (stageName === 'particles_spawn') {
                heatA = 1; contA = 0.85; fieldA = 1;
                partA = 1;
                spawnT = CONFIG.easing.outCubic(prog);
                omegaTarget = 0;
            } else if (stageName === 'omega_zero') {
                heatA = 1; contA = 0.85; fieldA = 1; partA = 1; spawnT = 1;
                omegaTarget = 0;
            } else if (stageName === 'omega_low') {
                heatA = 1; contA = 0.85; fieldA = 1; partA = 1; spawnT = 1;
                omegaTarget = 1.5 * CONFIG.easing.outCubic(prog);
            } else if (stageName === 'omega_high') {
                heatA = 1; contA = 0.85; fieldA = 1 - 0.35 * prog; partA = 1; spawnT = 1;
                omegaTarget = 1.5 + 3.5 * CONFIG.easing.outQuart(prog);
            } else if (stageName === 'concentrated') {
                heatA = 1; contA = 0.85; fieldA = 0.65 - 0.25 * prog; partA = 1; spawnT = 1;
                omegaTarget = 5.0 - 0.8 * prog;
            } else if (stageName === 'pause') {
                heatA = 1; contA = 0.85; fieldA = 0.40; partA = 1; spawnT = 1;
                omegaTarget = 4.2;
            }

            // Smooth ω toward target
            const lerpRate = 0.06;
            omegaCurrent += (omegaTarget - omegaCurrent) * lerpRate;

            // Background wash (fade)
            p.clear();
            p.background(pal.bg);

            // Heatmap
            if (heatmap && heatA > 0) {
                p.push();
                p.drawingContext.globalAlpha = heatA;
                p.image(heatmap, 0, 0);
                p.pop();
            }
            // Contours
            if (contours && contA > 0) {
                p.push();
                p.drawingContext.globalAlpha = contA;
                p.image(contours, 0, 0);
                p.pop();
            }
            // Vector field
            if (fieldA > 0.01) drawVectorField(fieldA);

            // Particle dynamics
            // Use displayed ω so motion matches the indicator
            const stepRate = 1.0; // per-frame scale
            updateParticles(omegaCurrent, stepRate);

            // Particles
            if (partA > 0) drawParticles(spawnT, partA);

            // Annotations
            drawAnnotations(stageName, omegaCurrent, /* alphaHero */ heatA, /* alphaLandscape */ heatA);
        };
    };

    function init() {
        if (!document.getElementById('theoryAnimation')) return;
        if (typeof p5 === 'undefined') {
            // p5 might not have loaded yet (defer); retry shortly
            setTimeout(init, 80);
            return;
        }
        new p5(sketch, document.getElementById('theoryAnimation'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
