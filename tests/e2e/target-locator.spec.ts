import { test, expect, type CDPSession, type Page, type TestInfo } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { setup, pick, identity } from './extensionHarness';
const fixture = await readFile('tests/e2e/fixtures/target-locator.html', 'utf8');

async function launch(info: TestInfo, html: string) {
  const runtime = await setup(info, fixture.replace('<!-- scene -->', html));
  const cdp = await runtime.context.newCDPSession(runtime.page), worlds: { id: number; origin: string }[] = [];
  cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context)); await cdp.send('Runtime.enable');
  const world = worlds.find(item => item.origin.startsWith('chrome-extension://'))!; expect(world).toBeTruthy();
  // Test-only isolated-world inspection of the real React context; no production globals/hooks.
  await evaluate(cdp, world.id, `globalThis.__locatorPicker=(()=>{
    const node=document.querySelector('cssforge-ui').shadowRoot.querySelector('[data-cssforge]');
    let fiber=node[Object.getOwnPropertyNames(node).find(key=>key.startsWith('__reactFiber$'))];
    for(let depth=0;fiber&&depth<32;depth++,fiber=fiber.return){if(fiber.memoizedProps?.picker)return fiber.memoizedProps.picker;if(fiber.memoizedProps?.value?.picker)return fiber.memoizedProps.value.picker;}
    throw new Error('Built picker context not found');
  })(); true`);
  const read = <T = any>(expression: string) => evaluate<T>(cdp, world.id, expression);
  const outcome = () => read(`(()=>{const p=__locatorPicker,r=p.locatorResult();return r&&{state:r.state,id:r.element?.id||null,key:r.element?.getAttribute('data-product-id')||null,card:r.element?.closest('article')?.getAttribute('data-id')||null,count:r.candidateCount,confidence:r.confidence,evidence:r.evidenceUsed,reason:r.reason,rejected:r.rejected.map(item=>item.reasons),selection:p.getSnapshot().selection,design:p.editor.getSnapshot().design?.targetId||null,boundaries:p.targetLocator().boundaries.length};})()`);
  return { ...runtime, read, outcome };
}
async function evaluate<T>(cdp: CDPSession, contextId: number, expression: string): Promise<T> {
  const output = await cdp.send('Runtime.evaluate', { contextId, expression, returnByValue: true, awaitPromise: true });
  if (output.exceptionDetails) throw new Error(JSON.stringify(output.exceptionDetails)); return output.result.value as T;
}
async function lost(page: Page) { await expect(identity(page)).toHaveText('No element selected'); await expect(page.getByTestId('live-design')).toHaveCount(0); await expect(page.getByTestId('live-code')).toHaveCount(0); }
async function evidence(info: TestInfo, result: unknown) {
  const directory = info.title.startsWith('L01 ') ? 'artifacts/diagnostics/reconciliation' : 'artifacts/diagnostics/target-locator'; await mkdir(directory, { recursive: true });
  const file = `${directory}/${info.title.split(' ')[0]}.json`; await writeFile(file, JSON.stringify(result, null, 2)); await info.attach('locator-outcome', { path: file, contentType: 'application/json' });
}

test('L01 built original authority hover performance and strong unique ID reconciliation', async ({}, info) => {
  const { page, context, read, outcome, errors } = await launch(info, '<button id="save" type="button">Save</button><button id="other">Other</button>');
  try {
    const before = await read('__locatorPicker.locatorStats()');
    const raw = await read(`(()=>{globalThis.__locatorRects=0;const a=document.querySelector('#save'),b=document.querySelector('#other');for(const e of [a,b]){const original=e.getBoundingClientRect.bind(e);e.getBoundingClientRect=()=>{__locatorRects++;return original();};}for(let i=0;i<1000;i++)(i%2?a:b).dispatchEvent(new PointerEvent('pointermove',{bubbles:true,composed:true}));return {locator:__locatorPicker.locatorStats(),geometry:__locatorRects,source:__locatorPicker.sourceStats(),cascade:__locatorPicker.cascadeStats()};})()`);
    expect(raw.locator).toEqual(before); expect(raw.geometry).toBe(0); expect(raw.source.scopeScans).toBe(0); expect(raw.cascade.resolutions).toBe(0);
    await read('new Promise(resolve=>requestAnimationFrame(()=>resolve(true)))'); expect(await read('__locatorRects')).toBe(1);
    await pick(page, '#save'); const captured = await read('__locatorPicker.locatorStats()');
    await read('__locatorPicker.resolveTarget().state'); expect((await outcome()).state).toBe('original-valid');
    const valid = await read('__locatorPicker.locatorStats()'); expect(valid.queries).toBe(captured.queries); expect(valid.searches).toBe(0);
    await page.locator('#save').evaluate(node => { (node as HTMLElement).style.transform = 'translateX(30px)'; });
    await page.waitForTimeout(100); expect((await read('__locatorPicker.locatorStats()')).captures).toBe(1);
    const input = page.getByRole('textbox', { name: 'Font size', exact: true }); await input.fill('31'); await input.press('Enter'); await expect(page.locator('#save')).toHaveCSS('font-size', '31px');
    await page.getByRole('tab', { name: 'Code', exact: true }).click();
    const logicalTarget = await read('__locatorPicker.editor.getSnapshot().design.targetId');
    await page.locator('#save').evaluate(node => node.replaceWith(node.cloneNode(true)));
    await expect.poll(() => read('__locatorPicker.reconciliation().state')).toBe('migrated');
    const result = await outcome(); expect(result).toMatchObject({ state: 'resolved-unique', id: 'save', confidence: 'strong', selection: { id: 'save' }, design: logicalTarget });
    await expect(page.locator('#save')).toHaveCSS('font-size', '31px'); expect(await page.locator('style[data-cssforge-edit-layer]').count()).toBe(1);
    expect(await read('__locatorPicker.editor.getSnapshot().undoCount')).toBe(1); await expect(page.getByTestId('live-code')).toBeVisible();
    expect(errors).toEqual([]); await evidence(info, { before, raw, captured, valid, result });
  } finally { await context.close(); }
});

const cases = [
  { label: 'L02 duplicate ID', html: '<button id="save">Save</button>', replacement: '<button id="save">A</button><button id="save">B</button>', state: 'ambiguous' },
  { label: 'L03 stable application data', html: '<button data-product-id="42">Buy</button>', replacement: '<button data-product-id="42" class="active">Buy again</button>', state: 'resolved-unique' },
  { label: 'L04 duplicated stable data', html: '<button data-product-id="42">Buy</button>', replacement: '<button data-product-id="42">A</button><button data-product-id="42">B</button>', state: 'ambiguous' },
  { label: 'L05 class-only ambiguity', html: '<button class="primary">Buy</button>', replacement: '<button class="primary">A</button><button class="primary">B</button><button class="primary">C</button>', state: 'ambiguous' },
  { label: 'L06 incompatible same-ID tag', html: '<button id="save">Buy</button>', replacement: '<a id="save" href="/save">Buy</a>', state: 'unsafe' },
  { label: 'L07 semantic combination', html: '<button name="save-order" type="button">Save</button>', replacement: '<button type="button" name="save-order">Localized</button>', state: 'resolved-unique' },
  { label: 'L08 missing replacement', html: '<button id="save">Buy</button>', replacement: '<p>Removed</p>', state: 'missing' },
  { label: 'L09 candidate cap', html: '<button class="primary">Buy</button>', replacement: '<button class="primary">Duplicate</button>'.repeat(70), state: 'truncated' },
];
for (const example of cases) test(`${example.label} returns a truthful built resolver state`, async ({}, info) => {
  const { page, context, outcome, errors } = await launch(info, example.html);
  try {
    await pick(page, 'main > button'); await page.locator('main').evaluate((main, html) => { main.innerHTML = html; }, example.replacement); await lost(page);
    const result = await outcome(); expect(result.state).toBe(example.state); expect(result.selection).toBeNull(); expect(result.design).toBeNull();
    if (example.state !== 'resolved-unique') expect(result.id).toBeNull(); expect(errors).toEqual([]); await evidence(info, result);
  } finally { await context.close(); }
});

test('L10 built repeated cards sibling insertion removal and list reordering use stable ancestry', async ({}, info) => {
  const { page, context, read, outcome, errors } = await launch(info, ['1', '2', '3'].map(id => `<article data-id="${id}"><span>Product</span><button class="buy active">Buy</button></article>`).join(''));
  try {
    await pick(page, 'article[data-id="2"] button');
    await page.evaluate(() => { const card = document.querySelector('article[data-id="2"]')!; card.prepend(document.createElement('span')); card.querySelector('span')!.remove(); card.parentElement!.prepend(card); });
    expect(await read('__locatorPicker.resolveTarget().state')).toBe('original-valid'); expect((await read('__locatorPicker.locatorStats()')).searches).toBe(0);
    await page.locator('article[data-id="2"] button').evaluate(node => { const fresh = document.createElement('button'); fresh.className = 'buy'; fresh.textContent = 'Acheter'; node.replaceWith(fresh); }); await lost(page);
    const result = await outcome(); expect(result).toMatchObject({ state: 'resolved-unique', card: '2', selection: null, design: null }); expect(errors).toEqual([]); await evidence(info, result);
  } finally { await context.close(); }
});

test('L11 built copied marker contributes zero confidence for a weak clone', async ({}, info) => {
  const { page, context, read, outcome, errors } = await launch(info, '<button class="primary">Buy</button>');
  try {
    await pick(page, 'main > button'); const input = page.getByRole('textbox', { name: 'Font size', exact: true }); await input.fill('31'); await input.press('Enter');
    const captured = await read('__locatorPicker.targetLocator().evidence'); expect(captured.attributes.some((item: { name: string }) => item.name.startsWith('data-cssforge'))).toBe(false);
    await page.locator('main > button').evaluate(node => node.replaceWith(node.cloneNode(true))); await lost(page);
    const result = await outcome(); expect(result.state).toBe('unsafe'); await expect(page.locator('main > button')).toHaveCSS('font-size', '16px'); expect(errors).toEqual([]); await evidence(info, { captured, result });
  } finally { await context.close(); }
});

for (const nested of [false, true]) test(`L${nested ? '13' : '12'} built ${nested ? 'nested' : 'open'} root replacement ignores identical IDs in other roots`, async ({}, info) => {
  const { page, context, outcome, read, errors } = await launch(info, '<button id="same">Document duplicate</button><div id="open-a"></div><div id="open-b"></div><div id="outer-host"></div>');
  try {
    const selector = nested ? '#outer-host #inner-host #same' : '#open-a #same'; await pick(page, selector);
    await page.locator(selector).evaluate(node => { const fresh = document.createElement('button'); fresh.id = 'same'; fresh.textContent = 'Replacement'; fresh.style.padding = '12px'; node.replaceWith(fresh); }); await lost(page);
    const result = await outcome(); expect(result).toMatchObject({ state: 'resolved-unique', boundaries: nested ? 2 : 1, count: 1 });
    expect(await read(`__locatorPicker.resolveTarget({candidate:document.querySelector('#open-b').shadowRoot.querySelector('#same')}).state`)).toBe('root-mismatch');
    expect(errors).toEqual([]); await evidence(info, result);
  } finally { await context.close(); }
});

test('L14 built root move slotted ownership document mismatch and frame placeholder are conservative', async ({}, info) => {
  const { page, context, read, outcome, errors } = await launch(info, '<div id="open-a"></div><div id="slot-host"><button id="slotted" data-key="slot-buy">Slotted</button></div><iframe srcdoc="<button>Frame</button>"></iframe>');
  try {
    await pick(page, '#slotted'); expect(await read('__locatorPicker.targetLocator().boundaries.length')).toBe(0);
    expect(await read('__locatorPicker.resolveTarget({frame:"interior"}).state')).toBe('unsupported-frame');
    expect(await read('__locatorPicker.resolveTarget({document:document.querySelector("iframe").contentDocument}).state')).toBe('document-mismatch');
    await page.locator('#slotted').evaluate(node => document.querySelector('#open-a')!.shadowRoot!.append(node)); await lost(page);
    const result = await outcome(); expect(result.state).toBe('root-mismatch'); expect(errors).toEqual([]); await evidence(info, result);
  } finally { await context.close(); }
});
