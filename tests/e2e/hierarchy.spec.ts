import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { browser } from 'wxt/browser';
import { setup, pick, withinViewport } from './extensionHarness';
declare const chrome: typeof browser;

async function sections(page: Page, opened: string[]) {
  for (const name of ['Spacing', 'Typography', 'Background', 'Display', 'Border', 'Positioning', 'Box shadow', 'Text shadow', 'Filters']) {
    const section = page.locator(`[data-section="${name}"]`);
    const button = section.getByRole('button', { name, exact: true });
    const expanded = String(opened.includes(name));
    if (await button.getAttribute('aria-expanded') !== expanded) await button.click();
    await expect(button).toHaveAttribute('aria-expanded', expanded);
    await expect(section.locator(':scope > div')).toBeVisible({ visible: opened.includes(name) });
  }
}
async function edit(page: Page, name: string, value: string) {
  const input = page.getByRole('textbox', { name, exact: true });
  await input.fill(value); await input.press('Enter');
}
async function capture(page: Page, name: string, section?: string) {
  if (section) await page.locator(`[data-section="${section}"]`).evaluate(node => node.scrollIntoView({ block: 'start' }));
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `artifacts/screenshots/phase-06.5.1/${name}.png`, animations: 'disabled' });
}
async function fits(page: Page) {
  await withinViewport(page);
  const panel = page.getByRole('tabpanel', { name: 'Design', exact: true });
  expect(await panel.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
}

test('Phase 06.5.1 six hierarchy views, Design editing, section boundaries, narrow and 200% zoom', async ({}, info) => {
  const { page, context, worker, tabId, errors } = await setup(info);
  try {
    await mkdir('artifacts/screenshots/phase-06.5.1', { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await pick(page, '#checkout');
    const target = page.locator('#checkout');
    await sections(page, []);
    await page.getByRole('tabpanel', { name: 'Design', exact: true }).evaluate(node => node.scrollTop = 0);
    await capture(page, '01-collapsed-sections');
    await sections(page, ['Typography']);
    await edit(page, 'Font size', '20'); await expect(target).toHaveCSS('font-size', '20px');
    await edit(page, 'Font size', '18');
    await capture(page, '02-typography-open', 'Typography');
    await sections(page, ['Background']);
    await page.getByRole('button', { name: 'Add background layer', exact: true }).click();
    await page.getByRole('button', { name: 'Add background layer', exact: true }).click();
    await expect(target).toHaveCSS('background-image', /linear-gradient/);
    await capture(page, '03-background-open', 'Background');
    await sections(page, ['Box shadow']);
    await page.locator('[data-section="Box shadow"] summary').click();
    await page.getByRole('button', { name: 'Box shadow preset Elevated', exact: true }).click();
    await page.locator('[data-section="Box shadow"] summary').click();
    await page.getByRole('button', { name: 'Add box shadow', exact: true }).click();
    await expect(target).toHaveCSS('box-shadow', /12px/);
    await capture(page, '04-box-shadow-open', 'Box shadow');
    await sections(page, ['Text shadow']);
    await page.getByRole('button', { name: 'Add text shadow', exact: true }).click();
    await edit(page, 'Text shadow blur', '3px'); await expect(target).toHaveCSS('text-shadow', /3px/);
    await sections(page, ['Filters']);
    await edit(page, 'Contrast value', '130%'); await edit(page, 'Hue rotate value', '15deg');
    await expect(target).toHaveCSS('filter', 'contrast(1.3) hue-rotate(15deg)');
    await capture(page, '05-filters-open', 'Filters');
    await sections(page, ['Typography']);
    await page.setViewportSize({ width: 390, height: 844 }); await fits(page);
    await capture(page, '06-narrow-viewport', 'Typography');
    await page.setViewportSize({ width: 320, height: 568 }); await fits(page);
    await sections(page, ['Background']); await fits(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await worker.evaluate(id => chrome.tabs.setZoom(id, 2), tabId);
    await expect.poll(() => worker.evaluate(id => chrome.tabs.getZoom(id), tabId)).toBe(2);
    await fits(page); await sections(page, ['Typography']);
    await edit(page, 'Font size', '20'); await expect(target).toHaveCSS('font-size', '20px');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
