const puppeteer = require('puppeteer');
const path = require('path');
const OUT = '/Users/nicolasdufour/Documents/nicolas-dufour.github.io/recordings/twitter';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle2' });

  // Scroll to the training curves so the d3 plots draw + the entry animation
  // has time to settle, and the reveal-on-scroll triggers.
  await page.evaluate(() => {
    document.querySelector('#training-curves .grid').scrollIntoView({ block: 'center' });
  });
  await new Promise(r => setTimeout(r, 4000));

  // Just the 2x2 grid of plots
  const grid = await page.$('#training-curves .grid.grid-4');
  if (grid) {
    await grid.screenshot({ path: path.join(OUT, 'post2-efficiency-curves.png') });
    console.log('  → post2-efficiency-curves.png');
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
