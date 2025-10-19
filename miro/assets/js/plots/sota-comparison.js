(function () {
  'use strict';

  const D = window.MIRO_DATA;

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

  // Expose to global namespace
  window.MIRO = window.MIRO || {};
  window.MIRO.plotSOTAComparison = plotSOTAComparison;
})();
