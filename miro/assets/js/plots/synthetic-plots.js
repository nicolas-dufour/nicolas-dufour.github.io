(function () {
  'use strict';

  const D = window.MIRO_DATA;

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

  // Expose to global namespace
  window.MIRO = window.MIRO || {};
  window.MIRO.plotSynthetic = plotSynthetic;
})();
