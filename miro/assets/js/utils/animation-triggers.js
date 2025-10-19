(function () {
  'use strict';

  function setupTrainingAnimation() {
    // Create an Intersection Observer to trigger animation on scroll
    // Observe individual plot containers instead of entire sections for better mobile trigger

    // Track which elements have been animated to prevent constant re-animation
    const animatedElements = new Set();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        // Only trigger animation once when element enters viewport
        if (entry.isIntersecting && !animatedElements.has(entry.target)) {
          // Mark as animated to prevent re-triggering
          animatedElements.add(entry.target);
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
        }
        // Don't reset animations when leaving viewport to prevent continuous DOM mutations
      });
    }, {
      threshold: 0.2, // Trigger when 20% of element is visible
      rootMargin: '0px' // No extra margin needed
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

  // Expose to global namespace
  window.MIRO = window.MIRO || {};
  window.MIRO.setupTrainingAnimation = setupTrainingAnimation;
})();
