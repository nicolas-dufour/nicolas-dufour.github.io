(function () {
  'use strict';

  const DURATION_MS = 1400;
  const START_DELAY_MS = 200;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function parseNumber(text) {
    const match = text.trim().match(/^([0-9]+(?:\.[0-9]+)?)(.*)$/);
    if (!match) return null;
    const value = parseFloat(match[1]);
    const suffix = match[2] || '';
    const decimals = (match[1].split('.')[1] || '').length;
    return { value, suffix, decimals };
  }

  function easeOutExpo(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function format(value, decimals) {
    return decimals === 0 ? String(Math.round(value)) : value.toFixed(decimals);
  }

  function animateNumber(el, target) {
    const card = el.closest('.kpi');
    const start = performance.now() + START_DELAY_MS;

    function step(now) {
      const elapsed = now - start;
      if (elapsed < 0) {
        requestAnimationFrame(step);
        return;
      }
      const progress = Math.min(elapsed / DURATION_MS, 1);
      const eased = easeOutExpo(progress);
      const current = target.value * eased;
      el.textContent = format(current, target.decimals) + target.suffix;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = format(target.value, target.decimals) + target.suffix;
        if (card) {
          card.classList.add('kpi-counted');
          setTimeout(() => card.classList.remove('kpi-counted'), 900);
        }
      }
    }

    requestAnimationFrame(step);
  }

  function setupKpiCountup() {
    const nodes = document.querySelectorAll('.kpi-num, .achievement-metric');
    if (!nodes.length) return;

    const targets = new Map();
    nodes.forEach((el) => {
      const parsed = parseNumber(el.textContent);
      if (!parsed) return;
      targets.set(el, parsed);
      if (!reduceMotion) {
        el.textContent = format(0, parsed.decimals) + parsed.suffix;
      }
    });

    if (reduceMotion) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = targets.get(el);
        if (target) animateNumber(el, target);
        observer.unobserve(el);
      });
    }, { threshold: 0.5 });

    targets.forEach((_, el) => observer.observe(el));
  }

  window.MIRO = window.MIRO || {};
  window.MIRO.setupKpiCountup = setupKpiCountup;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupKpiCountup);
  } else {
    setupKpiCountup();
  }
})();
