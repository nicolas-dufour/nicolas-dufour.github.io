(function () {
  'use strict';

  const D = window.MIRO_DATA;

  function loadIPR() {
    const track = document.querySelector('.ipr-carousel-track');
    const prevBtn = document.querySelector('.ipr-carousel-btn.prev');
    const nextBtn = document.querySelector('.ipr-carousel-btn.next');
    const currentSpan = document.querySelector('.ipr-carousel-indicator .current');

    if (!track || !prevBtn || !nextBtn || !currentSpan) return;

    const base = 'assets/images/images_per_reward';
    const names = ['Aesthetic', 'CLIP', 'HPSv2', 'ImageReward', 'Pick', 'SciScore', 'VQA', 'MIRO (All)'];
    const colors = {
      'Aesthetic': '#69c869',
      'CLIP': '#4fd2c8',
      'HPSv2': '#6496ff',
      'ImageReward': '#ff6978',
      'Pick': '#ff96c8',
      'SciScore': '#c769e6',
      'VQA': '#e1d34f',
      'MIRO (All)': '#ff9a50'
    };
    const prompts = {
      'rocket_wall': '"A rocket painted on a brick wall"',
      'robots_meditating': '"Robots meditating on top of a skyscraper"'
    };
    const dirs = ['rocket_wall', 'robots_meditating'];

    // Create slides
    dirs.forEach((dir) => {
      const slide = document.createElement('div');
      slide.className = 'ipr-slide';

      // Add prompt label
      const promptLabel = document.createElement('div');
      promptLabel.className = 'ipr-prompt';
      promptLabel.textContent = prompts[dir];
      slide.appendChild(promptLabel);

      // Add image row
      const row = document.createElement('div');
      row.className = 'ipr-row';
      names.forEach((n, i) => {
        const file = D.images.imagesPerReward[dir][i];
        const item = document.createElement('figure');
        item.className = 'ipr-item';
        const img = document.createElement('img');
        img.alt = dir + ' - ' + names[i];
        img.src = base + '/' + dir + '/' + file;
        const caption = document.createElement('figcaption');
        caption.textContent = names[i];
        caption.style.backgroundColor = colors[n] || '#888';
        caption.style.color = '#fff';
        item.appendChild(img);
        item.appendChild(caption);
        row.appendChild(item);
      });
      slide.appendChild(row);
      track.appendChild(slide);
    });

    // Carousel state
    let currentIndex = 0;
    let autoSlideInterval;
    const totalSlides = dirs.length;

    // Update position
    function updatePosition(smooth = true) {
      const offset = currentIndex * 100;

      if (smooth) {
        track.style.transition = 'transform 0.5s ease-in-out';
      } else {
        track.style.transition = 'none';
      }

      track.style.transform = `translateX(-${offset}%)`;
      currentSpan.textContent = currentIndex + 1;
    }

    // Next slide
    function nextSlide() {
      currentIndex = (currentIndex + 1) % totalSlides;
      updatePosition();
    }

    // Previous slide
    function prevSlide() {
      currentIndex = (currentIndex - 1 + totalSlides) % totalSlides;
      updatePosition();
    }

    // Auto-slide
    function startAutoSlide() {
      if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
      }
      autoSlideInterval = setInterval(nextSlide, 4000);
    }

    function stopAutoSlide() {
      if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
        autoSlideInterval = null;
      }
    }

    function resetAutoSlide() {
      stopAutoSlide();
      startAutoSlide();
    }

    // Event listeners
    nextBtn.addEventListener('click', () => {
      nextSlide();
      resetAutoSlide();
    });

    prevBtn.addEventListener('click', () => {
      prevSlide();
      resetAutoSlide();
    });

    // Pause on hover
    const container = document.querySelector('.ipr-carousel-container');
    container.addEventListener('mouseenter', stopAutoSlide);
    container.addEventListener('mouseleave', startAutoSlide);

    // Touch support
    let touchStartX = 0;
    let touchEndX = 0;

    track.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      stopAutoSlide();
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
      startAutoSlide();
    }, { passive: true });

    // Initialize
    updatePosition(false);
    startAutoSlide();
  }

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

    // Start auto-play
    setStep(0);
    startAutoPlay();
  }

  function loadQual() {
    const track = document.querySelector('.qual-carousel-track');
    const dotsContainer = document.querySelector('.carousel-dots');
    const prevBtn = document.querySelector('.carousel-arrow.prev');
    const nextBtn = document.querySelector('.carousel-arrow.next');

    if (!track || !dotsContainer || !prevBtn || !nextBtn) return;

    // Organize images into columns (2 rows per column)
    const totalImages = D.images.qualitativeCount;
    const imagesPerColumn = 2;
    const totalColumns = Math.ceil(totalImages / imagesPerColumn);

    // Create columns with images
    const columns = [];
    for (let col = 0; col < totalColumns; col++) {
      const column = document.createElement('div');
      column.className = 'qual-carousel-column';

      for (let row = 0; row < imagesPerColumn; row++) {
        const imgIndex = col * imagesPerColumn + row;
        if (imgIndex < totalImages) {
          const img = document.createElement('img');
          img.src = `assets/images/qualitative_images/image_${imgIndex}.jpg`;
          img.alt = `qualitative ${imgIndex}`;
          column.appendChild(img);
        }
      }

      columns.push(column);
    }

    // Prepend clones for seamless left scrolling
    columns.forEach(col => {
      const clone = col.cloneNode(true);
      track.appendChild(clone);
    });

    // Append original columns
    columns.forEach(col => {
      track.appendChild(col);
    });

    // Append more clones for seamless right scrolling
    columns.forEach(col => {
      const clone = col.cloneNode(true);
      track.appendChild(clone);
    });

    // Carousel state - start at the middle set (original columns)
    let currentIndex = totalColumns;
    let autoSlideInterval;
    let isTransitioning = false;

    // Get columns per view based on screen size
    function getColumnsPerView() {
      const width = window.innerWidth;
      if (width <= 500) return 1;
      if (width <= 700) return 2;
      return 4;
    }

    // Create dots
    function createDots() {
      dotsContainer.innerHTML = '';
      const columnsPerView = getColumnsPerView();
      const numDots = totalColumns;

      for (let i = 0; i < numDots; i++) {
        const dot = document.createElement('button');
        dot.className = 'carousel-dot';
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
        if (i === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(i));
        dotsContainer.appendChild(dot);
      }
    }

    // Update position and column sizes
    function updatePosition(smooth = true) {
      const container = document.querySelector('.qual-carousel-container');
      const containerWidth = container.offsetWidth;
      const columnsPerView = getColumnsPerView();

      // Calculate the actual column width by reading real paddings
      const cs = getComputedStyle(container);
      const pl = parseFloat(cs.paddingLeft) || 0;
      const pr = parseFloat(cs.paddingRight) || 0;
      const availableWidth = containerWidth - (pl + pr);

      // Column width should fit exactly columnsPerView in the available space
      const columnWidth = availableWidth / columnsPerView;

      // Set all column widths dynamically
      const allColumns = track.querySelectorAll('.qual-carousel-column');
      allColumns.forEach(col => {
        col.style.width = `${columnWidth}px`;
      });

      // Move by full columns - no offset needed since container padding handles the preview
      const offsetPx = currentIndex * columnWidth;

      if (smooth) {
        track.style.transition = 'transform 0.5s ease-in-out';
      } else {
        track.style.transition = 'none';
      }

      track.style.transform = `translateX(-${offsetPx}px)`;

      // Update dots (based on position within original columns)
      const dots = dotsContainer.querySelectorAll('.carousel-dot');
      dots.forEach((dot, i) => {
        const normalizedIndex = ((currentIndex - totalColumns) % totalColumns + totalColumns) % totalColumns;
        dot.classList.toggle('active', i === normalizedIndex);
      });
    }

    // Go to specific slide
    function goToSlide(index) {
      if (isTransitioning) return;
      // Map to the middle section (original columns)
      const targetIndex = totalColumns + Math.max(0, Math.min(index, totalColumns - 1));
      currentIndex = targetIndex;
      updatePosition();
      resetAutoSlide();
    }

    // Next slide
    function nextSlide() {
      if (isTransitioning) return;
      isTransitioning = true;

      currentIndex++;
      updatePosition();

      setTimeout(() => {
        // If we've scrolled past the middle section, reset to start of middle
        if (currentIndex >= totalColumns * 2) {
          currentIndex = totalColumns;
          updatePosition(false);
        }
        isTransitioning = false;
      }, 550);
    }

    // Previous slide
    function prevSlide() {
      if (isTransitioning) return;
      isTransitioning = true;

      currentIndex--;
      updatePosition();

      setTimeout(() => {
        // If we've scrolled before the middle section, reset to end of middle
        if (currentIndex < totalColumns) {
          currentIndex = totalColumns * 2 - 1;
          updatePosition(false);
        }
        isTransitioning = false;
      }, 550);
    }

    // Auto-slide
    function startAutoSlide() {
      // Clear any existing interval first
      if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
      }
      autoSlideInterval = setInterval(() => {
        nextSlide();
      }, 3500);
    }

    function stopAutoSlide() {
      if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
        autoSlideInterval = null;
      }
    }

    function resetAutoSlide() {
      stopAutoSlide();
      startAutoSlide();
    }

    // Event listeners
    nextBtn.addEventListener('click', () => {
      nextSlide();
      resetAutoSlide();
    });

    prevBtn.addEventListener('click', () => {
      prevSlide();
      resetAutoSlide();
    });

    // Pause on hover
    const container = document.querySelector('.qual-carousel-container');
    container.addEventListener('mouseenter', stopAutoSlide);
    container.addEventListener('mouseleave', startAutoSlide);

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        createDots();
        updatePosition(false);
      }, 250);
    });

    // Touch support for mobile
    let touchStartX = 0;
    let touchEndX = 0;

    track.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      stopAutoSlide();
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
      startAutoSlide();
    }, { passive: true });

    function handleSwipe() {
      const swipeThreshold = 50;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
    }

    // Initialize
    createDots();
    updatePosition(false);

    // Start auto-slide
    startAutoSlide();
  }

  // Expose to global namespace
  window.MIRO = window.MIRO || {};
  window.MIRO.loadIPR = loadIPR;
  window.MIRO.loadQual = loadQual;
})();
