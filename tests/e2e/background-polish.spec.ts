import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { browser } from 'wxt/browser';
import { setup, pick, withinViewport } from './extensionHarness';
declare const chrome: typeof browser;
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });
async function edit(page: Page, name: string, value: string) { await field(page, name).fill(value); await field(page, name).press('Enter'); }
async function choice(page: Page, name: string, value: string) { await button(page, name).click(); await page.getByRole('dialog', { name, exact: true }).getByRole('button', { name: value, exact: true }).click(); }
async function undo(page: Page) { await button(page, 'Inspector menu').click(); await page.getByRole('dialog', { name: 'Inspector menu', exact: true }).getByRole('button', { name: 'Undo last edit', exact: true }).click(); await page.keyboard.press('Escape'); }
async function capture(page: Page, name: string, presets = false) {
  await page.locator(presets ? '[data-section="Background"] details' : '[data-section="Background"]').evaluate(node => node.scrollIntoView({ block: 'start' }));
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `artifacts/screenshots/phase-06.5.2B/${name}.png`, animations: 'disabled' });
}
async function fits(page: Page) {
  await withinViewport(page);
  const panel = page.getByRole('tabpanel', { name: 'Design', exact: true });
  expect(await panel.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  const overlap = await page.locator('[data-section="Background"] [aria-label^="Select background layer"]').evaluateAll(nodes => nodes.some(node => { const children = [...node.parentElement!.children]; return children.slice(1).some((child, i) => child.getBoundingClientRect().left < children[i].getBoundingClientRect().right - 1); }));
  expect(overlap).toBe(false);
}

test('Phase 06.5.2B five Background views, stop dragging, layers, presets, narrow and zoom', async ({}, info) => {
  const { page, context, worker, tabId, errors } = await setup(info);
  try {
    await mkdir('artifacts/screenshots/phase-06.5.2B', { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1100 }); await pick(page, '#checkout');
    for (const name of ['Spacing', 'Typography', 'Background', 'Display', 'Border', 'Positioning', 'Box shadow', 'Text shadow', 'Filters']) {
      const header = page.locator(`[data-section="${name}"]`).getByRole('button', { name, exact: true });
      if (await header.getAttribute('aria-expanded') !== String(name === 'Background')) await header.click();
    }
    const target = page.locator('#checkout');
    await button(page, 'Add background layer').click(); await button(page, 'Add background layer').click();
    await choice(page, 'Background layer type', 'radial'); await edit(page, 'Background size', '80% 90%');
    await button(page, 'Move background layer 2 up').click(); await expect(target).toHaveCSS('background-image', /^radial-gradient/); await expect(target).toHaveCSS('background-size', /^80% 90%/);
    await button(page, 'Hide background layer 1').click(); await expect(target).toHaveCSS('background-image', /^linear-gradient\(rgba\(0, 0, 0, 0\)/);
    await button(page, 'Show background layer 1').click(); await button(page, 'Select background layer 2').click();
    await expect(button(page, 'Select background layer 2')).toHaveAttribute('aria-pressed', 'true');
    await capture(page, '01-background-layers');
    await button(page, 'Remove background layer 1').click(); await edit(page, 'Gradient direction', '90deg');
    await capture(page, '02-gradient-two-stops');
    await button(page, 'Add gradient stop').click(); await edit(page, 'Stop 2 color', '#b898ed');
    await button(page, 'Distribute stops').click(); await expect(field(page, 'Stop 2 position')).toHaveValue('50');
    await button(page, 'Select gradient stop 2').click();
    const handle = button(page, 'Select gradient stop 2'); await handle.scrollIntoViewIfNeeded();
    const h = (await handle.boundingBox())!, track = (await page.locator('[aria-label="Gradient stop track"]').boundingBox())!;
    const x = h.x + h.width / 2, y = h.y + 8;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + track.width * .15, y, { steps: 4 }); await page.mouse.up();
    await expect(field(page, 'Stop 2 position')).toHaveValue('65'); await expect(target).toHaveCSS('background-image', /65%/);
    await undo(page); await expect(field(page, 'Stop 2 position')).toHaveValue('50');
    await handle.scrollIntoViewIfNeeded(); const h2 = (await handle.boundingBox())!;
    await page.mouse.move(h2.x + 15, h2.y + 8); await page.mouse.down(); await page.mouse.move(h2.x + 40, h2.y + 8, { steps: 3 }); await page.keyboard.press('Escape'); await page.mouse.up();
    await expect(field(page, 'Stop 2 position')).toHaveValue('50');
    await handle.focus(); await handle.press('ArrowRight'); await expect(field(page, 'Stop 2 position')).toHaveValue('51');
    await button(page, 'Distribute stops').click(); await button(page, 'Reverse gradient').click(); await expect(field(page, 'Stop 1 color')).toHaveValue('#ffffff');
    await field(page, 'Stop 2 color').focus(); await expect(handle).toHaveAttribute('aria-pressed', 'true');
    await capture(page, '03-gradient-three-stops');
    const disclosure = page.locator('[data-section="Background"] summary'); await disclosure.click();
    await expect(page.getByRole('region', { name: 'Background preset browser' }).getByRole('button')).toHaveCount(28);
    await button(page, 'Background preset Tidal').click(); await expect(button(page, 'Background preset Tidal')).toHaveAttribute('aria-pressed', 'true');
    await expect(target).toHaveCSS('background-image', /rgb\(132, 212, 207\)/); await capture(page, '04-background-presets', true);
    await disclosure.click(); await button(page, 'Add gradient stop').click(); await button(page, 'Distribute stops').click();
    await page.setViewportSize({ width: 390, height: 844 }); await fits(page); await capture(page, '05-narrow-viewport');
    await page.setViewportSize({ width: 320, height: 844 }); await fits(page);
    await button(page, 'Select gradient stop 2').click(); await edit(page, 'Stop 2 position', '45%'); await expect(target).toHaveCSS('background-image', /45%/);
    await disclosure.click(); await button(page, 'Background preset Smoke').click(); await expect(button(page, 'Background preset Smoke')).toHaveAttribute('aria-pressed', 'true'); await fits(page); await disclosure.click();
    await page.setViewportSize({ width: 1440, height: 1000 }); await worker.evaluate(id => chrome.tabs.setZoom(id, 2), tabId);
    await expect.poll(() => worker.evaluate(id => chrome.tabs.getZoom(id), tabId)).toBe(2); await fits(page);
    await edit(page, 'Gradient direction', '45deg'); await expect(target).toHaveCSS('background-image', /45deg/);
    await button(page, 'Add gradient stop').click(); await button(page, 'Remove gradient stop 3').click();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
