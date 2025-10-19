(function () {
  'use strict';

  // Create scroll progress indicator
  function createScrollProgressIndicator() {
    let indicator = document.querySelector('.scroll-progress');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'scroll-progress';
      document.body.appendChild(indicator);
    }
    return indicator;
  }

  // Custom smooth scroll with easing
  function smoothScrollTo(targetElement, duration = 1000) {
    const startPosition = window.pageYOffset;
    // Calculate offset based on whether mobile navbar is visible
    const mobileNavbar = document.querySelector('.mobile-navbar');
    const offset = mobileNavbar && window.getComputedStyle(mobileNavbar).display !== 'none' ? 60 : 80;
    const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - offset;
    const distance = targetPosition - startPosition;
    let startTime = null;

    // Get or create progress indicator
    const progressIndicator = createScrollProgressIndicator();
    progressIndicator.classList.add('active');

    // Easing function for smooth acceleration/deceleration
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function animation(currentTime) {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      const ease = easeInOutCubic(progress);

      // Update scroll position
      window.scrollTo(0, startPosition + distance * ease);

      // Update progress indicator
      progressIndicator.style.transform = `scaleX(${progress})`;

      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      } else {
        // Hide progress indicator
        setTimeout(() => {
          progressIndicator.classList.remove('active');
          progressIndicator.style.transform = 'scaleX(0)';
        }, 200);

        // Trigger highlight animation after scroll completes
        targetElement.classList.add('toc-highlight');
        setTimeout(() => {
          targetElement.classList.remove('toc-highlight');
        }, 1500);
      }
    }

    requestAnimationFrame(animation);
  }

  // Expose to global namespace
  window.MIRO = window.MIRO || {};
  window.MIRO.createScrollProgressIndicator = createScrollProgressIndicator;
  window.MIRO.smoothScrollTo = smoothScrollTo;
})();
