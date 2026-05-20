(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Selectors that get a single reveal (no stagger).
  // NOTE: do NOT add .kpis-hero / .kpis-secondary — their .kpi children have their own CSS animation.
  const SOLO = [
    '.section > h2',
    '.section > .lead',
    '.section > .explainer',
    '.method-overview',
    '.method-anim',
    '.qual-carousel-container',
    '.ipr-carousel-container',
    '.bibtex-container',
    '#references .references',
  ];

  // Children of these containers each get a staggered reveal.
  const STAGGERED = [
    { parent: '.benefits-grid',          child: '.benefit-card',        step: 80,  base: 0 },
    { parent: '.method-components',      child: '.method-component',    step: 110, base: 0 },
    { parent: '.contributions-list',     child: 'li',                   step: 90,  base: 0 },
    { parent: '.achievement-grid',       child: '.achievement-card',    step: 90,  base: 0 },
    { parent: '.takeaway-grid',          child: '.takeaway-item',       step: 90,  base: 0 },
    { parent: '#contents > ul',          child: 'li',                   step: 35,  base: 0 },
  ];

  // Direct-children selectors (each top-level child of selector gets staggered).
  const DIRECT_STAGGERED = [
    { selector: '.intro-subsection',     step: 0,   base: 0,   variant: 'miro-reveal-soft' },
    { selector: '.callout',              step: 0,   base: 80,  variant: '' },
    { selector: '.equation-inline',      step: 0,   base: 0,   variant: '' },
    { selector: '.equations',            step: 0,   base: 0,   variant: '' },
  ];

  function addReveal(el, variant, delayMs) {
    if (!el || el.classList.contains('miro-reveal')) return;
    el.classList.add('miro-reveal');
    if (variant) el.classList.add(variant);
    if (delayMs) el.style.transitionDelay = delayMs + 'ms';
  }

  function setupReveal() {
    if (reduceMotion) return;

    const targets = [];

    SOLO.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        addReveal(el, '', 0);
        targets.push(el);
      });
    });

    STAGGERED.forEach(({ parent, child, step, base }) => {
      document.querySelectorAll(parent).forEach((scope) => {
        const kids = scope.querySelectorAll(`:scope > ${child}`);
        kids.forEach((el, i) => {
          addReveal(el, '', base + i * step);
          targets.push(el);
        });
      });
    });

    DIRECT_STAGGERED.forEach(({ selector, step, base, variant }) => {
      document.querySelectorAll(selector).forEach((el, i) => {
        addReveal(el, variant, base + i * step);
        targets.push(el);
      });
    });

    if (!targets.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    targets.forEach((el) => observer.observe(el));
  }

  window.MIRO = window.MIRO || {};
  window.MIRO.setupReveal = setupReveal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupReveal);
  } else {
    setupReveal();
  }
})();
