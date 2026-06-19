(function () {
    const canvas = document.getElementById('fid-lottery-thumbnail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;   // 360
    const H = canvas.height;  // 360

    // A miniature casino slot machine, echoing the paper's framing on the
    // fid-lottery site: every reported FID is the payout of a spin, the same
    // recipe each pull, a different number every time. Three reels stand in
    // for the hidden sources of randomness (init weights / data order /
    // training noise); the readout pays out an FID score that varies from
    // pull to pull. Palette lifted from the project page (baize + gold/brass).
    const BAIZE_900 = '#062019';
    const BAIZE_850 = '#08291f';
    const BAIZE_800 = '#0b3a2c';
    const BAIZE_GLOW = '#1f7d5a';
    const GOLD_100 = '#fbf3d4';
    const GOLD_200 = '#f3e2a6';
    const GOLD_300 = '#ecd185';
    const GOLD_400 = '#e0bf6a';
    const GOLD_500 = '#c8a24a';
    const GOLD_600 = '#a8842f';
    const GOLD_700 = '#7d6020';
    const BRASS = '#b8923c';
    const BRASS_HI = '#fff3cf';
    const BRASS_DEEP = '#4a3712';
    const IVORY = '#f6efdc';
    const CLARET = '#8f241f';
    const CLARET_BR = '#c8453c';
    const AMBER = '#ffd36b';

    function roundRect(c, x, y, w, h, r) {
        if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
        c.beginPath();
        c.moveTo(x + r.tl, y);
        c.lineTo(x + w - r.tr, y);
        c.arcTo(x + w, y, x + w, y + r.tr, r.tr);
        c.lineTo(x + w, y + h - r.br);
        c.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
        c.lineTo(x + r.bl, y + h);
        c.arcTo(x, y + h, x, y + h - r.bl, r.bl);
        c.lineTo(x, y + r.tl);
        c.arcTo(x, y, x + r.tl, y, r.tl);
        c.closePath();
    }

    // Reel symbols: classic casino glyphs, themed gold and claret so they
    // read on the baize. The payline result varies; the FID readout is the
    // real "score".
    const SYMBOLS = [
        { ch: '7', kind: 'gold', font: 'bold 40px Georgia, "Times New Roman", serif' },
        { ch: '★', kind: 'gold', font: 'bold 38px Georgia, serif' },          // ★
        { ch: '♦', kind: 'claret', font: 'bold 40px Georgia, serif' },        // ♦
        { ch: '♣', kind: 'dark', font: 'bold 38px Georgia, serif' },          // ♣
        { ch: '♥', kind: 'claret', font: 'bold 40px Georgia, serif' },        // ♥
        { ch: '♠', kind: 'dark', font: 'bold 38px Georgia, serif' },          // ♠
    ];
    const N = SYMBOLS.length;

    // Reel geometry (in 360-space)
    const CAB_X = 34, CAB_Y = 28, CAB_W = 268, CAB_H = 304;     // cabinet outer
    const WIN_X = 64, WIN_Y = 124, WIN_W = 208, WIN_H = 96;     // reel window
    const CELL_H = 58;
    const COL_GAP = 9;
    const COL_W = (WIN_W - 4 * COL_GAP) / 3;                    // 3 reels, inset gaps
    const COL_CX = [
        WIN_X + COL_GAP + COL_W / 2,
        WIN_X + 2 * COL_GAP + COL_W * 1.5,
        WIN_X + 3 * COL_GAP + COL_W * 2.5,
    ];
    const REEL_CY = WIN_Y + WIN_H / 2;

    // Readout panel
    const RD_X = WIN_X, RD_Y = WIN_Y + WIN_H + 14, RD_W = WIN_W, RD_H = 50;

    // Lever (right of cabinet)
    const LEV_X = CAB_X + CAB_W + 8;
    const LEV_TOP = 150, LEV_TRAVEL = 34;

    // --- Cycle timing (seconds) ---
    const PULL_START = 0.10;
    const RELEASE = 0.52;             // lever bottoms out, reels launch
    const STOPS = [1.95, 2.55, 3.15]; // staggered reel stop times
    const REVEAL = STOPS[2];          // payout locks when last reel stops
    const CYCLE = 4.9;

    // --- Per-cycle drawn state (regenerated each loop) ---
    // Positions are cumulative (ever-increasing) so a reel rests on its
    // previous result and then spins forward onto the new one, with no pop
    // between cycles.
    let cycleIdx = -1;
    let reelRest = [0, 0, 0];     // where the reel sat before this spin
    let reelTarget = [0, 0, 0];   // where it lands this spin (cells, cumulative)
    let fidValue = 2.3;
    let jackpot = false;
    let flickerSeed = 0;

    // tiny deterministic PRNG so a cycle is stable across frames
    function rng(seed) {
        let s = (seed * 2654435761) >>> 0;
        return function () {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 4294967296;
        };
    }

    function regen(idx) {
        const r = rng(idx + 17);
        for (let i = 0; i < 3; i++) {
            // rest on the previous landing, then spin forward several whole
            // turns onto a fresh random symbol (staggered per reel)
            reelRest[i] = reelTarget[i];
            reelTarget[i] = reelRest[i] + 12 + i * 5 + Math.floor(r() * N);
        }
        // Most pulls land an unremarkable FID; every ~6th is a lucky low
        // score, the paper's "lucky training seed" reaching a great FID.
        jackpot = (idx % 6 === 2);
        if (jackpot) {
            fidValue = 1.61 + r() * 0.24;
        } else {
            const g = (r() + r() + r() - 1.5);      // approx zero-mean
            fidValue = 2.46 + g * 0.40;
            if (fidValue < 2.02) fidValue = 2.02 + r() * 0.16;
        }
        flickerSeed = (idx * 97 + 3) >>> 0;
    }

    function easeOutSpin(u) {              // fast launch, smooth decel into stop
        const v = 1 - u;
        return 1 - v * v * v;
    }
    function easePull(u) { return u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u); }

    // Reel position (in cells) and velocity (cells/s) at cycle-time t.
    function reelState(i, t) {
        const start = RELEASE;
        const end = STOPS[i];
        const rest = reelRest[i];
        const D = reelTarget[i];
        if (t <= start) return { pos: rest, vel: 0, spinning: false };
        if (t >= end) return { pos: D, vel: 0, spinning: false };
        const span = D - rest;
        const dur = end - start;
        const u = (t - start) / dur;
        const pos = rest + span * easeOutSpin(u);
        const vel = span * 3 * (1 - u) * (1 - u) / dur;   // d/dt of easeOutSpin
        return { pos, vel, spinning: true };
    }

    // ---- symbol drawing ----
    function symbolFill(c, kind, y0, y1) {
        const g = c.createLinearGradient(0, y0, 0, y1);
        if (kind === 'claret') {
            g.addColorStop(0, '#e8675c');
            g.addColorStop(0.5, CLARET_BR);
            g.addColorStop(1, CLARET);
        } else if (kind === 'dark') {
            g.addColorStop(0, GOLD_300);
            g.addColorStop(0.5, GOLD_600);
            g.addColorStop(1, BRASS_DEEP);
        } else {
            g.addColorStop(0, GOLD_100);
            g.addColorStop(0.45, GOLD_300);
            g.addColorStop(1, GOLD_600);
        }
        return g;
    }

    function drawSymbol(cx, cy, idx, alpha) {
        const sym = SYMBOLS[idx];
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = sym.font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // soft drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.fillText(sym.ch, cx + 1.2, cy + 2.2);
        ctx.fillStyle = symbolFill(ctx, sym.kind, cy - 22, cy + 22);
        ctx.fillText(sym.ch, cx, cy);
        ctx.restore();
    }

    function drawReel(i, t) {
        const st = reelState(i, t);
        const cx = COL_CX[i];
        const x = cx - COL_W / 2;

        ctx.save();
        roundRect(ctx, x, WIN_Y + 3, COL_W, WIN_H - 6, 7);
        ctx.clip();

        // reel backing
        const rg = ctx.createLinearGradient(0, WIN_Y, 0, WIN_Y + WIN_H);
        rg.addColorStop(0, '#03110c');
        rg.addColorStop(0.5, '#0a241a');
        rg.addColorStop(1, '#03110c');
        ctx.fillStyle = rg;
        ctx.fillRect(x, WIN_Y, COL_W, WIN_H);

        const pos = st.pos;
        const base = Math.floor(pos);
        const frac = pos - base;
        const fast = st.vel > 5;
        const symAlpha = fast ? Math.max(0.32, 1 - st.vel * 0.05) : 1;

        for (let k = -2; k <= 2; k++) {
            const idx = (((base + k) % N) + N) % N;
            const y = REEL_CY + (k - frac) * CELL_H;
            if (y < WIN_Y - CELL_H || y > WIN_Y + WIN_H + CELL_H) continue;
            drawSymbol(cx, y, idx, symAlpha);
        }

        // motion streaks while spinning fast
        if (fast) {
            ctx.globalAlpha = Math.min(0.5, st.vel * 0.04);
            const sg = ctx.createLinearGradient(x, 0, x + COL_W, 0);
            sg.addColorStop(0, 'rgba(251,243,212,0)');
            sg.addColorStop(0.5, 'rgba(251,243,212,0.5)');
            sg.addColorStop(1, 'rgba(251,243,212,0)');
            ctx.fillStyle = sg;
            for (let s = 0; s < 3; s++) {
                const yy = WIN_Y + 12 + s * 28 + ((t * 900) % 28);
                ctx.fillRect(x + 6, yy, COL_W - 12, 2);
            }
            ctx.globalAlpha = 1;
        }

        // inner shading top & bottom (cylinder curve)
        let sh = ctx.createLinearGradient(0, WIN_Y, 0, WIN_Y + 26);
        sh.addColorStop(0, 'rgba(0,0,0,0.6)');
        sh.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sh;
        ctx.fillRect(x, WIN_Y, COL_W, 26);
        sh = ctx.createLinearGradient(0, WIN_Y + WIN_H - 26, 0, WIN_Y + WIN_H);
        sh.addColorStop(0, 'rgba(0,0,0,0)');
        sh.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = sh;
        ctx.fillRect(x, WIN_Y + WIN_H - 26, COL_W, 26);

        ctx.restore();

        // reel separator / frame
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        roundRect(ctx, x, WIN_Y + 3, COL_W, WIN_H - 6, 7);
        ctx.stroke();
    }

    // ---- static backdrop (cabinet, frame, crown), painted once ----
    const back = document.createElement('canvas');
    back.width = W; back.height = H;
    const bctx = back.getContext('2d');

    function paintBackdrop() {
        const c = bctx;
        // baize table
        let g = c.createRadialGradient(W / 2, H * 0.42, 30, W / 2, H * 0.5, W * 0.75);
        g.addColorStop(0, BAIZE_GLOW);
        g.addColorStop(0.4, BAIZE_800);
        g.addColorStop(1, BAIZE_900);
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);
        // vignette
        g = c.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.72);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.55)');
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);

        // machine drop shadow on the felt
        c.save();
        c.filter = 'blur(9px)';
        c.fillStyle = 'rgba(0,0,0,0.45)';
        roundRect(c, CAB_X + 6, CAB_Y + 16, CAB_W, CAB_H, 30);
        c.fill();
        c.restore();

        // ---- brass cabinet bezel ----
        let bg = c.createLinearGradient(CAB_X, CAB_Y, CAB_X + CAB_W, CAB_Y + CAB_H);
        bg.addColorStop(0, GOLD_200);
        bg.addColorStop(0.18, BRASS);
        bg.addColorStop(0.5, GOLD_500);
        bg.addColorStop(0.82, GOLD_700);
        bg.addColorStop(1, BRASS_DEEP);
        c.fillStyle = bg;
        roundRect(c, CAB_X, CAB_Y, CAB_W, CAB_H, 30);
        c.fill();
        // bezel highlight rim
        c.strokeStyle = 'rgba(255,243,207,0.55)';
        c.lineWidth = 1.5;
        roundRect(c, CAB_X + 1.5, CAB_Y + 1.5, CAB_W - 3, CAB_H - 3, 28);
        c.stroke();
        c.strokeStyle = 'rgba(74,55,18,0.65)';
        roundRect(c, CAB_X, CAB_Y, CAB_W, CAB_H, 30);
        c.stroke();

        // ---- inner dark face ----
        const ix = CAB_X + 16, iy = CAB_Y + 58, iw = CAB_W - 32, ih = CAB_H - 76;
        let fg = c.createLinearGradient(0, iy, 0, iy + ih);
        fg.addColorStop(0, BAIZE_800);
        fg.addColorStop(1, '#04140e');
        c.fillStyle = fg;
        roundRect(c, ix, iy, iw, ih, 16);
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.55)';
        c.lineWidth = 1;
        roundRect(c, ix, iy, iw, ih, 16);
        c.stroke();

        // ---- coin tray (recessed slot near the base) ----
        const tx = W / 2 - 48, ty = 296, tw = 96, th = 13;
        const tg = c.createLinearGradient(0, ty, 0, ty + th);
        tg.addColorStop(0, '#010a07');
        tg.addColorStop(1, '#0a241a');
        c.fillStyle = tg;
        roundRect(c, tx, ty, tw, th, 6);
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.7)';
        c.lineWidth = 1;
        roundRect(c, tx, ty, tw, th, 6);
        c.stroke();
        c.strokeStyle = 'rgba(232,209,133,0.5)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(tx + 4, ty + th + 1.5);
        c.lineTo(tx + tw - 4, ty + th + 1.5);
        c.stroke();

        // ---- crown nameplate ----
        const px = CAB_X + 34, py = CAB_Y + 12, pw = CAB_W - 68, ph = 34;
        let pg = c.createLinearGradient(0, py, 0, py + ph);
        pg.addColorStop(0, CLARET_BR);
        pg.addColorStop(1, CLARET);
        c.fillStyle = pg;
        roundRect(c, px, py, pw, ph, 9);
        c.fill();
        c.strokeStyle = GOLD_300;
        c.lineWidth = 1.5;
        roundRect(c, px, py, pw, ph, 9);
        c.stroke();
        // nameplate text
        c.save();
        c.font = '800 16px Inter, system-ui, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillText('F I D   L O T T E R Y', W / 2 + 1, py + ph / 2 + 1.5);
        c.fillStyle = GOLD_100;
        c.fillText('F I D   L O T T E R Y', W / 2, py + ph / 2);
        c.restore();

        back._bulbY = py + ph / 2;
        back._bulbX0 = px;
        back._bulbX1 = px + pw;
    }
    paintBackdrop();
    // The nameplate text is baked into the backdrop once; repaint it after web
    // fonts resolve so it isn't stuck on the fallback face.
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(paintBackdrop).catch(function () { });
    }

    // ---- dynamic foreground ----
    let animId = null;
    let visible = true;
    let t0 = performance.now();

    function drawBulbs(t) {
        const n = 9;
        const y = CAB_Y + 12 + 34 + 7;       // just under the nameplate
        const x0 = CAB_X + 40, x1 = CAB_X + CAB_W - 40;
        for (let i = 0; i < n; i++) {
            const x = x0 + (x1 - x0) * (i / (n - 1));
            const phase = (t * 3 + i * 0.7);
            let on = (Math.sin(phase) * 0.5 + 0.5);
            if (jackpot && t > REVEAL) on = 0.6 + 0.4 * Math.sin(t * 14 + i);
            const r = 3.0;
            const gg = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
            gg.addColorStop(0, 'rgba(255,236,170,' + (0.5 + 0.5 * on) + ')');
            gg.addColorStop(0.4, 'rgba(255,211,107,' + (0.25 + 0.35 * on) + ')');
            gg.addColorStop(1, 'rgba(255,211,107,0)');
            ctx.fillStyle = gg;
            ctx.beginPath();
            ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = on > 0.5 ? GOLD_100 : GOLD_600;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawPayline() {
        // glowing payline band across the centre row
        ctx.save();
        roundRect(ctx, WIN_X, REEL_CY - CELL_H / 2 + 6, WIN_W, CELL_H - 12, 6);
        ctx.strokeStyle = 'rgba(255,211,107,0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        // arrows pointing at the payline
        ctx.fillStyle = CLARET_BR;
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText('▸', CAB_X + 19, REEL_CY);
        ctx.textAlign = 'right';
        ctx.fillText('◂', CAB_X + CAB_W - 19, REEL_CY);
    }

    function drawGlass() {
        ctx.save();
        roundRect(ctx, WIN_X, WIN_Y, WIN_W, WIN_H, 8);
        ctx.clip();
        const g = ctx.createLinearGradient(WIN_X, WIN_Y, WIN_X + WIN_W * 0.6, WIN_Y + WIN_H);
        g.addColorStop(0, 'rgba(255,255,255,0.16)');
        g.addColorStop(0.25, 'rgba(255,255,255,0.04)');
        g.addColorStop(0.5, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(WIN_X, WIN_Y, WIN_W, WIN_H);
        ctx.restore();
        // window frame
        ctx.strokeStyle = BRASS_DEEP;
        ctx.lineWidth = 3;
        roundRect(ctx, WIN_X - 1.5, WIN_Y - 1.5, WIN_W + 3, WIN_H + 3, 9);
        ctx.stroke();
        ctx.strokeStyle = GOLD_300;
        ctx.lineWidth = 1;
        roundRect(ctx, WIN_X, WIN_Y, WIN_W, WIN_H, 8);
        ctx.stroke();
    }

    function drawReadout(t) {
        // inset dark panel
        ctx.save();
        roundRect(ctx, RD_X, RD_Y, RD_W, RD_H, 8);
        const pg = ctx.createLinearGradient(0, RD_Y, 0, RD_Y + RD_H);
        pg.addColorStop(0, '#02100a');
        pg.addColorStop(1, '#06180f');
        ctx.fillStyle = pg;
        ctx.fill();
        ctx.strokeStyle = BRASS_DEEP;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;
        roundRect(ctx, RD_X + 2.5, RD_Y + 2.5, RD_W - 5, RD_H - 5, 6);
        ctx.stroke();
        ctx.restore();

        // "FID" label
        ctx.save();
        ctx.font = '700 12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(200,162,74,0.85)';
        ctx.fillText('FID', RD_X + 14, RD_Y + RD_H / 2);

        // the number
        const settled = t >= REVEAL;
        let text;
        if (settled) {
            text = fidValue.toFixed(2);
        } else {
            // flicker fast pseudo-values while reels spin
            const f = Math.floor(t * 22) + flickerSeed;
            const r = rng(f)();
            text = (1.6 + r * 1.5).toFixed(2);
        }

        // glow flash right after lock
        let glow = 8;
        let col = AMBER;
        if (settled) {
            const since = t - REVEAL;
            glow = 8 + 22 * Math.exp(-since * 4);
            if (jackpot) {
                col = GOLD_100;
                glow = 12 + 20 * (0.6 + 0.4 * Math.sin(t * 12));
            }
        }
        ctx.font = '700 30px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.shadowColor = jackpot && settled ? AMBER : 'rgba(255,211,107,0.9)';
        ctx.shadowBlur = glow;
        ctx.fillStyle = col;
        ctx.fillText(text, RD_X + RD_W - 16, RD_Y + RD_H / 2 + 1);
        ctx.restore();

        // JACKPOT tag
        if (jackpot && settled) {
            const blink = 0.5 + 0.5 * Math.sin(t * 10);
            ctx.save();
            ctx.font = '800 9px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255,236,170,' + (0.5 + 0.5 * blink) + ')';
            ctx.fillText('JACKPOT', W / 2, RD_Y - 6);
            ctx.restore();
        }
    }

    function drawLever(t) {
        // pull down during anticipation, return late in the cycle
        let down = 0;
        if (t > PULL_START && t < RELEASE) {
            down = easePull((t - PULL_START) / (RELEASE - PULL_START));
        } else if (t >= RELEASE && t < RELEASE + 0.5) {
            down = 1 - easePull((t - RELEASE) / 0.5);  // snap back up
        }
        const knobY = LEV_TOP + LEV_TRAVEL * down;

        // mount
        ctx.fillStyle = BRASS_DEEP;
        roundRect(ctx, LEV_X - 4, LEV_TOP + 36, 12, 26, 4);
        ctx.fill();
        // shaft
        const sg = ctx.createLinearGradient(LEV_X - 3, 0, LEV_X + 5, 0);
        sg.addColorStop(0, GOLD_600);
        sg.addColorStop(0.5, GOLD_200);
        sg.addColorStop(1, GOLD_700);
        ctx.fillStyle = sg;
        roundRect(ctx, LEV_X - 2.5, knobY, 7, LEV_TOP + 44 - knobY, 3);
        ctx.fill();
        // knob (red ball)
        const kx = LEV_X + 1, ky = knobY;
        const kg = ctx.createRadialGradient(kx - 3, ky - 3, 1, kx, ky, 11);
        kg.addColorStop(0, '#ff8d80');
        kg.addColorStop(0.5, CLARET_BR);
        kg.addColorStop(1, CLARET);
        ctx.fillStyle = kg;
        ctx.beginPath();
        ctx.arc(kx, ky, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(kx - 3, ky - 3.5, 2.6, 0, Math.PI * 2);
        ctx.fill();
    }

    // gold coin sparkles on a jackpot
    const sparks = [];
    function spawnSparks() {
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2 + 0.3;
            const sp = 70 + (i % 5) * 18;
            sparks.push({
                x: W / 2, y: RD_Y + RD_H / 2,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
                life: 1,
            });
        }
    }
    let lastJackCycle = -1;
    function drawSparks(dt, t) {
        if (jackpot && t > REVEAL && lastJackCycle !== cycleIdx) {
            lastJackCycle = cycleIdx;
            spawnSparks();
        }
        for (let i = sparks.length - 1; i >= 0; i--) {
            const s = sparks[i];
            s.life -= dt * 1.1;
            if (s.life <= 0) { sparks.splice(i, 1); continue; }
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.vy += 220 * dt;   // gravity
            const a = Math.max(0, s.life);
            ctx.fillStyle = 'rgba(255,221,130,' + a + ')';
            ctx.beginPath();
            ctx.arc(s.x, s.y, 2.4 * a + 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    let lastNow = t0;
    function draw(now) {
        const elapsed = (now - t0) / 1000;
        const dt = Math.min(0.05, (now - lastNow) / 1000);
        lastNow = now;

        const idx = Math.floor(elapsed / CYCLE);
        if (idx !== cycleIdx) {
            cycleIdx = idx;
            regen(idx);
        }
        const t = elapsed - idx * CYCLE;

        ctx.drawImage(back, 0, 0);
        drawBulbs(t);
        for (let i = 0; i < 3; i++) drawReel(i, t);
        drawGlass();
        drawPayline();
        drawReadout(t);
        drawLever(t);
        drawSparks(dt, t);

        if (visible) {
            animId = requestAnimationFrame(draw);
        } else {
            animId = null;
        }
    }

    function start() {
        if (animId !== null) return;
        lastNow = performance.now();
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
