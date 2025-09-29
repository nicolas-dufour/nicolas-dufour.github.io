(function () {
    const container = document.getElementById('intro-three-container');
    if (!container) return;

    const THREE_NS = window.THREE;
    if (!THREE_NS) {
        console.warn('THREE not loaded');
        return;
    }

    let scene, camera, renderer, clock;
    let planes = [];
    let animationId = null;

    const params = {
        planeCount: 44,
        spawnRadius: 40,
        areaDepth: 80,
        baseSpeed: 0.8,
        speedJitter: 0.6,
        turnJitter: 0.5,
        jitterIntervalMin: 0.45,
        jitterIntervalMax: 1.25,
        turbulenceAmp: 0.14,
        // Wind field parameters
        windBase: 0.55,
        windGust: 0.65,
        windSwirl: 0.35,
        windSwirlScale: 0.6,
        windSwirlSpeed: 0.2,
        windVertical: 0.12,
        windYawAlign: 1.6,
        windLean: 0.35,
        scaleMin: 0.7,
        scaleMax: 1.4
    };

    function createRenderer() {
        const r = new THREE_NS.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        r.outputColorSpace = THREE_NS.SRGBColorSpace;
        r.setClearAlpha(0);
        container.appendChild(r.domElement);
        return r;
    }

    function computePaperColor() {
        // Slightly warm paper tones; adapt to theme
        const isDark = document.body.classList.contains('dark-theme');
        const base = isDark ? 0xe7ebf0 : 0xf6f7f8;
        const accent = isDark ? 0xcfd6df : 0xe8ebef;
        return { base, accent };
    }

    function createPaperMaterial() {
        const { base, accent } = computePaperColor();
        const material = new THREE_NS.MeshStandardMaterial({
            color: base,
            roughness: 0.9,
            metalness: 0.0,
            side: THREE_NS.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
        });
        // Subtle vertex color modulation via onBeforeCompile (adds slight paper grain shading)
        material.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `#include <color_fragment>
         float grain = (sin(gl_FragCoord.x * 0.75) * cos(gl_FragCoord.y * 0.75)) * 0.008;
         diffuseColor.rgb += vec3(grain);
        `
            );
        };

        // Thin dark edge to hint folded paper using LineSegments overlay
        const lineMat = new THREE_NS.LineBasicMaterial({ color: accent, transparent: false, opacity: 1.0 });
        return { material, lineMat };
    }

    function isDarkTheme() {
        return document.body.classList.contains('dark-theme');
    }

    function getPlaneBaseHSL(index, total) {
        // Distribute hues using golden ratio for pleasing variety
        const golden = 0.61803398875;
        const hue = (index * golden) % 1;
        // Prefer vibrant but not neon; bias toward sunset-friendly saturation
        const saturation = 0.68;
        const lightness = 0.60;
        return { h: hue, s: saturation, l: lightness };
    }

    function themedLightness(l) {
        // Nudge brightness based on theme for readability
        return isDarkTheme() ? Math.min(0.75, l + 0.08) : Math.max(0.52, l - 0.02);
    }

    function sampleWind(position, time, index) {
        // Slowly rotating global wind direction with soft gusting
        const dirAngle = time * 0.15 + index * 0.123;
        const base = new THREE_NS.Vector3(Math.cos(dirAngle), 0, Math.sin(dirAngle)).multiplyScalar(params.windBase);

        const gustStrength = (Math.sin(time * 0.8 + index * 1.7) * Math.sin(time * 0.32 + index * 2.1) * 0.5 + 0.5) * params.windGust;
        base.multiplyScalar(1.0 + gustStrength);

        // Spatial swirl that advects planes; includes a small vertical component
        const s = params.windSwirlScale;
        const spd = params.windSwirlSpeed;
        const swirlX = Math.sin(position.z * s + time * spd + index) * params.windSwirl;
        const swirlZ = Math.cos(position.x * s * 1.3 - time * spd * 1.2 + index * 0.5) * params.windSwirl;
        const swirlY = Math.sin(position.x * 0.15 + time * 0.4 + index * 0.7) * params.windVertical;
        const swirl = new THREE_NS.Vector3(swirlX, swirlY, swirlZ);

        return base.add(swirl);
    }

    function createPaperPlaneGeometry() {
        // Simple low-poly paper plane inspired by classic origami proportions.
        // Coordinates define a fuselage spine, wings, and folded nose; centered near (0,0,0).
        const vertices = [
            // Left wing
            -0.9, 0.0, -0.2,
            0.0, 0.02, 0.0,
            -0.2, 0.0, 0.8,

            // Right wing
            0.9, 0.0, -0.2,
            0.0, 0.02, 0.0,
            0.2, 0.0, 0.8,

            // Body left
            -0.2, 0.0, 0.8,
            0.0, 0.04, 1.25,
            0.0, 0.02, 0.0,

            // Body right
            0.2, 0.0, 0.8,
            0.0, 0.04, 1.25,
            0.0, 0.02, 0.0,

            // Tail fold left
            -0.28, -0.005, -0.35,
            -0.04, 0.01, 0.25,
            0.0, 0.0, -0.6,

            // Tail fold right
            0.28, -0.005, -0.35,
            0.04, 0.01, 0.25,
            0.0, 0.0, -0.6
        ];

        const position = new Float32Array(vertices);
        const geometry = new THREE_NS.BufferGeometry();
        geometry.setAttribute('position', new THREE_NS.BufferAttribute(position, 3));
        geometry.computeVertexNormals();

        // Edge lines for a folded-paper look
        const edges = new THREE_NS.EdgesGeometry(geometry, 30);

        // Nose subtle bevel by scaling z of forward vertices
        geometry.translate(0, 0.02, 0.0);
        return { geometry, edges };
    }

    function createPlane({ material, lineMat, index, total }) {
        const { geometry, edges } = createPaperPlaneGeometry();
        const mat = material.clone();
        const lineMaterial = lineMat.clone();

        // Assign a colorful base hue per plane and a darker edge accent
        const baseHSL = getPlaneBaseHSL(index, total);
        const adjL = themedLightness(baseHSL.l);
        mat.color.setHSL(baseHSL.h, baseHSL.s, adjL);

        const accentL = Math.max(0.28, adjL * 0.7);
        const accentS = Math.min(1.0, baseHSL.s * 0.85);
        const accent = new THREE_NS.Color();
        accent.setHSL(baseHSL.h, accentS, accentL);
        lineMaterial.color.copy(accent);

        const mesh = new THREE_NS.Mesh(geometry, mat);
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        const line = new THREE_NS.LineSegments(edges, lineMaterial);
        mesh.add(line);

        mesh.userData.baseHSL = baseHSL; // Persist so theme toggles keep the hue

        const scale = THREE_NS.MathUtils.lerp(params.scaleMin, params.scaleMax, Math.random());
        mesh.scale.setScalar(scale);

        // Initial placement inside a forward-moving volume
        const angle = Math.random() * Math.PI * 2;
        const radius = params.spawnRadius * (0.4 + Math.random() * 0.6);
        mesh.position.set(Math.cos(angle) * radius, THREE_NS.MathUtils.randFloatSpread(10), -Math.random() * params.areaDepth);

        // Orient forward (positive z), then add yaw/pitch variation
        mesh.rotation.set(0, 0, 0);
        mesh.rotation.y += THREE_NS.MathUtils.randFloatSpread(Math.PI * 0.6);
        mesh.rotation.x += THREE_NS.MathUtils.randFloatSpread(Math.PI * 0.15);

        // Motion parameters per plane
        const speed = params.baseSpeed + Math.random() * params.speedJitter;
        const turn = (Math.random() - 0.5) * params.turnJitter;
        const bobAmp = THREE_NS.MathUtils.randFloat(0.06, 0.18) * scale;
        const bobFreq = THREE_NS.MathUtils.randFloat(0.5, 1.6);

        // Jitter state for intermittent, less-smooth motion
        const jitter = {
            nextSwitch: 0,
            yawKick: 0,
            pitchKick: 0,
            rollKick: 0
        };

        return { mesh, speed, turn, bobAmp, bobFreq, jitter };
    }

    function setupLights() {
        // Warm sunset ambience: peach sky, deep violet ground
        const hemi = new THREE_NS.HemisphereLight(0xffccaa, 0x2a1840, 0.8);
        hemi.position.set(0, 1, 0);
        scene.add(hemi);

        // Low, warm sun key light
        const dir = new THREE_NS.DirectionalLight(0xffb36b, 1.0);
        dir.position.set(-4, 1.6, 2.5);
        dir.castShadow = false;
        scene.add(dir);

        // Cool complementary rim for contrast
        const rim = new THREE_NS.DirectionalLight(0x7fa6ff, 0.35);
        rim.position.set(3, 2, -4);
        scene.add(rim);
    }

    function init() {
        scene = new THREE_NS.Scene();
        clock = new THREE_NS.Clock();

        camera = new THREE_NS.PerspectiveCamera(55, 1, 0.1, 200);
        camera.position.set(0, 1.8, 7.4);
        camera.lookAt(0, 0.6, 0);

        renderer = createRenderer();
        onResize();

        const { material, lineMat } = createPaperMaterial();

        const count = params.planeCount;
        for (let i = 0; i < count; i++) {
            const p = createPlane({ material, lineMat, index: i, total: count });
            scene.add(p.mesh);
            planes.push(p);
        }

        setupLights();

        start();
    }

    function updatePlanes(delta, elapsed) {
        const width = window.innerWidth;
        const speedScale = width < 600 ? 0.8 : 1.0;

        for (let i = 0; i < planes.length; i++) {
            const p = planes[i];
            const mesh = p.mesh;

            // Forward movement (towards +z) with wind advection
            const forward = new THREE_NS.Vector3(0, 0, 1).applyEuler(mesh.rotation).normalize();
            const wind = sampleWind(mesh.position, elapsed, i);
            const windInfluence = wind.clone().multiplyScalar(delta);
            mesh.position.addScaledVector(forward, p.speed * speedScale * delta);
            mesh.position.add(windInfluence);

            // Gentle wandering baseline
            mesh.rotation.y += p.turn * 0.2 * delta;
            mesh.rotation.x += Math.sin(elapsed * p.bobFreq + i) * 0.05 * delta;

            // Intermittent jitter/turbulence for less-smooth motion
            if (elapsed > p.jitter.nextSwitch) {
                p.jitter.nextSwitch = elapsed + THREE_NS.MathUtils.randFloat(params.jitterIntervalMin, params.jitterIntervalMax);
                p.jitter.yawKick = THREE_NS.MathUtils.randFloatSpread(params.turbulenceAmp);
                p.jitter.pitchKick = THREE_NS.MathUtils.randFloatSpread(params.turbulenceAmp * 0.7);
                p.jitter.rollKick = THREE_NS.MathUtils.randFloatSpread(params.turbulenceAmp * 0.9);
            }
            const fade = Math.min(1, Math.max(0, (p.jitter.nextSwitch - elapsed) / params.jitterIntervalMax));
            mesh.rotation.y += p.jitter.yawKick * fade * delta * 2.0;
            mesh.rotation.x += p.jitter.pitchKick * fade * delta * 2.0;

            // Wing bobbing around local x-axis
            mesh.rotation.z = Math.sin(elapsed * p.bobFreq * 1.2 + i * 0.7) * p.bobAmp + p.jitter.rollKick * fade * 0.5;

            // Align yaw slightly with wind direction and lean into crosswind
            const targetYaw = Math.atan2(wind.x, wind.z);
            const yawDelta = THREE_NS.MathUtils.angleDiff ? THREE_NS.MathUtils.angleDiff(mesh.rotation.y, targetYaw) : (targetYaw - mesh.rotation.y);
            mesh.rotation.y += yawDelta * params.windYawAlign * delta;
            const cross = new THREE_NS.Vector3().copy(wind).sub(forward.clone().multiplyScalar(wind.dot(forward))).length();
            mesh.rotation.z += cross * params.windLean * delta * (wind.x >= 0 ? 1 : -1);

            // Recycle when out of bounds
            if (mesh.position.z > 6) {
                const angle = Math.random() * Math.PI * 2;
                const radius = params.spawnRadius * (0.4 + Math.random() * 0.6);
                mesh.position.set(Math.cos(angle) * radius, THREE_NS.MathUtils.randFloatSpread(10), -params.areaDepth);
                mesh.rotation.set(0, 0, 0);
                mesh.rotation.y += THREE_NS.MathUtils.randFloatSpread(Math.PI * 0.6);
                mesh.rotation.x += THREE_NS.MathUtils.randFloatSpread(Math.PI * 0.15);
            }
        }
    }

    function render() {
        const delta = Math.min(clock.getDelta(), 0.033);
        const elapsed = clock.elapsedTime;
        updatePlanes(delta, elapsed);
        renderer.render(scene, camera);
    }

    function loop() {
        render();
        animationId = container.isConnected ? requestAnimationFrame(loop) : null;
    }

    function start() {
        if (animationId == null) {
            clock.start();
            loop();
        }
    }

    function stop() {
        if (animationId != null) {
            cancelAnimationFrame(animationId);
            animationId = null;
            clock.stop();
        }
    }

    function onResize() {
        const rect = container.getBoundingClientRect();
        const width = Math.max(1, rect.width || container.clientWidth || window.innerWidth);
        const height = Math.max(1, rect.height || (document.getElementById('intro')?.clientHeight || window.innerHeight * 0.45));

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);

        // Adjust camera slightly based on width to fit composition
        const isMobile = width < 600;
        camera.position.set(0, isMobile ? 1.3 : 1.9, isMobile ? 7.0 : 7.6);
        camera.lookAt(0, isMobile ? 0.5 : 0.7, 0);
    }

    function onThemeChange() {
        // Preserve each plane hue; only adjust brightness and edge contrast
        planes.forEach((p) => {
            const m = p.mesh.material;
            const stored = p.mesh.userData.baseHSL;
            if (m && m.isMaterial && stored) {
                const adjL = themedLightness(stored.l);
                m.color.setHSL(stored.h, stored.s, adjL);
                m.needsUpdate = true;
            }
            const line = p.mesh.children.find((c) => c.isLineSegments);
            if (line && stored) {
                const accentL = Math.max(0.28, themedLightness(stored.l) * 0.7);
                const accentS = Math.min(1.0, stored.s * 0.85);
                const accent = new THREE_NS.Color().setHSL(stored.h, accentS, accentL);
                line.material.color.copy(accent);
                line.material.needsUpdate = true;
            }
        });
    }

    // Init
    init();

    // Events
    window.addEventListener('resize', onResize, { passive: true });

    // Theme toggle integration (observes body class changes)
    const themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

})();
