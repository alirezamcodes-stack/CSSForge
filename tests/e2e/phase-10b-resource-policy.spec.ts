import { test, expect, type Page } from '@playwright/test';
import { launch, html } from './mutationHarness';
import { dock, identity, pick } from './extensionHarness';

const resource = 'data:,cssforge-duplicate-resource';
const scene = '<section id="scene"><button class="target">Target</button></section>';
const css = '.target{font-size:18px;color:purple}';
const menu = async (page: Page) => page.getByRole('button', { name: 'Inspector menu', exact: true }).click();
const duplicate = (page: Page) => page.getByRole('button', { name: 'Duplicate', exact: true });
const changes = async (page: Page) => {
  await dock(page).getByRole('button', { name: 'Open Changes', exact: true }).click();
  return page.getByRole('dialog', { name: 'Changes', exact: true });
};
async function fixture(info: Parameters<typeof launch>[0], raw: string) {
  const r = await launch(info, html(css, scene));
  await r.page.locator('.target').evaluate((node, raw) => node.setAttribute('style', raw), raw);
  await pick(r.page, '.target'); return r;
}
async function refused(r: Awaited<ReturnType<typeof launch>>, selector = '.target') {
  const before = await r.status(), raw = await r.page.locator(selector).getAttribute('style');
  const markup = await r.page.locator('#scene').evaluate(node => node.innerHTML);
  await menu(r.page); await expect(duplicate(r.page)).toBeDisabled();
  await expect(r.page.getByText('Duplicate: Duplicate refuses IDs', { exact: false })).toBeVisible();
  await r.page.keyboard.press('Escape');
  await expect(r.page.locator('#scene').locator(selector)).toHaveCount(1);
  expect(await r.page.locator('#scene').evaluate(node => node.innerHTML)).toBe(markup);
  expect(await r.page.locator(selector).getAttribute('style')).toBe(raw);
  expect((await r.status()).undo).toBe(before.undo); expect((await r.status()).target).toBe(before.target);
  expect(await r.read('__p.editor.structureMutation.getStats().writes')).toBe(0);
  const c = await changes(r.page); await expect(c.locator('[data-change-kind="DOM_DUPLICATE"]')).toHaveCount(0);
  await r.page.keyboard.press('Escape'); expect(r.errors).toEqual([]);
}

for (const [name, value] of [
  ['ordinary', `url("${resource}")`],
  ['uppercase', `URL("${resource}")`],
  ['audit escape', `u\\72l("${resource}")`],
  ['six-digit escape', `U\\000072 L("${resource}")`],
  ['mixed escapes', `\\75\\72\\6c("${resource}")`],
  ['valid comments and argument whitespace', `/* before */url( "${resource}" )`],
] as const) {
  test(`10B.2 resource ${name}: browser accepts URL and public Duplicate refuses unchanged`, async ({}, info) => {
    const raw = `background-image:${value};color:red`, r = await fixture(info, raw);
    try {
      // Native CSSOM acceptance is the proof; no network request is needed.
      expect(await r.page.locator('.target').evaluate(node => (node as HTMLElement).style.backgroundImage)).toBe(`url("${resource}")`);
      await refused(r); expect((await r.status()).undo).toBe(0);
    } finally { await r.context.close(); }
  });
}

for (const [name, value] of [['ordinary', `url("${resource}")`], ['escaped', `u\\72l("${resource}")`]] as const) {
  test(`10B.2 unused custom property ${name}: conservative URL-token refusal is retained`, async ({}, info) => {
    const r = await fixture(info, `--asset:${value};color:red`);
    try {
      expect(await r.page.locator('.target').evaluate(node => (node as HTMLElement).style.getPropertyValue('--asset'))).toBe(value);
      await refused(r);
    } finally { await r.context.close(); }
  });
}

test('10B.2 deferred var fallback: preserved CSSOM escape still refuses resource function', async ({}, info) => {
  const value = `var(--missing,u\\72l("${resource}"))`, r = await fixture(info, `background-image:${value}`);
  try {
    expect(await r.page.locator('.target').evaluate(node => (node as HTMLElement).style.backgroundImage)).toBe(value);
    await refused(r);
  } finally { await r.context.close(); }
});

for (const [name, raw, accepted] of [
  ['quoted content', 'content:"url(data:,text)";color:red', 'content: "url(data:,text)"; color: red;'],
  ['quoted custom text', '--label:"url(data:,text)";color:red', '--label: "url(data:,text)"; color: red;'],
  ['comment text', '/* url(data:,comment) */ color:red', 'color: red;'],
  ['ignored invalid value and whitespace function', 'color:url("data:,ignored");background-image:url ("data:,ignored");font-size:18px', 'font-size: 18px;'],
] as const) {
  test(`10B.2 inert ${name}: native parsing remains harmless and one Duplicate undoes exactly`, async ({}, info) => {
    const r = await fixture(info, raw);
    try {
      expect(await r.page.locator('.target').evaluate(node => (node as HTMLElement).style.cssText)).toBe(accepted);
      await menu(r.page); await expect(duplicate(r.page)).toBeEnabled(); await duplicate(r.page).click();
      await expect(r.page.locator('.target')).toHaveCount(2); expect((await r.status()).undo).toBe(1);
      for (const node of await r.page.locator('.target').all()) expect(await node.getAttribute('style')).toBe(raw);
      const c = await changes(r.page); await expect(c.locator('[data-change-kind="DOM_DUPLICATE"]')).toHaveCount(1);
      await c.getByRole('button', { name: 'Undo last edit', exact: true }).click();
      await expect(r.page.locator('.target')).toHaveCount(1); expect((await r.status()).undo).toBe(0);
      expect(await r.page.locator('.target').getAttribute('style')).toBe(raw); expect(r.errors).toEqual([]);
    } finally { await r.context.close(); }
  });
}

test('10B.2 invalid declarations do not erase another accepted escaped resource', async ({}, info) => {
  const raw = `color:url("data:,ignored");background-image:u\\72l("${resource}");background-image:invalid("ignored")`;
  const r = await fixture(info, raw);
  try {
    expect(await r.page.locator('.target').evaluate(node => (node as HTMLElement).style.backgroundImage)).toBe(`url("${resource}")`);
    await refused(r);
  } finally { await r.context.close(); }
});

test('10B.2 one forbidden descendant refuses whole subtree and preserves prior CSS history', async ({}, info) => {
  const r = await launch(info, html(css, '<section id="scene"><div class="target"><span>Safe</span><span class="resource">Resource</span></div></section>'));
  try {
    await r.page.locator('.resource').evaluate((node, raw) => node.setAttribute('style', raw), `background-image:u\\72l("${resource}")`);
    await pick(r.page, '.target');
    const field = r.page.getByRole('textbox', { name: 'Font size', exact: true }); await field.fill('32'); await field.press('Enter');
    expect((await r.status()).undo).toBe(1); await refused(r);
    await expect(r.page.locator('.target > span')).toHaveCount(2);
    await r.page.getByRole('button', { name: 'Undo last edit', exact: true }).click();
    expect((await r.status()).undo).toBe(0); await expect(r.page.locator('.target')).toHaveCSS('font-size', '18px');
    expect(await r.page.locator('.resource').getAttribute('style')).toBe(`background-image:u\\72l("${resource}")`);
  } finally { await r.context.close(); }
});

test('10B.2 harmless inline style preserves ordinary Duplicate, marker isolation and ordered Undo', async ({}, info) => {
  const raw = 'color:red;font-size:18px', r = await fixture(info, raw);
  try {
    const field = r.page.getByRole('textbox', { name: 'Font size', exact: true }); await field.fill('32'); await field.press('Enter');
    const before = await r.status(), generation = await r.read('__p.editor.getSnapshot().design.bindingGeneration');
    await menu(r.page); await expect(duplicate(r.page)).toBeEnabled(); await duplicate(r.page).click();
    await expect(r.page.locator('.target')).toHaveCount(2); expect((await r.status()).undo).toBe(2);
    await expect(r.page.locator('.target').first()).toHaveCSS('font-size', '32px');
    await expect(r.page.locator('.target').last()).toHaveCSS('font-size', '18px');
    expect(await r.page.locator('.target').last().evaluate(node => node.getAttributeNames().filter(name => name.startsWith('data-cssforge-target-')))).toEqual([]);
    expect((await r.status()).target).toBe(before.target); expect(await r.read('__p.editor.getSnapshot().design.bindingGeneration')).toBe(generation);
    await expect(identity(r.page)).toHaveText('button.target');
    const c = await changes(r.page); await expect(c.locator('[data-change-kind="DOM_DUPLICATE"]')).toHaveCount(1);
    await c.getByRole('button', { name: 'Undo last edit', exact: true }).click(); await r.page.keyboard.press('Escape');
    await expect(r.page.locator('.target')).toHaveCount(1); expect((await r.status()).undo).toBe(1);
    await r.page.getByRole('button', { name: 'Undo last edit', exact: true }).click();
    await expect(r.page.locator('.target')).toHaveCSS('font-size', '18px'); expect((await r.status()).undo).toBe(0);
    expect(await r.page.locator('.target').getAttribute('style')).toBe(raw); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('10B.2 commit revalidation refuses a resource introduced after safe preparation', async ({}, info) => {
  const r = await fixture(info, 'color:red');
  try {
    expect(await r.read(`globalThis.__resourcePlan=__p.editor.prepareStructure('duplicate');!('state' in __resourcePlan)`)).toBe(true);
    await r.page.locator('.target').evaluate((node, raw) => node.setAttribute('style', raw), `background-image:u\\72l("${resource}")`);
    expect(await r.read('__p.editor.applyStructure(__resourcePlan).state')).toBe('UNSUPPORTED');
    await expect(r.page.locator('.target')).toHaveCount(1); expect((await r.status()).undo).toBe(0);
    expect(await r.read('__p.editor.structureMutation.getStats().writes')).toBe(0); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('10B.2 open-root candidate uses same native inline resource refusal', async ({}, info) => {
  const r = await launch(info, html(css, '<section id="scene"><div id="open-host"></div></section>'));
  try {
    await r.page.locator('#open-host').evaluate((host, raw) => {
      const root = host.attachShadow({ mode: 'open' }), button = document.createElement('button');
      button.className = 'target'; button.textContent = 'Target'; button.setAttribute('style', raw); root.append(button);
    }, `background-image:u\\72l("${resource}")`);
    await pick(r.page, '.target'); await refused(r);
  } finally { await r.context.close(); }
});
