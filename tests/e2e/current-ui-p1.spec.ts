import { test, expect, type Page, type Locator, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { setup, fixture, pick, inspector, dock, identity, aligned, withinViewport } from './extensionHarness';
import { feedbackPaintComparison, feedbackRasterBounds } from './paintOrder';

const evidence = 'artifacts/diagnostics/current-ui-p1';
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });
async function edit(page: Page, name: string, value: string) { await field(page, name).fill(value); await field(page, name).press('Enter'); }
async function shot(page: Page, name: string) { await mkdir(evidence, { recursive: true }); await page.mouse.move(0, 0); await page.screenshot({ path: `${evidence}/${name}.png`, animations: 'disabled', caret: 'hide' }); }
async function save(info: TestInfo, observations: unknown) { await mkdir(evidence, { recursive: true }); const file = `${evidence}/${info.title.split(' ')[0]}.json`; await writeFile(file, JSON.stringify({ test: info.title, observations }, null, 2)); await info.attach('P1 regression', { path: file, contentType: 'application/json' }); }
async function zoom(r: Awaited<ReturnType<typeof setup>>, factor: number) {
  await r.worker.evaluate(async ({ id, value }) => { await (globalThis as any).chrome.tabs.setZoom(id, value); }, { id: r.tabId, value: factor });
  await expect.poll(() => r.worker.evaluate(async id => (globalThis as any).chrome.tabs.getZoom(id), r.tabId)).toBe(factor);
}
async function reachable(control: Locator) {
  await expect(control).toBeVisible();
  await control.scrollIntoViewIfNeeded();
  await expect.poll(() => control.evaluate(node => {
    const r = node.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const root = node.getRootNode() as ShadowRoot;
    const hit = root.elementFromPoint(x, y);
    return document.elementFromPoint(x, y) === root.host && (hit === node || node.contains(hit));
  })).toBe(true);
}
async function popupFits(popup: Locator) {
  await expect.poll(() => popup.evaluate(node => {
    const r = node.getBoundingClientRect();
    return r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && node.scrollWidth <= node.clientWidth + 1;
  })).toBe(true);
}
async function closeSections(page: Page, open: string) {
  for (const section of await page.locator('[data-section]').all()) {
    const name = (await section.getAttribute('data-section'))!;
    const toggle = section.getByRole('button', { name, exact: true });
    if (await toggle.getAttribute('aria-expanded') !== String(name === open)) await toggle.click();
  }
}

for (const root of ['html', 'body'] as const) for (const [kind, transform] of [
  ['translate', 'translate(30px,20px)'], ['scale', 'scale(.9)'], ['combined', 'translate(30px,20px) scale(.9)'],
] as const) test(`UI01-${root}-${kind} viewport hosting, scrolling, drag, narrow view and native zoom`, async ({}, info) => {
  test.setTimeout(120000);
  const r = await setup(info), observations: unknown[] = [];
  try {
    await pick(r.page, '#checkout');
    const appliedTransform = await r.page.evaluate(({ root, transform }) => { const node = root === 'html' ? document.documentElement : document.body; node.style.transform = transform; return node.style.transform; }, { root, transform });
    await expect(r.page.locator('cssforge-ui')).toHaveJSProperty('popover', 'manual');
    expect(await r.page.locator('cssforge-ui').evaluate(node => node.matches(':popover-open'))).toBe(true);
    for (const factor of [1, 1.25, 1.5, 2]) {
      await zoom(r, factor); await withinViewport(r.page); await aligned(r.page, '#checkout');
      const handle = r.page.getByRole('group', { name: 'Move inspector', exact: true });
      await handle.focus(); await handle.press('ArrowLeft'); await withinViewport(r.page); await handle.press('Home');
      await reachable(button(r.page, 'Inspector menu')); await button(r.page, 'Inspector menu').click();
      await popupFits(r.page.getByRole('dialog', { name: 'Inspector menu', exact: true })); await r.page.keyboard.press('Escape');
      const measurement = dock(r.page).getByRole('button', { name: 'Measurement tools', exact: true });
      await reachable(measurement); await measurement.click(); await popupFits(r.page.getByRole('dialog', { name: 'Measurement tools', exact: true })); await r.page.keyboard.press('Escape');
      const before = await inspector(r.page).boundingBox(); await r.page.evaluate(() => scrollTo(0, 160)); await withinViewport(r.page); await aligned(r.page, '#checkout');
      expect(await inspector(r.page).boundingBox()).toEqual(before);
      const h = (await handle.boundingBox())!;
      await r.page.mouse.move(h.x + 60, h.y + 12); await r.page.mouse.down(); await r.page.mouse.move(-80, -80, { steps: 4 }); await r.page.mouse.up(); await withinViewport(r.page); await handle.focus(); await handle.press('Home');
      observations.push({ factor, viewport: await r.page.evaluate(() => [innerWidth, innerHeight]), panel: await inspector(r.page).boundingBox(), dock: await dock(r.page).boundingBox(), target: await r.page.locator('#checkout').boundingBox() });
      await r.page.evaluate(() => scrollTo(0, 0));
    }
    await zoom(r, 1); await r.page.setViewportSize({ width: 390, height: 480 }); await withinViewport(r.page);
    for (const surface of ['Changes', 'Navigator']) {
      await dock(r.page).getByRole('button', { name: `Open ${surface}`, exact: true }).click();
      const modal = r.page.getByRole('dialog', { name: surface, exact: true }); await popupFits(modal); await reachable(modal.getByRole('button', { name: `Close ${surface}`, exact: true })); await r.page.keyboard.press('Escape');
    }
    expect(await r.page.evaluate(root => (root === 'html' ? document.documentElement : document.body).style.transform, root)).toBe(appliedTransform);
    if (kind === 'combined') await shot(r.page, `UI01-${root}-narrow`);
    expect(r.errors).toEqual([]); await save(info, observations);
  } finally { await r.context.close(); }
});

test('UI01-cold activation on an already transformed html and body preserves host geometry and picking', async ({}, info) => {
  const r = await setup(info, fixture.replace('</style>', 'html{transform:translate(30px,20px) scale(.9)}body{transform:translate(10px,5px) scale(.95)}</style>'));
  try {
    await withinViewport(r.page); await pick(r.page, '#checkout'); await aligned(r.page, '#checkout');
    await reachable(button(r.page, 'Inspector menu')); await button(r.page, 'Inspector menu').click(); await popupFits(r.page.getByRole('dialog', { name: 'Inspector menu', exact: true })); await r.page.keyboard.press('Escape');
    const transforms = await r.page.evaluate(() => [getComputedStyle(document.documentElement).transform, getComputedStyle(document.body).transform]);
    expect(transforms.every(value => value !== 'none')).toBe(true); expect(r.errors).toEqual([]); await save(info, { transforms, hostGeometryPreservedByHarness: true, pickingAccurate: true });
  } finally { await r.context.close(); }
});

test('UI02 hostile maximum-z-index overlay leaves inspector dock popovers and modals operable', async ({}, info) => {
  const r = await setup(info, fixture.replace('</style>', 'button,input{font:48px cursive!important;color:red!important;border:14px solid red!important}</style>'));
  try {
    await pick(r.page, '#checkout'); await edit(r.page, 'Font size', '27px');
    await r.page.evaluate(() => { const cover = document.createElement('div'); cover.id = 'host-cover'; Object.assign(cover.style, { position: 'fixed', inset: '0', zIndex: '2147483647', background: '#c81e1e26' }); document.body.append(cover); });
    await reachable(field(r.page, 'Font size')); await edit(r.page, 'Font size', '29px'); await expect(r.page.locator('#checkout')).toHaveCSS('font-size', '29px');
    await button(r.page, 'Text color picker').click(); const color = r.page.getByRole('dialog', { name: 'Text color picker', exact: true }); await popupFits(color);
    expect(await color.getByRole('button', { name: 'HEX', exact: true }).evaluate(node => getComputedStyle(node).boxShadow)).toContain('-2px');
    await reachable(field(r.page, 'Text color HEX')); await edit(r.page, 'Text color HEX', '#123456'); await r.page.keyboard.press('Escape');
    await dock(r.page).getByRole('button', { name: 'Measurement tools', exact: true }).click(); await expect(r.page.getByRole('dialog', { name: 'Measurement tools', exact: true })).toBeVisible(); await r.page.keyboard.press('Escape');
    for (const surface of ['Changes', 'Navigator']) {
      const opener = dock(r.page).getByRole('button', { name: `Open ${surface}`, exact: true }); await reachable(opener); await opener.click();
      const modal = r.page.getByRole('dialog', { name: surface, exact: true }); await popupFits(modal);
      const close = modal.getByRole('button', { name: `Close ${surface}`, exact: true }); await reachable(close); await close.click(); await expect(opener).toBeFocused();
    }
    await expect(r.page.locator('#host-cover')).toHaveCSS('z-index', '2147483647');
    await expect(dock(r.page).getByRole('button', { name: 'Measurement tools', exact: true })).toHaveCSS('font-size', '13px');
    await shot(r.page, 'UI02-hostile-overlay'); expect(r.errors).toEqual([]); await save(info, { coverUnchanged: true, inspectorEdit: '29px', colorEdit: '#123456', focusRestored: true });
  } finally { await r.context.close(); }
});

for (const [name, width, height, factor] of [['normal', 1440, 900, 1], ['narrow', 390, 844, 1], ['zoom200', 1440, 900, 2]] as const) test(`UI03-${name} feedback paints behind inspector dock color unit Changes and Navigator`, async ({}, info) => {
  test.setTimeout(90000); const r = await setup(info), comparisons: unknown[] = [];
  const compare = async (control: Locator, label: string) => { comparisons.push(await feedbackPaintComparison(r.page, control, info, label)); };
  try {
    await pick(r.page, '#checkout'); await r.page.setViewportSize({ width, height }); await zoom(r, factor); await withinViewport(r.page);
    await compare(inspector(r.page), 'inspector');
    await compare(dock(r.page).getByRole('button', { name: 'Open Changes', exact: true }), 'dock');
    await button(r.page, 'Text color picker').click(); const color = r.page.getByRole('dialog', { name: 'Text color picker', exact: true }); await popupFits(color); await compare(color, 'color-popup'); await r.page.keyboard.press('Escape');
    await closeSections(r.page, 'Spacing'); await edit(r.page, 'Margin top', '16px'); await button(r.page, 'Margin top unit').click(); const units = r.page.getByRole('dialog', { name: 'Margin top unit', exact: true }); await popupFits(units); await compare(units, 'spacing-units'); await reachable(units.getByRole('button', { name: 'em', exact: true })); await r.page.keyboard.press('Escape');
    for (const surface of ['Changes', 'Navigator']) { await dock(r.page).getByRole('button', { name: `Open ${surface}`, exact: true }).click(); await compare(r.page.getByRole('dialog', { name: surface, exact: true }), surface); await r.page.keyboard.press('Escape'); }
    await r.page.evaluate(() => { const cover = document.createElement('div'); cover.id = 'host-cover'; Object.assign(cover.style, { position: 'fixed', inset: '0', zIndex: '2147483647', background: '#ff000022' }); document.body.append(cover); });
    await compare(inspector(r.page), 'hostile-inspector'); await reachable(button(r.page, 'Inspector menu')); await shot(r.page, `UI03-${name}-feedback-order`); expect(r.errors).toEqual([]); await save(info, { pixelComparisonsPassed: 7, factor, width, height, comparisons, bounds: feedbackRasterBounds });
  } finally { await r.context.close(); }
});

for (const [name, width, height, factor] of [['normal', 1440, 900, 1], ['narrow', 320, 480, 1], ['zoom200', 1440, 900, 2]] as const) test(`DA01-${name} every spacing side and enabled unit accepts native pointer clicks`, async ({}, info) => {
  test.setTimeout(180000); const r = await setup(info), observations: unknown[] = [];
  try {
    await pick(r.page, '#checkout'); await r.page.setViewportSize({ width, height }); await zoom(r, factor); await closeSections(r.page, 'Spacing');
    for (const type of ['Margin', 'Padding']) for (const side of ['top', 'right', 'bottom', 'left']) {
      const label = `${type} ${side}`, property = `${type.toLowerCase()}-${side}`;
      await edit(r.page, label, '16px'); const trigger = button(r.page, `${label} unit`); await trigger.click();
      const menu = r.page.getByRole('dialog', { name: `${label} unit`, exact: true }); await popupFits(menu);
      const units = await menu.getByRole('button').evaluateAll(nodes => nodes.filter(node => !(node as HTMLButtonElement).disabled).map(node => node.textContent!.trim())); await r.page.keyboard.press('Escape');
      for (const unit of units) {
        await edit(r.page, label, '16px'); await trigger.click(); const option = menu.getByRole('button', { name: unit, exact: true }); await reachable(option); await option.click();
        await expect(menu).toHaveCount(0); await expect.poll(() => r.page.locator('#checkout').evaluate((node, p) => Math.abs(parseFloat(getComputedStyle(node).getPropertyValue(p)) - 16), property)).toBeLessThan(.05);
        observations.push({ label, unit, pointerReachable: true, sizePreserved: true });
      }
      await edit(r.page, label, '16px'); await trigger.focus(); await trigger.press('ArrowDown'); const em = menu.getByRole('button', { name: 'em', exact: true }); await em.focus(); await em.press('Enter'); await expect(menu).toHaveCount(0);
      await trigger.click(); await r.page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    }
    await button(r.page, 'Margin top unit').click(); await shot(r.page, `DA01-${name}-unit-menu`); await r.page.keyboard.press('Escape'); expect(r.errors).toEqual([]); await save(info, observations);
  } finally { await r.context.close(); }
});

const slotFixture = fixture.replace('<div id="open-host"></div>', '<div id="open-host"><strong id="slotted-label" slot="label">Assigned label</strong><span id="slotted-second" slot="label">Second assigned node</span></div>').replace("'<button id=\"shadow-child\" style=\"font:19px Georgia\">Open shadow button</button>'", "'<section id=\"shadow-section\"><slot id=\"outer-slot\" name=\"label\"></slot><button id=\"shadow-child\">Open shadow button</button><div id=\"nested-host\"><strong id=\"nested-slotted\" slot=\"deep\">Nested assigned label</strong></div></section>';document.querySelector('#open-host').shadowRoot.querySelector('#nested-host').attachShadow({mode:'open'}).innerHTML='<section id=\"deep-section\"><slot id=\"deep-slot\" name=\"deep\"></slot></section>'");
test('CA64 assigned and nested assigned nodes appear once with coherent Parent Child Refresh and ordinary DOM', async ({}, info) => {
  const r = await setup(info, slotFixture), observations: unknown[] = [];
  try {
    for (const [selector, slot] of [['#slotted-label', 'slot#outer-slot'], ['#nested-slotted', 'slot#deep-slot']]) {
      await pick(r.page, selector); await r.page.getByRole('tab', { name: 'HTML', exact: true }).click();
      let tree = r.page.getByRole('tree', { name: 'Page DOM tree' });
      const selectedName = await identity(r.page).innerText();
      await expect(tree.getByRole('treeitem', { name: selectedName, exact: true })).toHaveCount(1); await expect(tree.getByRole('treeitem', { selected: true })).toHaveAccessibleName(selectedName);
      await button(r.page, 'Refresh tree').click(); await expect(tree.getByRole('treeitem', { selected: true })).toHaveAccessibleName(selectedName);
      await button(r.page, 'Parent').click(); await expect(identity(r.page)).toHaveText(slot); await button(r.page, 'Child').click(); await expect(identity(r.page)).toHaveText(selectedName); await aligned(r.page, selector);
      await dock(r.page).getByRole('button', { name: 'Open Navigator', exact: true }).click(); const modal = r.page.getByRole('dialog', { name: 'Navigator', exact: true }); tree = modal.getByRole('tree');
      await expect(tree.getByRole('treeitem', { name: selectedName, exact: true })).toHaveCount(1); await expect(tree.getByRole('treeitem', { selected: true })).toHaveAccessibleName(selectedName); await modal.getByRole('button', { name: 'Refresh tree', exact: true }).click(); await expect(tree.getByRole('treeitem', { selected: true })).toHaveAccessibleName(selectedName);
      const names = await tree.getByRole('treeitem').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))); expect(new Set(names).size).toBe(names.length);
      await modal.getByRole('button', { name: 'Parent', exact: true }).click(); await expect(tree.getByRole('treeitem', { selected: true })).toHaveAccessibleName(slot); await modal.getByRole('button', { name: 'Child', exact: true }).click(); await expect(tree.getByRole('treeitem', { selected: true })).toHaveAccessibleName(selectedName);
      await shot(r.page, `CA64-${selector.slice(1)}-navigator`); await r.page.keyboard.press('Escape'); observations.push({ selectedName, slot, unique: true, refresh: true, parentChild: true });
    }
    await pick(r.page, '#checkout'); await expect(r.page.getByRole('treeitem', { selected: true })).toHaveAccessibleName('button#checkout.primary'); await button(r.page, 'Parent').click(); await expect(identity(r.page)).toHaveText('section#collection.card');
    expect(r.errors).toEqual([]); await save(info, observations);
  } finally { await r.context.close(); }
});

test('J01-J03 empty tools absent dock keyboard order balanced geometry and clean teardown', async ({}, info) => {
  const r = await setup(info);
  try {
    await pick(r.page, '#checkout');
    for (const name of ['Background tools', 'Color tools', 'Eyedropper information']) await expect(button(r.page, name)).toHaveCount(0);
    await expect(r.page.getByText('This tool is not connected yet.', { exact: true })).toHaveCount(0);
    const names = ['Pick page element', 'Open Changes', 'Open Navigator', 'Measurement tools', 'More tools', 'Hide inspector panel', 'Deactivate CSSForge'];
    expect(await dock(r.page).getByRole('button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))).toEqual(names);
    await dock(r.page).getByRole('button', { name: names[0], exact: true }).focus();
    for (const name of names.slice(1)) { await r.page.keyboard.press('Tab'); await expect(dock(r.page).getByRole('button', { name, exact: true })).toBeFocused(); }
    for (const name of names.slice(0, -1).reverse()) { await r.page.keyboard.press('Shift+Tab'); await expect(dock(r.page).getByRole('button', { name, exact: true })).toBeFocused(); }
    for (const width of [1440, 390, 320]) { await r.page.setViewportSize({ width, height: 480 }); await withinViewport(r.page); const rect = (await dock(r.page).boundingBox())!; expect(Math.abs(rect.x + rect.width / 2 - width / 2)).toBeLessThan(1); }
    await shot(r.page, 'J01-J03-production-dock'); await dock(r.page).getByRole('button', { name: 'Deactivate CSSForge', exact: true }).click(); await expect(r.page.locator('cssforge-ui')).toHaveCount(0); await expect(r.page.locator('cssforge-overlay')).toHaveCount(0); await r.action(); await expect(inspector(r.page)).toBeVisible(); expect(await r.page.locator('cssforge-ui').evaluate(node => node.matches(':popover-open'))).toBe(true);
    expect(r.errors).toEqual([]); await save(info, { names, hiddenTools: 3, keyboardOrder: true, cleanReactivation: true });
  } finally { await r.context.close(); }
});
