const deck = new Reveal({
  width: 1920,
  height: 1080,
  margin: 0.035,
  controls: true,
  controlsTutorial: false,
  controlsLayout: 'edges',
  progress: true,
  slideNumber: 'c/t',
  hash: true,
  history: false,
  center: false,
  transition: 'slide',
  transitionSpeed: 'default',
  backgroundTransition: 'fade',
  hideInactiveCursor: true,
  display: 'block',
  autoAnimateEasing: 'ease-out',
  autoAnimateDuration: 0.75,
  plugins: window.RevealNotes ? [RevealNotes] : [],
});

function renderMath() {
  if (!window.katex) {
    setTimeout(renderMath, 50);
    return;
  }
  document.querySelectorAll('.math[data-tex]').forEach((el) => {
    if (el.dataset.rendered) return;
    try {
      katex.render(el.dataset.tex, el, {
        throwOnError: false,
        displayMode: el.classList.contains('display'),
        trust: true,
      });
      el.dataset.rendered = '1';
    } catch (err) {
      el.textContent = el.dataset.tex;
    }
  });
}

deck.on('ready', (event) => {
  renderMath();
  window.DriftVisuals.init();
  window.DriftVisuals.enter(event.currentSlide);
});

deck.on('slidechanged', (event) => {
  window.DriftVisuals.enter(event.currentSlide);
});

deck.on('fragmentshown', () => window.DriftVisuals.fragment());
deck.on('fragmenthidden', () => window.DriftVisuals.fragment());

// R restarts a slide's live animation without changing fragments.
deck.addKeyBinding({ keyCode: 82, key: 'R', description: 'Restart current animation' }, () => {
  window.DriftVisuals.enter(deck.getCurrentSlide());
});

window.deck = deck;
deck.initialize();
