(function () {
  'use strict';

  function buildTOC() {
    const toc = document.getElementById('tocList');
    if (!toc) return;
    const sections = Array.from(document.querySelectorAll('main > section'))
      .filter(s => s.id && s.querySelector('h2'));
    sections.forEach((s, idx) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${s.id}`;

      // Add section number and title
      const number = document.createElement('span');
      number.className = 'toc-number';
      number.textContent = `${idx + 1}.`;

      const title = document.createElement('span');
      title.className = 'toc-title';
      title.textContent = s.querySelector('h2').textContent;

      a.appendChild(number);
      a.appendChild(title);
      li.appendChild(a);
      toc.appendChild(li);

      // Add click animation
      a.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);

        if (targetSection) {
          // Add pulse animation to the clicked TOC item
          this.style.transition = 'transform 0.3s ease';
          this.style.transform = 'scale(1.05)';

          setTimeout(() => {
            this.style.transform = 'scale(1)';
          }, 300);

          // Custom smooth scroll with easing
          smoothScrollTo(targetSection, 800);
        }
      });
    });

    // Build sidebar TOC and mobile TOC after main TOC is built
    buildSidebarTOC(sections);
    buildMobileTOC(sections);
  }

  function buildMobileTOC(sections) {
    const mobileToc = document.getElementById('mobileTocList');
    if (!mobileToc) return;

    // Clear existing items
    mobileToc.innerHTML = '';

    sections.forEach((s, idx) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${s.id}`;

      // Add section number and title
      const number = document.createElement('span');
      number.className = 'toc-number';
      number.textContent = `${idx + 1}`;
      a.appendChild(number);

      const title = document.createElement('span');
      title.className = 'toc-title';
      const h2 = s.querySelector('h2');
      title.textContent = h2 ? h2.textContent : '';
      a.appendChild(title);

      // Add click handler with smooth scroll animation
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = e.currentTarget.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);

        if (targetSection) {
          // Custom smooth scroll with easing
          smoothScrollTo(targetSection, 800);
        }

        // Close dropdown after initiating scroll
        const dropdown = document.getElementById('tocDropdown');
        if (dropdown) {
          dropdown.classList.remove('open');
        }
      });

      li.appendChild(a);
      mobileToc.appendChild(li);
    });
  }

  function setupMobileNav() {
    const tocDropdownBtn = document.getElementById('tocDropdownBtn');
    const tocDropdown = document.getElementById('tocDropdown');

    if (tocDropdownBtn && tocDropdown) {
      tocDropdownBtn.addEventListener('click', () => {
        tocDropdown.classList.toggle('open');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!tocDropdownBtn.contains(e.target) && !tocDropdown.contains(e.target)) {
          tocDropdown.classList.remove('open');
        }
      });

      // Close dropdown on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && tocDropdown.classList.contains('open')) {
          tocDropdown.classList.remove('open');
        }
      });
    }
  }

  function buildSidebarTOC(sections) {
    // Create sidebar TOC container
    const sidebarTOC = document.createElement('nav');
    sidebarTOC.className = 'sidebar-toc';
    sidebarTOC.setAttribute('aria-label', 'Sticky table of contents');

    const heading = document.createElement('h3');
    heading.textContent = 'Contents';
    sidebarTOC.appendChild(heading);

    const ul = document.createElement('ul');

    sections.forEach((s, idx) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${s.id}`;
      a.setAttribute('data-section-id', s.id);

      const number = document.createElement('span');
      number.className = 'toc-number';
      number.textContent = `${idx + 1}.`;

      const title = document.createElement('span');
      title.className = 'toc-title';
      title.textContent = s.querySelector('h2').textContent;

      a.appendChild(number);
      a.appendChild(title);
      li.appendChild(a);
      ul.appendChild(li);

      // Add click handler with animation
      a.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);

        if (targetSection) {
          // Custom smooth scroll with easing
          smoothScrollTo(targetSection, 800);
        }
      });
    });

    sidebarTOC.appendChild(ul);
    document.body.appendChild(sidebarTOC);

    // Set up scroll listener to show/hide and update active state
    setupSidebarTOCScroll(sidebarTOC, sections);
  }

  function setupSidebarTOCScroll(sidebarTOC, sections) {
    const mainTOCSection = document.getElementById('contents');
    if (!mainTOCSection) return;

    let ticking = false;
    let isVisible = false;
    let currentActiveId = null;

    // Cache section positions on load and resize (debounced)
    let sectionPositions = [];
    let mainTOCBottom = 0;

    function cacheSectionPositions() {
      mainTOCBottom = mainTOCSection.offsetTop + mainTOCSection.offsetHeight;
      sectionPositions = sections.map(section => ({
        id: section.id,
        top: section.offsetTop
      }));
    }

    // Debounced resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(cacheSectionPositions, 150);
    });

    // Initial cache
    cacheSectionPositions();

    // Track last scroll position to avoid sub-pixel updates
    let lastScrollY = -1;

    function updateSidebarTOC() {
      // Batch all reads first to avoid layout thrashing
      const scrollY = Math.round(window.scrollY);

      // Only update if scroll changed by at least 1 pixel
      if (Math.abs(scrollY - lastScrollY) < 1) {
        ticking = false;
        return;
      }

      lastScrollY = scrollY;
      const scrollPosition = scrollY + 150; // Offset for header
      const shouldShow = scrollY > mainTOCBottom;

      // Batch all writes after reads
      if (shouldShow !== isVisible) {
        isVisible = shouldShow;
        if (shouldShow) {
          sidebarTOC.classList.add('visible');
        } else {
          sidebarTOC.classList.remove('visible');
        }
      }

      // Find active section using cached positions
      let activeId = null;
      for (let i = sectionPositions.length - 1; i >= 0; i--) {
        if (sectionPositions[i].top <= scrollPosition) {
          activeId = sectionPositions[i].id;
          break;
        }
      }

      // Only update if active section changed
      if (activeId !== currentActiveId) {
        currentActiveId = activeId;
        const links = sidebarTOC.querySelectorAll('a');
        links.forEach(link => {
          const sectionId = link.getAttribute('data-section-id');
          if (activeId && sectionId === activeId) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }

      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateSidebarTOC);
        ticking = true;
      }
    }, { passive: true });

    // Initial update
    updateSidebarTOC();
  }

  // Expose to global namespace
  window.MIRO = window.MIRO || {};
  window.MIRO.buildTOC = buildTOC;
  window.MIRO.setupMobileNav = setupMobileNav;
})();
