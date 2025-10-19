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

  // Expose to global namespace
  window.MIRO = window.MIRO || {};
  window.MIRO.loadTheme = loadTheme;
  window.MIRO.enhanceInteractivity = enhanceInteractivity;
})();
