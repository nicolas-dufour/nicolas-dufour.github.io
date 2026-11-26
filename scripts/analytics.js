/*
 * Umami event layer, shared by every page of the site.
 *
 * The Umami tracker tag (loaded just before this file) records pageviews,
 * Core Web Vitals (data-performance) and uncaught JS errors (data-errors).
 * This file adds what the tracker cannot infer on its own:
 *
 *   Visitor profile  umami.identify() with an anonymous random id kept in
 *                    localStorage, so return visits link up in Sessions, plus
 *                    session properties (new/returning, visit count, first
 *                    source, theme, viewport, ...).
 *   Clicks           paper-click, paper-abstract-open, paper-bibtex-open,
 *                    paper-bibtex-copy, repo-click, contact-click, cv-click,
 *                    file-download, outbound-click, nav-click, anchor-click,
 *                    research-theme-paper, theme-toggle, nav-menu-open,
 *                    news-toggle, hero-gust, button-click, field-change.
 *   Reading          section-<id> (a section stayed on screen for 0.75 s),
 *                    paper-view (a publication card stayed on screen for
 *                    1.5 s), scroll-depth, text-copy, print, and engagement
 *                    (active reading time, sent when the tab is hidden).
 *   Replays          loads Umami's recorder.js after page load, which does
 *                    nothing until Replays / Heatmaps are switched on in the
 *                    Umami dashboard (Websites > Edit > Replays & Heatmaps).
 *
 * Everything is delegated from `document`, so templates need no extra markup.
 * Nothing runs when the tracker is blocked, or when this browser opted out
 * with localStorage.setItem('umami.disabled', 1).
 */
(() => {
    'use strict';

    const umami = window.umami;
    if (!umami || typeof umami.track !== 'function') return;
    try { if (localStorage.getItem('umami.disabled')) return; } catch (_) { /* storage blocked */ }

    const t0 = performance.now();
    const secondsIn = () => Math.round((performance.now() - t0) / 1000);
    const clip = (s, n) => (s == null ? undefined : String(s).replace(/\s+/g, ' ').trim().slice(0, n));

    function track(name, data) {
        const clean = {};
        if (data) {
            Object.keys(data).forEach((k) => {
                const v = data[k];
                if (v === undefined || v === null || v === '') return;
                clean[k] = typeof v === 'string' ? v.slice(0, 200) : v;
            });
        }
        try { umami.track(name.slice(0, 50), clean); } catch (_) { /* never break the page */ }
    }

    // Some events only make sense once per pageview (first menu open, ...).
    const sent = new Set();
    function trackOnce(key, name, data) {
        if (sent.has(key)) return;
        sent.add(key);
        track(name, data);
    }

    /* ------------------------------------------------------------------ */
    /* Visitor profile                                                     */
    /* ------------------------------------------------------------------ */

    const STORE = 'nd.visitor';
    const VISIT_GAP_MS = 30 * 60 * 1000; // same rule Umami uses for a visit

    function randomId() {
        if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    }

    function hostOf(url) {
        try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return undefined; }
    }

    // First-touch source: utm_source, else the external referrer's domain.
    function currentSource() {
        let utm = null;
        try { utm = new URLSearchParams(location.search).get('utm_source'); } catch (_) { /* old browser */ }
        if (utm) return clip(utm, 60);
        const ref = hostOf(document.referrer);
        if (ref && ref !== location.hostname.replace(/^www\./, '')) return ref;
        return 'direct';
    }

    function loadVisitor() {
        const now = Date.now();
        let v = null;
        let stored = true;
        try { v = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (_) { v = null; }
        if (!v || typeof v.id !== 'string' || typeof v.first !== 'number') {
            v = { id: randomId(), first: now, last: 0, visits: 0, source: currentSource(), landing: location.pathname };
        }
        if (now - (v.last || 0) > VISIT_GAP_MS) v.visits = (v.visits || 0) + 1;
        v.last = now;
        try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (_) { stored = false; }
        return { v, stored };
    }

    function touchVisitor(v) {
        v.last = Date.now();
        try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (_) { /* ignore */ }
    }

    function savedTheme() {
        try { return localStorage.getItem('theme'); } catch (_) { return null; }
    }

    const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
    const hasThemeToggle = !!document.getElementById('theme-toggle');
    const siteTheme = () => (document.body && document.body.classList.contains('dark-theme') ? 'dark' : 'light');

    const { v: visitor, stored } = loadVisitor();
    const conn = navigator.connection || {};
    let timezone;
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { timezone = undefined; }

    const profile = {
        visitor: visitor.visits > 1 ? 'returning' : 'new',
        visit_number: visitor.visits,
        days_since_first_visit: Math.floor((Date.now() - visitor.first) / 864e5),
        first_source: visitor.source,
        first_landing: visitor.landing,
        theme: hasThemeToggle ? siteTheme() : undefined,
        theme_source: hasThemeToggle ? (savedTheme() ? 'saved' : 'system') : undefined,
        prefers_dark: mq('(prefers-color-scheme: dark)'),
        reduced_motion: mq('(prefers-reduced-motion: reduce)'),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        timezone,
        connection: conn.effectiveType,
        save_data: typeof conn.saveData === 'boolean' ? conn.saveData : undefined,
    };
    Object.keys(profile).forEach((k) => profile[k] === undefined && delete profile[k]);
    try {
        // Without storage the id would change on every page, so send the
        // properties alone rather than a throwaway distinct id.
        if (stored) umami.identify(visitor.id, profile);
        else umami.identify(profile);
    } catch (_) { /* ignore */ }

    /* ------------------------------------------------------------------ */
    /* Page structure helpers                                              */
    /* ------------------------------------------------------------------ */

    const SECTION_SEL = '#intro, .section[id], section[id], header, nav, footer';

    function sectionOf(el) {
        const s = el && el.closest(SECTION_SEL);
        if (!s) return undefined;
        return s.id || s.tagName.toLowerCase();
    }

    function paperOf(el) {
        const card = el && el.closest('.publication');
        if (!card) return null;
        const titleEl = card.querySelector('.publication-title');
        const title = titleEl ? clip(titleEl.textContent, 150) : undefined;
        const id = card.id ? card.id.replace(/^pub-/, '') : clip((title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'), 40);
        return { card, paper: id, title };
    }

    const isDownload = (path) => /\.(pdf|zip|tar|gz|tgz|bib|pptx?|key|docx?|xlsx?|csv|mp4|mov|webm|ipynb|ckpt|pt|safetensors)$/i.test(path);

    /* ------------------------------------------------------------------ */
    /* Clicks                                                              */
    /* ------------------------------------------------------------------ */

    function paperTarget(link) {
        if (link.classList.contains('publication-thumbnail-link')) return 'thumbnail';
        if (link.classList.contains('publication-game-link')) return 'game';
        if (link.classList.contains('publication-workshop')) return 'workshop';
        const text = (link.textContent || '').trim().toLowerCase();
        if (text === 'paper') return 'paper';
        if (text === 'code') return 'code';
        if (text === 'website') return 'website';
        return clip(text, 40) || 'link';
    }

    function onLinkClick(link) {
        const href = link.getAttribute('href') || '';
        const section = sectionOf(link);

        // Publication cards: the main thing people come for.
        const pub = paperOf(link);
        if (pub && !href.startsWith('#')) {
            track('paper-click', {
                paper: pub.paper,
                title: pub.title,
                target: paperTarget(link),
                domain: hostOf(link.href),
            });
            return;
        }

        if (href.startsWith('mailto:')) {
            track('contact-click', { channel: 'email', section });
            return;
        }

        let url;
        try { url = new URL(link.href, location.href); } catch (_) { return; }
        const sameSite = url.hostname === location.hostname;

        if (/\/cv\.pdf$/i.test(url.pathname)) {
            track('cv-click', { section });
            return;
        }

        if (link.closest('.contact_wrapper')) {
            track('contact-click', { channel: clip(link.getAttribute('aria-label') || link.title || url.hostname, 40), section });
            return;
        }

        if (link.classList.contains('repo-card')) {
            const group = link.closest('.group');
            const label = group && group.previousElementSibling;
            track('repo-click', { repo: link.dataset.repo, group: label ? clip(label.textContent, 40) : undefined });
            return;
        }

        // In-page jumps.
        if (sameSite && url.pathname === location.pathname && url.hash) {
            const target = url.hash.slice(1);
            if (link.closest('.theme-papers')) {
                const theme = link.closest('.theme-card');
                const title = theme && theme.querySelector('.theme-title');
                track('research-theme-paper', {
                    paper: target.replace(/^pub-/, ''),
                    theme: title ? clip(title.textContent, 80) : undefined,
                });
            } else if (link.closest('nav')) {
                track('nav-click', { target, layout: window.innerWidth <= 600 ? 'mobile' : 'desktop' });
            } else if (!link.classList.contains('skip-link')) {
                track('anchor-click', { target, section });
            }
            return;
        }

        if (sameSite && isDownload(url.pathname)) {
            track('file-download', { file: clip(url.pathname, 150), section });
            return;
        }

        if (!sameSite && /^https?:$/.test(url.protocol)) {
            // Path only: query strings can carry tokens or personal data.
            track('outbound-click', {
                domain: hostOf(url.href),
                url: clip(url.origin + url.pathname, 200),
                text: clip(link.textContent || link.getAttribute('aria-label'), 80),
                section,
            });
        }
    }

    function onButtonClick(button) {
        if (button.id === 'theme-toggle') {
            // Capture phase: the page's own handler has not flipped the theme yet.
            track('theme-toggle', { to: siteTheme() === 'dark' ? 'light' : 'dark', section: sectionOf(button) });
            return;
        }
        if (button.classList.contains('dropdown-btn')) {
            if (button.getAttribute('aria-expanded') !== 'true') trackOnce('menu', 'nav-menu-open');
            return;
        }
        if (button.id === 'news-toggle') {
            track('news-toggle', { action: button.getAttribute('aria-expanded') === 'true' ? 'collapse' : 'expand' });
            return;
        }
        if (button.classList.contains('bibtex-copy-btn')) {
            const pub = paperOf(button);
            if (pub) track('paper-bibtex-copy', { paper: pub.paper, title: pub.title });
            return;
        }
        // Anything else (project pages, the planner, the games): once per
        // label per pageview, so a button mashed 50 times stays one event.
        const label = clip(button.getAttribute('aria-label') || button.textContent || button.id || button.title, 60);
        if (label) trackOnce('btn:' + label, 'button-click', { label, section: sectionOf(button) });
    }

    function onToggleClick(toggle) {
        const pub = paperOf(toggle);
        if (!pub) return;
        const isAbstract = toggle.classList.contains('publication-abstract-toggle');
        const panel = pub.card.querySelector(isAbstract ? '.publication-abstract' : '.publication-bibtex');
        // Count opens only; the page's handler runs after this one.
        if (!panel || panel.style.display !== 'none') return;
        track(isAbstract ? 'paper-abstract-open' : 'paper-bibtex-open', { paper: pub.paper, title: pub.title });
    }

    function onClick(e) {
        if (e.type === 'auxclick' && e.button !== 1) return; // middle click opens a tab
        const el = e.target instanceof Element ? e.target : null;
        if (!el) return;
        // Elements tagged by hand are tracked by the Umami tracker itself.
        if (el.closest('[data-umami-event]')) return;

        const toggle = el.closest('.publication-abstract-toggle, .publication-bibtex-toggle');
        if (toggle) return onToggleClick(toggle);

        const link = el.closest('a[href]');
        if (link) return onLinkClick(link);

        if (e.type !== 'click') return;
        const button = el.closest('button, [role="button"]');
        if (button) return onButtonClick(button);
    }

    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onClick, true);

    // Drawing a gust of wind on the hero sky (scripts/intro-planes.js).
    let gusts = 0;
    document.addEventListener('pointerdown', (e) => {
        if (!(e.target instanceof Element) || !e.target.closest('#intro-three-container')) return;
        gusts += 1;
        trackOnce('gust', 'hero-gust');
    }, true);

    // Form fields (the planner's filters, ...): which field, never the value.
    document.addEventListener('change', (e) => {
        const f = e.target;
        if (!(f instanceof Element) || !f.matches('input, select, textarea')) return;
        if (f.type === 'password' || f.type === 'hidden') return;
        const field = clip(f.getAttribute('aria-label') || f.name || f.id || f.getAttribute('placeholder') || f.type, 60);
        trackOnce('field:' + field, 'field-change', { field, type: f.type || f.tagName.toLowerCase(), section: sectionOf(f) });
    }, true);

    document.addEventListener('copy', () => {
        const sel = document.getSelection && document.getSelection();
        const text = sel ? String(sel) : '';
        if (!text.trim()) return;
        const node = sel.anchorNode;
        const el = node && (node.nodeType === 1 ? node : node.parentElement);
        if (!el) return;
        const pub = paperOf(el);
        let part;
        if (el.closest('.publication-bibtex')) part = 'bibtex';
        else if (el.closest('.publication-abstract')) part = 'abstract';
        else if (el.closest('pre, code')) part = 'code';
        track('text-copy', { section: sectionOf(el), paper: pub ? pub.paper : undefined, part, chars: text.length });
    });

    /* ------------------------------------------------------------------ */
    /* Reading: section and paper views, scroll depth, active time         */
    /* ------------------------------------------------------------------ */

    const sections = Array.from(document.querySelectorAll('#intro, .section[id], section[id]'))
        // Nested matches (a .section inside a section) would double count.
        .filter((el, _, all) => !all.some((o) => o !== el && o.contains(el)));
    const papers = Array.from(document.querySelectorAll('.publication'));

    const watched = [];
    sections.forEach((el) => watched.push({ el, kind: 'section', dwell: 750, since: 0, done: false }));
    papers.forEach((el) => watched.push({ el, kind: 'paper', dwell: 1500, since: 0, done: false }));

    let sectionsViewed = 0;
    let papersViewed = 0;
    let currentSection;

    function fire(w) {
        w.done = true;
        if (w.kind === 'section') {
            sectionsViewed += 1;
            track('section-' + w.el.id.slice(0, 42), { seconds_in: secondsIn(), order: sectionsViewed });
        } else {
            papersViewed += 1;
            const pub = paperOf(w.el);
            track('paper-view', {
                paper: pub.paper,
                title: pub.title,
                featured: w.el.classList.contains('publication-featured'),
                seconds_in: secondsIn(),
            });
        }
    }

    // Scroll depth milestones; only once the visitor has scrolled at all, so
    // a page that fits on screen does not report 100% on load.
    const DEPTHS = [25, 50, 75, 100];
    let maxScroll = 0;
    let scrolled = false;

    function scrollPercent() {
        const doc = document.documentElement;
        const height = Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0);
        const seen = window.scrollY + window.innerHeight;
        if (height <= 0) return 0;
        return Math.min(100, Math.round((seen / height) * 100));
    }

    function updateScroll() {
        if (!scrolled) return;
        const pct = scrollPercent();
        if (pct <= maxScroll) return;
        maxScroll = pct;
        DEPTHS.forEach((d) => {
            const reached = d === 100 ? pct >= 98 : pct >= d;
            if (reached) trackOnce('depth:' + d, 'scroll-depth', { percent: d, seconds_in: secondsIn() });
        });
    }

    // Active time: tab visible and some input in the last minute (reading a
    // long abstract involves no input, hence the generous window).
    const IDLE_MS = 60 * 1000;
    let lastInput = performance.now();
    let activeMs = 0;
    let lastTick = performance.now();
    const markInput = () => { lastInput = performance.now(); };
    ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((type) => {
        window.addEventListener(type, markInput, { passive: true, capture: true });
    });
    window.addEventListener('scroll', () => {
        markInput();
        scrolled = true;
    }, { passive: true });

    function tick() {
        const now = performance.now();
        const dt = now - lastTick;
        lastTick = now;
        if (document.visibilityState !== 'visible') return;
        if (now - lastInput < IDLE_MS) activeMs += Math.min(dt, 2000);

        updateScroll();

        // Rect reads only, no writes, so this does not force extra layouts.
        const vh = window.innerHeight || 1;
        let best = 0;
        for (const w of watched) {
            const r = w.el.getBoundingClientRect();
            const visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
            if (w.kind === 'section' && visible > best) { best = visible; currentSection = w.el.id; }
            if (w.done) continue;
            const enough = r.height > 0 && visible >= Math.min(0.6 * r.height, 0.5 * vh);
            if (!enough) { w.since = 0; continue; }
            if (!w.since) w.since = now;
            else if (now - w.since >= w.dwell) fire(w);
        }
    }
    setInterval(tick, 250);

    function timeBucket(s) {
        if (s < 10) return '0-10s';
        if (s < 30) return '10-30s';
        if (s < 60) return '30-60s';
        if (s < 180) return '1-3m';
        if (s < 600) return '3-10m';
        return '10m+';
    }

    // Sent when the tab is hidden or closed. A visitor who comes back and
    // leaves again sends another report with updated totals, so per visit
    // the last report is the full picture.
    let reportedSeconds = 0;
    let reports = 0;
    function reportEngagement() {
        tick();
        const seconds = Math.round(activeMs / 1000);
        if (seconds - reportedSeconds < 5) return;
        reportedSeconds = seconds;
        reports += 1;
        touchVisitor(visitor);
        track('engagement', {
            active_seconds: seconds,
            time_bucket: timeBucket(seconds),
            max_scroll: maxScroll,
            sections_viewed: sectionsViewed,
            papers_viewed: papers.length ? papersViewed : undefined,
            hero_gusts: gusts || undefined,
            exit_section: currentSection,
            report: reports,
        });
    }
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') reportEngagement();
        else lastTick = performance.now();
    });
    window.addEventListener('pagehide', reportEngagement);

    window.addEventListener('beforeprint', () => trackOnce('print', 'print', { section: currentSection }));

    /* ------------------------------------------------------------------ */
    /* Session replays and heatmaps                                        */
    /* ------------------------------------------------------------------ */

    // recorder.js asks the Umami server whether replays or heatmaps are on
    // for this website and stays idle otherwise. It is loaded here, not as a
    // tag, because it ignores data-domains and the umami.disabled opt-out.
    function loadRecorder() {
        const tag = document.querySelector('script[data-website-id][src*="umami"]');
        if (!tag) return;
        const domains = (tag.getAttribute('data-domains') || '').split(',').map((d) => d.trim()).filter(Boolean);
        if (domains.length && !domains.includes(location.hostname)) return;
        const s = document.createElement('script');
        s.src = new URL('recorder.js', tag.src).href;
        s.async = true;
        s.setAttribute('data-website-id', tag.getAttribute('data-website-id'));
        document.head.appendChild(s);
    }
    if (document.readyState === 'complete') loadRecorder();
    else window.addEventListener('load', loadRecorder, { once: true });
})();
