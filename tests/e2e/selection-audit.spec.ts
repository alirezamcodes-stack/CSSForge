import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Picker } from '../../src/picker/controller';
import { setup, fixture as extensionFixture, pick as extensionPick, identity, dock } from './extensionHarness';
import type { browser } from 'wxt/browser';
declare const chrome: typeof browser;
declare global { interface Window { selectionAudit: { picker: Picker; paths: string[][]; clicks: number; moves: number; geometry: Record<string, number> } } }

const fixture = await readFile(path.resolve('tests/e2e/fixtures/selection-audit.html'), 'utf8');
const frameHTML = '<!doctype html><style>body{margin:0}button{margin:15px;width:180px;height:60px}</style><button id="frame-button">Cross-origin frame</button>';
async function routes(page: Page) {
  await page.route('**/selection-audit.html', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.route('http://frames.test/selection-audit-frame.html', route => route.fulfill({ contentType: 'text/html', body: frameHTML }));
}
async function launch(page: Page) {
  await routes(page); await page.goto('/selection-audit.html');
  await page.evaluate(async () => {
    const modulePath = '/src/picker/controller.ts'; const { createPicker } = await import(modulePath);
    const paths: string[][] = [], geometry: Record<string, number> = {};
    let clicks = 0, moves = 0;
    window.addEventListener('click', event => { clicks++; paths.push(event.composedPath().filter((node): node is Element => node instanceof Element).map(node => node.id || node.localName)); }, true);
    window.addEventListener('pointermove', () => { moves++; }, true);
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () { const key = this.id || this.localName; geometry[key] = (geometry[key] ?? 0) + 1; return original.call(this); };
    const picker = createPicker(document, document.querySelector<HTMLElement>('cssforge-ui')!, () => {});
    window.selectionAudit = { picker, paths, get clicks() { return clicks; }, get moves() { return moves; }, geometry };
  });
}
async function evidence(info: TestInfo, data: unknown) {
  const prefix = info.title.split(' ')[0], directory = ['A08', 'A13'].includes(prefix) ? 'test-results/diagnostics/reconciliation' : 'test-results/diagnostics/selection-hardening';
  await mkdir(directory, { recursive: true });
  const file = path.resolve(`${directory}/${prefix}.json`);
  await writeFile(file, JSON.stringify(data, null, 2)); await info.attach('diagnostic-evidence', { path: file, contentType: 'application/json' });
}
const selection = (page: Page) => page.evaluate(() => window.selectionAudit.picker.getSnapshot().selection);
async function start(page: Page) { await page.evaluate(() => window.selectionAudit.picker.start()); }
async function clickCenter(page: Page, selector: string) {
  const b = (await page.locator(selector).boundingBox())!; await start(page); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
async function gap(page: Page, selector: string) {
  return page.locator(selector).evaluate(node => {
    const box = node.getBoundingClientRect(), outline = document.querySelector('cssforge-overlay')!.shadowRoot!.querySelector('[data-testid="target-outline"]')!.getBoundingClientRect();
    return { x: outline.x - box.x, y: outline.y - box.y, width: outline.width - box.width, height: outline.height - box.height };
  });
}
async function aligned(page: Page, selector: string) { await expect.poll(async () => Math.max(...Object.values(await gap(page, selector)).map(Math.abs))).toBeLessThan(1); }

test('A01 raw targets remain primary while candidate discovery exposes ancestors and covered alternatives', async ({ page }, info) => {
  await launch(page); await clickCenter(page, '#nested-path');
  expect((await selection(page))?.id).toBe('nested-path'); await aligned(page, '#nested-path');
  const nested = await page.evaluate(() => {
    const b = document.querySelector('#nested-path')!.getBoundingClientRect();
    return { selection: window.selectionAudit.picker.getSnapshot().selection, candidates: window.selectionAudit.picker.candidates().map(item => ({ id: item.element.id || item.element.localName, interactive: item.interactive })), path: window.selectionAudit.paths.at(-1), stack: document.elementsFromPoint(b.x + b.width / 2, b.y + b.height / 2).map(node => node.id || node.localName) };
  });
  expect(nested.path!.slice(0, 4)).toEqual(['nested-path', 'nested-svg', 'nested-span', 'nested']);
  expect(nested.candidates[0].id).toBe('nested-path'); expect(nested.candidates).toContainEqual({ id: 'nested', interactive: true });
  expect(new Set(nested.candidates.map(item => item.id)).size).toBe(nested.candidates.length);
  await page.evaluate(() => window.selectionAudit.picker.parent()); expect((await selection(page))?.id).toBe('nested-svg');
  await page.evaluate(() => window.selectionAudit.picker.parent()); expect((await selection(page))?.id).toBe('nested-span');
  await page.evaluate(() => window.selectionAudit.picker.parent()); expect((await selection(page))?.id).toBe('nested');
  await clickCenter(page, '#transparent'); expect((await selection(page))?.id).toBe('transparent');
  const overlap = await page.evaluate(() => { const b = document.querySelector('#transparent')!.getBoundingClientRect(); return { candidates: window.selectionAudit.picker.candidates().map(item => item.element.id), stack: document.elementsFromPoint(b.x + 50, b.y + 25).map(node => node.id || node.localName), path: window.selectionAudit.paths.at(-1) }; });
  expect(overlap.stack).toContain('underlay'); expect(overlap.path).not.toContain('underlay');
  expect(overlap.candidates[0]).toBe('transparent'); expect(overlap.candidates).toContain('underlay');
  await clickCenter(page, '#pointer-button'); expect((await selection(page))?.id).toBe('pointer-button');
  await evidence(info, { nested, overlap, pointerEventsNone: (await selection(page))?.id });
});

test('A02 scroll fixed sticky absolute initial transforms and resize maintain viewport geometry', async ({ page }, info) => {
  await launch(page); const observations: Record<string, unknown> = {};
  for (const selector of ['#absolute', '#fixed', '#transformed']) {
    await clickCenter(page, selector); await aligned(page, selector); observations[selector] = await gap(page, selector);
  }
  await clickCenter(page, '#fixed'); await page.evaluate(() => window.scrollTo(0, 100)); await aligned(page, '#fixed'); observations.fixedScroll = await gap(page, '#fixed');
  await page.evaluate(() => window.scrollTo(0, 0)); await clickCenter(page, '#absolute'); await page.evaluate(() => window.scrollTo(0, 100)); await aligned(page, '#absolute');
  await page.evaluate(() => window.scrollTo(0, 0)); await clickCenter(page, '#sticky');
  await page.locator('#sticky-scroll').evaluate(node => { node.scrollTop = 85; }); await aligned(page, '#sticky'); observations.stickyScroll = await gap(page, '#sticky');
  await page.locator('#scroller').evaluate(node => { node.scrollTop = 60; });
  await page.locator('#inner-scroller').evaluate(node => { node.scrollTop = 60; });
  await clickCenter(page, '#scroll-target'); expect((await selection(page))?.id).toBe('scroll-target'); await aligned(page, '#scroll-target');
  await page.locator('#inner-scroller').evaluate(node => { node.scrollTop = 65; }); await aligned(page, '#scroll-target');
  await page.locator('#scroller').evaluate(node => { node.scrollTop = 65; }); await aligned(page, '#scroll-target'); observations.nestedScroll = await gap(page, '#scroll-target');
  await page.setViewportSize({ width: 1100, height: 900 }); await aligned(page, '#scroll-target');
  await evidence(info, observations);
});

test('A03 positional layout shifts transforms and ancestor movement invalidate geometry automatically', async ({ page }, info) => {
  await launch(page); await clickCenter(page, '#absolute'); await aligned(page, '#absolute');
  await page.waitForTimeout(100); // Let the initial ResizeObserver notification finish before mutation.
  await page.locator('#absolute').evaluate(node => { (node as HTMLElement).style.left = '95px'; });
  await aligned(page, '#absolute'); const moved = await gap(page, '#absolute');
  await page.evaluate(() => window.selectionAudit.picker.refresh()); await aligned(page, '#absolute');
  await clickCenter(page, '#transformed'); await aligned(page, '#transformed');
  await page.waitForTimeout(100);
  await page.locator('#transformed').evaluate(node => { (node as HTMLElement).style.transform = 'translateX(70px) rotate(10deg)'; });
  await aligned(page, '#transformed'); const transformed = await gap(page, '#transformed');
  await page.evaluate(() => window.selectionAudit.picker.refresh()); await aligned(page, '#transformed');
  const before = await page.evaluate(() => ({ scans: window.selectionAudit.picker.sourceStats().scopeScans, cascade: window.selectionAudit.picker.cascadeStats().resolutions }));
  await page.locator('main').evaluate(node => { (node as HTMLElement).style.transform = 'translate(20px,15px)'; }); await aligned(page, '#transformed');
  const after = await page.evaluate(() => ({ scans: window.selectionAudit.picker.sourceStats().scopeScans, cascade: window.selectionAudit.picker.cascadeStats().resolutions }));
  expect(after).toEqual(before);
  await evidence(info, { moved, transformed, ancestor: await gap(page, '#transformed'), before, after });
});

test('A04 translated and scaled document roots align the viewport overlay while clipping remains deferred', async ({ page }, info) => {
  await launch(page); await page.evaluate(() => { document.documentElement.style.transform = 'translate(30px,20px)'; });
  await clickCenter(page, '#absolute'); await aligned(page, '#absolute'); const rootTransform = await gap(page, '#absolute');
  await page.evaluate(() => { document.documentElement.style.transform = 'translate(30px,20px) scale(.8)'; }); await aligned(page, '#absolute'); const rootScale = await gap(page, '#absolute');
  await page.evaluate(() => { document.documentElement.style.transform = ''; window.selectionAudit.picker.refresh(); }); await aligned(page, '#absolute');
  const clip = (await page.locator('#clip').boundingBox())!; await start(page); await page.mouse.click(clip.x + 20, clip.y + 20);
  expect((await selection(page))?.id).toBe('clipped-child'); await aligned(page, '#clipped-child');
  const clipping = await page.evaluate(() => ({ target: window.selectionAudit.picker.getSnapshot().selection!.rect, clip: document.querySelector('#clip')!.getBoundingClientRect().toJSON() }));
  expect(clipping.target.width).toBe(160); expect(clipping.clip.width).toBe(80);
  await evidence(info, { rootTransform, rootScale, clipping });
});

test('A05 SVG internals remain distinct edit targets with accurate bounding boxes and a use instance boundary', async ({ page }, info) => {
  await launch(page); const cases: Record<string, unknown>[] = [];
  for (const selector of ['#svg-path', '#svg-rect', '#svg-circle', '#svg-use', '#svg-text']) {
    await clickCenter(page, selector); expect((await selection(page))?.id).toBe(selector.slice(1)); await aligned(page, selector);
    const data = await page.evaluate(() => {
      const picker = window.selectionAudit.picker, state = picker.editor.getSnapshot(), selected = picker.getSnapshot().selection!;
      const applied = picker.editor.apply(state.design!.targetId, 'opacity', '.45');
      const node = document.querySelector(`#${selected.id}`)!;
      return { selected, applied, opacity: getComputedStyle(node).opacity, source: picker.source(), canSize: state.design?.canSize, path: window.selectionAudit.paths.at(-1) };
    });
    expect(data.applied).toBe(true); expect(data.opacity).toBe('0.45'); cases.push(data);
    await page.evaluate(() => window.selectionAudit.picker.parent()); expect((await selection(page))?.id).toBe('svg-root');
  }
  const svg = (await page.locator('#svg-root').boundingBox())!; await start(page); await page.mouse.click(svg.x + 300, svg.y + 100);
  expect((await selection(page))?.id).toBe('svg-root'); await aligned(page, '#svg-root');
  const rootEdit = await page.evaluate(() => { const picker = window.selectionAudit.picker; return picker.editor.apply(picker.editor.getSnapshot().design!.targetId, 'opacity', '.35'); });
  expect(rootEdit).toBe(true); expect(await page.locator('#svg-root').evaluate(node => getComputedStyle(node).opacity)).toBe('0.35');
  const root = await selection(page); await clickCenter(page, '#svg-rect');
  const rectSizing = await page.evaluate(() => {
    const picker = window.selectionAudit.picker, node = document.querySelector<SVGRectElement>('#svg-rect')!;
    const before = node.getBBox().width, editorApplied = picker.editor.apply(picker.editor.getSnapshot().design!.targetId, 'width', '80px');
    const error = picker.editor.getSnapshot().error;
    const editedWidth = node.getBBox().width;
    const heightApplied = picker.editor.apply(picker.editor.getSnapshot().design!.targetId, 'height', '50px');
    return { before, editorApplied, error, editedWidth, heightApplied, editedHeight: node.getBBox().height };
  });
  expect(rectSizing.editorApplied).toBe(true); expect(rectSizing.error).toBeNull(); expect(rectSizing.editedWidth).toBe(80);
  expect(rectSizing.heightApplied).toBe(true); expect(rectSizing.editedHeight).toBe(50); await aligned(page, '#svg-rect');
  await evidence(info, { cases, root, rootEdit, rectSizing });
});

test('A06 tiny zero-size hidden nodes and pseudo-elements reveal hit and navigation boundaries', async ({ page }, info) => {
  await launch(page); await clickCenter(page, '#tiny'); expect((await selection(page))?.id).toBe('tiny');
  await page.waitForTimeout(75); const tiny = { selection: await selection(page), gap: await gap(page, '#tiny') };
  expect(tiny.selection?.rect.width).toBe(1); expect(tiny.gap.width).toBe(0); expect(tiny.gap.height).toBe(0);
  await clickCenter(page, '#zero-host'); await page.evaluate(() => window.selectionAudit.picker.child());
  expect((await selection(page))?.id).toBe('zero'); const zero = await selection(page);
  expect(zero?.rect.width).toBe(0); expect(zero?.rect.height).toBe(0);
  await expect(page.getByTestId('target-outline')).toBeHidden();
  await page.evaluate(() => window.selectionAudit.picker.next()); expect((await selection(page))?.id).toBe('hidden-css');
  const hidden = await selection(page); expect(hidden?.rect.width).toBe(0);
  const box = (await page.locator('#pseudo').boundingBox())!; const pseudos: unknown[] = [];
  for (const y of [box.y + 12, box.y + 32]) { await start(page); await page.mouse.click(box.x + 35, y); expect((await selection(page))?.id).toBe('pseudo'); pseudos.push(await page.evaluate(() => ({ selection: window.selectionAudit.picker.getSnapshot().selection, path: window.selectionAudit.paths.at(-1) }))); }
  await page.evaluate(() => { const picker = window.selectionAudit.picker; picker.editor.setContext({ media: [], pseudo: '::before' }); picker.editor.apply(picker.editor.getSnapshot().design!.targetId, 'color', 'red'); });
  expect(await page.locator('#pseudo').evaluate(node => getComputedStyle(node, '::before').color)).toBe('rgb(255, 0, 0)');
  await evidence(info, { tiny, zero, hidden, pseudos });
});

test('A07 open nested shadow roots slots and closed hosts retain truthful scope boundaries', async ({ page }, info) => {
  await launch(page); const cases: Record<string, unknown>[] = [];
  for (const selector of ['#shadow-button', '#nested-shadow', '#slotted']) {
    await clickCenter(page, selector); expect((await selection(page))?.id).toBe(selector.slice(1)); await aligned(page, selector);
    const data = await page.evaluate(() => {
      const picker = window.selectionAudit.picker, design = picker.editor.getSnapshot().design!;
      const applied = picker.editor.apply(design.targetId, 'font-size', '25px');
      const selected = picker.getSnapshot().selection!, outer = document.querySelector('#outer-host')!.shadowRoot!, inner = outer.querySelector('#inner-host')!.shadowRoot!;
      const x = selected.rect.x + selected.rect.width / 2, y = selected.rect.y + selected.rect.height / 2;
      return { selection: selected, source: picker.source(), applied, candidates: picker.candidates().map(item => item.element.id), path: window.selectionAudit.paths.at(-1), pointStacks: selected.id === 'nested-shadow' ? { document: document.elementsFromPoint(x, y).map(node => node.id || node.localName), outer: outer.elementsFromPoint(x, y).map(node => node.id || node.localName), inner: inner.elementsFromPoint(x, y).map(node => node.id || node.localName) } : undefined };
    });
    expect(data.applied).toBe(true); expect(await page.locator(selector).evaluate(node => getComputedStyle(node).fontSize)).toBe('25px'); cases.push(data);
    if (selector === '#shadow-button') { await page.evaluate(() => window.selectionAudit.picker.parent()); expect((await selection(page))?.id).toBe('open-host'); }
    if (selector === '#nested-shadow') {
      expect(data.candidates[0]).toBe('nested-shadow'); expect(data.candidates).toContain('inner-host'); expect(data.candidates).toContain('outer-host');
      await page.evaluate(() => window.selectionAudit.picker.parent()); expect((await selection(page))?.id).toBe('inner-host');
      await page.evaluate(() => window.selectionAudit.picker.parent()); expect((await selection(page))?.id).toBe('outer-host');
    }
  }
  await page.evaluate(() => window.selectionAudit.picker.parent()); expect((await selection(page))?.id).toBe('slot');
  await page.evaluate(() => window.selectionAudit.picker.parent()); expect((await selection(page))?.id).toBe('slot-wrap');
  await page.evaluate(() => window.selectionAudit.picker.parent()); expect((await selection(page))?.id).toBe('slot-host');
  await page.evaluate(() => window.selectionAudit.picker.child()); expect((await selection(page))?.id).toBe('slot-wrap');
  await page.evaluate(() => window.selectionAudit.picker.child()); expect((await selection(page))?.id).toBe('slot');
  const slot = await selection(page); expect(slot?.hasChild).toBe(true);
  const tree = await page.evaluate(() => window.selectionAudit.picker.tree()); expect(tree.rows.some(row => row.elementId === 'slotted')).toBe(true);
  await page.evaluate(() => window.selectionAudit.picker.child()); expect((await selection(page))?.id).toBe('slotted');
  await clickCenter(page, '#closed-host'); expect((await selection(page))?.id).toBe('closed-host'); expect((await selection(page))?.hasChild).toBe(false);
  await evidence(info, { cases, slotNavigation: slot, closedBoundary: await selection(page) });
});

test('A08 copied markers are contained before paint and strong replacement retires the old marker', async ({ page }, info) => {
  await launch(page); await clickCenter(page, '#dynamic');
  const result = await page.evaluate(async () => {
    const picker = window.selectionAudit.picker, old = document.querySelector<HTMLElement>('#dynamic')!;
    const targetId = picker.editor.getSnapshot().design!.targetId;
    picker.editor.apply(targetId, 'font-size', '31px');
    const marker = old.getAttributeNames().find(name => name.startsWith('data-cssforge-target'))!;
    const duplicate = old.cloneNode(true) as HTMLElement; duplicate.id = 'duplicated-target'; duplicate.style.left = '450px'; old.parentElement!.append(duplicate);
    const synchronousClone = getComputedStyle(duplicate).fontSize; // Keep evidence of the CSS/MO microtask boundary.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const duplicated = { original: getComputedStyle(old).fontSize, clone: getComputedStyle(duplicate).fontSize, copiedMarker: duplicate.getAttribute(marker) };
    duplicate.remove();
    const replacement = old.cloneNode(true) as HTMLElement; old.replaceWith(replacement);
    const immediate = { disconnected: !old.isConnected, replacementFont: getComputedStyle(replacement).fontSize, marker: replacement.getAttribute(marker), pickerSelection: picker.getSnapshot().selection, designTarget: picker.editor.getSnapshot().design?.targetId, source: picker.source() };
    await new Promise<void>(resolve => setTimeout(resolve, 150));
    const settled = { selection: picker.getSnapshot().selection, design: picker.editor.getSnapshot().design, layerCount: document.querySelectorAll('style[data-cssforge-edit-layer]').length, replacementFont: getComputedStyle(replacement).fontSize, reconciliation: picker.reconciliation().state, oldMarker: replacement.getAttribute(marker), markerCount: replacement.getAttributeNames().filter(name => name.startsWith('data-cssforge-target')).length };
    const edit = picker.editor.apply(targetId, 'font-size', '40px'); const error = picker.editor.getSnapshot().error;
    picker.editor.reset();
    return { synchronousClone, duplicated, immediate, settled, edit, error, afterReset: { font: getComputedStyle(replacement).fontSize, marker: replacement.getAttribute(marker), layers: document.querySelectorAll('style[data-cssforge-edit-layer]').length } };
  });
  expect(result.duplicated).toEqual({ original: '31px', clone: '18px', copiedMarker: null }); expect(result.immediate.disconnected).toBe(true);
  expect(result.settled.replacementFont).toBe('31px'); expect(result.settled.selection?.id).toBe('dynamic'); expect(result.settled.design).not.toBeNull();
  expect(result.settled).toMatchObject({ layerCount: 1, reconciliation: 'migrated', oldMarker: null, markerCount: 1 }); expect(result.edit).toBe(true); expect(result.error).toBeNull();
  expect(result.afterReset).toEqual({ font: '18px', marker: null, layers: 0 });
  await evidence(info, result);
});

test('A15 marker containment handles nested copies and fails closed on oversized insertions', async ({ page }, info) => {
  await launch(page); await clickCenter(page, '#dynamic');
  const result = await page.evaluate(async () => {
    const picker = window.selectionAudit.picker, old = document.querySelector('#dynamic')!;
    picker.editor.apply(picker.editor.getSnapshot().design!.targetId, 'font-size', '31px');
    const copy = old.cloneNode(true) as HTMLElement; copy.id = 'nested-copy';
    const wrapper = document.createElement('div'); wrapper.append(copy); document.body.append(wrapper);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const contained = { font: getComputedStyle(copy).fontSize, marker: copy.getAttributeNames().some(name => name.startsWith('data-cssforge-target')), original: getComputedStyle(old).fontSize };
    const large = document.createElement('div'); for (let i = 0; i < 300; i++) large.append(document.createElement('span'));
    document.body.append(large); await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const quarantine = { selected: picker.getSnapshot().selection, design: picker.editor.getSnapshot().design, layers: document.querySelectorAll('style[data-cssforge-edit-layer]').length, font: getComputedStyle(old).fontSize };
    picker.destroy(); return { contained, quarantine };
  });
  expect(result.contained).toEqual({ font: '18px', marker: false, original: '31px' });
  expect(result.quarantine).toEqual({ selected: null, design: null, layers: 0, font: '18px' }); await evidence(info, result);
});

test('A09 removal rerender and root moves consistently invalidate picker editing and source state', async ({ page }, info) => {
  await launch(page); await clickCenter(page, '#dynamic');
  const plain = await page.evaluate(async () => {
    const picker = window.selectionAudit.picker, id = picker.editor.getSnapshot().design!.targetId;
    const old = document.querySelector('#dynamic')!; const fresh = document.createElement('div'); fresh.id = 'dynamic'; fresh.className = 'box'; fresh.textContent = 'Unmarked replacement'; old.replaceWith(fresh);
    await new Promise<void>(resolve => setTimeout(resolve, 150)); return { selection: picker.getSnapshot().selection, design: picker.editor.getSnapshot().design, edit: picker.editor.apply(id, 'color', 'red'), replacementColor: getComputedStyle(fresh).color };
  });
  expect(plain.selection).toBeNull(); expect(plain.design).toBeNull(); expect(plain.edit).toBe(false);
  await clickCenter(page, '#dynamic-sibling');
  await page.locator('#dynamic-sibling').evaluate(node => node.remove());
  await expect.poll(() => selection(page)).toBeNull();
  await clickCenter(page, '#absolute');
  const moved = await page.evaluate(() => {
    const picker = window.selectionAudit.picker, node = document.querySelector('#absolute')!;
    document.querySelector('#open-host')!.shadowRoot!.append(node);
    picker.refresh(); picker.source(true);
    return { selection: picker.getSnapshot().selection, design: picker.editor.getSnapshot().design, error: picker.editor.getSnapshot().error };
  });
  expect(moved.design).toBeNull(); expect(moved.selection).toBeNull();
  await page.waitForTimeout(100); const movedSettled = await selection(page); expect(movedSettled).toBeNull();
  await expect(page.getByTestId('target-outline')).toBeHidden();
  await evidence(info, { plain, moved, movedSettled });
});

test('A10 frames isolate pointer events and do not receive the built content script', async ({}, info) => {
  const { page, context, errors } = await setup(info, fixture.replace('<cssforge-ui></cssforge-ui>', ''), routes);
  try {
    const frames: Record<string, unknown>[] = [];
    for (const id of ['same-frame', 'cross-frame']) {
      const frame = page.frameLocator(`#${id}`); await expect(frame.locator('#frame-button')).toBeVisible();
      const topBefore = await identity(page).textContent();
      await frame.locator('#frame-button').click(); const afterInside = await identity(page).textContent();
      expect(afterInside).toBe(topBefore);
      expect(await frame.locator('cssforge-ui').count()).toBe(0); expect(await frame.locator('cssforge-overlay').count()).toBe(0);
      const b = (await page.locator(`#${id}`).boundingBox())!; await page.mouse.click(b.x + 1, b.y + 1);
      await expect(identity(page)).toHaveText(`iframe#${id}`);
      await expect.poll(async () => { const target = (await page.locator(`#${id}`).boundingBox())!, outline = (await page.getByTestId('target-outline').boundingBox())!; return Math.max(...(['x', 'y', 'width', 'height'] as const).map(key => Math.abs(target[key] - outline[key]))); }).toBeLessThan(1);
      const boundary = await page.locator(`#${id}`).evaluate(node => { const frame = node as HTMLIFrameElement; return { accessible: !!frame.contentDocument, rect: frame.getBoundingClientRect().toJSON() }; });
      frames.push({ id, insideSelection: afterInside, boundary, childUI: 0 });
      await dock(page).getByRole('button', { name: 'Pick page element', exact: true }).click();
    }
    expect(errors).toEqual([]); await evidence(info, { frames, permissions: ['activeTab', 'scripting'], injection: 'top frame only' });
  } finally { await context.close(); }
});

test('A11 cascade-blocked edits are distinct from wrong target edits and rerenders', async ({ page }, info) => {
  await launch(page); await page.evaluate(() => { const style = document.createElement('style'); style.textContent = '#absolute{font-size:24px!important}'; document.head.append(style); });
  await clickCenter(page, '#absolute');
  const result = await page.evaluate(() => {
    const picker = window.selectionAudit.picker, design = picker.editor.getSnapshot().design!;
    const applied = picker.editor.apply(design.targetId, 'font-size', '31px');
    const node = document.querySelector('#absolute')!;
    return { applied, computed: getComputedStyle(node).fontSize, marker: node.getAttributeNames().filter(name => name.startsWith('data-cssforge-target')), selection: picker.getSnapshot().selection, field: picker.editor.getSnapshot().design!.values['font-size'], cascade: picker.cascade()!.properties['font-size'] };
  });
  expect(result.applied).toBe(true); expect(result.computed).toBe('24px'); expect(result.selection?.id).toBe('absolute');
  expect(result.field.override).toBe('31px'); expect(result.cascade.winner?.source.kind).toBe('style');
  expect(result.cascade.overridden.some(item => item.candidate.source.kind === 'override' && item.reason === 'specificity')).toBe(true);
  await evidence(info, result);
});

test('A12 raw hover remains bounded and teardown removes markers layers overlays and observers', async ({ page }, info) => {
  await launch(page);
  const result = await page.evaluate(async () => {
    const audit = window.selectionAudit, picker = audit.picker, a = document.querySelector('#absolute')!, b = document.querySelector('#transformed')!;
    // Exclude initialization/Playwright frame-coordinate reads from the measured pointer burst.
    Object.keys(audit.geometry).forEach(key => delete audit.geometry[key]);
    picker.start(); const start = { scans: picker.sourceStats().scopeScans, cascade: picker.cascadeStats().resolutions };
    for (let i = 0; i < 1000; i++) (i % 2 ? a : b).dispatchEvent(new PointerEvent('pointermove', { bubbles: true, composed: true }));
    const raw = { ...audit.geometry }; await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const hover = { scans: picker.sourceStats().scopeScans, cascade: picker.cascadeStats().resolutions, geometry: { ...audit.geometry }, moves: audit.moves };
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    const id = picker.editor.getSnapshot().design!.targetId; picker.editor.apply(id, 'font-size', '26px'); picker.source(); picker.cascade();
    picker.destroy(); const before = { ...audit.geometry };
    for (let i = 0; i < 1000; i++) a.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, composed: true }));
    window.dispatchEvent(new Event('resize')); a.remove(); await new Promise<void>(resolve => setTimeout(resolve, 75));
    return { start, raw, hover, cleanup: { geometryUnchanged: JSON.stringify(before) === JSON.stringify(audit.geometry), overlays: document.querySelectorAll('cssforge-overlay').length, layers: document.querySelectorAll('style[data-cssforge-edit-layer]').length, markers: document.querySelector('#transformed')!.getAttributeNames().filter(name => name.startsWith('data-cssforge-target')), selection: picker.getSnapshot().selection } };
  });
  expect(result.start).toEqual({ scans: 0, cascade: 0 }); expect(result.raw).toEqual({});
  expect(result.hover.scans).toBe(0); expect(result.hover.cascade).toBe(0); expect(result.hover.moves).toBe(1000);
  expect(result.hover.geometry.absolute).toBe(1); expect(result.cleanup).toEqual({ geometryUnchanged: true, overlays: 0, layers: 0, markers: [], selection: null });
  await evidence(info, result);
});

test('A13 built zoom Code editing and strong DOM replacement preserve geometry and session styling', async ({}, info) => {
  const { page, context, worker, tabId, errors, action } = await setup(info, extensionFixture.replace('id="checkout"', 'id="checkout" style="font-size:18px"'));
  try {
    await extensionPick(page, '#checkout');
    await worker.evaluate(async id => chrome.tabs.setZoom(id, 2), tabId);
    const boxes = async () => { const target = await page.locator('#checkout').boundingBox(), outline = await page.getByTestId('target-outline').boundingBox(); return { target, outline }; };
    await expect.poll(async () => { const { target, outline } = await boxes(); return Math.max(...(['x', 'y', 'width', 'height'] as const).map(key => Math.abs(target![key] - outline![key]))); }).toBeLessThan(1);
    const zoom = await boxes(); await worker.evaluate(async id => chrome.tabs.setZoom(id, 1), tabId);
    await page.getByRole('tab', { name: 'Code', exact: true }).click();
    const inline = page.getByRole('region', { name: 'Inline authored CSS' });
    await inline.getByRole('button', { name: 'Edit font-size', exact: true }).click();
    const input = inline.getByRole('textbox', { name: 'CSS value font-size', exact: true }); await input.fill('31px'); await input.press('Enter');
    await expect(page.locator('#checkout')).toHaveCSS('font-size', '31px');
    await page.evaluate(() => { const old = document.querySelector('#checkout')!; old.replaceWith(old.cloneNode(true)); });
    await expect(identity(page)).toHaveText('button#checkout.primary'); await expect(page.getByTestId('live-code')).toBeVisible();
    await expect(page.locator('#checkout')).toHaveCSS('font-size', '31px');
    expect(await page.locator('style[data-cssforge-edit-layer]').count()).toBe(1);
    await action(); await expect(page.locator('cssforge-ui')).toHaveCount(0); await expect(page.locator('#checkout')).toHaveCSS('font-size', '18px');
    expect(errors).toEqual([]); await evidence(info, { zoom, replacement: 'Strong unique same-root replacement receives a fresh marker and preserved Code editing state; deactivation removes all session styling.' });
  } finally { await context.close(); }
});

test('A14 removing an already zero-size target clears without a size notification or explicit refresh', async ({ page }, info) => {
  await launch(page); await clickCenter(page, '#zero-host'); await page.evaluate(() => window.selectionAudit.picker.child());
  await page.waitForTimeout(100);
  const result = await page.evaluate(async () => {
    const picker = window.selectionAudit.picker, node = document.querySelector('#zero')!, id = picker.editor.getSnapshot().design!.targetId;
    node.remove(); await new Promise<void>(resolve => setTimeout(resolve, 200));
    const stale = { selection: picker.getSnapshot().selection, designTarget: picker.editor.getSnapshot().design?.targetId, connected: node.isConnected, source: picker.source() };
    const edit = picker.editor.apply(id, 'color', 'red'); const error = picker.editor.getSnapshot().error;
    picker.refresh(); await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    return { stale, edit, error, afterRefresh: picker.getSnapshot().selection };
  });
  await evidence(info, result);
  expect(result.stale.connected).toBe(false); expect(result.stale.selection).toBeNull(); expect(result.stale.designTarget).toBeUndefined();
  expect(result.stale.source).toBeNull(); expect(result.edit).toBe(false); expect(result.afterRefresh).toBeNull();
});

test('A16 geometry mutations coalesce and same-root reparenting rebinds lifecycle observers', async ({ page }, info) => {
  await launch(page); await clickCenter(page, '#absolute'); await page.waitForTimeout(100);
  const measurement = await page.evaluate(async () => {
    const audit = window.selectionAudit, node = document.querySelector<HTMLElement>('#absolute')!;
    Object.keys(audit.geometry).forEach(key => delete audit.geometry[key]);
    const before = { scans: audit.picker.sourceStats().scopeScans, cascade: audit.picker.cascadeStats().resolutions };
    for (let i = 0; i < 1000; i++) node.style.left = `${40 + i % 100}px`;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return { geometry: { ...audit.geometry }, before, after: { scans: audit.picker.sourceStats().scopeScans, cascade: audit.picker.cascadeStats().resolutions } };
  });
  expect(measurement.geometry.absolute).toBe(1); expect(measurement.after).toEqual(measurement.before); await aligned(page, '#absolute');
  await page.evaluate(() => {
    const picker = window.selectionAudit.picker; picker.editor.apply(picker.editor.getSnapshot().design!.targetId, 'font-size', '31px');
    const parent = document.createElement('section'); parent.id = 'new-parent'; parent.style.cssText = 'position:absolute;left:100px;top:50px;width:500px;height:300px';
    document.body.append(parent); parent.append(document.querySelector('#absolute')!);
  });
  await aligned(page, '#absolute'); expect((await selection(page))?.id).toBe('absolute');
  await page.locator('#new-parent').evaluate(node => { (node as HTMLElement).style.transform = 'translate(30px,20px)'; }); await aligned(page, '#absolute');
  await page.locator('#new-parent').evaluate(node => node.remove());
  await expect.poll(() => selection(page)).toBeNull(); expect(await page.locator('style[data-cssforge-edit-layer]').count()).toBe(0);
  await evidence(info, measurement);
});
