(function () {
  'use strict';

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

  // Create custom dropdown for radar model selector
  function createCustomDropdown(selectElement, options) {
    if (!selectElement) return null;

    const parent = selectElement.parentElement;
    if (!parent) return null;

    // Create custom dropdown container
    const customDropdown = document.createElement('div');
    customDropdown.className = 'custom-dropdown';

    // Create selected display
    const selectedDisplay = document.createElement('div');
    selectedDisplay.className = 'custom-dropdown-selected';

    // Create options container
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-dropdown-options';

    // Populate options
    options.forEach(option => {
      const optionElement = document.createElement('div');
      optionElement.className = 'custom-dropdown-option';
      optionElement.textContent = option.display;
      optionElement.setAttribute('data-value', option.value);
      optionElement.style.setProperty('--option-color', option.color);

      optionElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectOption(option.value, option.display, option.color);
        closeDropdown();
      });

      optionsContainer.appendChild(optionElement);
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

    return { selectOption, customDropdown };
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
        if (window.MIRO.plotTraining) window.MIRO.plotTraining();
        if (window.MIRO.plotTTS) window.MIRO.plotTTS();
        if (window.MIRO.plotRadars) window.MIRO.plotRadars();
        if (window.MIRO.plotSynthetic) window.MIRO.plotSynthetic();
        if (window.MIRO.plotSOTAComparison) window.MIRO.plotSOTAComparison();
        if (window.MIRO.plotWeights) window.MIRO.plotWeights();

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

    // Setup custom dropdown for radar model selector
    const modelSel = document.getElementById('radarModel');
    if (modelSel) {
      // Define model options with colors (matching radar-plots.js colors)
      const modelOptions = [
        { value: 'Baseline', display: 'Baseline', color: '#bc8f8f' },
        { value: 'ImageReward', display: 'ImageReward', color: '#ff6978' },
        { value: 'HPSv2', display: 'HPSv2', color: '#6496ff' },
        { value: 'Aesthetic', display: 'Aesthetic', color: '#69c869' },
        { value: 'SciScore', display: 'SciScore', color: '#c769e6' },
        { value: 'CLIP', display: 'CLIP', color: '#4fd2c8' },
        { value: 'VQA', display: 'VQA', color: '#e1d34f' },
        { value: 'Pick', display: 'Pick', color: '#ff96c8' }
      ];

      // Create custom dropdown
      const customDropdown = createCustomDropdown(modelSel, modelOptions);

      // Set initial selection (Baseline is default)
      if (customDropdown) {
        const defaultOption = modelOptions.find(opt => opt.value === 'Baseline');
        if (defaultOption) {
          customDropdown.selectOption(defaultOption.value, defaultOption.display, defaultOption.color);
        }
      }

      // Refresh radar plots when model changes
      function refresh() {
        if (window.MIRO.plotRadarSpecialists) window.MIRO.plotRadarSpecialists();
        if (window.MIRO.plotRadarGeneval) window.MIRO.plotRadarGeneval();

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
      modelSel.addEventListener('change', refresh);
    }

    const w = document.getElementById('weightCursor');
    const wl = document.getElementById('weightCursorLabel');
    if (w) {
      const xs = window.MIRO_DATA.weightSweeps.x;
      function on() { const idx = parseInt(w.value, 10); wl.textContent = 'aesthetic weight = ' + xs[idx].toFixed(3); }
      w.addEventListener('input', on); on();
    }
  }

  // Expose to global namespace
  window.MIRO = window.MIRO || {};
  window.MIRO.loadTheme = loadTheme;
  window.MIRO.enhanceInteractivity = enhanceInteractivity;
})();
