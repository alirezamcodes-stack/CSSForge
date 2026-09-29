import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { browser } from 'wxt/browser';
import { setup, pick, withinViewport } from './extensionHarness';
declare const chrome: typeof browser;
const field = (page: Page, name: string) => page.getByRole('textbox', { name: `${name} value`, exact: true });
const reset = (page: Page) => page.getByRole('button', { name: 'Reset filters', exact: true });
async function edit(page: Page, name: string, value: string) { await field(page, name).fill(value); await field(page, name).press('Enter'); }
async function action(page: Page, name: string) { await page.getByRole('button', { name: 'Inspector menu', exact: true }).click(); await page.getByRole('dialog', { name: 'Inspector menu', exact: true }).getByRole('button', { name, exact: true }).click(); await page.keyboard.press('Escape'); }
async function capture(page: Page, name: string) {
  await page.locator('[data-section="Filters"]').evaluate(node => node.scrollIntoView({ block: 'start' })); await page.mouse.move(0, 0);
  await page.screenshot({ path: `artifacts/screenshots/phase-06.5.2D/${name}.png`, animations: 'disabled' });
}
async function fits(page: Page) {
  await withinViewport(page);
  const panel = page.getByRole('tabpanel', { name: 'Design', exact: true });
  expect(await panel.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  const rows = await page.locator('[data-filter]').evaluateAll(nodes => nodes.map(node => {
    const label = node.querySelector('div>span')!, input = node.querySelector('input')!, slider = node.querySelector('input[type=range]')!;
    return { labelHeight: label.getBoundingClientRect().height, overlaps: label.getBoundingClientRect().right > input.getBoundingClientRect().left, sliderHeight: slider.getBoundingClientRect().height };
  }));
  expect(rows).toHaveLength(8);
  expect(rows.every(row => row.labelHeight <= 19 && !row.overlaps && row.sliderHeight >= 24)).toBe(true);
}

test('Phase 06.5.2D three filter views, all values, sliders, reset, narrow and zoom', async ({}, info) => {
  const { page, context, worker, tabId, errors } = await setup(info);
  try {
    await mkdir('artifacts/screenshots/phase-06.5.2D', { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1100 }); await pick(page, '#checkout');
    for (const name of ['Spacing', 'Typography', 'Background', 'Display', 'Border', 'Positioning', 'Box shadow', 'Text shadow', 'Filters']) {
      const header = page.locator(`[data-section="${name}"]`).getByRole('button', { name, exact: true });
      if (await header.getAttribute('aria-expanded') !== String(name === 'Filters')) await header.click();
    }
    const target = page.locator('#checkout');
    const defaults = [['Blur','0px'],['Contrast','100%'],['Brightness','100%'],['Saturate','100%'],['Hue rotate','0deg'],['Invert','0%'],['Grayscale','0%'],['Sepia','0%']];
    for (const [name, value] of defaults) await expect(field(page, name)).toHaveValue(value);
    await expect(reset(page)).toBeDisabled(); await expect(page.locator('[data-filter][data-active=true]')).toHaveCount(0);
    await capture(page, '01-neutral-filters');
    await edit(page, 'Contrast', '130%'); await edit(page, 'Saturate', '140%'); await edit(page, 'Hue rotate', '45deg');
    await expect(target).toHaveCSS('filter', 'contrast(1.3) saturate(1.4) hue-rotate(45deg)');
    await expect(page.locator('[data-filter][data-active=true]')).toHaveCount(3); await expect(reset(page)).toBeEnabled();
    await capture(page, '02-active-filters');
    await page.setViewportSize({ width: 390, height: 844 }); await fits(page); await capture(page, '03-narrow-viewport');
    await page.setViewportSize({ width: 320, height: 844 }); await fits(page);
    await edit(page, 'Blur', '2px'); await edit(page, 'Brightness', '110%'); await edit(page, 'Invert', '10%'); await edit(page, 'Grayscale', '20%'); await edit(page, 'Sepia', '25%');
    await expect(target).toHaveCSS('filter', 'contrast(1.3) saturate(1.4) hue-rotate(45deg) blur(2px) brightness(1.1) invert(0.1) grayscale(0.2) sepia(0.25)');
    await expect(page.locator('[data-filter][data-active=true]')).toHaveCount(8);
    const blur = page.getByRole('slider', { name: 'Blur', exact: true });
    await blur.focus(); await blur.press('ArrowRight'); await expect(target).toHaveCSS('filter', /blur\(2.1px\)/);
    const contrast = page.getByRole('slider', { name: 'Contrast', exact: true }); await contrast.scrollIntoViewIfNeeded();
    const bounds = (await contrast.boundingBox())!; await contrast.click({ position: { x: bounds.width * .4, y: bounds.height / 2 } });
    await expect(target).not.toHaveCSS('filter', /contrast\(1.3\)/); await expect(target).toHaveCSS('filter', /hue-rotate\(45deg\) blur\(2.1px\)/);
    const combined = await target.evaluate(node => getComputedStyle(node).filter);
    await reset(page).click(); await expect(target).toHaveCSS('filter', 'none'); await expect(reset(page)).toBeDisabled();
    await expect(page.locator('[data-filter][data-active=true]')).toHaveCount(0);
    await action(page, 'Undo last edit'); await expect(target).toHaveCSS('filter', combined); await expect(reset(page)).toBeEnabled();
    await page.setViewportSize({ width: 1440, height: 1100 });
    await pick(page, '#headline'); await expect(page.locator('#headline')).toHaveCSS('filter', 'none'); await expect(reset(page)).toBeDisabled();
    await pick(page, '#checkout'); await expect(target).toHaveCSS('filter', combined);
    await action(page, 'Reset session edits'); await expect(target).toHaveCSS('filter', 'none'); await expect(reset(page)).toBeDisabled();
    await target.evaluate(node => (node as HTMLElement).style.filter = 'blur(1px) blur(2px) drop-shadow(1px 2px 3px black)'); await pick(page, '#checkout');
    await expect(blur).toBeDisabled(); await expect(field(page, 'Blur')).toBeDisabled(); await expect(reset(page)).toBeEnabled();
    await edit(page, 'Sepia', '15%'); await expect(target).toHaveCSS('filter', /blur\(1px\) blur\(2px\) drop-shadow\(.+\) sepia\(0.15\)/);
    await reset(page).click(); await expect(target).toHaveCSS('filter', 'none'); await expect(reset(page)).toBeDisabled();
    await page.setViewportSize({ width: 1440, height: 1000 }); await worker.evaluate(id => chrome.tabs.setZoom(id, 2), tabId);
    await expect.poll(() => worker.evaluate(id => chrome.tabs.getZoom(id), tabId)).toBe(2); await fits(page);
    await edit(page, 'Hue rotate', '-20deg'); await expect(target).toHaveCSS('filter', 'hue-rotate(-20deg)');
    const hue = page.getByRole('slider', { name: 'Hue rotate', exact: true }); await hue.focus(); await hue.press('ArrowRight'); await expect(target).toHaveCSS('filter', 'hue-rotate(-19deg)');
    await action(page, 'Reset session edits'); await expect(target).toHaveCSS('filter', /blur\(1px\) blur\(2px\) drop-shadow/);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
