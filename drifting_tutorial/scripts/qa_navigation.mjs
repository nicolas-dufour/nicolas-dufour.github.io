#!/usr/bin/env node

const endpoint = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9222';
const deckUrl = process.env.DECK_URL || 'http://127.0.0.1:8765/';
const [startH, startV = '0'] = String(process.argv[2] || 44).split('.');
const presses = Number(process.argv[3] || 8);
const direction = (process.argv[4] || 'right').toLowerCase();
const key = direction === 'down' ? 'ArrowDown' : 'ArrowRight';
const keyCode = direction === 'down' ? 40 : 39;

const pages = await (await fetch(`${endpoint}/json/list`)).json();
const page = pages.find((target) => target.type === 'page');
if (!page) throw new Error('No debuggable Chrome page');

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let id = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(JSON.stringify(message.error)));
  else resolve(message.result);
};

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve, reject });
    ws.send(JSON.stringify({ id: callId, method, params }));
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const inspect = async () => (await send('Runtime.evaluate', {
  expression: `(() => {
    const slide = window.deck.getCurrentSlide();
    return {
      index: window.deck.getIndices(),
      visible: slide.querySelectorAll('.fragment.visible').length,
      current: slide.querySelectorAll('.fragment.current-fragment').length,
      total: slide.querySelectorAll('.fragment').length,
      available: window.deck.availableRoutes(),
    };
  })()`,
  returnByValue: true,
})).result.value;

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: deckUrl });
await wait(4000);
await send('Runtime.evaluate', { expression: `window.deck.slide(${Number(startH)},${Number(startV)});` });
await wait(400);
console.log('start', await inspect());

for (let i = 0; i < presses; i += 1) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  await wait(250);
  console.log(`${direction} ${i + 1}`, await inspect());
}

ws.close();
