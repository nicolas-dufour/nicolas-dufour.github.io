(function () {
  'use strict';

  function setupScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    if (!bar) return;

    let ticking = false;

    function update() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const progress = scrollable > 0 ? doc.scrollTop / scrollable : 0;
      bar.style.transform = 'scaleX(' + Math.min(Math.max(progress, 0), 1) + ')';
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  window.MIRO = window.MIRO || {};
  window.MIRO.setupScrollProgress = setupScrollProgress;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupScrollProgress);
  } else {
    setupScrollProgress();
  }
})();
