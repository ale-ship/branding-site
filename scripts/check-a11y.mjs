// Accessibility check (adapted from Noorcom Computers): runs axe-core (WCAG 2.2 A/AA + best practices) against
// every route at 390, 768 and 1440 px in headless Chrome, plus a few checks
// axe doesn't make (one h1, skip link, no horizontal scroll, 44 px targets).
//
//   npm run build && npx next start -p 3100      (in one terminal)
//   BASE=http://localhost:3100 npm run a11y      (in another; PowerShell: $env:BASE='http://localhost:3100'; npm run a11y)
//
// Needs Google Chrome or Microsoft Edge installed (set CHROME_PATH otherwise).
// Exits non-zero if any axe violation or failed check is found.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.env.BASE ?? 'http://localhost:3000';
const WIDTHS = process.env.WIDTHS ? process.env.WIDTHS.split(',').map(Number) : [390, 768, 1440];
const MIN_TARGET = 44;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const debug = process.env.DEBUG ? (...a) => console.log('  ·', ...a) : () => {};
/** ONLY=/about,/faq limits the run to those paths; WIDTHS=390 to those widths. */
const ONLY = process.env.ONLY?.split(',');

const CHROME =
  process.env.CHROME_PATH ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((p) => existsSync(p));

const seedQuote = `localStorage.setItem('noorcom-branding.quote-list.v1', ${JSON.stringify(
  JSON.stringify([
    { slug: 'business-cards', quantity: 120, options: { Finish: 'Matte laminate', Sides: 'Both sides' } },
    { slug: 'mug-branding', quantity: 60, options: { Mug: 'White ceramic' } },
  ]),
)});`;


/** Fills and sends the design-only order form (the shortest), landing on the new order's page. */
const placeOrder = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const set = (sel, val) => {
    const el = document.querySelector(sel);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set('#brief-format', 'A3 poster');
  for (let i = 0; i < 3; i++) { document.querySelector('form button[type=submit]').click(); await wait(500); }
  set('#name', 'Amina Otieno');
  set('#phone', '0722 530 303');
  set('#email', 'amina@example.co.ke');
  document.querySelector('#agree').click();
  await wait(100);
  document.querySelector('form button[type=submit]').click();
})()`;

/**
 * Each route, with optional setup before load and an action after it (to put the page into the
 * state worth checking, e.g. a form with errors showing).
 */
const ROUTES = [
  { path: '/' },
  { path: '/', name: 'menu open', action: `document.querySelector('button[aria-controls="site-menu"]')?.click()` },
  { path: '/work' },
  { path: '/work?service=apparel', name: 'filtered work' },
  { path: '/work/sample-fleet-livery' },
  { path: '/services' },
  { path: '/services/apparel' },
  { path: '/shop' },
  { path: '/shop?category=gifts', name: 'shop category' },
  { path: '/shop/business-cards' },
  { path: '/shop/business-cards', name: 'product added', action: `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Add to quote')).click()` },
  { path: '/quote' },
  { path: '/quote', name: 'quote with errors', action: `document.querySelector('form button[type=submit]').click()` },
  { path: '/quote', name: 'quote with shop items', setup: seedQuote },
  { path: '/order' },
  { path: '/order/new?product=business-cards', name: 'order form' },
  { path: '/order/new?product=business-cards', name: 'order form with errors', action: `document.querySelector('form button[type=submit]').click()` },
  { path: '/order/new?product=t-shirt-printing', name: 'apparel order form' },
  { path: '/order/new?product=indoor-branding-job', name: 'site job order form' },
  { path: '/order/new?product=poster-design', name: 'order page (placed)', action: placeOrder, waitFor: `location.pathname.startsWith('/order/NB-') && !!document.querySelector('#pay-title')` },
  {
    path: '/order/new?product=poster-design',
    name: 'invoice',
    action: placeOrder,
    // Once the order page is up, follow its invoice link; done when the invoice has loaded.
    waitFor: `(location.pathname.endsWith('/invoice') && !!document.querySelector('article h1')) || (!!document.querySelector('a[href*="/invoice"]') && (document.querySelector('a[href*="/invoice"]').click(), false))`,
  },
  {
    path: '/order/new?product=poster-design',
    name: 'receipt',
    action: placeOrder,
    // Pay through the demo Paybill, then open the receipt it produces.
    waitFor: `(location.pathname.includes('/receipt/') && !!document.querySelector('article h1')) ||
      (document.querySelector('a[href*="/receipt/"]')
        ? (document.querySelector('a[href*="/receipt/"]').click(), false)
        : ((b) => (b && !window.__paid && ((window.__paid = true), b.click()), false))(
            [...document.querySelectorAll('section[aria-labelledby=demo-title] button')].find((x) => x.textContent.includes('Paybill payment of')),
          ))`,
  },
  { path: '/order/NB-000000', name: 'find your order' },
  { path: '/about' },
  { path: '/contact' },
  { path: '/contact', name: 'contact with errors', action: `document.querySelector('form button[type=submit]').click()` },
  { path: '/privacy' },
  { path: '/terms' },
  { path: '/no-such-page', name: '404' },
];

async function launch(port = 9340) {
  if (!CHROME) throw new Error('Chrome not found; set CHROME_PATH.');
  const proc = spawn(
    CHROME,
    ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'a11y-'))}`, '--no-first-run', '--hide-scrollbars', 'about:blank'],
    { stdio: 'ignore' },
  );
  let page;
  for (let i = 0; i < 50 && !page; i++) {
    try {
      page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
    } catch {
      await sleep(200);
    }
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) listeners.forEach((l) => l(msg));
  });
  /** A protocol call that fails after 30 s instead of hanging the run. */
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      const timer = setTimeout(() => {
        pending.delete(n);
        reject(new Error(`${method} timed out`));
      }, 30000);
      pending.set(n, {
        resolve: (v) => (clearTimeout(timer), resolve(v)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  return {
    send,
    evaluate,
    /** Navigates and waits for the load event (at most 20 s, so one stuck page can't hang the run). */
    async goto(url) {
      let listener;
      const loaded = new Promise((r) => {
        listener = (m) => m.method === 'Page.loadEventFired' && r();
        listeners.add(listener);
      });
      await send('Page.navigate', { url });
      await Promise.race([loaded, sleep(20000)]);
      listeners.delete(listener);
    },
    async waitFor(expression, timeout = 15000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (await evaluate(expression).catch(() => false)) return;
        await sleep(150);
      }
      throw new Error(`Timed out waiting for ${expression}`);
    },
    close() {
      ws.close();
      proc.kill();
    },
  };
}

/** Checks axe doesn't make. Returns a list of problems. */
const EXTRA_CHECKS = `(() => {
  const problems = [];
  const h1s = document.querySelectorAll('h1');
  if (h1s.length !== 1) problems.push(h1s.length + ' h1 elements (want exactly 1)');
  const skip = document.querySelector('a[href="#main"]');
  if (!skip || !document.getElementById('main')) problems.push('skip link or #main missing');
  const overflow = document.documentElement.scrollWidth - window.innerWidth;
  if (overflow > 0) problems.push('horizontal scroll of ' + overflow + 'px');
  // Target size: every visible control outside running text must be at least 44 x 44.
  const small = [];
  for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [tabindex="0"]')) {
    if (el.closest('[aria-hidden="true"], [inert]')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden') continue;
    // Visually hidden until focused (the skip link); its focused size is what users get.
    if (r.width <= 1 && r.height <= 1) continue;
    // A "stretched" link whose ::after covers its card: the card is the target.
    if (getComputedStyle(el, '::after').position === 'absolute') continue;
    // Links inside a sentence are exempt (WCAG 2.5.8 inline exception).
    const inline = el.tagName === 'A' && style.display === 'inline' && el.parentElement && /^(P|LI|SPAN|DD|TD)$/.test(el.parentElement.tagName) && el.parentElement.textContent.trim().length > el.textContent.trim().length + 5;
    if (inline) continue;
    // Radio and checkbox inputs are sized by their label, which is the target.
    if (el.matches('input[type=radio], input[type=checkbox]')) {
      const label = el.closest('label') ?? document.querySelector('label[for="' + el.id + '"]');
      const lr = label?.getBoundingClientRect();
      if (lr && lr.height >= ${MIN_TARGET} - 0.5) continue;
    }
    if (r.height < ${MIN_TARGET} - 0.5 || r.width < 24) {
      small.push((el.getAttribute('aria-label') || el.textContent.trim() || el.id || el.tagName).slice(0, 40) + ' (' + Math.round(r.width) + 'x' + Math.round(r.height) + ')');
    }
  }
  if (small.length) problems.push('targets under ${MIN_TARGET}px: ' + [...new Set(small)].slice(0, 8).join('; '));
  return problems;
})()`;

const browser = await launch(Number(process.env.CDP_PORT ?? 9340));
let failures = 0;
try {
  // Everything runs with reduced motion off, then the hero is checked with it on.
  for (const width of WIDTHS) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    for (const route of ROUTES.filter((r) => !ONLY || ONLY.includes(r.path))) {
      const label = `${route.name ?? route.path} @ ${width}`;
      try {
      debug(label, 'reset');
      await browser.goto(`${BASE}/robots.txt`);
      await browser.evaluate('localStorage.clear(); sessionStorage.clear();');
      if (route.setup) await browser.evaluate(route.setup);
      debug(label, 'load');
      await browser.goto(BASE + route.path);
      // Let streamed sections, hydration and client data settle.
      await browser.waitFor(`!document.querySelector('.skeleton')`, 10000).catch(() => {});
      // Let scroll reveals finish fading in (up to ~1.3 s with delays) so contrast is measured at rest.
      await sleep(1600);
      if (route.action) {
        await browser.evaluate(route.action);
        await sleep(700);
      }
      if (route.waitFor) await browser.waitFor(route.waitFor);

      debug(label, 'axe');
      await browser.evaluate(AXE_SOURCE);
      const result = await browser.evaluate(`axe.run(document, {
        iframes: false,
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      }).then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })))`);
      const extra = await browser.evaluate(EXTRA_CHECKS);
      if (result.length || extra.length) {
        failures += result.length + extra.length;
        console.log(`✗ ${label}`);
        for (const v of result) console.log(`    axe ${v.impact} ${v.id}: ${v.help}\n      ${v.nodes.join('\n      ')}`);
        for (const p of extra) console.log(`    ${p}`);
      } else {
        console.log(`✓ ${label}`);
      }
      } catch (error) {
        // One stuck page shouldn't hang or end the whole run.
        failures++;
        console.log(`✗ ${label}
    could not check: ${error.message}`);
      }
    }
  }

  // Reduced motion: the tickers and the rotating badge must stand still.
  await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await browser.goto(`${BASE}/`);
  await sleep(1500);
  const moving = await browser.evaluate(`[...document.querySelectorAll('.animate-marquee, .animate-spin-slow')]
    .filter((el) => parseFloat(getComputedStyle(el).animationDuration) > 0.01 && getComputedStyle(el).animationIterationCount !== '1').length`);
  if (moving) {
    failures++;
    console.log(`✗ ${moving} animation(s) still running with prefers-reduced-motion`);
  } else {
    console.log('✓ tickers and badge stand still with prefers-reduced-motion');
  }
} finally {
  browser.close();
}

console.log(failures ? `\n${failures} problem(s) found.` : '\nNo accessibility problems found.');
process.exitCode = failures ? 1 : 0;
