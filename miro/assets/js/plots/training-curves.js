(function () {
    'use strict';

    const D = window.MIRO_DATA;

    function plotTraining() {
        const curves = [
            ['curve_aesthetic', 'Aesthetic Score', 'aesthetic', [4, 6.5]],
            ['curve_imagereward', 'ImageReward', 'imagereward', [-2, 1.1]],
            ['curve_pick', 'PickScore', 'pick', [0.19, 0.22]],
            ['curve_hpsv2', 'HPSv2', 'hpsv2', [0.16, 0.30]],
        ];

        curves.forEach(([id, title, key, yRange]) => {
            const container = document.getElementById(id);
            if (!container) return;

            const baselineData = D.trainingCurves[key].baseline;
            const miroData = D.trainingCurves[key].miro;

            // Clear any existing content
            container.innerHTML = '';

            // Get colors from CSS variables
            const rootStyles = getComputedStyle(document.documentElement);
            const fgColor = rootStyles.getPropertyValue('--fg').trim() || '#e6e6e6';
            const mutedColor = rootStyles.getPropertyValue('--muted').trim() || '#b5b5b5';

            // Set up dimensions
            const margin = { top: 40, right: 20, bottom: 50, left: 60 };
            const width = container.offsetWidth - margin.left - margin.right;
            const height = 280 - margin.top - margin.bottom;

            // Create SVG with background
            const svgContainer = d3.select(container)
                .append('svg')
                .attr('width', '100%')
                .attr('height', 280);

            // Add background rectangle (lighter in light mode)
            const isLightMode = fgColor === '#1a1a1a';
            svgContainer.append('rect')
                .attr('width', '100%')
                .attr('height', '100%')
                .attr('fill', isLightMode ? '#ffffff' : '#1a1a1a')
                .attr('opacity', isLightMode ? 1 : 0.3);

            const svg = svgContainer.append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            // Set up scales
            const xScale = d3.scaleLinear()
                .domain([0, 500000])
                .range([0, width]);

            const yScale = d3.scaleLinear()
                .domain(yRange)
                .range([height, 0]);

            // Create line generators
            const lineGenerator = d3.line()
                .x(d => xScale(d[0]))
                .y(d => yScale(d[1]));

            // Add grid with adaptive styling
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
                    .tickSize(-height)
                    .tickFormat(''))
                .call(g => g.select('.domain').remove())
                .call(g => g.selectAll('.tick line').attr('stroke', gridColor));

            // Draw baseline line (initially hidden for animation)
            const baselinePath = svg.append('path')
                .datum(baselineData)
                .attr('fill', 'none')
                .attr('stroke', '#bc8f8f')
                .attr('stroke-width', 2)
                .attr('d', lineGenerator);

            // Calculate path length for animation
            const baselineLength = baselinePath.node().getTotalLength();
            baselinePath
                .attr('stroke-dasharray', baselineLength)
                .attr('stroke-dashoffset', baselineLength);

            // Create tooltip
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

            // Draw baseline points (initially hidden)
            const baselinePoints = svg.selectAll('.baseline-point')
                .data(baselineData)
                .enter()
                .append('circle')
                .attr('class', 'baseline-point')
                .attr('cx', d => xScale(d[0]))
                .attr('cy', d => yScale(d[1]))
                .attr('r', 0)
                .attr('fill', '#bc8f8f')
                .style('cursor', 'pointer')
                .on('mouseover', function (event, d) {
                    d3.select(this).attr('r', 5);
                    tooltip.style('opacity', 1)
                        .html(`Baseline<br>Step: ${(d[0] / 1000).toFixed(0)}k<br>Value: ${d[1].toFixed(3)}`);
                })
                .on('mousemove', function (event) {
                    tooltip.style('left', (event.pageX - container.offsetLeft + 10) + 'px')
                        .style('top', (event.pageY - container.offsetTop - 28) + 'px');
                })
                .on('mouseout', function () {
                    d3.select(this).attr('r', 3);
                    tooltip.style('opacity', 0);
                });

            // Draw MIRO line (initially hidden for animation)
            const miroPath = svg.append('path')
                .datum(miroData)
                .attr('fill', 'none')
                .attr('stroke', '#ff9a50')
                .attr('stroke-width', 2)
                .attr('d', lineGenerator);

            const miroLength = miroPath.node().getTotalLength();
            miroPath
                .attr('stroke-dasharray', miroLength)
                .attr('stroke-dashoffset', miroLength);

            // Draw MIRO points (initially hidden)
            const miroPoints = svg.selectAll('.miro-point')
                .data(miroData)
                .enter()
                .append('circle')
                .attr('class', 'miro-point')
                .attr('cx', d => xScale(d[0]))
                .attr('cy', d => yScale(d[1]))
                .attr('r', 0)
                .attr('fill', '#ff9a50')
                .style('cursor', 'pointer')
                .on('mouseover', function (event, d) {
                    d3.select(this).attr('r', 5);
                    tooltip.style('opacity', 1)
                        .html(`MIRO<br>Step: ${(d[0] / 1000).toFixed(0)}k<br>Value: ${d[1].toFixed(3)}`);
                })
                .on('mousemove', function (event) {
                    tooltip.style('left', (event.pageX - container.offsetLeft + 10) + 'px')
                        .style('top', (event.pageY - container.offsetTop - 28) + 'px');
                })
                .on('mouseout', function () {
                    d3.select(this).attr('r', 3);
                    tooltip.style('opacity', 0);
                });

            // Text colors (darker in light mode)
            const textColor = isLightMode ? '#1f2937' : fgColor;
            const axisColor = isLightMode ? '#4b5563' : fgColor;

            // Add x-axis
            svg.append('g')
                .attr('transform', `translate(0,${height})`)
                .call(d3.axisBottom(xScale)
                    .ticks(5)
                    .tickFormat(d => d / 100000))
                .call(g => g.select('.domain').attr('stroke', axisColor))
                .call(g => g.selectAll('.tick line').attr('stroke', axisColor))
                .call(g => g.selectAll('.tick text').attr('fill', axisColor).attr('font-size', '11px'));

            // Add y-axis
            svg.append('g')
                .call(d3.axisLeft(yScale).ticks(5))
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
                .text(title);

            // Add x-axis label
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height + 40)
                .attr('text-anchor', 'middle')
                .attr('fill', axisColor)
                .attr('font-size', '11px')
                .text('Train steps (×1e5)');

            // Add legend (bottom right)
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

            // Add speed-up arrows based on metric (initially hidden)
            const speedups = {
                'aesthetic': { text: '19.1× faster', targetStep: 26171, baselineFinal: 5.190157, yPos: 5.8 },
                'imagereward': { text: '3.7× faster', targetStep: 133658, baselineFinal: 0.540761, yPos: -0.1 },
                'pick': { text: '3.5× faster', targetStep: 141439, baselineFinal: 0.211812, yPos: 0.205 },
                'hpsv2': { text: '6.3× faster', targetStep: 79400, baselineFinal: 0.247693, yPos: 0.26 }
            };

            let arrowElements = null;
            if (speedups[key]) {
                const su = speedups[key];
                const arrowY = yScale(su.baselineFinal);

                arrowElements = {
                    line: null,
                    arrowhead: null,
                    text: null,
                    speedup: su
                };

                // Draw arrow line (initially collapsed at baseline end point)
                arrowElements.line = svg.append('line')
                    .attr('class', 'speedup-arrow-line')
                    .attr('x1', xScale(500000))
                    .attr('y1', arrowY)
                    .attr('x2', xScale(500000))
                    .attr('y2', arrowY)
                    .attr('stroke', '#ff6978')
                    .attr('stroke-width', 2.5);

                // Draw arrowhead (initially at target, pointing left)
                const arrowheadX = xScale(su.targetStep);
                arrowElements.arrowhead = svg.append('polygon')
                    .attr('class', 'speedup-arrowhead')
                    .attr('points', `${arrowheadX},${arrowY} ${arrowheadX + 8},${arrowY - 4} ${arrowheadX + 8},${arrowY + 4}`)
                    .attr('fill', '#ff6978')
                    .style('opacity', 0);

                // Add speed-up text (initially hidden)
                arrowElements.text = svg.append('text')
                    .attr('class', 'speedup-text')
                    .attr('x', xScale(su.targetStep + (500000 - su.targetStep) / 2))
                    .attr('y', yScale(su.yPos))
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#ff6978')
                    .attr('font-size', '12px')
                    .attr('font-weight', '600')
                    .text(su.text)
                    .style('opacity', 0);
            }

            // Store animation function on container for later triggering
            container._animateTraining = function () {
                const animationDuration = 2000; // 2 seconds for line drawing
                const arrowAnimationDelay = animationDuration + 400; // Start arrow after curves are done
                const arrowAnimationDuration = 800; // Arrow grows over 800ms

                // Reset to initial state
                baselinePath.attr('stroke-dashoffset', baselineLength);
                baselinePoints.attr('r', 0);
                miroPath.attr('stroke-dashoffset', miroLength);
                miroPoints.attr('r', 0);

                if (arrowElements) {
                    const su = arrowElements.speedup;
                    arrowElements.line.attr('x2', xScale(500000)); // Reset to collapsed state at baseline end
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
                baselinePoints
                    .transition()
                    .delay((d, i) => (i / baselineData.length) * animationDuration)
                    .duration(200)
                    .attr('r', 3);

                // Animate MIRO line (starts slightly after baseline)
                miroPath
                    .transition()
                    .delay(200)
                    .duration(animationDuration)
                    .ease(d3.easeLinear)
                    .attr('stroke-dashoffset', 0);

                // Animate MIRO points
                miroPoints
                    .transition()
                    .delay((d, i) => 200 + (i / miroData.length) * animationDuration)
                    .duration(200)
                    .attr('r', 3);

                // Animate arrow growing from left to right at the end
                if (arrowElements) {
                    const su = arrowElements.speedup;
                    const arrowY = yScale(su.baselineFinal);

                    // Animate the arrow line growing from baseline end to target
                    arrowElements.line
                        .transition()
                        .delay(arrowAnimationDelay)
                        .duration(arrowAnimationDuration)
                        .ease(d3.easeQuadOut)
                        .attr('x2', xScale(su.targetStep));

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
    window.MIRO.plotTraining = plotTraining;
})();

