import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { browser } from 'wxt/browser';
import { setup, fixture, pick, identity, withinViewport, aligned } from './extensionHarness';
declare const chrome: typeof browser;
const codeFixture = fixture.replace('<head>', '<head><meta charset="utf-8">').replace('</style>', `
.primary{letter-spacing:1px;animation-name:gentle;animation-duration:2s;animation-play-state:paused}
@media (min-width:1000px){.primary:hover{color:rgb(220,120,40)}.primary::before{content:"↗ ";color:gold}}
@keyframes gentle{from{opacity:.9}to{opacity:1}}
</style><link rel="stylesheet" href="http://styles.test/author.css">`).replace('id="checkout"', 'id="checkout" style="font-size:18px; border-radius:6px"');
async function launch(info: Parameters<typeof setup>[0]) {
  return setup(info, codeFixture, async page => { await page.route('http://styles.test/author.css', route => route.fulfill({ contentType: 'text/css', body: '.primary{outline-offset:2px}' })); });
}
const code = (page: Page) => page.getByTestId('live-code');
const own = (page: Page) => code(page).getByRole('region', { name: 'CSSForge overrides', exact: true });
async function edit(row: Locator, property: string, value: string) {
  await row.getByRole('button', { name: `Edit ${property}`, exact: true }).click();
  const input = row.getByRole('textbox', { name: `CSS value ${property}`, exact: true });
  await input.fill(value); await input.press('Enter');
}
async function shot(page: Page, name: string) {
  if (process.env.CSSFORGE_CAPTURE_PHASE !== '06') return;
  await mkdir('artifacts/screenshots/phase-06', { recursive: true });
  await page.screenshot({ path: `artifacts/screenshots/phase-06/${name}.png` });
}
test('Code shows authored sources and safely edits, validates, toggles, undoes and resets', async ({}, info) => {
  const { page, context, errors, action } = await launch(info);
  try {
    await pick(page, '#checkout'); await page.getByRole('tab', { name: 'Code', exact: true }).click();
    await expect(code(page)).toContainText('Inaccessible stylesheet: http://styles.test/author.css');
    await expect(code(page).getByRole('region', { name: 'Readable matching CSS' })).toContainText('letter-spacing');
    await expect(code(page).getByRole('region', { name: 'Readable keyframes' })).toContainText('@keyframes gentle');
    const inline = code(page).getByRole('region', { name: 'Inline authored CSS' });
    await expect(inline).toContainText('18px');
    await expect(inline.getByRole('checkbox').first()).toBeDisabled();
    await shot(page, '01-real-code');
    await edit(inline, 'font-size', '26px');
    await expect(page.locator('#checkout')).toHaveCSS('font-size', '26px');
    await expect(own(page)).toContainText('26px');
    await expect(page.locator('#checkout')).toHaveAttribute('style', 'font-size:18px; border-radius:6px');
    await shot(page, '03-real-inline-edit');
    await edit(own(page), 'font-size', 'broken-value');
    await expect(own(page).getByRole('alert').first()).toContainText('Enter a valid font-size value.');
    await expect(page.locator('#checkout')).toHaveCSS('font-size', '26px');
    await shot(page, '04-invalid-css');
    const input = own(page).getByRole('textbox', { name: 'CSS value font-size' });
    await input.fill('30px'); await input.press('Enter'); await expect(page.locator('#checkout')).toHaveCSS('font-size', '30px');
    const toggle = own(page).getByRole('checkbox', { name: 'Toggle override font-size' });
    await toggle.uncheck(); await expect(page.locator('#checkout')).toHaveCSS('font-size', '18px');
    await own(page).getByRole('button', { name: 'Undo last edit' }).click(); await expect(page.locator('#checkout')).toHaveCSS('font-size', '30px');
    await toggle.uncheck(); await toggle.check(); await expect(page.locator('#checkout')).toHaveCSS('font-size', '30px');
    await own(page).getByRole('button', { name: 'Reset session edits' }).click(); await expect(page.locator('#checkout')).toHaveCSS('font-size', '18px');
    await own(page).getByRole('button', { name: 'Add session declaration' }).click();
    await own(page).getByRole('textbox', { name: 'CSS property', exact: true }).fill('unsupported-property');
    await own(page).getByRole('textbox', { name: 'New CSS value' }).fill('red');
    await own(page).getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(own(page).getByRole('alert').first()).toContainText('Enter a valid unsupported-property value');
    await own(page).getByRole('textbox', { name: 'CSS property', exact: true }).fill('color');
    await own(page).getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.locator('#checkout')).toHaveCSS('color', 'rgb(255, 0, 0)');
    await action(); await expect(page.locator('cssforge-ui')).toHaveCount(0);
    await expect(page.locator('style[data-cssforge-edit-layer]')).toHaveCount(0);
    expect(await page.locator('#checkout').evaluate(node => node.getAttributeNames().filter(name => name.startsWith('data-cssforge-target')))).toEqual([]);
    await expect(page.locator('#checkout')).toHaveCSS('color', 'rgb(255, 255, 255)'); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('Code media and pseudo edits retain their conditions and readable source refresh is explicit', async ({}, info) => {
  const { page, context, errors } = await launch(info);
  try {
    await pick(page, '#checkout'); await page.getByRole('tab', { name: 'Code', exact: true }).click();
    // Select the compact rule wrapper, not the encompassing source section.
    const hoverRow = code(page).getByRole('region', { name: 'Readable matching CSS' }).locator('[data-property="color"]').nth(1);
    await expect(code(page)).toContainText('@media (min-width: 1000px)');
    await expect(code(page)).toContainText('::before context');
    await hoverRow.scrollIntoViewIfNeeded(); await shot(page, '02-media-pseudo-code');
    await edit(hoverRow, 'color', '#ff0000');
    await expect(own(page)).toContainText(':hover'); await expect(own(page)).toContainText('@media (min-width: 1000px)');
    await page.locator('#checkout').hover(); await expect(page.locator('#checkout')).toHaveCSS('color', 'rgb(255, 0, 0)');
    await page.setViewportSize({ width: 950, height: 900 }); await page.locator('#checkout').hover(); await expect(page.locator('#checkout')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('#checkout')!.style.setProperty('text-align', 'left'));
    await code(page).getByRole('button', { name: 'Refresh sources' }).click();
    await expect(code(page).getByRole('region', { name: 'Inline authored CSS' })).toContainText('text-align');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('HTML and Navigator select real parents, children, siblings and open shadow nodes', async ({}, info) => {
  const { page, context, errors } = await launch(info);
  try {
    await pick(page, '#checkout'); await page.getByRole('tab', { name: 'HTML', exact: true }).click();
    let tree = page.getByRole('tree', { name: 'Page DOM tree' });
    await expect(tree.getByRole('treeitem', { selected: true })).toHaveAccessibleName('button#checkout.primary');
    await expect(tree).not.toContainText('cssforge');
    await page.getByRole('button', { name: 'Previous sibling', exact: true }).click(); await expect(identity(page)).toHaveText('p');
    await page.getByRole('button', { name: 'Next sibling', exact: true }).click(); await expect(identity(page)).toHaveText('button#checkout.primary');
    await page.getByRole('button', { name: 'Parent', exact: true }).click(); await expect(identity(page)).toHaveText('section#collection.card');
    await page.getByRole('button', { name: 'Child', exact: true }).click(); await expect(identity(page)).toHaveText('h2#headline');
    await tree.getByRole('treeitem', { name: /button#checkout.primary/ }).click(); await aligned(page, '#checkout');
    await page.getByRole('button', { name: 'Open Navigator', exact: true }).first().click();
    const navigator = page.getByRole('dialog', { name: 'Navigator', exact: true }); tree = navigator.getByRole('tree');
    await shot(page, '05-real-html-navigator');
    await tree.getByRole('treeitem', { name: /h2#headline/ }).click(); await expect(identity(page)).toHaveText('h2#headline');
    await shot(page, '06-dom-navigation-selection');
    await navigator.getByRole('button', { name: 'Back to canvas' }).click(); await expect(navigator).toHaveCount(0);
    await pick(page, '#shadow-child'); await expect(tree).toHaveCount(0);
    const htmlTree = page.getByRole('tree'); await expect(htmlTree).toContainText('#shadow-root (open)');
    await page.getByRole('button', { name: 'Parent', exact: true }).click(); await expect(identity(page)).toHaveText('div#open-host');
    await page.getByRole('button', { name: 'Next sibling', exact: true }).click(); await expect(identity(page)).toHaveText('div#closed-host');
    await expect(page.getByRole('button', { name: 'Child', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Open Navigator', exact: true }).first().click(); await navigator.getByRole('button', { name: 'Pick element', exact: true }).click();
    await page.locator('#headline').click(); await expect(identity(page)).toHaveText('h2#headline'); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('Code and lazy HTML remain bounded at narrow width and actual 200% tab zoom', async ({}, info) => {
  const { page, context, worker, tabId, errors } = await launch(info);
  try {
    await page.evaluate(() => { const container = document.createElement('div'); container.id = 'large-branch'; for (let i = 0; i < 5000; i++) { const node = document.createElement('span'); node.textContent = `Node ${i}`; container.append(node); } document.querySelector('main')!.append(container); });
    await pick(page, '#checkout'); await page.getByRole('tab', { name: 'HTML', exact: true }).click();
    expect(await page.getByRole('treeitem').count()).toBeLessThan(180);
    await page.getByRole('treeitem', { name: /div#large-branch/ }).click();
    expect(await page.getByRole('treeitem').count()).toBeLessThan(180);
    await expect(page.getByRole('tabpanel', { name: 'HTML' })).toContainText('bounded branch');
    await page.getByRole('button', { name: 'Collapse div#large-branch', exact: true }).click();
    await expect(page.getByRole('tree')).not.toContainText('Node 0');
    await pick(page, '#checkout'); await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: 'Code', exact: true }).click(); await withinViewport(page); await shot(page, '07-narrow-viewport');
    expect(await code(page).evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await worker.evaluate(async id => chrome.tabs.setZoom(id, 2), tabId);
    await expect.poll(() => worker.evaluate(async id => chrome.tabs.getZoom(id), tabId)).toBe(2);
    await withinViewport(page); await page.getByRole('tab', { name: 'HTML', exact: true }).click();
    await page.getByRole('button', { name: 'Open Navigator', exact: true }).first().click();
    const bounds = (await page.getByRole('dialog', { name: 'Navigator', exact: true }).boundingBox())!;
    const viewport = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.w + 1); expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.h + 1); expect(errors).toEqual([]);
  } finally { await context.close(); }
});
