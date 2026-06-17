const puppeteer = require('puppeteer');
const path = require('path');
const OUT = '/Users/nicolasdufour/Documents/nicolas-dufour.github.io/recordings/twitter';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 4500));
  // Capture the qualitative carousel
  const qual = await page.$('.qual-carousel-container');
  if (qual) {
    await qual.screenshot({ path: path.join(OUT, 'post7-links-banner.png') });
    console.log('  → post7-links-banner.png');
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
