import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { browser } from 'wxt/browser';
import { setup, pick, aligned, withinViewport, dock, identity, inspector } from './extensionHarness';
declare const chrome: typeof browser;

async function input(page: Page, label: string, value: string) {
  const control = page.getByRole('textbox', { name: label, exact: true });
  await control.fill(value); await control.press('Enter');
  await expect(control).not.toHaveAttribute('aria-invalid', 'true');
}
async function option(page: Page, label: string, value: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('dialog', { name: label, exact: true }).getByRole('button', { name: value, exact: true }).click();
}
async function sessionAction(page: Page, name: string) {
  await page.getByRole('button', { name: 'Inspector menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Inspector menu', exact: true }).getByRole('button', { name, exact: true }).click();
  await page.keyboard.press('Escape');
}
async function top(page: Page) { await page.getByRole('tabpanel', { name: 'Design', exact: true }).evaluate(el => { el.scrollTop = 0; }); }
async function clean(page: Page) {
  expect(await page.evaluate(() => document.querySelectorAll('style[data-cssforge-edit-layer]').length)).toBe(0);
  expect(await page.locator('main').evaluate(el => [...el.querySelectorAll('*')].some(node => node.getAttributeNames().some(name => name.startsWith('data-cssforge-target-'))))).toBe(false);
}

test('real Design values and reversible spacing, typography, background and border edits; six evidence views', async ({}, info) => {
  const { context, page, errors } = await setup(info);
  try {
    await mkdir('test-results/diagnostics/phase-04', { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1800 });
    await pick(page, '#checkout');
    await page.getByRole('button', { name: 'Select parent', exact: true }).click(); await top(page);
    const target = page.locator('#collection');
    await expect(identity(page)).toHaveText('section#collection.card');
    await expect(page.getByRole('textbox', { name: 'Padding top', exact: true })).toHaveValue('32');
    await expect(page.getByRole('textbox', { name: 'Margin top', exact: true })).toHaveValue('34');
    await expect(page.getByRole('textbox', { name: 'Font size', exact: true })).toHaveValue('21');
    await expect(page.getByRole('button', { name: 'Font family', exact: true })).toHaveText('Georgia');
    await expect(page.getByRole('textbox', { name: 'Background color', exact: true })).toHaveValue('rgb(252, 250, 245)');
    const original = await target.evaluate(el => ({ style: el.getAttribute('style'), attributes: el.getAttributeNames(), padding: getComputedStyle(el).padding, font: getComputedStyle(el).fontSize }));
    if (process.env.CSSFORGE_CAPTURE_PHASE === '04') await page.screenshot({ path: 'test-results/diagnostics/phase-04/01-real-design.png' });
    await input(page, 'Padding top', '48'); await expect(target).toHaveCSS('padding-top', '48px');
    await input(page, 'Padding left', '40'); await expect(target).toHaveCSS('padding-left', '40px');
    await input(page, 'Margin bottom', '50'); await expect(target).toHaveCSS('margin-bottom', '50px');
    await aligned(page, '#collection'); await top(page);
    if (process.env.CSSFORGE_CAPTURE_PHASE === '04') await page.screenshot({ path: 'test-results/diagnostics/phase-04/02-spacing-edit.png' });
    await input(page, 'Font size', '24'); await expect(target).toHaveCSS('font-size', '24px');
    await option(page, 'Font family', 'Arial'); await expect(target).toHaveCSS('font-family', 'Arial');
    await option(page, 'Font weight', '700'); await expect(target).toHaveCSS('font-weight', '700');
    await input(page, 'Line height', '1.6'); await expect(target).toHaveCSS('line-height', '38.4px');
    await input(page, 'Letter spacing', '1.5'); await expect(target).toHaveCSS('letter-spacing', '1.5px');
    await input(page, 'Text color', '#204938'); await expect(target).toHaveCSS('color', 'rgb(32, 73, 56)');
    await page.getByRole('button', { name: 'Align center', exact: true }).click(); await expect(target).toHaveCSS('text-align', 'center');
    await expect(page.getByTestId('selected-font')).toHaveText('Arial 24px');
    await top(page); if (process.env.CSSFORGE_CAPTURE_PHASE === '04') await page.screenshot({ path: 'test-results/diagnostics/phase-04/03-typography-edit.png' });
    await input(page, 'Background color', '#dbe8df'); await expect(target).toHaveCSS('background-color', 'rgb(219, 232, 223)');
    await option(page, 'Border style', 'dashed');
    await input(page, 'Border width', '4'); await expect(target).toHaveCSS('border-top-width', '4px');
    await input(page, 'Border color', '#365b49'); await expect(target).toHaveCSS('border-top-color', 'rgb(54, 91, 73)');
    await input(page, 'Border radius', '20'); await expect(target).toHaveCSS('border-radius', '20px');
    await expect(target).toHaveCSS('border-top-style', 'dashed'); await aligned(page, '#collection');
    await top(page); if (process.env.CSSFORGE_CAPTURE_PHASE === '04') await page.screenshot({ path: 'test-results/diagnostics/phase-04/04-background-border-edit.png' });
    await sessionAction(page, 'Undo last edit'); await expect(target).toHaveCSS('border-radius', '12px');
    await sessionAction(page, 'Reset session edits'); await clean(page);
    await expect(target).toHaveCSS('padding', original.padding); await expect(target).toHaveCSS('font-size', original.font);
    expect(await target.evaluate(el => el.getAttribute('style'))).toBe(original.style);
    expect(await target.evaluate(el => el.getAttributeNames())).toEqual(original.attributes);
    await top(page); if (process.env.CSSFORGE_CAPTURE_PHASE === '04') await page.screenshot({ path: 'test-results/diagnostics/phase-04/05-undo-reset.png' });
    await page.setViewportSize({ width: 375, height: 667 }); await withinViewport(page);
    await input(page, 'Padding top', '20'); await expect(target).toHaveCSS('padding-top', '20px');
    await input(page, 'Font size', '18'); await expect(target).toHaveCSS('font-size', '18px');
    if (process.env.CSSFORGE_CAPTURE_PHASE === '04') await page.screenshot({ path: 'test-results/diagnostics/phase-04/06-narrow.png' });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('geometry, display, opacity, positioning and prior-override undo use real CSS', async ({}, info) => {
  const { context, page, errors } = await setup(info);
  try {
    await pick(page, '#checkout'); const target = page.locator('#checkout');
    await input(page, 'Width', '300'); await expect(target).toHaveCSS('width', '300px');
    await input(page, 'Height', '80'); await expect(target).toHaveCSS('height', '80px'); await aligned(page, '#checkout');
    await input(page, 'Opacity', '60'); await expect(target).toHaveCSS('opacity', '0.6');
    await option(page, 'Position', 'relative'); await expect(target).toHaveCSS('position', 'relative');
    await option(page, 'Display mode', 'flex'); await expect(target).toHaveCSS('display', 'flex');
    await input(page, 'Padding right', '40'); await input(page, 'Padding right', '52');
    await sessionAction(page, 'Undo last edit'); await expect(target).toHaveCSS('padding-right', '40px');
    await sessionAction(page, 'Undo last edit'); await expect(target).toHaveCSS('padding-right', '24px');
    await option(page, 'Display mode', 'none'); await expect(target).toBeHidden();
    await sessionAction(page, 'Undo last edit'); await expect(target).toBeVisible(); await expect(target).toHaveCSS('display', 'flex');
    // Invalid drafts never become declarations or history entries.
    await page.getByRole('textbox', { name: 'Padding left', exact: true }).fill('-5px');
    await expect(page.getByRole('alert')).toContainText('valid padding-left'); await expect(target).toHaveCSS('padding-left', '24px');
    await input(page, 'Padding left', '0'); await expect(target).toHaveCSS('padding-left', '0px');
    await sessionAction(page, 'Reset session edits'); await expect(target).toHaveCSS('opacity', '1'); await clean(page);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('selection isolation, explicit units, author styles, strong replacement migration and full teardown', async ({}, info) => {
  const { context, page, action, errors } = await setup(info);
  try {
    await page.locator('#checkout').evaluate(el => el.setAttribute('style', 'padding-left: 2em; margin-left: 5%; line-height: 24px; --original: untouched;'));
    const original = await page.locator('#checkout').getAttribute('style');
    await pick(page, '#checkout');
    await expect(page.getByRole('textbox', { name: 'Padding left', exact: true })).toHaveValue('2');
    await expect(page.getByRole('button', { name: 'Padding left unit', exact: true })).toHaveText('em');
    await expect(page.getByRole('textbox', { name: 'Margin left', exact: true })).toHaveValue('5');
    await expect(page.getByRole('button', { name: 'Margin left unit', exact: true })).toHaveText('%');
    await expect(page.getByRole('textbox', { name: 'Line height', exact: true })).toHaveValue('24');
    await expect(page.getByRole('button', { name: 'Line height unit', exact: true })).toHaveText('px');
    await input(page, 'Line height', '28px'); await expect(page.locator('#checkout')).toHaveCSS('line-height', '28px');
    await input(page, 'Padding left', '3em'); await expect(page.locator('#checkout')).toHaveCSS('padding-left', '54px');
    await pick(page, '#headline'); await input(page, 'Font size', '36');
    await expect(page.locator('#headline')).toHaveCSS('font-size', '36px'); await expect(page.locator('#checkout')).toHaveCSS('padding-left', '54px');
    await pick(page, '#checkout'); await expect(page.getByRole('textbox', { name: 'Padding left', exact: true })).toHaveValue('3');
    await expect(page.getByRole('button', { name: 'Padding left unit', exact: true })).toHaveText('em');
    await sessionAction(page, 'Undo last edit'); await expect(page.locator('#headline')).toHaveCSS('font-size', '28px');
    await expect(page.locator('#checkout')).toHaveCSS('padding-left', '54px');
    await dock(page).getByRole('button', { name: 'Pick page element' }).click(); await page.keyboard.press('Escape');
    await expect(page.locator('#checkout')).toHaveCSS('padding-left', '54px');
    await page.getByRole('tab', { name: 'Code', exact: true }).click(); await page.getByRole('tab', { name: 'Design', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Padding left', exact: true })).toHaveValue('3');
    await expect(page.getByRole('button', { name: 'Padding left unit', exact: true })).toHaveText('em');
    expect(await page.locator('#checkout').getAttribute('style')).toBe(original);
    await page.locator('#checkout').evaluate(el => { const replacement = document.createElement('button'); replacement.id = 'checkout'; replacement.className = 'primary'; replacement.textContent = 'Replacement'; el.replaceWith(replacement); });
    await page.evaluate(() => dispatchEvent(new Event('resize')));
    await expect(identity(page)).toHaveText('button#checkout.primary'); await expect(page.locator('#checkout')).toHaveCSS('padding-left', '54px');
    expect(await page.locator('#checkout').getAttribute('style')).toBeNull();
    await pick(page, '#checkout'); await input(page, 'Text color', 'rebeccapurple');
    await expect(page.locator('#checkout')).toHaveCSS('color', 'rgb(102, 51, 153)');
    await action(); await expect(inspector(page)).toBeHidden(); await clean(page);
    await expect(page.locator('#checkout')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await action(); await expect(inspector(page)).toBeVisible(); await pick(page, '#checkout');
    await expect(page.getByRole('textbox', { name: 'Text color', exact: true })).toHaveValue('rgb(255, 255, 255)');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('open-shadow editing, inline-important protection and real 200% zoom', async ({}, info) => {
  const { context, page, worker, tabId, errors } = await setup(info);
  try {
    await pick(page, '#shadow-child'); await input(page, 'Font size', '25');
    await expect(page.locator('#shadow-child')).toHaveCSS('font-size', '25px');
    await expect(page.locator('#open-host').locator('style[data-cssforge-edit-layer]')).toHaveCount(1);
    await sessionAction(page, 'Reset session edits'); await expect(page.locator('#shadow-child')).toHaveCSS('font-size', '19px');
    await expect(page.locator('#open-host').locator('style[data-cssforge-edit-layer]')).toHaveCount(0);
    await page.locator('#checkout').evaluate(el => { (el as HTMLElement).style.setProperty('color', 'red', 'important'); });
    await pick(page, '#checkout');
    await page.getByRole('textbox', { name: 'Text color', exact: true }).fill('blue');
    await expect(page.getByRole('alert')).toContainText('inline !important'); await expect(page.locator('#checkout')).toHaveCSS('color', 'rgb(255, 0, 0)');
    await worker.evaluate(id => chrome.tabs.setZoom(id, 2), tabId);
    await expect.poll(() => worker.evaluate(id => chrome.tabs.getZoom(id), tabId)).toBe(2);
    await withinViewport(page); await input(page, 'Padding bottom', '28');
    await expect(page.locator('#checkout')).toHaveCSS('padding-bottom', '28px');
    await option(page, 'Font family', 'Verdana'); await expect(page.locator('#checkout')).toHaveCSS('font-family', 'Verdana');
    await withinViewport(page); await sessionAction(page, 'Reset session edits'); await clean(page);
    await expect(page.locator('#checkout')).toHaveCSS('color', 'rgb(255, 0, 0)');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
