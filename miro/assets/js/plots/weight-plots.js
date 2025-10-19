(function () {
  'use strict';

  const D = window.MIRO_DATA;

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

  // Expose to global namespace
  window.MIRO = window.MIRO || {};
  window.MIRO.plotWeights = plotWeights;
})();
