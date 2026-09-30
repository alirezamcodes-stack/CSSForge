import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { setup, pick, aligned, identity } from './extensionHarness';

const fixture = (await readFile('tests/e2e/fixtures/selection-audit.html', 'utf8')).replace('<cssforge-ui></cssforge-ui>', '');
async function launch(info: Parameters<typeof setup>[0]) {
  return setup(info, fixture, async page => {
    await page.route('http://frames.test/selection-audit-frame.html', route => route.fulfill({ contentType: 'text/html', body: '<button>Frame</button>' }));
  });
}
async function field(page: Page, name: string, value: string) {
  const input = page.getByRole('textbox', { name, exact: true }); await input.fill(value); await input.press('Enter');
}

test('built B2 B4 B6 B7: movement root transforms SVG sizing and tiny geometry', async ({}, info) => {
  const { page, context, errors } = await launch(info);
  try {
    await pick(page, '#absolute'); await aligned(page, '#absolute'); await page.waitForTimeout(100);
    await page.locator('#absolute').evaluate(node => { (node as HTMLElement).style.left = '100px'; }); await aligned(page, '#absolute');
    await page.locator('#absolute').evaluate(node => { (node as HTMLElement).style.transform = 'translate(50px,15px)'; }); await aligned(page, '#absolute');
    await page.locator('main').evaluate(node => { (node as HTMLElement).style.transform = 'translate(15px,10px)'; }); await aligned(page, '#absolute');
    await page.evaluate(() => { document.documentElement.style.transform = 'translate(30px,20px) scale(.9)'; }); await aligned(page, '#absolute');
    await page.evaluate(() => { document.documentElement.style.transform = ''; (document.querySelector('main') as HTMLElement).style.transform = ''; }); await aligned(page, '#absolute');
    await pick(page, '#svg-rect'); await field(page, 'Width', '80'); await field(page, 'Height', '50');
    expect(await page.locator('#svg-rect').evaluate(node => ({ width: (node as SVGRectElement).getBBox().width, height: (node as SVGRectElement).getBBox().height }))).toEqual({ width: 80, height: 50 });
    await aligned(page, '#svg-rect');
    await pick(page, '#tiny'); await aligned(page, '#tiny');
    const box = await page.getByTestId('target-outline').boundingBox(); expect(box!.width).toBe(1); expect(box!.height).toBe(1);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('built B1 B3 B5: clone containment zero-size removal and root loss clear Design and Code', async ({}, info) => {
  const { page, context, errors, action } = await launch(info);
  try {
    await pick(page, '#absolute'); await field(page, 'Font size', '31'); await expect(page.locator('#absolute')).toHaveCSS('font-size', '31px');
    await page.evaluate(() => { const old = document.querySelector('#absolute')!, copy = old.cloneNode(true) as HTMLElement; copy.id = 'copy'; copy.style.left = '650px'; document.body.append(copy); });
    await expect(page.locator('#copy')).toHaveCSS('font-size', '16px'); await expect(page.locator('#absolute')).toHaveCSS('font-size', '31px');
    await page.getByRole('tab', { name: 'Code', exact: true }).click(); await expect(page.getByTestId('live-code')).toBeVisible();
    await page.evaluate(() => document.querySelector('#open-host')!.shadowRoot!.append(document.querySelector('#absolute')!));
    await expect(identity(page)).toHaveText('No element selected'); await expect(page.getByTestId('live-code')).toHaveCount(0);
    await expect(page.getByTestId('live-design')).toHaveCount(0); await expect(page.getByTestId('target-outline')).toBeHidden();
    expect(await page.locator('style[data-cssforge-edit-layer]').count()).toBe(0);
    // Conservative root policy still permits an explicit fresh pick in the new open root.
    await pick(page, '#absolute'); await expect(identity(page)).toHaveText('div#absolute.box');
    await page.getByRole('tab', { name: 'Design', exact: true }).click(); await expect(page.getByTestId('live-design')).toBeVisible();
    await pick(page, '#zero-host'); await page.getByRole('button', { name: 'Select child', exact: true }).click(); await expect(identity(page)).toHaveText('div#zero');
    await expect(page.getByTestId('target-outline')).toBeHidden(); await page.waitForTimeout(100);
    await page.locator('#zero').evaluate(node => node.remove());
    await expect(identity(page)).toHaveText('No element selected'); await expect(page.getByTestId('live-design')).toHaveCount(0);
    await action(); await expect(page.locator('cssforge-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
