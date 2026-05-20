(function () {
    // ============================================================================
    // CONFIGURATION
    // ============================================================================
    const CONFIG = {
        // Visual Parameters
        visual: {
            mobileBreakpoint: 700,
            pixelDensity: 1,
            borderRadius: {
                small: 3,
                medium: 6,
                large: 10
            },
            padding: {
                small: 6,
                medium: 8,
                large: 12
            },
            strokeWeight: {
                thin: 1,
                normal: 2
            }
        },

        // Image paths
        images: {
            basePath: 'assets/images/random_walk_output/',
            csvPath: 'assets/images/random_walk_output/uncoherence_values.csv',
            totalFrames: 200
        },

        // Text content
        text: {
            caption: '"a scenic volcano"',
            modelName: 'MIRO',
            outputLabel: 'Generated Output',
            phaseLabel: 'Adjusting reward weights in real-time'
        },

        // KaTeX formulas
        formulas: {
            rewardsLabel: '\\hat{\\mathbf{s}}_{\\text{custom}}'
        },

        // Reward names (matching CSV column order after frame)
        rewardNames: ['CLIP', 'Aesthetic', 'ImageReward', 'PickScore', 'HPSv2', 'VQA', 'SciScore'],

        // Animation parameters
        animation: {
            numRewards: 7,
            intersectionThreshold: 0.35,
            frameDuration: 200, // ms per frame (increased for smoother playback)
            pauseDuration: 2000, // ms pause at start/end
            easing: {
                inOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
            }
        },

        // Layout parameters
        layout: {
            mobile: {
                margin: 20,
                promptHeight: 50,
                modelSize: { w: 160, h: 100 },
                vectorSize: { w: 140, h: 120 },
                outputSize: 140,
                spacing: {
                    promptToModel: 30,
                    modelToVector: 50,
                    modelToOutput: 50
                },
                canvas: {
                    minHeight: 600,
                    heightMultiplier: 2.0
                }
            },
            desktop: {
                margin: 40,
                promptHeight: 60,
                modelSize: { w: 200, h: 120 },
                vectorSize: { w: 180, h: 180 },
                outputSize: 200,
                horizontalSpacing: 80,
                canvas: {
                    minHeight: 400,
                    heightMultiplier: 0.5
                }
            }
        },

        // Sizing parameters
        sizes: {
            text: {
                modelName: 22,
                label: 11,
                phaseLabel: 16,
                phaseLabelMobile: 13,
                captionLabel: 9,
                captionText: 11,
                rewardLabel: 10,
                rewardLabelMobile: 9
            },
            effects: {
                shadowBlur: 12
            }
        }
    };

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================
    const lerp = (a, b, t) => a + (b - a) * t;

    function getPalette() {
        const s = getComputedStyle(document.documentElement);
        return {
            bg: s.getPropertyValue('--bg').trim() || '#0b0c10',
            fg: s.getPropertyValue('--fg').trim() || '#e6e6e6',
            card: s.getPropertyValue('--card').trim() || '#15171c',
            accent: s.getPropertyValue('--accent').trim() || '#ff9a5c',
            muted: s.getPropertyValue('--muted').trim() || '#b5b5b5'
        };
    }

    function getRewardColors(p) {
        return [
            p.color(80, 210, 200),  // pastelteal - CLIP
            p.color(105, 200, 105), // pastelgreen - Aesthetic
            p.color(255, 105, 120), // pastelred - Image Reward
            p.color(255, 150, 220), // pastelpink - Pick
            p.color(100, 150, 255), // pastelblue - HPSv2
            p.color(230, 210, 80),  // pastelyellow - VQA
            p.color(200, 105, 230)  // pastelpurple - SciScore
        ];
    }

    // ============================================================================
    // CSV LOADER
    // ============================================================================
    class CSVLoader {
        constructor(path) {
            this.path = path;
            this.data = [];
            this.loaded = false;
        }

        async load() {
            try {
                const response = await fetch(this.path);
                const text = await response.text();
                const lines = text.trim().split('\n');

                // Skip header
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',');
                    const frame = parseInt(values[0]);
                    const rewards = values.slice(1).map(v => parseFloat(v));
                    this.data[frame] = rewards;
                }

                this.loaded = true;
                return true;
            } catch (error) {
                console.error('Failed to load CSV:', error);
                return false;
            }
        }

        getRewards(frame) {
            if (!this.loaded || frame < 0 || frame >= this.data.length) {
                return new Array(CONFIG.animation.numRewards).fill(0.5);
            }
            return this.data[frame];
        }
    }

    // ============================================================================
    // LAYOUT CALCULATOR
    // ============================================================================
    class LayoutCalculator {
        constructor(width, height, isMobile) {
            this.W = width;
            this.H = height;
            this.isMobile = isMobile;
            this.config = isMobile ? CONFIG.layout.mobile : CONFIG.layout.desktop;
        }

        getLayout() {
            if (this.isMobile) {
                return this.getMobileLayout();
            } else {
                return this.getDesktopLayout();
            }
        }

        getMobileLayout() {
            const M = this.config.margin;
            const promptH = this.config.promptHeight;
            const modelW = this.config.modelSize.w;
            const modelH = this.config.modelSize.h;
            const vecW = this.config.vectorSize.w;
            const vecH = this.config.vectorSize.h;
            const outSize = this.config.outputSize;

            // Center everything vertically
            const promptX = this.W / 2;
            const promptY = M + 20;

            // Histogram comes first after prompt
            const vecX = this.W / 2 - vecW / 2;
            const vecY = promptY + promptH + this.config.spacing.promptToModel;

            // Model comes after histogram
            const modelX = this.W / 2 - modelW / 2;
            const modelY = vecY + vecH + this.config.spacing.modelToVector;

            // Output comes last
            const outX = this.W / 2 - outSize / 2;
            const outY = modelY + modelH + this.config.spacing.modelToOutput;

            return {
                prompt: { x: promptX, y: promptY, h: promptH },
                model: { x: modelX, y: modelY, w: modelW, h: modelH },
                vector: { x: vecX, y: vecY, w: vecW, h: vecH },
                output: { x: outX, y: outY, size: outSize }
            };
        }

        getDesktopLayout() {
            const M = this.config.margin;
            const promptH = this.config.promptHeight;
            const modelW = this.config.modelSize.w;
            const modelH = this.config.modelSize.h;
            const vecW = this.config.vectorSize.w;
            const vecH = this.config.vectorSize.h;
            const outSize = this.config.outputSize;
            const hSpacing = this.config.horizontalSpacing;

            const centerY = this.H / 2;

            // Prompt at top center
            const promptX = this.W / 2;
            const promptY = M + 10;

            // Model in center
            const modelX = this.W / 2 - modelW / 2;
            const modelY = centerY - modelH / 2;

            // Vector on left
            const vecX = modelX - vecW - hSpacing;
            const vecY = centerY - vecH / 2;

            // Output on right
            const outX = modelX + modelW + hSpacing;
            const outY = centerY - outSize / 2;

            return {
                prompt: { x: promptX, y: promptY, h: promptH },
                model: { x: modelX, y: modelY, w: modelW, h: modelH },
                vector: { x: vecX, y: vecY, w: vecW, h: vecH },
                output: { x: outX, y: outY, size: outSize }
            };
        }
    }

    // ============================================================================
    // RENDERER
    // ============================================================================
    class Renderer {
        constructor(p) {
            this.p = p;
            this.pal = getPalette();
        }

        updatePalette() {
            this.pal = getPalette();
        }

        drawPromptBox(x, y, h, captionText, alpha = 1) {
            const p = this.p;
            p.push();
            if (alpha < 1) p.drawingContext.globalAlpha = alpha;

            p.fill(p.color(this.pal.muted));
            p.textAlign(p.CENTER, p.TOP);
            p.textSize(CONFIG.sizes.text.captionLabel);
            p.textStyle(p.NORMAL);
            p.text('prompt', x, y);

            p.fill(p.color(this.pal.fg));
            p.textSize(CONFIG.sizes.text.captionText);
            p.textStyle(p.ITALIC);
            p.text(captionText, x, y + 15);

            p.pop();
        }

        drawModelBox(x, y, w, h, alpha = 1) {
            const p = this.p;
            const ctx = p.drawingContext;
            p.push();
            ctx.globalAlpha = alpha;

            // Pulsing outer halo
            const t = p.millis() * 0.001;
            const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
            ctx.save();
            ctx.globalAlpha = (0.18 + 0.20 * pulse) * alpha;
            ctx.fillStyle = this.pal.accent;
            ctx.filter = 'blur(10px)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x - 6, y - 6, w + 12, h + 12, CONFIG.visual.borderRadius.large + 4);
            } else {
                ctx.rect(x - 6, y - 6, w + 12, h + 12);
            }
            ctx.fill();
            ctx.filter = 'none';
            ctx.restore();

            // Card fill with subtle gradient
            const grad = ctx.createLinearGradient(x, y, x, y + h);
            grad.addColorStop(0, this.pal.card);
            grad.addColorStop(1, this._mixHex(this.pal.card, this.pal.accent, 0.10));
            ctx.fillStyle = grad;
            p.noStroke();
            p.rect(x, y, w, h, CONFIG.visual.borderRadius.large);

            // Animated accent border
            const borderA = 0.55 + 0.45 * pulse;
            const rgb = this._hexToRgb(this.pal.accent);
            p.noFill();
            p.stroke(p.color(rgb.r, rgb.g, rgb.b, 255 * borderA));
            p.strokeWeight(CONFIG.visual.strokeWeight.normal);
            p.rect(x + 1, y + 1, w - 2, h - 2, CONFIG.visual.borderRadius.large);

            // Label with subtle breathing motion
            const breath = Math.sin(t * 1.6) * 0.6;
            p.noStroke();
            p.fill(p.color(this.pal.accent));
            p.textSize(CONFIG.sizes.text.modelName);
            p.textStyle(p.BOLD);
            p.textAlign(p.CENTER, p.CENTER);
            p.text(CONFIG.text.modelName, x + w / 2, y + h / 2 + breath);

            p.pop();
        }

        _hexToRgb(hex) {
            const h = (hex || '#ff9a5c').replace('#', '').trim();
            if (h.length === 6) {
                return {
                    r: parseInt(h.slice(0, 2), 16),
                    g: parseInt(h.slice(2, 4), 16),
                    b: parseInt(h.slice(4, 6), 16)
                };
            }
            return { r: 255, g: 154, b: 92 };
        }

        _mixHex(a, b, t) {
            const ca = this._hexToRgb(a);
            const cb = this._hexToRgb(b);
            const r = Math.round(ca.r * (1 - t) + cb.r * t);
            const g = Math.round(ca.g * (1 - t) + cb.g * t);
            const bl = Math.round(ca.b * (1 - t) + cb.b * t);
            return `rgb(${r}, ${g}, ${bl})`;
        }

        drawRewardVector(x, y, w, h, values, colors, isMobile, alpha = 1) {
            const p = this.p;
            const ctx = p.drawingContext;
            const n = values.length;
            const pad = CONFIG.visual.padding.medium;
            const labelH = 24;

            p.push();
            ctx.globalAlpha = alpha;

            // Box background
            p.noStroke();
            p.fill(p.color(this.pal.card));
            p.rect(x, y, w, h, CONFIG.visual.borderRadius.large);

            p.noFill();
            p.stroke('rgba(255,255,255,0.06)');
            p.strokeWeight(CONFIG.visual.strokeWeight.thin);
            p.rect(x + 0.5, y + 0.5, w - 1, h - 1, CONFIG.visual.borderRadius.large);

            // Histogram bars with gradient + glow
            const barWidth = (w - pad * (n + 1)) / n;
            const by = y + pad + labelH;
            const barAreaH = h - (pad * 2 + labelH);

            p.noStroke();
            for (let i = 0; i < n; i++) {
                const v = values[i] || 0;
                const barH = barAreaH * v;
                const bx = x + pad + i * (barWidth + pad);
                const by2 = by + (barAreaH - barH);
                const baseColor = colors[i % colors.length];

                if (barH > 1) {
                    const r = p.red(baseColor);
                    const g = p.green(baseColor);
                    const b = p.blue(baseColor);
                    const grad = ctx.createLinearGradient(bx, by2, bx, by2 + barH);
                    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
                    grad.addColorStop(1, `rgba(${Math.round(r * 0.75)}, ${Math.round(g * 0.75)}, ${Math.round(b * 0.75)}, 1)`);
                    ctx.fillStyle = grad;
                    p.rect(bx, by2, barWidth, barH, CONFIG.visual.borderRadius.small);

                    // Highlight strip at top of bar
                    ctx.save();
                    ctx.globalAlpha = alpha * 0.6;
                    ctx.fillStyle = `rgba(255, 255, 255, 0.35)`;
                    ctx.fillRect(bx + 1, by2 + 1, barWidth - 2, Math.min(2, barH));
                    ctx.restore();
                } else {
                    p.fill(baseColor);
                    p.rect(bx, by2, barWidth, Math.max(0, barH), CONFIG.visual.borderRadius.small);
                }
            }

            p.pop();
        }

        drawOutputBox(img, x, y, size, alpha = 1) {
            const p = this.p;
            const ctx = p.drawingContext;
            p.push();
            ctx.globalAlpha = alpha;
            p.noSmooth(); // faster image rendering

            // Soft outer glow
            ctx.save();
            ctx.globalAlpha = alpha * 0.22;
            ctx.fillStyle = this.pal.accent;
            ctx.filter = 'blur(14px)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x - 8, y - 8, size + 16, size + 16, CONFIG.visual.borderRadius.medium + 4);
            } else {
                ctx.rect(x - 8, y - 8, size + 16, size + 16);
            }
            ctx.fill();
            ctx.filter = 'none';
            ctx.restore();

            if (img && img.width > 0) {
                p.image(img, x, y, size, size);
            } else {
                p.fill(230);
                p.rect(x, y, size, size, CONFIG.visual.borderRadius.medium);
            }

            // Border
            p.noFill();
            p.stroke(p.color(this.pal.accent));
            p.strokeWeight(CONFIG.visual.strokeWeight.normal);
            p.rect(x, y, size, size, CONFIG.visual.borderRadius.medium);

            // Label
            p.fill(p.color(this.pal.muted));
            p.textAlign(p.CENTER, p.BOTTOM);
            p.textSize(CONFIG.sizes.text.label);
            p.text(CONFIG.text.outputLabel, x + size / 2, y - 8);

            p.pop();
        }

        drawArrow(x1, y1, x2, y2, color, alpha = 1) {
            const p = this.p;
            const ctx = p.drawingContext;
            p.push();

            // Soft underlay line
            ctx.save();
            ctx.globalAlpha = alpha * 0.4;
            ctx.strokeStyle = (typeof color === 'string') ? color : color.toString();
            ctx.lineWidth = CONFIG.visual.strokeWeight.normal;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.restore();

            // Flowing dashed line on top — animated direction of flow
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = (typeof color === 'string') ? color : color.toString();
            ctx.lineWidth = CONFIG.visual.strokeWeight.normal + 0.5;
            if (ctx.setLineDash) {
                ctx.setLineDash([10, 10]);
                ctx.lineDashOffset = -(p.millis() * 0.06) % 20;
            }
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.restore();

            // Arrowhead
            ctx.globalAlpha = alpha;
            p.noStroke();
            p.fill(color);
            const angle = Math.atan2(y2 - y1, x2 - x1);
            p.translate(x2, y2);
            p.rotate(angle);
            p.triangle(0, 0, -10, -5, -10, 5);
            p.pop();
        }
    }

    // ============================================================================
    // ANIMATION MANAGER
    // ============================================================================
    class AnimationManager {
        constructor(csvLoader) {
            this.csvLoader = csvLoader;
            this.totalFrames = CONFIG.images.totalFrames;
            this.frameDuration = CONFIG.animation.frameDuration;
            this.pauseDuration = CONFIG.animation.pauseDuration;
            this.totalCycleDuration = this.pauseDuration +
                (this.totalFrames * this.frameDuration) +
                this.pauseDuration;
        }

        getCurrentFrame(elapsed) {
            const t = elapsed % this.totalCycleDuration;

            // Start pause
            if (t < this.pauseDuration) {
                return { frame: 0, progress: 0, state: 'pause' };
            }

            // Animation
            const animTime = t - this.pauseDuration;
            const animDuration = this.totalFrames * this.frameDuration;

            if (animTime < animDuration) {
                const rawFrame = animTime / this.frameDuration;
                const frame = Math.floor(rawFrame);
                const progress = rawFrame - frame;
                return {
                    frame: Math.min(frame, this.totalFrames - 1),
                    progress,
                    state: 'animating'
                };
            }

            // End pause
            return {
                frame: this.totalFrames - 1,
                progress: 1,
                state: 'pause'
            };
        }

        getRewards(frame) {
            return this.csvLoader.getRewards(frame);
        }
    }

    // ============================================================================
    // IMAGE LOADER
    // ============================================================================
    class ImageLoader {
        constructor(p) {
            this.p = p;
            this.images = {};
            this.loadQueue = [];
            this.currentFrame = -1;
            this.preloadRange = 5; // Preload +/- 5 frames for smooth playback
        }

        loadFrame(frame) {
            if (this.images[frame]) {
                return this.images[frame];
            }

            const paddedFrame = String(frame).padStart(4, '0');
            const path = `${CONFIG.images.basePath}frame_${paddedFrame}.jpg`;

            this.images[frame] = this.p.loadImage(path,
                () => { }, // success
                () => { console.warn(`Failed to load frame ${frame}`); } // error
            );

            return this.images[frame];
        }

        preloadFrames(centerFrame) {
            if (centerFrame === this.currentFrame) return;
            this.currentFrame = centerFrame;

            const start = Math.max(0, centerFrame - this.preloadRange);
            const end = Math.min(CONFIG.images.totalFrames - 1, centerFrame + this.preloadRange);

            for (let i = start; i <= end; i++) {
                if (!this.images[i]) {
                    this.loadFrame(i);
                }
            }

            // Clean up old images to save memory
            for (let frame in this.images) {
                const f = parseInt(frame);
                if (f < start - 10 || f > end + 10) {
                    delete this.images[frame];
                }
            }
        }

        getFrame(frame) {
            return this.loadFrame(frame);
        }
    }

    // ============================================================================
    // PRELOAD DATA (starts immediately when script loads)
    // ============================================================================
    const globalCSVLoader = new CSVLoader(CONFIG.images.csvPath);
    const csvLoadPromise = globalCSVLoader.load(); // Start loading immediately

    // ============================================================================
    // MAIN P5 SKETCH
    // ============================================================================
    const sketch = (p) => {
        let t0 = 0, playing = false;
        let renderer, animManager, imageLoader;
        let initialized = false;
        let katexLabel;

        function createKatexLabel(latexString) {
            const div = p.createDiv('');
            div.parent('rewardTradeoffAnimation');
            div.class('katex-label');
            katex.render(latexString, div.elt, { throwOnError: false, displayMode: true });
            return div;
        }

        p.setup = async () => {
            const parent = p.select('#rewardTradeoffAnimation');
            if (!parent) {
                console.error('Container #rewardTradeoffAnimation not found');
                return;
            }

            parent.style('position', 'relative');

            const parentW = parent.elt.clientWidth || 960;
            const isMobile = parentW < CONFIG.visual.mobileBreakpoint;

            let w, h;
            if (isMobile) {
                w = parentW;
                h = Math.max(CONFIG.layout.mobile.canvas.minHeight,
                    parentW * CONFIG.layout.mobile.canvas.heightMultiplier);
            } else {
                w = Math.min(1200, parentW);
                h = Math.max(CONFIG.layout.desktop.canvas.minHeight,
                    Math.round(w * CONFIG.layout.desktop.canvas.heightMultiplier));
            }

            const canvas = p.createCanvas(w, h);
            canvas.style('display', 'block');
            canvas.style('margin', '0 auto');
            parent.elt.insertBefore(canvas.elt, parent.elt.firstChild);
            p.pixelDensity(CONFIG.visual.pixelDensity);
            p.frameRate(30); // Limit frame rate for smoother performance

            // Initialize components
            renderer = new Renderer(p);

            // Wait for CSV data (already loading in background)
            await csvLoadPromise;

            animManager = new AnimationManager(globalCSVLoader);
            imageLoader = new ImageLoader(p);

            // Aggressively preload first frames for instant start
            for (let i = 0; i < 15; i++) {
                imageLoader.loadFrame(i);
            }

            // Create KaTeX label for reward weights
            katexLabel = createKatexLabel(CONFIG.formulas.rewardsLabel);

            initialized = true;

            // Continue preloading more frames in background (non-blocking)
            setTimeout(() => {
                for (let i = 15; i < 50; i++) {
                    imageLoader.loadFrame(i);
                }
            }, 100);

            // Intersection observer
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && entry.intersectionRatio >= CONFIG.animation.intersectionThreshold) {
                        if (!playing) {
                            t0 = p.millis();
                            playing = true;
                            p.loop(); // Resume draw loop
                        }
                    } else {
                        if (playing) {
                            playing = false;
                            p.noLoop(); // Stop draw loop to prevent jitter
                        }
                    }
                });
            }, { threshold: CONFIG.animation.intersectionThreshold });

            observer.observe(canvas.elt);

            // Start immediately if already in viewport
            const rect = canvas.elt.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
            if (isVisible) {
                t0 = p.millis();
                playing = true;
                p.loop(); // Resume draw loop
            }

            // Click to toggle
            parent.elt.addEventListener('click', () => {
                playing = !playing;
                if (playing) {
                    t0 = p.millis() - (p.millis() - t0) % animManager.totalCycleDuration;
                    p.loop(); // Resume draw loop
                } else {
                    p.noLoop(); // Stop draw loop to prevent jitter
                }
            });

            // Start with draw loop stopped
            p.noLoop();
        };

        p.windowResized = () => {
            const parent = p.select('#rewardTradeoffAnimation');
            if (!parent) return;

            const parentW = parent.elt.clientWidth || 960;
            const isMobile = parentW < CONFIG.visual.mobileBreakpoint;

            let w, h;
            if (isMobile) {
                w = parentW;
                h = Math.max(CONFIG.layout.mobile.canvas.minHeight,
                    parentW * CONFIG.layout.mobile.canvas.heightMultiplier);
            } else {
                w = Math.min(1200, parentW);
                h = Math.max(CONFIG.layout.desktop.canvas.minHeight,
                    Math.round(w * CONFIG.layout.desktop.canvas.heightMultiplier));
            }

            p.resizeCanvas(w, h);
        };

        p.draw = () => {
            if (!initialized || !playing) return;
            p.clear();

            const elapsed = p.millis() - t0;
            const { frame, progress, state } = animManager.getCurrentFrame(elapsed);
            const isMobile = p.width < CONFIG.visual.mobileBreakpoint;

            // Preload nearby frames
            imageLoader.preloadFrames(frame);

            // Update palette and create layout
            renderer.updatePalette();
            const layoutCalc = new LayoutCalculator(p.width, p.height, isMobile);
            const layout = layoutCalc.getLayout();

            // Get current rewards
            const rewards = animManager.getRewards(frame);
            const rewardColors = getRewardColors(p);

            // Get current image
            const currentImg = imageLoader.getFrame(frame);

            // Draw components
            renderer.drawPromptBox(
                layout.prompt.x,
                layout.prompt.y,
                layout.prompt.h,
                CONFIG.text.caption,
                1
            );

            renderer.drawModelBox(
                layout.model.x,
                layout.model.y,
                layout.model.w,
                layout.model.h,
                1
            );

            renderer.drawRewardVector(
                layout.vector.x,
                layout.vector.y,
                layout.vector.w,
                layout.vector.h,
                rewards,
                rewardColors,
                isMobile,
                1
            );

            // Position KaTeX label for reward vector
            if (katexLabel) {
                katexLabel.position(
                    layout.vector.x + layout.vector.w / 2 - 25,
                    layout.vector.y + 2
                ).style('opacity', 1);
            }

            renderer.drawOutputBox(
                currentImg,
                layout.output.x,
                layout.output.y,
                layout.output.size,
                1
            );

            // Draw arrows
            const pal = renderer.pal;
            if (!isMobile) {
                // Arrow from vector to model
                renderer.drawArrow(
                    layout.vector.x + layout.vector.w,
                    layout.vector.y + layout.vector.h / 2,
                    layout.model.x - 5,
                    layout.model.y + layout.model.h / 2,
                    pal.muted,
                    0.6
                );

                // Arrow from model to output
                renderer.drawArrow(
                    layout.model.x + layout.model.w + 5,
                    layout.model.y + layout.model.h / 2,
                    layout.output.x - 5,
                    layout.output.y + layout.output.size / 2,
                    pal.accent,
                    0.8
                );
            }

            // Phase label
            renderPhaseLabel(p, isMobile, renderer.pal);
        };

        function renderPhaseLabel(p, isMobile, pal) {
            p.push();
            p.textAlign(p.CENTER, p.TOP);
            p.textStyle(p.BOLD);
            const phaseLabelY = isMobile ? 5 : 10;
            const textSize = isMobile ? CONFIG.sizes.text.phaseLabelMobile : CONFIG.sizes.text.phaseLabel;

            p.fill(p.color(pal.fg));
            p.textSize(textSize);
            p.text(CONFIG.text.phaseLabel, p.width / 2, phaseLabelY);
            p.pop();
        }
    };

    new p5(sketch, document.getElementById('rewardTradeoffAnimation'));
})();

