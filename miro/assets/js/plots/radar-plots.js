(function () {
    'use strict';

    const D = window.MIRO_DATA;

    function plotRadars() {
        plotRadarSpecialists();
        plotRadarGeneval();
    }

    // Wrapper for compatibility
    function plotRadar() {
        plotRadarSpecialists();
    }

    function plotRadarSpecialists() {
        const container = document.getElementById('radar_specialists');
        if (!container) return;

        const s = D.radars.specialists;
        const modelSel = document.getElementById('radarModel');
        const norm = document.getElementById('radarNormalized');
        const compare = modelSel ? modelSel.value : 'ImageReward';

        // Clear container
        container.innerHTML = '';

        // Get theme colors
        const rootStyles = getComputedStyle(document.documentElement);
        const fgColor = rootStyles.getPropertyValue('--fg').trim() || '#e6e6e6';
        const isLightMode = fgColor === '#1a1a1a';
        const textColor = isLightMode ? '#1f2937' : fgColor;

        // Always normalize to 0-5 scale based on ranges (like TikZ)
        function normalizeToScale(vals) {
            return vals.map((v, i) => {
                const key = s.axes[i];
                const rng = s.ranges[key === "OpenAI CLIP" ? "OpenAI" : key] || [0, 1];
                const [mn, mx] = rng;
                // Scale to 0-5 range
                return 5 * (v - mn) / (mx - mn);
            });
        }

        const miroNorm = normalizeToScale(s.miro);
        const compareNorm = normalizeToScale(s.others[compare]);
        const numAxes = s.axes.length;

        // SVG setup
        const width = container.offsetWidth;
        const height = 400;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 60;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', height);

        // Background
        svg.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', isLightMode ? '#ffffff' : '#1a1a1a')
            .attr('opacity', isLightMode ? 1 : 0.3);

        const g = svg.append('g')
            .attr('transform', `translate(${centerX},${centerY})`);

        // Draw circular grid
        const levels = 5;
        for (let i = 1; i <= levels; i++) {
            g.append('circle')
                .attr('r', radius * i / levels)
                .attr('fill', 'none')
                .attr('stroke', isLightMode ? '#333' : '#666')
                .attr('stroke-opacity', 0.2);
        }

        // Axis colors matching reward colors
        const axisColors = {
            'Pick': '#ff96c8',
            'Aesthetic': '#69c869',
            'OpenAI CLIP': '#4fd2c8',
            'HPSv2': '#6496ff',
            'CLIP': '#4fd2c8',
            'ImageReward': '#ff6978'
        };

        // Draw axes
        const angleSlice = Math.PI * 2 / numAxes;
        s.axes.forEach((axis, i) => {
            const angle = angleSlice * i - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            // Axis line
            g.append('line')
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', x)
                .attr('y2', y)
                .attr('stroke', isLightMode ? '#333' : '#666')
                .attr('stroke-opacity', 0.3);

            // Axis label with color and rotation
            // Increase spacing for specific labels to avoid overlap
            let extraSpacing = 0;
            if (axis === 'ImageReward') extraSpacing = 30;
            else if (axis === 'Aesthetic') extraSpacing = 10;
            else if (axis === 'OpenAI CLIP') extraSpacing = 20;

            const labelRadius = radius + 30 + extraSpacing;
            const labelX = Math.cos(angle) * labelRadius;
            const labelY = Math.sin(angle) * labelRadius;

            // Calculate rotation for label (align with axis but keep readable)
            // Don't rotate Pick (top) and HPSv2 (bottom)
            let rotation = 0;
            if (axis !== 'Pick' && axis !== 'HPSv2') {
                rotation = (angle * 180 / Math.PI);
                // Keep text upright: flip if it would be upside down
                if (rotation > 90) {
                    rotation -= 180;
                } else if (rotation < -90) {
                    rotation += 180;
                }
            }

            const axisColor = axisColors[axis] || textColor;
            g.append('text')
                .attr('x', labelX)
                .attr('y', labelY)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('fill', axisColor)
                .attr('font-size', '12px')
                .attr('font-weight', '600')
                .attr('transform', `rotate(${rotation}, ${labelX}, ${labelY})`)
                .text(axis);

            // Add graduation value labels (1st and 5th level)
            const key = axis === "OpenAI CLIP" ? "OpenAI" : axis;
            const rng = s.ranges[key] || [0, 1];
            const [minVal, maxVal] = rng;
            const firstGrad = minVal + (maxVal - minVal) / 5;

            // Position for 1st graduation (at radius 1/5)
            const r1 = radius / 5;
            const x1 = Math.cos(angle) * r1;
            const y1 = Math.sin(angle) * r1;

            // Position for 5th graduation (at radius 5/5)
            const r5 = radius;
            const x5 = Math.cos(angle) * r5;
            const y5 = Math.sin(angle) * r5;

            const valueLabelColor = isLightMode ? '#666' : '#999';
            const bgColor = isLightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)';

            // Format numbers appropriately
            const formatValue = (val) => {
                if (val >= 1) return val.toFixed(1);
                return val.toFixed(2);
            };

            // Add background rectangles for better readability
            [
                { x: x1, y: y1, val: formatValue(firstGrad) },
                { x: x5, y: y5, val: formatValue(maxVal) }
            ].forEach(({ x, y, val }) => {
                // Add white background
                const bbox = { width: 24, height: 14 };
                g.append('rect')
                    .attr('x', x - bbox.width / 2)
                    .attr('y', y - bbox.height / 2)
                    .attr('width', bbox.width)
                    .attr('height', bbox.height)
                    .attr('fill', bgColor)
                    .attr('rx', 2);

                // Add text
                g.append('text')
                    .attr('x', x)
                    .attr('y', y)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'middle')
                    .attr('fill', valueLabelColor)
                    .attr('font-size', '9px')
                    .attr('font-weight', '500')
                    .text(val);
            });
        });

        // Create radar path
        function radarPath(values) {
            return values.map((val, i) => {
                const angle = angleSlice * i - Math.PI / 2;
                const r = radius * val / 5;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                return [x, y];
            });
        }

        const colors = {
            ImageReward: '#ff6978',
            HPSv2: '#6496ff',
            Aesthetic: '#69c869',
            SciScore: '#c769e6',
            CLIP: '#4fd2c8',
            VQA: '#e1d34f',
            Pick: '#ff96c8',
            Baseline: '#bc8f8f'
        };

        const compareColor = colors[compare] || '#888';

        // Draw comparison model area (initially at center for animation)
        const comparePath = radarPath(compareNorm);
        const comparePolygon = g.append('polygon')
            .attr('points', comparePath.map(p => p.join(',')).join(' '))
            .attr('fill', compareColor)
            .attr('fill-opacity', 0.2)
            .attr('stroke', compareColor)
            .attr('stroke-width', 2.5)
            .attr('transform', 'scale(0)');

        // Draw MIRO area (initially at center for animation)
        const miroPath = radarPath(miroNorm);
        const miroPolygon = g.append('polygon')
            .attr('points', miroPath.map(p => p.join(',')).join(' '))
            .attr('fill', '#ff9a50')
            .attr('fill-opacity', 0.3)
            .attr('stroke', '#ff9a50')
            .attr('stroke-width', 3)
            .attr('transform', 'scale(0)');

        // Create tooltip
        const tooltip = d3.select(container)
            .append('div')
            .style('position', 'absolute')
            .style('background', isLightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.9)')
            .style('border', '1px solid ' + (isLightMode ? '#ccc' : '#444'))
            .style('border-radius', '6px')
            .style('padding', '10px')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('font-size', '13px')
            .style('color', textColor)
            .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
            .style('z-index', '1000');

        // Draw points with tooltips (initially hidden for animation)
        const miroPoints = [];
        miroPath.forEach((point, i) => {
            const axisName = s.axes[i];
            const miroValue = s.miro[i];
            const compareValue = s.others[compare][i];

            const circle = g.append('circle')
                .attr('cx', point[0])
                .attr('cy', point[1])
                .attr('r', 0)
                .attr('fill', '#ff9a50')
                .style('cursor', 'pointer')
                .on('mouseover', function (event) {
                    d3.select(this).attr('r', 6);
                    tooltip
                        .style('opacity', 1)
                        .style('left', (event.pageX + 15) + 'px')
                        .style('top', (event.pageY - 15) + 'px')
                        .html(`
              <div style="font-weight: 600; margin-bottom: 6px; color: ${axisColors[axisName] || textColor}">${axisName}</div>
              <div style="color: #ff9a50; font-weight: 500;">MIRO: ${miroValue.toFixed(3)}</div>
              <div style="color: ${compareColor}; font-weight: 500;">${compare}: ${compareValue.toFixed(3)}</div>
            `);
                })
                .on('mousemove', function (event) {
                    tooltip
                        .style('left', (event.pageX + 15) + 'px')
                        .style('top', (event.pageY - 15) + 'px');
                })
                .on('mouseout', function () {
                    d3.select(this).attr('r', 4);
                    tooltip.style('opacity', 0);
                });
            miroPoints.push(circle);
        });

        const comparePoints = [];
        comparePath.forEach((point, i) => {
            const axisName = s.axes[i];
            const miroValue = s.miro[i];
            const compareValue = s.others[compare][i];

            const circle = g.append('circle')
                .attr('cx', point[0])
                .attr('cy', point[1])
                .attr('r', 0)
                .attr('fill', compareColor)
                .style('cursor', 'pointer')
                .on('mouseover', function (event) {
                    d3.select(this).attr('r', 5.5);
                    tooltip
                        .style('opacity', 1)
                        .style('left', (event.pageX + 15) + 'px')
                        .style('top', (event.pageY - 15) + 'px')
                        .html(`
              <div style="font-weight: 600; margin-bottom: 6px; color: ${axisColors[axisName] || textColor}">${axisName}</div>
              <div style="color: #ff9a50; font-weight: 500;">MIRO: ${miroValue.toFixed(3)}</div>
              <div style="color: ${compareColor}; font-weight: 500;">${compare}: ${compareValue.toFixed(3)}</div>
            `);
                })
                .on('mousemove', function (event) {
                    tooltip
                        .style('left', (event.pageX + 15) + 'px')
                        .style('top', (event.pageY - 15) + 'px');
                })
                .on('mouseout', function () {
                    d3.select(this).attr('r', 3.5);
                    tooltip.style('opacity', 0);
                });
            comparePoints.push(circle);
        });

        // Legend at bottom left
        const legendX = -centerX + 20;
        const legendY = centerY - 50;
        const legend = g.append('g')
            .attr('transform', `translate(${legendX}, ${legendY})`);

        legend.append('rect')
            .attr('x', 0).attr('y', 0)
            .attr('width', 15).attr('height', 3)
            .attr('fill', '#ff9a50');

        legend.append('text')
            .attr('x', 20).attr('y', 3)
            .attr('fill', textColor)
            .attr('font-size', '12px')
            .text('MIRO');

        legend.append('rect')
            .attr('x', 0).attr('y', 15)
            .attr('width', 15).attr('height', 3)
            .attr('fill', compareColor);

        legend.append('text')
            .attr('x', 20).attr('y', 18)
            .attr('fill', textColor)
            .attr('font-size', '12px')
            .text(compare);

        // Store animation function on container for later triggering
        container._animateRadar = function () {
            const animationDuration = 1800; // 1.8 seconds for expansion (slower)
            const pointDelay = 300; // delay before points appear

            // Reset to initial state
            comparePolygon.attr('transform', 'scale(0)');
            miroPolygon.attr('transform', 'scale(0)');
            comparePoints.forEach(point => point.attr('r', 0));
            miroPoints.forEach(point => point.attr('r', 0));

            // Animate comparison polygon with elastic easing
            comparePolygon
                .transition()
                .duration(animationDuration)
                .ease(d3.easeElasticOut.amplitude(1).period(0.6))
                .attr('transform', 'scale(1)');

            // Animate MIRO polygon with elastic easing (slightly delayed)
            miroPolygon
                .transition()
                .delay(250)
                .duration(animationDuration)
                .ease(d3.easeElasticOut.amplitude(1).period(0.6))
                .attr('transform', 'scale(1)');

            // Animate comparison points
            comparePoints.forEach((point, i) => {
                point
                    .transition()
                    .delay(animationDuration + pointDelay + i * 80)
                    .duration(400)
                    .ease(d3.easeBackOut.overshoot(1.5))
                    .attr('r', 3.5);
            });

            // Animate MIRO points
            miroPoints.forEach((point, i) => {
                point
                    .transition()
                    .delay(animationDuration + pointDelay + 250 + i * 80)
                    .duration(400)
                    .ease(d3.easeBackOut.overshoot(1.5))
                    .attr('r', 4);
            });
        };
    }

    function plotRadarGeneval() {
        const container = document.getElementById('radar_geneval');
        if (!container) return;

        const g = D.radars.geneval;
        const modelSel = document.getElementById('radarModel');
        const compare = modelSel ? modelSel.value : 'Baseline';

        // Clear container
        container.innerHTML = '';

        // Get theme colors
        const rootStyles = getComputedStyle(document.documentElement);
        const fgColor = rootStyles.getPropertyValue('--fg').trim() || '#e6e6e6';
        const isLightMode = fgColor === '#1a1a1a';
        const textColor = isLightMode ? '#1f2937' : fgColor;

        // Normalize to 0-5 scale based on ranges (like TikZ)
        function normalizeToScale(vals) {
            return vals.map((v, i) => {
                const key = g.axes[i];
                // Map axis names to range keys
                const rangeKey = {
                    'Single Object': 'Single',
                    'Two Objects': 'Two',
                    'Color Attribution': 'ColorAttr',
                    'Position': 'Position',
                    'Counting': 'Counting',
                    'Colors': 'Colors'
                }[key] || key;
                const rng = g.ranges[rangeKey] || [0, 100];
                const [mn, mx] = rng;
                // Scale to 0-5 range
                return 5 * (v - mn) / (mx - mn);
            });
        }

        const miroNorm = normalizeToScale(g.miro);
        const compareNorm = normalizeToScale(g.others[compare] || g.others['Baseline']);
        const numAxes = g.axes.length;

        // SVG setup
        const width = container.offsetWidth;
        const height = 400;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 60;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', height);

        // Background
        svg.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', isLightMode ? '#ffffff' : '#1a1a1a')
            .attr('opacity', isLightMode ? 1 : 0.3);

        const gSvg = svg.append('g')
            .attr('transform', `translate(${centerX},${centerY})`);

        // Draw circular grid
        const levels = 5;
        for (let i = 1; i <= levels; i++) {
            gSvg.append('circle')
                .attr('r', radius * i / levels)
                .attr('fill', 'none')
                .attr('stroke', isLightMode ? '#333' : '#666')
                .attr('stroke-opacity', 0.2);
        }

        // Draw axes
        const angleSlice = Math.PI * 2 / numAxes;
        g.axes.forEach((axis, i) => {
            const angle = angleSlice * i - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            // Axis line
            gSvg.append('line')
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', x)
                .attr('y2', y)
                .attr('stroke', isLightMode ? '#333' : '#666')
                .attr('stroke-opacity', 0.3);

            // Axis label with rotation
            // Increase spacing for specific labels to avoid overlap
            let extraSpacing = 0;
            if (axis === 'Position') extraSpacing = 10;
            else if (axis === 'Single Object') extraSpacing = 20;
            else if (axis === 'Color Attribution') extraSpacing = 30;

            const labelRadius = radius + 30 + extraSpacing;
            const labelX = Math.cos(angle) * labelRadius;
            const labelY = Math.sin(angle) * labelRadius;

            // Calculate rotation for label (align with axis but keep readable)
            // Don't rotate labels at top and bottom for readability
            let rotation = 0;
            const topBottomAxes = ['Two Objects', 'Counting']; // Top and bottom positions
            if (!topBottomAxes.includes(axis)) {
                rotation = (angle * 180 / Math.PI);
                // Keep text upright: flip if it would be upside down
                if (rotation > 90) {
                    rotation -= 180;
                } else if (rotation < -90) {
                    rotation += 180;
                }
            }

            gSvg.append('text')
                .attr('x', labelX)
                .attr('y', labelY)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('fill', textColor)
                .attr('font-size', '11px')
                .attr('font-weight', '500')
                .attr('transform', `rotate(${rotation}, ${labelX}, ${labelY})`)
                .text(axis);

            // Add graduation value labels (1st and 5th level)
            const rangeKey = {
                'Single Object': 'Single',
                'Two Objects': 'Two',
                'Color Attribution': 'ColorAttr',
                'Position': 'Position',
                'Counting': 'Counting',
                'Colors': 'Colors'
            }[axis] || axis;
            const rng = g.ranges[rangeKey] || [0, 100];
            const [minVal, maxVal] = rng;
            const firstGrad = minVal + (maxVal - minVal) / 5;

            // Position for 1st graduation (at radius 1/5)
            const r1 = radius / 5;
            const x1 = Math.cos(angle) * r1;
            const y1 = Math.sin(angle) * r1;

            // Position for 5th graduation (at radius 5/5)
            const r5 = radius;
            const x5 = Math.cos(angle) * r5;
            const y5 = Math.sin(angle) * r5;

            const valueLabelColor = isLightMode ? '#666' : '#999';
            const bgColor = isLightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)';

            // Format numbers (GenEval values are percentages)
            const formatValue = (val) => val.toFixed(0);

            // Add background rectangles for better readability
            [
                { x: x1, y: y1, val: formatValue(firstGrad) },
                { x: x5, y: y5, val: formatValue(maxVal) }
            ].forEach(({ x, y, val }) => {
                // Add background
                const bbox = { width: 24, height: 14 };
                gSvg.append('rect')
                    .attr('x', x - bbox.width / 2)
                    .attr('y', y - bbox.height / 2)
                    .attr('width', bbox.width)
                    .attr('height', bbox.height)
                    .attr('fill', bgColor)
                    .attr('rx', 2);

                // Add text
                gSvg.append('text')
                    .attr('x', x)
                    .attr('y', y)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'middle')
                    .attr('fill', valueLabelColor)
                    .attr('font-size', '9px')
                    .attr('font-weight', '500')
                    .text(val);
            });
        });

        // Create radar path (values already normalized to 0-5)
        function radarPath(values) {
            return values.map((val, i) => {
                const angle = angleSlice * i - Math.PI / 2;
                const r = radius * val / 5;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                return [x, y];
            });
        }

        const colors = {
            ImageReward: '#ff6978',
            HPSv2: '#6496ff',
            Aesthetic: '#69c869',
            SciScore: '#c769e6',
            CLIP: '#4fd2c8',
            VQA: '#e1d34f',
            Pick: '#ff96c8',
            Baseline: '#bc8f8f'
        };

        const compareColor = colors[compare] || '#888';

        // Draw comparison model area (initially at center for animation)
        const comparePath = radarPath(compareNorm);
        const comparePolygon = gSvg.append('polygon')
            .attr('points', comparePath.map(p => p.join(',')).join(' '))
            .attr('fill', compareColor)
            .attr('fill-opacity', 0.2)
            .attr('stroke', compareColor)
            .attr('stroke-width', 2.5)
            .attr('transform', 'scale(0)');

        // Draw MIRO area (initially at center for animation)
        const miroPath = radarPath(miroNorm);
        const miroPolygon = gSvg.append('polygon')
            .attr('points', miroPath.map(p => p.join(',')).join(' '))
            .attr('fill', '#ff9a50')
            .attr('fill-opacity', 0.3)
            .attr('stroke', '#ff9a50')
            .attr('stroke-width', 3)
            .attr('transform', 'scale(0)');

        // Create tooltip
        const tooltip = d3.select(container)
            .append('div')
            .style('position', 'absolute')
            .style('background', isLightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.9)')
            .style('border', '1px solid ' + (isLightMode ? '#ccc' : '#444'))
            .style('border-radius', '6px')
            .style('padding', '10px')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('font-size', '13px')
            .style('color', textColor)
            .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
            .style('z-index', '1000');

        // Draw points with tooltips (initially hidden for animation)
        const miroPoints = [];
        miroPath.forEach((point, i) => {
            const axisName = g.axes[i];
            const miroValue = g.miro[i];
            const compareValue = g.others[compare][i];

            const circle = gSvg.append('circle')
                .attr('cx', point[0])
                .attr('cy', point[1])
                .attr('r', 0)
                .attr('fill', '#ff9a50')
                .style('cursor', 'pointer')
                .on('mouseover', function (event) {
                    d3.select(this).attr('r', 6);
                    tooltip
                        .style('opacity', 1)
                        .style('left', (event.pageX + 15) + 'px')
                        .style('top', (event.pageY - 15) + 'px')
                        .html(`
              <div style="font-weight: 600; margin-bottom: 6px; color: ${textColor}">${axisName}</div>
              <div style="color: #ff9a50; font-weight: 500;">MIRO: ${miroValue.toFixed(1)}%</div>
              <div style="color: ${compareColor}; font-weight: 500;">${compare}: ${compareValue.toFixed(1)}%</div>
            `);
                })
                .on('mousemove', function (event) {
                    tooltip
                        .style('left', (event.pageX + 15) + 'px')
                        .style('top', (event.pageY - 15) + 'px');
                })
                .on('mouseout', function () {
                    d3.select(this).attr('r', 4);
                    tooltip.style('opacity', 0);
                });
            miroPoints.push(circle);
        });

        const comparePoints = [];
        comparePath.forEach((point, i) => {
            const axisName = g.axes[i];
            const miroValue = g.miro[i];
            const compareValue = g.others[compare][i];

            const circle = gSvg.append('circle')
                .attr('cx', point[0])
                .attr('cy', point[1])
                .attr('r', 0)
                .attr('fill', compareColor)
                .style('cursor', 'pointer')
                .on('mouseover', function (event) {
                    d3.select(this).attr('r', 5.5);
                    tooltip
                        .style('opacity', 1)
                        .style('left', (event.pageX + 15) + 'px')
                        .style('top', (event.pageY - 15) + 'px')
                        .html(`
              <div style="font-weight: 600; margin-bottom: 6px; color: ${textColor}">${axisName}</div>
              <div style="color: #ff9a50; font-weight: 500;">MIRO: ${miroValue.toFixed(1)}%</div>
              <div style="color: ${compareColor}; font-weight: 500;">${compare}: ${compareValue.toFixed(1)}%</div>
            `);
                })
                .on('mousemove', function (event) {
                    tooltip
                        .style('left', (event.pageX + 15) + 'px')
                        .style('top', (event.pageY - 15) + 'px');
                })
                .on('mouseout', function () {
                    d3.select(this).attr('r', 3.5);
                    tooltip.style('opacity', 0);
                });
            comparePoints.push(circle);
        });

        // Legend at bottom left
        const legendX = -centerX + 20;
        const legendY = centerY - 50;
        const legend = gSvg.append('g')
            .attr('transform', `translate(${legendX}, ${legendY})`);

        legend.append('rect')
            .attr('x', 0).attr('y', 0)
            .attr('width', 15).attr('height', 3)
            .attr('fill', '#ff9a50');

        legend.append('text')
            .attr('x', 20).attr('y', 3)
            .attr('fill', textColor)
            .attr('font-size', '12px')
            .text('MIRO');

        legend.append('rect')
            .attr('x', 0).attr('y', 15)
            .attr('width', 15).attr('height', 3)
            .attr('fill', compareColor);

        legend.append('text')
            .attr('x', 20).attr('y', 18)
            .attr('fill', textColor)
            .attr('font-size', '12px')
            .text(compare);

        // Store animation function on container for later triggering
        container._animateRadar = function () {
            const animationDuration = 1800; // 1.8 seconds for expansion (slower)
            const pointDelay = 300; // delay before points appear

            // Reset to initial state
            comparePolygon.attr('transform', 'scale(0)');
            miroPolygon.attr('transform', 'scale(0)');
            comparePoints.forEach(point => point.attr('r', 0));
            miroPoints.forEach(point => point.attr('r', 0));

            // Animate comparison polygon with elastic easing
            comparePolygon
                .transition()
                .duration(animationDuration)
                .ease(d3.easeElasticOut.amplitude(1).period(0.6))
                .attr('transform', 'scale(1)');

            // Animate MIRO polygon with elastic easing (slightly delayed)
            miroPolygon
                .transition()
                .delay(250)
                .duration(animationDuration)
                .ease(d3.easeElasticOut.amplitude(1).period(0.6))
                .attr('transform', 'scale(1)');

            // Animate comparison points
            comparePoints.forEach((point, i) => {
                point
                    .transition()
                    .delay(animationDuration + pointDelay + i * 80)
                    .duration(400)
                    .ease(d3.easeBackOut.overshoot(1.5))
                    .attr('r', 3.5);
            });

            // Animate MIRO points
            miroPoints.forEach((point, i) => {
                point
                    .transition()
                    .delay(animationDuration + pointDelay + 250 + i * 80)
                    .duration(400)
                    .ease(d3.easeBackOut.overshoot(1.5))
                    .attr('r', 4);
            });
        };
    }

    // Expose to global namespace
    window.MIRO = window.MIRO || {};
    window.MIRO.plotRadars = plotRadars;
    window.MIRO.plotRadar = plotRadar;
    window.MIRO.plotRadarSpecialists = plotRadarSpecialists;
    window.MIRO.plotRadarGeneval = plotRadarGeneval;
})();

