// Device check: loads every route at phone, tablet, laptop and desktop sizes (portrait and
// landscape, with touch where it applies) in headless Chrome and reports horizontal overflow,
// JavaScript errors, failed requests, broken images and sections that never appeared.
//
//   npm run build && npx next start -p 3100      (in one terminal)
//   BASE=http://localhost:3100 npm run devices   (in another)
//
// ONLY=/,/shop limits the routes. Exits non-zero if anything is wrong.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME =
  process.env.CHROME_PATH ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((p) => existsSync(p));

/** [name, width, height, touch] */
const DEVICES = [
  ['small phone', 320, 640, true],
  ['Android phone', 360, 780, true],
  ['iPhone', 390, 844, true],
  ['large phone', 430, 932, true],
  ['phone landscape', 844, 390, true],
  ['small tablet', 600, 960, true],
  ['iPad portrait', 768, 1024, true],
  ['iPad landscape', 1024, 768, true],
  ['laptop', 1280, 800, false],
  ['desktop', 1440, 900, false],
  ['large desktop', 1920, 1080, false],
];

const ONLY = process.env.ONLY?.split(',');
const ROUTES = [
  '/',
  '/work',
  '/work?service=apparel',
  '/work/sample-fleet-livery',
  '/services',
  '/services/vehicle-branding',
  '/shop',
  '/shop?category=apparel',
  '/shop/t-shirt-printing',
  '/quote',
  '/quote?service=apparel',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/no-such-page',
].filter((r) => !ONLY || ONLY.includes(r));

/** Requests that may fail in a headless check without it being the site's fault. */
const IGNORED = /google\.com|gstatic\.com|googleapis\.com/;

if (!CHROME) throw new Error('Chrome not found; set CHROME_PATH.');
const proc = spawn(
  CHROME,
  ['--headless=new', '--remote-debugging-port=9350', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'devices-'))}`, '--no-first-run', '--hide-scrollbars', 'about:blank'],
  { stdio: 'ignore' },
);
let page;
for (let i = 0; i < 50 && !page; i++) {
  try {
    page = (await (await fetch('http://127.0.0.1:9350/json')).json()).find((t) => t.type === 'page');
  } catch {
    await sleep(200);
  }
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const events = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result ?? {});
    pending.delete(m.id);
  } else if (m.method) events.push(m);
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    const timer = setTimeout(() => (pending.delete(n), resolve({})), 30000);
    pending.set(n, (v) => (clearTimeout(timer), resolve(v)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');

// Jumps must be instant: the site uses smooth scrolling, and quick smooth jumps never arrive.
const SCROLL_THROUGH = `(async () => {
  for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
    scrollTo({ top: y, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 200));
  }
  scrollTo({ top: 0, behavior: 'instant' });
  await new Promise((r) => setTimeout(r, 1600));
})()`;

const INSPECT = `(async () => {
  await Promise.race([
    Promise.all([...document.images].map((i) => { i.loading = 'eager'; return i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }); })),
    new Promise((r) => setTimeout(r, 8000)),
  ]);
  return {
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('alt') || i.src).slice(0, 3),
    // Only sections that are actually rendered at this width (some are display:none by design).
    hidden: [...document.querySelectorAll('[data-reveal]')].filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).opacity === '0').length,
    h1: document.querySelectorAll('h1').length,
  };
})()`;

let failures = 0;
for (const [name, width, height, touch] of DEVICES) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: touch && width < 900 });
  await send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
  for (const route of ROUTES) {
    events.length = 0;
    await send('Page.navigate', { url: BASE + route });
    await sleep(2200);
    await evaluate(SCROLL_THROUGH);
    const report = (await evaluate(INSPECT)) ?? { overflow: 0, broken: [], hidden: 0, h1: 1 };
    const errors = [
      ...events
        .filter((e) => e.method === 'Runtime.exceptionThrown')
        .map((e) => 'exception: ' + String(e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text).split('\n')[0]),
      ...events
        .filter((e) => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
        .map((e) => 'console error: ' + e.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 160)),
      ...events
        .filter((e) => e.method === 'Network.responseReceived' && e.params.response.status >= 400 && !IGNORED.test(e.params.response.url))
        // The 404 page is meant to answer 404.
        .filter((e) => !(route === '/no-such-page' && e.params.type === 'Document'))
        .map((e) => `HTTP ${e.params.response.status}: ${e.params.response.url}`),
      ...events
        .filter((e) => e.method === 'Network.loadingFailed' && !e.params.canceled && e.params.type !== 'Document')
        .map((e) => `request failed (${e.params.type}): ${e.params.errorText}`),
    ];
    const problems = [
      ...(report.overflow > 0 ? [`scrolls sideways by ${report.overflow}px`] : []),
      ...(report.broken.length ? [`broken images: ${report.broken.join(', ')}`] : []),
      ...(report.hidden ? [`${report.hidden} section(s) never appeared`] : []),
      ...(report.h1 !== 1 ? [`${report.h1} h1 elements`] : []),
      ...new Set(errors),
    ];
    if (problems.length) {
      failures += problems.length;
      console.log(`✗ ${route} on ${name} (${width}×${height})\n    ${problems.join('\n    ')}`);
    } else {
      console.log(`✓ ${route} on ${name} (${width}×${height})`);
    }
  }
}
ws.close();
proc.kill();
console.log(failures ? `\n${failures} problem(s) found.` : `\nAll ${ROUTES.length} routes work on all ${DEVICES.length} devices.`);
process.exitCode = failures ? 1 : 0;
