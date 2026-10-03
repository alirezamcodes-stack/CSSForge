import { test, expect, type Page } from '@playwright/test';
import { launch, html } from './mutationHarness';
import { aligned, dock, identity, pick } from './extensionHarness';

type Scope = 'document' | 'shadow';
const field = async (page: Page, name: string, value: string) => {
  const input = page.getByRole('textbox', { name, exact: true });
  await input.fill(value); await input.press('Enter');
};
async function fixture(info: Parameters<typeof launch>[0], scope: Scope, css = 'button{font-size:18px;color:purple}') {
  const r = await launch(info, html(css, scope === 'document' ? '<button id="target">Target</button>' : '<div id="scope-host"></div>'));
  if (scope === 'shadow') await r.page.locator('#scope-host').evaluate((host, css) => {
    const root = host.attachShadow({ mode: 'open' }), style = document.createElement('style'), button = document.createElement('button');
    style.id = 'author'; style.textContent = css; button.id = 'target'; button.textContent = 'Target'; root.append(style, button);
  }, css);
  await pick(r.page, '#target'); return r;
}

for (const scope of ['document', 'shadow'] as const) for (const layerAttribute of [null, '', 'host']) {
  test(`10B F01 ${scope}: author stylesheet attribute ${JSON.stringify(layerAttribute)} keeps truthful effects`, async ({}, info) => {
    const r = await fixture(info, scope, '#target{font-size:18px;color:rgb(0,128,0)!important}');
    try {
      const author = r.page.locator('#author').last();
      if (layerAttribute !== null) await author.evaluate((node, value) => node.setAttribute('data-cssforge-edit-layer', value), layerAttribute);
      const authored = await author.evaluate(node => (node as HTMLStyleElement).sheet!.cssRules[0].cssText);
      // Public refresh preserves the existing CSSOM discovery/invalidation boundary.
      await r.page.getByRole('tab', { name: 'Code', exact: true }).click();
      await r.page.getByRole('button', { name: 'Refresh sources', exact: true }).click();
      const matching = r.page.getByRole('region', { name: 'Readable matching CSS', exact: true });
      await expect(matching).toContainText('rgb(0, 128, 0)');
      await r.page.getByRole('tab', { name: 'Design', exact: true }).click();
      await field(r.page, 'Text color', '#ff0000');
      await expect(r.page.locator('#target')).toHaveCSS('color', 'rgb(0, 128, 0)');
      // Open-root evidence stays conservative; lookalikes must match the ordinary control.
      const state = scope === 'document' ? 'blocked' : 'unknown';
      const reason = scope === 'document' ? 'Higher specificity wins' : 'Cascade evidence incomplete or unsupported';
      await expect(r.page.getByTestId('live-design').locator('[data-edit-property="color"]')).toHaveAttribute('data-edit-effect', state);
      const effect = await r.read(`__p.editor.getSnapshot().effectiveness.find(e=>e.property==='color')`);
      expect(effect).toMatchObject({ state, reason, requested: '#ff0000' });
      expect((await r.status()).undo).toBe(1);
      await dock(r.page).getByRole('button', { name: 'Open Changes', exact: true }).click();
      const changes = r.page.getByRole('dialog', { name: 'Changes', exact: true });
      await expect(changes.locator('[data-edit-property="color"]')).toHaveAttribute('data-edit-effect', state);
      await changes.getByRole('button', { name: 'Undo last edit', exact: true }).click();
      expect((await r.status()).undo).toBe(0); await r.page.keyboard.press('Escape');
      await field(r.page, 'Text color', '#ff0000');
      await r.page.getByRole('button', { name: 'Reset session edits', exact: true }).click();
      await expect(r.page.locator('#target')).toHaveCSS('color', 'rgb(0, 128, 0)');
      expect(await author.evaluate(node => (node as HTMLStyleElement).sheet!.cssRules[0].cssText)).toBe(authored);
      expect((await r.status()).undo).toBe(0); expect(r.errors).toEqual([]);
    } finally { await r.context.close(); }
  });
}

for (const scope of ['document', 'shadow'] as const) for (const variant of ['ordinary', 'copied-marker', 'layer-only', 'both', 'wrapper'] as const) {
  test(`10B F02 ${scope}: ${variant} insertion never inherits target ownership`, async ({}, info) => {
    const r = await fixture(info, scope);
    try {
      await r.page.locator('#target').evaluate(node => {
        (window as any).ownershipTemplate = node.cloneNode(true);
        (window as any).ownershipOriginal = node;
      });
      await field(r.page, 'Font size', '32'); const before = await r.status();
      const generation = await r.read('globalThis.__ownershipSelected=__p.targetLocator().identity.element;__p.editor.getSnapshot().design.bindingGeneration');
      await r.page.locator('#target').evaluate((node, variant) => {
        const source = ['ordinary', 'layer-only'].includes(variant) ? (window as any).ownershipTemplate : node;
        const clone = source.cloneNode(true) as HTMLElement; clone.id = 'copy';
        if (['layer-only', 'both'].includes(variant)) clone.setAttribute('data-cssforge-edit-layer', 'host');
        if (variant === 'wrapper') {
          const wrapper = document.createElement('div'); wrapper.setAttribute('data-cssforge-edit-layer', 'host');
          wrapper.append(clone); node.parentNode!.appendChild(wrapper);
        } else node.parentNode!.appendChild(clone);
      }, variant);
      // Observe beyond the bounded MutationObserver sanitation, before claiming isolation.
      await r.page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const copy = r.page.locator('#copy');
      expect(await copy.evaluate(node => node.getAttributeNames().filter(name => name.startsWith('data-cssforge-target-')))).toEqual([]);
      await expect(copy).toHaveCSS('font-size', '18px'); await expect(r.page.locator('#target')).toHaveCSS('font-size', '32px');
      await expect(identity(r.page)).toHaveText('button#target');
      expect((await r.status()).target).toBe(before.target);
      expect(await r.read('__p.editor.getSnapshot().design.bindingGeneration')).toBe(generation);
      expect(await r.read('__p.targetLocator().identity.element.id')).toBe('target');
      expect(await r.read('__p.targetLocator().identity.element===__ownershipSelected')).toBe(true);
      const internal = r.page.locator('style[data-cssforge-edit-layer]');
      expect(await internal.count()).toBe(1);
      expect(await internal.first().getAttribute('data-cssforge-edit-layer')).toBe(before.target);
      await r.page.getByRole('button', { name: 'Undo last edit', exact: true }).click();
      await expect(r.page.locator('#target')).toHaveCSS('font-size', '18px'); await expect(copy).toHaveCSS('font-size', '18px');
      expect((await r.status()).undo).toBe(0); expect(r.errors).toEqual([]);
    } finally { await r.context.close(); }
  });
}

for (const cleanup of ['replacement', 'reset', 'deactivation'] as const) {
  test(`10B F01/C/D: genuine layer exclusion and revoked identity after ${cleanup}`, async ({}, info) => {
    const r = await fixture(info, 'document');
    try {
      await field(r.page, 'Font size', '32');
      await r.page.locator('style[data-cssforge-edit-layer]').evaluate(node => {
        (window as any).retainedOwnershipLayer = node;
        node.removeAttribute('data-cssforge-edit-layer');
      });
      await r.page.getByRole('tab', { name: 'Code', exact: true }).click();
      await r.page.getByRole('button', { name: 'Refresh sources', exact: true }).click();
      await expect(r.page.getByRole('region', { name: 'Readable matching CSS', exact: true })).not.toContainText('data-cssforge-target-');
      expect(await r.read(`__p.editor.getSnapshot().effectiveness.find(e=>e.property==='font-size').state`)).toBe('effective');
      await r.page.getByRole('tab', { name: 'Design', exact: true }).click();
      if (cleanup === 'reset') await r.page.getByRole('button', { name: 'Reset session edits', exact: true }).click();
      else if (cleanup === 'deactivation') { await r.action(); await r.action(); await r.bind(); await pick(r.page, '#target'); }
      else await field(r.page, 'Font size', '34');
      expect(await r.page.evaluate(() => (window as any).retainedOwnershipLayer.isConnected)).toBe(false);
      if (cleanup !== 'replacement') await field(r.page, 'Font size', '34');
      await r.page.evaluate(() => {
        const layer = (window as any).retainedOwnershipLayer as HTMLStyleElement;
        layer.setAttribute('data-cssforge-edit-layer', 'host');
        layer.textContent = '#target{color:rgb(0,128,0)!important;--retired-layer-evidence:1}';
        document.head.append(layer);
      });
      await r.page.getByRole('tab', { name: 'Code', exact: true }).click();
      await r.page.getByRole('button', { name: 'Refresh sources', exact: true }).click();
      const matching = r.page.getByRole('region', { name: 'Readable matching CSS', exact: true });
      await expect(matching).toContainText('--retired-layer-evidence'); await expect(matching).not.toContainText('data-cssforge-target-');
      await r.page.getByRole('tab', { name: 'Design', exact: true }).click(); await field(r.page, 'Text color', '#ff0000');
      await expect(r.page.locator('#target')).toHaveCSS('color', 'rgb(0, 128, 0)');
      await expect(r.page.getByTestId('live-design').locator('[data-edit-property="color"]')).toHaveAttribute('data-edit-effect', 'blocked');
      await r.page.getByRole('button', { name: 'Reset session edits', exact: true }).click();
      await expect(r.page.locator('#target')).toHaveCSS('font-size', '18px');
      expect(await r.page.evaluate(() => (window as any).retainedOwnershipLayer.isConnected)).toBe(true);
      expect(r.errors).toEqual([]);
    } finally { await r.context.close(); }
  });
}

test('10B F01/D: failed layer insertion revokes the captured native node', async ({}, info) => {
  const r = await fixture(info, 'document');
  try {
    await r.read(`(()=>{const head=document.head,append=head.appendChild;head.appendChild=function(node){head.appendChild=append;globalThis.__failedOwnershipLayer=node;throw Error('Expected layer insertion refusal')};})()`);
    await field(r.page, 'Font size', '32'); expect((await r.status()).undo).toBe(0);
    expect((await r.status()).error).toContain('blocked the CSSForge style layer');
    await r.read(`__failedOwnershipLayer.textContent='#target{color:rgb(0,128,0)!important;--failed-layer-evidence:1}';document.head.appendChild(__failedOwnershipLayer);true`);
    await r.page.getByRole('tab', { name: 'Code', exact: true }).click();
    await r.page.getByRole('button', { name: 'Refresh sources', exact: true }).click();
    await expect(r.page.getByRole('region', { name: 'Readable matching CSS', exact: true })).toContainText('--failed-layer-evidence');
    await r.page.getByRole('tab', { name: 'Design', exact: true }).click(); await field(r.page, 'Text color', '#ff0000');
    await expect(r.page.getByTestId('live-design').locator('[data-edit-property="color"]')).toHaveAttribute('data-edit-effect', 'blocked');
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('10B related predicate: page layer-looking selected node retains native movement observation', async ({}, info) => {
  const r = await launch(info, html('#target{font-size:18px;position:relative}', '<button id="target" data-cssforge-edit-layer="host">Target</button>'));
  try {
    await pick(r.page, '#target'); await aligned(r.page, '#target');
    await r.page.locator('#target').evaluate(node => (node as HTMLElement).style.left = '80px');
    await aligned(r.page, '#target'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('10B related predicate: delayed replacement in layer-looking subtree still requires strong exact-root proof', async ({}, info) => {
  const r = await launch(info, html('#target{font-size:18px}', '<section data-cssforge-edit-layer="host"><button id="target">Target</button></section>'));
  try {
    await pick(r.page, '#target'); await field(r.page, 'Font size', '32'); const before = await r.status();
    await r.page.locator('#target').evaluate(node => node.remove()); await r.read('__p.getSnapshot();true');
    await expect.poll(async () => (await r.status()).reconciliation).toBe('waiting-for-replacement');
    await r.page.locator('main > section').evaluate(parent => {
      const replacement = document.createElement('button'); replacement.id = 'target'; replacement.textContent = 'Replacement';
      replacement.setAttribute('data-cssforge-edit-layer', 'host'); parent.append(replacement);
    });
    await expect.poll(async () => (await r.status()).reconciliation).toBe('migrated');
    expect((await r.status()).target).toBe(before.target); expect((await r.status()).undo).toBe(1);
    await expect(r.page.locator('#target')).toHaveCSS('font-size', '32px');
    await r.page.getByRole('button', { name: 'Undo last edit', exact: true }).click();
    await expect(r.page.locator('#target')).toHaveCSS('font-size', '18px'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});
