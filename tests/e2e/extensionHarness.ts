import { expect, chromium, type Page, type TestInfo } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { browser } from 'wxt/browser';
declare const chrome: typeof browser;

export const fixture = `<!doctype html><html><head><title>Fieldnotes — picker test page</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;background:#eeeae1;color:#26382f;font:18px Arial;min-height:1800px}header{padding:32px 48px;border-bottom:1px solid #bbc3b6;font-size:15px;letter-spacing:2px}main{padding:60px 48px;max-width:950px}h1{font:52px Georgia;margin:0 0 20px}p{color:#526158;line-height:1.7}.card{margin:34px 0;padding:32px;width:min(640px,100%);background:#fcfaf5;border:1px solid #c4cdbf;border-radius:12px;font:21px Georgia}.card h2{font-size:28px;margin:0 0 20px}.primary{font:18px Arial;padding:16px 24px;background:#294c3b;color:white;border:0;border-radius:6px}a{color:#294c3b}form{margin:30px 0}.scrollbox{height:90px;overflow:auto;width:270px;border:1px solid #888}.inside{margin-top:70px;height:80px;width:200px;background:#d4decc}#below{margin-top:400px}button{cursor:pointer}@media(max-width:600px){header{padding:24px}main{padding:30px 24px}h1{font-size:36px}.card{padding:24px}.primary{font-size:16px}}
</style></head><body><header>FIELDNOTES / EVERYDAY OBJECTS</header><main><h1>Designed for a slower day.</h1><p>A real page, with ordinary links, buttons and document structure.</p><section id="collection" class="card"><h2 id="headline">The everyday collection</h2><p>Considered materials. Useful shapes. Objects made to stay.</p><button id="checkout" class="primary">Explore the collection</button></section><a id="host-link" href="#below">Read the story</a><form id="host-form"><label><input id="host-check" type="checkbox"> Join our newsletter</label> <button id="submit" type="submit">Subscribe</button></form><div class="scrollbox"><div id="inside" class="inside">Nested scroll target</div></div><div id="open-host"></div><div id="closed-host"></div><p id="below">The story continues.</p></main><script>
window.hostEvents={click:0,pointerdown:0,mousedown:0,submit:0};
for(const type of ['click','pointerdown','mousedown']) document.getElementById('checkout').addEventListener(type,()=>window.hostEvents[type]++);
document.getElementById('host-form').addEventListener('submit',e=>{e.preventDefault();window.hostEvents.submit++});
document.getElementById('open-host').attachShadow({mode:'open'}).innerHTML='<button id="shadow-child" style="font:19px Georgia">Open shadow button</button>';
document.getElementById('closed-host').attachShadow({mode:'closed'}).innerHTML='<span>Closed shadow content</span>';
</script></body></html>`;

export const inspector = (page: Page) => page.getByRole('complementary', { name: 'Selected element inspector' });
export const dock = (page: Page) => page.getByRole('navigation', { name: 'CSSForge tools' });
export const identity = (page: Page) => page.getByTestId('selected-identity');
export const outline = (page: Page) => page.getByTestId('target-outline');
export async function setup(info: TestInfo) {
  const build = path.resolve('.output/chrome-mv3');
  const manifest = JSON.parse(await readFile(path.join(build, 'manifest.json'), 'utf8'));
  expect(manifest.permissions).toEqual(['activeTab', 'scripting']);
  expect(manifest.host_permissions).toBeUndefined();
  const context = await chromium.launchPersistentContext(info.outputPath('profile'), {
    channel: process.env.CSSFORGE_BROWSER_CHANNEL ?? 'chrome', headless: true,
    viewport: { width: 1440, height: 900 }, ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'],
  });
  const page = await context.newPage();
  const cdp = await context.browser()!.newBrowserCDPSession();
  const { id } = await cdp.send('Extensions.loadUnpacked', { path: build });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/extension-fixture.html', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('/extension-fixture.html');
  const hostGeometry = await page.locator('main').boundingBox();
  const documentSize = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
  const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }] });
  const targetId = targetInfos.find(target => target.url.includes('extension-fixture.html'))!.targetId;
  const action = () => cdp.send('Extensions.triggerAction', { id, targetId });
  await action(); await expect(inspector(page)).toBeVisible();
  expect(await page.locator('main').boundingBox()).toEqual(hostGeometry);
  expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual(documentSize);
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: 'http://127.0.0.1/*' })).find(tab => tab.url?.includes('extension-fixture.html'))!.id!);
  return { context, page, worker, errors, action, tabId };
}
export async function pick(page: Page, selector: string) {
  const start = dock(page).getByRole('button', { name: 'Pick page element', exact: true });
  if (await start.count()) await start.click();
  await page.locator(selector).click();
  await expect(dock(page).getByRole('button', { name: 'Pick page element', exact: true })).toBeVisible();
}
export async function aligned(page: Page, selector: string) {
  await expect.poll(async () => {
    const a = await outline(page).boundingBox(), b = await page.locator(selector).boundingBox();
    if (!a || !b) return Infinity;
    return Math.max(...(['x', 'y', 'width', 'height'] as const).map(key => Math.abs(a[key] - b[key])));
  }).toBeLessThan(1);
}
export async function withinViewport(page: Page) {
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  for (const panel of [inspector(page), dock(page)]) {
    const b = (await panel.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(viewport.width + 1); expect(b.y + b.height).toBeLessThanOrEqual(viewport.height + 1);
  }
}
