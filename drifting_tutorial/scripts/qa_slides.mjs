#!/usr/bin/env node
// Lightweight Chrome DevTools Protocol QA: screenshots, overflow checks, JS errors.

import fs from 'node:fs/promises';

const endpoint = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9222';
const deckUrl = process.env.DECK_URL || 'http://127.0.0.1:8765/';
const showFragments = process.env.SHOW_FRAGMENTS === '1';
const fragmentIndex = process.env.FRAGMENT_INDEX === undefined ? null : Number(process.env.FRAGMENT_INDEX);
const auditFonts = process.env.AUDIT_FONTS === '1';
const writeScreenshots = process.env.NO_SCREENSHOTS !== '1';
const extraWaitMs = Number(process.env.QA_WAIT_MS || 0);
const slides = (process.argv.slice(2).length ? process.argv.slice(2) : ['0', '4', '8', '12', '16', '17', '18', '21', '24', '26', '28']).map((token) => {
  const [h, v = '0'] = String(token).split('.');
  return { h: Number(h), v: Number(v), label: v === '0' ? h : `${h}-${v}` };
});

const pages = await (await fetch(`${endpoint}/json/list`)).json();
const page = pages.find((target) => target.type === 'page');
if (!page) throw new Error('No debuggable Chrome page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
  }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
  if (msg.method === 'Log.entryAdded' && ['error', 'warning'].includes(msg.params.entry.level)) errors.push(msg.params.entry.text);
};

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const callId = ++id; pending.set(callId, { resolve, reject });
    ws.send(JSON.stringify({ id: callId, method, params }));
  });
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await send('Runtime.enable');
await send('Page.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: deckUrl });
await wait(5000);

const ready = await send('Runtime.evaluate', { expression: `({ready:window.deck?.isReady?.(),slides:document.querySelectorAll('.slides>section').length,visuals:!!window.DriftVisuals})`, returnByValue: true });
console.log('ready', ready.result.value);

for (const slide of slides) {
  await send('Runtime.evaluate', { expression: `window.deck.slide(${slide.h},${slide.v}); window.DriftVisuals.enter(window.deck.getCurrentSlide());` });
  if (showFragments) {
    await send('Runtime.evaluate', { expression: `window.deck.getCurrentSlide().querySelectorAll('.fragment').forEach(el=>el.classList.add('visible')); window.DriftVisuals.fragment();` });
  } else if (fragmentIndex !== null) {
    await send('Runtime.evaluate', { expression: `window.deck.getCurrentSlide().querySelectorAll('.fragment').forEach(el=>el.classList.toggle('visible', Number(el.dataset.fragmentIndex || 0) <= ${fragmentIndex})); window.DriftVisuals.fragment();` });
  }
  await wait(slide.h === 16 || slide.h === 17 ? 2400 : 1100);
  if (extraWaitMs > 0) await wait(extraWaitMs);
  const qa = await send('Runtime.evaluate', {
    expression: `(() => {
      const s = window.deck.getCurrentSlide();
      const sr = s.getBoundingClientRect();
      const pad = s.querySelector('.slide-pad');
      const offenders = [...s.querySelectorAll('*')].filter(el => {
        if (el.closest('aside.notes') || el.closest('.katex-mathml') || el.classList.contains('fragment') && !el.classList.contains('visible')) return false;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        return r.left < sr.left - 3 || r.right > sr.right + 3 || r.top < sr.top - 3 || r.bottom > sr.bottom + 3;
      }).slice(0,8).map(el => ({tag:el.tagName, cls:el.className?.baseVal || el.className, text:(el.textContent||'').trim().slice(0,50)}));
      const canvases = [...s.querySelectorAll('canvas')].map(c => {
        let colored = -1;
        try {
          const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
          colored=0; for(let i=3;i<d.length;i+=Math.max(4,Math.floor(d.length/16000/4)*4)) if(d[i]) colored++;
        } catch(e) {}
        return {id:c.id,w:c.width,h:c.height,colored};
      });
      const smallText = ${auditFonts} ? [...s.querySelectorAll('*')].flatMap(el => [...el.childNodes]
        .filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())
        .map(n => ({el, text:n.textContent.trim()})))
        .filter(({el}) => {
          const cs=getComputedStyle(el), r=el.getBoundingClientRect();
          return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > .1 && r.width && r.height && (!el.closest('.fragment') || el.closest('.fragment').classList.contains('visible'));
        })
        .map(({el,text}) => ({px:Math.round(parseFloat(getComputedStyle(el).fontSize)*10)/10, tag:el.tagName, cls:typeof el.className==='string'?el.className:'', text:text.slice(0,60)}))
        .filter(x => x.px < 27)
        .sort((a,b) => a.px-b.px).slice(0,40) : [];
      return {index:window.deck.getIndices().h, section:{w:sr.width,h:sr.height}, pad:pad?{scrollH:pad.scrollHeight,clientH:pad.clientHeight,scrollW:pad.scrollWidth,clientW:pad.clientWidth}:null, offenders, canvases, smallText};
    })()`,
    returnByValue: true,
  });
  console.log('slide', `${slide.h}.${slide.v}`, JSON.stringify(qa.result.value));
  if (writeScreenshots) {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await fs.writeFile(`/tmp/drift-qa-${String(slide.label).padStart(2, '0')}.png`, Buffer.from(shot.data, 'base64'));
  }
}

console.log('errors', JSON.stringify([...new Set(errors)]));
ws.close();
