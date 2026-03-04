(function () {
    const container = document.getElementById('intro-three-container');
    if (!container) return;

    const T = window.THREE;
    if (!T) { console.warn('THREE not loaded'); return; }

    let scene, camera, renderer, composer, clock;
    let planes = [];
    let bgMesh, bgMaterial;
    let animationId = null;

    // ── Configuration ────────────────────────────────────────────────

    const params = {
        planeCount: 22,
        spawnRadius: 35,
        areaDepth: 90,
        baseSpeed: 0.7,
        speedJitter: 0.5,
        turnJitter: 0.4,
        jitterIntervalMin: 0.6,
        jitterIntervalMax: 1.8,
        turbulenceAmp: 0.10,
        windBase: 0.45,
        windGust: 0.5,
        windSwirl: 0.3,
        windSwirlScale: 0.5,
        windSwirlSpeed: 0.15,
        windVertical: 0.08,
        windYawAlign: 1.2,
        scaleMin: 0.6,
        scaleMax: 1.6,
        wingFlutterAmp: 0.06,
        wingFlutterFreq: 2.5,
    };

    // ── Shape templates ──────────────────────────────────────────────

    const shapeTemplates = [
        { name: 'dart',   wingSpan: 0.85, wingChord: 0.7,  noseLen: 1.6, tailLen: 0.4,  keelDepth: 0.07, midFoldFrac: 0.50, dihedral: 0.32, sweepBack: 0.15 },
        { name: 'glider', wingSpan: 1.5,  wingChord: 0.65, noseLen: 1.0, tailLen: 0.55, keelDepth: 0.04, midFoldFrac: 0.60, dihedral: 0.25, sweepBack: 0.0  },
        { name: 'delta',  wingSpan: 1.2,  wingChord: 1.1,  noseLen: 1.5, tailLen: 0.25, keelDepth: 0.08, midFoldFrac: 0.45, dihedral: 0.40, sweepBack: 0.45 },
        { name: 'stubby', wingSpan: 1.0,  wingChord: 0.9,  noseLen: 0.8, tailLen: 0.6,  keelDepth: 0.10, midFoldFrac: 0.55, dihedral: 0.38, sweepBack: 0.1  },
        { name: 'racer',  wingSpan: 0.65, wingChord: 0.55, noseLen: 1.9, tailLen: 0.35, keelDepth: 0.05, midFoldFrac: 0.48, dihedral: 0.28, sweepBack: 0.3  },
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
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec3 vWorldPos;
        varying float vFresnel;

        void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vec3 wn = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
            vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
            vec3 vd = normalize(cameraPosition - wp);

            vNormal = normalize(normalMatrix * normal);
            vViewPos = -mv.xyz;
            vWorldPos = wp;
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

        varying vec3  vNormal;
        varying vec3  vViewPos;
        varying vec3  vWorldPos;
        varying float vFresnel;

        ${glslNoise}

        void main() {
            vec3 N = normalize(vNormal);
            vec3 V = normalize(vViewPos);

            // ── Two-light rig ──
            vec3 warmDir  = normalize(vec3(-0.5, 0.8, 0.6));
            vec3 coolDir  = normalize(vec3( 0.6,-0.3,-0.5));
            float warmD   = max(dot(N, warmDir), 0.0);
            float coolD   = max(dot(N, coolDir), 0.0);

            // Specular (Blinn-Phong)
            vec3 H = normalize(warmDir + V);
            float spec = pow(max(dot(N, H), 0.0), 48.0);

            // ── Iridescence ──
            float iri = dot(N, V);
            float hShift = uHue + iri * 0.1 + vFresnel * 0.06;
            vec3 iriCol = hsl2rgb(hShift, 0.7, 0.62);
            vec3 base = mix(uColor, iriCol, 0.25 + vFresnel * 0.45);

            // ── Lighting ──
            vec3 lit = base * (
                warmD * 0.55 * vec3(1.0, 0.92, 0.78) +
                coolD * 0.22 * vec3(0.75, 0.85, 1.0) +
                vec3(0.32)
            );

            lit += spec * vec3(1.0, 0.96, 0.88) * 0.5;

            // ── Rim glow ──
            vec3 rim = mix(uRimColor, vec3(1.0), 0.6);
            lit += rim * vFresnel * 0.55;

            // ── Paper grain ──
            float g1 = vnoise(gl_FragCoord.xy * 0.7) * 0.05;
            float g2 = vnoise(gl_FragCoord.xy * 2.8) * 0.025;
            lit += g1 + g2 - 0.038;

            // ── Fold shadow (under-wing darkening) ──
            lit *= mix(0.68, 1.0, smoothstep(-0.15, 0.35, N.y));

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
        varying vec2 vUv;

        ${glslNoise}

        void main() {
            vec2 uv = vUv;

            // Flowing distortion field
            float flow1 = fbm(uv * 2.5 + uTime * 0.06);
            float flow2 = fbm(uv * 3.5 - uTime * 0.08 + 50.0);
            vec2 distort = vec2(flow1 - 0.5, flow2 - 0.5) * 0.15;
            vec2 duv = uv + distort;

            float n = fbm(duv * 3.0 + uTime * 0.04);

            // ── Light palette: deep blue → royal blue → teal → warm ──
            vec3 c0L = vec3(0.08, 0.14, 0.36);
            vec3 c1L = vec3(0.17, 0.38, 0.70);
            vec3 c2L = vec3(0.12, 0.52, 0.60);
            vec3 c3L = vec3(0.55, 0.30, 0.18);

            // ── Dark palette: deep navy → indigo → dark teal → deep purple ──
            vec3 c0D = vec3(0.04, 0.06, 0.14);
            vec3 c1D = vec3(0.08, 0.06, 0.22);
            vec3 c2D = vec3(0.06, 0.16, 0.20);
            vec3 c3D = vec3(0.14, 0.06, 0.18);

            vec3 c0 = mix(c0L, c0D, uIsDark);
            vec3 c1 = mix(c1L, c1D, uIsDark);
            vec3 c2 = mix(c2L, c2D, uIsDark);
            vec3 c3 = mix(c3L, c3D, uIsDark);

            float t = duv.y * 0.55 + n * 0.45;
            vec3 col;
            if (t < 0.33) col = mix(c0, c1, t / 0.33);
            else if (t < 0.66) col = mix(c1, c2, (t - 0.33) / 0.33);
            else col = mix(c2, c3, (t - 0.66) / 0.34);

            // Subtle aurora/nebula swirl
            float aurora = fbm(vec2(uv.x * 4.0 + uTime * 0.03, uv.y * 1.5 + flow1 * 2.0));
            vec3 auroraCol = mix(vec3(0.15, 0.55, 0.85), vec3(0.50, 0.20, 0.65), aurora);
            col += auroraCol * smoothstep(0.45, 0.75, aurora) * 0.12;

            // Vignette
            float vig = length(uv - 0.5) * 1.4;
            col *= 1.0 - vig * vig * 0.35;

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

                // Vignette
                col.rgb *= 1.0 - dist * dist * 0.4;

                // Film grain
                float grain = hash(uv * 800.0 + fract(uTime * 7.13)) * 0.045 - 0.0225;
                col.rgb += grain;

                // Lift shadows, compress highlights (cinematic S-curve)
                col.rgb = col.rgb * 0.95 + 0.02;
                col.rgb = smoothstep(0.0, 1.02, col.rgb);

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

    function sampleWind(pos, time, i) {
        const a = time * 0.12 + i * 0.123;
        const base = new T.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(params.windBase);
        const gust = (Math.sin(time * 0.6 + i * 1.7) * Math.sin(time * 0.25 + i * 2.1) * 0.5 + 0.5) * params.windGust;
        base.multiplyScalar(1.0 + gust);
        const s = params.windSwirlScale, sp = params.windSwirlSpeed;
        base.add(new T.Vector3(
            Math.sin(pos.z * s + time * sp + i) * params.windSwirl,
            Math.sin(pos.x * 0.12 + time * 0.3 + i * 0.7) * params.windVertical,
            Math.cos(pos.x * s * 1.3 - time * sp * 1.2 + i * 0.5) * params.windSwirl
        ));
        return base;
    }

    // ── Geometry builder ─────────────────────────────────────────────

    function computeShapeVertices(sh, d) {
        const cosD = Math.cos(d), sinD = Math.sin(d);
        const ws = sh.wingSpan, wc = sh.wingChord, nl = sh.noseLen, tl = sh.tailLen;
        const kd = sh.keelDepth, mf = sh.midFoldFrac, sw = sh.sweepBack;

        const tXL = -cosD * ws, tXR = cosD * ws, tY = sinD * ws;
        const mXL = -cosD * ws * mf, mXR = cosD * ws * mf, mY = sinD * ws * mf;
        const tZ = -wc * 0.15 - sw * ws;
        const mZf = -wc * 0.3, mZt = -wc * 0.8;

        const verts = new Float32Array([
            0,0,nl, mXL,mY,mZf, 0,-kd,-wc*0.1,
            mXL,mY,mZf, tXL,tY,tZ, mXL*0.95,mY*0.95,mZt,
            0,-kd,-wc*0.1, mXL,mY,mZf, 0,-kd*0.5,-tl,
            mXL,mY,mZf, mXL*0.95,mY*0.95,mZt, 0,-kd*0.5,-tl,
            0,0,nl, 0,-kd,-wc*0.1, mXR,mY,mZf,
            mXR,mY,mZf, mXR*0.95,mY*0.95,mZt, tXR,tY,tZ,
            0,-kd,-wc*0.1, 0,-kd*0.5,-tl, mXR,mY,mZf,
            mXR,mY,mZf, 0,-kd*0.5,-tl, mXR*0.95,mY*0.95,mZt,
            0,0,nl, 0,-kd,-wc*0.1, 0,-kd*0.5,-tl,
            0,0,nl, 0,-kd*0.5,-tl, 0,-kd,-wc*0.1,
        ]);

        const folds = new Float32Array([
            0,0,nl, 0,-kd*0.5,-tl,
            mXL,mY,mZf, 0,-kd,-wc*0.1,
            mXR,mY,mZf, 0,-kd,-wc*0.1,
            0,0,nl, tXL,tY,tZ,
            0,0,nl, tXR,tY,tZ,
            tXL,tY,tZ, mXL*0.95,mY*0.95,mZt,
            tXR,tY,tZ, mXR*0.95,mY*0.95,mZt,
            mXL*0.95,mY*0.95,mZt, 0,-kd*0.5,-tl,
            mXR*0.95,mY*0.95,mZt, 0,-kd*0.5,-tl,
        ]);

        return { verts, folds };
    }

    function buildGeometry(shape, d) {
        const { verts, folds } = computeShapeVertices(shape, d);
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.BufferAttribute(verts, 3));
        geo.computeVertexNormals();
        const fGeo = new T.BufferGeometry();
        fGeo.setAttribute('position', new T.BufferAttribute(folds, 3));
        return { geo, fGeo };
    }

    // ── Plane shader material ────────────────────────────────────────

    function createPlaneMat(index) {
        const hsl = getPlaneBaseHSL(index);
        const adjL = themedLightness(hsl.l);
        const col = new T.Color().setHSL(hsl.h, hsl.s, adjL);
        const rimCol = new T.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.8), Math.max(0.22, adjL * 0.55));

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
            },
        });

        const accentCol = new T.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.7), Math.max(0.22, adjL * 0.55));
        const lineMat = new T.LineBasicMaterial({ color: accentCol, transparent: true, opacity: 0.5 });

        return { mat, lineMat, hsl };
    }

    // ── Background ───────────────────────────────────────────────────

    function createBackground() {
        bgMaterial = new T.ShaderMaterial({
            vertexShader: bgVert,
            fragmentShader: bgFrag,
            uniforms: {
                uTime:   { value: 0 },
                uIsDark: { value: isDark() ? 1.0 : 0.0 },
            },
            depthWrite: false,
            side: T.DoubleSide,
        });
        const plane = new T.PlaneGeometry(250, 250);
        bgMesh = new T.Mesh(plane, bgMaterial);
        bgMesh.position.set(0, 0, -88);
        bgMesh.renderOrder = -1;
        scene.add(bgMesh);
    }

    // ── Plane factory ────────────────────────────────────────────────

    function createPlane(index) {
        const shape = shapeTemplates[index % shapeTemplates.length];
        const { geo, fGeo } = buildGeometry(shape, shape.dihedral);
        const { mat, lineMat, hsl } = createPlaneMat(index);

        const mesh = new T.Mesh(geo, mat);
        mesh.add(new T.LineSegments(fGeo, lineMat));

        mesh.userData = { hsl, baseDihedral: shape.dihedral, shape };

        const scale = T.MathUtils.lerp(params.scaleMin, params.scaleMax, Math.random());
        mesh.scale.setScalar(scale);

        const ang = Math.random() * Math.PI * 2;
        const rad = params.spawnRadius * (0.3 + Math.random() * 0.7);
        mesh.position.set(Math.cos(ang) * rad, T.MathUtils.randFloatSpread(12), -Math.random() * params.areaDepth);
        mesh.rotation.y = T.MathUtils.randFloatSpread(Math.PI * 0.5);
        mesh.rotation.x = T.MathUtils.randFloatSpread(Math.PI * 0.12);

        return {
            mesh, scale,
            speed: params.baseSpeed + Math.random() * params.speedJitter,
            turn: (Math.random() - 0.5) * params.turnJitter,
            bobAmp: T.MathUtils.randFloat(0.04, 0.14) * scale,
            bobFreq: T.MathUtils.randFloat(0.4, 1.2),
            flutterPhase: Math.random() * Math.PI * 2,
            flutterFreq: params.wingFlutterFreq * T.MathUtils.randFloat(0.7, 1.3),
            jitter: { nextSwitch: 0, yawKick: 0, pitchKick: 0, rollKick: 0 },
        };
    }

    // ── Lights ───────────────────────────────────────────────────────

    function setupLights() {
        scene.add(new T.HemisphereLight(0xffccaa, 0x2a1840, 0.5));
        const key = new T.DirectionalLight(0xffb36b, 1.0);
        key.position.set(-5, 3, 4);
        scene.add(key);
        const rim = new T.DirectionalLight(0x7fa6ff, 0.35);
        rim.position.set(4, -1, -3);
        scene.add(rim);
        const fill = new T.DirectionalLight(0xffe8d0, 0.2);
        fill.position.set(0, 5, 0);
        scene.add(fill);
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

        for (let i = 0; i < params.planeCount; i++) {
            const p = createPlane(i);
            scene.add(p.mesh);
            planes.push(p);
        }

        setupLights();

        composer = setupPostProcessing();

        start();
    }

    // ── Update ───────────────────────────────────────────────────────

    function updatePlanes(dt, t) {
        const ss = window.innerWidth < 600 ? 0.75 : 1.0;

        for (let i = 0; i < planes.length; i++) {
            const p = planes[i];
            const m = p.mesh;

            // Forward + wind
            const fwd = new T.Vector3(0, 0, 1).applyEuler(m.rotation).normalize();
            const wind = sampleWind(m.position, t, i);
            m.position.addScaledVector(fwd, p.speed * ss * dt);
            m.position.addScaledVector(wind, dt);

            m.rotation.y += p.turn * 0.15 * dt;
            m.rotation.x += Math.sin(t * p.bobFreq + i) * 0.03 * dt;

            // Turbulence
            if (t > p.jitter.nextSwitch) {
                p.jitter.nextSwitch = t + T.MathUtils.randFloat(params.jitterIntervalMin, params.jitterIntervalMax);
                p.jitter.yawKick = T.MathUtils.randFloatSpread(params.turbulenceAmp);
                p.jitter.pitchKick = T.MathUtils.randFloatSpread(params.turbulenceAmp * 0.6);
                p.jitter.rollKick = T.MathUtils.randFloatSpread(params.turbulenceAmp * 0.8);
            }
            const fade = Math.min(1, Math.max(0, (p.jitter.nextSwitch - t) / params.jitterIntervalMax));
            m.rotation.y += p.jitter.yawKick * fade * dt * 1.5;
            m.rotation.x += p.jitter.pitchKick * fade * dt * 1.5;

            // Banking
            const tYaw = Math.atan2(wind.x, wind.z);
            const yd = Math.atan2(Math.sin(tYaw - m.rotation.y), Math.cos(tYaw - m.rotation.y));
            m.rotation.y += yd * params.windYawAlign * dt;
            m.rotation.z += (-yd * 0.6 - m.rotation.z) * 2.0 * dt;
            m.rotation.z += Math.sin(t * p.bobFreq * 1.1 + i * 0.7) * p.bobAmp * dt;
            m.rotation.z += p.jitter.rollKick * fade * 0.3 * dt;

            // Wing flutter
            const flutter = Math.sin(t * p.flutterFreq + p.flutterPhase) * params.wingFlutterAmp;
            updateDihedral(m, m.userData.baseDihedral + flutter);

            // Update time uniform
            m.material.uniforms.uTime.value = t;

            if (m.position.z > 10) respawn(p);
        }
    }

    function updateDihedral(mesh, d) {
        const sh = mesh.userData.shape;
        if (!sh) return;
        const { verts, folds } = computeShapeVertices(sh, d);
        const pos = mesh.geometry.attributes.position;
        pos.array.set(verts);
        pos.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
        const ln = mesh.children.find(c => c.isLineSegments);
        if (ln) { ln.geometry.attributes.position.array.set(folds); ln.geometry.attributes.position.needsUpdate = true; }
    }

    function respawn(p) {
        const m = p.mesh;
        const a = Math.random() * Math.PI * 2;
        const r = params.spawnRadius * (0.3 + Math.random() * 0.7);
        m.position.set(Math.cos(a) * r, T.MathUtils.randFloatSpread(12), -params.areaDepth * (0.5 + Math.random() * 0.5));
        m.rotation.set(0, T.MathUtils.randFloatSpread(Math.PI * 0.5), 0);
        m.rotation.x = T.MathUtils.randFloatSpread(Math.PI * 0.12);
    }

    // ── Render loop ──────────────────────────────────────────────────

    function render() {
        const dt = Math.min(clock.getDelta(), 0.033);
        const t = clock.elapsedTime;

        bgMaterial.uniforms.uTime.value = t;

        if (composer) {
            gradeShader.uniforms.uTime.value = t;
        }

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

            const ln = p.mesh.children.find(c => c.isLineSegments);
            if (ln) ln.material.color.setHSL(hsl.h, Math.min(1, hsl.s * 0.7), Math.max(0.22, adjL * 0.55));
        });
    }

    // ── Boot ─────────────────────────────────────────────────────────

    init();
    window.addEventListener('resize', onResize, { passive: true });
    new MutationObserver(onThemeChange).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
