import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { browser } from 'wxt/browser';
import { setup, pick, withinViewport } from './extensionHarness';
declare const chrome: typeof browser;
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const section = (page: Page, name: string) => page.locator(`[data-section="${name}"]`);
async function edit(page: Page, name: string, value: string) { const field = page.getByRole('textbox', { name, exact: true }); await field.fill(value); await field.press('Enter'); }
async function openSection(page: Page, name: string) {
  for (const title of ['Spacing', 'Typography', 'Background', 'Display', 'Border', 'Positioning', 'Box shadow', 'Text shadow', 'Filters']) {
    const header = section(page, title).getByRole('button', { name: title, exact: true });
    if (await header.getAttribute('aria-expanded') !== String(title === name)) await header.click();
  }
}
async function action(page: Page, name: string) { await button(page, 'Inspector menu').click(); await page.getByRole('dialog', { name: 'Inspector menu', exact: true }).getByRole('button', { name, exact: true }).click(); await page.keyboard.press('Escape'); }
async function capture(page: Page, name: string, title: string) {
  await section(page, title).evaluate(node => node.scrollIntoView({ block: 'start' })); await page.mouse.move(0, 0);
  await page.screenshot({ path: `artifacts/screenshots/phase-06.5.2C/${name}.png`, animations: 'disabled' });
}
async function fits(page: Page, color?: string) {
  await withinViewport(page);
  const panel = page.getByRole('tabpanel', { name: 'Design', exact: true });
  expect(await panel.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  const overlap = await page.locator('[aria-label^="Select box shadow"], [aria-label^="Select text shadow"]').evaluateAll(nodes => nodes.some(node => {
    if (!node.getBoundingClientRect().width) return false;
    const children = [...node.parentElement!.children];
    return children.slice(1).some((child, i) => child.getBoundingClientRect().left < children[i].getBoundingClientRect().right - 1);
  }));
  expect(overlap).toBe(false);
  if (color) {
    const popup = page.getByRole('dialog', { name: `${color} shadow color picker`, exact: true });
    const rect = (await popup.boundingBox())!, viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width); expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
  }
}

test('Phase 06.5.2C six shadow views, layer clarity, edits, presets, undo, narrow and zoom', async ({}, info) => {
  const { page, context, worker, tabId, errors } = await setup(info);
  try {
    await mkdir('artifacts/screenshots/phase-06.5.2C', { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1100 }); await pick(page, '#checkout');
    const target = page.locator('#checkout');
    await openSection(page, 'Box shadow');
    await expect(section(page, 'Box shadow')).toContainText('No box shadow.');
    await expect(page.getByRole('textbox', { name: 'Box shadow x', exact: true })).toHaveCount(0);
    await section(page, 'Box shadow').locator('summary').click();
    await expect(page.getByRole('region', { name: 'Box shadow preset browser' }).getByRole('button')).toHaveCount(15);
    await capture(page, '01-box-shadow-presets', 'Box shadow');
    await button(page, 'Box shadow preset Elevated').click(); await expect(target).toHaveCSS('box-shadow', /12px 22px/);
    await expect(button(page, 'Box shadow preset Elevated')).toHaveAttribute('aria-pressed', 'true');
    await section(page, 'Box shadow').locator('summary').click();
    await button(page, 'Add box shadow').click(); await edit(page, 'Box shadow x', '8'); await edit(page, 'Box shadow color', '#143322');
    await expect(button(page, 'Select box shadow 2')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-shadow-editor="Box"]')).toContainText('Selected shadow 2');
    await capture(page, '02-box-shadow-two-layers', 'Box shadow');
    await button(page, 'Select box shadow 1').click(); await expect(page.getByRole('textbox', { name: 'Box shadow x', exact: true })).toHaveValue('0');
    await button(page, 'Select box shadow 2').click(); await expect(page.getByRole('textbox', { name: 'Box shadow x', exact: true })).toHaveValue('8');
    await button(page, 'Move box shadow 2 up').click(); await expect(target).toHaveCSS('box-shadow', /^rgb\(20, 51, 34\) 8px/);
    await button(page, 'Hide box shadow 1').click(); await expect(target).toHaveCSS('box-shadow', /^rgba\(0, 0, 0, 0\)/);
    await expect(page.locator('[data-shadow-editor="Box"]')).toContainText('Hidden');
    await button(page, 'Show box shadow 1').click();
    await edit(page, 'Box shadow y', '6'); await edit(page, 'Box shadow blur', '14'); await edit(page, 'Box shadow spread', '2');
    await page.getByRole('checkbox', { name: 'Inset shadow' }).check(); await expect(target).toHaveCSS('box-shadow', /8px 6px 14px 2px inset/);
    await capture(page, '03-selected-box-shadow', 'Box shadow');
    await button(page, 'Remove box shadow 2').click(); await expect(button(page, 'Remove box shadow 2')).toHaveCount(0);
    await action(page, 'Undo last edit'); await expect(button(page, 'Remove box shadow 2')).toBeVisible();
    await openSection(page, 'Text shadow'); await section(page, 'Text shadow').locator('summary').click();
    await expect(page.getByRole('region', { name: 'Text shadow preset browser' }).getByRole('button')).toHaveCount(8);
    await capture(page, '04-text-shadow-presets', 'Text shadow');
    await button(page, 'Text shadow preset Soft').click(); await expect(target).toHaveCSS('text-shadow', /0px 4px 3px/);
    await section(page, 'Text shadow').locator('summary').click(); await button(page, 'Add text shadow').click();
    await edit(page, 'Text shadow x', '2'); await edit(page, 'Text shadow y', '3'); await edit(page, 'Text shadow blur', '4'); await edit(page, 'Text shadow color', '#84d4cf');
    await button(page, 'Move text shadow 2 up').click(); await expect(target).toHaveCSS('text-shadow', /^rgb\(132, 212, 207\) 2px 3px 4px/);
    await button(page, 'Hide text shadow 1').click(); await button(page, 'Show text shadow 1').click();
    await capture(page, '05-selected-text-shadow', 'Text shadow');
    await button(page, 'Remove text shadow 2').click(); await action(page, 'Undo last edit'); await expect(button(page, 'Remove text shadow 2')).toBeVisible();
    await pick(page, '#headline'); await expect(page.locator('#headline')).toHaveCSS('box-shadow', 'none'); await expect(page.locator('#headline')).toHaveCSS('text-shadow', 'none');
    await pick(page, '#checkout'); await expect(target).toHaveCSS('box-shadow', /8px 6px 14px 2px inset/);
    await openSection(page, 'Box shadow'); await page.setViewportSize({ width: 390, height: 844 }); await fits(page);
    await capture(page, '06-narrow-viewport', 'Box shadow');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 }); await fits(page);
      await button(page, 'Box shadow color picker').click(); await fits(page, 'Box'); await page.keyboard.press('Escape');
      await section(page, 'Box shadow').locator('summary').click(); await button(page, 'Box shadow preset Inset Dark').click(); await expect(button(page, 'Box shadow preset Inset Dark')).toHaveAttribute('aria-pressed', 'true'); await fits(page); await section(page, 'Box shadow').locator('summary').click();
    }
    await openSection(page, 'Text shadow'); await page.setViewportSize({ width: 320, height: 844 }); await fits(page);
    await button(page, 'Text shadow color picker').click(); await fits(page, 'Text'); await page.keyboard.press('Escape');
    await section(page, 'Text shadow').locator('summary').click(); await button(page, 'Text shadow preset Glow').click(); await expect(button(page, 'Text shadow preset Glow')).toHaveAttribute('aria-pressed', 'true'); await section(page, 'Text shadow').locator('summary').click();
    await page.setViewportSize({ width: 1440, height: 1000 }); await worker.evaluate(id => chrome.tabs.setZoom(id, 2), tabId);
    await expect.poll(() => worker.evaluate(id => chrome.tabs.getZoom(id), tabId)).toBe(2); await fits(page);
    await edit(page, 'Text shadow blur', '8'); await expect(target).toHaveCSS('text-shadow', /8px/);
    await openSection(page, 'Box shadow'); await edit(page, 'Box shadow blur', '10'); await expect(target).toHaveCSS('box-shadow', /10px/);
    await action(page, 'Reset session edits'); await expect(target).toHaveCSS('box-shadow', 'none'); await expect(target).toHaveCSS('text-shadow', 'none');
    await expect(section(page, 'Box shadow')).toContainText('No box shadow.');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
