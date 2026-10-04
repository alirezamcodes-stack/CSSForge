import { test, expect, type Locator } from '@playwright/test';
import { launch, html } from './mutationHarness';
import { pick, dock, identity, aligned } from './extensionHarness';

for (const tab of ['Code', 'HTML'] as const) {
  test(`10B.4 F06 ${tab} truthful empty state, selection recovery and native Delete deselection`, async ({}, info) => {
    const r = await launch(info);
    try {
      await r.page.keyboard.press('Escape'); // Activation starts picking; use its existing cancel path.
      await r.page.getByRole('tab', { name: tab, exact: true }).click();
      const panel = r.page.getByRole('tabpanel', { name: tab, exact: true });
      const message = tab === 'Code' ? 'Select an element to inspect its CSS and add session edits.' : 'Select an element to inspect its DOM and navigate the page tree.';
      await expect(panel).toContainText(message); await expect(panel).not.toContainText(/not connected|unavailable|reload|install/i);
      await expect(panel.getByRole('button', { name: 'Add session declaration', exact: true })).toHaveCount(0);
      await expect(panel.getByRole('tree')).toHaveCount(0);
      await panel.getByRole('button', { name: 'Pick an element', exact: true }).click(); await r.page.locator('#target').click();
      if (tab === 'Code') await expect(panel.getByTestId('live-code')).toBeVisible();
      else await expect(panel.getByRole('treeitem', { selected: true })).toContainText('Target');
      await r.page.getByRole('button', { name: 'Inspector menu', exact: true }).click();
      await r.page.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(r.page.locator('#target')).toHaveCount(0); await expect(panel).toContainText(message);
      await expect(panel.getByTestId('live-code')).toHaveCount(0); await expect(panel.getByRole('tree')).toHaveCount(0);
      await r.page.getByRole('button', { name: 'Inspector menu', exact: true }).click();
      await r.page.getByRole('dialog', { name: 'Inspector menu', exact: true }).getByRole('button', { name: 'Undo last edit', exact: true }).click();
      await pick(r.page, '#target');
      if (tab === 'Code') await expect(panel.getByTestId('live-code')).toBeVisible();
      else await expect(panel.getByRole('treeitem', { selected: true })).toContainText('Target');
      expect(r.errors).toEqual([]);
    } finally { await r.context.close(); }
  });
}

async function fields(r: Awaited<ReturnType<typeof launch>>) {
  await pick(r.page, '#target'); await r.page.getByRole('tab', { name: 'Code', exact: true }).click();
  await r.page.getByRole('button', { name: 'Add session declaration', exact: true }).click();
  return { property: r.page.getByRole('textbox', { name: 'CSS property', exact: true }), value: r.page.getByRole('textbox', { name: 'New CSS value', exact: true }), apply: r.page.getByRole('button', { name: 'Apply', exact: true }) };
}
async function valid(input: Locator) {
  await expect(input).not.toHaveAttribute('aria-invalid', 'true'); expect(await input.getAttribute('aria-describedby')).toBeNull();
}
async function invalid(input: Locator, message: string) {
  await expect(input).toHaveAttribute('aria-invalid', 'true'); await expect(input).toHaveAccessibleDescription(message);
  const id = await input.getAttribute('aria-describedby'); expect(id).toBeTruthy();
  expect(await input.evaluate((node, id) => (node.getRootNode() as ShadowRoot).querySelectorAll(`[id="${CSS.escape(id!)}"]`).length, id)).toBe(1);
}

for (const [property, value] of [['foo???', 'red'], ['transform', 'none']] as const) {
  test(`10B.4 F07 ${property} blames only unsupported property, retains draft and corrects normally`, async ({}, info) => {
    const r = await launch(info);
    try {
      const f = await fields(r); await f.property.fill(property); await f.value.fill(value); await f.apply.click();
      await invalid(f.property, 'Enter a supported CSS property.'); await valid(f.value);
      await expect(f.property).toHaveValue(property); await expect(f.value).toHaveValue(value);
      expect((await r.status()).undo).toBe(0); expect((await r.status()).overrides).toEqual([]);
      await f.property.fill('color'); await f.value.fill('red'); await valid(f.property); await valid(f.value);
      await expect(r.page.getByRole('alert')).toHaveCount(0); await f.value.press('Enter');
      await expect(r.page.locator('#target')).toHaveCSS('color', 'rgb(255, 0, 0)'); expect((await r.status()).undo).toBe(1);
      await r.page.getByRole('button', { name: 'Undo last edit', exact: true }).click(); await expect(r.page.locator('#target')).toHaveCSS('color', 'rgb(128, 0, 128)');
      expect(r.errors).toEqual([]);
    } finally { await r.context.close(); }
  });
}

test('10B.4 F07 invalid value belongs to value field; correction clears stable associations before submit', async ({}, info) => {
  const r = await launch(info);
  try {
    const f = await fields(r); await f.property.fill('color'); await f.value.fill('definitely-not-a-color'); await f.value.press('Enter');
    await valid(f.property); await invalid(f.value, 'Enter a valid color value.'); const id = await f.value.getAttribute('aria-describedby');
    expect((await r.status()).undo).toBe(0); await expect(r.page.locator('#target')).toHaveCSS('color', 'rgb(128, 0, 128)');
    await f.value.fill('still-invalid'); await invalid(f.value, 'Enter a valid color value.'); expect(await f.value.getAttribute('aria-describedby')).toBe(id);
    await f.value.fill('red'); await valid(f.value); await expect(r.page.getByRole('alert')).toHaveCount(0);
    await f.value.press('Enter'); expect((await r.status()).undo).toBe(1); await expect(r.page.getByRole('textbox', { name: 'New CSS value' })).toHaveCount(0);
    await r.page.getByRole('button', { name: 'Add session declaration', exact: true }).click();
    await valid(f.property); await valid(f.value); await expect(f.property).toHaveValue(''); await expect(f.value).toHaveValue('');
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('10B.4 F07 keyboard order and bare length normalization preserve existing Apply and Undo', async ({}, info) => {
  const r = await launch(info);
  try {
    const f = await fields(r); await f.property.fill(' width '); await f.property.focus(); await r.page.keyboard.press('Tab'); await expect(f.value).toBeFocused();
    await r.page.keyboard.press('Shift+Tab'); await expect(f.property).toBeFocused(); await r.page.keyboard.press('Tab'); await f.value.fill('240');
    await r.page.keyboard.press('Tab'); await expect(f.apply).toBeFocused(); await r.page.keyboard.press('Enter');
    await expect(r.page.locator('#target')).toHaveCSS('width', '240px'); expect((await r.status()).undo).toBe(1);
    await r.page.getByRole('button', { name: 'Undo last edit', exact: true }).click(); expect((await r.status()).undo).toBe(0); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('10B.4 F07 valid CSS refused by existing engine stays a form error, not invalid CSS fields', async ({}, info) => {
  const r = await launch(info, html('', '<button id="target" style="color:purple!important">Target</button>'));
  try {
    const f = await fields(r); await f.property.fill('color'); await f.value.fill('red'); await f.apply.click();
    await valid(f.property); await valid(f.value); await expect(r.page.getByRole('alert')).toContainText('An inline !important declaration prevents this override.');
    expect((await r.status()).undo).toBe(0); await expect(r.page.locator('#target')).toHaveCSS('color', 'rgb(128, 0, 128)'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

const longID = `long-id-${'a'.repeat(32)}`;
const treeScene = `<section id="scene"><div class="item">Alpha</div><div class="item">Beta</div><div id="unique" class="semantic">ID one</div><div id="other" class="different">ID two</div><div class="long">${'L'.repeat(160)}</div><div class="white"> \n Whitespace\t useful\n text </div><div class="empty"></div><div class="empty"></div><div class="same shared tail-alpha"></div><div class="same shared tail-beta"></div><div id="${longID}1" class="id-row"></div><div id="${longID}2" class="id-row"></div><div class="only-child"><span>Descendant excluded</span></div></section>`;
for (const surface of ['HTML', 'Navigator'] as const) {
  test(`10B.4 F08 ${surface} bounded visible-text names preserve selection and deterministic refresh`, async ({}, info) => {
    const r = await launch(info, html('.item,.long,.white,.empty{min-height:20px}', treeScene));
    try {
      await pick(r.page, '.item >> nth=0'); await r.page.getByRole('tab', { name: 'HTML', exact: true }).click();
      if (surface === 'Navigator') await dock(r.page).getByRole('button', { name: 'Open Navigator', exact: true }).click();
      const scope = surface === 'Navigator' ? r.page.getByRole('dialog', { name: 'Navigator', exact: true }) : r.page.getByRole('tabpanel', { name: 'HTML', exact: true });
      const tree = scope.getByRole('tree'), alpha = tree.getByRole('treeitem', { name: 'div.item · Alpha', exact: true }), beta = tree.getByRole('treeitem', { name: 'div.item · Beta', exact: true });
      await expect(alpha).toHaveCount(1); await expect(beta).toHaveCount(1); await expect(alpha).toContainText('Alpha'); await expect(beta).toContainText('Beta');
      await expect(tree.getByRole('treeitem', { name: 'div#unique.semantic · ID one', exact: true })).toHaveCount(1);
      await expect(tree.getByRole('treeitem', { name: 'div#other.different · ID two', exact: true })).toHaveCount(1);
      for (const tail of ['alpha', 'beta']) await expect(tree.getByRole('treeitem', { name: `div.same.shared.tail-${tail}`, exact: true })).toHaveCount(1);
      for (const suffix of ['1', '2']) await expect(tree.getByRole('treeitem', { name: `div#${longID}${suffix}.id-row`, exact: true })).toHaveCount(1);
      await expect(tree.getByRole('treeitem', { name: `div.long · ${'L'.repeat(80)}`, exact: true })).toHaveCount(1);
      await expect(tree.getByRole('treeitem', { name: 'div.white · Whitespace useful text', exact: true })).toHaveCount(1);
      await expect(tree.getByRole('treeitem', { name: 'div.empty', exact: true })).toHaveCount(2);
      await expect(tree.getByRole('treeitem', { name: 'div.only-child', exact: true })).toHaveCount(1);
      const before = await tree.getByRole('treeitem').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
      await scope.getByRole('button', { name: 'Refresh tree', exact: true }).click(); expect(await tree.getByRole('treeitem').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))).toEqual(before);
      await beta.click(); await expect(beta).toHaveAttribute('aria-selected', 'true'); await expect(identity(r.page)).toHaveText('div.item'); const target = (await r.status()).target;
      await beta.press('ArrowUp'); await expect(alpha).toBeFocused(); await r.page.keyboard.press('Enter'); await expect(alpha).toHaveAttribute('aria-selected', 'true'); expect((await r.status()).target).not.toBe(target);
      await beta.focus(); await r.page.keyboard.press('Space'); await expect(beta).toHaveAttribute('aria-selected', 'true'); expect((await r.status()).target).toBe(target);
      if (surface === 'Navigator') await r.page.keyboard.press('Escape');
      await aligned(r.page, '.item >> nth=1'); expect(r.errors).toEqual([]);
    } finally { await r.context.close(); }
  });
}
