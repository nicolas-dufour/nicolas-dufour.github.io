(function () {
  'use strict';

  function loadPairwiseTradeoff() {
    // Prompt configuration: display names mapped to folder names
    const prompts = [
      { display: '⛵ Galleon in storm', folder: 'galleon_in_storm' },
      { display: '🤖 Rusty Robot', folder: 'rusty_robot' },
      { display: '🚀 Jungle Astronaut', folder: 'astronaut_jungle' },
      { display: '⚔️ Old Warrior Chief', folder: 'old_warrior_chief' }
    ];

    // Reward configuration: display names mapped to folder names and colors (from radar_plot.tex)
    const rewards = [
      { display: 'Aesthetic Score', folder: 'aesthetic_score', color: '#69c869', csvName: 'Aesthetic Score' },
      { display: 'CLIP Score', folder: 'clip_score', color: '#50d2c8', csvName: 'CLIP Score' },
      { display: 'HPSv2', folder: 'hpsv2_score', color: '#6496ff', csvName: 'HPSv2' },
      { display: 'Image Reward', folder: 'image_reward_score', color: '#ff6978', csvName: 'Image Reward' },
      { display: 'PickScore', folder: 'pick_a_score_score', color: '#ff96dc', csvName: 'PickScore' },
      { display: 'SciScore', folder: 'sciscore_score', color: '#c869e6', csvName: 'SciScore' },
      { display: 'VQA', folder: 'vqa_score', color: '#e6d250', csvName: 'VQA Score' }
    ];

    // CSV data storage
    let csvData = null;
    let dataRanges = null;

    // Get DOM elements
    const promptSelect = document.getElementById('promptSelect');
    const rewardASelect = document.getElementById('rewardA');
    const rewardBSelect = document.getElementById('rewardB');
    const slider = document.getElementById('pairwiseSlider');
    const sliderValue = document.getElementById('sliderValue');
    const rewardALabel = document.getElementById('rewardALabel');
    const rewardBLabel = document.getElementById('rewardBLabel');
    const imageContainer = document.querySelector('.pairwise-image-container');
    const image = document.getElementById('pairwiseImage');
    const imageGlow = document.querySelector('.pairwise-image-glow');
    const dropdownGroups = document.querySelectorAll('.pairwise-dropdown-group');
    const radarContainer = document.getElementById('pairwiseRadar');

    if (!promptSelect || !rewardASelect || !rewardBSelect || !slider || !sliderValue || !image || !rewardALabel || !rewardBLabel || !radarContainer || !imageGlow) {
      return;
    }

    // Autoplay state
    let isAutoPlaying = false;
    let autoPlayInterval = null;
    let autoPlayDirection = 1; // 1 for forward, -1 for backward

    // Create custom dropdown
    function createCustomDropdown(selectElement, rewards, isPromptDropdown = false) {
      const parent = selectElement.parentElement;

      // Remove the 'for' attribute from label to prevent default behavior
      const label = parent.querySelector('label');
      if (label) {
        if (label.hasAttribute('for')) {
          label.removeAttribute('for');
        }
        // Prevent any default label behavior
        label.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      }

      // Create custom dropdown container
      const customDropdown = document.createElement('div');
      customDropdown.className = isPromptDropdown ? 'custom-dropdown prompt-dropdown' : 'custom-dropdown';

      // Create selected display
      const selectedDisplay = document.createElement('div');
      selectedDisplay.className = 'custom-dropdown-selected';

      // Create options container
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'custom-dropdown-options';

      // Populate options
      rewards.forEach(reward => {
        const option = document.createElement('div');
        option.className = 'custom-dropdown-option';
        option.textContent = reward.display;
        option.setAttribute('data-value', reward.folder);
        option.style.setProperty('--option-color', reward.color);

        option.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Don't allow selection if disabled
          if (option.classList.contains('disabled')) {
            return;
          }
          selectOption(reward.folder, reward.display, reward.color);
          closeDropdown();
        });

        optionsContainer.appendChild(option);

        // Also populate native select
        const nativeOption = document.createElement('option');
        nativeOption.value = reward.folder;
        nativeOption.textContent = reward.display;
        selectElement.appendChild(nativeOption);
      });

      // Function to select an option
      function selectOption(value, display, color) {
        selectElement.value = value;
        selectedDisplay.textContent = display;
        selectedDisplay.style.setProperty('--indicator-color', color);

        // Update selected state in options
        optionsContainer.querySelectorAll('.custom-dropdown-option').forEach(opt => {
          opt.classList.toggle('selected', opt.getAttribute('data-value') === value);
        });

        // Trigger change event
        selectElement.dispatchEvent(new Event('change'));
      }

      // Toggle dropdown
      function toggleDropdown() {
        const isOpen = customDropdown.classList.contains('open');
        closeAllDropdowns();
        if (!isOpen) {
          customDropdown.classList.add('open');
        }
      }

      function closeDropdown() {
        customDropdown.classList.remove('open');
      }

      function closeAllDropdowns() {
        document.querySelectorAll('.custom-dropdown').forEach(dd => {
          dd.classList.remove('open');
        });
      }

      // Function to disable specific options
      function disableOption(value) {
        optionsContainer.querySelectorAll('.custom-dropdown-option').forEach(opt => {
          if (opt.getAttribute('data-value') === value) {
            opt.classList.add('disabled');
          }
        });
      }

      // Function to enable specific options
      function enableOption(value) {
        optionsContainer.querySelectorAll('.custom-dropdown-option').forEach(opt => {
          if (opt.getAttribute('data-value') === value) {
            opt.classList.remove('disabled');
          }
        });
      }

      // Function to enable all options
      function enableAllOptions() {
        optionsContainer.querySelectorAll('.custom-dropdown-option').forEach(opt => {
          opt.classList.remove('disabled');
        });
      }

      // Event listeners
      selectedDisplay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleDropdown();
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!customDropdown.contains(e.target)) {
          closeDropdown();
        }
      });

      // Assemble custom dropdown
      customDropdown.appendChild(selectedDisplay);
      customDropdown.appendChild(optionsContainer);
      parent.appendChild(customDropdown);

      return { selectOption, customDropdown, disableOption, enableOption, enableAllOptions };
    }

    // Create custom dropdowns for prompt and both reward selects
    const customDropdownPrompt = createCustomDropdown(promptSelect, prompts, true);
    const customDropdownA = createCustomDropdown(rewardASelect, rewards);
    const customDropdownB = createCustomDropdown(rewardBSelect, rewards);

    // Function to update disabled options
    function updateDisabledOptions() {
      const valueA = rewardASelect.value;
      const valueB = rewardBSelect.value;

      // Enable all options first
      customDropdownA.enableAllOptions();
      customDropdownB.enableAllOptions();

      // Disable the selected option in the other dropdown
      if (valueA) {
        customDropdownB.disableOption(valueA);
      }
      if (valueB) {
        customDropdownA.disableOption(valueB);
      }
    }

    // Create swap button
    function createSwapButton() {
      // Create swap button
      const swapButton = document.createElement('button');
      swapButton.className = 'pairwise-swap-button';
      swapButton.innerHTML = '⇄';
      swapButton.title = 'Swap Reward A and Reward B';
      swapButton.setAttribute('aria-label', 'Swap rewards');

      // Add click handler
      swapButton.addEventListener('click', (e) => {
        e.preventDefault();
        swapRewards();
      });

      // Insert between Reward A (index 1) and Reward B (index 2) dropdown groups
      const rewardADropdownGroup = dropdownGroups[1];
      const rewardBDropdownGroup = dropdownGroups[2];
      if (rewardADropdownGroup && rewardBDropdownGroup && rewardADropdownGroup.parentNode) {
        rewardADropdownGroup.parentNode.insertBefore(swapButton, rewardBDropdownGroup);
      }
    }

    // Swap rewards function
    function swapRewards() {
      const valueA = rewardASelect.value;
      const valueB = rewardBSelect.value;

      // Get display names and colors
      const rewardA = rewards.find(r => r.folder === valueA);
      const rewardB = rewards.find(r => r.folder === valueB);

      if (rewardA && rewardB) {
        // Swap the selections
        customDropdownA.selectOption(valueB, rewardB.display, rewardB.color);
        customDropdownB.selectOption(valueA, rewardA.display, rewardA.color);
      }
    }

    // Create autoplay button
    function createAutoPlayButton() {
      const sliderContainer = slider.parentElement;
      if (!sliderContainer) return;

      const autoPlayButton = document.createElement('button');
      autoPlayButton.className = 'pairwise-autoplay-button';
      autoPlayButton.innerHTML = '▶';
      autoPlayButton.title = 'Auto-play interpolation';
      autoPlayButton.setAttribute('aria-label', 'Toggle autoplay');

      autoPlayButton.addEventListener('click', (e) => {
        e.preventDefault();
        toggleAutoPlay(autoPlayButton);
      });

      sliderContainer.appendChild(autoPlayButton);
    }

    // Toggle autoplay
    function toggleAutoPlay(button) {
      isAutoPlaying = !isAutoPlaying;

      if (isAutoPlaying) {
        button.innerHTML = '⏸';
        button.classList.add('playing');
        startAutoPlay();
      } else {
        button.innerHTML = '▶';
        button.classList.remove('playing');
        stopAutoPlay();
      }
    }

    // Start autoplay
    function startAutoPlay() {
      if (autoPlayInterval) return;

      autoPlayInterval = setInterval(() => {
        let currentValue = parseInt(slider.value, 10);
        currentValue += autoPlayDirection;

        // Reverse direction at boundaries
        if (currentValue >= 31) {
          currentValue = 31;
          autoPlayDirection = -1;
        } else if (currentValue <= 0) {
          currentValue = 0;
          autoPlayDirection = 1;
        }

        slider.value = currentValue;
        updateImage();
      }, 150); // Update every 150ms for smoother, slower animation
    }

    // Stop autoplay
    function stopAutoPlay() {
      if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
      }
    }

    // Set defaults: Old Galleon (prompt), Aesthetic Score (A) and CLIP Score (B)
    customDropdownPrompt.selectOption('galleon_in_storm', '⛵ Galleon in storm', null);
    customDropdownA.selectOption('image_reward_score', 'ImageReward', '#69c869');
    customDropdownB.selectOption('clip_score', 'CLIP Score', '#50d2c8');

    // Create swap and autoplay buttons
    createSwapButton();
    createAutoPlayButton();

    // Update disabled options initially
    updateDisabledOptions();

    // Helper function to get display name from folder name
    function getDisplayName(folderName) {
      const reward = rewards.find(r => r.folder === folderName);
      return reward ? reward.display : folderName;
    }

    // Helper function to get color from folder name
    function getColor(folderName) {
      const reward = rewards.find(r => r.folder === folderName);
      return reward ? reward.color : '#69c869';
    }

    // Helper function to get CSV name from folder name
    function getCsvName(folderName) {
      const reward = rewards.find(r => r.folder === folderName);
      return reward ? reward.csvName : folderName;
    }

    // Helper function to interpolate between two hex colors
    function interpolateColor(color1, color2, t) {
      // Parse hex colors
      const r1 = parseInt(color1.substring(1, 3), 16);
      const g1 = parseInt(color1.substring(3, 5), 16);
      const b1 = parseInt(color1.substring(5, 7), 16);

      const r2 = parseInt(color2.substring(1, 3), 16);
      const g2 = parseInt(color2.substring(3, 5), 16);
      const b2 = parseInt(color2.substring(5, 7), 16);

      // Interpolate
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);

      // Convert back to hex
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // Helper function to convert hex color to RGB
    function hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    }

    // Helper function to determine correct folder and frame
    function getFolderAndFrame(rewardA, rewardB, sliderPosition) {
      const folderName = `${rewardA}_vs_${rewardB}`;
      const reverseFolderName = `${rewardB}_vs_${rewardA}`;

      // Check if the forward pair exists by checking common pairs
      // We'll use the forward direction by default
      const knownPairs = [
        'aesthetic_score_vs_hpsv2_score',
        'aesthetic_score_vs_image_reward_score',
        'aesthetic_score_vs_pick_a_score_score',
        'aesthetic_score_vs_sciscore_score',
        'aesthetic_score_vs_vqa_score',
        'clip_score_vs_aesthetic_score',
        'clip_score_vs_hpsv2_score',
        'clip_score_vs_image_reward_score',
        'clip_score_vs_pick_a_score_score',
        'clip_score_vs_sciscore_score',
        'clip_score_vs_vqa_score',
        'hpsv2_score_vs_sciscore_score',
        'hpsv2_score_vs_vqa_score',
        'image_reward_score_vs_hpsv2_score',
        'image_reward_score_vs_pick_a_score_score',
        'image_reward_score_vs_sciscore_score',
        'image_reward_score_vs_vqa_score',
        'pick_a_score_score_vs_hpsv2_score',
        'pick_a_score_score_vs_sciscore_score',
        'pick_a_score_score_vs_vqa_score',
        'vqa_score_vs_sciscore_score'
      ];

      let useFolder;
      let frameIndex;

      if (knownPairs.includes(folderName)) {
        // Use forward direction
        useFolder = folderName;
        frameIndex = sliderPosition;
      } else if (knownPairs.includes(reverseFolderName)) {
        // Use reverse direction
        useFolder = reverseFolderName;
        frameIndex = 31 - sliderPosition;
      } else {
        // Default to forward (shouldn't happen with proper configuration)
        useFolder = folderName;
        frameIndex = sliderPosition;
      }

      return { folder: useFolder, frame: frameIndex };
    }

    // Load and parse CSV data for a specific prompt
    async function loadCSVData(prompt) {
      try {
        const response = await fetch(`assets/images/pairwise_tradeoffs/${prompt}/all_tradeoff_scores.csv`);
        const text = await response.text();
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());

        const data = {};
        const ranges = {
          aesthetic_score: [Infinity, -Infinity],
          image_reward: [Infinity, -Infinity],
          pick_score: [Infinity, -Infinity],
          hpsv2_score: [Infinity, -Infinity],
          clip_score: [Infinity, -Infinity],
          openai_clip_score: [Infinity, -Infinity]
        };

        // Process all lines
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue; // Skip empty lines
          const values = lines[i].split(',').map(v => v.trim());
          const row = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx];
          });

          const key = `${row.reward_a}_${row.reward_b}_${row.frame}`;
          data[key] = row;

          // Update ranges
          Object.keys(ranges).forEach(metric => {
            const val = parseFloat(row[metric]);
            if (!isNaN(val)) {
              ranges[metric][0] = Math.min(ranges[metric][0], val);
              ranges[metric][1] = Math.max(ranges[metric][1], val);
            }
          });
        }

        csvData = data;
        dataRanges = ranges;
      } catch (error) {
        console.error('Failed to load CSV data:', error);
      }
    }

    // Create radar plot
    function createRadarPlot(rewardData) {
      if (!rewardData) return;

      // Clear container and any existing tooltips
      radarContainer.innerHTML = '';
      d3.selectAll('.pairwise-radar-tooltip').remove();

      // Get theme colors
      const rootStyles = getComputedStyle(document.documentElement);
      const fgColor = rootStyles.getPropertyValue('--fg').trim() || '#e6e6e6';
      const isLightMode = fgColor === '#1a1a1a';
      const textColor = isLightMode ? '#1f2937' : fgColor;

      // Define axes (6 metrics) - using exact CSV column names
      const axes = [
        { key: 'pick_score', label: 'Pick', color: '#ff96c8' },
        { key: 'aesthetic_score', label: 'Aesthetic', color: '#69c869' },
        { key: 'openai_clip_score', label: 'OpenAI CLIP', color: '#4fd2c8' },
        { key: 'hpsv2_score', label: 'HPSv2', color: '#6496ff' },
        { key: 'clip_score', label: 'CLIP', color: '#4fd2c8' },
        { key: 'image_reward', label: 'ImageReward', color: '#ff6978' }
      ];

      // Normalize values to 0-5 scale
      const values = axes.map(axis => {
        const val = parseFloat(rewardData[axis.key]);
        if (isNaN(val)) return 0;
        const range = dataRanges[axis.key];
        if (!range) return 0;
        const [min, max] = range;
        const normalized = 5 * (val - min) / (max - min);
        return isNaN(normalized) ? 0 : normalized;
      });

      const numAxes = axes.length;

      // SVG setup - use container dimensions
      const width = radarContainer.offsetWidth || 500;
      const height = radarContainer.offsetHeight || 500;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - 80;

      const svg = d3.select(radarContainer)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .style('overflow', 'visible');

      // Background - transparent to inherit container background
      svg.append('rect')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', 'transparent')
        .style('pointer-events', 'none');

      const g = svg.append('g')
        .attr('transform', `translate(${centerX},${centerY})`);

      // Draw circular grid
      const levels = 5;
      for (let i = 1; i <= levels; i++) {
        g.append('circle')
          .attr('r', radius * i / levels)
          .attr('fill', 'none')
          .attr('stroke', isLightMode ? '#d1d5db' : '#4b5563')
          .attr('stroke-opacity', isLightMode ? 0.5 : 0.3)
          .attr('stroke-width', 1);
      }

      // Draw axes
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
          .attr('stroke', isLightMode ? '#d1d5db' : '#4b5563')
          .attr('stroke-opacity', isLightMode ? 0.6 : 0.4)
          .attr('stroke-width', 1);

        // Axis label with color
        const labelRadius = radius + 35;
        const labelX = Math.cos(angle) * labelRadius;
        const labelY = Math.sin(angle) * labelRadius;

        g.append('text')
          .attr('x', labelX)
          .attr('y', labelY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', axis.color)
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .text(axis.label);
      });

      // Create radar path
      const radarPath = values.map((val, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        const r = radius * Math.max(0, Math.min(5, val)) / 5; // Clamp values between 0 and 5
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        return [x, y];
      });

      // Validate that we have valid path data
      const validPath = radarPath.every(p => !isNaN(p[0]) && !isNaN(p[1]) && isFinite(p[0]) && isFinite(p[1]));
      if (!validPath) return;

      // Draw radar area (polygon must be drawn before points to appear behind them)
      const polygon = g.append('polygon')
        .attr('points', radarPath.map(p => `${p[0]},${p[1]}`).join(' '))
        .attr('fill', '#ff9a50')
        .attr('fill-opacity', isLightMode ? 0.25 : 0.3)
        .attr('stroke', '#ff9a50')
        .attr('stroke-width', 2.5)
        .attr('stroke-opacity', isLightMode ? 0.9 : 1)
        .style('pointer-events', 'none');

      // Create tooltip (attach to body for proper positioning)
      const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'pairwise-radar-tooltip')
        .style('position', 'fixed')
        .style('background', isLightMode ? 'rgba(255, 255, 255, 0.98)' : 'rgba(0, 0, 0, 0.9)')
        .style('border', '1px solid ' + (isLightMode ? '#e5e7eb' : '#444'))
        .style('border-radius', '8px')
        .style('padding', '12px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('font-size', '13px')
        .style('color', textColor)
        .style('box-shadow', isLightMode ? '0 4px 12px rgba(0,0,0,0.1)' : '0 4px 12px rgba(0,0,0,0.3)')
        .style('z-index', '10000')
        .style('transition', 'opacity 0.2s ease');

      // Draw points on top with tooltips
      radarPath.forEach((point, i) => {
        const axis = axes[i];
        const rawValue = parseFloat(rewardData[axis.key]);
        const normalizedValue = values[i];

        g.append('circle')
          .attr('cx', point[0])
          .attr('cy', point[1])
          .attr('r', 5)
          .attr('fill', '#ff9a50')
          .attr('stroke', isLightMode ? '#ffffff' : '#ffffff')
          .attr('stroke-width', 2.5)
          .style('cursor', 'pointer')
          .style('pointer-events', 'all')
          .style('filter', isLightMode ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' : 'none')
          .on('mouseover', function (event) {
            console.log('Hover detected on point', axis.label); // Debug
            d3.select(this)
              .transition()
              .duration(150)
              .attr('r', 8);

            tooltip
              .style('opacity', 1)
              .style('left', (event.clientX + 15) + 'px')
              .style('top', (event.clientY - 15) + 'px')
              .html(`
                <div style="font-weight: 600; margin-bottom: 6px; color: ${axis.color}">${axis.label}</div>
                <div style="color: ${textColor}; font-weight: 500;">Value: ${rawValue.toFixed(3)}</div>
                <div style="color: ${textColor}; opacity: 0.8;">Normalized: ${normalizedValue.toFixed(2)}/5</div>
              `);
          })
          .on('mousemove', function (event) {
            tooltip
              .style('left', (event.clientX + 15) + 'px')
              .style('top', (event.clientY - 15) + 'px');
          })
          .on('mouseout', function () {
            console.log('Mouse out from point', axis.label); // Debug
            d3.select(this)
              .transition()
              .duration(150)
              .attr('r', 5);
            tooltip.style('opacity', 0);
          });
      });
    }

    // Get reward data from CSV
    function getRewardData(rewardA, rewardB, frame) {
      if (!csvData) return null;

      // Convert folder names to CSV names
      const csvNameA = getCsvName(rewardA);
      const csvNameB = getCsvName(rewardB);

      // CSV convention: frame 0 = 100% reward_a, frame 31 = 100% reward_b
      // Slider convention: position 0 = 100% rewardA, position 31 = 100% rewardB

      // Try forward direction: user's rewardA = CSV's reward_a, user's rewardB = CSV's reward_b
      // No inversion needed: slider 0 (want A) → CSV frame 0 (has reward_a)
      let key = `${csvNameA}_${csvNameB}_${frame}`;
      if (csvData[key]) return csvData[key];

      // Try reverse direction: user's rewardA = CSV's reward_b, user's rewardB = CSV's reward_a
      // Need to invert: slider 0 (want A) → CSV frame 31 (has reward_b)
      const invertedFrame = 31 - frame;
      key = `${csvNameB}_${csvNameA}_${invertedFrame}`;
      if (csvData[key]) return csvData[key];

      return null;
    }

    // Update image based on current selections
    function updateImage() {
      const prompt = promptSelect.value;
      const rewardA = rewardASelect.value;
      const rewardB = rewardBSelect.value;
      const sliderPosition = parseInt(slider.value, 10);

      // Get colors for the selected rewards
      const colorA = getColor(rewardA);
      const colorB = getColor(rewardB);

      // Update labels
      rewardALabel.textContent = getDisplayName(rewardA);
      rewardBLabel.textContent = getDisplayName(rewardB);

      // Update label colors
      rewardALabel.style.color = colorA;
      rewardBLabel.style.color = colorB;

      // Update dropdown label and custom dropdown color indicators
      // Note: dropdownGroups now includes the prompt dropdown (index 0), reward A (index 1), reward B (index 2)
      if (dropdownGroups.length >= 3) {
        const labelA = dropdownGroups[1].querySelector('label');
        const labelB = dropdownGroups[2].querySelector('label');
        const customDropA = dropdownGroups[1].querySelector('.custom-dropdown-selected');
        const customDropB = dropdownGroups[2].querySelector('.custom-dropdown-selected');

        if (labelA) {
          labelA.style.setProperty('--indicator-color', colorA);
        }
        if (labelB) {
          labelB.style.setProperty('--indicator-color', colorB);
        }
        if (customDropA) {
          customDropA.style.setProperty('--indicator-color', colorA);
        }
        if (customDropB) {
          customDropB.style.setProperty('--indicator-color', colorB);
        }
      }

      // Update slider gradient
      slider.style.background = `linear-gradient(to right, ${colorA} 0%, ${colorB} 100%)`;

      // Update slider thumb border color (use colorA as the primary)
      slider.style.setProperty('--thumb-color', colorA);

      // Update slider value display (0.0 to 1.0)
      const interpolation = (sliderPosition / 31).toFixed(3);
      sliderValue.textContent = interpolation;

      // Interpolate color for the value display and glow effect
      const t = sliderPosition / 31;
      const interpolatedColor = interpolateColor(colorA, colorB, t);
      sliderValue.style.color = interpolatedColor;

      // Update image glow with interpolated color
      // Convert hex to RGB for the radial gradient
      const rgb = hexToRgb(interpolatedColor);
      if (rgb) {
        imageGlow.style.background = `radial-gradient(circle, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.65) 0%, transparent 65%)`;
      }

      // Get correct folder and frame
      const { folder, frame } = getFolderAndFrame(rewardA, rewardB, sliderPosition);

      // Format frame number with leading zeros (frame_0000.jpg)
      const frameStr = String(frame).padStart(4, '0');
      const imagePath = `assets/images/pairwise_tradeoffs/${prompt}/${folder}/frame_${frameStr}.jpg`;

      // Show loading state
      imageContainer.classList.add('loading');

      // Create new image to preload
      const newImage = new Image();
      newImage.onload = () => {
        image.src = imagePath;
        imageContainer.classList.remove('loading');
      };
      newImage.onerror = () => {
        console.error('Failed to load image:', imagePath);
        imageContainer.classList.remove('loading');
      };
      newImage.src = imagePath;

      // Update radar plot (use original sliderPosition, not adjusted frame)
      const rewardData = getRewardData(rewardA, rewardB, sliderPosition);
      if (rewardData) {
        createRadarPlot(rewardData);
      }
    }

    // Event listeners
    promptSelect.addEventListener('change', () => {
      // Reload CSV data and update image when prompt changes
      const prompt = promptSelect.value;
      loadCSVData(prompt).then(() => {
        updateImage();
        // Restart autoplay when prompt changes
        const autoPlayButton = document.querySelector('.pairwise-autoplay-button');
        if (autoPlayButton) {
          if (!isAutoPlaying) {
            toggleAutoPlay(autoPlayButton);
          } else {
            // Reset to start if already playing
            slider.value = 0;
            autoPlayDirection = 1;
          }
        }
      });
    });
    rewardASelect.addEventListener('change', () => {
      updateDisabledOptions();
      updateImage();
      // Restart autoplay when reward changes
      const autoPlayButton = document.querySelector('.pairwise-autoplay-button');
      if (autoPlayButton) {
        if (!isAutoPlaying) {
          toggleAutoPlay(autoPlayButton);
        } else {
          // Reset to start if already playing
          slider.value = 0;
          autoPlayDirection = 1;
        }
      }
    });
    rewardBSelect.addEventListener('change', () => {
      updateDisabledOptions();
      updateImage();
      // Restart autoplay when reward changes
      const autoPlayButton = document.querySelector('.pairwise-autoplay-button');
      if (autoPlayButton) {
        if (!isAutoPlaying) {
          toggleAutoPlay(autoPlayButton);
        } else {
          // Reset to start if already playing
          slider.value = 0;
          autoPlayDirection = 1;
        }
      }
    });
    slider.addEventListener('input', () => {
      // Stop autoplay if user manually adjusts slider
      if (isAutoPlaying) {
        const autoPlayButton = document.querySelector('.pairwise-autoplay-button');
        if (autoPlayButton) {
          autoPlayButton.innerHTML = '▶';
          autoPlayButton.classList.remove('playing');
        }
        isAutoPlaying = false;
        stopAutoPlay();
      }
      updateImage();
    });

    // Initialize: load CSV data then update display
    const initialPrompt = promptSelect.value || 'old_galleon';
    loadCSVData(initialPrompt).then(() => {
      updateImage();
      // Auto-start the animation
      const autoPlayButton = document.querySelector('.pairwise-autoplay-button');
      if (autoPlayButton && !isAutoPlaying) {
        toggleAutoPlay(autoPlayButton);
      }
    });
  }

  // Expose to global namespace
  window.MIRO = window.MIRO || {};
  window.MIRO.loadPairwiseTradeoff = loadPairwiseTradeoff;
})();
