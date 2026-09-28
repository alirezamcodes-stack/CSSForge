import { test, expect, chromium, type Page, type TestInfo } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { browser } from 'wxt/browser';
declare const chrome: typeof browser;

const fixture = `<!doctype html><html><head><title>Fieldnotes — picker test page</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;background:#eeeae1;color:#26382f;font:18px Arial;min-height:1800px}header{padding:32px 48px;border-bottom:1px solid #bbc3b6;font-size:15px;letter-spacing:2px}main{padding:60px 48px;max-width:950px}h1{font:52px Georgia;margin:0 0 20px}p{color:#526158;line-height:1.7}.card{margin:34px 0;padding:32px;width:min(640px,100%);background:#fcfaf5;border:1px solid #c4cdbf;border-radius:12px;font:21px Georgia}.card h2{font-size:28px;margin:0 0 20px}.primary{font:18px Arial;padding:16px 24px;background:#294c3b;color:white;border:0;border-radius:6px}a{color:#294c3b}form{margin:30px 0}.scrollbox{height:90px;overflow:auto;width:270px;border:1px solid #888}.inside{margin-top:70px;height:80px;width:200px;background:#d4decc}#below{margin-top:400px}button{cursor:pointer}@media(max-width:600px){header{padding:24px}main{padding:30px 24px}h1{font-size:36px}.card{padding:24px}.primary{font-size:16px}}
</style></head><body><header>FIELDNOTES / EVERYDAY OBJECTS</header><main><h1>Designed for a slower day.</h1><p>A real page, with ordinary links, buttons and document structure.</p><section id="collection" class="card"><h2 id="headline">The everyday collection</h2><p>Considered materials. Useful shapes. Objects made to stay.</p><button id="checkout" class="primary">Explore the collection</button></section><a id="host-link" href="#below">Read the story</a><form id="host-form"><label><input id="host-check" type="checkbox"> Join our newsletter</label> <button id="submit" type="submit">Subscribe</button></form><div class="scrollbox"><div id="inside" class="inside">Nested scroll target</div></div><div id="open-host"></div><div id="closed-host"></div><p id="below">The story continues.</p></main><script>
window.hostEvents={click:0,pointerdown:0,mousedown:0,submit:0};
for(const type of ['click','pointerdown','mousedown']) document.getElementById('checkout').addEventListener(type,()=>window.hostEvents[type]++);
document.getElementById('host-form').addEventListener('submit',e=>{e.preventDefault();window.hostEvents.submit++});
document.getElementById('open-host').attachShadow({mode:'open'}).innerHTML='<button id="shadow-child" style="font:19px Georgia">Open shadow button</button>';
document.getElementById('closed-host').attachShadow({mode:'closed'}).innerHTML='<span>Closed shadow content</span>';
</script></body></html>`;

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Selected element inspector' });
const dock = (page: Page) => page.getByRole('navigation', { name: 'CSSForge tools' });
const identity = (page: Page) => page.getByTestId('selected-identity');
const outline = (page: Page) => page.getByTestId('target-outline');
async function setup(info: TestInfo) {
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
async function pick(page: Page, selector: string) {
  const start = dock(page).getByRole('button', { name: 'Pick page element', exact: true });
  if (await start.count()) await start.click();
  await page.locator(selector).click();
  await expect(dock(page).getByRole('button', { name: 'Pick page element', exact: true })).toBeVisible();
}
async function aligned(page: Page, selector: string) {
  await expect.poll(async () => {
    const a = await outline(page).boundingBox(), b = await page.locator(selector).boundingBox();
    if (!a || !b) return Infinity;
    return Math.max(...(['x', 'y', 'width', 'height'] as const).map(key => Math.abs(a[key] - b[key])));
  }).toBeLessThan(1);
}
async function withinViewport(page: Page) {
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  for (const panel of [inspector(page), dock(page)]) {
    const b = (await panel.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(viewport.width + 1); expect(b.y + b.height).toBeLessThanOrEqual(viewport.height + 1);
  }
}

test('built Chrome picker selects real data, navigates, tracks geometry and captures five Phase 03 views', async ({}, info) => {
  const { context, page, errors } = await setup(info);
  try {
    await mkdir('artifacts/screenshots/phase-03', { recursive: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
    await expect(inspector(page)).toHaveCSS('width', '350px');
    await expect(page.getByRole('tab', { name: 'Design', exact: true })).toHaveCSS('font-size', '13px');
    await page.locator('#checkout').hover();
    await expect(outline(page)).toHaveAttribute('data-mode', 'hover');
    await expect(page.getByTestId('target-label')).toContainText('button#checkout.primary');
    await aligned(page, '#checkout');
    await page.screenshot({ path: 'artifacts/screenshots/phase-03/01-hover.png' });
    await page.locator('#checkout').click();
    await expect(identity(page)).toHaveText('button#checkout.primary');
    await expect(page.getByTestId('selected-font')).toHaveText('Arial 18px');
    const rect = (await page.locator('#checkout').boundingBox())!;
    await expect(page.getByTestId('selected-dimensions')).toHaveText(`${Number(rect.width.toFixed(2))} × ${Number(rect.height.toFixed(2))}`);
    expect(await page.evaluate(() => (window as any).hostEvents)).toEqual({ click: 0, pointerdown: 0, mousedown: 0, submit: 0 });
    await page.mouse.move(800, 100); await aligned(page, '#checkout');
    await expect(outline(page)).toHaveAttribute('data-mode', 'selected');
    await page.screenshot({ path: 'artifacts/screenshots/phase-03/02-selected-inspector.png' });
    await page.getByRole('button', { name: 'Select parent', exact: true }).click();
    await expect(identity(page)).toHaveText('section#collection.card');
    await expect(page.getByTestId('selected-font')).toHaveText('Georgia 21px');
    await aligned(page, '#collection');
    await page.getByRole('button', { name: 'Select child', exact: true }).click();
    await expect(identity(page)).toHaveText('h2#headline');
    await expect(page.getByTestId('selected-font')).toHaveText('Georgia 28px');
    await page.screenshot({ path: 'artifacts/screenshots/phase-03/03-parent-child.png' });
    await page.evaluate(() => scrollTo(0, 190));
    await aligned(page, '#headline');
    await page.screenshot({ path: 'artifacts/screenshots/phase-03/04-after-scroll.png' });
    await page.setViewportSize({ width: 1000, height: 800 }); await aligned(page, '#headline');
    const handle = page.getByRole('group', { name: 'Move inspector' });
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + 60, box.y + 18); await page.mouse.down();
    await page.mouse.move(700, 55, { steps: 8 }); await page.mouse.up();
    await aligned(page, '#headline');
    await handle.focus(); await page.keyboard.press('Home');
    await page.setViewportSize({ width: 375, height: 667 });
    await withinViewport(page); await aligned(page, '#headline');
    // Hide the panel to reach a target on a narrow page, then selection restores it.
    await dock(page).getByRole('button', { name: 'Hide inspector panel' }).click();
    await pick(page, '#checkout'); await expect(inspector(page)).toBeVisible();
    await withinViewport(page); await aligned(page, '#checkout');
    await page.screenshot({ path: 'artifacts/screenshots/phase-03/05-narrow.png' });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('picker excludes all owned UI, respects Escape layers and releases host clicks', async ({}, info) => {
  const { context, page, errors } = await setup(info);
  try {
    await pick(page, '#checkout');
    await dock(page).getByRole('button', { name: 'Pick page element' }).click();
    await page.locator('#headline').hover();
    await page.getByRole('button', { name: 'Inspector menu', exact: true }).click();
    await expect(identity(page)).toHaveText('button#checkout.primary');
    await expect(outline(page)).toHaveAttribute('data-mode', 'selected');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Inspector menu' })).toBeHidden();
    await expect(dock(page).getByRole('button', { name: 'Cancel element picking' })).toBeVisible();
    await dock(page).getByRole('button', { name: 'Open Navigator', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Navigator', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dock(page).getByRole('button', { name: 'Cancel element picking' })).toBeVisible();
    await dock(page).getByRole('button', { name: 'Open Changes', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Changes', exact: true })).not.toContainText('Fixture');
    await page.keyboard.press('Escape');
    await page.locator('#headline').hover();
    await page.keyboard.press('Escape');
    await expect(dock(page).getByRole('button', { name: 'Pick page element' })).toBeVisible();
    await expect(identity(page)).toHaveText('button#checkout.primary'); await aligned(page, '#checkout');
    await page.locator('#checkout').click();
    expect(await page.evaluate(() => (window as any).hostEvents)).toEqual({ click: 1, pointerdown: 1, mousedown: 1, submit: 0 });
    await pick(page, '#host-link'); expect(page.url()).not.toContain('#below');
    await pick(page, '#host-check'); await expect(page.locator('#host-check')).not.toBeChecked();
    await page.locator('#host-check').click(); await expect(page.locator('#host-check')).toBeChecked();
    await pick(page, '#submit'); expect(await page.evaluate(() => (window as any).hostEvents.submit)).toBe(0);
    await page.locator('#submit').click(); expect(await page.evaluate(() => (window as any).hostEvents.submit)).toBe(1);
    await pick(page, '#shadow-child'); await expect(identity(page)).toHaveText('button#shadow-child');
    await page.getByRole('button', { name: 'Select parent', exact: true }).click(); await expect(identity(page)).toHaveText('div#open-host');
    await page.getByRole('button', { name: 'Select child', exact: true }).click(); await expect(identity(page)).toHaveText('button#shadow-child');
    await pick(page, '#inside');
    await page.locator('.scrollbox').evaluate(el => { el.scrollTop = 65; }); await aligned(page, '#inside');
    await page.locator('#inside').evaluate(el => { (el as HTMLElement).style.width = '150px'; });
    await expect(page.getByTestId('selected-dimensions')).toHaveText('150 × 80'); await aligned(page, '#inside');
    // Detached targets are cleared on the next geometry event, never inspected again.
    await page.locator('#inside').evaluate(el => el.remove()); await page.evaluate(() => dispatchEvent(new Event('resize')));
    await expect(identity(page)).toHaveText('No element selected'); await expect(outline(page)).toBeHidden();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('actual action toggles cleanly, preserves host page, and supports real 200% Chrome zoom', async ({}, info) => {
  const { context, page, worker, action, tabId, errors } = await setup(info);
  try {
    const hostBefore = await page.locator('main').evaluate(el => el.outerHTML);
    const debuggerSession = await context.newCDPSession(page);
    const worlds: { id: number; name: string; origin: string }[] = [];
    debuggerSession.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context));
    await debuggerSession.send('Runtime.enable');
    const extensionWorld = worlds.find(world => world.origin.startsWith('chrome-extension://'));
    expect(extensionWorld, JSON.stringify(worlds)).toBeTruthy();
    // Inspect actual registered DOM listeners, including extension isolated worlds.
    const listenerCounts = async () => {
      const counts: Record<string, number> = {};
      for (const expression of ['window', 'document']) {
        const { result } = await debuggerSession.send('Runtime.evaluate', { expression, contextId: extensionWorld!.id });
        const { listeners } = await debuggerSession.send('DOMDebugger.getEventListeners', { objectId: result.objectId! });
        for (const listener of listeners) {
          if (!['pointermove', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'scroll', 'resize', 'blur', 'pointerleave', 'keydown'].includes(listener.type)) continue;
          const key = `${expression}:${listener.type}:${listener.useCapture}`;
          counts[key] = (counts[key] ?? 0) + 1;
        }
        await debuggerSession.send('Runtime.releaseObject', { objectId: result.objectId! });
      }
      return counts;
    };
    const initialListeners = await listenerCounts();
    expect(initialListeners['window:pointermove:true']).toBe(1);
    for (let i = 0; i < 3; i++) {
      await pick(page, '#checkout'); await action();
      await expect(page.locator('cssforge-ui')).toHaveCount(0); await expect(page.locator('cssforge-overlay')).toHaveCount(0);
      expect(await listenerCounts()).toEqual({});
      await page.locator('#checkout').click();
      await action(); await expect(inspector(page)).toBeVisible();
      await expect(page.locator('cssforge-ui')).toHaveCount(1); await expect(page.locator('cssforge-overlay')).toHaveCount(1);
      expect(await listenerCounts()).toEqual(initialListeners);
    }
    expect(await page.evaluate(() => (window as any).hostEvents.click)).toBe(3);
    expect(await page.locator('main').evaluate(el => el.outerHTML)).toBe(hostBefore);
    await worker.evaluate(id => chrome.tabs.setZoom(id, 2), tabId);
    await expect.poll(() => worker.evaluate(id => chrome.tabs.getZoom(id), tabId)).toBe(2);
    await withinViewport(page);
    await dock(page).getByRole('button', { name: 'Hide inspector panel' }).click();
    await pick(page, '#checkout'); await expect(page.getByTestId('selected-font')).toHaveText('Arial 18px');
    await aligned(page, '#checkout'); await withinViewport(page);
    await page.getByRole('button', { name: 'Inspector menu', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Inspector menu' })).toBeInViewport();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Inspector menu', exact: true }).focus();
    await dock(page).getByRole('button', { name: 'Deactivate CSSForge' }).click();
    await expect(page.locator('cssforge-ui')).toHaveCount(0); await expect(page.locator('cssforge-overlay')).toHaveCount(0);
    await page.locator('#checkout').click();
    expect(await page.evaluate(() => (window as any).hostEvents.click)).toBe(4);
    // Same tab on a browser internal page: action reports the restriction, without injection.
    await page.goto('chrome://version'); await action();
    await expect.poll(() => worker.evaluate(id => chrome.action.getTitle({ tabId: id }), tabId)).toContain('unavailable');
    expect(await worker.evaluate(id => chrome.action.getBadgeText({ tabId: id }), tabId)).toBe('!');
    await page.goto('/extension-fixture.html'); await action(); await expect(inspector(page)).toBeVisible();
    expect(await worker.evaluate(id => chrome.action.getBadgeText({ tabId: id }), tabId)).toBe('');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
