import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const basename = 'Catalog-Transformer-One-Pager';
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function buildHtml() {
  const template = await readFile(join(directory, 'template.html'), 'utf8');
  let styles = await readFile(join(directory, 'styles.css'), 'utf8');
  for (const font of ['fraunces-latin', 'source-sans-3-latin']) {
    const data = await readFile(join(directory, 'assets', `${font}.woff2`));
    styles = styles.replace(`assets/${font}.woff2`, `data:font/woff2;base64,${data.toString('base64')}`);
  }
  const licenses = await Promise.all(['fraunces', 'source-sans-3'].map((font) => readFile(join(directory, 'assets', `${font}-OFL.txt`), 'utf8')));
  const licenseText = licenses.join('\n\n').replaceAll('</script', '<\\/script');
  const html = template
    .replace('<link rel="stylesheet" href="styles.css" />', `<style>\n${styles}\n    </style>`)
    .replace('</body>', `<script type="text/plain" id="embedded-font-licenses">${licenseText}</script>\n  </body>`);
  assert(!/<(?:link|img|script)\b[^>]*(?:href|src)=["']https?:/i.test(html), 'The shared HTML must have no remote resources.');
  assert(!styles.includes('url("assets/'), 'Every font must be embedded.');
  const output = join(directory, `${basename}.html`);
  await writeFile(output, html, 'utf8');
  return output;
}

async function findBrowser() {
  const candidates = [
    process.env.ONE_PAGER_BROWSER,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error('Set ONE_PAGER_BROWSER to a Chromium browser executable, or use --html-only.');
}

async function launchBrowser() {
  const browser = await findBrowser();
  const profile = await mkdtemp(join(tmpdir(), 'catalog-one-pager-'));
  const child = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-extensions',
    '--disable-sync', '--hide-scrollbars', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let launchError;
  child.on('error', (error) => { launchError = error; });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (launchError) throw launchError;
    if (child.exitCode !== null) throw new Error(`Browser exited early: ${child.exitCode}`);
    try {
      const activePort = await readFile(join(profile, 'DevToolsActivePort'), 'utf8');
      return { child, origin: `http://127.0.0.1:${Number(activePort.split('\n')[0])}` };
    } catch {
      await sleep(150);
    }
  }
  child.kill();
  throw new Error('Timed out starting the isolated headless browser.');
}

async function connectDebugger(address) {
  const socket = new WebSocket(address);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const requests = new Set();
  const exceptions = [];
  socket.addEventListener('message', (message) => {
    const packet = JSON.parse(String(message.data));
    if (packet.method === 'Network.requestWillBeSent') requests.add(packet.params.request.url);
    if (packet.method === 'Runtime.exceptionThrown') exceptions.push(packet.params.exceptionDetails.text);
    const operation = pending.get(packet.id);
    if (!operation) return;
    clearTimeout(operation.timeout);
    pending.delete(packet.id);
    if (packet.error) operation.reject(new Error(JSON.stringify(packet.error)));
    else operation.resolve(packet.result);
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 30000);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
  return { send, evaluate, requests, exceptions, close: () => socket.close() };
}

const measureLayout = `(() => {
  const sheet = document.querySelector('.sheet');
  const bounds = sheet.getBoundingClientRect();
  const footer = document.querySelector('.footer').getBoundingClientRect();
  const elements = [...document.querySelectorAll('h1,h2,h3,p,blockquote,dd,.stage-title,.section-top,.footer-tagline')];
  const overflow = elements.filter((element) => element.scrollWidth > element.clientWidth + 2).map((element) => element.textContent.trim());
  return {
    viewportWidth: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    sheetHeight: sheet.clientHeight,
    contentHeight: sheet.scrollHeight,
    footerInsideSheet: footer.bottom <= bounds.bottom - 20 * (bounds.width / sheet.offsetWidth),
    footerGap: bounds.bottom - footer.bottom,
    fontsLoaded: document.fonts.status === 'loaded' && document.fonts.check('500 30px Fraunces') && document.fonts.check('400 20px "Source Sans 3"'),
    overflow,
    bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
  };
})()`;

async function render(htmlPath) {
  const browser = await launchBrowser();
  let debuggerClient;
  try {
    const targetResponse = await fetch(`${browser.origin}/json/new?about:blank`, { method: 'PUT' });
    const target = await targetResponse.json();
    debuggerClient = await connectDebugger(target.webSocketDebuggerUrl);
    const { send, evaluate } = debuggerClient;
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] });
    await send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 1700, deviceScaleFactor: 1.5, mobile: false });
    await send('Page.navigate', { url: pathToFileURL(htmlPath).href });
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (await evaluate('document.readyState === "complete" && Boolean(document.querySelector(".sheet"))')) break;
      await sleep(100);
    }
    await evaluate('document.querySelector(".sheet").offsetHeight; document.fonts.ready.then(() => true)');
    const desktop = await evaluate(measureLayout);
    const desktopImage = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...desktop.bounds, scale: 1 } });
    await writeFile(join(directory, `${basename}.png`), Buffer.from(desktopImage.data, 'base64'));

    const printControlWorks = await evaluate(`(() => {
      const originalPrint = window.print;
      let calls = 0;
      window.print = () => { calls += 1; };
      document.querySelector('[data-print]').click();
      window.print = originalPrint;
      return calls === 1;
    })()`);

    await send('Emulation.setEmulatedMedia', { media: 'print', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await evaluate('document.querySelector(".sheet").offsetHeight; document.fonts.ready.then(() => true)');
    const print = await evaluate(measureLayout);
    const pdfResponse = await send('Page.printToPDF', {
      printBackground: true, displayHeaderFooter: false, preferCSSPageSize: true,
      paperWidth: 8.2677165354, paperHeight: 11.6929133858,
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
      generateTaggedPDF: true,
    });
    const pdf = Buffer.from(pdfResponse.data, 'base64');
    await writeFile(join(directory, `${basename}.pdf`), pdf);
    const pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;

    await send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const responsive = [];
    for (const width of [320, 390, 600, 650, 768, 900, 1024]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await evaluate('document.querySelector(".sheet").offsetHeight; document.fonts.ready.then(() => true)');
      const layout = await evaluate(measureLayout);
      responsive.push(layout);
      if (width === 390) {
        const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...layout.bounds, scale: 1 } });
        await writeFile(join(directory, 'mobile-preview.png'), Buffer.from(screenshot.data, 'base64'));
      }
    }
    const report = {
      pdfPages, printControlWorks, desktop, print, responsive,
      remoteRequests: [...debuggerClient.requests].filter((url) => /^https?:/.test(url)),
      javascriptErrors: debuggerClient.exceptions,
    };
    await writeFile(join(directory, 'validation.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    assert.equal(pdfPages, 1, 'The PDF must contain exactly one page.');
    assert.equal(printControlWorks, true, 'The print button must invoke native printing.');
    assert.equal(report.remoteRequests.length, 0, 'The document must work fully offline.');
    assert.equal(report.javascriptErrors.length, 0, 'The document must have no JavaScript errors.');
    for (const layout of [desktop, print, ...responsive]) {
      assert.equal(layout.fontsLoaded, true, 'Embedded fonts must load.');
      assert(layout.documentWidth <= layout.viewportWidth, `Horizontal page overflow at ${layout.viewportWidth}px.`);
      assert(layout.contentHeight <= layout.sheetHeight + 1, `Vertical page overflow at ${layout.viewportWidth}px.`);
      assert.equal(layout.footerInsideSheet, true, `Footer overflow at ${layout.viewportWidth}px.`);
      assert.deepEqual(layout.overflow, [], `Text overflow at ${layout.viewportWidth}px.`);
    }
    console.log('ONE_PAGER_OK: one A4 page; offline fonts; working print control; desktop, print and seven responsive widths checked.');
  } finally {
    if (debuggerClient) {
      try { await debuggerClient.send('Browser.close'); } catch {}
      debuggerClient.close();
    }
    if (browser.child.exitCode === null) browser.child.kill();
  }
}

const output = await buildHtml();
console.log(`Built ${output}`);
if (!process.argv.includes('--html-only')) await render(output);
