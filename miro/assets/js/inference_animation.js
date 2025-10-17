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
                small: 6,
                medium: 8,
                large: 10,
                xlarge: 12
            },
            padding: {
                small: 6,
                medium: 8,
                large: 12,
                xlarge: 20
            },
            strokeWeight: {
                thin: 1,
                normal: 1.5,
                thick: 2,
                xthick: 2.5,
                xxthick: 3
            }
        },

        // Image paths
        images: {
            input: 'assets/images/inference_pipeline_animation/previous_aesthetics.jpg',
            highAesthetics: 'assets/images/inference_pipeline_animation/high_aesthetics.jpg',
            lowAesthetics: 'assets/images/inference_pipeline_animation/low_aesthetic.jpg',
            final: 'assets/images/inference_pipeline_animation/next_aesthetics.jpg'
        },

        // Text content
        text: {
            caption: '"a scenic volcano"',
            modelName: 'MIRO',
            guidedOutput: 'Guided Output',
            finalTitle: '✓ Guided Denoising Step',
            phaseLabels: {
                computeHigh: 'Computing the velocity for high scores',
                computeLow: 'Computing the velocity for low scores',
                computeGuidance: 'Computing the higher reward guidance direction',
                updateVelocity: 'Updating the next step velocity'
            }
        },

        // KaTeX formulas
        formulas: {
            highRewardOut: 'v_\\theta(x_t, c, \\hat{\\mathbf{s}}^{+})',
            lowRewardOut: 'v_\\theta(x_t, c, \\hat{\\mathbf{s}}^{-})',
            guidanceVec: 'v_\\theta(\\hat{\\mathbf{s}}^{+}) - v_\\theta(\\hat{\\mathbf{s}}^{-})',
            guidanceFormula: '\\hat{v}_\\theta = v_\\theta(\\hat{\\mathbf{s}}^{+}) + \\omega (v_\\theta(\\hat{\\mathbf{s}}^{+}) - v_\\theta(\\hat{\\mathbf{s}}^{-}))',
            sPlus: '\\hat{\\mathbf{s}}^{+}',
            sMinus: '\\hat{\\mathbf{s}}^{-}'
        },

        // Timeline (stage name, duration in ms)
        timeline: [
            ['stage_0_s_plus_input', 300],
            ['stage_0_s_minus_input', 300],
            ['stage_0_img_caption_input', 300],
            ['stage_1_s_plus_to_model', 1500],
            ['stage_2_processing_s_plus', 1500],
            ['stage_3_high_output', 1000],
            ['stage_4_s_minus_to_model', 1500],
            ['stage_5_processing_s_minus', 1500],
            ['stage_6_low_output', 1000],
            ['stage_7_pause', 1000],
            ['stage_8_visualize_subtraction', 2500],
            ['stage_9_apply_guidance', 3000],
            ['stage_10_final', 1500],
            ['stage_11_pause', 5000]
        ],

        // Animation parameters
        animation: {
            numRewards: 7,
            intersectionThreshold: 0.35,
            noiseParams: {
                stdDev: 80,
                maxWeight: 0.4
            },
            easing: {
                // Cubic ease-in-out
                inOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
            }
        },

        // Layout parameters
        layout: {
            mobile: {
                imgScale: 0.35,
                captionScale: 0.7,
                sVectorScale: 0.45,
                modelScale: 0.6,
                startY: 40,
                spacing: {
                    imgToCaption: 15,
                    captionToVector: 15,
                    vectorToModel: 50,
                    modelToOutput: 50,
                    betweenOutputs: 70
                },
                canvas: {
                    heightMultiplier: 3.0,
                    minHeight: 500
                },
                guidance: {
                    scale: 0.7,
                    margin: 10,
                    startY: 60,
                    labelSpace: 50,
                    elementSpacing8: 50,
                    spacing9Top: 70,
                    spacing9Bottom: 80
                },
                finalPosition: {
                    centerOffset: -60
                }
            },
            desktop: {
                canvasWidth: 1200,
                canvasHeightRatio: 0.4,
                minHeight: 450,
                modelSize: { w: 180, h: 140 },
                imgSize: 100,
                inputX: 0.15,
                startY: 0.2,
                captionSpacing: 12,
                sVectorSize: { w: 110, h: 50 },
                sVectorSpacing: 15,
                outputOffset: { x: 30, y: 35 },
                guidance: {
                    scale: 0.8,
                    margin: 20
                }
            }
        },

        // Size parameters for drawing elements
        sizes: {
            text: {
                modelName: 22,
                phaseLabel: 16,
                phaseLabelMobile: 13,
                label: 11,
                captionLabel: 9,
                captionText: 11,
                icon: 12,
                guidanceLabel: 10,
                operatorSign: 32,
                plusSign: 24,
                omega: 15,
                finalTitle: 14
            },
            effects: {
                glowRadius: 20,
                glowBlur: 25,
                arrowGlowBlur: 15,
                shadowBlur: 20,
                processingMaxRadius: 25,
                processingStartRadius: 10
            },
            operators: {
                minusCircle: 40,
                plusCircle: 35,
                omegaPill: { w: 36, h: 20 }
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
            fg: s.getPropertyValue('--fg').trim(),
            card: s.getPropertyValue('--card').trim(),
            accent: s.getPropertyValue('--accent').trim(),
            muted: s.getPropertyValue('--muted').trim(),
            green: '#69c869',
            red: '#ff6978'
        };
    }

    function getRewardColors() {
        const pal = getPalette();
        return [pal.green, pal.accent, pal.red, '#6496ff', '#ff96c8', '#4fd2c8', '#c769e6'];
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

        getInputLayout() {
            if (this.isMobile) {
                const imgW = this.W * this.config.imgScale;
                const imgH = imgW;
                const inputX = this.W / 2;
                const imgY = this.config.startY;
                const captionW = this.W * this.config.captionScale;
                const captionH = 40;
                const captionY = imgY + imgH + this.config.spacing.imgToCaption;

                return {
                    inputX, imgY, imgW, imgH,
                    captionW, captionH, captionY
                };
            } else {
                const imgW = this.config.imgSize;
                const imgH = imgW;
                const inputX = this.W * this.config.inputX;
                const imgY = this.H * this.config.startY;
                const captionW = imgW;
                const captionH = 40;
                const captionY = imgY + imgH + this.config.captionSpacing;

                return {
                    inputX, imgY, imgW, imgH,
                    captionW, captionH, captionY
                };
            }
        }

        getSVectorLayout(inputLayout) {
            if (this.isMobile) {
                const sW = this.W * this.config.sVectorScale;
                const sH = 50;
                const sY = inputLayout.captionY + inputLayout.captionH + this.config.spacing.captionToVector;
                const sPlusX = inputLayout.inputX - sW / 2;
                const sPlusY = sY;
                const sMinusX = sPlusX;
                const sMinusY = sY;

                return { sW, sH, sY, sPlusX, sPlusY, sMinusX, sMinusY };
            } else {
                const sW = this.config.sVectorSize.w;
                const sH = this.config.sVectorSize.h;
                const sY = inputLayout.captionY + inputLayout.captionH + this.config.sVectorSpacing;
                const sPlusX = inputLayout.inputX - sW / 2;
                const sPlusY = sY;
                const sMinusX = sPlusX;
                const sMinusY = sY;

                return { sW, sH, sY, sPlusX, sPlusY, sMinusX, sMinusY };
            }
        }

        getModelLayout(sVectorLayout) {
            if (this.isMobile) {
                const modelW = this.W * this.config.modelScale;
                const modelH = 100;
                const modelX = this.W / 2 - modelW / 2;
                const modelY = sVectorLayout.sY + sVectorLayout.sH + this.config.spacing.vectorToModel;

                return { modelX, modelY, modelW, modelH };
            } else {
                const modelW = this.config.modelSize.w;
                const modelH = this.config.modelSize.h;
                const modelX = this.W / 2 - modelW / 2;
                const modelY = this.H / 2 - modelH / 2;

                return { modelX, modelY, modelW, modelH };
            }
        }

        getOutputLayout(inputLayout, modelLayout) {
            if (this.isMobile) {
                const outHighX = this.W / 2 - inputLayout.imgW / 2;
                const outHighY = modelLayout.modelY + modelLayout.modelH + this.config.spacing.modelToOutput;
                const outLowX = outHighX;
                const outLowY = outHighY + inputLayout.imgH + this.config.spacing.betweenOutputs;

                return { outHighX, outHighY, outLowX, outLowY };
            } else {
                const outHighX = modelLayout.modelX + modelLayout.modelW + this.config.outputOffset.x;
                const outHighY = this.H / 2 - inputLayout.imgH - this.config.outputOffset.y;
                const outLowX = outHighX;
                const outLowY = this.H / 2 + this.config.outputOffset.y;

                return { outHighX, outHighY, outLowX, outLowY };
            }
        }

        getGuidanceLayout(inputLayout, outputLayout) {
            const guidanceW = inputLayout.imgW * this.config.guidance.scale;
            const guidanceH = inputLayout.imgH * this.config.guidance.scale;
            const margin = this.config.guidance.margin;

            if (this.isMobile) {
                const centerX = this.W / 2 - inputLayout.imgW / 2;
                const startYForStages = this.config.guidance.startY;
                const labelSpace = this.config.guidance.labelSpace;
                const elementSpacing8 = this.config.guidance.elementSpacing8;
                const spacing9Top = this.config.guidance.spacing9Top;
                const spacing9Bottom = this.config.guidance.spacing9Bottom;

                // Stage 7 positions
                const stage7LeftX = centerX;
                const stage7Y = outputLayout.outHighY;
                const stage7RightX = centerX;
                const stage7LowY = outputLayout.outLowY;

                // Stage 8 positions
                const stage8LeftX = centerX;
                const stage8Y = startYForStages;
                const stage8RightX = centerX;
                const stage8LowY = stage8Y + inputLayout.imgH + labelSpace + elementSpacing8;
                const stage8GuidanceX = centerX + inputLayout.imgW / 2 - guidanceW / 2;
                const stage8GuidanceY = stage8LowY + inputLayout.imgH + labelSpace + elementSpacing8 + 30;

                // Stage 9 positions
                const stage9VPlusX = centerX;
                const stage9VPlusY = startYForStages;
                const stage9GuidanceX = centerX + inputLayout.imgW / 2 - guidanceW / 2;
                const stage9GuidanceY = stage9VPlusY + inputLayout.imgH + labelSpace + spacing9Top;
                const stage9FinalX = centerX;
                const stage9FinalY = stage9GuidanceY + guidanceH + spacing9Bottom;

                // Stage 10 positions
                const stage10FinalX = centerX;
                const stage10FinalY = this.H / 2 - inputLayout.imgH + this.config.finalPosition.centerOffset;

                return {
                    guidanceW, guidanceH,
                    stage7: { leftX: stage7LeftX, y: stage7Y, rightX: stage7RightX, lowY: stage7LowY },
                    stage8: { leftX: stage8LeftX, y: stage8Y, rightX: stage8RightX, lowY: stage8LowY, guidanceX: stage8GuidanceX, guidanceY: stage8GuidanceY },
                    stage9: { vPlusX: stage9VPlusX, vPlusY: stage9VPlusY, guidanceX: stage9GuidanceX, guidanceY: stage9GuidanceY, finalX: stage9FinalX, finalY: stage9FinalY },
                    stage10: { finalX: stage10FinalX, finalY: stage10FinalY }
                };
            } else {
                const centerY = this.H / 2;

                // Stage 7 positions
                const stage7Spacing = this.W * 0.45;
                const stage7LeftX = this.W / 2 - stage7Spacing / 2 - inputLayout.imgW / 2;
                const stage7RightX = this.W / 2 + stage7Spacing / 2 - inputLayout.imgW / 2;
                const stage7Y = centerY - inputLayout.imgH / 2;

                // Stage 8 positions
                const stage8Spacing = this.W * 0.22;
                const stage8LeftX = margin;
                const stage8RightX = stage8LeftX + inputLayout.imgW + stage8Spacing;
                const stage8Y = stage7Y;
                const stage8ArrowX = stage8RightX + inputLayout.imgW + stage8Spacing * 0.8;
                const stage8GuidanceX = stage8ArrowX + stage8Spacing * 1.2;
                const stage8GuidanceY = stage7Y + (inputLayout.imgH - guidanceH) / 2;

                // Stage 9 positions
                const stage9Spacing = (this.W - margin * 2 - inputLayout.imgW * 2) / 4;
                const stage9VPlusX = margin;
                const stage9VPlusY = stage7Y;
                const stage9GuidanceX = stage9VPlusX + inputLayout.imgW + stage9Spacing;
                const stage9GuidanceY = stage7Y + (inputLayout.imgH - guidanceH) / 2;
                const stage9ArrowX = stage9GuidanceX + guidanceW + stage9Spacing * 0.8;
                const stage9ArrowY = stage7Y + inputLayout.imgH / 2;
                const stage9FinalX = this.W - margin - inputLayout.imgW;
                const stage9FinalY = stage7Y;

                // Stage 10 positions
                const stage10FinalX = this.W / 2 - inputLayout.imgW / 2;
                const stage10FinalY = stage7Y;

                return {
                    guidanceW, guidanceH,
                    stage7: { leftX: stage7LeftX, y: stage7Y, rightX: stage7RightX, lowY: stage7Y },
                    stage8: { leftX: stage8LeftX, y: stage8Y, rightX: stage8RightX, lowY: stage8Y, arrowX: stage8ArrowX, guidanceX: stage8GuidanceX, guidanceY: stage8GuidanceY },
                    stage9: { vPlusX: stage9VPlusX, vPlusY: stage9VPlusY, guidanceX: stage9GuidanceX, guidanceY: stage9GuidanceY, arrowX: stage9ArrowX, arrowY: stage9ArrowY, finalX: stage9FinalX, finalY: stage9FinalY },
                    stage10: { finalX: stage10FinalX, finalY: stage10FinalY }
                };
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

        drawCaptionBox(x, y, w, h, captionText, alpha = 1) {
            const p = this.p;
            p.push();
            if (alpha < 1) p.drawingContext.globalAlpha = alpha;

            const padding = CONFIG.visual.padding.medium;
            const iconSize = CONFIG.sizes.text.icon;

            // Background box
            p.fill('rgba(255,255,255,0.03)');
            p.noStroke();
            p.rect(x - padding, y, w + padding * 2, h, CONFIG.visual.borderRadius.small);

            // Border
            p.noFill();
            p.stroke('rgba(255,255,255,0.12)');
            p.strokeWeight(CONFIG.visual.strokeWeight.thin);
            p.rect(x - padding, y, w + padding * 2, h, CONFIG.visual.borderRadius.small);

            // Quote icon
            p.fill(p.color(this.pal.muted));
            p.noStroke();
            p.textSize(iconSize);
            p.textAlign(p.LEFT, p.CENTER);
            p.textStyle(p.BOLD);
            p.text('❝', x - padding + 6, y + h / 2);

            // Caption label
            const labelSize = CONFIG.sizes.text.captionLabel;
            const textSize = CONFIG.sizes.text.captionText;
            const textX = x - padding + 20;
            const verticalSpacing = 7;

            p.fill(p.color(this.pal.muted));
            p.textSize(labelSize);
            p.textStyle(p.NORMAL);
            p.textAlign(p.LEFT, p.CENTER);
            p.text('caption', textX, y + h / 2 - verticalSpacing);

            // Caption text
            p.fill(p.color(this.pal.fg));
            p.textSize(textSize);
            p.textStyle(p.ITALIC);
            p.text(captionText, textX, y + h / 2 + verticalSpacing);

            p.pop();
        }

        drawBox(x, y, w, h, label, isMiro = false, alpha = 1) {
            const p = this.p;
            p.push();
            p.drawingContext.globalAlpha = alpha;
            p.noStroke();
            p.fill(p.color(this.pal.card));
            p.rect(x, y, w, h, CONFIG.visual.borderRadius.large);

            p.noFill();
            if (isMiro) {
                p.stroke(p.color(this.pal.accent));
                p.strokeWeight(CONFIG.visual.strokeWeight.thick);
                p.rect(x + 1, y + 1, w - 2, h - 2, CONFIG.visual.borderRadius.large);
            } else {
                p.stroke('rgba(255,255,255,0.06)');
                p.strokeWeight(CONFIG.visual.strokeWeight.thin);
                p.rect(x + 0.5, y + 0.5, w - 1, h - 1, CONFIG.visual.borderRadius.large);
            }

            if (label) {
                p.noStroke();
                p.fill(p.color(this.pal.fg));
                p.textSize(12);
                p.textAlign(p.CENTER, p.TOP);
                p.text(label, x + w / 2, y + 8);
            }
            p.pop();
        }

        drawVector(x, y, w, h, n, values, colors, label, alpha = 1) {
            const p = this.p;
            p.push();
            p.drawingContext.globalAlpha = alpha;
            this.drawBox(x, y, w, h, label, false, alpha);

            const pad = CONFIG.visual.padding.small;
            const barWidth = (w - pad * (n + 1)) / n;
            const by = y + pad + 20;
            const barAreaH = h - (pad * 2 + 20);

            for (let i = 0; i < n; i++) {
                const v = values[i] || 0;
                const barH = barAreaH * v;
                p.fill(colors[i % colors.length]);
                p.noStroke();
                p.rect(x + pad + i * (barWidth + pad), by + (barAreaH - barH), barWidth, barH, 3);
            }
            p.pop();
        }

        drawLabel(text, x, y, alpha = 1, size = null) {
            const p = this.p;
            p.push();
            p.noStroke();
            p.fill(p.color(this.pal.muted));
            p.drawingContext.globalAlpha = alpha;
            p.textAlign(p.CENTER, p.TOP);
            p.textSize(size || CONFIG.sizes.text.label);
            p.text(text, x, y);
            p.pop();
        }

        drawImageWithNoise(img, x, y, w, h, noiseAmount, alpha = 1) {
            const p = this.p;
            p.push();
            p.drawingContext.globalAlpha = alpha;

            if (!img || img.width === 0 || noiseAmount <= 0) {
                if (img && img.width > 0) p.image(img, x, y, w, h);
                p.pop();
                return;
            }

            const noiseWeight = CONFIG.animation.noiseParams.maxWeight * noiseAmount;
            const imageWeight = 1.0 - CONFIG.animation.noiseParams.maxWeight * noiseAmount;

            p.image(img, x, y, w, h);

            p.loadPixels();
            const x1 = Math.floor(x);
            const y1 = Math.floor(y);
            const x2 = Math.min(Math.ceil(x + w), p.width);
            const y2 = Math.min(Math.ceil(y + h), p.height);

            const stdDev = CONFIG.animation.noiseParams.stdDev;
            for (let py = y1; py < y2; py++) {
                for (let px = x1; px < x2; px++) {
                    const idx = (py * p.width + px) * 4;

                    const noiseR = p.randomGaussian(0, stdDev);
                    const noiseG = p.randomGaussian(0, stdDev);
                    const noiseB = p.randomGaussian(0, stdDev);

                    p.pixels[idx] = p.constrain(imageWeight * p.pixels[idx] + noiseWeight * noiseR, 0, 255);
                    p.pixels[idx + 1] = p.constrain(imageWeight * p.pixels[idx + 1] + noiseWeight * noiseG, 0, 255);
                    p.pixels[idx + 2] = p.constrain(imageWeight * p.pixels[idx + 2] + noiseWeight * noiseB, 0, 255);
                }
            }
            p.updatePixels();
            p.pop();
        }

        drawArrow(x1, y1, x2, y2, alpha, color) {
            const p = this.p;
            color = color || this.pal.muted;
            p.push();
            p.stroke(color);
            p.strokeWeight(CONFIG.visual.strokeWeight.normal);
            p.drawingContext.globalAlpha = alpha;
            p.fill(color);
            p.line(x1, y1, x2, y2);
            const angle = Math.atan2(y2 - y1, x2 - x1);
            p.translate(x2, y2);
            p.rotate(angle);
            p.triangle(0, 0, -5, -2.5, -5, 2.5);
            p.pop();
        }

        drawGlowEffect(x, y, w, h, color, alpha = 1, blurAmount = null) {
            const p = this.p;
            p.push();
            p.drawingContext.globalAlpha = alpha;
            p.noStroke();
            p.fill(color);
            if (p.drawingContext.shadowBlur) {
                p.drawingContext.shadowColor = color;
                p.drawingContext.shadowBlur = blurAmount || CONFIG.sizes.effects.shadowBlur;
            }
            p.rect(x, y, w, h, CONFIG.visual.borderRadius.medium);
            p.pop();
        }

        drawOperatorSign(x, y, sign, signType, alpha = 1) {
            const p = this.p;
            const circleSize = signType === 'minus' ? CONFIG.sizes.operators.minusCircle : CONFIG.sizes.operators.plusCircle;
            const bgColor = signType === 'minus' ? this.pal.muted : this.pal.green;
            const textSize = signType === 'minus' ? CONFIG.sizes.text.operatorSign : CONFIG.sizes.text.plusSign;

            // Background circle
            p.push();
            p.drawingContext.globalAlpha = alpha * 0.4;
            p.noStroke();
            p.fill(bgColor);
            p.circle(x, y, circleSize);
            p.pop();

            // Sign text
            p.push();
            p.drawingContext.globalAlpha = alpha;
            p.fill(this.pal.fg);
            p.textSize(textSize);
            p.textAlign(p.CENTER, p.CENTER);
            p.textStyle(p.BOLD);
            const yOffset = signType === 'minus' ? -2 : 0;
            p.text(sign, x, y + yOffset);
            p.pop();
        }

        drawOmega(x, y, alpha = 1) {
            const p = this.p;
            // Background pill
            p.push();
            p.drawingContext.globalAlpha = alpha * 0.35;
            p.noStroke();
            p.fill(this.pal.accent);
            p.rect(x - CONFIG.sizes.operators.omegaPill.w / 2, y - CONFIG.sizes.operators.omegaPill.h / 2,
                CONFIG.sizes.operators.omegaPill.w, CONFIG.sizes.operators.omegaPill.h, CONFIG.visual.borderRadius.large);
            p.pop();

            // Omega text
            p.push();
            p.drawingContext.globalAlpha = alpha;
            p.textSize(CONFIG.sizes.text.omega);
            p.textStyle(p.ITALIC);
            p.fill(this.pal.fg);
            p.textAlign(p.CENTER, p.CENTER);
            p.text("ω", x, y);
            p.pop();
        }

        drawGuidanceVector(x, y, w, h, alpha = 1) {
            const p = this.p;
            p.push();

            // Outer glow
            p.drawingContext.globalAlpha = alpha * 0.3;
            if (p.drawingContext.shadowBlur) {
                p.drawingContext.shadowColor = this.pal.accent;
                p.drawingContext.shadowBlur = CONFIG.sizes.effects.glowBlur;
            }
            p.noStroke();
            p.fill(this.pal.accent);
            p.rect(x - 30, y - 45, w + 60, h + 50, CONFIG.visual.borderRadius.large);

            // Main gradient box
            p.drawingContext.globalAlpha = alpha;
            p.drawingContext.shadowBlur = 0;
            const gradient = p.drawingContext.createLinearGradient(x, y, x, y + h);
            gradient.addColorStop(0, this.pal.green);
            gradient.addColorStop(0.5, this.pal.accent);
            gradient.addColorStop(1, '#6496ff');
            p.drawingContext.fillStyle = gradient;
            p.rect(x, y, w, h, CONFIG.visual.borderRadius.medium);

            // Inner shine effect
            p.drawingContext.globalAlpha = alpha * 0.2;
            const shine = p.drawingContext.createLinearGradient(x, y, x + w, y);
            shine.addColorStop(0, 'rgba(255,255,255,0)');
            shine.addColorStop(0.5, 'rgba(255,255,255,0.8)');
            shine.addColorStop(1, 'rgba(255,255,255,0)');
            p.drawingContext.fillStyle = shine;
            p.rect(x, y, w, h * 0.3, CONFIG.visual.borderRadius.medium);

            // Border
            p.drawingContext.globalAlpha = alpha;
            p.noFill();
            p.stroke(this.pal.fg);
            p.strokeWeight(CONFIG.visual.strokeWeight.normal);
            p.rect(x, y, w, h, CONFIG.visual.borderRadius.medium);

            // Label icon
            p.drawingContext.globalAlpha = alpha * 0.7;
            p.fill(this.pal.accent);
            p.textSize(CONFIG.sizes.text.guidanceLabel);
            p.textAlign(p.CENTER, p.CENTER);
            p.text("Δv", x + w / 2, y + h / 2);

            p.pop();
        }

        drawProcessingEffect(x, y, prog, alpha = 1) {
            const p = this.p;
            p.push();
            p.translate(x, y);
            p.noFill();
            p.stroke(this.pal.accent);
            p.strokeWeight(CONFIG.visual.strokeWeight.normal);

            const maxRadius = CONFIG.sizes.effects.processingMaxRadius;
            const startRadius = CONFIG.sizes.effects.processingStartRadius;

            if (prog < 0.5) {
                const r = lerp(startRadius, maxRadius, prog * 2);
                p.drawingContext.globalAlpha = lerp(1, 0, prog * 2);
                p.ellipse(0, 0, r * 2);
            } else {
                const r = lerp(startRadius, maxRadius, (prog - 0.5) * 2);
                p.drawingContext.globalAlpha = lerp(1, 0, (prog - 0.5) * 2);
                p.ellipse(0, 0, r * 2);
            }
            p.pop();
        }
    }

    // ============================================================================
    // STAGE MANAGER
    // ============================================================================
    class StageManager {
        constructor() {
            this.timeline = CONFIG.timeline;
            this.totalMs = this.timeline.reduce((acc, [, d]) => acc + d, 0);
        }

        getStageAndProgress(elapsed) {
            const t = elapsed % this.totalMs;
            let acc = 0;
            for (const [name, dur] of this.timeline) {
                if (t < acc + dur) {
                    return { name, prog: (t - acc) / dur };
                }
                acc += dur;
            }
            return { name: 'stage_0_s_plus_input', prog: 0 };
        }
    }

    // ============================================================================
    // STAGE HANDLERS
    // ============================================================================

    class InputDisplayStage {
        render(p, layout, renderer, prog, katexLabels, images) {
            const input = layout.getInputLayout();
            const sVector = layout.getSVectorLayout(input);
            const rewardColors = getRewardColors();

            renderer.drawImageWithNoise(images.input, input.inputX - input.imgW / 2, input.imgY, input.imgW, input.imgH, 0.9, 1);
            renderer.drawCaptionBox(input.inputX - input.captionW / 2, input.captionY, input.captionW, input.captionH, CONFIG.text.caption, 1);
            renderer.drawVector(sVector.sPlusX, sVector.sPlusY, sVector.sW, sVector.sH, CONFIG.animation.numRewards,
                [1, 1, 1, 1, 1, 1, 1], rewardColors, '', 1);
            katexLabels.s_plus.position(sVector.sPlusX + sVector.sW / 2 - 15, sVector.sPlusY - 15).style('opacity', 1);
        }
    }

    class SPlusProcessingStage {
        render(p, layout, renderer, prog, katexLabels, images, stageName) {
            const input = layout.getInputLayout();
            const sVector = layout.getSVectorLayout(input);
            const model = layout.getModelLayout(sVector);
            const output = layout.getOutputLayout(input, model);
            const rewardColors = getRewardColors();

            if (stageName === 'stage_1_s_plus_to_model') {
                // Moving elements to model
                const commonTargetX = model.modelX + model.modelW / 2;
                const commonTargetY = model.modelY + model.modelH / 2;
                const sPlusCurrentX = lerp(sVector.sPlusX, commonTargetX - sVector.sW / 2, prog);
                const sPlusCurrentY = lerp(sVector.sPlusY, commonTargetY - sVector.sH / 2, prog);
                const imgCurrentX = lerp(input.inputX - input.imgW / 2, commonTargetX - input.imgW / 2, prog);
                const imgCurrentY = lerp(input.imgY, commonTargetY - input.imgH / 2, prog);
                const captionCurrentX = lerp(input.inputX - input.captionW / 2, commonTargetX - input.captionW / 2, prog);
                const captionCurrentY = lerp(input.captionY, commonTargetY - input.captionH / 2, prog);

                renderer.drawVector(sPlusCurrentX, sPlusCurrentY, sVector.sW, sVector.sH, CONFIG.animation.numRewards,
                    [1, 1, 1, 1, 1, 1, 1], rewardColors, '', 1);
                katexLabels.s_plus.position(sPlusCurrentX + sVector.sW / 2 - 15, sPlusCurrentY - 15).style('opacity', 1 - prog);
                renderer.drawImageWithNoise(images.input, imgCurrentX, imgCurrentY, input.imgW, input.imgH, 0.9, 1);
                renderer.drawCaptionBox(captionCurrentX, captionCurrentY, input.captionW, input.captionH, CONFIG.text.caption, 1 - prog);

                renderer.drawBox(model.modelX, model.modelY, model.modelW, model.modelH, "", true, 1);
                p.push();
                p.fill(renderer.pal.accent);
                p.textSize(CONFIG.sizes.text.modelName);
                p.textStyle(p.BOLD);
                p.textAlign(p.CENTER, p.CENTER);
                p.text(CONFIG.text.modelName, model.modelX + model.modelW / 2, model.modelY + model.modelH / 2);
                p.pop();

            } else if (stageName === 'stage_2_processing_s_plus') {
                // Processing animation
                renderer.drawBox(model.modelX, model.modelY, model.modelW, model.modelH, "", true, 1);
                p.push();
                p.fill(renderer.pal.accent);
                p.textSize(CONFIG.sizes.text.modelName);
                p.textStyle(p.BOLD);
                p.textAlign(p.CENTER, p.CENTER);
                p.text(CONFIG.text.modelName, model.modelX + model.modelW / 2, model.modelY + model.modelH / 2);
                p.pop();
                renderer.drawProcessingEffect(model.modelX + model.modelW / 2, model.modelY + model.modelH / 2, prog);

            } else if (stageName === 'stage_3_high_output') {
                // Output emerging
                renderer.drawBox(model.modelX, model.modelY, model.modelW, model.modelH, "", true, 1);
                p.push();
                p.fill(renderer.pal.accent);
                p.textSize(CONFIG.sizes.text.modelName);
                p.textStyle(p.BOLD);
                p.textAlign(p.CENTER, p.CENTER);
                p.text(CONFIG.text.modelName, model.modelX + model.modelW / 2, model.modelY + model.modelH / 2);
                p.pop();

                const currentX = lerp(model.modelX + model.modelW / 2, output.outHighX, prog);
                const currentY = lerp(model.modelY + model.modelH / 2, output.outHighY, prog);
                katexLabels.high_reward_out.position(currentX + input.imgW / 2 - 50, currentY - 40).style('opacity', prog);
                renderer.drawImageWithNoise(images.highAesthetics, currentX, currentY, input.imgW, input.imgH, 0, prog);

                // Show s- vector, image, and caption fading in
                renderer.drawVector(sVector.sMinusX, sVector.sMinusY, sVector.sW, sVector.sH, CONFIG.animation.numRewards,
                    [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1], rewardColors, '', prog);
                katexLabels.s_minus.position(sVector.sMinusX + sVector.sW / 2 - 15, sVector.sMinusY - 15).style('opacity', prog);
                renderer.drawImageWithNoise(images.input, input.inputX - input.imgW / 2, input.imgY, input.imgW, input.imgH, 0.9, prog);
                renderer.drawCaptionBox(input.inputX - input.captionW / 2, input.captionY, input.captionW, input.captionH, CONFIG.text.caption, prog);
            }
        }
    }

    class SMinusProcessingStage {
        render(p, layout, renderer, prog, katexLabels, images, stageName) {
            const input = layout.getInputLayout();
            const sVector = layout.getSVectorLayout(input);
            const model = layout.getModelLayout(sVector);
            const output = layout.getOutputLayout(input, model);
            const rewardColors = getRewardColors();

            // Always show high output
            katexLabels.high_reward_out.position(output.outHighX + input.imgW / 2 - 50, output.outHighY - 40).style('opacity', 1);
            renderer.drawImageWithNoise(images.highAesthetics, output.outHighX, output.outHighY, input.imgW, input.imgH, 0, 1);

            if (stageName === 'stage_4_s_minus_to_model') {
                // Moving s- elements to model
                const commonTargetX = model.modelX + model.modelW / 2;
                const commonTargetY = model.modelY + model.modelH / 2;
                const sMinusCurrentX = lerp(sVector.sMinusX, commonTargetX - sVector.sW / 2, prog);
                const sMinusCurrentY = lerp(sVector.sMinusY, commonTargetY - sVector.sH / 2, prog);
                const imgCurrentX = lerp(input.inputX - input.imgW / 2, commonTargetX - input.imgW / 2, prog);
                const imgCurrentY = lerp(input.imgY, commonTargetY - input.imgH / 2, prog);
                const captionCurrentX = lerp(input.inputX - input.captionW / 2, commonTargetX - input.captionW / 2, prog);
                const captionCurrentY = lerp(input.captionY, commonTargetY - input.captionH / 2, prog);

                renderer.drawVector(sMinusCurrentX, sMinusCurrentY, sVector.sW, sVector.sH, CONFIG.animation.numRewards,
                    [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1], rewardColors, '', 1);
                katexLabels.s_minus.position(sMinusCurrentX + sVector.sW / 2 - 15, sMinusCurrentY - 15).style('opacity', 1 - prog);
                renderer.drawImageWithNoise(images.input, imgCurrentX, imgCurrentY, input.imgW, input.imgH, 0.9, 1);
                renderer.drawCaptionBox(captionCurrentX, captionCurrentY, input.captionW, input.captionH, CONFIG.text.caption, 1 - prog);

                renderer.drawBox(model.modelX, model.modelY, model.modelW, model.modelH, "", true, 1);
                p.push();
                p.fill(renderer.pal.accent);
                p.textSize(CONFIG.sizes.text.modelName);
                p.textStyle(p.BOLD);
                p.textAlign(p.CENTER, p.CENTER);
                p.text(CONFIG.text.modelName, model.modelX + model.modelW / 2, model.modelY + model.modelH / 2);
                p.pop();

            } else if (stageName === 'stage_5_processing_s_minus') {
                // Processing animation
                renderer.drawBox(model.modelX, model.modelY, model.modelW, model.modelH, "", true, 1);
                p.push();
                p.fill(renderer.pal.accent);
                p.textSize(CONFIG.sizes.text.modelName);
                p.textStyle(p.BOLD);
                p.textAlign(p.CENTER, p.CENTER);
                p.text(CONFIG.text.modelName, model.modelX + model.modelW / 2, model.modelY + model.modelH / 2);
                p.pop();
                renderer.drawProcessingEffect(model.modelX + model.modelW / 2, model.modelY + model.modelH / 2, prog);

            } else if (stageName === 'stage_6_low_output') {
                // Low output emerging
                renderer.drawBox(model.modelX, model.modelY, model.modelW, model.modelH, "", true, 1);
                p.push();
                p.fill(renderer.pal.accent);
                p.textSize(CONFIG.sizes.text.modelName);
                p.textStyle(p.BOLD);
                p.textAlign(p.CENTER, p.CENTER);
                p.text(CONFIG.text.modelName, model.modelX + model.modelW / 2, model.modelY + model.modelH / 2);
                p.pop();

                const currentX = lerp(model.modelX + model.modelW / 2, output.outLowX, prog);
                const currentY = lerp(model.modelY + model.modelH / 2, output.outLowY, prog);
                katexLabels.low_reward_out.position(currentX + input.imgW / 2 - 50, currentY - 40).style('opacity', prog);
                renderer.drawImageWithNoise(images.lowAesthetics, currentX, currentY, input.imgW, input.imgH, 0, prog);
            }
        }
    }

    class SubtractionStage {
        render(p, layout, renderer, prog, katexLabels, images, stageName) {
            const input = layout.getInputLayout();
            const output = layout.getOutputLayout(input, layout.getModelLayout(layout.getSVectorLayout(input)));
            const guidance = layout.getGuidanceLayout(input, output);

            let vPlusX, vPlusY, vMinusX, vMinusY, minusSignAlpha = 0, guidanceAlpha = 0, guidanceArrowAlpha = 0;

            if (stageName === 'stage_7_pause') {
                const moveProg = Math.min(1, prog / 0.5);
                vPlusX = lerp(output.outHighX, guidance.stage7.leftX, moveProg);
                vPlusY = lerp(output.outHighY, guidance.stage7.y, moveProg);
                vMinusX = lerp(output.outLowX, guidance.stage7.rightX, moveProg);
                vMinusY = lerp(output.outLowY, guidance.stage7.lowY, moveProg);

            } else if (stageName === 'stage_8_visualize_subtraction') {
                const moveProg = Math.min(1, prog / 0.3);
                vPlusX = lerp(guidance.stage7.leftX, guidance.stage8.leftX, moveProg);
                vPlusY = lerp(guidance.stage7.y, guidance.stage8.y, moveProg);
                vMinusX = lerp(guidance.stage7.rightX, guidance.stage8.rightX, moveProg);
                vMinusY = lerp(guidance.stage7.lowY, guidance.stage8.lowY, moveProg);

                minusSignAlpha = Math.min(1, prog / 0.3);
                guidanceArrowAlpha = Math.max(0, Math.min(1, (prog - 0.3) / 0.4));
                guidanceAlpha = Math.max(0, Math.min(1, (prog - 0.5) / 0.5));

                // Background highlight
                if (prog > 0.2) {
                    const bgAlpha = Math.min(1, (prog - 0.2) / 0.3) * 0.15;
                    p.push();
                    p.noStroke();
                    p.fill(renderer.pal.accent);
                    p.drawingContext.globalAlpha = bgAlpha;
                    const bgPad = CONFIG.visual.padding.large;

                    if (layout.isMobile) {
                        const bgX = vPlusX - bgPad;
                        const bgY = vPlusY - 45;
                        const bgW = input.imgW + bgPad * 2;
                        const bottomY = guidanceAlpha > 0 ? guidance.stage8.guidanceY + guidance.guidanceH : vMinusY + input.imgH;
                        const bgH = bottomY - bgY + bgPad;
                        p.rect(bgX, bgY, bgW, bgH, CONFIG.visual.borderRadius.xlarge);
                    } else {
                        const bgX = vPlusX - bgPad;
                        const bgY = vPlusY - 45;
                        const bgW = (guidanceAlpha > 0 ? guidance.stage8.guidanceX + guidance.guidanceW + 30 : vMinusX + input.imgW) - bgX + bgPad;
                        const bgH = input.imgH + 45 + bgPad;
                        p.rect(bgX, bgY, bgW, bgH, CONFIG.visual.borderRadius.xlarge);
                    }
                    p.pop();
                }
            }

            // Draw v+
            katexLabels.high_reward_out.position(vPlusX + input.imgW / 2 - 50, vPlusY - 40).style('opacity', 1);
            renderer.drawGlowEffect(vPlusX - 5, vPlusY - 45, input.imgW + 10, input.imgH + 50, renderer.pal.green, 0.3);
            renderer.drawImageWithNoise(images.highAesthetics, vPlusX, vPlusY, input.imgW, input.imgH, 0, 1);

            // Draw v-
            katexLabels.low_reward_out.position(vMinusX + input.imgW / 2 - 50, vMinusY - 40).style('opacity', 1);
            renderer.drawGlowEffect(vMinusX - 5, vMinusY - 45, input.imgW + 10, input.imgH + 50, renderer.pal.red, 0.3);
            renderer.drawImageWithNoise(images.lowAesthetics, vMinusX, vMinusY, input.imgW, input.imgH, 0, 1);

            // Minus sign
            if (minusSignAlpha > 0.01) {
                let minusX, minusY;
                if (layout.isMobile) {
                    minusX = vPlusX + input.imgW / 2;
                    minusY = (vPlusY + input.imgH / 2 + vMinusY) / 2 + 1;
                } else {
                    minusX = (vPlusX + input.imgW + vMinusX) / 2;
                    minusY = vPlusY + input.imgH / 2;
                }
                renderer.drawOperatorSign(minusX, minusY, "-", "minus", minusSignAlpha);
            }

            // Guidance vector
            if (guidanceAlpha > 0.01) {
                renderer.drawGuidanceVector(guidance.stage8.guidanceX, guidance.stage8.guidanceY, guidance.guidanceW, guidance.guidanceH, guidanceAlpha);
                katexLabels.guidance_vec.position(guidance.stage8.guidanceX + guidance.guidanceW / 2 - 60, guidance.stage8.guidanceY - 40).style('opacity', guidanceAlpha);
            }

            // Arrow to guidance
            if (guidanceArrowAlpha > 0.01) {
                p.push();
                p.stroke(renderer.pal.accent);
                p.strokeWeight(CONFIG.visual.strokeWeight.xthick);
                p.drawingContext.globalAlpha = guidanceArrowAlpha;
                p.fill(renderer.pal.accent);

                if (p.drawingContext.setLineDash) {
                    p.drawingContext.setLineDash([8, 6]);
                }

                if (layout.isMobile) {
                    const arrowX = guidance.stage8.leftX + input.imgW / 2;
                    const startY = guidance.stage8.lowY + input.imgH + 10;
                    const endY = guidance.stage8.guidanceY - 45;
                    p.line(arrowX, startY, arrowX, endY);

                    if (p.drawingContext.setLineDash) {
                        p.drawingContext.setLineDash([]);
                    }
                    p.push();
                    p.translate(arrowX, endY);
                    p.rotate(Math.PI / 2);
                    p.triangle(0, 0, -10, -5, -10, 5);
                    p.pop();
                } else {
                    const arrowY = guidance.stage8.y + input.imgH / 2;
                    p.line(guidance.stage8.rightX + input.imgW + 10, arrowY, guidance.stage8.guidanceX - (guidance.guidanceW / 2) - 10, arrowY);

                    if (p.drawingContext.setLineDash) {
                        p.drawingContext.setLineDash([]);
                    }
                    p.push();
                    p.translate(guidance.stage8.guidanceX - (guidance.guidanceW / 2) - 10, arrowY);
                    p.rotate(0);
                    p.triangle(0, 0, -10, -5, -10, 5);
                    p.pop();
                }
                p.pop();
            }
        }
    }

    class GuidanceApplicationStage {
        render(p, layout, renderer, prog, katexLabels, images, stageName) {
            const input = layout.getInputLayout();
            const output = layout.getOutputLayout(input, layout.getModelLayout(layout.getSVectorLayout(input)));
            const guidance = layout.getGuidanceLayout(input, output);

            let vPlusX, vPlusY, vPlusAlpha = 0, guidanceX, guidanceY, guidanceAlpha = 0;
            let plusSignAlpha = 0, applyArrowAlpha = 0;
            let finalOutputX, finalOutputY, finalOutputAlpha = 0, finalOutputNoise = 0;

            if (stageName === 'stage_9_apply_guidance') {
                const moveProg = Math.min(1, prog / 0.25);

                vPlusX = lerp(guidance.stage8.leftX, guidance.stage9.vPlusX, moveProg);
                vPlusY = lerp(guidance.stage8.y, guidance.stage9.vPlusY, moveProg);
                vPlusAlpha = 1;

                guidanceX = lerp(guidance.stage8.guidanceX, guidance.stage9.guidanceX, moveProg);
                guidanceY = lerp(guidance.stage8.guidanceY, guidance.stage9.guidanceY, moveProg);
                guidanceAlpha = 1;

                plusSignAlpha = Math.max(0, Math.min(1, (prog - 0.15) / 0.3));
                applyArrowAlpha = Math.max(0, Math.min(1, (prog - 0.4) / 0.3));

                const finalProg = Math.max(0, Math.min(1, (prog - 0.5) / 0.5));
                finalOutputX = guidance.stage9.finalX;
                finalOutputY = guidance.stage9.finalY;
                finalOutputAlpha = finalProg;
                finalOutputNoise = lerp(0.2, 0, finalProg);

                // Background highlight
                if (prog > 0.15) {
                    const bgAlpha = Math.min(1, (prog - 0.15) / 0.3) * 0.15;
                    p.push();
                    p.noStroke();
                    p.fill(renderer.pal.green);
                    p.drawingContext.globalAlpha = bgAlpha;
                    const bgPad = CONFIG.visual.padding.large;

                    if (layout.isMobile) {
                        const bgX = vPlusX - bgPad;
                        const bgY = vPlusY - 45;
                        const bgW = input.imgW + bgPad * 2;
                        const bottomY = finalOutputAlpha > 0 ? finalOutputY + input.imgH : guidanceY + guidance.guidanceH;
                        const bgH = bottomY - bgY + bgPad;
                        p.rect(bgX, bgY, bgW, bgH, CONFIG.visual.borderRadius.xlarge);
                    } else {
                        const bgX = vPlusX - bgPad;
                        const bgY = vPlusY - 45;
                        const rightEdge = finalOutputAlpha > 0 ? finalOutputX + input.imgW : guidanceX + guidance.guidanceW + 60;
                        const bgW = rightEdge - bgX + bgPad;
                        const bgH = input.imgH + 45 + bgPad;
                        p.rect(bgX, bgY, bgW, bgH, CONFIG.visual.borderRadius.xlarge);
                    }
                    p.pop();
                }

            } else if (stageName === 'stage_10_final') {
                vPlusX = guidance.stage9.vPlusX;
                vPlusY = guidance.stage9.vPlusY;
                vPlusAlpha = Math.max(0, 1 - prog / 0.3);

                guidanceX = guidance.stage9.guidanceX;
                guidanceY = guidance.stage9.guidanceY;
                guidanceAlpha = Math.max(0, 1 - prog / 0.3);

                plusSignAlpha = Math.max(0, 1 - prog / 0.3);

                finalOutputX = lerp(guidance.stage9.finalX, guidance.stage10.finalX, prog);
                finalOutputY = lerp(guidance.stage9.finalY, guidance.stage10.finalY, prog);
                finalOutputAlpha = 1;
                finalOutputNoise = 0;

            } else if (stageName === 'stage_11_pause') {
                finalOutputX = guidance.stage10.finalX;
                finalOutputY = guidance.stage10.finalY;
                finalOutputAlpha = 1;
                finalOutputNoise = 0;
            }

            // Draw v+
            if (vPlusAlpha > 0.01) {
                katexLabels.high_reward_out.position(vPlusX + input.imgW / 2 - 50, vPlusY - 40).style('opacity', vPlusAlpha);
                renderer.drawGlowEffect(vPlusX - 5, vPlusY - 45, input.imgW + 10, input.imgH + 50, renderer.pal.green, vPlusAlpha * 0.3);
                renderer.drawImageWithNoise(images.highAesthetics, vPlusX, vPlusY, input.imgW, input.imgH, 0, vPlusAlpha);
            }

            // Plus sign and omega
            if (plusSignAlpha > 0.01) {
                let centerX, centerY;
                if (layout.isMobile) {
                    centerX = vPlusX + input.imgW / 2;
                    centerY = (vPlusY + input.imgH / 2 + guidanceY) / 2;
                } else {
                    centerX = vPlusX + input.imgW + (guidance.stage9.guidanceX - (vPlusX + input.imgW)) * 0.3;
                    centerY = vPlusY + input.imgH / 2;
                }
                const plusX = centerX - 30;
                const omegaX = centerX + 30;

                renderer.drawOperatorSign(plusX, centerY, "+", "plus", plusSignAlpha);
                renderer.drawOmega(omegaX, centerY, plusSignAlpha);
            }

            // Guidance vector
            if (guidanceAlpha > 0.01) {
                renderer.drawGuidanceVector(guidanceX, guidanceY, guidance.guidanceW, guidance.guidanceH, guidanceAlpha);
                if (stageName === 'stage_9_apply_guidance') {
                    katexLabels.guidance_vec.position(guidanceX + guidance.guidanceW / 2 - 60, guidanceY - 40).style('opacity', guidanceAlpha);
                }
            }

            // Apply arrow
            if (applyArrowAlpha > 0.01) {
                p.push();

                if (p.drawingContext.shadowBlur) {
                    p.drawingContext.shadowColor = renderer.pal.green;
                    p.drawingContext.shadowBlur = CONFIG.sizes.effects.arrowGlowBlur;
                }

                p.stroke(renderer.pal.green);
                p.strokeWeight(CONFIG.visual.strokeWeight.xxthick);
                p.drawingContext.globalAlpha = applyArrowAlpha;
                p.fill(renderer.pal.green);

                if (layout.isMobile) {
                    const arrowX = guidance.stage9.vPlusX + input.imgW / 2;
                    const startY = guidance.stage9.guidanceY + guidance.guidanceH + 10;
                    const endY = guidance.stage9.finalY - 40;
                    p.line(arrowX, startY, arrowX, endY);

                    p.push();
                    p.translate(arrowX, endY);
                    p.rotate(Math.PI / 2);
                    p.triangle(0, 0, -10, -5, -10, 5);
                    p.pop();
                } else {
                    const arrowY = guidance.stage9.vPlusY + input.imgH / 2;
                    const startX = guidance.stage9.guidanceX + guidance.guidanceW + 10;
                    const endX = guidance.stage9.finalX - 10;
                    p.line(startX, arrowY, endX, arrowY);

                    p.push();
                    p.translate(endX, arrowY);
                    p.rotate(0);
                    p.triangle(0, 0, -10, -5, -10, 5);
                    p.pop();
                }
                p.pop();
            }

            // Final output
            if (finalOutputAlpha > 0.01) {
                // Golden glow
                p.push();
                p.drawingContext.globalAlpha = finalOutputAlpha * 0.3;
                p.noStroke();
                const glowCenterY = finalOutputY + input.imgH / 2;
                const goldGradient = p.drawingContext.createRadialGradient(
                    finalOutputX + input.imgW / 2, glowCenterY, input.imgW * 0.4,
                    finalOutputX + input.imgW / 2, glowCenterY, input.imgW * 1.2
                );
                goldGradient.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
                goldGradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
                p.drawingContext.fillStyle = goldGradient;
                p.ellipse(finalOutputX + input.imgW / 2, glowCenterY + 15, input.imgW * 1.8, input.imgH * 2.4);
                p.pop();

                // Border
                p.push();
                p.drawingContext.globalAlpha = finalOutputAlpha;
                p.noFill();
                p.stroke(renderer.pal.green);
                p.strokeWeight(CONFIG.visual.strokeWeight.thick);
                p.rect(finalOutputX - 4, finalOutputY - 4, input.imgW + 8, input.imgH + 8, CONFIG.visual.borderRadius.medium);
                p.pop();

                renderer.drawImageWithNoise(images.final, finalOutputX, finalOutputY, input.imgW, input.imgH, finalOutputNoise, finalOutputAlpha);

                // Labels
                if (stageName === 'stage_9_apply_guidance' && finalOutputAlpha > 0.5) {
                    const labelProg = (finalOutputAlpha - 0.5) / 0.5;
                    p.push();
                    p.drawingContext.globalAlpha = labelProg * 0.5;
                    p.noStroke();
                    p.fill(renderer.pal.accent);
                    p.rect(finalOutputX, finalOutputY - 35, input.imgW, 28, CONFIG.visual.borderRadius.small);
                    p.pop();

                    p.push();
                    p.drawingContext.globalAlpha = labelProg;
                    p.fill(renderer.pal.fg);
                    p.textSize(CONFIG.sizes.text.label);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.textStyle(p.BOLD);
                    p.text(CONFIG.text.guidedOutput, finalOutputX + input.imgW / 2, finalOutputY - 21);
                    p.pop();

                } else if (stageName === 'stage_10_final' || stageName === 'stage_11_pause') {
                    const labelAlpha = stageName === 'stage_10_final' ? Math.max(0, Math.min(1, (prog - 0.3) / 0.7)) : 1;

                    // Title
                    const titleText = CONFIG.text.finalTitle;
                    p.push();
                    p.textSize(CONFIG.sizes.text.finalTitle);
                    p.textStyle(p.BOLD);
                    const titleWidth = p.textWidth(titleText);
                    const titlePad = 16;

                    p.drawingContext.globalAlpha = labelAlpha * 0.5;
                    p.noStroke();
                    p.fill(renderer.pal.green);
                    p.rect(finalOutputX + input.imgW / 2 - titleWidth / 2 - titlePad / 2, finalOutputY - 40, titleWidth + titlePad, 32, CONFIG.visual.borderRadius.medium);
                    p.pop();

                    p.push();
                    p.drawingContext.globalAlpha = labelAlpha;
                    p.fill(renderer.pal.fg);
                    p.textSize(CONFIG.sizes.text.finalTitle);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.textStyle(p.BOLD);
                    p.text(titleText, finalOutputX + input.imgW / 2, finalOutputY - 24);
                    p.pop();

                    // Formula
                    const formulaWidth = layout.isMobile ? layout.W - 40 : 310;
                    const formulaY = layout.isMobile ? finalOutputY + input.imgH + 30 : guidance.stage10.finalY + input.imgH + 28;
                    p.push();
                    p.drawingContext.globalAlpha = labelAlpha * 0.3;
                    p.noStroke();
                    p.fill(renderer.pal.green);
                    p.rect(layout.W / 2 - formulaWidth / 2, formulaY, formulaWidth, 35, CONFIG.visual.borderRadius.medium);
                    p.pop();

                    katexLabels.guidance_formula.position(layout.W / 2 - 110, formulaY - 2).style('opacity', labelAlpha);
                }
            }

            // Formula during stage 9
            if (stageName === 'stage_9_apply_guidance' && prog > 0.7) {
                const formulaProg = Math.min(1, (prog - 0.7) / 0.3);
                const formulaWidth = layout.isMobile ? layout.W - 40 : 310;
                const formulaY = layout.isMobile ? guidance.stage9.finalY + input.imgH + 30 : guidance.stage9.vPlusY + input.imgH + 28;
                p.push();
                p.drawingContext.globalAlpha = formulaProg * 0.3;
                p.noStroke();
                p.fill(renderer.pal.green);
                p.rect(layout.W / 2 - formulaWidth / 2, formulaY, formulaWidth, 35, CONFIG.visual.borderRadius.medium);
                p.pop();

                katexLabels.guidance_formula.position(layout.W / 2 - 110, formulaY - 2).style('opacity', formulaProg);
            }
        }
    }

    // ============================================================================
    // MAIN P5 SKETCH
    // ============================================================================
    const sketch = (p) => {
        let images = {}, t0 = 0, playing = false;
        let katexLabels = {};
        let renderer, stageManager;
        let stageHandlers = {};

        p.preload = () => {
            images.input = p.loadImage(CONFIG.images.input);
            images.highAesthetics = p.loadImage(CONFIG.images.highAesthetics);
            images.lowAesthetics = p.loadImage(CONFIG.images.lowAesthetics);
            images.final = p.loadImage(CONFIG.images.final);
        };

        function createKatexLabel(name, latexString) {
            const div = p.createDiv('');
            div.parent('miroInferenceAnimation');
            div.class('katex-label');
            katex.render(latexString, div.elt, { throwOnError: false, displayMode: true });
            katexLabels[name] = div;
        }

        p.setup = () => {
            const parent = p.select('#miroInferenceAnimation');
            parent.style('position', 'relative');
            const parentW = parent.elt.clientWidth || 960;
            const isMobile = parentW < CONFIG.visual.mobileBreakpoint;

            let w, h;
            if (isMobile) {
                w = parentW;
                h = Math.max(CONFIG.layout.mobile.canvas.minHeight, parentW * CONFIG.layout.mobile.canvas.heightMultiplier);
            } else {
                w = Math.min(CONFIG.layout.desktop.canvasWidth, parentW);
                h = Math.max(CONFIG.layout.desktop.minHeight, Math.round(w * CONFIG.layout.desktop.canvasHeightRatio));
            }

            const canvas = p.createCanvas(w, h);
            canvas.style('display', 'block');
            canvas.style('margin', '0 auto');
            parent.elt.insertBefore(canvas.elt, parent.elt.firstChild);
            p.pixelDensity(CONFIG.visual.pixelDensity);

            // Create KaTeX labels
            createKatexLabel('high_reward_out', CONFIG.formulas.highRewardOut);
            createKatexLabel('low_reward_out', CONFIG.formulas.lowRewardOut);
            createKatexLabel('guidance_vec', CONFIG.formulas.guidanceVec);
            createKatexLabel('guidance_formula', CONFIG.formulas.guidanceFormula);
            createKatexLabel('s_plus', CONFIG.formulas.sPlus);
            createKatexLabel('s_minus', CONFIG.formulas.sMinus);

            // Initialize managers and handlers
            renderer = new Renderer(p);
            stageManager = new StageManager();
            stageHandlers = {
                'stage_0_s_plus_input': new InputDisplayStage(),
                'stage_0_s_minus_input': new InputDisplayStage(),
                'stage_0_img_caption_input': new InputDisplayStage(),
                'stage_1_s_plus_to_model': new SPlusProcessingStage(),
                'stage_2_processing_s_plus': new SPlusProcessingStage(),
                'stage_3_high_output': new SPlusProcessingStage(),
                'stage_4_s_minus_to_model': new SMinusProcessingStage(),
                'stage_5_processing_s_minus': new SMinusProcessingStage(),
                'stage_6_low_output': new SMinusProcessingStage(),
                'stage_7_pause': new SubtractionStage(),
                'stage_8_visualize_subtraction': new SubtractionStage(),
                'stage_9_apply_guidance': new GuidanceApplicationStage(),
                'stage_10_final': new GuidanceApplicationStage(),
                'stage_11_pause': new GuidanceApplicationStage()
            };

            // Intersection observer for auto-play
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    t0 = p.millis();
                    playing = true;
                } else {
                    playing = false;
                }
            }, { threshold: CONFIG.animation.intersectionThreshold });

            observer.observe(canvas.elt);

            // Click to pause/play
            parent.elt.addEventListener('click', () => {
                playing = !playing;
                if (playing) {
                    t0 = p.millis() - (p.millis() - t0) % stageManager.totalMs;
                }
            });
        };

        p.windowResized = () => {
            const parent = p.select('#miroInferenceAnimation');
            const parentW = parent.elt.clientWidth || 960;
            const isMobile = parentW < CONFIG.visual.mobileBreakpoint;
            let w, h;
            if (isMobile) {
                w = parentW;
                h = Math.max(CONFIG.layout.mobile.canvas.minHeight, parentW * CONFIG.layout.mobile.canvas.heightMultiplier);
            } else {
                w = Math.min(CONFIG.layout.desktop.canvasWidth, parentW);
                h = Math.max(CONFIG.layout.desktop.minHeight, Math.round(w * CONFIG.layout.desktop.canvasHeightRatio));
            }
            p.resizeCanvas(w, h);
        };

        p.draw = () => {
            if (!playing) return;
            p.clear();

            const { name: stageName, prog: rawProg } = stageManager.getStageAndProgress(p.millis() - t0);
            const prog = CONFIG.animation.easing.inOut(rawProg);
            const isMobile = p.width < CONFIG.visual.mobileBreakpoint;

            // Update palette and create layout
            renderer.updatePalette();
            const layout = new LayoutCalculator(p.width, p.height, isMobile);

            // Hide all KaTeX labels by default
            Object.values(katexLabels).forEach(label => label.style('opacity', 0));

            // Render current stage
            const handler = stageHandlers[stageName];
            if (handler) {
                handler.render(p, layout, renderer, prog, katexLabels, images, stageName);
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

            if (stageName === 'stage_1_s_plus_to_model' || stageName === 'stage_2_processing_s_plus' || stageName === 'stage_3_high_output') {
                labelText = CONFIG.text.phaseLabels.computeHigh;
                if (stageName === 'stage_1_s_plus_to_model') alpha = Math.min(1, prog * 2);
                else if (stageName === 'stage_3_high_output' && prog > 0.5) alpha = 1 - ((prog - 0.5) * 2);
                else alpha = 1;
            } else if (stageName === 'stage_4_s_minus_to_model' || stageName === 'stage_5_processing_s_minus' || stageName === 'stage_6_low_output') {
                labelText = CONFIG.text.phaseLabels.computeLow;
                if (stageName === 'stage_4_s_minus_to_model') alpha = Math.min(1, prog * 2);
                else if (stageName === 'stage_6_low_output' && prog > 0.5) alpha = 1 - ((prog - 0.5) * 2);
                else alpha = 1;
            } else if (stageName === 'stage_7_pause' || stageName === 'stage_8_visualize_subtraction') {
                labelText = CONFIG.text.phaseLabels.computeGuidance;
                if (stageName === 'stage_7_pause') alpha = Math.min(1, prog * 2);
                else if (stageName === 'stage_8_visualize_subtraction' && prog > 0.8) alpha = 1 - ((prog - 0.8) * 5);
                else alpha = 1;
            } else if (stageName === 'stage_9_apply_guidance' || stageName === 'stage_10_final' || stageName === 'stage_11_pause') {
                labelText = CONFIG.text.phaseLabels.updateVelocity;
                if (stageName === 'stage_9_apply_guidance') alpha = Math.min(1, prog * 2);
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

    new p5(sketch, document.getElementById('miroInferenceAnimation'));
})();
