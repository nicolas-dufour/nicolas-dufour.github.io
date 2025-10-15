(function () {
    const sketch = (p) => {
        let img, t0 = 0, playing = false;
        const timeline = [
            ['intro', 2000],
            ['move_to_rewards', 1400],
            ['emit_scores', 1200],
            ['rewards_disappear', 1000],
            ['scores_back', 1800],
            ['noise_input', 1400],
            ['denoiser_appear', 1000],
            ['to_denoiser', 1600],
            ['clean_output', 2200],
            ['pause', 1200]
        ];
        const totalMs = timeline.reduce((acc, [, d]) => acc + d, 0);

        p.preload = () => {
            // Primary placeholder (easy to swap later)
            img = p.loadImage('assets/images/miro_placeholder.jpg', undefined, () => {
                // Optional fallback (kept simple: no error path chaining)
                img = p.loadImage('assets/images/miro_pipeline_placeholder.svg');
            });
        };

        p.setup = () => {
            const parent = p.select('#miroAnimation');
            const parentW = parent.elt.clientWidth || 960;

            // Detect if mobile layout is needed
            const isMobile = parentW < 700;

            // Calculate required width for animation content
            const M = 20;
            const imgW = isMobile ? Math.min(parentW * 0.6, 200) : Math.min(parentW * 0.22, 240);
            const modelW = isMobile ? Math.min(parentW * 0.7, 220) : Math.max(200, parentW * 0.19);

            let w, h;
            if (isMobile) {
                // Mobile: vertical layout, use full width
                w = parentW;
                h = Math.max(650, parentW * 1.8); // Compact vertical flow
            } else {
                // Desktop: horizontal layout
                const contentWidth = M + imgW + 60 + modelW + 60 + imgW + M;
                w = Math.min(contentWidth, parentW);
                h = Math.max(400, Math.round(w * 0.45));
            }

            const canvas = p.createCanvas(w, h);
            canvas.style('display', 'block');
            canvas.style('margin', '0 auto');
            // Insert canvas at the beginning of the parent container
            parent.elt.insertBefore(canvas.elt, parent.elt.firstChild);
            p.pixelDensity(1);

            // Set up Intersection Observer to restart animation when canvas is fully visible
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && entry.intersectionRatio >= 1.0) {
                        // Canvas is fully visible - restart animation from beginning
                        t0 = p.millis();
                        playing = true;
                    } else {
                        // Canvas is not fully visible - pause animation
                        playing = false;
                    }
                });
            }, {
                threshold: 1.0 // Trigger when 100% of the canvas is visible
            });

            // Observe the canvas element
            observer.observe(canvas.elt);

            // Click to toggle play/pause
            parent.elt.addEventListener('click', () => {
                playing = !playing;
                if (playing) {
                    t0 = p.millis() - (p.millis() - t0) % totalMs;
                }
            });
        };

        p.windowResized = () => {
            const parent = p.select('#miroAnimation');
            const parentW = parent.elt.clientWidth || 960;

            // Detect if mobile layout is needed
            const isMobile = parentW < 700;

            // Calculate required width for animation content
            const M = 20;
            const imgW = isMobile ? Math.min(parentW * 0.6, 200) : Math.min(parentW * 0.22, 240);
            const modelW = isMobile ? Math.min(parentW * 0.7, 220) : Math.max(200, parentW * 0.19);

            let w, h;
            if (isMobile) {
                // Mobile: vertical layout, use full width
                w = parentW;
                h = Math.max(650, parentW * 1.8); // Compact vertical flow
            } else {
                // Desktop: horizontal layout
                const contentWidth = M + imgW + 60 + modelW + 60 + imgW + M;
                w = Math.min(contentWidth, parentW);
                h = Math.max(400, Math.round(w * 0.45));
            }

            p.resizeCanvas(w, h);
        };

        // Pull site colors from CSS variables to match light/dark themes
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

        function getStageAndProgress() {
            const t = (p.millis() - t0) % totalMs;
            let acc = 0;
            for (const [name, dur] of timeline) {
                if (t < acc + dur) {
                    const prog = (t - acc) / dur;
                    return { name, prog };
                }
                acc += dur;
            }
            return { name: 'pause', prog: 0 };
        }

        function drawArrow(x1, y1, x2, y2, opts) {
            const pal = getPalette();
            const color = (opts && opts.color) || pal.accent;
            const weight = (opts && opts.weight) || 2;
            const alpha = (opts && opts.alpha) != null ? opts.alpha : 1;
            const dashed = (opts && opts.dashed) || false;
            p.push();
            p.stroke(p.color(p.red(p.color(color)), p.green(p.color(color)), p.blue(p.color(color)), 255 * alpha));
            p.strokeWeight(weight);
            if (dashed && p.drawingContext && p.drawingContext.setLineDash) {
                p.drawingContext.setLineDash([6, 6]);
            }
            p.fill(p.color(color));
            p.line(x1, y1, x2, y2);
            const a = Math.atan2(y2 - y1, x2 - x1);
            const L = 8;
            p.translate(x2, y2);
            p.rotate(a);
            p.triangle(0, 0, -L, -4, -L, 4);
            p.pop();
        }

        function drawBox(x, y, w, h, label, isMiro = false) {
            const pal = getPalette();
            p.push();
            p.noStroke();
            if (p.drawingContext) {
                p.drawingContext.shadowColor = 'rgba(0,0,0,0.25)';
                p.drawingContext.shadowBlur = 12;
            }
            p.fill(p.color(pal.card));
            p.rect(x, y, w, h, 10);
            p.noFill();
            if (isMiro) {
                // MIRO box gets accent border
                p.stroke(p.color(pal.accent));
                p.strokeWeight(2);
                p.rect(x + 1, y + 1, w - 2, h - 2, 10);
            } else {
                p.stroke('rgba(255,255,255,0.06)');
                p.strokeWeight(1);
                p.rect(x + 0.5, y + 0.5, w - 1, h - 1, 10);
            }
            p.noStroke();
            if (isMiro) {
                // Special styling for MIRO label - larger, centered, with accent color
                p.fill(p.color(pal.accent));
                p.textSize(22);
                p.textStyle(p.BOLD);
                p.textAlign(p.CENTER, p.CENTER);
                p.text(label, x + w / 2, y + h / 2);
            } else {
                p.fill(p.color(pal.fg));
                p.textSize(12);
                p.textAlign(p.CENTER, p.TOP);
                p.text(label, x + w / 2, y + 6);
            }
            p.pop();
        }

        function drawVector(x, y, w, h, n, progress) {
            const pad = 8;
            const barWidth = (w - pad * (n + 1)) / n;
            const by = y + pad + 16;
            const barAreaH = h - (pad * 2 + 16);
            for (let i = 0; i < n; i++) {
                const val = p.noise(i * 0.37 + progress * 2.1);
                const barH = barAreaH * val;
                p.fill(90, 120, 220);
                p.noStroke();
                p.rect(x + pad + i * (barWidth + pad), by + (barAreaH - barH), barWidth, barH, 3);
            }
        }

        function drawNoiseOver(imgX, imgY, imgW, imgH, alpha, heavy) {
            if (!img || alpha <= 0) return;

            p.push();
            // Formula: 0.8*image + 0.2*noise (when alpha = 1)
            const noiseWeight = 0.4 * alpha; // Noise contribution: 0.0 -> 0.2
            const imageWeight = 1.0 - 0.4 * alpha; // Image contribution: 1.0 -> 0.8

            // Draw using pixel manipulation for Gaussian noise
            p.loadPixels();
            if (img.width > 0) {
                // Get a temporary copy of the image region
                const tempImg = p.get(imgX, imgY, imgW, imgH);
                tempImg.loadPixels();

                // Add Gaussian noise to each pixel in RGB space
                const stdDev = 80; // Standard deviation for Gaussian noise
                for (let i = 0; i < tempImg.pixels.length; i += 4) {
                    // Generate Gaussian noise for each RGB channel (mean=0, std=stdDev)
                    const noiseR = p.randomGaussian(0, stdDev);
                    const noiseG = p.randomGaussian(0, stdDev);
                    const noiseB = p.randomGaussian(0, stdDev);

                    // Blend: imageWeight*image + noiseWeight*noise
                    tempImg.pixels[i] = p.constrain(imageWeight * tempImg.pixels[i] + noiseWeight * noiseR, 0, 255);
                    tempImg.pixels[i + 1] = p.constrain(imageWeight * tempImg.pixels[i + 1] + noiseWeight * noiseG, 0, 255);
                    tempImg.pixels[i + 2] = p.constrain(imageWeight * tempImg.pixels[i + 2] + noiseWeight * noiseB, 0, 255);
                    // Alpha channel stays the same (i+3)
                }

                tempImg.updatePixels();
                p.image(tempImg, imgX, imgY, imgW, imgH);
            }
            p.pop();
        }

        function lerp(a, b, t) { return a + (b - a) * t; }
        function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

        p.draw = () => {
            if (!playing) return;
            // Transparent canvas to blend with page background
            p.clear();

            const W = p.width;
            const H = p.height;
            const M = 20;
            const isMobile = W < 700;

            // Layout - different for mobile vs desktop
            let imgW, imgH, imgX, imgY, capW, capH, capX, capY;
            let rewardsX, rewardsY, rewardsW, rewardsH;
            let vecX, vecY, vecW, vecH;
            let modelX, modelY, modelW, modelH;
            let outX, outY;

            if (isMobile) {
                // Mobile: vertical layout (compact)
                imgW = Math.min(W * 0.55, 180);
                imgH = imgW * 0.66;
                imgX = W / 2 - imgW / 2; // Center
                imgY = M + 20;

                capW = imgW;
                capH = 40;
                capX = imgX;
                capY = imgY + imgH + 8;

                // Rewards below caption
                rewardsW = Math.min(W * 0.7, 200);
                rewardsH = 100;
                rewardsX = W / 2 - rewardsW / 2;
                rewardsY = capY + capH + 25;

                // Score vector below rewards
                vecW = Math.min(W * 0.65, 170);
                vecH = 60;
                vecX = W / 2 - vecW / 2;
                vecY = rewardsY + rewardsH + 20;

                // MIRO denoiser below scores
                modelW = Math.min(W * 0.7, 200);
                modelH = 85;
                modelX = W / 2 - modelW / 2;
                modelY = vecY + vecH + 25;

                // Output below denoiser
                outX = W / 2 - imgW / 2;
                outY = modelY + modelH + 25;
            } else {
                // Desktop: horizontal layout
                imgW = Math.min(W * 0.22, 240);
                imgH = imgW * 0.66;
                imgX = M;
                imgY = H * 0.38;

                capW = imgW;
                capH = 45;
                capX = M;
                capY = imgY + imgH + 12;

                rewardsX = imgX + imgW + 100;
                rewardsY = imgY - 12;
                rewardsW = Math.max(160, W * 0.16);
                rewardsH = imgH + capH + 35;

                vecX = rewardsX + rewardsW + 50;
                vecY = rewardsY;
                vecW = Math.max(120, W * 0.12);
                vecH = rewardsH;

                modelX = imgX + imgW + 60;
                modelY = rewardsY;
                modelW = Math.max(200, W * 0.19);
                modelH = rewardsH;

                outX = modelX + modelW + 60;
                outY = modelY + modelH / 2 - (imgW * 0.66) / 2;
            }

            const stage = getStageAndProgress();
            const st = stage.name;
            const prog = easeInOut(stage.prog);
            const pal = getPalette();

            // Targets for moving into rewards (with scaling)
            const imgInRewardsScale = 0.55;
            const imgInRewardsW = imgW * imgInRewardsScale;
            const imgInRewardsH = imgH * imgInRewardsScale;
            const capInRewardsW = capW * imgInRewardsScale;
            const capInRewardsH = capH * imgInRewardsScale;
            const rewardsCenterX = rewardsX + rewardsW / 2 - imgInRewardsW / 2;
            const rewardsCenterY = rewardsY + 28;
            const capInRewardsX = rewardsCenterX;
            const capInRewardsY = rewardsCenterY + imgInRewardsH + 6;

            // Position of "scores back" vector - above image on desktop, uses vecX/vecY on mobile
            const leftVecW = isMobile ? vecW : imgW * 0.85;
            const leftVecH = isMobile ? vecH : 65;
            const leftVecX = isMobile ? vecX : imgX;
            const leftVecY = isMobile ? vecY : Math.max(M + 10, imgY - leftVecH - 50);

            // Calculate visibility states first
            let rewardsAlpha = 1;
            if (st === 'rewards_disappear') rewardsAlpha = 1 - prog;
            if (st === 'scores_back' || st === 'noise_input' || st === 'denoiser_appear' || st === 'to_denoiser' || st === 'clean_output' || st === 'pause') rewardsAlpha = 0;

            // Image and caption animated positions (with scaling)
            let imgPos = { x: imgX, y: imgY, w: imgW, h: imgH, a: 1 };
            let capPos = { x: capX, y: capY, w: capW, h: capH, a: 1 };

            if (st === 'move_to_rewards') {
                imgPos.x = lerp(imgX, rewardsCenterX, prog);
                imgPos.y = lerp(imgY, rewardsCenterY, prog);
                imgPos.w = lerp(imgW, imgInRewardsW, prog);
                imgPos.h = lerp(imgH, imgInRewardsH, prog);
                capPos.x = lerp(capX, capInRewardsX, prog);
                capPos.y = lerp(capY, capInRewardsY, prog);
                capPos.w = lerp(capW, capInRewardsW, prog);
                capPos.h = lerp(capH, capInRewardsH, prog);
            } else if (st === 'emit_scores' || st === 'rewards_disappear') {
                imgPos = { x: rewardsCenterX, y: rewardsCenterY, w: imgInRewardsW, h: imgInRewardsH, a: 0 };
                capPos = { x: capInRewardsX, y: capInRewardsY, w: capInRewardsW, h: capInRewardsH, a: 0 };
            } else if (st === 'scores_back') {
                imgPos.a = Math.min(1, prog * 1.2);
                capPos.a = Math.min(1, prog * 1.2);
            } else if (st === 'to_denoiser') {
                const imgInModelScale = 0.5;
                const imgInModelW = imgW * imgInModelScale;
                const imgInModelH = imgH * imgInModelScale;
                const capInModelW = capW * imgInModelScale;
                const capInModelH = capH * imgInModelScale;
                const targetX = modelX + modelW / 2 - imgInModelW / 2;
                const targetY = modelY + 30;
                imgPos.x = lerp(imgX, targetX, prog);
                imgPos.y = lerp(imgY, targetY, prog);
                imgPos.w = lerp(imgW, imgInModelW, prog);
                imgPos.h = lerp(imgH, imgInModelH, prog);
                imgPos.a = 1 - prog;
                capPos.x = lerp(capX, targetX, prog);
                capPos.y = lerp(capY, targetY + imgInModelH + 6, prog);
                capPos.w = lerp(capW, capInModelW, prog);
                capPos.h = lerp(capH, capInModelH, prog);
                capPos.a = 1 - prog;
            } else if (st === 'clean_output' || st === 'pause') {
                // Keep inputs hidden after they've entered the denoiser
                imgPos.a = 0;
                capPos.a = 0;
            }

            // === DRAW PHASE 1: Elements that go under boxes ===

            // Draw image (scaled)
            if (imgPos.a > 0) {
                p.push();
                if (imgPos.a < 1) p.tint(255, 255 * imgPos.a);
                if (img) p.image(img, imgPos.x, imgPos.y, imgPos.w, imgPos.h);
                else { p.fill(230); p.rect(imgPos.x, imgPos.y, imgPos.w, imgPos.h, 6); }
                p.pop();
            }

            // Draw caption box (scaled, with improved styling)
            if (capPos.a > 0) {
                p.push();
                if (capPos.a < 1) p.drawingContext.globalAlpha = capPos.a;

                const padding = 8 * (capPos.w / capW);
                const iconSize = 12 * (capPos.h / capH);

                // Background box
                p.fill('rgba(255,255,255,0.03)');
                p.noStroke();
                p.rect(capPos.x - padding, capPos.y, capPos.w + padding * 2, capPos.h, 6);

                // Border with subtle gradient effect
                p.noFill();
                p.stroke('rgba(255,255,255,0.12)');
                p.strokeWeight(1);
                p.rect(capPos.x - padding, capPos.y, capPos.w + padding * 2, capPos.h, 6);

                // Quote icon (decorative)
                p.fill(p.color(pal.muted));
                p.noStroke();
                p.textSize(iconSize);
                p.textAlign(p.LEFT, p.CENTER);
                p.textStyle(p.BOLD);
                p.text('❝', capPos.x - padding + 6, capPos.y + capPos.h / 2);

                // Caption label
                const labelSize = 9 * (capPos.h / capH);
                const textSize = 11 * (capPos.h / capH);
                const textX = capPos.x - padding + 20;
                const verticalSpacing = 7 * (capPos.h / capH);

                p.fill(p.color(pal.muted));
                p.textSize(labelSize);
                p.textStyle(p.NORMAL);
                p.textAlign(p.LEFT, p.CENTER);
                p.text('caption', textX, capPos.y + capPos.h / 2 - verticalSpacing);

                // Caption text (the actual caption)
                p.fill(p.color(pal.fg));
                p.textSize(textSize);
                p.textStyle(p.ITALIC);
                p.text('"a scenic volcano"', textX, capPos.y + capPos.h / 2 + verticalSpacing);

                p.pop();
            }

            // === DRAW PHASE 2: Boxes (drawn on top) ===

            // Rewards block
            if (rewardsAlpha > 0) {
                p.push();
                if (rewardsAlpha < 1) p.drawingContext.globalAlpha = rewardsAlpha;
                drawBox(rewardsX, rewardsY, rewardsW, rewardsH, 'Rewards r₁,...,rₙ');
                drawVector(rewardsX, rewardsY, rewardsW, rewardsH, 7, p.millis() * 0.001); // Animated histogram with 7 bins
                p.pop();
            }

            // Score vector box - animates from rewards, then stays fixed
            let vecPos = { x: leftVecX, y: leftVecY, w: leftVecW, h: leftVecH, a: 0 };
            if (st === 'emit_scores') {
                // Animate from inside rewards to final position
                const startX = rewardsX + rewardsW / 2 - leftVecW / 2;
                const startY = rewardsY + rewardsH / 2 - leftVecH / 2;
                vecPos.x = lerp(startX, leftVecX, prog);
                vecPos.y = lerp(startY, leftVecY, prog);
                vecPos.a = prog;
            } else if (st === 'rewards_disappear' || st === 'scores_back' || st === 'noise_input' || st === 'denoiser_appear') {
                // Stay fixed at final position
                vecPos.a = 1;
            } else if (st === 'to_denoiser') {
                // Move into denoiser and fade out
                const targetX = modelX + modelW / 2 - leftVecW / 2;
                const targetY = modelY + modelH / 2 - leftVecH / 2;
                vecPos.x = lerp(leftVecX, targetX, prog);
                vecPos.y = lerp(leftVecY, targetY, prog);
                vecPos.a = 1 - prog;
            } else if (st === 'clean_output' || st === 'pause') {
                // Keep hidden after entering denoiser
                vecPos.a = 0;
            }

            // Score vector box
            if (vecPos.a > 0) {
                p.push();
                if (vecPos.a < 1) p.drawingContext.globalAlpha = vecPos.a;
                drawBox(vecPos.x, vecPos.y, vecPos.w, vecPos.h, 'scores ŝ');
                drawVector(vecPos.x, vecPos.y, vecPos.w, vecPos.h, 7, 0); // Static histogram with 7 bins
                p.pop();
            }

            // Noise buildup on input (only when input is visible)
            if ((st === 'noise_input' || st === 'denoiser_appear' || st === 'to_denoiser') && imgPos.a > 0) {
                const a = st === 'noise_input' ? prog : 1;
                drawNoiseOver(imgPos.x, imgPos.y, imgPos.w, imgPos.h, a, true);
            }

            // MIRO denoiser box
            let modelAlpha = 0;
            if (st === 'denoiser_appear') modelAlpha = prog;
            if (st === 'to_denoiser' || st === 'clean_output' || st === 'pause') modelAlpha = 1;

            if (modelAlpha > 0) {
                p.push();
                if (modelAlpha < 1) p.drawingContext.globalAlpha = modelAlpha;
                drawBox(modelX, modelY, modelW, modelH, 'MIRO', true);
                p.pop();
            }

            // Output (clean) image - animates from inside denoiser to the right
            const outW = imgW;
            const outH = imgH;
            if (st === 'clean_output' || st === 'pause') {
                const a = st === 'clean_output' ? prog : 1;
                const startX = modelX + modelW / 2 - outW / 2;
                const startY = modelY + modelH / 2 - outH / 2;
                const currentX = st === 'clean_output' ? lerp(startX, outX, prog) : outX;
                const currentY = st === 'clean_output' ? lerp(startY, outY, prog) : outY;
                p.push();
                if (a < 1) p.tint(255, 255 * a);
                if (img) p.image(img, currentX, currentY, outW, outH); else { p.fill(230); p.rect(currentX, currentY, outW, outH, 6); }
                p.pop();
            }

            // === DRAW PHASE 3: Labels and legends ===

            // Legends
            p.fill(p.color(pal.muted));
            p.textAlign(p.CENTER, p.TOP);
            p.textSize(11);
            if (st === 'clean_output' || st === 'pause') {
                const labelY = isMobile ? outY - 18 : outY - 22;
                p.text('denoised image', outX + outW / 2, labelY);
            }
        };
    };

    new p5(sketch, document.getElementById('miroAnimation'));
})();


