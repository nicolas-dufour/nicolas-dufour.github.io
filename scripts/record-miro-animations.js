#!/usr/bin/env node
/**
 * Batch-record every MIRO p5.js animation to MP4 for social sharing.
 *
 * Drives the standalone /miro/record.html?animation=…&auto=1 page in headless
 * Chrome via Puppeteer, then converts the resulting WebM(s) to H.264 MP4 with
 * ffmpeg.
 *
 * Prereqs:
 *   - Node 18+
 *   - npm install puppeteer    (in this scripts/ directory)
 *   - ffmpeg on PATH           (e.g. `brew install ffmpeg`)
 *   - A local server serving the miro/ directory, e.g.:
 *       cd miro && python3 -m http.server 4173
 *
 * Usage:
 *   node scripts/record-miro-animations.js                          # all four
 *   node scripts/record-miro-animations.js theory training          # just these
 *   node scripts/record-miro-animations.js --width 1920 --height 1080 theory
 *   node scripts/record-miro-animations.js --url http://localhost:8080 --out ./out
 */

const path = require('path');
const fs = require('fs');
const { execFileSync, spawn } = require('child_process');

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (err) {
  console.error('puppeteer is not installed. Run `npm install puppeteer` in scripts/.');
  process.exit(1);
}

const ANIMATIONS = {
  training:  { duration: 18, width: 1280, height: 720 },
  inference: { duration: 23, width: 1280, height: 720 },
  // tradeoff's draw loop doesn't tick captureStream in headless mode (its
  // async setup + closure-gated `playing` flag interact badly with MediaRecorder),
  // so fall back to viewport screencast.
  tradeoff:  { duration: 30, width: 1280, height: 720, useScreencast: true },
  theory:    { duration: 17, width: 1280, height: 720 },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { url: 'http://127.0.0.1:4173', outDir: path.join(__dirname, '..', 'recordings') };
  const names = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--width' || a === '-w') opts.width = parseInt(args[++i], 10);
    else if (a === '--height') opts.height = parseInt(args[++i], 10);
    else if (a === '--duration' || a === '-d') opts.duration = parseFloat(args[++i]);
    else if (a === '--fps') opts.fps = parseInt(args[++i], 10);
    else if (a === '--url') opts.url = args[++i];
    else if (a === '--out') opts.outDir = args[++i];
    else if (a === '--keep-webm') opts.keepWebM = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else if (a.startsWith('-')) { console.error(`unknown flag: ${a}`); process.exit(1); }
    else names.push(a);
  }
  return { opts, names };
}

function printHelp() {
  console.log(`
Usage: node record-miro-animations.js [options] [animation ...]

Animations: ${Object.keys(ANIMATIONS).join(', ')}  (default: all)

Options:
  --width  N         output width  (default per-animation; e.g. 1280)
  --height N         output height (default per-animation; e.g. 720)
  --duration N       record length in seconds (default per-animation)
  --fps N            capture frame rate (default 60)
  --url URL          base URL for local server (default http://127.0.0.1:4173)
  --out PATH         output directory (default ../recordings)
  --keep-webm        keep the intermediate WebM alongside the MP4
`);
}

function checkFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch (err) {
    console.error('ffmpeg not found on PATH. Install it (e.g. `brew install ffmpeg`).');
    process.exit(1);
  }
}

async function recordOne(name, opts) {
  const cfg = ANIMATIONS[name];
  if (!cfg) throw new Error(`unknown animation: ${name}`);
  const width    = opts.width    || cfg.width;
  const height   = opts.height   || cfg.height;
  const duration = opts.duration || cfg.duration;
  const fps      = opts.fps      || 60;
  const useScreencast = opts.screencast || cfg.useScreencast;

  // record.html auto-starts in MediaRecorder mode unless we pass mode=screencast.
  const modeParam = useScreencast ? '&mode=screencast' : '&auto=1';
  const url = `${opts.url.replace(/\/$/, '')}/record.html?animation=${name}&w=${width}&h=${height}&duration=${duration}${modeParam}`;
  fs.mkdirSync(opts.outDir, { recursive: true });

  console.log(`\n[${name}] ${width}×${height} @ ${fps}fps for ${duration}s${useScreencast ? ' (screencast)' : ''}`);
  console.log(`         → ${url}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      `--window-size=${width + 32},${height + 32}`,
      '--no-sandbox',
      '--hide-scrollbars',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  try {
    const page = await browser.newPage();
    // For screencast mode, viewport must match the canvas-wrap size exactly so
    // the captured frames have no margins around the animation.
    const vpW = useScreencast ? width : width + 32;
    const vpH = useScreencast ? height : height + 32;
    await page.setViewport({ width: vpW, height: vpH, deviceScaleFactor: 2 });

    if (useScreencast) {
      // Record the page viewport directly via the DevTools Protocol — works
      // even when canvas.captureStream() doesn't capture the draw loop
      // (e.g. some sketches with async setup gate their draw with closure flags
      // that the IntersectionObserver stub can't reach).
      await page.goto(url, { waitUntil: 'networkidle2' });
      await page.waitForSelector('canvas', { timeout: 10000 });
      // Give the animation a moment to start
      await new Promise(r => setTimeout(r, 1500));

      const webmPath = path.join(opts.outDir, `miro-${name}-screencast.webm`);
      console.log(`         capturing viewport...`);
      const recorder = await page.screencast({ path: webmPath });
      await new Promise(r => setTimeout(r, duration * 1000 + 600));
      await recorder.stop();

      const mp4Path = path.join(opts.outDir, `miro-${name}.mp4`);
      console.log(`         encoding to MP4...`);
      await new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', [
          '-y',
          '-i', webmPath,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-crf', '17',
          '-preset', 'slow',
          '-movflags', '+faststart',
          mp4Path,
        ], { stdio: ['ignore', 'inherit', 'inherit'] });
        ff.on('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)));
      });
      if (!opts.keepWebM) fs.unlinkSync(webmPath);
      console.log(`         → ${mp4Path}`);
      return mp4Path;
    }

    // Capture the WebM blob that record.html offers via a download link
    const downloadDir = path.resolve(opts.outDir);
    const cdp = await page.target().createCDPSession();
    await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });

    await page.goto(url, { waitUntil: 'networkidle2' });

    // record.html?auto=1 starts recording ~1.5s after load and stops at `duration`.
    // Wait for the WebM file to appear in the download dir.
    const expectedExt = ['webm', 'mp4'];
    const startTimer = Date.now();
    const timeoutMs = (duration + 90) * 1000;

    function findNewFile() {
      const entries = fs.readdirSync(downloadDir);
      return entries.find(e =>
        e.startsWith(`miro-${name}-`) &&
        expectedExt.some(ext => e.endsWith('.' + ext)) &&
        // Skip files that are still being written
        !e.endsWith('.crdownload')
      );
    }

    let outFile = null;
    while (Date.now() - startTimer < timeoutMs) {
      await new Promise(r => setTimeout(r, 400));
      outFile = findNewFile();
      if (outFile) break;
    }

    if (!outFile) {
      throw new Error(`timed out waiting for recording (>${(timeoutMs / 1000) | 0}s)`);
    }

    // Wait for the file size to stop growing — Chrome streams the blob to disk
    // asynchronously and we'd otherwise risk closing the browser mid-write.
    const fullSrcStat = path.join(downloadDir, outFile);
    let lastSize = -1;
    let stableTicks = 0;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 250));
      const sz = fs.statSync(fullSrcStat).size;
      if (sz === lastSize && sz > 0) {
        stableTicks += 1;
        if (stableTicks >= 4) break; // ~1s of no change
      } else {
        stableTicks = 0;
      }
      lastSize = sz;
    }

    const fullSrc = path.join(downloadDir, outFile);
    const ext = path.extname(outFile).slice(1);
    if (ext === 'mp4') {
      // Browser already produced MP4 — done
      console.log(`         saved ${outFile}`);
      return fullSrc;
    }

    // WebM → MP4
    const mp4Path = path.join(downloadDir, `miro-${name}.mp4`);
    console.log(`         encoding to MP4…`);
    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-y',
        '-i', fullSrc,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-crf', '17',
        '-preset', 'slow',
        '-profile:v', 'high',
        '-movflags', '+faststart',
        mp4Path,
      ], { stdio: ['ignore', 'inherit', 'inherit'] });
      ff.on('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)));
    });

    if (!opts.keepWebM) fs.unlinkSync(fullSrc);
    console.log(`         → ${mp4Path}`);
    return mp4Path;
  } finally {
    await browser.close();
  }
}

(async () => {
  checkFfmpeg();
  const { opts, names } = parseArgs();
  const targets = names.length ? names : Object.keys(ANIMATIONS);
  for (const n of targets) {
    if (!ANIMATIONS[n]) {
      console.error(`unknown animation: ${n}`);
      console.error(`choose from: ${Object.keys(ANIMATIONS).join(', ')}`);
      process.exit(1);
    }
  }

  for (const n of targets) {
    await recordOne(n, opts);
  }
  console.log('\nAll done.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
