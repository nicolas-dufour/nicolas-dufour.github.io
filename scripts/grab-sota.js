const puppeteer = require('puppeteer');
const path = require('path');
const OUT = '/Users/nicolasdufour/Documents/nicolas-dufour.github.io/recordings/twitter';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle2' });

  // ----- Both radar plots (rewards specialists + GenEval) -----
  await page.evaluate(() => {
    document.querySelector('#radars').scrollIntoView({ block: 'start' });
  });
  await new Promise(r => setTimeout(r, 5000));
  // Capture just the grid of 2 radar plots
  const radarsGrid = await page.$('#radars .grid');
  if (radarsGrid) {
    await radarsGrid.screenshot({ path: path.join(OUT, 'post3-sota-radars.png') });
    console.log('  → post3-sota-radars.png');
  }

  // ----- SOTA GenEval bar plot -----
  await page.evaluate(() => {
    const el = document.querySelector('#sota_geneval');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await new Promise(r => setTimeout(r, 3500));
  const sotaGenEval = await page.$('#sota_geneval');
  if (sotaGenEval) {
    await sotaGenEval.screenshot({ path: path.join(OUT, 'post3-sota-geneval-bars.png') });
    console.log('  → post3-sota-geneval-bars.png');
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
