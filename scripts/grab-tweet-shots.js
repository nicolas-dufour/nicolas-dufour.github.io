// Grab high-DPR screenshots of specific sections of the MIRO page
// for use as tweet illustrations.
const puppeteer = require('puppeteer');
const path = require('path');

const OUT = '/Users/nicolasdufour/Documents/nicolas-dufour.github.io/recordings/twitter';
const URL = 'http://127.0.0.1:4173/';

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  // Wait for animations and KPI count-up to finish
  await new Promise(r => setTimeout(r, 3000));

  // Helper: screenshot a single element with optional padding
  async function shotElement(selector, file, opts = {}) {
    const el = await page.$(selector);
    if (!el) {
      console.warn('no element:', selector);
      return;
    }
    if (opts.padding) {
      const box = await el.boundingBox();
      if (box) {
        const pad = opts.padding;
        await page.screenshot({
          path: path.join(OUT, file),
          clip: {
            x: Math.max(0, box.x - pad),
            y: Math.max(0, box.y - pad),
            width: box.width + pad * 2,
            height: box.height + pad * 2,
          },
        });
        console.log('  →', file);
        return;
      }
    }
    await el.screenshot({ path: path.join(OUT, file) });
    console.log('  →', file);
  }

  // --- Post 1: Hero ---
  await shotElement('.hero', 'post1-icml-concept.png');

  // --- Post 2: KPIs (just the results-summary section) ---
  await shotElement('#results-summary', 'post2-efficiency-kpis.png');

  // --- Post 3: Images-per-reward (the carousel inside weight-sweeps area) ---
  // Scroll to it first to trigger lazy-load
  await page.evaluate(() => {
    const el = document.querySelector('.ipr-carousel-container');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await new Promise(r => setTimeout(r, 2500));
  await shotElement('.ipr-carousel-container', 'post3-reward-hacking.png');

  // --- Post 5: Radar plot section ---
  await page.evaluate(() => {
    const el = document.querySelector('#radars');
    if (el) el.scrollIntoView({ block: 'start' });
  });
  await new Promise(r => setTimeout(r, 2000));
  await shotElement('#radars', 'post5-ablation-radar.png');

  // --- Post 7: A clean "links banner" using the hero topnav + title ---
  // Use the hero again but framed for sharing. We just reuse the hero shot.
  // We'll produce a separate banner via cropping in ffmpeg below.

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
