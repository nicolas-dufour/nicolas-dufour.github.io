(function () {
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

  function plotSynthetic() {
    const S = D.syntheticRadars;
    const colors = { Baseline: '#bc8f8f', MIRO: '#ff9a50', 'Synth Baseline': '#4664b4', 'Synth MIRO': '#3c8c3c' };

    // Define ranges for normalization (to 0-5 scale)
    const genevalRanges = { 'Two Objects': [35, 75], 'Single Object': [70, 100], 'Color Attribution': [10, 60], 'Counting': [20, 65], 'Colors': [35, 80], 'Position': [5, 50] };
    const aestheticRanges = { 'Pick': [0.20, 0.23], 'Aesthetic': [4.5, 6.8], 'OpenAI CLIP': [0.23, 0.28], 'HPSv2': [0.24, 0.30], 'CLIP': [0.16, 0.22], 'ImageReward': [0, 1.1] };

    function normalizeToScale(vals, axes, ranges) {
      return vals.map((v, i) => {
        const key = axes[i];
        const rng = ranges[key] || [0, 1];
        const [mn, mx] = rng;
        return 5 * (v - mn) / (mx - mn);
      });
    }

    function plotRadarD3(containerId, axes, series, ranges, isGeneval = false) {
      const container = document.getElementById(containerId);
      if (!container) return;

      container.innerHTML = '';

      // Get theme colors
      const rootStyles = getComputedStyle(document.documentElement);
      const fgColor = rootStyles.getPropertyValue('--fg').trim() || '#e6e6e6';
      const isLightMode = fgColor === '#1a1a1a';
      const textColor = isLightMode ? '#1f2937' : fgColor;

      const numAxes = axes.length;

      // SVG setup
      const width = container.offsetWidth;
      const height = 400;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - 80;

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

      // Draw axes and labels
      const angleSlice = Math.PI * 2 / numAxes;
      axes.forEach((axis, i) => {
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

        // Axis label with rotation and extra spacing for some labels
        let extraSpacing = 0;
        if (isGeneval) {
          if (axis === 'Position') extraSpacing = 10;
          else if (axis === 'Single Object') extraSpacing = 20;
          else if (axis === 'Color Attribution') extraSpacing = 30;
        } else {
          if (axis === 'ImageReward') extraSpacing = 30;
          else if (axis === 'Aesthetic') extraSpacing = 10;
          else if (axis === 'OpenAI CLIP') extraSpacing = 20;
        }

        const labelRadius = radius + 30 + extraSpacing;
        const labelX = Math.cos(angle) * labelRadius;
        const labelY = Math.sin(angle) * labelRadius;

        // Calculate rotation
        let rotation = 0;
        const noRotateAxes = isGeneval ? ['Two Objects', 'Counting'] : ['Pick', 'HPSv2'];
        if (!noRotateAxes.includes(axis)) {
          rotation = (angle * 180 / Math.PI);
          if (rotation > 90) {
            rotation -= 180;
          } else if (rotation < -90) {
            rotation += 180;
          }
        }

        // Colored labels for aesthetic plot
        const axisColors = isGeneval ? {} : {
          'Pick': '#ff96c8',
          'Aesthetic': '#69c869',
          'OpenAI CLIP': '#4fd2c8',
          'HPSv2': '#6496ff',
          'CLIP': '#4fd2c8',
          'ImageReward': '#ff6978'
        };
        const axisColor = axisColors[axis] || textColor;

        g.append('text')
          .attr('x', labelX)
          .attr('y', labelY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', axisColor)
          .attr('font-size', '11px')
          .attr('font-weight', isGeneval ? '500' : '600')
          .attr('transform', `rotate(${rotation}, ${labelX}, ${labelY})`)
          .text(axis);

        // Add graduation value labels
        const rng = ranges[axis] || [0, 100];
        const [minVal, maxVal] = rng;
        const firstGrad = minVal + (maxVal - minVal) / 5;

        const r1 = radius / 5;
        const x1 = Math.cos(angle) * r1;
        const y1 = Math.sin(angle) * r1;

        const r5 = radius;
        const x5 = Math.cos(angle) * r5;
        const y5 = Math.sin(angle) * r5;

        const valueLabelColor = isLightMode ? '#666' : '#999';
        const bgColor = isLightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)';

        const formatValue = isGeneval ?
          (val) => val.toFixed(0) :
          (val) => val >= 1 ? val.toFixed(1) : val.toFixed(2);

        [
          { x: x1, y: y1, val: formatValue(firstGrad) },
          { x: x5, y: y5, val: formatValue(maxVal) }
        ].forEach(({ x, y, val }) => {
          const bbox = { width: 24, height: 14 };
          g.append('rect')
            .attr('x', x - bbox.width / 2)
            .attr('y', y - bbox.height / 2)
            .attr('width', bbox.width)
            .attr('height', bbox.height)
            .attr('fill', bgColor)
            .attr('rx', 2);

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

      // Draw each series
      const seriesOrder = ['Baseline', 'MIRO', 'Synth Baseline', 'Synth MIRO'];
      const polygons = [];
      const pointsByName = {};

      seriesOrder.forEach(name => {
        if (!series[name]) return;

        const normalizedVals = normalizeToScale(series[name], axes, ranges);
        const path = radarPath(normalizedVals);
        const color = colors[name] || '#888';

        // Draw area - initialize at scale(0)
        const polygon = g.append('polygon')
          .attr('points', path.map(p => p.join(',')).join(' '))
          .attr('fill', color)
          .attr('fill-opacity', 0.2)
          .attr('stroke', color)
          .attr('stroke-width', name.includes('MIRO') && !name.includes('Synth') ? 3 : 2.5)
          .attr('transform', 'scale(0)');

        polygons.push(polygon);

        // Draw points with tooltips - initialize with r=0
        const points = [];
        path.forEach((point, i) => {
          const axisName = axes[i];
          const value = series[name][i];

          const circle = g.append('circle')
            .attr('cx', point[0])
            .attr('cy', point[1])
            .attr('r', 0) // Start hidden
            .attr('fill', color)
            .style('cursor', 'pointer')
            .on('mouseover', function (event) {
              d3.select(this).attr('r', name.includes('MIRO') && !name.includes('Synth') ? 6 : 5.5);

              let tooltipContent = `<div style="font-weight: 600; margin-bottom: 6px;">${axisName}</div>`;
              seriesOrder.forEach(sName => {
                if (!series[sName]) return;
                const sValue = series[sName][i];
                const sColor = colors[sName] || '#888';
                const displayVal = isGeneval ? sValue.toFixed(1) + '%' : sValue.toFixed(3);
                tooltipContent += `<div style="color: ${sColor}; font-weight: 500;">${sName}: ${displayVal}</div>`;
              });

              tooltip
                .style('opacity', 1)
                .style('left', (event.pageX + 15) + 'px')
                .style('top', (event.pageY - 15) + 'px')
                .html(tooltipContent);
            })
            .on('mousemove', function (event) {
              tooltip
                .style('left', (event.pageX + 15) + 'px')
                .style('top', (event.pageY - 15) + 'px');
            })
            .on('mouseout', function () {
              d3.select(this).attr('r', name.includes('MIRO') && !name.includes('Synth') ? 4 : 3.5);
              tooltip.style('opacity', 0);
            });

          points.push(circle);
        });

        pointsByName[name] = points;
      });

      // Legend at bottom left
      const legendX = -centerX + 20;
      const legendY = centerY - 80;
      const legend = g.append('g')
        .attr('transform', `translate(${legendX}, ${legendY})`);

      seriesOrder.forEach((name, idx) => {
        if (!series[name]) return;

        const yOffset = idx * 15;

        legend.append('rect')
          .attr('x', 0)
          .attr('y', yOffset)
          .attr('width', 15)
          .attr('height', 3)
          .attr('fill', colors[name]);

        legend.append('text')
          .attr('x', 20)
          .attr('y', yOffset + 3)
          .attr('fill', textColor)
          .attr('font-size', '12px')
          .text(name);
      });

      // Store animation function on container for later triggering
      container._animateRadar = function () {
        const animationDuration = 1200; // 1.2 seconds for expansion
        const pointDelay = 200; // delay before points appear
        const staggerDelay = 150; // delay between each series

        // Reset to initial state
        polygons.forEach(polygon => polygon.attr('transform', 'scale(0)'));
        seriesOrder.forEach(name => {
          if (!pointsByName[name]) return;
          pointsByName[name].forEach(point => point.attr('r', 0));
        });

        // Animate polygons with elastic easing (staggered by series order)
        polygons.forEach((polygon, i) => {
          polygon
            .transition()
            .delay(i * staggerDelay)
            .duration(animationDuration)
            .ease(d3.easeElasticOut.amplitude(1).period(0.5))
            .attr('transform', 'scale(1)');
        });

        // Animate points for each series (after polygons expand)
        seriesOrder.forEach((name, seriesIdx) => {
          if (!pointsByName[name]) return;

          const points = pointsByName[name];
          points.forEach((point, i) => {
            const finalRadius = name.includes('MIRO') && !name.includes('Synth') ? 4 : 3.5;
            point
              .transition()
              .delay(animationDuration + pointDelay + (seriesIdx * staggerDelay) + i * 50)
              .duration(300)
              .ease(d3.easeBackOut.overshoot(1.5))
              .attr('r', finalRadius);
          });
        });
      };
    }

    plotRadarD3('synthetic_geneval', S.axesGeneval, S.geneval, genevalRanges, true);
    plotRadarD3('synthetic_aesthetic', S.axesAesthetic, S.aesthetic, aestheticRanges, false);
  }

  function plotSOTAComparison() {
    const data = D.sotaComparison;

    if (!data) {
      console.error('SOTA comparison data not found');
      return;
    }

    // Create GenEval barplot
    createBarplot('sota_geneval', data.models, data.geneval, data.isMiro, data.params, data.tflops, 'GenEval Overall Score', [0, 80], false, false);

    // Create ImageReward barplot
    createBarplot('sota_imagereward', data.models, data.imagereward, data.isMiro, data.params, data.tflops, 'ImageReward Score', [0, 1.7], false, false);

    // Create Parameters barplot with log scale
    createBarplot('sota_params', data.models, data.params, data.isMiro, data.params, data.tflops, 'Model Parameters (Billions)', [0.1, 15], true, true);

    // Create Compute barplot (only for models with data) with log scale
    const hasComputeData = data.tflops.map((v, i) => v !== null ? i : -1).filter(i => i >= 0);
    const computeModels = hasComputeData.map(i => data.models[i]);
    const computeValues = hasComputeData.map(i => data.tflops[i]);
    const computeIsMiro = hasComputeData.map(i => data.isMiro[i]);
    const computeParams = hasComputeData.map(i => data.params[i]);
    const computeTflops = hasComputeData.map(i => data.tflops[i]);
    createBarplot('sota_compute', computeModels, computeValues, computeIsMiro, computeParams, computeTflops, 'Inference Compute (TFLOPs)', [1, 2000], true, true);

    function createBarplot(containerId, labels, values, isMiroFlags, paramsData, tflopsData, title, yRange, invertColors = false, useLogScale = false) {
      const container = document.getElementById(containerId);
      if (!container) {
        console.warn(`Container ${containerId} not found`);
        return;
      }

      container.innerHTML = '';

      // Get theme colors
      const rootStyles = getComputedStyle(document.documentElement);
      const fgColor = rootStyles.getPropertyValue('--fg').trim() || '#e6e6e6';
      const isLightMode = fgColor === '#1a1a1a';
      const textColor = isLightMode ? '#1f2937' : fgColor;
      const mutedColor = isLightMode ? '#6b7280' : '#9ca3af';

      // Dimensions
      const margin = { top: 40, right: 20, bottom: 100, left: 60 };
      const width = container.offsetWidth;
      const height = 450;
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      // Create SVG
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
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Scales
      const xScale = d3.scaleBand()
        .domain(labels)
        .range([0, innerWidth])
        .padding(0.25);

      const yScale = useLogScale
        ? d3.scaleLog()
          .domain(yRange)
          .range([innerHeight, 0])
        : d3.scaleLinear()
          .domain(yRange)
          .range([innerHeight, 0]);

      // Grid
      const gridColor = isLightMode ? '#333333' : fgColor;
      const gridOpacity = isLightMode ? 0.15 : 0.1;

      g.append('g')
        .attr('class', 'grid')
        .attr('opacity', gridOpacity)
        .call(d3.axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(''))
        .call(g => g.select('.domain').remove())
        .call(g => g.selectAll('.tick line').attr('stroke', gridColor));

      // Axes
      const axisColor = isLightMode ? '#4b5563' : fgColor;

      g.append('g')
        .attr('class', 'axis-bottom')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .call(g => g.select('.domain').attr('stroke', axisColor))
        .call(g => g.selectAll('.tick line').attr('stroke', axisColor))
        .call(g => g.selectAll('.tick text')
          .attr('fill', axisColor)
          .attr('font-size', '10px')
          .attr('transform', 'rotate(-45)')
          .style('text-anchor', 'end'));

      g.append('g')
        .call(d3.axisLeft(yScale).ticks(6))
        .call(g => g.select('.domain').attr('stroke', axisColor))
        .call(g => g.selectAll('.tick line').attr('stroke', axisColor))
        .call(g => g.selectAll('.tick text')
          .attr('fill', axisColor)
          .attr('font-size', '11px'));

      // Title
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', -15)
        .attr('text-anchor', 'middle')
        .attr('fill', textColor)
        .attr('font-size', '14px')
        .attr('font-weight', '600')
        .text(title + (useLogScale ? ' (log scale)' : ''));

      // Tooltip
      const tooltip = d3.select(container)
        .append('div')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.85)')
        .style('color', '#fff')
        .style('padding', '8px 12px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', '10');

      // Bars
      const bars = g.selectAll('.bar')
        .data(labels.map((label, i) => ({
          label,
          value: values[i],
          isMiro: isMiroFlags[i],
          params: paramsData[i],
          tflops: tflopsData[i]
        })))
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.label))
        .attr('width', xScale.bandwidth())
        .attr('y', useLogScale ? yScale(yRange[0]) : innerHeight)
        .attr('height', useLogScale ? innerHeight - yScale(yRange[0]) : 0)
        .attr('fill', d => {
          if (invertColors) {
            // For params/compute, lower is better, so highlight MIRO in green
            return d.isMiro ? '#10b981' : (isLightMode ? '#94a3b8' : '#64748b');
          } else {
            // For performance metrics, higher is better, use orange for MIRO
            return d.isMiro ? '#ff9a50' : (isLightMode ? '#94a3b8' : '#64748b');
          }
        })
        .attr('opacity', 0.9)
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
          d3.select(this)
            .attr('opacity', 1)
            .attr('stroke', d.isMiro ? (invertColors ? '#059669' : '#ff6b1a') : '#475569')
            .attr('stroke-width', 2);

          let tooltipContent = `<strong>${d.label}</strong><br>${title}: ${d.value.toFixed(2)}`;
          if (d.params !== null && d.params !== undefined) {
            tooltipContent += `<br>Parameters: ${d.params.toFixed(2)}B`;
          }
          if (d.tflops !== null && d.tflops !== undefined) {
            tooltipContent += `<br>Compute: ${d.tflops.toFixed(1)} TFLOPs`;
          }

          tooltip.style('opacity', 1).html(tooltipContent);
        })
        .on('mousemove', function (event) {
          tooltip
            .style('left', (event.pageX - container.offsetLeft + 10) + 'px')
            .style('top', (event.pageY - container.offsetTop - 28) + 'px');
        })
        .on('mouseout', function (event, d) {
          d3.select(this)
            .attr('opacity', 0.9)
            .attr('stroke', 'none');
          tooltip.style('opacity', 0);
        });

      function sortBars() {
        // Create sorted indices array (sort by value, smallest to largest)
        const indices = labels.map((_, i) => i);
        indices.sort((a, b) => values[a] - values[b]);

        // Create new sorted label array
        const sortedLabels = indices.map(i => labels[i]);

        // Update x scale domain to sorted order
        xScale.domain(sortedLabels);

        // Animate bars to new sorted positions
        bars.transition()
          .duration(1200)
          .ease(d3.easeCubicInOut)
          .attr('x', d => xScale(d.label));

        // Animate x-axis labels to new positions
        g.select('.axis-bottom')
          .transition()
          .duration(1200)
          .ease(d3.easeCubicInOut)
          .call(d3.axisBottom(xScale))
          .call(g => g.select('.domain').attr('stroke', axisColor))
          .call(g => g.selectAll('.tick line').attr('stroke', axisColor))
          .call(g => g.selectAll('.tick text')
            .attr('fill', axisColor)
            .attr('font-size', '10px')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end'));
      }

      // Store animation function for replay capability
      container._animateBarplot = function () {
        // Reset x scale to original unsorted order
        xScale.domain(labels);

        // Reset bars to initial state
        bars
          .attr('x', d => xScale(d.label))
          .attr('y', useLogScale ? yScale(yRange[0]) : innerHeight)
          .attr('height', useLogScale ? innerHeight - yScale(yRange[0]) : 0);

        // Reset axis to original order
        g.select('.axis-bottom')
          .call(d3.axisBottom(xScale))
          .call(g => g.select('.domain').attr('stroke', axisColor))
          .call(g => g.selectAll('.tick line').attr('stroke', axisColor))
          .call(g => g.selectAll('.tick text')
            .attr('fill', axisColor)
            .attr('font-size', '10px')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end'));

        // Animate bars growing
        bars.transition()
          .delay((d, i) => i * 60)
          .duration(800)
          .ease(d3.easeBackOut.overshoot(1.2))
          .attr('y', d => yScale(d.value))
          .attr('height', d => innerHeight - yScale(d.value))
          .on('end', function (d, i) {
            // Trigger sorting animation only after the last bar finishes growing
            if (i === labels.length - 1) {
              setTimeout(() => sortBars(), 500);
            }
          });
      };

      // Trigger initial animation
      container._animateBarplot();
    }
  }

  function plotDualWeight(x, genevalData, aestheticData) {
    const container = document.getElementById('dual_weight');
    if (!container) return;

    container.innerHTML = '';

    const data = x.map((xVal, i) => ({
      x: xVal,
      geneval: genevalData[i],
      aesthetic: aestheticData[i]
    }));

    // Get theme colors
    const rootStyles = getComputedStyle(document.documentElement);
    const fgColor = rootStyles.getPropertyValue('--fg').trim() || '#e6e6e6';
    const isLightMode = fgColor === '#1a1a1a';
    const textColor = isLightMode ? '#1f2937' : fgColor;
    const mutedColor = isLightMode ? '#6b7280' : '#9ca3af';

    // SVG setup
    const margin = { top: 30, right: 70, bottom: 50, left: 70 };
    const width = container.offsetWidth;
    const height = 408;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

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
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, innerWidth]);

    const genevalScale = d3.scaleLinear()
      .domain([d3.min(genevalData) - 2, d3.max(genevalData) + 2])
      .range([innerHeight, 0]);

    const aestheticScale = d3.scaleLinear()
      .domain([d3.min(aestheticData) - 0.5, d3.max(aestheticData) + 0.5])
      .range([innerHeight, 0]);

    // Grid
    const xTicks = x;
    xTicks.forEach(tick => {
      g.append('line')
        .attr('x1', xScale(tick))
        .attr('x2', xScale(tick))
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', isLightMode ? '#333' : '#666')
        .attr('stroke-opacity', isLightMode ? 0.15 : 0.1)
        .attr('stroke-dasharray', '3,3');
    });

    const genevalTicks = genevalScale.ticks(5);
    genevalTicks.forEach(tick => {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', genevalScale(tick))
        .attr('y2', genevalScale(tick))
        .attr('stroke', isLightMode ? '#333' : '#666')
        .attr('stroke-opacity', isLightMode ? 0.15 : 0.1)
        .attr('stroke-dasharray', '3,3');
    });

    // Line generators
    const genevalLine = d3.line()
      .x(d => xScale(d.x))
      .y(d => genevalScale(d.geneval));

    const aestheticLine = d3.line()
      .x(d => xScale(d.x))
      .y(d => aestheticScale(d.aesthetic));

    // Colors - Aesthetic green, GenEval purple
    const aestheticColor = '#3c8c3c'; // dark green
    const genevalColor = '#884ea0'; // purple

    // Draw lines
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', genevalColor)
      .attr('stroke-width', 2)
      .attr('d', genevalLine);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', aestheticColor)
      .attr('stroke-width', 2)
      .attr('d', aestheticLine);

    // Axes
    const xAxis = d3.axisBottom(xScale)
      .tickValues(x);

    const genevalAxis = d3.axisLeft(genevalScale)
      .ticks(5);

    const aestheticAxis = d3.axisRight(aestheticScale)
      .ticks(5);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', mutedColor)
      .selectAll('text')
      .attr('font-size', '11px');

    g.append('g')
      .call(genevalAxis)
      .attr('color', genevalColor)
      .selectAll('text')
      .attr('font-size', '11px');

    g.append('g')
      .attr('transform', `translate(${innerWidth},0)`)
      .call(aestheticAxis)
      .attr('color', aestheticColor)
      .selectAll('text')
      .attr('font-size', '11px');

    // Axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .attr('fill', mutedColor)
      .attr('font-size', '12px')
      .text('Aesthetic weight');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -55)
      .attr('text-anchor', 'middle')
      .attr('fill', genevalColor)
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .text('GenEval Overall');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', innerWidth + 60)
      .attr('text-anchor', 'middle')
      .attr('fill', aestheticColor)
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .text('Aesthetic');

    // Title
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', textColor)
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .text('GenEval vs Aesthetic');

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

    // GenEval points
    data.forEach(d => {
      g.append('circle')
        .attr('cx', xScale(d.x))
        .attr('cy', genevalScale(d.geneval))
        .attr('r', 3)
        .attr('fill', genevalColor)
        .style('cursor', 'pointer')
        .on('mouseover', function (event) {
          d3.select(this).attr('r', 5);
          tooltip
            .style('opacity', 1)
            .html(`Weight: ${d.x.toFixed(3)}<br>GenEval: ${d.geneval.toFixed(2)}%<br>Aesthetic: ${d.aesthetic.toFixed(2)}`);
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
    });

    // Aesthetic points
    data.forEach(d => {
      g.append('circle')
        .attr('cx', xScale(d.x))
        .attr('cy', aestheticScale(d.aesthetic))
        .attr('r', 3)
        .attr('fill', aestheticColor)
        .style('cursor', 'pointer')
        .on('mouseover', function (event) {
          d3.select(this).attr('r', 5);
          tooltip
            .style('opacity', 1)
            .html(`Weight: ${d.x.toFixed(3)}<br>GenEval: ${d.geneval.toFixed(2)}%<br>Aesthetic: ${d.aesthetic.toFixed(2)}`);
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
    });

    // Highlight max GenEval point
    const maxGeneval = d3.max(genevalData);
    const maxGenevalIdx = genevalData.indexOf(maxGeneval);
    const maxPoint = data[maxGenevalIdx];

    g.append('circle')
      .attr('cx', xScale(maxPoint.x))
      .attr('cy', genevalScale(maxPoint.geneval))
      .attr('r', 6)
      .attr('fill', 'none')
      .attr('stroke', genevalColor)
      .attr('stroke-width', 2);

    g.append('text')
      .attr('x', xScale(maxPoint.x) + 10)
      .attr('y', genevalScale(maxPoint.geneval) - 10)
      .attr('fill', genevalColor)
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text(`max at ${maxPoint.x.toFixed(3)}`);
  }

  function plotWeightGrid(id, x, yData, label) {
    const container = document.getElementById(id);
    if (!container) return;

    container.innerHTML = '';

    const data = x.map((xVal, i) => ({ x: xVal, y: yData[i] }));

    // Get theme colors
    const rootStyles = getComputedStyle(document.documentElement);
    const fgColor = rootStyles.getPropertyValue('--fg').trim() || '#e6e6e6';
    const isLightMode = fgColor === '#1a1a1a';
    const textColor = isLightMode ? '#1f2937' : fgColor;
    const mutedColor = isLightMode ? '#6b7280' : '#9ca3af';

    // SVG setup
    const margin = { top: 30, right: 20, bottom: 50, left: 60 };
    const width = container.offsetWidth;
    const height = 200;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

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
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, innerWidth]);

    const yMin = d3.min(yData);
    const yMax = d3.max(yData);
    const yPadding = (yMax - yMin) * 0.15;
    const yScale = d3.scaleLinear()
      .domain([yMin - yPadding, yMax + yPadding])
      .range([innerHeight, 0]);

    // Grid
    x.forEach(tick => {
      g.append('line')
        .attr('x1', xScale(tick))
        .attr('x2', xScale(tick))
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', isLightMode ? '#333' : '#666')
        .attr('stroke-opacity', isLightMode ? 0.15 : 0.1)
        .attr('stroke-dasharray', '3,3');
    });

    const yTicks = yScale.ticks(5);
    yTicks.forEach(tick => {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(tick))
        .attr('y2', yScale(tick))
        .attr('stroke', isLightMode ? '#333' : '#666')
        .attr('stroke-opacity', isLightMode ? 0.15 : 0.1)
        .attr('stroke-dasharray', '3,3');
    });

    // Line generator
    const lineGen = d3.line()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y));

    // Draw line
    const lineColor = '#3c8c3c'; // Synth MIRO color
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 2)
      .attr('d', lineGen);

    // Axes
    const xAxis = d3.axisBottom(xScale)
      .tickValues(x);

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => label === 'PickScore' ? d.toFixed(3) : d.toFixed(2));

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', mutedColor)
      .selectAll('text')
      .attr('font-size', '11px');

    g.append('g')
      .call(yAxis)
      .attr('color', mutedColor)
      .selectAll('text')
      .attr('font-size', '11px');

    // Axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .attr('fill', mutedColor)
      .attr('font-size', '12px')
      .text('Aesthetic weight');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .attr('fill', mutedColor)
      .attr('font-size', '12px')
      .text(label);

    // Title
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', textColor)
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .text(label);

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

    // Data points
    data.forEach(d => {
      g.append('circle')
        .attr('cx', xScale(d.x))
        .attr('cy', yScale(d.y))
        .attr('r', 3)
        .attr('fill', lineColor)
        .style('cursor', 'pointer')
        .on('mouseover', function (event) {
          d3.select(this).attr('r', 5);
          const formatValue = label === 'PickScore' ? d.y.toFixed(3) : d.y.toFixed(2);
          tooltip
            .style('opacity', 1)
            .html(`${label}<br>Weight: ${d.x.toFixed(3)}<br>Value: ${formatValue}`);
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
    });
  }

  function plotWeights() {
    const x = D.weightSweeps.x;

    // Dual-axis plot: GenEval vs Aesthetic
    plotDualWeight(x, D.weightSweeps.dual.geneval, D.weightSweeps.dual.aesthetic);

    // Grid metrics
    const map = [
      ['grid_aesthetic', 'aesthetic', 'Aesthetic'],
      ['grid_imagereward', 'imagereward', 'ImageReward'],
      ['grid_hpsv2', 'hpsv2', 'HPSv2'],
      ['grid_pick', 'pick', 'PickScore'],
      ['grid_clip', 'clip', 'CLIP Score'],
      ['grid_openai', 'openai', 'OpenAI CLIP']
    ];
    map.forEach(([id, key, label]) => {
      plotWeightGrid(id, x, D.weightSweeps.grid[key], label);
    });

    // Weight cursor functionality
    const slider = document.getElementById('weightCursor');
    const cursorLabel = document.getElementById('weightCursorLabel');

    function updateCursor() {
      if (!slider) return;
      const idx = parseInt(slider.value, 10);
      const xv = x[idx];

      // Update label
      if (cursorLabel) {
        cursorLabel.textContent = `aesthetic weight = ${xv.toFixed(3)}`;
      }

      // Update cursor line in dual_weight plot
      const dualContainer = document.getElementById('dual_weight');
      if (dualContainer) {
        const svg = d3.select(dualContainer).select('svg');
        const g = svg.select('g');

        if (!g.empty()) {
          // Remove old cursor line and markers
          g.selectAll('.weight-cursor').remove();
          g.selectAll('.weight-marker').remove();

          // Get scale info from the plot
          const margin = { left: 70 };
          const width = dualContainer.offsetWidth;
          const innerWidth = width - margin.left - 70;
          const innerHeight = 408 - 30 - 50;
          const xScale = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);

          // Get data values at this point
          const genevalValue = D.weightSweeps.dual.geneval[idx];
          const aestheticValue = D.weightSweeps.dual.aesthetic[idx];

          // Add new cursor line
          const rootStyles = getComputedStyle(document.documentElement);
          const fgColor = rootStyles.getPropertyValue('--fg').trim() || '#e6e6e6';
          const isLightMode = fgColor === '#1a1a1a';
          const cursorColor = isLightMode ? '#666' : '#888';

          g.append('line')
            .attr('class', 'weight-cursor')
            .attr('x1', xScale(xv))
            .attr('x2', xScale(xv))
            .attr('y1', 0)
            .attr('y2', innerHeight)
            .attr('stroke', cursorColor)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,4')
            .attr('opacity', 0.7);

          // Create scales for value positions
          const genevalScale = d3.scaleLinear()
            .domain([d3.min(D.weightSweeps.dual.geneval) - 2, d3.max(D.weightSweeps.dual.geneval) + 2])
            .range([innerHeight, 0]);

          const aestheticScale = d3.scaleLinear()
            .domain([d3.min(D.weightSweeps.dual.aesthetic) - 0.5, d3.max(D.weightSweeps.dual.aesthetic) + 0.5])
            .range([innerHeight, 0]);

          // Add markers and labels for GenEval (purple)
          g.append('circle')
            .attr('class', 'weight-marker')
            .attr('cx', xScale(xv))
            .attr('cy', genevalScale(genevalValue))
            .attr('r', 5)
            .attr('fill', '#884ea0')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

          const genevalText = genevalValue.toFixed(1);
          const genevalTextBg = g.append('rect')
            .attr('class', 'weight-marker')
            .attr('fill', 'white')
            .attr('stroke', '#884ea0')
            .attr('stroke-width', 1)
            .attr('rx', 3);

          const genevalLabel = g.append('text')
            .attr('class', 'weight-marker')
            .attr('x', xScale(xv))
            .attr('y', genevalScale(genevalValue) - 12)
            .attr('text-anchor', 'middle')
            .attr('fill', '#884ea0')
            .attr('font-size', '12px')
            .attr('font-weight', '600')
            .text(genevalText);

          const genevalBbox = genevalLabel.node().getBBox();
          genevalTextBg.attr('x', genevalBbox.x - 3)
            .attr('y', genevalBbox.y - 2)
            .attr('width', genevalBbox.width + 6)
            .attr('height', genevalBbox.height + 4);
          genevalLabel.raise();

          // Add markers and labels for Aesthetic (green)
          g.append('circle')
            .attr('class', 'weight-marker')
            .attr('cx', xScale(xv))
            .attr('cy', aestheticScale(aestheticValue))
            .attr('r', 5)
            .attr('fill', '#69c869')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

          const aestheticText = aestheticValue.toFixed(2);
          const aestheticTextBg = g.append('rect')
            .attr('class', 'weight-marker')
            .attr('fill', 'white')
            .attr('stroke', '#69c869')
            .attr('stroke-width', 1)
            .attr('rx', 3);

          const aestheticLabel = g.append('text')
            .attr('class', 'weight-marker')
            .attr('x', xScale(xv))
            .attr('y', aestheticScale(aestheticValue) - 12)
            .attr('text-anchor', 'middle')
            .attr('fill', '#69c869')
            .attr('font-size', '12px')
            .attr('font-weight', '600')
            .text(aestheticText);

          const aestheticBbox = aestheticLabel.node().getBBox();
          aestheticTextBg.attr('x', aestheticBbox.x - 3)
            .attr('y', aestheticBbox.y - 2)
            .attr('width', aestheticBbox.width + 6)
            .attr('height', aestheticBbox.height + 4);
          aestheticLabel.raise();
        }
      }

      // Update cursor line in all grid plots
      map.forEach(([id, key]) => {
        const container = document.getElementById(id);
        if (!container) return;

        const svg = d3.select(container).select('svg');
        const g = svg.select('g');

        if (g.empty()) return;

        // Remove old cursor line and markers
        g.selectAll('.weight-cursor').remove();
        g.selectAll('.weight-marker').remove();

        // Get scale info from the plot
        const margin = { left: 60 };
        const width = container.offsetWidth;
        const innerWidth = width - margin.left - 20;
        const innerHeight = 200 - 30 - 50;
        const xScale = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);

        // Get data for this metric
        const yData = D.weightSweeps.grid[key];
        const yValue = yData[idx];

        // Create y scale
        const yMin = d3.min(yData);
        const yMax = d3.max(yData);
        const yPadding = (yMax - yMin) * 0.15;
        const yScale = d3.scaleLinear()
          .domain([yMin - yPadding, yMax + yPadding])
          .range([innerHeight, 0]);

        // Add new cursor line
        const rootStyles = getComputedStyle(document.documentElement);
        const fgColor = rootStyles.getPropertyValue('--fg').trim() || '#e6e6e6';
        const isLightMode = fgColor === '#1a1a1a';
        const cursorColor = isLightMode ? '#666' : '#888';

        g.append('line')
          .attr('class', 'weight-cursor')
          .attr('x1', xScale(xv))
          .attr('x2', xScale(xv))
          .attr('y1', 0)
          .attr('y2', innerHeight)
          .attr('stroke', cursorColor)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,4')
          .attr('opacity', 0.7);

        // Add marker and label
        g.append('circle')
          .attr('class', 'weight-marker')
          .attr('cx', xScale(xv))
          .attr('cy', yScale(yValue))
          .attr('r', 4)
          .attr('fill', '#3c8c3c')
          .attr('stroke', '#fff')
          .attr('stroke-width', 2);

        const valueText = key === 'pick' ? yValue.toFixed(3) : yValue.toFixed(2);
        const textBg = g.append('rect')
          .attr('class', 'weight-marker')
          .attr('fill', 'white')
          .attr('stroke', '#3c8c3c')
          .attr('stroke-width', 1)
          .attr('rx', 2);

        const label = g.append('text')
          .attr('class', 'weight-marker')
          .attr('x', xScale(xv))
          .attr('y', yScale(yValue) - 10)
          .attr('text-anchor', 'middle')
          .attr('fill', '#3c8c3c')
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .text(valueText);

        const bbox = label.node().getBBox();
        textBg.attr('x', bbox.x - 2)
          .attr('y', bbox.y - 1)
          .attr('width', bbox.width + 4)
          .attr('height', bbox.height + 2);
        label.raise();
      });
    }

    if (slider) {
      slider.addEventListener('input', updateCursor);
      updateCursor();
    }
  }

  function loadIPR() {
    const track = document.querySelector('.ipr-carousel-track');
    const prevBtn = document.querySelector('.ipr-carousel-btn.prev');
    const nextBtn = document.querySelector('.ipr-carousel-btn.next');
    const currentSpan = document.querySelector('.ipr-carousel-indicator .current');

    if (!track || !prevBtn || !nextBtn || !currentSpan) return;

    const base = 'assets/images/images_per_reward';
    const names = ['Aesthetic', 'CLIP', 'HPSv2', 'ImageReward', 'Pick', 'SciScore', 'VQA', 'MIRO (All)'];
    const colors = {
      'Aesthetic': '#69c869',
      'CLIP': '#4fd2c8',
      'HPSv2': '#6496ff',
      'ImageReward': '#ff6978',
      'Pick': '#ff96c8',
      'SciScore': '#c769e6',
      'VQA': '#e1d34f',
      'MIRO (All)': '#ff9a50'
    };
    const prompts = {
      'rocket_wall': '"A rocket painted on a brick wall"',
      'robots_meditating': '"Robots meditating on top of a skyscraper"'
    };
    const dirs = ['rocket_wall', 'robots_meditating'];

    // Create slides
    dirs.forEach((dir) => {
      const slide = document.createElement('div');
      slide.className = 'ipr-slide';

      // Add prompt label
      const promptLabel = document.createElement('div');
      promptLabel.className = 'ipr-prompt';
      promptLabel.textContent = prompts[dir];
      slide.appendChild(promptLabel);

      // Add image row
      const row = document.createElement('div');
      row.className = 'ipr-row';
      names.forEach((n, i) => {
        const file = D.images.imagesPerReward[dir][i];
        const item = document.createElement('figure');
        item.className = 'ipr-item';
        const img = document.createElement('img');
        img.alt = dir + ' - ' + names[i];
        img.src = base + '/' + dir + '/' + file;
        const caption = document.createElement('figcaption');
        caption.textContent = names[i];
        caption.style.backgroundColor = colors[n] || '#888';
        caption.style.color = '#fff';
        item.appendChild(img);
        item.appendChild(caption);
        row.appendChild(item);
      });
      slide.appendChild(row);
      track.appendChild(slide);
    });

    // Carousel state
    let currentIndex = 0;
    let autoSlideInterval;
    const totalSlides = dirs.length;

    // Update position
    function updatePosition(smooth = true) {
      const offset = currentIndex * 100;

      if (smooth) {
        track.style.transition = 'transform 0.5s ease-in-out';
      } else {
        track.style.transition = 'none';
      }

      track.style.transform = `translateX(-${offset}%)`;
      currentSpan.textContent = currentIndex + 1;
    }

    // Next slide
    function nextSlide() {
      currentIndex = (currentIndex + 1) % totalSlides;
      updatePosition();
    }

    // Previous slide
    function prevSlide() {
      currentIndex = (currentIndex - 1 + totalSlides) % totalSlides;
      updatePosition();
    }

    // Auto-slide
    function startAutoSlide() {
      if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
      }
      autoSlideInterval = setInterval(nextSlide, 4000);
    }

    function stopAutoSlide() {
      if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
        autoSlideInterval = null;
      }
    }

    function resetAutoSlide() {
      stopAutoSlide();
      startAutoSlide();
    }

    // Event listeners
    nextBtn.addEventListener('click', () => {
      nextSlide();
      resetAutoSlide();
    });

    prevBtn.addEventListener('click', () => {
      prevSlide();
      resetAutoSlide();
    });

    // Pause on hover (respect reduced motion)
    const container = document.querySelector('.ipr-carousel-container');
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReduced) {
      container.addEventListener('mouseenter', stopAutoSlide);
      container.addEventListener('mouseleave', startAutoSlide);
    }

    // Touch support
    let touchStartX = 0;
    let touchEndX = 0;

    track.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      stopAutoSlide();
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
      startAutoSlide();
    }, { passive: true });

    // Initialize
    updatePosition(false);
    if (!prefersReduced) startAutoSlide();
  }

  function loadProgression() {
    const steps = D.images.progression.steps;
    const prompts = D.images.progression.prompts;
    const sub = ['baseline', 'miro'];
    const idxToStep = i => steps[i];

    const slider = document.getElementById('stepSlider');
    const label = document.getElementById('stepLabel');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playPauseIcon = playPauseBtn.querySelector('.play-pause-icon');

    // Get all image elements
    const baselineImgs = prompts.map((_, i) => document.getElementById(`prog_baseline_${i}`));
    const miroImgs = prompts.map((_, i) => document.getElementById(`prog_miro_${i}`));

    let autoPlayInterval = null;
    let isPlaying = true;
    let currentStep = 0;

    function setStep(i) {
      const s = idxToStep(i);
      label.textContent = 'Step ' + s.toLocaleString();
      slider.value = i;
      currentStep = i;

      // Update slider progress visual
      const progress = (i / (steps.length - 1)) * 100;
      slider.style.setProperty('--slider-progress', `${progress}%`);

      // Update all images
      prompts.forEach((prompt, idx) => {
        const promptId = prompt.id;
        baselineImgs[idx].src = `assets/images/training_progression/${promptId}/${sub[0]}/img_${promptId.padStart(6, '0')}_${s}.png`;
        miroImgs[idx].src = `assets/images/training_progression/${promptId}/${sub[1]}/img_${promptId.padStart(6, '0')}_${s}.png`;
      });
    }

    function startAutoPlay() {
      if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
      }

      isPlaying = true;
      playPauseIcon.textContent = '❚❚'; // Pause icon
      playPauseBtn.setAttribute('aria-label', 'Pause animation');

      autoPlayInterval = setInterval(() => {
        currentStep = (currentStep + 1) % steps.length;
        setStep(currentStep);
      }, 2000); // Change step every 2 seconds
    }

    function stopAutoPlay() {
      if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
      }

      isPlaying = false;
      playPauseIcon.textContent = '▶'; // Play icon
      playPauseBtn.setAttribute('aria-label', 'Play animation');
    }

    function togglePlayPause() {
      if (isPlaying) {
        stopAutoPlay();
      } else {
        startAutoPlay();
      }
    }

    // Play/Pause button click
    playPauseBtn.addEventListener('click', togglePlayPause);

    // Manual slider control pauses auto-play
    slider.addEventListener('input', e => {
      stopAutoPlay();
      setStep(parseInt(e.target.value, 10));
    });

    // Start auto-play
    setStep(0);
    startAutoPlay();
  }

  function loadQual() {
    const track = document.querySelector('.qual-carousel-track');
    const dotsContainer = document.querySelector('.carousel-dots');
    const prevBtn = document.querySelector('.carousel-arrow.prev');
    const nextBtn = document.querySelector('.carousel-arrow.next');

    if (!track || !dotsContainer || !prevBtn || !nextBtn) return;

    // Organize images into columns (2 rows per column)
    const totalImages = D.images.qualitativeCount;
    const imagesPerColumn = 2;
    const totalColumns = Math.ceil(totalImages / imagesPerColumn);

    // Create columns with images
    const columns = [];
    for (let col = 0; col < totalColumns; col++) {
      const column = document.createElement('div');
      column.className = 'qual-carousel-column';

      for (let row = 0; row < imagesPerColumn; row++) {
        const imgIndex = col * imagesPerColumn + row;
        if (imgIndex < totalImages) {
          const img = document.createElement('img');
          img.src = `assets/images/qualitative_images/image_${imgIndex}.jpg`;
          img.alt = `qualitative ${imgIndex}`;
          column.appendChild(img);
        }
      }

      columns.push(column);
    }

    // Prepend clones for seamless left scrolling
    columns.forEach(col => {
      const clone = col.cloneNode(true);
      track.appendChild(clone);
    });

    // Append original columns
    columns.forEach(col => {
      track.appendChild(col);
    });

    // Append more clones for seamless right scrolling
    columns.forEach(col => {
      const clone = col.cloneNode(true);
      track.appendChild(clone);
    });

    // Carousel state - start at the middle set (original columns)
    let currentIndex = totalColumns;
    let autoSlideInterval;
    let isTransitioning = false;

    // Get columns per view based on screen size
    function getColumnsPerView() {
      const width = window.innerWidth;
      if (width <= 500) return 1;
      if (width <= 700) return 2;
      return 4;
    }

    // Create dots
    function createDots() {
      dotsContainer.innerHTML = '';
      const columnsPerView = getColumnsPerView();
      const numDots = totalColumns;

      for (let i = 0; i < numDots; i++) {
        const dot = document.createElement('button');
        dot.className = 'carousel-dot';
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
        if (i === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(i));
        dotsContainer.appendChild(dot);
      }
    }

    // Update position and column sizes
    function updatePosition(smooth = true) {
      const container = document.querySelector('.qual-carousel-container');
      const containerWidth = container.offsetWidth;
      const columnsPerView = getColumnsPerView();

      // Calculate the actual column width by reading real paddings
      const cs = getComputedStyle(container);
      const pl = parseFloat(cs.paddingLeft) || 0;
      const pr = parseFloat(cs.paddingRight) || 0;
      const availableWidth = containerWidth - (pl + pr);

      // Column width should fit exactly columnsPerView in the available space
      const columnWidth = availableWidth / columnsPerView;

      // Set all column widths dynamically
      const allColumns = track.querySelectorAll('.qual-carousel-column');
      allColumns.forEach(col => {
        col.style.width = `${columnWidth}px`;
      });

      // Move by full columns - no offset needed since container padding handles the preview
      const offsetPx = currentIndex * columnWidth;

      if (smooth) {
        track.style.transition = 'transform 0.5s ease-in-out';
      } else {
        track.style.transition = 'none';
      }

      track.style.transform = `translateX(-${offsetPx}px)`;

      // Update dots (based on position within original columns)
      const dots = dotsContainer.querySelectorAll('.carousel-dot');
      dots.forEach((dot, i) => {
        const normalizedIndex = ((currentIndex - totalColumns) % totalColumns + totalColumns) % totalColumns;
        dot.classList.toggle('active', i === normalizedIndex);
      });
    }

    // Go to specific slide
    function goToSlide(index) {
      if (isTransitioning) return;
      // Map to the middle section (original columns)
      const targetIndex = totalColumns + Math.max(0, Math.min(index, totalColumns - 1));
      currentIndex = targetIndex;
      updatePosition();
      resetAutoSlide();
    }

    // Next slide
    function nextSlide() {
      if (isTransitioning) return;
      isTransitioning = true;

      currentIndex++;
      updatePosition();

      setTimeout(() => {
        // If we've scrolled past the middle section, reset to start of middle
        if (currentIndex >= totalColumns * 2) {
          currentIndex = totalColumns;
          updatePosition(false);
        }
        isTransitioning = false;
      }, 550);
    }

    // Previous slide
    function prevSlide() {
      if (isTransitioning) return;
      isTransitioning = true;

      currentIndex--;
      updatePosition();

      setTimeout(() => {
        // If we've scrolled before the middle section, reset to end of middle
        if (currentIndex < totalColumns) {
          currentIndex = totalColumns * 2 - 1;
          updatePosition(false);
        }
        isTransitioning = false;
      }, 550);
    }

    // Auto-slide
    function startAutoSlide() {
      // Clear any existing interval first
      if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
      }
      autoSlideInterval = setInterval(() => {
        nextSlide();
      }, 3500);
    }

    function stopAutoSlide() {
      if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
        autoSlideInterval = null;
      }
    }

    function resetAutoSlide() {
      stopAutoSlide();
      startAutoSlide();
    }

    // Event listeners
    nextBtn.addEventListener('click', () => {
      nextSlide();
      resetAutoSlide();
    });

    prevBtn.addEventListener('click', () => {
      prevSlide();
      resetAutoSlide();
    });

    // Pause on hover (skip if reduced motion)
    const container = document.querySelector('.qual-carousel-container');
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReduced) {
      container.addEventListener('mouseenter', stopAutoSlide);
      container.addEventListener('mouseleave', startAutoSlide);
    }

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        createDots();
        updatePosition(false);
      }, 250);
    });

    // Touch support for mobile
    let touchStartX = 0;
    let touchEndX = 0;

    track.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      stopAutoSlide();
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
      startAutoSlide();
    }, { passive: true });

    function handleSwipe() {
      const swipeThreshold = 50;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
    }

    // Initialize
    createDots();
    updatePosition(false);

    // Start auto-slide if user doesn't prefer reduced motion
    if (!prefersReduced) {
      setTimeout(() => { startAutoSlide(); }, 100);
    }
  }

  // Create scroll progress indicator
  function createScrollProgressIndicator() {
    let indicator = document.querySelector('.scroll-progress');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'scroll-progress';
      document.body.appendChild(indicator);
    }
    return indicator;
  }

  // Custom smooth scroll with easing
  function smoothScrollTo(targetElement, duration = 1000) {
    const startPosition = window.pageYOffset;
    // Calculate offset based on whether mobile navbar is visible
    const mobileNavbar = document.querySelector('.mobile-navbar');
    const offset = mobileNavbar && window.getComputedStyle(mobileNavbar).display !== 'none' ? 60 : 80;
    const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - offset;
    const distance = targetPosition - startPosition;
    let startTime = null;

    // Get or create progress indicator
    const progressIndicator = createScrollProgressIndicator();
    progressIndicator.classList.add('active');

    // Easing function for smooth acceleration/deceleration
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function animation(currentTime) {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      const ease = easeInOutCubic(progress);

      // Update scroll position
      window.scrollTo(0, startPosition + distance * ease);

      // Update progress indicator
      progressIndicator.style.transform = `scaleX(${progress})`;

      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      } else {
        // Hide progress indicator
        setTimeout(() => {
          progressIndicator.classList.remove('active');
          progressIndicator.style.transform = 'scaleX(0)';
        }, 200);

        // Trigger highlight animation after scroll completes
        targetElement.classList.add('toc-highlight');
        setTimeout(() => {
          targetElement.classList.remove('toc-highlight');
        }, 1500);
      }
    }

    requestAnimationFrame(animation);
  }

  function buildTOC() {
    const toc = document.getElementById('tocList');
    if (!toc) return;
    const sections = Array.from(document.querySelectorAll('main > section'))
      .filter(s => s.id && s.querySelector('h2'));
    sections.forEach((s, idx) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${s.id}`;

      // Add section number and title
      const number = document.createElement('span');
      number.className = 'toc-number';
      number.textContent = `${idx + 1}.`;

      const title = document.createElement('span');
      title.className = 'toc-title';
      title.textContent = s.querySelector('h2').textContent;

      a.appendChild(number);
      a.appendChild(title);
      li.appendChild(a);
      toc.appendChild(li);

      // Add click animation
      a.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);

        if (targetSection) {
          // Add pulse animation to the clicked TOC item
          this.style.transition = 'transform 0.3s ease';
          this.style.transform = 'scale(1.05)';

          setTimeout(() => {
            this.style.transform = 'scale(1)';
          }, 300);

          // Custom smooth scroll with easing
          smoothScrollTo(targetSection, 800);
        }
      });
    });

    // Build sidebar TOC and mobile TOC after main TOC is built
    buildSidebarTOC(sections);
    buildMobileTOC(sections);
  }

  function buildMobileTOC(sections) {
    const mobileToc = document.getElementById('mobileTocList');
    if (!mobileToc) return;

    // Clear existing items
    mobileToc.innerHTML = '';

    sections.forEach((s, idx) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${s.id}`;

      // Add section number and title
      const number = document.createElement('span');
      number.className = 'toc-number';
      number.textContent = `${idx + 1}`;
      a.appendChild(number);

      const title = document.createElement('span');
      title.className = 'toc-title';
      const h2 = s.querySelector('h2');
      title.textContent = h2 ? h2.textContent : '';
      a.appendChild(title);

      // Add click handler with smooth scroll animation
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = e.currentTarget.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);

        if (targetSection) {
          // Custom smooth scroll with easing
          smoothScrollTo(targetSection, 800);
        }

        // Close dropdown after initiating scroll
        const dropdown = document.getElementById('tocDropdown');
        if (dropdown) {
          dropdown.classList.remove('open');
        }
      });

      li.appendChild(a);
      mobileToc.appendChild(li);
    });
  }

  function setupMobileNav() {
    const tocDropdownBtn = document.getElementById('tocDropdownBtn');
    const tocDropdown = document.getElementById('tocDropdown');

    if (tocDropdownBtn && tocDropdown) {
      tocDropdownBtn.addEventListener('click', () => {
        tocDropdown.classList.toggle('open');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!tocDropdownBtn.contains(e.target) && !tocDropdown.contains(e.target)) {
          tocDropdown.classList.remove('open');
        }
      });

      // Close dropdown on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && tocDropdown.classList.contains('open')) {
          tocDropdown.classList.remove('open');
        }
      });
    }
  }

  function buildSidebarTOC(sections) {
    // Create sidebar TOC container
    const sidebarTOC = document.createElement('nav');
    sidebarTOC.className = 'sidebar-toc';
    sidebarTOC.setAttribute('aria-label', 'Sticky table of contents');

    const heading = document.createElement('h3');
    heading.textContent = 'Contents';
    sidebarTOC.appendChild(heading);

    const ul = document.createElement('ul');

    sections.forEach((s, idx) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${s.id}`;
      a.setAttribute('data-section-id', s.id);

      const number = document.createElement('span');
      number.className = 'toc-number';
      number.textContent = `${idx + 1}.`;

      const title = document.createElement('span');
      title.className = 'toc-title';
      title.textContent = s.querySelector('h2').textContent;

      a.appendChild(number);
      a.appendChild(title);
      li.appendChild(a);
      ul.appendChild(li);

      // Add click handler with animation
      a.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);

        if (targetSection) {
          // Custom smooth scroll with easing
          smoothScrollTo(targetSection, 800);
        }
      });
    });

    sidebarTOC.appendChild(ul);
    document.body.appendChild(sidebarTOC);

    // Set up scroll listener to show/hide and update active state
    setupSidebarTOCScroll(sidebarTOC, sections);
  }

  function setupSidebarTOCScroll(sidebarTOC, sections) {
    const mainTOCSection = document.getElementById('contents');
    if (!mainTOCSection) return;

    let ticking = false;

    function updateSidebarTOC() {
      const mainTOCRect = mainTOCSection.getBoundingClientRect();
      const shouldShow = mainTOCRect.bottom < 0;

      if (shouldShow) {
        sidebarTOC.classList.add('visible');
      } else {
        sidebarTOC.classList.remove('visible');
      }

      // Update active section
      let activeSection = null;
      const scrollPosition = window.scrollY + 150; // Offset for header

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.offsetTop <= scrollPosition) {
          activeSection = section;
          break;
        }
      }

      // Update active state in sidebar
      const links = sidebarTOC.querySelectorAll('a');
      links.forEach(link => {
        const sectionId = link.getAttribute('data-section-id');
        if (activeSection && sectionId === activeSection.id) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });

      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateSidebarTOC);
        ticking = true;
      }
    });

    // Initial update
    updateSidebarTOC();
  }

  function loadTheme() {
    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Update desktop theme toggle
    const btn = document.getElementById('themeToggle');
    const themeIcon = btn ? btn.querySelector('.theme-icon') : null;
    if (themeIcon) {
      themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
    }

    // Update mobile theme toggle
    const mobileBtn = document.getElementById('mobileThemeToggle');
    const mobileThemeIcon = mobileBtn ? mobileBtn.querySelector('.theme-icon') : null;
    if (mobileThemeIcon) {
      mobileThemeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
    }
  }

  function enhanceInteractivity() {
    // Theme toggle handler function
    const toggleTheme = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);

      // Update both theme toggle buttons
      const desktopIcon = document.querySelector('#themeToggle .theme-icon');
      const mobileIcon = document.querySelector('#mobileThemeToggle .theme-icon');

      if (desktopIcon) {
        desktopIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
      }
      if (mobileIcon) {
        mobileIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
      }

      // Redraw D3 plots after theme change
      setTimeout(() => {
        plotTraining();
        plotTTS();
        plotRadars();
        plotSynthetic();
        plotSOTAComparison();
        plotWeights();

        // Re-trigger radar animations after theme change
        setTimeout(() => {
          const radarPlots = ['radar_specialists', 'radar_geneval', 'synthetic_geneval', 'synthetic_aesthetic'];
          radarPlots.forEach((id) => {
            const container = document.getElementById(id);
            if (container && container._animateRadar) {
              container._animateRadar();
            }
          });
        }, 50);
      }, 50);
    };

    // Desktop theme toggle
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.addEventListener('click', toggleTheme);
    }

    // Mobile theme toggle
    const mobileBtn = document.getElementById('mobileThemeToggle');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', toggleTheme);
    }

    const modelSel = document.getElementById('radarModel');
    function refresh() {
      plotRadarSpecialists();
      plotRadarGeneval();

      // Re-trigger animations after plots are redrawn
      setTimeout(() => {
        const radarPlots = ['radar_specialists', 'radar_geneval'];
        radarPlots.forEach((id) => {
          const container = document.getElementById(id);
          if (container && container._animateRadar) {
            container._animateRadar();
          }
        });
      }, 50);
    }
    if (modelSel) modelSel.addEventListener('change', refresh);

    const w = document.getElementById('weightCursor');
    const wl = document.getElementById('weightCursorLabel');
    if (w) {
      const xs = window.MIRO_DATA.weightSweeps.x;
      function on() { const idx = parseInt(w.value, 10); wl.textContent = 'aesthetic weight = ' + xs[idx].toFixed(3); }
      w.addEventListener('input', on); on();
    }
  }

  function enableSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const hash = a.getAttribute('href');
        if (hash.length > 1) {
          e.preventDefault();
          const el = document.querySelector(hash);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          history.pushState(null, '', hash);
        }
      });
    });
  }

  function computeMetrics() {
    // Time-to-target and AUC for training curves
    const container = document.getElementById('train_metrics');
    if (container) {
      const defs = [
        ['Aesthetic', 'aesthetic', 5.19],
        ['ImageReward', 'imagereward', 0.541],
        ['Pick', 'pick', 0.2118],
        ['HPSv2', 'hpsv2', 0.2477]
      ];
      defs.forEach(([label, key, target]) => {
        const base = window.MIRO_DATA.trainingCurves[key].baseline;
        const miro = window.MIRO_DATA.trainingCurves[key].miro;
        function ttt(arr) {
          for (const [x, y] of arr) { if (y >= target) return x; }
          return arr[arr.length - 1][0];
        }
        function auc(arr) {
          let area = 0; for (let i = 1; i < arr.length; i++) { const [x0, y0] = arr[i - 1]; const [x1, y1] = arr[i]; area += (x1 - x0) * (y0 + y1) / 2; } return area;
        }
        const tBase = ttt(base), tM = ttt(miro);
        const speed = (tBase / tM).toFixed(1) + '×';
        const aBase = auc(base), aM = auc(miro);
        const card = document.createElement('div'); card.className = 'kpi card';
        card.innerHTML = `<div class="kpi-num">${speed}</div><div class="kpi-label">${label} speedup (TTT)</div>`;
        container.appendChild(card);
      });
    }

    // Equivalent samples for TTS
    const tts = document.getElementById('tts_metrics');
    if (tts) {
      function eqSamples(metric) {
        const xs = window.MIRO_DATA.testTimeScaling.x; const m = window.MIRO_DATA.testTimeScaling[metric];
        // find k where baseline at max matches MIRO at xs[k]
        const target = m.miro[m.miro.length - 1];
        let k = 0; while (k < m.baseline.length && m.baseline[k] < target) k++;
        const factor = k > 0 ? (xs[xs.length - 1] / xs[Math.min(k, xs.length - 1)]) : Infinity;
        return !isFinite(factor) ? '>' + (xs[xs.length - 1]) + '×' : (factor.toFixed(1) + '×');
      }
      const defs = [['Aesthetic', 'aesthetic'], ['ImageReward', 'imagereward'], ['Pick', 'pick'], ['HPSv2', 'hpsv2']];
      defs.forEach(([label, key]) => {
        const card = document.createElement('div'); card.className = 'kpi card';
        card.innerHTML = `<div class="kpi-num">${eqSamples(key)}</div><div class="kpi-label">${label} eq. samples</div>`;
        tts.appendChild(card);
      });
    }
  }

  function setupTrainingAnimation() {
    // Create an Intersection Observer to trigger animation on scroll
    // Observe individual plot containers instead of entire sections for better mobile trigger
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.target.dataset.animated !== 'true') {
          // Mark as animated to prevent re-triggering while visible
          entry.target.dataset.animated = 'true';

          // Trigger animation based on container type
          const container = entry.target;
          if (container._animateTraining) {
            container._animateTraining();
          } else if (container._animateTTS) {
            container._animateTTS();
          } else if (container._animateRadar) {
            container._animateRadar();
          } else if (container._animateBarplot) {
            container._animateBarplot();
          }
        } else if (!entry.isIntersecting && entry.target.dataset.animated === 'true') {
          // Reset animation flag when element leaves viewport
          // This allows animations to replay when scrolling back
          delete entry.target.dataset.animated;
        }
      });
    }, {
      threshold: 0.2, // Trigger when 20% of the plot is visible
      rootMargin: '0px'
    });

    // Helper function to check if element is in viewport and trigger animation
    function checkAndTriggerAnimation(element) {
      if (!element || element.dataset.animated === 'true') return;

      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;

      // Check if at least 20% of the element is visible
      const isVisible = rect.top < windowHeight * 0.8 && rect.bottom > windowHeight * 0.2;

      if (isVisible) {
        element.dataset.animated = 'true';

        if (element._animateTraining) {
          element._animateTraining();
        } else if (element._animateTTS) {
          element._animateTTS();
        } else if (element._animateRadar) {
          element._animateRadar();
        } else if (element._animateBarplot) {
          element._animateBarplot();
        }
      }
    }

    // Observe individual training curve plots
    const trainingCurves = ['curve_aesthetic', 'curve_imagereward', 'curve_pick', 'curve_hpsv2'];
    trainingCurves.forEach((id) => {
      const container = document.getElementById(id);
      if (container) {
        observer.observe(container);
        setTimeout(() => checkAndTriggerAnimation(container), 100);
      }
    });

    // Observe individual test-time scaling plots
    const ttsPlots = ['tts_aesthetic', 'tts_imagereward', 'tts_pick', 'tts_hpsv2'];
    ttsPlots.forEach((id) => {
      const container = document.getElementById(id);
      if (container) {
        observer.observe(container);
        setTimeout(() => checkAndTriggerAnimation(container), 100);
      }
    });

    // Observe individual radar plots
    const radarPlots = ['radar_specialists', 'radar_geneval', 'synthetic_geneval', 'synthetic_aesthetic'];
    radarPlots.forEach((id) => {
      const container = document.getElementById(id);
      if (container) {
        observer.observe(container);
        setTimeout(() => checkAndTriggerAnimation(container), 100);
      }
    });

    // Observe individual SOTA barplots
    const barplots = ['sota_geneval', 'sota_imagereward', 'sota_params', 'sota_compute'];
    barplots.forEach((id) => {
      const container = document.getElementById(id);
      if (container) {
        observer.observe(container);
        setTimeout(() => checkAndTriggerAnimation(container), 100);
      }
    });
  }

  function setupCopyBibtex() {
    const copyBtn = document.getElementById('copyBibtexBtn');
    const bibtexCode = document.getElementById('bibtexCode');

    if (!copyBtn || !bibtexCode) return;

    copyBtn.addEventListener('click', async () => {
      const bibtexText = bibtexCode.textContent.trim();

      try {
        // Try using the modern Clipboard API
        await navigator.clipboard.writeText(bibtexText);

        // Visual feedback
        copyBtn.classList.add('copied');
        const originalText = copyBtn.querySelector('.copy-text').textContent;
        copyBtn.querySelector('.copy-text').textContent = 'Copied!';

        // Reset after 2 seconds
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.querySelector('.copy-text').textContent = originalText;
        }, 2000);
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = bibtexText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();

        try {
          document.execCommand('copy');
          copyBtn.classList.add('copied');
          const originalText = copyBtn.querySelector('.copy-text').textContent;
          copyBtn.querySelector('.copy-text').textContent = 'Copied!';

          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.querySelector('.copy-text').textContent = originalText;
          }, 2000);
        } catch (err2) {
          console.error('Failed to copy text: ', err2);
          copyBtn.querySelector('.copy-text').textContent = 'Failed to copy';
          setTimeout(() => {
            copyBtn.querySelector('.copy-text').textContent = 'Copy BibTeX';
          }, 2000);
        }

        document.body.removeChild(textArea);
      }
    });
  }

  function init() {
    loadTheme();
    buildTOC();
    setupMobileNav();
    plotTraining();
    plotTTS();
    plotRadars();
    plotWeights();
    plotSynthetic();
    plotSOTAComparison();
    loadIPR();
    loadProgression();
    loadQual();
    enableSmoothScroll();
    enhanceInteractivity();
    computeMetrics();
    setupTrainingAnimation();
    setupCopyBibtex();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
