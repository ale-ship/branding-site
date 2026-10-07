// Menu and header check: at phone, tablet and desktop widths, in headless Chrome, with real key
// presses. Checks the right navigation shows, the full-screen menu opens with focus inside and the
// page locked, Tab stays inside, Escape closes it and returns focus, a link navigates and closes
// it, the header stays at the top while scrolling, and the quote badge appears.
//
//   BASE=http://localhost:3100 npm run menu
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME =
  process.env.CHROME_PATH ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(
    (p) => existsSync(p),
  );
const WIDTHS = [320, 390, 600, 768, 1023, 1024, 1440, 1920];
const LG = 1024;

const proc = spawn(
  CHROME,
  ['--headless=new', '--remote-debugging-port=9360', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'menu-'))}`, '--no-first-run', 'about:blank'],
  { stdio: 'ignore' },
);
let page;
for (let i = 0; i < 50 && !page; i++) {
  try {
    page = (await (await fetch('http://127.0.0.1:9360/json')).json()).find((t) => t.type === 'page');
  } catch {
    await sleep(200);
  }
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result ?? {});
    pending.delete(m.id);
  }
});
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
const key = async (k, shift = false) => {
  const code = { Tab: 9, Escape: 27, Enter: 13 }[k];
  const base = { key: k, code: k, windowsVirtualKeyCode: code, modifiers: shift ? 8 : 0 };
  // Enter must carry its character, as a real keyboard's does, to activate a focused button.
  await send('Input.dispatchKeyEvent', k === 'Enter' ? { type: 'keyDown', text: '\r', ...base } : { type: 'rawKeyDown', ...base });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await sleep(80);
};
const go = async (path) => {
  await send('Page.navigate', { url: BASE + path });
  await sleep(2200);
};
const visible = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; })()`;
const focusInDialog = `!!document.activeElement?.closest('#site-menu')`;

await send('Page.enable');
// Warm up: the first load after Chrome starts can be slow and would fail the first width.
await go('/');
await sleep(1500);
let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` (${detail})` : ''}`);
};

for (const width of WIDTHS) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < LG });
  await go('/');
  const at = `@ ${width}px`;
  const menuButton = 'button[aria-controls="site-menu"]';
  const desktopNav = 'header nav[aria-label="Main"]';

  if (width < LG) {
    check(`Menu button shows, inline links hidden ${at}`, (await ev(visible(menuButton))) && !(await ev(visible(desktopNav))));

    await ev(`document.querySelector('${menuButton}').focus()`);
    await key('Enter');
    await sleep(300);
    check(`Enter opens the menu ${at}`, await ev(visible('#site-menu')));
    // A parent with backdrop-filter or transform would trap the fixed menu inside the header.
    const box = await ev(`(() => { const r = document.getElementById('site-menu')?.getBoundingClientRect(); return r ? Math.round(r.width) + 'x' + Math.round(r.height) : 'none'; })()`);
    check(`menu covers the whole screen ${at}`, box === `${width}x800`, `menu is ${box}`);
    check(`menu says it is expanded ${at}`, (await ev(`document.querySelector('${menuButton}').getAttribute('aria-expanded')`)) === 'true');
    check(`focus moves into the menu ${at}`, await ev(focusInDialog));
    check(`page behind is locked ${at}`, (await ev(`document.documentElement.style.overflow`)) === 'hidden');
    check(`all six links are in the menu ${at}`, (await ev(`document.querySelectorAll('#site-menu nav a').length`)) === 6);
    check(`menu fits the screen without sideways scroll ${at}`, (await ev(`(() => { const m = document.getElementById('site-menu'); return m.scrollWidth <= m.clientWidth; })()`)) === true);

    let stayed = true;
    for (let i = 0; i < 14; i++) {
      await key('Tab');
      if (!(await ev(focusInDialog))) stayed = false;
    }
    for (let i = 0; i < 4; i++) {
      await key('Tab', true);
      if (!(await ev(focusInDialog))) stayed = false;
    }
    check(`Tab and Shift+Tab stay inside the menu ${at}`, stayed);

    await key('Escape');
    await sleep(200);
    check(`Escape closes the menu ${at}`, !(await ev(visible('#site-menu'))));
    check(`focus returns to the Menu button ${at}`, await ev(`document.activeElement === document.querySelector('${menuButton}')`));
    check(`page unlocks after closing ${at}`, (await ev(`document.documentElement.style.overflow`)) === '');

    await ev(`document.querySelector('${menuButton}').click()`);
    await sleep(300);
    await ev(`[...document.querySelectorAll('#site-menu nav a')].find((a) => a.getAttribute('href') === '/shop').click()`);
    await sleep(2500);
    check(`a menu link navigates and closes the menu ${at}`, (await ev(`location.pathname`)) === '/shop' && !(await ev(visible('#site-menu'))));
    check(`current page is marked in the menu ${at}`, await ev(`(document.querySelector('${menuButton}').click(), new Promise(r => setTimeout(() => r(document.querySelector('#site-menu a[href="/shop"]')?.getAttribute('aria-current') === 'page'), 300)))`));
    await key('Escape');
  } else {
    check(`inline links show, Menu button hidden ${at}`, (await ev(visible(desktopNav))) && !(await ev(visible(menuButton))));
    await go('/services');
    check(`current page is underlined in the header ${at}`, (await ev(`document.querySelector('${desktopNav} a[href="/services"]').getAttribute('aria-current')`)) === 'page');
  }

  await go('/work');
  await ev(`scrollTo({ top: 1500, behavior: 'instant' })`);
  await sleep(400);
  check(`header stays at the top while scrolling ${at}`, (await ev(`Math.round(document.querySelector('header').getBoundingClientRect().top)`)) === 0);

  await ev(`localStorage.setItem('noorcom-branding.quote-list.v1', JSON.stringify([{ slug: 'mug-branding', quantity: 60, options: {} }, { slug: 'business-cards', quantity: 100, options: {} }]))`);
  await go('/');
  const badge = await ev(`[...document.querySelectorAll('header a[href="/quote"]')].filter((a) => a.getBoundingClientRect().width > 0).map((a) => a.textContent.replace(/\\s+/g, ' ').trim()).join('|')`);
  check(`quote badge shows 2 items ${at}`, /2/.test(badge ?? ''), `saw "${badge}"`);
  await ev(`localStorage.clear()`);
}

ws.close();
proc.kill();
console.log(failures ? `\n${failures} problem(s) found.` : '\nMenu and header work at every width.');
process.exitCode = failures ? 1 : 0;
