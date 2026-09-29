import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { browser } from 'wxt/browser';
import { setup, pick, withinViewport } from './extensionHarness';
declare const chrome: typeof browser;

const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });
async function edit(page: Page, name: string, value: string) { await field(page, name).fill(value); await field(page, name).press('Enter'); }
async function choose(page: Page, name: string, value: string) {
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('dialog', { name, exact: true }).getByRole('button', { name: value, exact: true }).click();
}
async function shot(page: Page, name: string) {
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `artifacts/screenshots/phase-06.5.2A/${name}.png`, animations: 'disabled' });
}
async function fits(page: Page, color = false) {
  await withinViewport(page);
  const panel = page.getByRole('tabpanel', { name: 'Design', exact: true });
  expect(await panel.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  if (color) {
    const popup = page.getByRole('dialog', { name: 'Text color picker', exact: true });
    const rect = (await popup.boundingBox())!;
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
    expect(await popup.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  }
}

test('Phase 06.5.2A three Typography views, editing, alignment, narrow color and 200% zoom', async ({}, info) => {
  const { page, context, worker, tabId, errors } = await setup(info);
  try {
    await mkdir('artifacts/screenshots/phase-06.5.2A', { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1100 }); await pick(page, '#checkout');
    for (const name of ['Spacing', 'Typography', 'Background', 'Display', 'Border', 'Positioning', 'Box shadow', 'Text shadow', 'Filters']) {
      const button = page.locator(`[data-section="${name}"]`).getByRole('button', { name, exact: true });
      if (await button.getAttribute('aria-expanded') !== String(name === 'Typography')) await button.click();
    }
    await page.locator('[data-section="Typography"]').evaluate(node => node.scrollIntoView({ block: 'start' }));
    await shot(page, '01-typography-open');
    await edit(page, 'Text color', '#d8f3e1');
    await page.getByRole('button', { name: 'Text color picker', exact: true }).click();
    await fits(page, true); await shot(page, '02-color-control-open'); await page.keyboard.press('Escape');
    await edit(page, 'Text color', '#ffffff');
    await page.setViewportSize({ width: 390, height: 844 }); await fits(page);
    await page.locator('[data-section="Typography"]').evaluate(node => node.scrollIntoView({ block: 'start' }));
    await shot(page, '03-typography-narrow');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.getByRole('button', { name: 'Text color picker', exact: true }).click();
      await fits(page, true); await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Text color picker', exact: true })).toBeFocused();
    }
    const target = page.locator('#checkout');
    await choose(page, 'Font family', 'Georgia'); await expect(target).toHaveCSS('font-family', 'Georgia');
    await choose(page, 'Font weight', '600'); await expect(target).toHaveCSS('font-weight', '600');
    await edit(page, 'Font size', '20'); await field(page, 'Font size').focus();
    await field(page, 'Font size').press('Shift+ArrowUp'); await expect(target).toHaveCSS('font-size', '30px');
    await field(page, 'Font size').press('Escape'); await expect(target).toHaveCSS('font-size', '20px');
    await edit(page, 'Line height', '1.5'); await expect(target).toHaveCSS('line-height', '30px');
    await edit(page, 'Letter spacing', '0.5px'); await expect(target).toHaveCSS('letter-spacing', '0.5px');
    const alignment = page.getByRole('group', { name: 'Text alignment', exact: true });
    const sizes = await alignment.getByRole('button').evaluateAll(nodes => nodes.map(node => [node.getBoundingClientRect().width, node.getBoundingClientRect().height]));
    expect(sizes).toEqual([[30,30],[30,30],[30,30],[30,30]]);
    await alignment.getByRole('button', { name: 'Align right', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(target).toHaveCSS('text-align', 'right'); await expect(alignment.getByRole('button', { name: 'Align right', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await choose(page, 'Text decoration', 'underline'); await expect(target).toHaveCSS('text-decoration-line', 'underline');
    await choose(page, 'Text transform', 'uppercase'); await expect(target).toHaveCSS('text-transform', 'uppercase');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await worker.evaluate(id => chrome.tabs.setZoom(id, 2), tabId);
    await expect.poll(() => worker.evaluate(id => chrome.tabs.getZoom(id), tabId)).toBe(2);
    await fits(page); await edit(page, 'Font size', '22'); await expect(target).toHaveCSS('font-size', '22px');
    await page.getByRole('button', { name: 'Text color picker', exact: true }).click(); await fits(page, true);
    await edit(page, 'Text color alpha', '50%'); await expect(target).toHaveCSS('color', 'rgba(255, 255, 255, 0.5)');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
