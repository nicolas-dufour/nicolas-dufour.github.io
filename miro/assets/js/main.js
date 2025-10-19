(function () {
    'use strict';

    function init() {
        // Prevent Firefox from auto-restoring scroll position which can conflict with our first click
        if ('scrollRestoration' in history) {
            try { history.scrollRestoration = 'manual'; } catch (_) { }
        }

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

        // After DOM ready, if there is a hash, align to it using our smooth logic once
        if (location.hash && location.hash.length > 1) {
            const el = document.querySelector(location.hash);
            if (el && window.MIRO && typeof window.MIRO.smoothScrollTo === 'function') {
                // Delay slightly to let layout settle
                setTimeout(() => window.MIRO.smoothScrollTo(el, 0), 0);
            }
        }

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
        // Use a single delegated, capturing listener so we also catch anchors created dynamically
        document.addEventListener('click', (e) => {
            const a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
            if (!a) return;

            const hash = a.getAttribute('href') || '';

            // Handle placeholder links ("#"): prevent unexpected jumps to top
            if (hash === '#') {
                e.preventDefault();
                const text = (a.textContent || '').trim();
                const isBackToTop = /back to top/i.test(text) || a.classList.contains('back-to-top');
                if (isBackToTop && typeof window.scrollTo === 'function') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
                return;
            }

            // Only handle in-page anchors with an id target
            if (hash.length > 1) {
                // Skip TOC links which have their own custom smooth scroll handlers
                if (a.closest('#tocList, #mobileTocList, .sidebar-toc')) return;

                const target = document.querySelector(hash);
                if (!target) return;

                e.preventDefault();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

                if (window.MIRO && typeof window.MIRO.smoothScrollTo === 'function') {
                    window.MIRO.smoothScrollTo(target, 800);
                } else if (typeof target.scrollIntoView === 'function') {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                if (typeof history.replaceState === 'function') {
                    history.replaceState(null, '', hash);
                }
            }
        }, { capture: true, passive: false });
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();

