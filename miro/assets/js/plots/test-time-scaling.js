(function () {
    'use strict';

    const D = window.MIRO_DATA;

    function plotTTS() {
        const xs = D.testTimeScaling.x; // [1, 2, 4, 8, 16, 32, 64, 128]
        const metrics = [
            ['tts_aesthetic', 'Aesthetic', 'aesthetic', null],
            ['tts_imagereward', 'ImageReward', 'imagereward', { text: '16× faster', from: 128, to: 8, y: null }],
            ['tts_pick', 'PickScore', 'pick', { text: '32× faster', from: 128, to: 4, y: null }],
            ['tts_hpsv2', 'HPSv2', 'hpsv2', null]
        ];

        metrics.forEach(([id, label, key, arrow]) => {
            const container = document.getElementById(id);
            if (!container) return;

            container.innerHTML = '';

            const m = D.testTimeScaling[key];
            const data = xs.map((x, i) => ({ x, baseline: m.baseline[i], miro: m.miro[i] }));

            // Get theme colors
            const rootStyles = getComputedStyle(document.documentElement);
            const fgColor = rootStyles.getPropertyValue('--fg').trim() || '#e6e6e6';
            const mutedColor = rootStyles.getPropertyValue('--muted').trim() || '#b5b5b5';
            const isLightMode = fgColor === '#1a1a1a';

            // SVG setup - matching training curves dimensions
            const margin = { top: 40, right: 20, bottom: 50, left: 60 };
            const width = container.offsetWidth - margin.left - margin.right;
            const height = 280 - margin.top - margin.bottom;

            const svgContainer = d3.select(container)
                .append('svg')
                .attr('width', '100%')
                .attr('height', 280);

            // Background - matching training curves
            svgContainer.append('rect')
                .attr('width', '100%')
                .attr('height', '100%')
                .attr('fill', isLightMode ? '#ffffff' : '#1a1a1a')
                .attr('opacity', isLightMode ? 1 : 0.3);

            const svg = svgContainer.append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            // Scales - logarithmic x-axis (base 2)
            const xScale = d3.scaleLog()
                .base(2)
                .domain([1, 128])
                .range([0, width]);

            const yMin = d3.min(data, d => Math.min(d.baseline, d.miro));
            const yMax = d3.max(data, d => Math.max(d.baseline, d.miro));
            const yPadding = (yMax - yMin) * 0.1;
            const yScale = d3.scaleLinear()
                .domain([yMin - yPadding, yMax + yPadding])
                .range([height, 0]);

            // Grid - matching training curves style
            const gridColor = isLightMode ? '#333333' : fgColor;
            const gridOpacity = isLightMode ? 0.25 : 0.12;

            svg.append('g')
                .attr('class', 'grid')
                .attr('opacity', gridOpacity)
                .call(d3.axisLeft(yScale)
                    .tickSize(-width)
                    .tickFormat(''))
                .call(g => g.select('.domain').remove())
                .call(g => g.selectAll('.tick line').attr('stroke', gridColor));

            svg.append('g')
                .attr('class', 'grid')
                .attr('transform', `translate(0,${height})`)
                .attr('opacity', gridOpacity)
                .call(d3.axisBottom(xScale)
                    .tickValues([1, 2, 4, 8, 16, 32, 64, 128])
                    .tickSize(-height)
                    .tickFormat(''))
                .call(g => g.select('.domain').remove())
                .call(g => g.selectAll('.tick line').attr('stroke', gridColor));

            // Line generators
            const baselineLine = d3.line()
                .x(d => xScale(d.x))
                .y(d => yScale(d.baseline));

            const miroLine = d3.line()
                .x(d => xScale(d.x))
                .y(d => yScale(d.miro));

            // Draw lines - matching training curves thickness (initially hidden for animation)
            const baselinePath = svg.append('path')
                .datum(data)
                .attr('fill', 'none')
                .attr('stroke', '#bc8f8f')
                .attr('stroke-width', 2)
                .attr('d', baselineLine);

            // Calculate path length for animation
            const baselineLength = baselinePath.node().getTotalLength();
            baselinePath
                .attr('stroke-dasharray', baselineLength)
                .attr('stroke-dashoffset', baselineLength);

            const miroPath = svg.append('path')
                .datum(data)
                .attr('fill', 'none')
                .attr('stroke', '#ff9a50')
                .attr('stroke-width', 2)
                .attr('d', miroLine);

            const miroLength = miroPath.node().getTotalLength();
            miroPath
                .attr('stroke-dasharray', miroLength)
                .attr('stroke-dashoffset', miroLength);

            // Tooltip - matching training curves style
            const tooltip = d3.select(container)
                .append('div')
                .style('position', 'absolute')
                .style('background', 'rgba(0, 0, 0, 0.8)')
                .style('color', '#fff')
                .style('padding', '6px 10px')
                .style('border-radius', '4px')
                .style('font-size', '12px')
                .style('pointer-events', 'none')
                .style('opacity', 0)
                .style('z-index', '10');

            // Baseline points - circles like training curves (initially hidden)
            const baselinePoints = [];
            data.forEach(d => {
                const point = svg.append('circle')
                    .attr('cx', xScale(d.x))
                    .attr('cy', yScale(d.baseline))
                    .attr('r', 0)
                    .attr('fill', '#bc8f8f')
                    .style('cursor', 'pointer')
                    .on('mouseover', function (event) {
                        d3.select(this).attr('r', 5);
                        const formatValue = key === 'pick' ? d.baseline.toFixed(3) : d.baseline.toFixed(2);
                        tooltip
                            .style('opacity', 1)
                            .html(`Baseline<br>Best-of-${d.x}<br>Value: ${formatValue}`);
                    })
                    .on('mousemove', function (event) {
                        tooltip
                            .style('left', (event.pageX - container.offsetLeft + 10) + 'px')
                            .style('top', (event.pageY - container.offsetTop - 28) + 'px');
                    })
                    .on('mouseout', function () {
                        d3.select(this).attr('r', 3);
                        tooltip.style('opacity', 0);
                    });
                baselinePoints.push(point);
            });

            // MIRO points - circles like training curves (initially hidden)
            const miroPoints = [];
            data.forEach(d => {
                const point = svg.append('circle')
                    .attr('cx', xScale(d.x))
                    .attr('cy', yScale(d.miro))
                    .attr('r', 0)
                    .attr('fill', '#ff9a50')
                    .style('cursor', 'pointer')
                    .on('mouseover', function (event) {
                        d3.select(this).attr('r', 5);
                        const formatValue = key === 'pick' ? d.miro.toFixed(3) : d.miro.toFixed(2);
                        tooltip
                            .style('opacity', 1)
                            .html(`MIRO<br>Best-of-${d.x}<br>Value: ${formatValue}`);
                    })
                    .on('mousemove', function (event) {
                        tooltip
                            .style('left', (event.pageX - container.offsetLeft + 10) + 'px')
                            .style('top', (event.pageY - container.offsetTop - 28) + 'px');
                    })
                    .on('mouseout', function () {
                        d3.select(this).attr('r', 3);
                        tooltip.style('opacity', 0);
                    });
                miroPoints.push(point);
            });

            // Text colors (darker in light mode) - matching training curves
            const textColor = isLightMode ? '#1f2937' : fgColor;
            const axisColor = isLightMode ? '#4b5563' : fgColor;

            // Add x-axis
            const xTicks = [1, 2, 4, 8, 16, 32, 64, 128];
            svg.append('g')
                .attr('transform', `translate(0,${height})`)
                .call(d3.axisBottom(xScale)
                    .tickValues(xTicks)
                    .tickFormat((d, i) => i))
                .call(g => g.select('.domain').attr('stroke', axisColor))
                .call(g => g.selectAll('.tick line').attr('stroke', axisColor))
                .call(g => g.selectAll('.tick text').attr('fill', axisColor).attr('font-size', '11px'));

            // Add y-axis
            svg.append('g')
                .call(d3.axisLeft(yScale)
                    .ticks(5)
                    .tickFormat(d => key === 'pick' ? d.toFixed(3) : d.toFixed(2)))
                .call(g => g.select('.domain').attr('stroke', axisColor))
                .call(g => g.selectAll('.tick line').attr('stroke', axisColor))
                .call(g => g.selectAll('.tick text').attr('fill', axisColor).attr('font-size', '11px'));

            // Add title
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', -15)
                .attr('text-anchor', 'middle')
                .attr('fill', textColor)
                .attr('font-size', '14px')
                .attr('font-weight', '500')
                .text(label);

            // Add x-axis label
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height + 40)
                .attr('text-anchor', 'middle')
                .attr('fill', axisColor)
                .attr('font-size', '11px')
                .text('Best-of-2^N');

            // Legend at bottom right - matching training curves
            const legend = svg.append('g')
                .attr('transform', `translate(${width - 100}, ${height - 35})`);

            legend.append('line')
                .attr('x1', 0).attr('x2', 20)
                .attr('y1', 0).attr('y2', 0)
                .attr('stroke', '#bc8f8f')
                .attr('stroke-width', 2);

            legend.append('text')
                .attr('x', 25).attr('y', 4)
                .attr('fill', axisColor)
                .attr('font-size', '11px')
                .text('Baseline');

            legend.append('line')
                .attr('x1', 0).attr('x2', 20)
                .attr('y1', 15).attr('y2', 15)
                .attr('stroke', '#ff9a50')
                .attr('stroke-width', 2);

            legend.append('text')
                .attr('x', 25).attr('y', 19)
                .attr('fill', axisColor)
                .attr('font-size', '11px')
                .text('MIRO');

            // Efficiency arrow annotation (initially hidden for animation)
            let arrowElements = null;
            if (arrow) {
                const arrowColor = '#ff6978';
                const fromPoint = data.find(d => d.x === arrow.from);
                const y = arrow.y !== null ? arrow.y : fromPoint.baseline;
                const arrowY = yScale(y);

                arrowElements = {
                    line: null,
                    arrowhead: null,
                    text: null,
                    arrow: arrow
                };

                // Draw arrow line (initially collapsed at from point)
                arrowElements.line = svg.append('line')
                    .attr('class', 'tts-arrow-line')
                    .attr('x1', xScale(arrow.from))
                    .attr('y1', arrowY)
                    .attr('x2', xScale(arrow.from))
                    .attr('y2', arrowY)
                    .attr('stroke', arrowColor)
                    .attr('stroke-width', 2.5);

                // Draw arrowhead (initially hidden)
                const arrowheadX = xScale(arrow.to);
                arrowElements.arrowhead = svg.append('polygon')
                    .attr('class', 'tts-arrowhead')
                    .attr('points', () => {
                        const x = arrowheadX;
                        const y = arrowY;
                        return `${x},${y} ${x + 8},${y - 4} ${x + 8},${y + 4}`;
                    })
                    .attr('fill', arrowColor)
                    .style('opacity', 0);

                // Arrow text - adjust position for ImageReward plot (initially hidden)
                const textOffsetX = key === 'imagereward' ? 30 : 0;
                const textOffsetY = key === 'imagereward' ? -5 : -10;

                arrowElements.text = svg.append('text')
                    .attr('class', 'tts-arrow-text')
                    .attr('x', (xScale(arrow.from) + xScale(arrow.to)) / 2 + textOffsetX)
                    .attr('y', arrowY + textOffsetY)
                    .attr('text-anchor', 'middle')
                    .attr('fill', arrowColor)
                    .attr('font-size', '12px')
                    .attr('font-weight', '600')
                    .text(arrow.text)
                    .style('opacity', 0);
            }

            // Store animation function on container for later triggering
            container._animateTTS = function () {
                const animationDuration = 2000; // 2 seconds for line drawing
                const arrowAnimationDelay = animationDuration + 400; // Start arrow after curves are done
                const arrowAnimationDuration = 800; // Arrow grows over 800ms

                // Reset to initial state
                baselinePath.attr('stroke-dashoffset', baselineLength);
                baselinePoints.forEach(point => point.attr('r', 0));
                miroPath.attr('stroke-dashoffset', miroLength);
                miroPoints.forEach(point => point.attr('r', 0));

                if (arrowElements) {
                    const arr = arrowElements.arrow;
                    arrowElements.line.attr('x2', xScale(arr.from));
                    arrowElements.arrowhead.style('opacity', 0).attr('transform', 'scale(0.5)');
                    arrowElements.text.style('opacity', 0);
                }

                // Animate baseline line
                baselinePath
                    .transition()
                    .duration(animationDuration)
                    .ease(d3.easeLinear)
                    .attr('stroke-dashoffset', 0);

                // Animate baseline points
                baselinePoints.forEach((point, i) => {
                    point
                        .transition()
                        .delay((i / baselinePoints.length) * animationDuration)
                        .duration(200)
                        .attr('r', 3);
                });

                // Animate MIRO line (starts slightly after baseline)
                miroPath
                    .transition()
                    .delay(200)
                    .duration(animationDuration)
                    .ease(d3.easeLinear)
                    .attr('stroke-dashoffset', 0);

                // Animate MIRO points
                miroPoints.forEach((point, i) => {
                    point
                        .transition()
                        .delay(200 + (i / miroPoints.length) * animationDuration)
                        .duration(200)
                        .attr('r', 3);
                });

                // Animate arrow growing from left to right at the end
                if (arrowElements) {
                    const arr = arrowElements.arrow;

                    // Animate the arrow line growing from 'from' to 'to'
                    arrowElements.line
                        .transition()
                        .delay(arrowAnimationDelay)
                        .duration(arrowAnimationDuration)
                        .ease(d3.easeQuadOut)
                        .attr('x2', xScale(arr.to));

                    // Fade in and slightly scale the arrowhead
                    arrowElements.arrowhead
                        .transition()
                        .delay(arrowAnimationDelay)
                        .duration(300)
                        .style('opacity', 1)
                        .attr('transform', 'scale(1)')
                        .transition()
                        .duration(200)
                        .attr('transform', 'scale(1.1)')
                        .transition()
                        .duration(200)
                        .attr('transform', 'scale(1)');

                    // Fade in the speedup text smoothly
                    arrowElements.text
                        .transition()
                        .delay(arrowAnimationDelay + 200)
                        .duration(600)
                        .style('opacity', 1);
                }
            };
        });
    }

    // Expose to global namespace
    window.MIRO = window.MIRO || {};
    window.MIRO.plotTTS = plotTTS;
})();

