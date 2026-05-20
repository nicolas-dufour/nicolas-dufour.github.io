(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setupSliderHints() {
    if (reduceMotion) return;

    const sliders = document.querySelectorAll('#stepSlider, #weightCursor, #pairwiseSlider');
    if (!sliders.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const slider = entry.target;
        slider.classList.add('miro-pulse-hint');
        setTimeout(() => slider.classList.remove('miro-pulse-hint'), 2000);
        observer.unobserve(slider);
      });
    }, { threshold: 0.6 });

    sliders.forEach((s) => observer.observe(s));
  }

  window.MIRO = window.MIRO || {};
  window.MIRO.setupSliderHints = setupSliderHints;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSliderHints);
  } else {
    setupSliderHints();
  }
})();
