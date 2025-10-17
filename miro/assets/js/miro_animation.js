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
            primary: 'assets/images/miro_placeholder.jpg',
            fallback: 'assets/images/miro_pipeline_placeholder.svg'
        },

        // Text content
        text: {
            caption: '"a scenic volcano"',
            modelName: 'MIRO',
            rewardsLabel: 'Rewards r₁,...,rₙ',
            scoresLabel: 'scores ŝ',
            scoresVector: 'scores vector',
            denoisedImage: 'denoised image',
            prompt: 'prompt',
            phaseLabels: {
                scoring: 'Scoring the dataset with all the rewards',
                training: 'Flow matching training'
            }
        },

        // Timeline (stage name, duration in ms)
        timeline: [
            ['intro', 2000],
            ['move_to_rewards', 1600],
            ['fanout_inputs', 100],
            ['emit_scores', 3200],
            ['rewards_disappear', 1000],
            ['scores_back', 1800],
            ['noise_input', 1400],
            ['denoiser_appear', 1000],
            ['to_denoiser', 1600],
            ['clean_output', 2200],
            ['pause', 1200]
        ],

        // Animation parameters
        animation: {
            numRewards: 7,
            intersectionThreshold: 0.35,
            rowDelay: 0.12,      // per-row stagger as fraction of stage
            morphEnd: 0.6,       // image->dot morph completes within emit_scores
            vecStart: 0.8,       // dot leaves row to scores vector
            barStart: 0.9,       // histogram begins filling
            noiseParams: {
                stdDev: 80,
                maxWeight: 0.4
            },
            easing: {
                inOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
            }
        },

        // Layout parameters
        layout: {
            mobile: {
                margin: 20,
                imgScale: 0.55,
                imgAspectRatio: 0.66,
                captionHeight: 40,
                rewardsScale: 0.7,
                rewardsHeight: 100,
                vectorScale: 0.65,
                vectorHeight: 60,
                modelScale: 0.7,
                modelHeight: 85,
                spacing: {
                    imgToCaption: 8,
                    captionToRewards: 25,
                    rewardsToVector: 20,
                    vectorToModel: 25,
                    modelToOutput: 25
                },
                canvas: {
                    minHeight: 650,
                    heightMultiplier: 1.8
                },
                startY: 40 // M + 20
            },
            desktop: {
                margin: 20,
                imgScale: 0.22,
                maxImgWidth: 240,
                imgAspectRatio: 0.66,
                imgY: 0.38,
                captionHeight: 45,
                captionSpacing: 12,
                rewardsOffsetX: 100,
                rewardsOffsetY: -12,
                rewardsMinWidth: 160,
                rewardsScale: 0.16,
                vectorOffsetX: 50,
                vectorMinWidth: 120,
                vectorScale: 0.12,
                modelOffsetX: 60,
                modelMinWidth: 200,
                modelScale: 0.19,
                outputOffsetX: 60,
                canvas: {
                    minHeight: 400,
                    heightMultiplier: 0.45
                }
            }
        },

        // Sizing parameters
        sizes: {
            text: {
                modelName: 22,
                rewardLabel: 12,
                rewardLabelMobile: 10,
                boxLabel: 12,
                phaseLabel: 16,
                phaseLabelMobile: 13,
                miniPrompt: 11,
                scoreValue: 12,
                scoreValueMobile: 10,
                legend: 11,
                captionLabel: 9,
                captionText: 11,
                icon: 12
            },
            arrow: {
                length: 8,
                width: 4
            },
            effects: {
                shadowBlur: 12
            },
            rewards: {
                headerHeight: 16,
                gap: 6,
                miniInputPadding: 10,
                miniInputTop: 20,
                miniInputScale: 0.65,
                miniInputMaxMobile: 24,
                miniInputMaxDesktop: 20
            },
            dot: {
                radius: 8,
                morphMinScale: 0.25
            }
        },

        // Scaling factors for animations
        scaling: {
            imgInRewards: 0.55,
            imgSmallInRewards: 0.6,  // relative to imgInRewards
            imgInModel: 0.5,
            miniInputInRow: 0.55,
            leftVectorDesktop: 0.85
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
            p.color(255, 150, 220), // pastelpink - Pick
            p.color(105, 200, 105), // pastelgreen - Aesthetic
            p.color(100, 150, 255), // pastelblue - HPSv2
            p.color(80, 210, 200),  // pastelteal - CLIP
            p.color(255, 105, 120), // pastelred - Image Reward
            p.color(200, 105, 230), // pastelpurple - SciScore
            p.color(230, 210, 80)   // pastelyellow - VQA
        ];
    }

    function subscriptFor(i) {
        const subs = ['₁', '₂', '₃', '₄', '₅', '₆', '₇'];
        return (i >= 0 && i < subs.length) ? subs[i] : String(i + 1);
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

        getImageLayout() {
            if (this.isMobile) {
                const imgW = Math.min(this.W * this.config.imgScale, 180);
                const imgH = imgW * this.config.imgAspectRatio;
                const imgX = this.W / 2 - imgW / 2;
                const imgY = this.config.startY;

                return { imgX, imgY, imgW, imgH };
            } else {
                const imgW = Math.min(this.W * this.config.imgScale, this.config.maxImgWidth);
                const imgH = imgW * this.config.imgAspectRatio;
                const imgX = this.config.margin;
                const imgY = this.H * this.config.imgY;

                return { imgX, imgY, imgW, imgH };
            }
        }

        getCaptionLayout(imgLayout) {
            if (this.isMobile) {
                const capW = imgLayout.imgW;
                const capH = this.config.captionHeight;
                const capX = imgLayout.imgX;
                const capY = imgLayout.imgY + imgLayout.imgH + this.config.spacing.imgToCaption;

                return { capX, capY, capW, capH };
            } else {
                const capW = imgLayout.imgW;
                const capH = this.config.captionHeight;
                const capX = this.config.margin;
                const capY = imgLayout.imgY + imgLayout.imgH + this.config.captionSpacing;

                return { capX, capY, capW, capH };
            }
        }

        getRewardsLayout(imgLayout, captionLayout) {
            if (this.isMobile) {
                const rewardsW = Math.min(this.W * this.config.rewardsScale, 200);
                const rewardsH = this.config.rewardsHeight;
                const rewardsX = this.W / 2 - rewardsW / 2;
                const rewardsY = captionLayout.capY + captionLayout.capH + this.config.spacing.captionToRewards;

                return { rewardsX, rewardsY, rewardsW, rewardsH };
            } else {
                const rewardsX = imgLayout.imgX + imgLayout.imgW + this.config.rewardsOffsetX;
                const rewardsY = imgLayout.imgY + this.config.rewardsOffsetY;
                const rewardsW = Math.max(this.config.rewardsMinWidth, this.W * this.config.rewardsScale);
                const rewardsH = imgLayout.imgH + captionLayout.capH + 35;

                return { rewardsX, rewardsY, rewardsW, rewardsH };
            }
        }

        getVectorLayout(rewardsLayout, imgLayout) {
            if (this.isMobile) {
                const vecW = Math.min(this.W * this.config.vectorScale, 170);
                const vecH = this.config.vectorHeight;
                const vecX = this.W / 2 - vecW / 2;
                const vecY = rewardsLayout.rewardsY + rewardsLayout.rewardsH + this.config.spacing.rewardsToVector;

                return { vecX, vecY, vecW, vecH };
            } else {
                const vecX = rewardsLayout.rewardsX + rewardsLayout.rewardsW + this.config.vectorOffsetX;
                const vecY = rewardsLayout.rewardsY;
                const vecW = Math.max(this.config.vectorMinWidth, this.W * this.config.vectorScale);
                const vecH = rewardsLayout.rewardsH;

                return { vecX, vecY, vecW, vecH };
            }
        }

        getModelLayout(vectorLayout, imgLayout, rewardsLayout) {
            if (this.isMobile) {
                const modelW = Math.min(this.W * this.config.modelScale, 200);
                const modelH = this.config.modelHeight;
                const modelX = this.W / 2 - modelW / 2;
                const modelY = vectorLayout.vecY + vectorLayout.vecH + this.config.spacing.vectorToModel;

                return { modelX, modelY, modelW, modelH };
            } else {
                const modelX = imgLayout.imgX + imgLayout.imgW + this.config.modelOffsetX;
                const modelY = rewardsLayout.rewardsY;
                const modelW = Math.max(this.config.modelMinWidth, this.W * this.config.modelScale);
                const modelH = rewardsLayout.rewardsH;

                return { modelX, modelY, modelW, modelH };
            }
        }

        getOutputLayout(modelLayout, imgLayout) {
            if (this.isMobile) {
                const outX = this.W / 2 - imgLayout.imgW / 2;
                const outY = modelLayout.modelY + modelLayout.modelH + this.config.spacing.modelToOutput;

                return { outX, outY };
            } else {
                const outX = modelLayout.modelX + modelLayout.modelW + this.config.outputOffsetX;
                const outY = modelLayout.modelY + modelLayout.modelH / 2 - (imgLayout.imgW * this.config.imgAspectRatio) / 2;

                return { outX, outY };
            }
        }

        getLeftVectorLayout(imgLayout, vectorLayout) {
            // "scores back" vector position
            if (this.isMobile) {
                return {
                    leftVecW: vectorLayout.vecW,
                    leftVecH: vectorLayout.vecH,
                    leftVecX: vectorLayout.vecX,
                    leftVecY: vectorLayout.vecY
                };
            } else {
                const leftVecW = imgLayout.imgW * CONFIG.scaling.leftVectorDesktop;
                const leftVecH = 65;
                const leftVecX = imgLayout.imgX;
                const leftVecY = Math.max(this.config.margin + 10, imgLayout.imgY - leftVecH - 50);

                return { leftVecW, leftVecH, leftVecX, leftVecY };
            }
        }
    }

    // ============================================================================
    // GEOMETRY HELPERS
    // ============================================================================
    class GeometryHelper {
        static getHistogramGeom(x, y, w, h, n) {
            const pad = CONFIG.visual.padding.medium;
            const barWidth = (w - pad * (n + 1)) / n;
            const by = y + pad + 16;
            const barAreaH = h - (pad * 2 + 16);
            const slots = [];
            for (let i = 0; i < n; i++) {
                const sx = x + pad + i * (barWidth + pad);
                slots.push({ x: sx, w: barWidth });
            }
            return { pad, barWidth, by, barAreaH, slots };
        }

        static getRewardRowRects(x, y, w, h, n, isMobile) {
            const pad = CONFIG.visual.padding.medium;
            const headerH = CONFIG.sizes.rewards.headerHeight;
            const innerX = x + pad;
            const innerY = y + pad + headerH;
            const innerW = w - pad * 2;
            const innerH = h - (pad * 2 + headerH);
            const gap = CONFIG.sizes.rewards.gap;

            if (isMobile) {
                // Mobile: arrange as columns (vertical flow)
                const colW = (innerW - gap * (n - 1)) / n;
                const rects = [];
                for (let i = 0; i < n; i++) {
                    const rx = innerX + i * (colW + gap);
                    rects.push({ x: rx, y: innerY, w: colW, h: innerH });
                }
                return rects;
            } else {
                // Desktop: arrange as rows (horizontal flow)
                const rowH = (innerH - gap * (n - 1)) / n;
                const rects = [];
                for (let i = 0; i < n; i++) {
                    const ry = innerY + i * (rowH + gap);
                    rects.push({ x: innerX, y: ry, w: innerW, h: rowH });
                }
                return rects;
            }
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

        drawArrow(x1, y1, x2, y2, opts = {}) {
            const p = this.p;
            const color = opts.color || this.pal.accent;
            const weight = opts.weight || CONFIG.visual.strokeWeight.normal;
            const alpha = opts.alpha != null ? opts.alpha : 1;
            const dashed = opts.dashed || false;

            p.push();
            p.stroke(p.color(p.red(p.color(color)), p.green(p.color(color)), p.blue(p.color(color)), 255 * alpha));
            p.strokeWeight(weight);
            if (dashed && p.drawingContext && p.drawingContext.setLineDash) {
                p.drawingContext.setLineDash([6, 6]);
            }
            p.fill(p.color(color));
            p.line(x1, y1, x2, y2);
            const a = Math.atan2(y2 - y1, x2 - x1);
            const L = CONFIG.sizes.arrow.length;
            p.translate(x2, y2);
            p.rotate(a);
            p.triangle(0, 0, -L, -CONFIG.sizes.arrow.width, -L, CONFIG.sizes.arrow.width);
            p.pop();
        }

        drawBox(x, y, w, h, label, isMiro = false) {
            const p = this.p;
            p.push();
            p.noStroke();
            if (p.drawingContext) {
                p.drawingContext.shadowColor = 'rgba(0,0,0,0.25)';
                p.drawingContext.shadowBlur = CONFIG.sizes.effects.shadowBlur;
            }
            p.fill(p.color(this.pal.card));
            p.rect(x, y, w, h, CONFIG.visual.borderRadius.large);
            p.noFill();
            if (isMiro) {
                p.stroke(p.color(this.pal.accent));
                p.strokeWeight(CONFIG.visual.strokeWeight.normal);
                p.rect(x + 1, y + 1, w - 2, h - 2, CONFIG.visual.borderRadius.large);
            } else {
                p.stroke('rgba(255,255,255,0.06)');
                p.strokeWeight(CONFIG.visual.strokeWeight.thin);
                p.rect(x + 0.5, y + 0.5, w - 1, h - 1, CONFIG.visual.borderRadius.large);
            }
            p.noStroke();
            if (isMiro) {
                p.fill(p.color(this.pal.accent));
                p.textSize(CONFIG.sizes.text.modelName);
                p.textStyle(p.BOLD);
                p.textAlign(p.CENTER, p.CENTER);
                p.text(label, x + w / 2, y + h / 2);
            } else {
                p.fill(p.color(this.pal.fg));
                p.textSize(CONFIG.sizes.text.boxLabel);
                p.textAlign(p.CENTER, p.TOP);
                p.text(label, x + w / 2, y + 6);
            }
            p.pop();
        }

        drawVector(x, y, w, h, n, progress, values, colors) {
            const p = this.p;
            const pad = CONFIG.visual.padding.medium;
            const barWidth = (w - pad * (n + 1)) / n;
            const by = y + pad + 16;
            const barAreaH = h - (pad * 2 + 16);
            const rewardColors = colors || getRewardColors(p);

            for (let i = 0; i < n; i++) {
                const v = Array.isArray(values) && values.length > i
                    ? values[i]
                    : p.noise(i * 0.37 + progress * 2.1);
                const eased = Math.max(0, Math.min(1, v));
                const barH = barAreaH * eased;
                p.fill(rewardColors[i % rewardColors.length]);
                p.noStroke();
                p.rect(x + pad + i * (barWidth + pad), by + (barAreaH - barH), barWidth, barH, CONFIG.visual.borderRadius.small);
            }
        }

        drawRewardModels(x, y, w, h, n, alpha, isMobile) {
            const p = this.p;
            const rects = GeometryHelper.getRewardRowRects(x, y, w, h, n, isMobile);
            p.push();
            if (alpha != null && alpha < 1) p.drawingContext.globalAlpha = Math.max(0, alpha);

            for (let i = 0; i < rects.length; i++) {
                const r = rects[i];
                // Row/Column container
                p.noStroke();
                p.fill('rgba(255,255,255,0.03)');
                p.rect(r.x, r.y, r.w, r.h, CONFIG.visual.borderRadius.medium);
                // Border
                p.noFill();
                p.stroke('rgba(255,255,255,0.10)');
                p.strokeWeight(CONFIG.visual.strokeWeight.thin);
                p.rect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, CONFIG.visual.borderRadius.medium);
                // Label r_i
                p.noStroke();
                p.fill(p.color(this.pal.fg));
                if (isMobile) {
                    p.textAlign(p.CENTER, p.TOP);
                    p.textSize(CONFIG.sizes.text.rewardLabelMobile);
                    p.text('r' + subscriptFor(i), r.x + r.w / 2, r.y + 4);
                } else {
                    p.textAlign(p.LEFT, p.CENTER);
                    p.textSize(CONFIG.sizes.text.rewardLabel);
                    p.text('r' + subscriptFor(i), r.x + 8, r.y + r.h / 2);
                }
            }
            p.pop();
        }

        drawMiniInput(img, x, y, w, h, alpha, showCaption = true) {
            const p = this.p;
            p.push();
            if (alpha != null && alpha < 1) p.tint(255, 255 * Math.max(0, alpha));
            if (img) {
                p.image(img, x, y, w, h);
            } else {
                p.fill(230);
                p.noStroke();
                p.rect(x, y, w, h, CONFIG.visual.borderRadius.small);
            }
            p.pop();

            if (showCaption) {
                p.push();
                if (alpha != null && alpha < 1) p.drawingContext.globalAlpha = Math.max(0, alpha);
                p.fill('rgba(255,255,255,0.6)');
                p.textAlign(p.LEFT, p.TOP);
                p.textSize(Math.max(8, Math.min(CONFIG.sizes.text.miniPrompt, h * 0.28)));
                p.text(CONFIG.text.prompt, x, y + h + 2);
                p.pop();
            }
        }

        drawNoiseOver(img, imgX, imgY, imgW, imgH, alpha) {
            const p = this.p;
            if (!img || alpha <= 0) return;

            p.push();
            const noiseWeight = CONFIG.animation.noiseParams.maxWeight * alpha;
            const imageWeight = 1.0 - CONFIG.animation.noiseParams.maxWeight * alpha;

            p.loadPixels();
            if (img.width > 0) {
                const tempImg = p.get(imgX, imgY, imgW, imgH);
                tempImg.loadPixels();

                const stdDev = CONFIG.animation.noiseParams.stdDev;
                for (let i = 0; i < tempImg.pixels.length; i += 4) {
                    const noiseR = p.randomGaussian(0, stdDev);
                    const noiseG = p.randomGaussian(0, stdDev);
                    const noiseB = p.randomGaussian(0, stdDev);

                    tempImg.pixels[i] = p.constrain(imageWeight * tempImg.pixels[i] + noiseWeight * noiseR, 0, 255);
                    tempImg.pixels[i + 1] = p.constrain(imageWeight * tempImg.pixels[i + 1] + noiseWeight * noiseG, 0, 255);
                    tempImg.pixels[i + 2] = p.constrain(imageWeight * tempImg.pixels[i + 2] + noiseWeight * noiseB, 0, 255);
                }

                tempImg.updatePixels();
                p.image(tempImg, imgX, imgY, imgW, imgH);
            }
            p.pop();
        }

        drawCaptionBox(x, y, w, h, alpha) {
            const p = this.p;
            const scale = w / 100; // Normalize scale based on width

            p.push();
            if (alpha < 1) p.drawingContext.globalAlpha = alpha;

            const padding = CONFIG.visual.padding.medium * scale;
            const iconSize = CONFIG.sizes.text.icon * (h / 40);

            // Background box
            p.fill('rgba(255,255,255,0.03)');
            p.noStroke();
            p.rect(x - padding, y, w + padding * 2, h, CONFIG.visual.borderRadius.medium);

            // Border
            p.noFill();
            p.stroke('rgba(255,255,255,0.12)');
            p.strokeWeight(CONFIG.visual.strokeWeight.thin);
            p.rect(x - padding, y, w + padding * 2, h, CONFIG.visual.borderRadius.medium);

            // Quote icon
            p.fill(p.color(this.pal.muted));
            p.noStroke();
            p.textSize(iconSize);
            p.textAlign(p.LEFT, p.CENTER);
            p.textStyle(p.BOLD);
            p.text('❝', x - padding + 6, y + h / 2);

            // Caption label
            const labelSize = CONFIG.sizes.text.captionLabel * (h / 40);
            const textSize = CONFIG.sizes.text.captionText * (h / 40);
            const textX = x - padding + 20;
            const verticalSpacing = 7 * (h / 40);

            p.fill(p.color(this.pal.muted));
            p.textSize(labelSize);
            p.textStyle(p.NORMAL);
            p.textAlign(p.LEFT, p.CENTER);
            p.text('caption', textX, y + h / 2 - verticalSpacing);

            // Caption text
            p.fill(p.color(this.pal.fg));
            p.textSize(textSize);
            p.textStyle(p.ITALIC);
            p.text(CONFIG.text.caption, textX, y + h / 2 + verticalSpacing);

            p.pop();
        }
    }

    // ============================================================================
    // STAGE MANAGER
    // ============================================================================
    class StageManager {
        constructor(p) {
            this.p = p;
            this.timeline = CONFIG.timeline;
            this.totalMs = this.timeline.reduce((acc, [, d]) => acc + d, 0);
        }

        getStageAndProgress(elapsed) {
            const t = elapsed % this.totalMs;
            let acc = 0;
            for (const [name, dur] of this.timeline) {
                if (t < acc + dur) {
                    const prog = (t - acc) / dur;
                    return { name, prog };
                }
                acc += dur;
            }
            return { name: 'pause', prog: 0 };
        }

        getCycleIndex(elapsed) {
            return Math.floor(elapsed / this.totalMs);
        }

        generateScores(n, elapsed) {
            const cycle = this.getCycleIndex(elapsed);
            const arr = [];
            for (let i = 0; i < n; i++) {
                arr.push(this.p.noise(cycle * 97.123 + i * 17.77));
            }
            return arr;
        }
    }

    // ============================================================================
    // STAGE HANDLERS
    // ============================================================================

    class IntroStage {
        render(p, layout, renderer, prog, state) {
            const { imgLayout, capLayout } = layout;

            // Draw image
            if (state.img) {
                p.image(state.img, imgLayout.imgX, imgLayout.imgY, imgLayout.imgW, imgLayout.imgH);
            } else {
                p.fill(230);
                p.rect(imgLayout.imgX, imgLayout.imgY, imgLayout.imgW, imgLayout.imgH, 6);
            }

            // Draw caption
            renderer.drawCaptionBox(capLayout.capX, capLayout.capY, capLayout.capW, capLayout.capH, 1);
        }
    }

    class MoveToRewardsStage {
        render(p, layout, renderer, prog, state) {
            const { imgLayout, capLayout, rewardsLayout } = layout;
            const imgInRewardsScale = CONFIG.scaling.imgInRewards;
            const imgInRewardsW = imgLayout.imgW * imgInRewardsScale;
            const imgInRewardsH = imgLayout.imgH * imgInRewardsScale;
            const capInRewardsW = capLayout.capW * imgInRewardsScale;
            const capInRewardsH = capLayout.capH * imgInRewardsScale;
            const rewardsCenterX = rewardsLayout.rewardsX + rewardsLayout.rewardsW / 2 - imgInRewardsW / 2;
            const rewardsCenterY = rewardsLayout.rewardsY + 28;

            // Animated image position
            const imgX = lerp(imgLayout.imgX, rewardsCenterX, prog);
            const imgY = lerp(imgLayout.imgY, rewardsCenterY, prog);
            const imgW = lerp(imgLayout.imgW, imgInRewardsW, prog);
            const imgH = lerp(imgLayout.imgH, imgInRewardsH, prog);
            const imgAlpha = 1 - 0.5 * prog;

            // Draw image
            p.push();
            if (imgAlpha < 1) p.tint(255, 255 * imgAlpha);
            if (state.img) p.image(state.img, imgX, imgY, imgW, imgH);
            else { p.fill(230); p.rect(imgX, imgY, imgW, imgH, 6); }
            p.pop();

            // Animated caption position
            const capX = lerp(capLayout.capX, rewardsCenterX, prog);
            const capY = lerp(capLayout.capY, rewardsCenterY + imgInRewardsH + 6, prog);
            const capW = lerp(capLayout.capW, capInRewardsW, prog);
            const capH = lerp(capLayout.capH, capInRewardsH, prog);
            const capAlpha = 1 - 0.5 * prog;

            renderer.drawCaptionBox(capX, capY, capW, capH, capAlpha);

            // Rewards box
            renderer.drawBox(rewardsLayout.rewardsX, rewardsLayout.rewardsY, rewardsLayout.rewardsW, rewardsLayout.rewardsH, CONFIG.text.rewardsLabel);
            renderer.drawRewardModels(rewardsLayout.rewardsX, rewardsLayout.rewardsY, rewardsLayout.rewardsW, rewardsLayout.rewardsH, CONFIG.animation.numRewards, 1, layout.isMobile);

            // Mini inputs animating into reward rows
            this._drawMiniInputsAnimatingIn(p, layout, renderer, prog, state);
        }

        _drawMiniInputsAnimatingIn(p, layout, renderer, prog, state) {
            const { rewardsLayout, imgLayout } = layout;
            const rects = GeometryHelper.getRewardRowRects(rewardsLayout.rewardsX, rewardsLayout.rewardsY, rewardsLayout.rewardsW, rewardsLayout.rewardsH, CONFIG.animation.numRewards, layout.isMobile);

            for (let i = 0; i < CONFIG.animation.numRewards; i++) {
                const r = rects[i];
                let miniH, miniW, targetX, targetY;

                if (layout.isMobile) {
                    miniW = Math.min(r.w * CONFIG.sizes.rewards.miniInputScale, CONFIG.sizes.rewards.miniInputMaxMobile);
                    miniH = miniW * CONFIG.layout.mobile.imgAspectRatio;
                    targetX = r.x + r.w / 2 - miniW / 2;
                    targetY = r.y + CONFIG.sizes.rewards.miniInputTop;
                } else {
                    miniH = Math.min(r.h * CONFIG.sizes.rewards.miniInputScale, CONFIG.sizes.rewards.miniInputMaxDesktop);
                    miniW = miniH / CONFIG.layout.desktop.imgAspectRatio;
                    targetX = r.x + CONFIG.sizes.rewards.miniInputPadding;
                    targetY = r.y + r.h / 2 - miniH / 2;
                }

                const delay = i * CONFIG.animation.rowDelay;
                const localProg = Math.max(0, Math.min(1, (prog - delay) / (1 - delay)));

                let cx = targetX;
                let cy = targetY;

                if (layout.isMobile) {
                    const startY = rewardsLayout.rewardsY - miniH - 12;
                    cy = lerp(startY, targetY, localProg);
                } else {
                    const startX = rewardsLayout.rewardsX - miniW - 12;
                    cx = lerp(startX, targetX, localProg);
                }

                renderer.drawMiniInput(state.img, cx, cy, miniW, miniH, localProg, false);
            }
        }
    }

    class FanoutInputsStage {
        render(p, layout, renderer, prog, state) {
            const { imgLayout, capLayout, rewardsLayout } = layout;
            const imgInRewardsScale = CONFIG.scaling.imgInRewards;
            const imgSmallScale = imgInRewardsScale * CONFIG.scaling.imgSmallInRewards;
            const imgSmallW = imgLayout.imgW * imgSmallScale;
            const imgSmallH = imgLayout.imgH * imgSmallScale;
            const imgInRewardsW = imgLayout.imgW * imgInRewardsScale;
            const imgInRewardsH = imgLayout.imgH * imgInRewardsScale;
            const rewardsCenterX = rewardsLayout.rewardsX + rewardsLayout.rewardsW / 2 - imgInRewardsW / 2;
            const rewardsCenterY = rewardsLayout.rewardsY + 28;

            // Small center image
            const imgX = rewardsCenterX + (imgInRewardsW - imgSmallW) / 2;
            const imgY = rewardsCenterY + (imgInRewardsH - imgSmallH) / 2;

            if (state.img) p.image(state.img, imgX, imgY, imgSmallW, imgSmallH);
            else { p.fill(230); p.rect(imgX, imgY, imgSmallW, imgSmallH, 6); }

            // Rewards box
            renderer.drawBox(rewardsLayout.rewardsX, rewardsLayout.rewardsY, rewardsLayout.rewardsW, rewardsLayout.rewardsH, CONFIG.text.rewardsLabel);
            renderer.drawRewardModels(rewardsLayout.rewardsX, rewardsLayout.rewardsY, rewardsLayout.rewardsW, rewardsLayout.rewardsH, CONFIG.animation.numRewards, 1, layout.isMobile);

            // Mini inputs in rows (static)
            this._drawMiniInputsStatic(p, layout, renderer, state);
        }

        _drawMiniInputsStatic(p, layout, renderer, state) {
            const { rewardsLayout } = layout;
            const rects = GeometryHelper.getRewardRowRects(rewardsLayout.rewardsX, rewardsLayout.rewardsY, rewardsLayout.rewardsW, rewardsLayout.rewardsH, CONFIG.animation.numRewards, layout.isMobile);

            for (let i = 0; i < CONFIG.animation.numRewards; i++) {
                const r = rects[i];
                let miniH, miniW, x, y;

                if (layout.isMobile) {
                    miniW = Math.min(r.w * CONFIG.sizes.rewards.miniInputScale, CONFIG.sizes.rewards.miniInputMaxMobile);
                    miniH = miniW * CONFIG.layout.mobile.imgAspectRatio;
                    x = r.x + r.w / 2 - miniW / 2;
                    y = r.y + CONFIG.sizes.rewards.miniInputTop;
                } else {
                    miniH = Math.min(r.h * CONFIG.sizes.rewards.miniInputScale, CONFIG.sizes.rewards.miniInputMaxDesktop);
                    miniW = miniH / CONFIG.layout.desktop.imgAspectRatio;
                    x = r.x + CONFIG.sizes.rewards.miniInputPadding;
                    y = r.y + r.h / 2 - miniH / 2;
                }

                renderer.drawMiniInput(state.img, x, y, miniW, miniH, 1, false);
            }
        }
    }

    class EmitScoresStage {
        render(p, layout, renderer, prog, state) {
            const { imgLayout, rewardsLayout } = layout;

            // Small center image (fading)
            const imgInRewardsScale = CONFIG.scaling.imgInRewards;
            const imgSmallScale = imgInRewardsScale * CONFIG.scaling.imgSmallInRewards;
            const imgSmallW = imgLayout.imgW * imgSmallScale;
            const imgSmallH = imgLayout.imgH * imgSmallScale;
            const imgInRewardsW = imgLayout.imgW * imgInRewardsScale;
            const imgInRewardsH = imgLayout.imgH * imgInRewardsScale;
            const rewardsCenterX = rewardsLayout.rewardsX + rewardsLayout.rewardsW / 2 - imgInRewardsW / 2;
            const rewardsCenterY = rewardsLayout.rewardsY + 28;
            const imgX = rewardsCenterX + (imgInRewardsW - imgSmallW) / 2;
            const imgY = rewardsCenterY + (imgInRewardsH - imgSmallH) / 2;

            p.push();
            p.tint(255, 255 * 0.6);
            if (state.img) p.image(state.img, imgX, imgY, imgSmallW, imgSmallH);
            p.pop();

            // Rewards box
            renderer.drawBox(rewardsLayout.rewardsX, rewardsLayout.rewardsY, rewardsLayout.rewardsW, rewardsLayout.rewardsH, CONFIG.text.rewardsLabel);
            renderer.drawRewardModels(rewardsLayout.rewardsX, rewardsLayout.rewardsY, rewardsLayout.rewardsW, rewardsLayout.rewardsH, CONFIG.animation.numRewards, 1, layout.isMobile);

            // Morphing mini inputs
            this._drawMorphingInputs(p, layout, renderer, prog, state);

            // Score vector box (emerging)
            this._drawEmergingVector(p, layout, renderer, prog, state);

            // Numeric scores appearing
            this._drawNumericScores(p, layout, renderer, prog, state);
        }

        _drawMorphingInputs(p, layout, renderer, prog, state) {
            const { rewardsLayout } = layout;
            const rects = GeometryHelper.getRewardRowRects(rewardsLayout.rewardsX, rewardsLayout.rewardsY, rewardsLayout.rewardsW, rewardsLayout.rewardsH, CONFIG.animation.numRewards, layout.isMobile);
            const rewardColors = getRewardColors(p);

            for (let i = 0; i < CONFIG.animation.numRewards; i++) {
                const r = rects[i];
                const rowDelay = i * CONFIG.animation.rowDelay;
                const pRow = Math.max(0, Math.min(1, (prog - rowDelay) / (1 - rowDelay)));
                const pMorph = Math.max(0, Math.min(1, pRow / CONFIG.animation.morphEnd));

                let miniH, miniW, xStartTopLeft, yStartTopLeft, xEndCenter, yEndCenter;

                if (layout.isMobile) {
                    miniW = Math.min(r.w * CONFIG.sizes.rewards.miniInputScale, CONFIG.sizes.rewards.miniInputMaxMobile);
                    miniH = miniW * CONFIG.layout.mobile.imgAspectRatio;
                    xStartTopLeft = r.x + r.w / 2 - miniW / 2;
                    yStartTopLeft = r.y + CONFIG.sizes.rewards.miniInputTop;
                    xEndCenter = r.x + r.w / 2;
                    yEndCenter = r.y + r.h - 16;
                } else {
                    miniH = Math.min(r.h * CONFIG.sizes.rewards.miniInputScale, CONFIG.sizes.rewards.miniInputMaxDesktop);
                    miniW = miniH / CONFIG.layout.desktop.imgAspectRatio;
                    xStartTopLeft = r.x + CONFIG.sizes.rewards.miniInputPadding;
                    yStartTopLeft = r.y + r.h / 2 - miniH / 2;
                    xEndCenter = r.x + r.w - 16;
                    yEndCenter = r.y + r.h / 2;
                }

                const xStartCenter = xStartTopLeft + miniW / 2;
                const yStartCenter = yStartTopLeft + miniH / 2;
                const cxCenter = lerp(xStartCenter, xEndCenter, pMorph);
                const cyCenter = lerp(yStartCenter, yEndCenter, pMorph);

                // Shrinking image
                const rectW = lerp(miniW, miniW * CONFIG.sizes.dot.morphMinScale, pMorph);
                const rectH = lerp(miniH, miniH * CONFIG.sizes.dot.morphMinScale, pMorph);
                renderer.drawMiniInput(state.img, cxCenter - rectW / 2, cyCenter - rectH / 2, rectW, rectH, 1, false);

                // Growing dot
                if (pMorph > 0.01) {
                    p.push();
                    p.noStroke();
                    p.fill(rewardColors[i % rewardColors.length]);
                    p.drawingContext.globalAlpha = pMorph;
                    const dotR = lerp(0, CONFIG.sizes.dot.radius, pMorph);
                    p.circle(cxCenter, cyCenter, Math.max(1, dotR));
                    p.pop();
                }
            }
        }

        _drawEmergingVector(p, layout, renderer, prog, state) {
            const { rewardsLayout, leftVecLayout } = layout;
            const startX = rewardsLayout.rewardsX + rewardsLayout.rewardsW / 2 - leftVecLayout.leftVecW / 2;
            const startY = rewardsLayout.rewardsY + rewardsLayout.rewardsH / 2 - leftVecLayout.leftVecH / 2;
            const vecX = lerp(startX, leftVecLayout.leftVecX, prog);
            const vecY = lerp(startY, leftVecLayout.leftVecY, prog);

            p.push();
            p.drawingContext.globalAlpha = prog;
            renderer.drawBox(vecX, vecY, leftVecLayout.leftVecW, leftVecLayout.leftVecH, CONFIG.text.scoresLabel);
            // Bars stay empty during this stage
            renderer.drawVector(vecX, vecY, leftVecLayout.leftVecW, leftVecLayout.leftVecH, CONFIG.animation.numRewards, 0, new Array(CONFIG.animation.numRewards).fill(0), getRewardColors(p));
            p.pop();
        }

        _drawNumericScores(p, layout, renderer, prog, state) {
            const { rewardsLayout } = layout;
            const rects = GeometryHelper.getRewardRowRects(rewardsLayout.rewardsX, rewardsLayout.rewardsY, rewardsLayout.rewardsW, rewardsLayout.rewardsH, CONFIG.animation.numRewards, layout.isMobile);
            const vals = state.scores;
            const rewardColors = getRewardColors(p);

            // Label position
            let vecLabelX, vecLabelY, vecLabelAlign;
            if (layout.isMobile) {
                vecLabelX = rewardsLayout.rewardsX + rewardsLayout.rewardsW / 2;
                vecLabelY = rewardsLayout.rewardsY + rewardsLayout.rewardsH + 8;
                vecLabelAlign = p.CENTER;
            } else {
                vecLabelX = rewardsLayout.rewardsX + rewardsLayout.rewardsW + 18;
                vecLabelY = rewardsLayout.rewardsY - 6;
                vecLabelAlign = p.LEFT;
            }

            p.push();
            p.fill('rgba(255,255,255,0.7)');
            p.textAlign(vecLabelAlign, p.BOTTOM);
            p.textSize(CONFIG.sizes.text.legend);
            p.text(CONFIG.text.scoresVector, vecLabelX, vecLabelY);
            p.pop();

            for (let i = 0; i < CONFIG.animation.numRewards; i++) {
                const r = rects[i];
                const delay = i * CONFIG.animation.rowDelay;
                const pRow = Math.max(0, Math.min(1, (prog - delay) / (1 - delay)));
                const appear = Math.max(0, Math.min(1, (pRow - CONFIG.animation.vecStart) / (1 - CONFIG.animation.vecStart)));
                const value = Math.round(vals[i] * 100) / 100;

                let vx, vy, startX, startY;
                if (layout.isMobile) {
                    vx = r.x + r.w / 2;
                    vy = rewardsLayout.rewardsY + rewardsLayout.rewardsH + 18;
                    startX = r.x + r.w / 2;
                    startY = r.y + r.h - 16;
                } else {
                    vx = rewardsLayout.rewardsX + rewardsLayout.rewardsW + 20;
                    vy = r.y + r.h / 2;
                    startX = r.x + r.w - 16;
                    startY = r.y + r.h / 2;
                }

                if (appear > 0) {
                    const cx = lerp(startX, vx - 10, appear);
                    const cy = lerp(startY, vy, appear);

                    // Fading dot
                    p.push();
                    p.noStroke();
                    p.drawingContext.globalAlpha = 1 - appear;
                    p.fill(rewardColors[i % rewardColors.length]);
                    p.circle(cx, cy, CONFIG.sizes.dot.radius);
                    p.pop();

                    // Value fading in
                    p.push();
                    p.fill('rgba(255,255,255,0.95)');
                    p.textAlign(p.CENTER, p.CENTER);
                    p.drawingContext.globalAlpha = appear;
                    p.textSize(layout.isMobile ? CONFIG.sizes.text.scoreValueMobile : CONFIG.sizes.text.scoreValue);
                    p.text(value.toFixed(2), vx, vy);
                    p.pop();
                }
            }
        }
    }

    class RewardsDisappearStage {
        render(p, layout, renderer, prog, state) {
            const { rewardsLayout, leftVecLayout } = layout;

            // Rewards box fading
            p.push();
            p.drawingContext.globalAlpha = 1 - prog;
            renderer.drawBox(rewardsLayout.rewardsX, rewardsLayout.rewardsY, rewardsLayout.rewardsW, rewardsLayout.rewardsH, CONFIG.text.rewardsLabel);
            renderer.drawRewardModels(rewardsLayout.rewardsX, rewardsLayout.rewardsY, rewardsLayout.rewardsW, rewardsLayout.rewardsH, CONFIG.animation.numRewards, 1 - prog, layout.isMobile);
            p.pop();

            // Score vector box
            renderer.drawBox(leftVecLayout.leftVecX, leftVecLayout.leftVecY, leftVecLayout.leftVecW, leftVecLayout.leftVecH, CONFIG.text.scoresLabel);

            // Bars filling as dots arrive
            const vals = state.scores;
            const valuesForDraw = vals.map(v => v * prog);
            renderer.drawVector(leftVecLayout.leftVecX, leftVecLayout.leftVecY, leftVecLayout.leftVecW, leftVecLayout.leftVecH, CONFIG.animation.numRewards, 0, valuesForDraw, getRewardColors(p));

            // Dots traveling to histogram
            this._drawDotsToHistogram(p, layout, renderer, prog, state);
        }

        _drawDotsToHistogram(p, layout, renderer, prog, state) {
            const { rewardsLayout, leftVecLayout } = layout;
            const rects = GeometryHelper.getRewardRowRects(rewardsLayout.rewardsX, rewardsLayout.rewardsY, rewardsLayout.rewardsW, rewardsLayout.rewardsH, CONFIG.animation.numRewards, layout.isMobile);
            const vals = state.scores;
            const hist = GeometryHelper.getHistogramGeom(leftVecLayout.leftVecX, leftVecLayout.leftVecY, leftVecLayout.leftVecW, leftVecLayout.leftVecH, CONFIG.animation.numRewards);
            const rewardColors = getRewardColors(p);

            for (let i = 0; i < CONFIG.animation.numRewards; i++) {
                const r = rects[i];
                const value = Math.round(vals[i] * 100) / 100;

                let startX, startY;
                if (layout.isMobile) {
                    startX = r.x + r.w / 2;
                    startY = rewardsLayout.rewardsY + rewardsLayout.rewardsH + 18;
                } else {
                    startX = rewardsLayout.rewardsX + rewardsLayout.rewardsW + 20;
                    startY = r.y + r.h / 2;
                }

                const endX = hist.slots[i].x + hist.barWidth / 2;
                const endY = hist.by + hist.barAreaH - 6;

                const cx = lerp(startX, endX, prog);
                const cy = lerp(startY, endY, prog);

                // Dot
                p.push();
                p.noStroke();
                p.fill(rewardColors[i % rewardColors.length]);
                p.circle(cx, cy, CONFIG.sizes.dot.radius);
                p.pop();

                // Numeric value fading out
                p.push();
                p.fill('rgba(255,255,255,0.95)');
                p.textAlign(p.CENTER, p.CENTER);
                p.drawingContext.globalAlpha = 1 - prog;
                p.textSize(layout.isMobile ? CONFIG.sizes.text.scoreValueMobile : CONFIG.sizes.text.scoreValue);
                p.text(value.toFixed(2), startX, startY);
                p.pop();
            }
        }
    }

    class ScoresBackStage {
        render(p, layout, renderer, prog, state) {
            const { imgLayout, capLayout, leftVecLayout } = layout;

            // Image and caption fading in
            const alpha = Math.min(1, prog * 1.2);

            p.push();
            if (alpha < 1) p.tint(255, 255 * alpha);
            if (state.img) p.image(state.img, imgLayout.imgX, imgLayout.imgY, imgLayout.imgW, imgLayout.imgH);
            else { p.fill(230); p.rect(imgLayout.imgX, imgLayout.imgY, imgLayout.imgW, imgLayout.imgH, 6); }
            p.pop();

            renderer.drawCaptionBox(capLayout.capX, capLayout.capY, capLayout.capW, capLayout.capH, alpha);

            // Score vector box (static, filled)
            renderer.drawBox(leftVecLayout.leftVecX, leftVecLayout.leftVecY, leftVecLayout.leftVecW, leftVecLayout.leftVecH, CONFIG.text.scoresLabel);
            renderer.drawVector(leftVecLayout.leftVecX, leftVecLayout.leftVecY, leftVecLayout.leftVecW, leftVecLayout.leftVecH, CONFIG.animation.numRewards, 0, state.scores, getRewardColors(p));
        }
    }

    class NoiseInputStage {
        render(p, layout, renderer, prog, state) {
            const { imgLayout, capLayout, leftVecLayout } = layout;

            // Image with noise
            if (state.img) p.image(state.img, imgLayout.imgX, imgLayout.imgY, imgLayout.imgW, imgLayout.imgH);
            else { p.fill(230); p.rect(imgLayout.imgX, imgLayout.imgY, imgLayout.imgW, imgLayout.imgH, 6); }
            renderer.drawNoiseOver(state.img, imgLayout.imgX, imgLayout.imgY, imgLayout.imgW, imgLayout.imgH, prog);

            // Caption
            renderer.drawCaptionBox(capLayout.capX, capLayout.capY, capLayout.capW, capLayout.capH, 1);

            // Score vector
            renderer.drawBox(leftVecLayout.leftVecX, leftVecLayout.leftVecY, leftVecLayout.leftVecW, leftVecLayout.leftVecH, CONFIG.text.scoresLabel);
            renderer.drawVector(leftVecLayout.leftVecX, leftVecLayout.leftVecY, leftVecLayout.leftVecW, leftVecLayout.leftVecH, CONFIG.animation.numRewards, 0, state.scores, getRewardColors(p));
        }
    }

    class DenoiserAppearStage {
        render(p, layout, renderer, prog, state) {
            const { imgLayout, capLayout, leftVecLayout, modelLayout } = layout;

            // Image with full noise
            if (state.img) p.image(state.img, imgLayout.imgX, imgLayout.imgY, imgLayout.imgW, imgLayout.imgH);
            else { p.fill(230); p.rect(imgLayout.imgX, imgLayout.imgY, imgLayout.imgW, imgLayout.imgH, 6); }
            renderer.drawNoiseOver(state.img, imgLayout.imgX, imgLayout.imgY, imgLayout.imgW, imgLayout.imgH, 1);

            // Caption
            renderer.drawCaptionBox(capLayout.capX, capLayout.capY, capLayout.capW, capLayout.capH, 1);

            // Score vector
            renderer.drawBox(leftVecLayout.leftVecX, leftVecLayout.leftVecY, leftVecLayout.leftVecW, leftVecLayout.leftVecH, CONFIG.text.scoresLabel);
            renderer.drawVector(leftVecLayout.leftVecX, leftVecLayout.leftVecY, leftVecLayout.leftVecW, leftVecLayout.leftVecH, CONFIG.animation.numRewards, 0, state.scores, getRewardColors(p));

            // Model box appearing
            p.push();
            p.drawingContext.globalAlpha = prog;
            renderer.drawBox(modelLayout.modelX, modelLayout.modelY, modelLayout.modelW, modelLayout.modelH, CONFIG.text.modelName, true);
            p.pop();
        }
    }

    class ToDenoiserStage {
        render(p, layout, renderer, prog, state) {
            const { imgLayout, capLayout, leftVecLayout, modelLayout } = layout;

            // Image and caption moving into model and fading
            const imgInModelScale = CONFIG.scaling.imgInModel;
            const imgInModelW = imgLayout.imgW * imgInModelScale;
            const imgInModelH = imgLayout.imgH * imgInModelScale;
            const capInModelW = capLayout.capW * imgInModelScale;
            const capInModelH = capLayout.capH * imgInModelScale;
            const targetX = modelLayout.modelX + modelLayout.modelW / 2 - imgInModelW / 2;
            const targetY = modelLayout.modelY + 30;

            const imgX = lerp(imgLayout.imgX, targetX, prog);
            const imgY = lerp(imgLayout.imgY, targetY, prog);
            const imgW = lerp(imgLayout.imgW, imgInModelW, prog);
            const imgH = lerp(imgLayout.imgH, imgInModelH, prog);
            const imgAlpha = 1 - prog;

            p.push();
            if (imgAlpha < 1) p.tint(255, 255 * imgAlpha);
            if (state.img) p.image(state.img, imgX, imgY, imgW, imgH);
            else { p.fill(230); p.rect(imgX, imgY, imgW, imgH, 6); }
            p.pop();

            renderer.drawNoiseOver(state.img, imgX, imgY, imgW, imgH, 1);

            const capX = lerp(capLayout.capX, targetX, prog);
            const capY = lerp(capLayout.capY, targetY + imgInModelH + 6, prog);
            const capW = lerp(capLayout.capW, capInModelW, prog);
            const capH = lerp(capLayout.capH, capInModelH, prog);
            renderer.drawCaptionBox(capX, capY, capW, capH, imgAlpha);

            // Score vector moving into model and fading
            const targetVecX = modelLayout.modelX + modelLayout.modelW / 2 - leftVecLayout.leftVecW / 2;
            const targetVecY = modelLayout.modelY + modelLayout.modelH / 2 - leftVecLayout.leftVecH / 2;
            const vecX = lerp(leftVecLayout.leftVecX, targetVecX, prog);
            const vecY = lerp(leftVecLayout.leftVecY, targetVecY, prog);
            const vecAlpha = 1 - prog;

            p.push();
            p.drawingContext.globalAlpha = vecAlpha;
            renderer.drawBox(vecX, vecY, leftVecLayout.leftVecW, leftVecLayout.leftVecH, CONFIG.text.scoresLabel);
            renderer.drawVector(vecX, vecY, leftVecLayout.leftVecW, leftVecLayout.leftVecH, CONFIG.animation.numRewards, 0, state.scores, getRewardColors(p));
            p.pop();

            // Model box
            renderer.drawBox(modelLayout.modelX, modelLayout.modelY, modelLayout.modelW, modelLayout.modelH, CONFIG.text.modelName, true);
        }
    }

    class CleanOutputStage {
        render(p, layout, renderer, prog, state) {
            const { imgLayout, modelLayout, outputLayout } = layout;

            // Model box
            renderer.drawBox(modelLayout.modelX, modelLayout.modelY, modelLayout.modelW, modelLayout.modelH, CONFIG.text.modelName, true);

            // Output emerging from model
            const startX = modelLayout.modelX + modelLayout.modelW / 2 - imgLayout.imgW / 2;
            const startY = modelLayout.modelY + modelLayout.modelH / 2 - imgLayout.imgH / 2;
            const currentX = lerp(startX, outputLayout.outX, prog);
            const currentY = lerp(startY, outputLayout.outY, prog);

            p.push();
            if (prog < 1) p.tint(255, 255 * prog);
            if (state.img) p.image(state.img, currentX, currentY, imgLayout.imgW, imgLayout.imgH);
            else { p.fill(230); p.rect(currentX, currentY, imgLayout.imgW, imgLayout.imgH, 6); }
            p.pop();
        }
    }

    class PauseStage {
        render(p, layout, renderer, prog, state) {
            const { imgLayout, modelLayout, outputLayout } = layout;

            // Model box
            renderer.drawBox(modelLayout.modelX, modelLayout.modelY, modelLayout.modelW, modelLayout.modelH, CONFIG.text.modelName, true);

            // Output image (clean)
            if (state.img) p.image(state.img, outputLayout.outX, outputLayout.outY, imgLayout.imgW, imgLayout.imgH);
            else { p.fill(230); p.rect(outputLayout.outX, outputLayout.outY, imgLayout.imgW, imgLayout.imgH, 6); }

            // Legend
            p.fill(p.color(renderer.pal.muted));
            p.textAlign(p.CENTER, p.TOP);
            p.textSize(CONFIG.sizes.text.legend);
            const labelY = layout.isMobile ? outputLayout.outY - 18 : outputLayout.outY - 22;
            p.text(CONFIG.text.denoisedImage, outputLayout.outX + imgLayout.imgW / 2, labelY);
        }
    }

    // ============================================================================
    // MAIN P5 SKETCH
    // ============================================================================
    const sketch = (p) => {
        let img, t0 = 0, playing = false;
        let renderer, stageManager;
        let stageHandlers = {};

        p.preload = () => {
            img = p.loadImage(CONFIG.images.primary, undefined, () => {
                img = p.loadImage(CONFIG.images.fallback);
            });
        };

        p.setup = () => {
            const parent = p.select('#miroAnimation');
            const parentW = parent.elt.clientWidth || 960;
            const isMobile = parentW < CONFIG.visual.mobileBreakpoint;

            let w, h;
            if (isMobile) {
                w = parentW;
                h = Math.max(CONFIG.layout.mobile.canvas.minHeight, parentW * CONFIG.layout.mobile.canvas.heightMultiplier);
            } else {
                const M = CONFIG.layout.desktop.margin;
                const imgW = Math.min(parentW * CONFIG.layout.desktop.imgScale, CONFIG.layout.desktop.maxImgWidth);
                const modelW = Math.max(CONFIG.layout.desktop.modelMinWidth, parentW * CONFIG.layout.desktop.modelScale);
                const contentWidth = M + imgW + 60 + modelW + 60 + imgW + M;
                w = Math.min(contentWidth, parentW);
                h = Math.max(CONFIG.layout.desktop.canvas.minHeight, Math.round(w * CONFIG.layout.desktop.canvas.heightMultiplier));
            }

            const canvas = p.createCanvas(w, h);
            canvas.style('display', 'block');
            canvas.style('margin', '0 auto');
            parent.elt.insertBefore(canvas.elt, parent.elt.firstChild);
            p.pixelDensity(CONFIG.visual.pixelDensity);

            // Initialize renderer and managers
            renderer = new Renderer(p);
            stageManager = new StageManager(p);

            // Initialize stage handlers
            stageHandlers = {
                'intro': new IntroStage(),
                'move_to_rewards': new MoveToRewardsStage(),
                'fanout_inputs': new FanoutInputsStage(),
                'emit_scores': new EmitScoresStage(),
                'rewards_disappear': new RewardsDisappearStage(),
                'scores_back': new ScoresBackStage(),
                'noise_input': new NoiseInputStage(),
                'denoiser_appear': new DenoiserAppearStage(),
                'to_denoiser': new ToDenoiserStage(),
                'clean_output': new CleanOutputStage(),
                'pause': new PauseStage()
            };

            // Intersection observer
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && entry.intersectionRatio >= CONFIG.animation.intersectionThreshold) {
                        t0 = p.millis();
                        playing = true;
                    } else {
                        playing = false;
                    }
                });
            }, { threshold: CONFIG.animation.intersectionThreshold });

            observer.observe(canvas.elt);

            // Click to toggle
            parent.elt.addEventListener('click', () => {
                playing = !playing;
                if (playing) {
                    t0 = p.millis() - (p.millis() - t0) % stageManager.totalMs;
                }
            });
        };

        p.windowResized = () => {
            const parent = p.select('#miroAnimation');
            const parentW = parent.elt.clientWidth || 960;
            const isMobile = parentW < CONFIG.visual.mobileBreakpoint;

            let w, h;
            if (isMobile) {
                w = parentW;
                h = Math.max(CONFIG.layout.mobile.canvas.minHeight, parentW * CONFIG.layout.mobile.canvas.heightMultiplier);
            } else {
                const M = CONFIG.layout.desktop.margin;
                const imgW = Math.min(parentW * CONFIG.layout.desktop.imgScale, CONFIG.layout.desktop.maxImgWidth);
                const modelW = Math.max(CONFIG.layout.desktop.modelMinWidth, parentW * CONFIG.layout.desktop.modelScale);
                const contentWidth = M + imgW + 60 + modelW + 60 + imgW + M;
                w = Math.min(contentWidth, parentW);
                h = Math.max(CONFIG.layout.desktop.canvas.minHeight, Math.round(w * CONFIG.layout.desktop.canvas.heightMultiplier));
            }

            p.resizeCanvas(w, h);
        };

        p.draw = () => {
            if (!playing) return;
            p.clear();

            const elapsed = p.millis() - t0;
            const { name: stageName, prog: rawProg } = stageManager.getStageAndProgress(elapsed);
            const prog = CONFIG.animation.easing.inOut(rawProg);
            const isMobile = p.width < CONFIG.visual.mobileBreakpoint;

            // Update palette and create layout
            renderer.updatePalette();
            const layoutCalc = new LayoutCalculator(p.width, p.height, isMobile);

            const imgLayout = layoutCalc.getImageLayout();
            const capLayout = layoutCalc.getCaptionLayout(imgLayout);
            const rewardsLayout = layoutCalc.getRewardsLayout(imgLayout, capLayout);
            const vectorLayout = layoutCalc.getVectorLayout(rewardsLayout, imgLayout);
            const modelLayout = layoutCalc.getModelLayout(vectorLayout, imgLayout, rewardsLayout);
            const outputLayout = layoutCalc.getOutputLayout(modelLayout, imgLayout);
            const leftVecLayout = layoutCalc.getLeftVectorLayout(imgLayout, vectorLayout);

            const layout = {
                isMobile,
                imgLayout,
                capLayout,
                rewardsLayout,
                vectorLayout,
                modelLayout,
                outputLayout,
                leftVecLayout
            };

            // Prepare state
            const scores = stageManager.generateScores(CONFIG.animation.numRewards, elapsed);
            const state = { img, scores };

            // Render current stage
            const handler = stageHandlers[stageName];
            if (handler) {
                handler.render(p, layout, renderer, prog, state);
            }

            // Render phase labels
            renderPhaseLabel(p, stageName, prog, isMobile, renderer.pal);
        };

        function renderPhaseLabel(p, stageName, prog, isMobile, pal) {
            p.push();
            p.textAlign(p.CENTER, p.TOP);
            p.textStyle(p.BOLD);
            const phaseLabelY = isMobile ? 5 : 10;
            const textSize = isMobile ? CONFIG.sizes.text.phaseLabelMobile : CONFIG.sizes.text.phaseLabel;

            let alpha = 0;
            let labelText = '';

            if (stageName === 'intro' || stageName === 'move_to_rewards' || stageName === 'fanout_inputs' || stageName === 'emit_scores' || stageName === 'rewards_disappear') {
                labelText = CONFIG.text.phaseLabels.scoring;
                if (stageName === 'intro') alpha = Math.min(1, prog * 2);
                else if (stageName === 'rewards_disappear') alpha = 1 - prog;
                else alpha = 1;
            } else if (stageName === 'scores_back' || stageName === 'noise_input' || stageName === 'denoiser_appear' || stageName === 'to_denoiser' || stageName === 'clean_output' || stageName === 'pause') {
                labelText = CONFIG.text.phaseLabels.training;
                if (stageName === 'scores_back') alpha = Math.min(1, prog * 2);
                else alpha = 1;
            }

            if (alpha > 0 && labelText) {
                p.drawingContext.globalAlpha = alpha;
                p.fill(p.color(pal.fg));
                p.textSize(textSize);
                p.text(labelText, p.width / 2, phaseLabelY);
            }

            p.pop();
        }
    };

    new p5(sketch, document.getElementById('miroAnimation'));
})();
