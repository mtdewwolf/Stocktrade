const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + requested);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, body) => {
    if (error) {res.writeHead(404).end(); return;}
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
    res.end(body);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true});
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Reject external requests: the games and regression suite must be offline capable.
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/tests/regressions.html`);
    await page.waitForFunction(() => window.regressionResult, null, {timeout:60000});
    const result = await page.evaluate(() => window.regressionResult);
    console.log(JSON.stringify(result));
    if (result.failed || errors.length) throw new Error(JSON.stringify({result, errors}));
    // Direct-file access must also work without a local web server.
    await page.unroute('**/*');
    await page.route('**/*', route => route.request().url().startsWith('file:') ? route.continue() : route.abort());
    await page.goto(require('node:url').pathToFileURL(path.join(root, 'index.html')).href);
    await page.waitForFunction(() => document.getElementById('currentDateDisplay').textContent.includes('1980'));
    await page.locator('#btnStep1Day').click();
    await page.waitForFunction(() => document.getElementById('dayIndexDisplay').textContent === '2');
    console.log('Direct-file startup passed.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error);process.exitCode=1;});
