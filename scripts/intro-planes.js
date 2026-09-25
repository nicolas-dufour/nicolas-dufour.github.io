(function () {
    const container = document.getElementById('intro-three-container');
    if (!container) return;

    const T = window.THREE;
    if (!T) { console.warn('THREE not loaded'); return; }

    let scene, camera, renderer, composer, clock;
    let planes = [];
    let bgMesh, bgMaterial;
    let animationId = null;
    let sceneLights = null;
    let currents = [];
    let drawingCurrent = null;
    let pointerActive = false;
    let pointerStart = null;
    let raycaster = null;
    let ndcVec = null;

    // ── Configuration ────────────────────────────────────────────────

    const params = {
        planeCount: 30,
        scaleMin: 0.6,
        scaleMax: 1.6,
        wingFlutterAmp: 0.06,
        wingFlutterFreq: 2.5,

        // Glider flight model (scene units, seconds)
        gravity: 0.6,          // sets the phugoid period (~pi*sqrt(2)*V0/g, about 8s)
        trimSpeedMin: 0.9,     // airspeed each plane settles back to
        trimSpeedMax: 1.35,
        speedDamping: 0.25,    // how fast airspeed relaxes to trim (damps the phugoid)
        minSpeed: 0.3,
        maxBank: 0.6,          // rad
        bankRate: 1.8,         // 1/s, how quickly the roll follows the command
        courseGain: 0.35,      // how firmly a plane steers toward the far side
        wanderBank: 0.3,      // lazy S-turns layered on top of the course
        altitudeGain: 0.05,    // lift bias per unit of altitude error
        swoopEvery: [7, 18],   // s between swoops (a pitch-up kick that plays out as climb, stall, dive)
        loopChance: 0.035,      // share of swoops that carry enough energy for a full loop

        // Where planes live, in camera terms
        spawnDistMin: 13,      // distance from camera; keeps big planes from filling the hero
        spawnDistMax: 68,      // beyond this the fog eats them and the backdrop (z=-88) gets close
        spawnNdcY: [-0.7, 0.8],
        flybyChance: 0.18,
        downwindShare: 0.75,     // share of planes that come out of the distance and pass the camera
        separation: 2.4,
        warmup: 25,            // seconds of flight simulated before the first frame       // personal space between planes (world units, scaled by size)

        // Wind: a prevailing breeze with gust fronts sweeping across it
        windSpeed: 0.22,
        gustStrength: 0.35,
        gustWavelength: 40,
        gustSpeed: 5.0,
    };

    // ── Shape templates ──────────────────────────────────────────────

    const shapeTemplates = [
        { name: 'dart',   wingSpan: 0.85, wingChord: 0.7,  noseLen: 1.6, tailLen: 0.4,
          keelDepth: 0.18, midFoldFrac: 0.50, dihedral: 0.32, sweepBack: 0.15,
          elevatorAngle: 0.18, tipCurl: 0.10, noseFoldRatio: 0.30, paperThickness: 0.04 },
        { name: 'glider', wingSpan: 1.5,  wingChord: 0.65, noseLen: 1.0, tailLen: 0.55,
          keelDepth: 0.14, midFoldFrac: 0.60, dihedral: 0.25, sweepBack: 0.0,
          elevatorAngle: 0.22, tipCurl: 0.16, noseFoldRatio: 0.35, paperThickness: 0.03 },
        { name: 'delta',  wingSpan: 1.2,  wingChord: 1.1,  noseLen: 1.5, tailLen: 0.25,
          keelDepth: 0.20, midFoldFrac: 0.45, dihedral: 0.40, sweepBack: 0.45,
          elevatorAngle: 0.12, tipCurl: 0.08, noseFoldRatio: 0.28, paperThickness: 0.05 },
        { name: 'stubby', wingSpan: 1.0,  wingChord: 0.9,  noseLen: 0.8, tailLen: 0.6,
          keelDepth: 0.22, midFoldFrac: 0.55, dihedral: 0.38, sweepBack: 0.1,
          elevatorAngle: 0.20, tipCurl: 0.12, noseFoldRatio: 0.32, paperThickness: 0.05 },
        { name: 'racer',  wingSpan: 0.65, wingChord: 0.55, noseLen: 1.9, tailLen: 0.35,
          keelDepth: 0.16, midFoldFrac: 0.48, dihedral: 0.28, sweepBack: 0.3,
          elevatorAngle: 0.14, tipCurl: 0.06, noseFoldRatio: 0.25, paperThickness: 0.03 },
    ];

    // ── GLSL: shared noise ───────────────────────────────────────────

    const glslNoise = `
        float hash21(vec2 p) {
            p = fract(p * vec2(233.34, 851.73));
            p += dot(p, p + 23.45);
            return fract(p.x * p.y);
        }
        float vnoise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash21(i), b = hash21(i + vec2(1,0));
            float c = hash21(i + vec2(0,1)), d = hash21(i + vec2(1,1));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
            float v = 0.0, a = 0.5;
            mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
            for (int i = 0; i < 5; i++) {
                v += a * vnoise(p);
                p = rot * p * 2.0;
                a *= 0.5;
            }
            return v;
        }
        vec3 hsl2rgb(float h, float s, float l) {
            vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0, 4, 2), 6.0) - 3.0) - 1.0, 0.0, 1.0);
            return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }
    `;

    // ── GLSL: paper plane shader ─────────────────────────────────────

    const planeVert = `
        uniform float uFlutterTime;
        uniform float uFlutterAmp;
        uniform float uFlutterFreq;
        uniform float uFlutterPhase;
        uniform float uHalfSpan;

        attribute vec3 aFoldDir;

        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec3 vObjPos;
        varying vec3 vObjNormal;
        varying vec3 vFoldDir;
        varying float vFresnel;

        void main() {
            // ── Wing flutter (GPU) ──
            float halfSpan = max(uHalfSpan, 0.001);
            float spanFrac = clamp(abs(position.x) / halfSpan, 0.0, 1.0);
            float flap = sin(uFlutterTime * uFlutterFreq + uFlutterPhase) * uFlutterAmp;
            float yDisp = flap * spanFrac * spanFrac;
            vec3 displaced = position + vec3(0.0, yDisp, 0.0);

            // Rotate normal by the slope angle so flutter shifts lighting realistically
            float slope = sign(position.x) * flap * 2.0 * spanFrac / halfSpan;
            float c = cos(slope), s = sin(slope);
            vec3 nRot = vec3(
                normal.x * c + normal.y * s,
               -normal.x * s + normal.y * c,
                normal.z
            );

            vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
            vec3 wn = normalize((modelMatrix * vec4(nRot, 0.0)).xyz);
            vec3 wp = (modelMatrix * vec4(displaced, 1.0)).xyz;
            vec3 vd = normalize(cameraPosition - wp);

            vNormal = normalize(normalMatrix * nRot);
            vViewPos = -mv.xyz;
            // Object-space position + normal — used by the paper grain so the
            // triplanar texture stays glued to the plane instead of sliding as
            // the plane moves through the world.
            vObjPos = displaced;
            vObjNormal = normalize(nRot);
            // Transform foldDir into view space (same as vNormal) so the
            // anisotropic specular dot-products are in a consistent frame.
            vFoldDir = normalize((modelViewMatrix * vec4(aFoldDir, 0.0)).xyz);
            vFresnel = pow(1.0 - abs(dot(wn, vd)), 3.0);

            gl_Position = projectionMatrix * mv;
        }
    `;

    const planeFrag = `
        uniform vec3  uColor;
        uniform vec3  uRimColor;
        uniform float uHue;
        uniform float uTime;
        uniform float uIsDark;
        uniform float uIridescence;
        uniform float uTransmission;

        uniform vec3  uKeyDir;
        uniform vec3  uKeyColor;
        uniform float uKeyIntensity;
        uniform vec3  uFillDir;
        uniform vec3  uFillColor;
        uniform float uFillIntensity;
        uniform vec3  uRimDir;
        uniform vec3  uRimColor2;
        uniform float uRimIntensity;

        varying vec3  vNormal;
        varying vec3  vViewPos;
        varying vec3  vObjPos;
        varying vec3  vObjNormal;
        varying vec3  vFoldDir;
        varying float vFresnel;

        ${glslNoise}

        void main() {
            vec3 N = normalize(vNormal);
            vec3 V = normalize(vViewPos);

            // ── Multi-light rig (driven by JS scene lights) ──
            float keyD  = max(dot(N, uKeyDir),  0.0) * uKeyIntensity;
            float fillD = max(dot(N, uFillDir), 0.0) * uFillIntensity;
            float rimD  = max(dot(N, uRimDir),  0.0) * uRimIntensity;

            // ── Anisotropic fold specular (highlights run along creases) ──
            vec3 H = normalize(uKeyDir + V);
            vec3 T = normalize(vFoldDir - N * dot(vFoldDir, N));
            float HdotT = dot(H, T);
            float aniso = sqrt(max(0.0, 1.0 - HdotT * HdotT));
            float spec  = pow(max(dot(N, H), 0.0), 32.0) * mix(0.55, 1.0, aniso);

            // ── Iridescence (per-plane intensity dial) ──
            float iri = dot(N, V);
            float hShift = uHue + iri * 0.1 + vFresnel * 0.06;
            vec3 iriCol = hsl2rgb(hShift, 0.7, 0.62);
            vec3 base = mix(uColor, iriCol, (0.20 + vFresnel * 0.45) * uIridescence);

            // ── Hemisphere ambient: sky color from above, warmer ground from below ──
            vec3 skyAmb    = mix(vec3(0.30, 0.36, 0.48), vec3(0.10, 0.13, 0.22), uIsDark);
            vec3 groundAmb = mix(vec3(0.36, 0.30, 0.22), vec3(0.12, 0.08, 0.14), uIsDark);
            float upDot = N.y * 0.5 + 0.5;
            vec3 ambient = mix(groundAmb, skyAmb, upDot);

            // ── Lighting ──
            vec3 lit = base * (
                keyD  * uKeyColor +
                fillD * uFillColor +
                rimD  * uRimColor2 +
                ambient
            );

            lit += spec * vec3(1.0, 0.96, 0.88) * 0.55;

            // ── Subsurface scattering (back-lit paper warmly glows through) ──
            float backWrap = smoothstep(-0.3, 1.0, dot(-N, uKeyDir));
            float thinness = 1.0 - abs(dot(N, V));
            vec3 sss = uKeyColor * uKeyIntensity * backWrap * thinness * uTransmission;
            lit += sss * (uColor * 0.6 + vec3(0.4));

            // ── Rim glow ──
            vec3 rim = mix(uRimColor, vec3(1.0), 0.6);
            lit += rim * vFresnel * 0.55;

            // ── Paper grain (object-space triplanar — stays glued to the surface) ──
            vec3 ON = normalize(vObjNormal);
            vec3 absON = abs(ON);
            float wSum = absON.x + absON.y + absON.z + 1e-5;
            float gX = vnoise(vObjPos.yz * 6.0);
            float gY = vnoise(vObjPos.xz * 6.0);
            float gZ = vnoise(vObjPos.xy * 6.0);
            float grain = (gX * absON.x + gY * absON.y + gZ * absON.z) / wSum;
            float fineGrain = vnoise(vObjPos.xz * 24.0);
            lit += (grain - 0.5) * 0.06 + (fineGrain - 0.5) * 0.025;

            // ── Atmospheric depth ──
            float depth = length(vViewPos);
            float fogT = smoothstep(8.0, 65.0, depth);
            vec3 fogNear = mix(vec3(0.22, 0.46, 0.84), vec3(0.10, 0.14, 0.28), uIsDark);
            lit = mix(lit, fogNear, fogT * 0.72);

            // Desaturate in distance
            float lum = dot(lit, vec3(0.299, 0.587, 0.114));
            lit = mix(lit, vec3(lum), fogT * 0.35);

            gl_FragColor = vec4(lit, 1.0);
        }
    `;

    // ── GLSL: animated background ────────────────────────────────────

    const bgVert = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const bgFrag = `
        uniform float uTime;
        uniform float uIsDark;
        uniform vec2  uSunUv;
        uniform float uAspect;
        varying vec2 vUv;

        ${glslNoise}

        void main() {
            vec2 uv = vUv;

            // Aspect-corrected uv for noise sampling — keeps feature size consistent
            // across aspect ratios (ultra-wide screens were getting stretched patterns).
            vec2 nuv = vec2(uv.x * uAspect, uv.y);

            // ── Flowing distortion field ──
            float flow1 = fbm(nuv * 2.5 + uTime * 0.07);
            float flow2 = fbm(nuv * 3.5 - uTime * 0.09 + 50.0);
            vec2 distort = vec2(flow1 - 0.5, flow2 - 0.5) * 0.18;
            vec2 duv = uv + distort;
            vec2 dnuv = vec2(duv.x * uAspect, duv.y);

            float n = fbm(dnuv * 3.0 + uTime * 0.05);

            // ── Light palette: deep blue → royal blue → teal → warm gold ──
            vec3 c0L = vec3(0.06, 0.12, 0.32);
            vec3 c1L = vec3(0.18, 0.40, 0.72);
            vec3 c2L = vec3(0.22, 0.58, 0.62);
            vec3 c3L = vec3(0.72, 0.42, 0.22);

            // ── Dark palette: deep navy → indigo → dark teal → deep magenta ──
            vec3 c0D = vec3(0.02, 0.04, 0.10);
            vec3 c1D = vec3(0.06, 0.04, 0.18);
            vec3 c2D = vec3(0.04, 0.12, 0.18);
            vec3 c3D = vec3(0.18, 0.05, 0.22);

            vec3 c0 = mix(c0L, c0D, uIsDark);
            vec3 c1 = mix(c1L, c1D, uIsDark);
            vec3 c2 = mix(c2L, c2D, uIsDark);
            vec3 c3 = mix(c3L, c3D, uIsDark);

            float t = duv.y * 0.55 + n * 0.45;
            vec3 col;
            if (t < 0.33) col = mix(c0, c1, t / 0.33);
            else if (t < 0.66) col = mix(c1, c2, (t - 0.33) / 0.33);
            else col = mix(c2, c3, (t - 0.66) / 0.34);

            // ── Sun / key light source (matches scene's warm key light direction) ──
            // Aspect-correct so the sun stays circular on ultra-wide screens.
            vec2 toSun = (uv - uSunUv) * vec2(uAspect, 1.0);
            float sunDist = length(toSun);
            vec3 sunCol  = mix(vec3(1.00, 0.78, 0.42), vec3(0.85, 0.55, 0.95), uIsDark);
            float sunCore = exp(-sunDist * 22.0);
            float sunHalo = exp(-sunDist * 2.6);
            col += sunCol * (sunCore * 1.4 + sunHalo * 0.20);

            // Radial light shafts (god rays from the sun)
            float shaftAngle = atan(toSun.y, toSun.x);
            float shafts  = 0.5 + 0.5 * sin(shaftAngle * 7.0  + flow1 * 1.4 + uTime * 0.18);
            shafts       *= 0.5 + 0.5 * sin(shaftAngle * 13.0 - uTime * 0.09);
            shafts       *= exp(-sunDist * 1.1);
            col += sunCol * shafts * 0.09;

            // ── Layered aurora / nebula swirls (aspect-corrected sampling) ──
            float aurora1 = fbm(vec2(nuv.x * 4.0 + uTime * 0.04, uv.y * 1.5 + flow1 * 2.0));
            float aurora2 = fbm(vec2(nuv.x * 2.0 - uTime * 0.06, uv.y * 3.0 + flow2 * 1.5));
            vec3 aurCol1 = mix(vec3(0.16, 0.58, 0.88), vec3(0.55, 0.22, 0.85), aurora1);
            vec3 aurCol2 = mix(vec3(0.25, 0.65, 0.55), vec3(0.18, 0.45, 0.70), aurora2);
            col += aurCol1 * smoothstep(0.45, 0.78, aurora1) * 0.14;
            col += aurCol2 * smoothstep(0.50, 0.80, aurora2) * 0.10;

            // ── Starfield (visible mainly in dark theme) ──
            // Each star gets its own independent phase + frequency so the field
            // shimmers rather than pulsing in sync.
            vec2 starCell = floor(vec2(uv.x * 220.0 * uAspect, uv.y * 130.0));
            float starHash  = hash21(starCell);
            float star      = smoothstep(0.992, 1.0, starHash);
            float phaseHash = hash21(starCell + vec2(17.3, 41.7));
            float freqHash  = hash21(starCell + vec2(73.1, 5.9));
            float starFreq  = 1.4 + freqHash * 2.6;
            float twinkle   = 0.55 + 0.45 * sin(uTime * starFreq + phaseHash * 6.28318);
            col += vec3(0.92, 0.96, 1.0) * star * twinkle * uIsDark * 0.6;

            // ── Atmospheric haze near horizon (lower frame, subtle) ──
            float hazeT = smoothstep(0.30, 0.0, uv.y);
            vec3 hazeCol = mix(vec3(0.50, 0.58, 0.66), vec3(0.18, 0.20, 0.30), uIsDark);
            col = mix(col, hazeCol, hazeT * 0.12);

            // No background vignette — the post-processing pass already vignettes,
            // and stacking two produced a heavy dark border at the screen edges.

            gl_FragColor = vec4(col, 1.0);
        }
    `;

    // ── GLSL: cinematic post-processing ──────────────────────────────

    const gradeShader = {
        uniforms: {
            tDiffuse: { value: null },
            uTime: { value: 0 },
        },
        vertexShader: `
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float uTime;
            varying vec2 vUv;

            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

            void main() {
                vec2 uv = vUv;
                float dist = length(uv - 0.5);

                // Chromatic aberration (subtle, edge-only)
                float ca = dist * dist * 0.003;
                vec4 col;
                col.r = texture2D(tDiffuse, uv + vec2(ca, 0.0)).r;
                col.g = texture2D(tDiffuse, uv).g;
                col.b = texture2D(tDiffuse, uv - vec2(ca, 0.0)).b;
                col.a = 1.0;

                // Vignette (very subtle — was 0.4 which read as a hard dark border)
                col.rgb *= 1.0 - dist * dist * 0.10;

                // Film grain
                float grain = hash(uv * 800.0 + fract(uTime * 7.13)) * 0.045 - 0.0225;
                col.rgb += grain;

                // Lift shadows, compress highlights (gentle S-curve)
                col.rgb = col.rgb * 0.97 + 0.015;
                col.rgb = smoothstep(-0.02, 1.02, col.rgb);

                // Slight warm shift in shadows, cool in highlights
                float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
                col.rgb += mix(vec3(0.015, 0.005, -0.01), vec3(-0.01, 0.0, 0.015), lum);

                gl_FragColor = col;
            }
        `
    };

    // ── Renderer ─────────────────────────────────────────────────────

    function createRenderer() {
        const r = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        r.outputColorSpace = T.SRGBColorSpace;
        r.setClearColor(0x0e1a30);
        r.toneMapping = T.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.1;
        // Force the canvas to fill the container — without this, setSize(w, h, false)
        // leaves the canvas at its intrinsic buffer pixel size (which is w * pixelRatio),
        // overflowing the container and exposing the parent gradient as a dark border.
        const cs = r.domElement.style;
        cs.position = 'absolute';
        cs.top = '0';
        cs.left = '0';
        cs.width = '100%';
        cs.height = '100%';
        cs.display = 'block';
        // Fade in over the CSS gradient once the first frame is drawn
        cs.opacity = '0';
        cs.transition = 'opacity 1.2s ease';
        requestAnimationFrame(() => requestAnimationFrame(() => { cs.opacity = '1'; }));
        // The container has `pointer-events: none` so foreground links keep working;
        // the canvas opts back in so it can capture click-to-fire-gust interactions.
        cs.pointerEvents = 'auto';
        cs.cursor = 'pointer';
        container.appendChild(r.domElement);
        return r;
    }

    // ── Post-processing ──────────────────────────────────────────────

    function setupPostProcessing() {
        if (!T.EffectComposer || !T.RenderPass || !T.UnrealBloomPass || !T.ShaderPass) {
            return null;
        }

        const comp = new T.EffectComposer(renderer);
        comp.addPass(new T.RenderPass(scene, camera));

        const bloom = new T.UnrealBloomPass(
            new T.Vector2(window.innerWidth, window.innerHeight),
            0.35,  // strength
            0.6,   // radius
            0.82   // threshold
        );
        comp.addPass(bloom);

        const grade = new T.ShaderPass(gradeShader);
        comp.addPass(grade);

        return comp;
    }

    // ── Theme helpers ────────────────────────────────────────────────

    function isDark() { return document.body.classList.contains('dark-theme'); }

    function getPlaneBaseHSL(i) {
        const golden = 0.61803398875;
        return { h: (i * golden) % 1, s: 0.62, l: 0.62 };
    }

    function themedLightness(l) {
        return isDark() ? Math.min(0.78, l + 0.10) : Math.max(0.50, l - 0.02);
    }

    // ── Wind ─────────────────────────────────────────────────────────

    const wind = {
        dir: new T.Vector3(Math.random() < 0.5 ? 1 : -1, 0, -0.25).normalize(),
    };

    // 0..1 gust intensity: narrow bands travelling downwind, so neighbours get hit together
    function gustAt(pos, time) {
        const phase = (pos.x * wind.dir.x + pos.z * wind.dir.z) / params.gustWavelength
            - time * params.gustSpeed / params.gustWavelength;
        const w = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
        return w * w * w * w;
    }

    function sampleWind(pos, time, out) {
        const drift = 0.8 + 0.2 * Math.sin(time * 0.05);
        return out.copy(wind.dir).multiplyScalar(params.windSpeed * drift + params.gustStrength * gustAt(pos, time));
    }

    // ── Geometry builder ─────────────────────────────────────────────

    function norm3(x, y, z) {
        const len = Math.hypot(x, y, z) || 1;
        return [x / len, y / len, z / len];
    }

    function computeShapeVertices(sh, d, asym) {
        asym = (typeof asym === 'number') ? asym : 1.0;
        const ws = sh.wingSpan, wc = sh.wingChord, nl = sh.noseLen, tl = sh.tailLen;
        const kd = sh.keelDepth, mf = sh.midFoldFrac, sw = sh.sweepBack;
        const ea = sh.elevatorAngle || 0;
        const tc = sh.tipCurl || 0;

        // Asymmetry: right wing has slightly different dihedral than left (subtle realism)
        const dL = d, dR = d * asym;
        const cL = Math.cos(dL), sL = Math.sin(dL);
        const cR = Math.cos(dR), sR = Math.sin(dR);

        const tipFrac = 0.80;
        const tZouter = -wc * 0.15 - sw * ws;
        const tZinner = tZouter + wc * 0.05;
        const mZf = -wc * 0.3, mZt = -wc * 0.8;
        const kZ  = -wc * 0.1;

        const tipLift = Math.sin(tc) * ws * (1 - tipFrac);
        const elLift  = Math.sin(ea) * Math.abs(mZt - (-tl)) * 0.4;

        // Centerline
        const N  = [0, 0, nl];
        const K  = [0, -kd, kZ];
        const TT = [0, -kd * 0.3, -tl];

        // Left wing (uses dL)
        const MLf = [-cL * ws * mf, sL * ws * mf, mZf];
        const MLb = [-cL * ws * mf, sL * ws * mf, mZt];
        const TLi = [-cL * ws * tipFrac, sL * ws * tipFrac, tZinner];
        const TLo = [-cL * ws, sL * ws + tipLift, tZouter];

        // Right wing (uses dR for asymmetry)
        const MRf = [cR * ws * mf, sR * ws * mf, mZf];
        const MRb = [cR * ws * mf, sR * ws * mf, mZt];
        const TRi = [cR * ws * tipFrac, sR * ws * tipFrac, tZinner];
        const TRo = [cR * ws, sR * ws + tipLift, tZouter];

        // Elevators (between mid-back and tail, lifted by ea)
        const elZ = (mZt + (-tl)) * 0.5;
        const elBaseY_L = sL * ws * mf * 0.5 + (-kd * 0.3) * 0.5;
        const elBaseY_R = sR * ws * mf * 0.5 + (-kd * 0.3) * 0.5;
        const ELup = [-cL * ws * mf * 0.4, elBaseY_L + elLift, elZ];
        const ERup = [ cR * ws * mf * 0.4, elBaseY_R + elLift, elZ];

        // Crease tangent vectors (for aFoldDir attribute → anisotropic specular)
        const spineDir   = [0, 0, 1];
        const bodyFoldL  = [0, 0, 1];
        const bodyFoldR  = [0, 0, 1];
        const leadL      = norm3(TLi[0] - N[0], TLi[1] - N[1], TLi[2] - N[2]);
        const leadR      = norm3(TRi[0] - N[0], TRi[1] - N[1], TRi[2] - N[2]);
        const tipCurlL   = norm3(TLo[0] - TLi[0], TLo[1] - TLi[1], TLo[2] - TLi[2]);
        const tipCurlR   = norm3(TRo[0] - TRi[0], TRo[1] - TRi[1], TRo[2] - TRi[2]);
        const elevHingeL = [-1, 0, 0];
        const elevHingeR = [ 1, 0, 0];

        const verts    = [];
        const foldsDir = [];

        function tri(a, fa, b, fb, c, fc) {
            verts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
            foldsDir.push(fa[0], fa[1], fa[2], fb[0], fb[1], fb[2], fc[0], fc[1], fc[2]);
        }

        // ── Left body keel face (3 tris) ──
        tri(N, leadL,    MLf, bodyFoldL, K,   spineDir);
        tri(K, spineDir, MLf, bodyFoldL, MLb, bodyFoldL);
        tri(K, spineDir, MLb, bodyFoldL, TT,  spineDir);

        // ── Left wing top (3 tris) ──
        tri(N,   leadL,     MLf, bodyFoldL, TLi, leadL);
        tri(MLf, bodyFoldL, MLb, bodyFoldL, TLi, leadL);
        tri(MLb, bodyFoldL, TLo, tipCurlL,  TLi, tipCurlL);

        // ── Left elevator (2 tris, replaces flat trailing region) ──
        tri(MLf, bodyFoldL, MLb,  bodyFoldL,  ELup, elevHingeL);
        tri(MLf, bodyFoldL, ELup, elevHingeL, TT,   spineDir);

        // ── Right body keel face (mirror winding) ──
        tri(N, leadR,    K,   spineDir,  MRf, bodyFoldR);
        tri(K, spineDir, MRb, bodyFoldR, MRf, bodyFoldR);
        tri(K, spineDir, TT,  spineDir,  MRb, bodyFoldR);

        // ── Right wing top (mirror winding) ──
        tri(N,   leadR,     TRi, leadR,     MRf, bodyFoldR);
        tri(MRf, bodyFoldR, TRi, leadR,     MRb, bodyFoldR);
        tri(MRb, bodyFoldR, TRi, tipCurlR,  TRo, tipCurlR);

        // ── Right elevator (mirror winding) ──
        tri(MRf, bodyFoldR, ERup, elevHingeR, MRb, bodyFoldR);
        tri(MRf, bodyFoldR, TT,   spineDir,   ERup, elevHingeR);

        // ── Visible fold lines (creases drawn as line segments) ──
        const folds = [];
        function line(a, b) { folds.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
        line(MLf, MLb);
        line(MRf, MRb);
        line(N,   TLi);
        line(N,   TRi);
        line(TLi, TLo);
        line(TRi, TRo);
        line(MLb, ELup);
        line(MRb, ERup);
        line(N,   K);
        line(K,   TT);

        return {
            verts:    new Float32Array(verts),
            foldsDir: new Float32Array(foldsDir),
            folds:    new Float32Array(folds),
        };
    }

    function buildGeometry(shape, d, asym) {
        const { verts, foldsDir, folds } = computeShapeVertices(shape, d, asym);
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.BufferAttribute(verts, 3));
        geo.setAttribute('aFoldDir', new T.BufferAttribute(foldsDir, 3));
        geo.computeVertexNormals();
        const fGeo = new T.BufferGeometry();
        fGeo.setAttribute('position', new T.BufferAttribute(folds, 3));
        return { geo, fGeo };
    }

    // ── Plane shader material ────────────────────────────────────────

    function createPlaneMat(index, shape) {
        const hsl = getPlaneBaseHSL(index);
        const adjL = themedLightness(hsl.l);
        const col = new T.Color().setHSL(hsl.h, hsl.s, adjL);
        const rimCol = new T.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.8), Math.max(0.22, adjL * 0.55));

        // Per-plane iridescence dial — most subtle, a few strikingly rainbow
        const iridescence = Math.random() * 0.7 + 0.15;

        // Transmission: thinner paper transmits more backlight
        const pt = (shape && shape.paperThickness) ? shape.paperThickness : 0.04;
        const transmission = Math.max(0.3, Math.min(0.9, 1.0 - pt * 8.0));

        const mat = new T.ShaderMaterial({
            vertexShader: planeVert,
            fragmentShader: planeFrag,
            side: T.DoubleSide,
            uniforms: {
                uColor:    { value: col },
                uRimColor: { value: rimCol },
                uHue:      { value: hsl.h },
                uTime:     { value: 0 },
                uIsDark:   { value: isDark() ? 1.0 : 0.0 },
                uIridescence:  { value: iridescence },
                uTransmission: { value: transmission },

                uKeyDir:       { value: new T.Vector3(0, 1, 0) },
                uKeyColor:     { value: new T.Color(1, 1, 1) },
                uKeyIntensity: { value: 0 },
                uFillDir:      { value: new T.Vector3(0, 1, 0) },
                uFillColor:    { value: new T.Color(1, 1, 1) },
                uFillIntensity:{ value: 0 },
                uRimDir:       { value: new T.Vector3(0, -1, 0) },
                uRimColor2:    { value: new T.Color(1, 1, 1) },
                uRimIntensity: { value: 0 },

                uFlutterTime:  { value: 0 },
                uFlutterAmp:   { value: 0 },
                uFlutterFreq:  { value: 0 },
                uFlutterPhase: { value: 0 },
                uHalfSpan:     { value: 1 },
            },
        });

        const accentCol = new T.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.7), Math.max(0.22, adjL * 0.55));
        const lineMat = new T.LineBasicMaterial({ color: accentCol, transparent: true, opacity: 0.5 });

        return { mat, lineMat, hsl };
    }

    // ── Background ───────────────────────────────────────────────────

    const BG_BASE_SIZE = 250;
    const BG_DEPTH = -88;

    function createBackground() {
        bgMaterial = new T.ShaderMaterial({
            vertexShader: bgVert,
            fragmentShader: bgFrag,
            uniforms: {
                uTime:   { value: 0 },
                uIsDark: { value: isDark() ? 1.0 : 0.0 },
                uSunUv:  { value: new T.Vector2(0.30, 0.82) },
                uAspect: { value: 1.0 },
            },
            depthWrite: false,
            side: T.DoubleSide,
        });
        const plane = new T.PlaneGeometry(BG_BASE_SIZE, BG_BASE_SIZE);
        bgMesh = new T.Mesh(plane, bgMaterial);
        bgMesh.position.set(0, 0, BG_DEPTH);
        bgMesh.renderOrder = -1;
        scene.add(bgMesh);
    }

    function resizeBackground() {
        if (!bgMesh || !camera) return;

        // Re-center the bg on the camera's actual view ray at the bg's depth.
        // The camera looks slightly downward (`lookAt(0, 0.5, -5)` from (0, 2.2, 8.5)),
        // so a bg fixed at (0, 0, -88) sits above the camera frustum's center at that
        // depth, leaving a gap at the bottom of the screen.
        const lookDir = new T.Vector3();
        camera.getWorldDirection(lookDir);
        if (Math.abs(lookDir.z) < 1e-5) lookDir.z = -1; // safety: camera shouldn't look perfectly horizontal
        const camPos = camera.position;
        const tHit = (BG_DEPTH - camPos.z) / lookDir.z;
        const centerX = camPos.x + tHit * lookDir.x;
        const centerY = camPos.y + tHit * lookDir.y;
        bgMesh.position.set(centerX, centerY, BG_DEPTH);

        // Now size the plane to fully cover the frustum at that hit-point's distance.
        const dist = Math.hypot(camPos.x - centerX, camPos.y - centerY, camPos.z - BG_DEPTH);
        const fovRad = camera.fov * Math.PI / 180;
        const vert = 2 * dist * Math.tan(fovRad * 0.5);
        const horiz = vert * camera.aspect;
        // 18% margin so edges never appear in-frame even with future tweaks
        const sx = (horiz * 1.18) / BG_BASE_SIZE;
        const sy = (vert  * 1.18) / BG_BASE_SIZE;
        bgMesh.scale.set(sx, sy, 1);
        bgMaterial.uniforms.uAspect.value = camera.aspect;
    }

    function updateSunUv() {
        if (!bgMaterial || !sceneLights || !sceneLights.key) return;
        const dir = sceneLights.key.position.clone().normalize();
        const u = Math.max(0.10, Math.min(0.90, 0.5 + dir.x * 0.45));
        const v = Math.max(0.10, Math.min(0.90, 0.5 + dir.y * 0.45));
        bgMaterial.uniforms.uSunUv.value.set(u, v);
    }

    // ── Plane factory ────────────────────────────────────────────────

    function createPlane(index) {
        const shape = shapeTemplates[index % shapeTemplates.length];
        const asymmetry = 1.0 + (Math.random() - 0.5) * 0.06;
        const { geo, fGeo } = buildGeometry(shape, shape.dihedral, asymmetry);
        const { mat, lineMat, hsl } = createPlaneMat(index, shape);

        const mesh = new T.Mesh(geo, mat);
        mesh.add(new T.LineSegments(fGeo, lineMat));

        mesh.userData = { hsl, baseDihedral: shape.dihedral, shape, asymmetry };

        const scale = T.MathUtils.lerp(params.scaleMin, params.scaleMax, Math.random());
        mesh.scale.setScalar(scale);

        // Per-plane flutter, set once on the GPU
        mat.uniforms.uFlutterPhase.value = Math.random() * Math.PI * 2;
        mat.uniforms.uFlutterFreq.value  = params.wingFlutterFreq * T.MathUtils.randFloat(0.7, 1.3);
        mat.uniforms.uFlutterAmp.value   = params.wingFlutterAmp;
        mat.uniforms.uHalfSpan.value     = shape.wingSpan;

        const p = { mesh, scale, bobFreq: T.MathUtils.randFloat(0.4, 1.2), bobAmp: T.MathUtils.randFloat(0.03, 0.07) };
        mesh.rotation.order = 'YXZ';
        launch(p, true);
        return p;
    }

    // ── Lights ───────────────────────────────────────────────────────

    function setupLights() {
        scene.add(new T.HemisphereLight(0xffccaa, 0x2a1840, 0.5));

        // Magic-hour rig: warm gold key, violet-cool rim back-light, soft warm top-fill.
        const key = new T.DirectionalLight(0xffd9a8, 0.78);
        key.position.set(-0.5, 0.8, 0.6);
        scene.add(key);

        const rim = new T.DirectionalLight(0xb0a8ff, 0.36);
        rim.position.set(0.6, -0.3, -0.5);
        scene.add(rim);

        const fill = new T.DirectionalLight(0xffe0bc, 0.16);
        fill.position.set(0, 1, 0);
        scene.add(fill);

        sceneLights = { key, rim, fill };
    }

    function applySceneLightsToMaterial(mat) {
        if (!sceneLights || !mat || !mat.uniforms || !mat.uniforms.uKeyDir) return;
        const u = mat.uniforms;
        u.uKeyDir.value.copy(sceneLights.key.position).normalize();
        u.uKeyColor.value.copy(sceneLights.key.color);
        u.uKeyIntensity.value = sceneLights.key.intensity;
        u.uFillDir.value.copy(sceneLights.fill.position).normalize();
        u.uFillColor.value.copy(sceneLights.fill.color);
        u.uFillIntensity.value = sceneLights.fill.intensity;
        u.uRimDir.value.copy(sceneLights.rim.position).normalize();
        u.uRimColor2.value.copy(sceneLights.rim.color);
        u.uRimIntensity.value = sceneLights.rim.intensity;
    }

    // ── Drawn air currents ───────────────────────────────────────────
    //
    // The user clicks (and optionally drags) on the banner to draw a flowing
    // air current. Planes within the current's influence radius are pulled
    // toward the curve and swept along it. Currents fade in, persist briefly,
    // then dissolve. A click without drag gets a pleasant default arc so a
    // tap also produces a satisfying flow.

    const CURRENT = {
        lifetime:    2.4,   // total seconds (includes fade in/out)
        fadeIn:      0.35,
        fadeOut:     0.55,
        ndcRadius:   0.18,  // screen-space influence radius, ~9% of half-screen
        attractStr:  2.5,   // PD-style pull gain (1/sec)
        flowStr:     4.5,   // along-current sweep speed (world units / sec)
        tubeRadius:  0.34,  // visual tube radius in world units (at z=-22)
        depth:     -22,
    };

    const currentVert = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
    const currentFrag = `
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;

        // Hash for subtle noise modulation along the tube
        float hash(float p) { return fract(sin(p) * 43758.5453); }

        void main() {
            // Circumferential softness — bright at tube center, transparent at the silhouette.
            float circ = 1.0 - 2.0 * abs(vUv.y - 0.5);
            float core = pow(max(0.0, circ), 2.4);

            // End taper so the tube fades cleanly at both ends
            float ends = sin(vUv.x * 3.14159265);

            // Animated bright pulses traveling along the current — readable flow direction
            float t = vUv.x * 5.0 - uTime * 1.6;
            float pulse = 0.5 + 0.5 * sin(t * 6.2832);
            pulse = pow(pulse, 4.0);

            // Subtle breaking up of the uniform pulse so it feels organic
            float jitter = 0.85 + 0.15 * sin(vUv.x * 38.0 + uTime * 0.8);

            // Color: warm cream core fading to soft cool-blue periphery — matches the sky
            vec3 coreCol = vec3(1.00, 0.90, 0.66);
            vec3 edgeCol = vec3(0.62, 0.78, 1.00);
            vec3 col = mix(edgeCol, coreCol, core);
            col += vec3(1.00, 0.96, 0.88) * pulse * core * 0.55;

            float alpha = core * ends * jitter * uOpacity * 0.65;
            gl_FragColor = vec4(col, alpha);
        }
    `;

    function setupGustInteraction() {
        if (!renderer || !renderer.domElement) return;
        raycaster = new T.Raycaster();
        ndcVec    = new T.Vector2();
        const el = renderer.domElement;
        el.addEventListener('pointerdown',  onPointerDown);
        el.addEventListener('pointermove',  onPointerMove);
        el.addEventListener('pointerup',    onPointerUp);
        el.addEventListener('pointercancel',onPointerUp);
        el.addEventListener('pointerleave', onPointerUp);
    }

    function eventToNdc(e) {
        const rect = renderer.domElement.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
        };
    }

    function ndcToScenePoint(ndcX, ndcY) {
        ndcVec.set(ndcX, ndcY);
        raycaster.setFromCamera(ndcVec, camera);
        const dz = raycaster.ray.direction.z;
        if (Math.abs(dz) < 1e-5) return null;
        const t = (CURRENT.depth - raycaster.ray.origin.z) / dz;
        if (t <= 0) return null;
        return new T.Vector3()
            .copy(raycaster.ray.origin)
            .addScaledVector(raycaster.ray.direction, t);
    }

    function onPointerDown(e) {
        if (!camera || !renderer) return;
        try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {}
        // Safety: if a previous draw didn't clean up (rare), dispose its mesh first
        if (drawingCurrent) disposeCurrent(drawingCurrent);
        pointerActive = true;
        const ndc = eventToNdc(e);
        pointerStart = { x: e.clientX, y: e.clientY, time: performance.now(), ndc: { x: ndc.x, y: ndc.y } };
        drawingCurrent = createCurrent();
        addPointToCurrent(drawingCurrent, ndc.x, ndc.y);
    }

    function onPointerMove(e) {
        if (!pointerActive || !drawingCurrent) return;
        const ndc = eventToNdc(e);
        const last = drawingCurrent.ndc[drawingCurrent.ndc.length - 1];
        const ddx = ndc.x - last.x, ddy = ndc.y - last.y;
        // ~2% NDC threshold so we don't oversample tiny mouse jitter
        if (ddx * ddx + ddy * ddy > 0.0004) {
            addPointToCurrent(drawingCurrent, ndc.x, ndc.y);
            rebuildCurrentMesh(drawingCurrent);
        }
    }

    function onPointerUp(e) {
        if (!pointerActive) return;
        pointerActive = false;
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (_) {}
        if (!drawingCurrent) return;

        const dx = e.clientX - pointerStart.x;
        const dy = e.clientY - pointerStart.y;
        const movedPx = Math.sqrt(dx * dx + dy * dy);

        // If the user only tapped (or barely moved), generate a pleasant default S-curve so
        // tapping still produces a meaningful current rather than just a dot.
        if (movedPx < 8 || drawingCurrent.ndc.length < 3) {
            const seed = pointerStart.ndc;
            generateDefaultPath(drawingCurrent, seed);
            rebuildCurrentMesh(drawingCurrent);
        }

        if (drawingCurrent.points.length >= 2) {
            currents.push(drawingCurrent);
        } else {
            disposeCurrent(drawingCurrent);
        }
        drawingCurrent = null;
    }

    function createCurrent() {
        const mat = new T.ShaderMaterial({
            uniforms: {
                uTime:    { value: 0 },
                uOpacity: { value: 0 },
            },
            vertexShader: currentVert,
            fragmentShader: currentFrag,
            transparent: true,
            blending: T.AdditiveBlending,
            depthWrite: false,
            depthTest:  false,
            side: T.DoubleSide,
        });
        return {
            ndc:      [],     // 2D screen-space points (x,y in NDC) — used for force lookup
            points:   [],     // 3D scene points at CURRENT.depth — used for visualization
            age:      0,
            lifetime: CURRENT.lifetime,
            mesh:     null,
            material: mat,
        };
    }

    function addPointToCurrent(c, ndcX, ndcY) {
        c.ndc.push({ x: ndcX, y: ndcY });
        const p = ndcToScenePoint(ndcX, ndcY);
        if (p) c.points.push(p);
    }

    function generateDefaultPath(c, seed) {
        // Replace any partial path with a short, gracefully curving arc so tapping
        // produces an inviting flow.
        c.ndc.length = 0;
        c.points.length = 0;
        const segs = 14;
        const horizontal = Math.random() < 0.7;
        const baseAngle = horizontal
            ? (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.6
            : Math.random() * Math.PI * 2;
        const length = 0.55;       // NDC length
        const curlAmt = 0.18 * (Math.random() < 0.5 ? 1 : -1);
        const dirX = Math.cos(baseAngle), dirY = Math.sin(baseAngle);
        const perpX = -dirY, perpY = dirX;

        for (let i = 0; i <= segs; i++) {
            const ti = i / segs;
            const r  = (ti - 0.5) * length;
            const lat = Math.sin(ti * Math.PI) * curlAmt;
            const x = seed.x + dirX * r + perpX * lat;
            const y = seed.y + dirY * r + perpY * lat;
            addPointToCurrent(c, x, y);
        }
    }

    function rebuildCurrentMesh(c) {
        if (c.points.length < 2) return;
        const oldMesh = c.mesh;
        const curve = new T.CatmullRomCurve3(c.points, false, 'catmullrom', 0.5);
        const tubularSegs = Math.min(160, Math.max(20, c.points.length * 8));
        const tubeGeo = new T.TubeGeometry(curve, tubularSegs, CURRENT.tubeRadius, 14, false);
        const mesh = new T.Mesh(tubeGeo, c.material);
        mesh.renderOrder = 9;
        scene.add(mesh);
        c.mesh = mesh;
        if (oldMesh) {
            scene.remove(oldMesh);
            oldMesh.geometry.dispose();
        }
    }

    function disposeCurrent(c) {
        if (c.mesh) {
            scene.remove(c.mesh);
            if (c.mesh.geometry) c.mesh.geometry.dispose();
        }
        if (c.material) c.material.dispose();
    }

    function envelopeForCurrent(c) {
        // Returns a 0..1 strength based on age (fade in, hold, fade out)
        if (c.age < CURRENT.fadeIn) {
            return c.age / CURRENT.fadeIn;
        }
        const fadeStart = c.lifetime - CURRENT.fadeOut;
        if (c.age > fadeStart) {
            return Math.max(0, (c.lifetime - c.age) / CURRENT.fadeOut);
        }
        return 1;
    }

    // Reusable scratch vectors so we don't allocate per-plane per-frame
    const _camRight = { x: 1, y: 0, z: 0 };
    const _camUp    = { x: 0, y: 1, z: 0 };

    function applyCurrentsToPlane(p, dt) {
        if (currents.length === 0 && !drawingCurrent) return 0;
        const m = p.mesh;

        // Project plane to NDC once for screen-space distance lookup
        const projected = m.position.clone().project(camera);

        // Camera basis (refreshed each call — Three.js auto-updates matrixWorld each render
        // and we never move the camera mid-frame)
        const e = camera.matrixWorld.elements;
        _camRight.x = e[0]; _camRight.y = e[1]; _camRight.z = e[2];
        _camUp.x    = e[4]; _camUp.y    = e[5]; _camUp.z    = e[6];

        // Plane depth → world units per NDC unit (so we can convert NDC offset → world offset)
        const distToCam = m.position.distanceTo(camera.position);
        const halfHeight = distToCam * Math.tan(camera.fov * 0.5 * Math.PI / 180);
        const wPerNdcX = halfHeight * camera.aspect;
        const wPerNdcY = halfHeight;

        let pushX = 0, pushY = 0, pushZ = 0;
        let strongest = 0;
        // Track the dominant flow direction (tangent of the most-influential current segment)
        // so we can rotate the plane to face the flow.
        let bestIntensity = 0;
        let bestTangentX = 0, bestTangentY = 0, bestTangentZ = 0;

        function processCurrent(c, envelope) {
            if (!c || envelope <= 0 || c.ndc.length < 2 || c.points.length < 2) return;

            // Find closest segment in NDC space (screen-aware → consistent at any depth)
            let bestDist2 = Infinity;
            let bestT = 0;
            let bestIdx = 0;
            const segLimit = Math.min(c.ndc.length, c.points.length) - 1;
            for (let j = 0; j < segLimit; j++) {
                const p0 = c.ndc[j], p1 = c.ndc[j + 1];
                const sx = p1.x - p0.x, sy = p1.y - p0.y;
                const segLen2 = sx * sx + sy * sy;
                if (segLen2 < 1e-7) continue;
                let tt = ((projected.x - p0.x) * sx + (projected.y - p0.y) * sy) / segLen2;
                if (tt < 0) tt = 0; else if (tt > 1) tt = 1;
                const ddx = projected.x - (p0.x + sx * tt);
                const ddy = projected.y - (p0.y + sy * tt);
                const d2 = ddx * ddx + ddy * ddy;
                if (d2 < bestDist2) {
                    bestDist2 = d2;
                    bestT = tt;
                    bestIdx = j;
                }
            }

            const dist = Math.sqrt(bestDist2);
            if (dist >= CURRENT.ndcRadius) return;
            // Smooth radial falloff — zero at the edge, peak around the middle, returns to 0 at center
            // (a plane already on the current shouldn't be yanked further)
            const t = dist / CURRENT.ndcRadius;
            const distFactor = 1.0 - t;             // 1 at center, 0 at edge — used for the flow sweep
            const pullFactor = (1.0 - t) * t * 4.0; // bell curve, peaks at t=0.5 (offset / 2)

            // ── Pull: toward the curve in screen space, projected to 3D in the camera plane ──
            const ndcP0 = c.ndc[bestIdx], ndcP1 = c.ndc[bestIdx + 1];
            const closestNdcX = ndcP0.x + (ndcP1.x - ndcP0.x) * bestT;
            const closestNdcY = ndcP0.y + (ndcP1.y - ndcP0.y) * bestT;
            const pullX = (closestNdcX - projected.x) * wPerNdcX;
            const pullY = (closestNdcY - projected.y) * wPerNdcY;
            const pullGain = CURRENT.attractStr * envelope * pullFactor;
            pushX += (pullX * _camRight.x + pullY * _camUp.x) * pullGain;
            pushY += (pullX * _camRight.y + pullY * _camUp.y) * pullGain;
            pushZ += (pullX * _camRight.z + pullY * _camUp.z) * pullGain;

            // ── Flow: sweep along the curve's actual 3D tangent at that segment ──
            const sp0 = c.points[bestIdx], sp1 = c.points[bestIdx + 1];
            const segDx = sp1.x - sp0.x, segDy = sp1.y - sp0.y, segDz = sp1.z - sp0.z;
            const segLen3 = Math.sqrt(segDx * segDx + segDy * segDy + segDz * segDz);
            const intensity = envelope * distFactor;
            if (segLen3 > 1e-5) {
                const inv = 1 / segLen3;
                const flowMag = CURRENT.flowStr * intensity;
                const tX = segDx * inv, tY = segDy * inv, tZ = segDz * inv;
                pushX += tX * flowMag;
                pushY += tY * flowMag;
                pushZ += tZ * flowMag;

                if (intensity > bestIntensity) {
                    bestIntensity = intensity;
                    bestTangentX = tX;
                    bestTangentY = tY;
                    bestTangentZ = tZ;
                }
            }

            if (intensity > strongest) strongest = intensity;
        }

        for (let i = 0; i < currents.length; i++) {
            processCurrent(currents[i], envelopeForCurrent(currents[i]));
        }
        if (drawingCurrent) processCurrent(drawingCurrent, 1.0);

        m.position.x += pushX * dt;
        m.position.y += pushY * dt;
        m.position.z += pushZ * dt;

        // ── Turn the plane into the flow and let it pick up speed, so it swoops out of the current ──
        if (bestIntensity > 0.02) {
            const targetYaw = Math.atan2(bestTangentX, bestTangentZ);
            // Rates are capped so planes curve into the flow rather than whipping around
            const maxRate = 1.4;
            const yd = wrapAngle(targetYaw - p.psi);
            p.psi += T.MathUtils.clamp(yd * 4.0 * bestIntensity, -maxRate, maxRate) * dt;

            const horizMag = Math.sqrt(bestTangentX * bestTangentX + bestTangentZ * bestTangentZ);
            const targetGamma = Math.atan2(bestTangentY, Math.max(horizMag, 1e-4));
            p.gamma += T.MathUtils.clamp(wrapAngle(targetGamma - p.gamma) * 3.0 * bestIntensity, -maxRate, maxRate) * dt;

            p.phi += T.MathUtils.clamp((T.MathUtils.clamp(-yd * 0.9, -1, 1) - p.phi) * 4.0 * bestIntensity, -maxRate, maxRate) * dt;
            p.V += (p.trimSpeed * 1.8 - p.V) * bestIntensity * dt;
        }

        return strongest;
    }

    function updateCurrents(dt) {
        // Tick the in-progress drawing current's shader time so its flow animates while drawing
        if (drawingCurrent && drawingCurrent.material) {
            drawingCurrent.material.uniforms.uTime.value += dt;
            drawingCurrent.material.uniforms.uOpacity.value = 1.0;
        }

        // Tick & dispose finalized currents
        for (let i = currents.length - 1; i >= 0; i--) {
            const c = currents[i];
            c.age += dt;
            if (c.material) {
                c.material.uniforms.uTime.value += dt;
                c.material.uniforms.uOpacity.value = envelopeForCurrent(c);
            }
            if (c.age >= c.lifetime) {
                disposeCurrent(c);
                currents.splice(i, 1);
            }
        }
    }

    // ── Init ─────────────────────────────────────────────────────────

    function init() {
        scene = new T.Scene();
        clock = new T.Clock();

        camera = new T.PerspectiveCamera(55, 1, 0.1, 200);
        camera.position.set(0, 2.0, 8);
        camera.lookAt(0, 0.5, -5);

        renderer = createRenderer();
        onResize();

        createBackground();
        resizeBackground();

        for (let i = 0; i < params.planeCount; i++) {
            const p = createPlane(i);
            scene.add(p.mesh);
            planes.push(p);
        }

        setupLights();
        planes.forEach(p => applySceneLightsToMaterial(p.mesh.material));
        updateSunUv();

        composer = setupPostProcessing();
        setupGustInteraction();

        // Fly the flock for a while before the first frame, so the page opens mid-flight
        // (mixed banks, swoops in progress, planes entering) rather than everyone level and in sync.
        camera.updateMatrixWorld();
        const warmStep = 1 / 30;
        for (let wt = -params.warmup; wt < 0; wt += warmStep) updatePlanes(warmStep, wt);

        syncRunning();
    }

    // ── Update ───────────────────────────────────────────────────────

    // ── Flight ───────────────────────────────────────────────────────

    const _ray = new T.Vector3();
    const _vel = new T.Vector3();
    const _wind = new T.Vector3();
    const _ndc = new T.Vector3();

    function wrapAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

    // World point `dist` units from the camera along the ray through NDC (x, y)
    function pointAtNdc(x, y, dist, out) {
        camera.updateMatrixWorld();
        _ray.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
        return out.copy(camera.position).addScaledVector(_ray, dist);
    }

    // Pick a lane (entry point off one edge, exit point off the other) and put the plane on it.
    // On first load planes start somewhere along their lane so the sky is already populated.
    function launch(p, midway) {
        const m = p.mesh;
        // Most planes ride the breeze; a few beat against it
        const downwind = Math.random() < params.downwindShare;
        const side = (wind.dir.x > 0) === downwind ? -1 : 1;
        const [yLo, yHi] = params.spawnNdcY;
        const dMin = params.spawnDistMin, dMax = params.spawnDistMax;
        const start = new T.Vector3(), target = new T.Vector3();

        if (Math.random() < params.flybyChance) {
            // Enter far away off one edge and cut diagonally across, growing as it nears the camera
            pointAtNdc(side * 1.2, T.MathUtils.randFloat(0.0, yHi), dMax, start);
            pointAtNdc(-side * 1.6, T.MathUtils.randFloat(yLo, 0.4), dMin, target);
        } else {
            // Cross the frame, drifting a little nearer or farther on the way
            const d0 = T.MathUtils.lerp(dMin, dMax, Math.pow(Math.random(), 0.8));
            const d1 = T.MathUtils.clamp(d0 + T.MathUtils.randFloatSpread(30), dMin, dMax);
            pointAtNdc(side * 1.25, T.MathUtils.randFloat(yLo, yHi), d0, start);
            pointAtNdc(-side * 1.35, T.MathUtils.randFloat(yLo, yHi), d1, target);
        }

        if (midway) start.lerp(target, T.MathUtils.randFloat(0.1, 0.85));
        m.position.copy(start);
        p.target = target;

        p.trimSpeed = T.MathUtils.randFloat(params.trimSpeedMin, params.trimSpeedMax);
        p.V     = p.trimSpeed;
        p.psi   = Math.atan2(target.x - start.x, target.z - start.z);
        p.gamma = 0;
        p.phi   = 0;
        p.age   = 0;
        p.nextSwoop = T.MathUtils.randFloat(2, params.swoopEvery[1]);
        p.wanderF = [T.MathUtils.randFloat(0.05, 0.12), T.MathUtils.randFloat(0.15, 0.3)];
        p.wanderP = [Math.random() * 6.3, Math.random() * 6.3];
        p.gustPrev = 0;
        p.pitchKick = 0;
        p.speedKick = 0;
    }

    function stepPlane(p, dt, t, ss) {
        const m = p.mesh;
        const g = params.gravity;
        p.age += dt;

        // Steering: bank toward the lane's far end, plus a slow wander for lazy S-turns.
        // A coordinated turn needs psi' = -(g/V)*tan(phi), so invert that for the commanded bank.
        const toTarget = wrapAngle(Math.atan2(p.target.x - m.position.x, p.target.z - m.position.z) - p.psi);
        let bankCmd = -Math.atan(params.courseGain * toTarget * p.V / g);
        bankCmd += params.wanderBank * (Math.sin(t * p.wanderF[0] + p.wanderP[0]) * 0.7 + Math.sin(t * p.wanderF[1] + p.wanderP[1]) * 0.3);
        // Keep clear of the camera and of the backdrop
        if (m.position.z < -80) bankCmd += -Math.sign(wrapAngle(0 - p.psi)) * 0.4;
        bankCmd = T.MathUtils.clamp(bankCmd + (p.avoidBank || 0), -params.maxBank, params.maxBank);
        p.phi += (bankCmd - p.phi) * Math.min(1, params.bankRate * dt);
        p.psi += -(g / p.V) * Math.tan(p.phi) * dt;

        // Longitudinal: lift grows with V^2, so speed and pitch trade energy (the phugoid).
        // A small lift bias pulls each plane back toward the altitude of its lane.
        const altErr = T.MathUtils.clamp(p.target.y - m.position.y, -4, 4);
        const lift = (p.V / p.trimSpeed) ** 2 * (1 + params.altitudeGain * altErr);
        const bankLift = 1 - (1 - Math.cos(p.phi)) * 0.3;  // soft sink in turns, not a spiral
        p.gamma += (g / p.V) * (lift * bankLift - Math.cos(p.gamma)) * dt;
        p.V += (-g * Math.sin(p.gamma) - params.speedDamping * (p.V - p.trimSpeed)) * dt;
        p.V = Math.max(params.minSpeed, p.V);
        if (Math.abs(p.gamma) > Math.PI) p.gamma -= Math.sign(p.gamma) * Math.PI * 2;

        // Gust fronts give a little updraft as they arrive, so planes lift together
        const gust = gustAt(m.position, t);
        if (gust > p.gustPrev) p.gamma += (gust - p.gustPrev) * 0.15;
        p.gustPrev = gust;

        // Every so often: a swoop (nose up, bleed speed, stall, dive, recover), rarely a loop
        // Kicks are fed in over about a second so the nose eases up instead of snapping.
        if (p.age > p.nextSwoop) {
            p.nextSwoop = p.age + T.MathUtils.randFloat(params.swoopEvery[0], params.swoopEvery[1]);
            if (Math.random() < params.loopChance) { p.speedKick += p.trimSpeed * 1.1; p.pitchKick += 0.5; }
            else p.pitchKick += T.MathUtils.randFloat(0.25, 0.5);
        }
        const ease = Math.min(1, 2.5 * dt);
        p.gamma += p.pitchKick * ease; p.pitchKick -= p.pitchKick * ease;
        p.V     += p.speedKick * ease; p.speedKick -= p.speedKick * ease;

        // Move along the nose, then let the wind carry the plane
        const cg = Math.cos(p.gamma);
        _vel.set(Math.sin(p.psi) * cg, Math.sin(p.gamma), Math.cos(p.psi) * cg).multiplyScalar(p.V);
        _vel.add(sampleWind(m.position, t, _wind));
        m.position.addScaledVector(_vel, dt * ss);
    }

    function updatePlanes(dt, t) {
        const ss = window.innerWidth < 600 ? 0.75 : 1.0;

        // Personal space: bank away from anyone too close (cheap O(n^2) for 30 planes)
        for (let i = 0; i < planes.length; i++) planes[i].avoidBank = 0;
        for (let i = 0; i < planes.length; i++) {
            const a = planes[i];
            for (let j = i + 1; j < planes.length; j++) {
                const b = planes[j];
                const dx = b.mesh.position.x - a.mesh.position.x;
                const dy = b.mesh.position.y - a.mesh.position.y;
                const dz = b.mesh.position.z - a.mesh.position.z;
                const r = params.separation * (a.scale + b.scale) * 0.5;
                const d2 = dx * dx + dy * dy + dz * dz;
                if (d2 > r * r || d2 < 1e-6) continue;
                const push = (1 - Math.sqrt(d2) / r) * 0.5;
                // side > 0: the other plane is on our left, so bank right (positive phi) to open the gap
                const sideA = Math.cos(a.psi) * dx - Math.sin(a.psi) * dz;
                const sideB = -(Math.cos(b.psi) * dx - Math.sin(b.psi) * dz);
                a.avoidBank += Math.sign(sideA) * push;
                b.avoidBank += Math.sign(sideB) * push;
                a.gamma -= Math.sign(dy) * push * 0.2 * dt;
                b.gamma += Math.sign(dy) * push * 0.2 * dt;
            }
        }

        const sub = 2, h = dt / sub;
        for (let i = 0; i < planes.length; i++) {
            const p = planes[i];
            const m = p.mesh;

            for (let k = 0; k < sub; k++) stepPlane(p, h, t - dt + h * (k + 1), ss);

            // Drawn air currents (the easter egg): pull toward the curve and sweep along it
            applyCurrentsToPlane(p, dt);

            // Pose: flight path plus a touch of angle of attack when slow (nose high in a stall)
            const aoa = T.MathUtils.clamp(0.25 * (1 - (p.V / p.trimSpeed) ** 2), -0.08, 0.3);
            const wobble = Math.sin(t * p.bobFreq * 2.2 + i * 0.7) * p.bobAmp;
            m.rotation.set(-(p.gamma + aoa), p.psi, p.phi + wobble);

            // Update time uniforms (flutter is GPU-driven)
            m.material.uniforms.uTime.value = t;
            m.material.uniforms.uFlutterTime.value = t;

            // Recycle only once the plane is out of frame, so nobody pops in or out on screen
            _ndc.copy(m.position).project(camera);
            const offscreen = _ndc.z > 1 || Math.abs(_ndc.x) > 1.3 || Math.abs(_ndc.y) > 1.4;
            const dist = m.position.distanceTo(camera.position);
            if ((offscreen && p.age > 4) || dist < 2 || dist > 110 || p.age > 240) launch(p, false);
        }
    }

    // ── Render loop ──────────────────────────────────────────────────

    function render() {
        const dt = Math.min(clock.getDelta(), 0.033);
        const t = clock.elapsedTime;

        bgMaterial.uniforms.uTime.value = t;

        if (composer) {
            gradeShader.uniforms.uTime.value = t;
        }

        updateCurrents(dt);
        updatePlanes(dt, t);

        if (composer) {
            composer.render();
        } else {
            renderer.render(scene, camera);
        }
    }

    function loop() {
        render();
        animationId = container.isConnected ? requestAnimationFrame(loop) : null;
    }

    function start() { if (!animationId) { clock.start(); loop(); } }

    function stop() {
        if (animationId) cancelAnimationFrame(animationId);
        animationId = null;
    }

    // Only animate while the hero is on screen and the tab is visible
    let heroVisible = true;

    function syncRunning() {
        if (heroVisible && !document.hidden) start();
        else stop();
    }

    // ── Resize ───────────────────────────────────────────────────────

    function onResize() {
        const rect = container.getBoundingClientRect();
        const w = Math.max(1, rect.width || container.clientWidth || window.innerWidth);
        const h = Math.max(1, rect.height || (document.getElementById('intro')?.clientHeight || window.innerHeight * 0.45));

        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        if (composer) composer.setSize(w, h);

        const mob = w < 600;
        camera.position.set(0, mob ? 1.5 : 2.2, mob ? 7.5 : 8.5);
        camera.lookAt(0, mob ? 0.3 : 0.5, mob ? -3 : -5);

        resizeBackground();
    }

    // ── Theme ────────────────────────────────────────────────────────

    function onThemeChange() {
        const dk = isDark() ? 1.0 : 0.0;
        bgMaterial.uniforms.uIsDark.value = dk;

        planes.forEach(p => {
            const hsl = p.mesh.userData.hsl;
            const adjL = themedLightness(hsl.l);
            p.mesh.material.uniforms.uColor.value.setHSL(hsl.h, hsl.s, adjL);
            p.mesh.material.uniforms.uRimColor.value.setHSL(hsl.h, Math.min(1, hsl.s * 0.8), Math.max(0.22, adjL * 0.55));
            p.mesh.material.uniforms.uIsDark.value = dk;
            applySceneLightsToMaterial(p.mesh.material);

            const ln = p.mesh.children.find(c => c.isLineSegments);
            if (ln) ln.material.color.setHSL(hsl.h, Math.min(1, hsl.s * 0.7), Math.max(0.22, adjL * 0.55));
        });
        if (!animationId) render();
    }

    // ── Boot ─────────────────────────────────────────────────────────

    init();
    window.addEventListener('resize', () => { onResize(); if (!animationId) render(); }, { passive: true });
    document.addEventListener('visibilitychange', syncRunning);
    new IntersectionObserver(entries => {
        heroVisible = entries[0].isIntersecting;
        syncRunning();
    }).observe(container);
    new MutationObserver(onThemeChange).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
