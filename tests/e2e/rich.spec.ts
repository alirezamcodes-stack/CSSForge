import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { browser } from 'wxt/browser';
import { setup, fixture, pick, dock, withinViewport } from './extensionHarness';
declare const chrome: typeof browser;
const richFixture = fixture.replace('</style>', '@media (min-width:1000px){.primary{letter-spacing:0px}} .primary::before{content:"+ ";color:gold} .primary{filter:hue-rotate(15deg)} </style>');
async function input(page: Page, label: string, value: string) {
  const field = page.getByRole('textbox', { name: label, exact: true }); await field.fill(value); await field.press('Enter');
}
async function choice(page: Page, label: string, value: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('dialog', { name: label, exact: true }).getByRole('button', { name: value, exact: true }).click();
}
async function state(page: Page, label: string) { await choice(page, 'State or pseudo', label); await page.keyboard.press('Escape'); }
async function media(page: Page, conditional: boolean) {
  await page.getByRole('button', { name: 'Media', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Media', exact: true });
  await menu.getByRole('button', { name: conditional ? /min-width: 1000px/ : 'Base · all viewports', exact: !conditional }).click();
  await page.keyboard.press('Escape');
}
async function action(page: Page, label: string) {
  await page.getByRole('button', { name: 'Inspector menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Inspector menu', exact: true }).getByRole('button', { name: label }).click();
  await page.keyboard.press('Escape');
}
async function slider(page: Page, label: string, value: string) {
  const control = page.getByRole('slider', { name: label, exact: true }); await control.scrollIntoViewIfNeeded(); await control.focus();
  await control.evaluate((node, next) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; setter.call(node, next); node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })); }, value);
  await control.blur();
}
async function capture(page: Page, name: string, section?: string) {
  if (section) await page.locator(`[data-section="${section}"]`).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/screenshots/phase-05/${name}.png` });
}

test('proven media and actual pseudo rules stay separate and reversible', async ({}, info) => {
  const { context, page, errors } = await setup(info, richFixture);
  try {
    await mkdir('artifacts/screenshots/phase-05', { recursive: true });
    await pick(page, '#checkout'); const target = page.locator('#checkout');
    await input(page, 'Background color', '#123456');
    await page.getByRole('button', { name: 'Media', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Media', exact: true })).toContainText('(min-width: 1000px)');
    await capture(page, '01-media'); await page.keyboard.press('Escape');
    await media(page, true); await input(page, 'Background color', '#abcdef'); await expect(target).toHaveCSS('background-color', 'rgb(171, 205, 239)');
    await page.setViewportSize({ width: 950, height: 900 }); await expect(target).toHaveCSS('background-color', 'rgb(18, 52, 86)');
    await media(page, false); await expect(page.getByRole('textbox', { name: 'Background color', exact: true })).toHaveValue('#123456');
    await page.setViewportSize({ width: 1440, height: 900 });
    await state(page, ':hover'); await input(page, 'Text color', '#ff0000');
    await expect(target).toHaveCSS('color', 'rgb(255, 255, 255)');
    await target.hover(); await expect(target).toHaveCSS('color', 'rgb(255, 0, 0)');
    await media(page, true); await input(page, 'Text color', '#0000ff');
    await target.hover(); await expect(target).toHaveCSS('color', 'rgb(0, 0, 255)');
    await page.setViewportSize({ width: 950, height: 900 }); await target.hover(); await expect(target).toHaveCSS('color', 'rgb(255, 0, 0)');
    await media(page, false); await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'State or pseudo', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'State or pseudo', exact: true })).toContainText('no forcing');
    await capture(page, '02-state'); await page.keyboard.press('Escape');
    await state(page, '::before'); await input(page, 'Text color', '#00ff00');
    expect(await target.evaluate(el => getComputedStyle(el, '::before').color)).toBe('rgb(0, 255, 0)');
    await state(page, ':focus'); await input(page, 'Opacity', '60'); await target.focus(); await expect(target).toHaveCSS('opacity', '0.6');
    await action(page, 'Reset session edits'); await expect(target).toHaveCSS('background-color', 'rgb(41, 76, 59)');
    expect(await target.evaluate(el => getComputedStyle(el, '::before').color)).toBe('rgb(255, 215, 0)');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('a burst of filter input events performs at most one selected-style refresh per frame', async ({}, info) => {
  const { context, page, errors } = await setup(info, richFixture);
  try {
    await pick(page, '#checkout');
    const slider = page.getByRole('slider', { name: 'Blur', exact: true }); await slider.scrollIntoViewIfNeeded(); await slider.focus();
    const cdp = await context.newCDPSession(page);
    const worlds: { id: number; origin: string }[] = [];
    cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context)); await cdp.send('Runtime.enable');
    const world = worlds.find(item => item.origin.startsWith('chrome-extension://'))!;
    await cdp.send('Runtime.evaluate', { contextId: world.id, expression: `globalThis.__cssforgeTestReads = 0; globalThis.__cssforgeOriginalComputed = window.getComputedStyle; window.getComputedStyle = function(element, pseudo) { if (element.id === 'checkout') globalThis.__cssforgeTestReads++; return globalThis.__cssforgeOriginalComputed.call(window, element, pseudo); };` });
    await slider.evaluate(node => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; for (let i = 1; i <= 100; i++) { setter.call(node, String(i / 10)); node.dispatchEvent(new Event('input', { bubbles: true })); } });
    await expect(page.locator('#checkout')).toHaveCSS('filter', 'hue-rotate(15deg) blur(10px)');
    const { result } = await cdp.send('Runtime.evaluate', { contextId: world.id, expression: 'globalThis.__cssforgeTestReads' });
    expect(result.value).toBe(1);
    await cdp.send('Runtime.evaluate', { contextId: world.id, expression: 'window.getComputedStyle = globalThis.__cssforgeOriginalComputed' });
    await action(page, 'Undo last edit'); await expect(page.locator('#checkout')).toHaveCSS('filter', 'hue-rotate(15deg)');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('background layers, gradients, URLs and companion lists apply real atomic edits', async ({}, info) => {
  const { context, page, errors } = await setup(info, richFixture);
  try {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await pick(page, '#checkout'); const target = page.locator('#checkout');
    await page.getByRole('button', { name: 'Add background layer', exact: true }).click();
    await input(page, 'Gradient direction', '90deg'); await input(page, 'Stop 1 color', '#ff0000'); await input(page, 'Stop 2 position', '85%');
    await expect(target).toHaveCSS('background-image', /linear-gradient\(90deg, rgb\(255, 0, 0\)/);
    await page.getByRole('button', { name: 'Add gradient stop', exact: true }).click(); await expect(page.getByRole('textbox', { name: 'Stop 3 color' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove gradient stop 3' }).click();
    await page.getByRole('button', { name: 'Add background layer', exact: true }).click();
    await choice(page, 'Background layer type', 'radial'); await input(page, 'Gradient shape / position', 'circle at center');
    await input(page, 'Background size', '80% 90%'); await choice(page, 'Background repeat', 'no-repeat');
    await page.getByRole('button', { name: 'Move background layer 2 up' }).click();
    await expect(target).toHaveCSS('background-image', /^radial-gradient/); await expect(target).toHaveCSS('background-size', /^80% 90%/);
    await page.getByRole('button', { name: 'Hide background layer 1' }).click(); await expect(target).toHaveCSS('background-image', /^linear-gradient\(rgba\(0, 0, 0, 0\)/);
    await page.getByRole('button', { name: 'Show background layer 1' }).click(); await expect(target).toHaveCSS('background-image', /^radial-gradient/);
    await capture(page, '03-background-gradient', 'Background');
    await page.getByRole('button', { name: 'Remove background layer 2' }).click();
    await expect(target).toHaveCSS('background-image', /^radial-gradient/);
    await choice(page, 'Background layer type', 'Image URL');
    await input(page, 'Image URL', 'javascript:alert(1)'); await expect(page.getByRole('alert')).toContainText('HTTP(S)');
    await page.route('**/test-image.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="blue"/></svg>' }));
    await input(page, 'Image URL', 'http://127.0.0.1:5173/test-image.svg'); await expect(target).toHaveCSS('background-image', /test-image.svg/);
    await action(page, 'Undo last edit'); await expect(target).toHaveCSS('background-image', /^radial-gradient/);
    await action(page, 'Reset session edits'); await expect(target).toHaveCSS('background-image', 'none'); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('shadow presets and multiple shadows share undo and isolate targets', async ({}, info) => {
  const { context, page, errors } = await setup(info, richFixture);
  try {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await pick(page, '#checkout'); const target = page.locator('#checkout');
    await page.getByRole('button', { name: 'Box shadow preset 1', exact: true }).click(); await expect(target).toHaveCSS('box-shadow', /12px 22px/);
    await input(page, 'Box shadow x', '8'); await input(page, 'Box shadow spread', '3'); await input(page, 'Box shadow color', '#143322');
    await page.getByRole('checkbox', { name: 'Inset shadow' }).check(); await expect(target).toHaveCSS('box-shadow', /8px 12px 22px 3px inset/);
    await capture(page, '04-box-shadow', 'Box shadow');
    await page.getByRole('button', { name: 'Add box shadow', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove box shadow 2', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Remove box shadow 2', exact: true }).click();
    await page.getByRole('button', { name: 'Text shadow preset 2', exact: true }).click();
    await input(page, 'Text shadow y', '2'); await input(page, 'Text shadow color', '#ff0000'); await expect(target).toHaveCSS('text-shadow', 'rgb(255, 0, 0) 0px 2px 3px');
    await capture(page, '05-text-shadow', 'Text shadow');
    await page.getByRole('button', { name: 'Add text shadow', exact: true }).click();
    await page.getByRole('button', { name: 'Remove text shadow 2', exact: true }).click();
    await pick(page, '#headline'); await input(page, 'Background color', '#eeeeee'); await expect(page.locator('#headline')).toHaveCSS('box-shadow', 'none');
    await pick(page, '#checkout'); await expect(page.getByRole('textbox', { name: 'Box shadow x', exact: true })).toHaveValue('8px');
    await expect(target).toHaveCSS('text-shadow', 'rgb(255, 0, 0) 0px 2px 3px');
    await action(page, 'Reset session edits'); await expect(target).toHaveCSS('box-shadow', 'none'); await expect(target).toHaveCSS('text-shadow', 'none');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('filters preserve unsupported functions, work at narrow/200% and clean up completely', async ({}, info) => {
  const { context, page, worker, tabId, action: toggle, errors } = await setup(info, richFixture);
  try {
    await pick(page, '#checkout'); const target = page.locator('#checkout');
    await slider(page, 'Blur', '2'); await slider(page, 'Contrast', '130'); await slider(page, 'Sepia', '25');
    await expect(target).toHaveCSS('filter', 'hue-rotate(15deg) blur(2px) contrast(1.3) sepia(0.25)');
    await capture(page, '06-filters', 'Filters');
    await action(page, 'Undo last edit'); await expect(target).toHaveCSS('filter', 'hue-rotate(15deg) blur(2px) contrast(1.3)');
    await page.setViewportSize({ width: 375, height: 667 }); await withinViewport(page);
    await slider(page, 'Brightness', '120'); await expect(target).toHaveCSS('filter', /brightness\(1.2\)/); await capture(page, '07-narrow', 'Filters');
    await page.setViewportSize({ width: 1440, height: 900 });
    await worker.evaluate(id => chrome.tabs.setZoom(id, 2), tabId); await expect.poll(() => worker.evaluate(id => chrome.tabs.getZoom(id), tabId)).toBe(2);
    await withinViewport(page); await slider(page, 'Saturate', '150'); await expect(target).toHaveCSS('filter', /saturate\(1.5\)/);
    await toggle(); await expect(page.locator('cssforge-ui')).toHaveCount(0); await expect(target).toHaveCSS('filter', 'hue-rotate(15deg)');
    expect(await page.evaluate(() => document.querySelectorAll('style[data-cssforge-edit-layer]').length)).toBe(0);
    expect(await target.evaluate(el => el.getAttributeNames().some(name => name.startsWith('data-cssforge-target-')))).toBe(false);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
