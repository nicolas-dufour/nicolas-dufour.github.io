(function () {
  'use strict';

  const D = window.MIRO_DATA;

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
        baselineImgs[idx].src = `assets/images/training_progression/${promptId}/${sub[0]}/img_${promptId.padStart(6, '0')}_${s}.jpg`;
        miroImgs[idx].src = `assets/images/training_progression/${promptId}/${sub[1]}/img_${promptId.padStart(6, '0')}_${s}.jpg`;
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

    // Pause auto-play when not visible to prevent jittering
    const progressionSection = document.querySelector('.progression-layout');
    if (progressionSection) {
      const progObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting && isPlaying) {
            stopAutoPlay();
          } else if (entry.isIntersecting && !isPlaying) {
            startAutoPlay();
          }
        });
      }, {
        rootMargin: '100px',
        threshold: 0
      });
      progObserver.observe(progressionSection);
    }

    // Start auto-play
    setStep(0);
    startAutoPlay();
  }

  // Expose to global namespace
  window.MIRO = window.MIRO || {};
  window.MIRO.loadProgression = loadProgression;
})();
