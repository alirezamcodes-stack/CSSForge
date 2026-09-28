import { test, expect, chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { browser } from 'wxt/browser';
declare const chrome: typeof browser;

test('packaged MV3 extension mounts, toggles, isolates styles, and remains usable at 200% browser zoom', async ({}, testInfo) => {
  const build = path.resolve('.output/chrome-mv3');
  const original = JSON.parse(await readFile(path.join(build, 'manifest.json'), 'utf8'));
  expect(original.manifest_version).toBe(3);
  expect(original.permissions).toEqual(['activeTab', 'scripting']);
  expect(original.host_permissions).toBeUndefined();
  // Exercise the actual packaged action with activeTab in a fresh test profile.
  const context = await chromium.launchPersistentContext(testInfo.outputPath('profile'), {
    channel: process.env.CSSFORGE_BROWSER_CHANNEL ?? 'chrome', headless: true, viewport: { width: 1440, height: 900 },
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--enable-unsafe-extension-debugging'],
  });
  try {
    const page = await context.newPage();
    const cdp = await context.browser()!.newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: build });
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/extension-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><title>Extension host fixture</title><style>body{margin:0;background:#eae7de;font:18px Arial}button{background:red!important;font-size:40px!important}h1{margin:100px}</style></head><body><h1>Independent host page</h1><button id="host-button">Host button</button></body></html>' }));
    await page.goto('/extension-fixture.html');
    const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }] });
    const targetInfo = targetInfos.find(target => target.url.includes('extension-fixture.html'))!;
    await cdp.send('Extensions.triggerAction', { id, targetId: targetInfo.targetId });
    const tabId = await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
      const tab = tabs.find(item => item.url?.includes('extension-fixture.html'))!;
      return tab.id!;
    });
    const inspector = page.getByRole('complementary', { name: 'Selected element inspector' });
    await expect(inspector).toBeVisible();
    await expect(inspector).toHaveCSS('width', '350px');
    await expect(page.getByRole('tab', { name: 'Design', exact: true })).toHaveCSS('font-size', '13px');
    await expect(page.locator('#host-button')).toHaveCSS('font-size', '40px');
    await cdp.send('Extensions.triggerAction', { id, targetId: targetInfo.targetId });
    await expect(inspector).toBeHidden();
    await cdp.send('Extensions.triggerAction', { id, targetId: targetInfo.targetId });
    await expect(inspector).toBeVisible();
    await worker.evaluate(id => chrome.tabs.setZoom(id, 2), tabId);
    await expect.poll(() => worker.evaluate(id => chrome.tabs.getZoom(id), tabId)).toBe(2);
    await page.getByRole('slider', { name: 'Sepia', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('slider', { name: 'Sepia', exact: true })).toBeInViewport();
    for (const panel of [inspector, page.getByRole('navigation', { name: 'CSSForge tools' })]) {
      const bounds = await panel.boundingBox();
      const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    await mkdir('artifacts/screenshots', { recursive: true });
    await page.screenshot({ path: 'artifacts/screenshots/07-extension-200-percent.png' });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
