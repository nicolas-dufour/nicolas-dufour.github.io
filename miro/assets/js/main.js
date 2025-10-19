(function () {
    'use strict';

    function init() {
        // Load theme first
        if (window.MIRO.loadTheme) {
            window.MIRO.loadTheme();
        }

        // Build table of contents
        if (window.MIRO.buildTOC) {
            window.MIRO.buildTOC();
        }

        // Setup mobile navigation
        if (window.MIRO.setupMobileNav) {
            window.MIRO.setupMobileNav();
        }

        // Initialize all plots
        if (window.MIRO.plotTraining) {
            window.MIRO.plotTraining();
        }

        if (window.MIRO.plotTTS) {
            window.MIRO.plotTTS();
        }

        if (window.MIRO.plotRadars) {
            window.MIRO.plotRadars();
        }

        if (window.MIRO.plotWeights) {
            window.MIRO.plotWeights();
        }

        if (window.MIRO.plotSynthetic) {
            window.MIRO.plotSynthetic();
        }

        if (window.MIRO.plotSOTAComparison) {
            window.MIRO.plotSOTAComparison();
        }

        // Load image viewers
        if (window.MIRO.loadIPR) {
            window.MIRO.loadIPR();
        }

        if (window.MIRO.loadProgression) {
            window.MIRO.loadProgression();
        }

        if (window.MIRO.loadQual) {
            window.MIRO.loadQual();
        }

        if (window.MIRO.loadPairwiseTradeoff) {
            window.MIRO.loadPairwiseTradeoff();
        }

        // Enable smooth scrolling (kept local for simplicity)
        enableSmoothScroll();

        // Enhance interactivity (theme toggle, etc.)
        if (window.MIRO.enhanceInteractivity) {
            window.MIRO.enhanceInteractivity();
        }

        // Compute metrics
        if (window.MIRO.computeMetrics) {
            window.MIRO.computeMetrics();
        }

        // Setup training animation triggers
        if (window.MIRO.setupTrainingAnimation) {
            window.MIRO.setupTrainingAnimation();
        }

        // Setup copy bibtex functionality
        if (window.MIRO.setupCopyBibtex) {
            window.MIRO.setupCopyBibtex();
        }
    }

    function enableSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(a => {
            a.addEventListener('click', e => {
                const hash = a.getAttribute('href');
                if (hash.length > 1) {
                    e.preventDefault();
                    const el = document.querySelector(hash);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    history.pushState(null, '', hash);
                }
            });
        });
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();

