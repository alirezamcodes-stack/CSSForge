import { test, expect, type TestInfo } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { setup, pick, identity, dock } from './extensionHarness';
const fixture = await readFile('tests/e2e/fixtures/target-locator.html', 'utf8');
async function launch(info: TestInfo, html: string) {
  const runtime = await setup(info, fixture.replace('<!-- scene -->', html));
  const cdp = await runtime.context.newCDPSession(runtime.page), worlds: { id: number; origin: string }[] = [];
  cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context)); await cdp.send('Runtime.enable');
  const world = worlds.find(item => item.origin.startsWith('chrome-extension://'))!;
  const read = async <T = any>(expression: string): Promise<T> => {
    const output = await cdp.send('Runtime.evaluate', { contextId: world.id, expression, returnByValue: true, awaitPromise: true });
    if (output.exceptionDetails) throw new Error(JSON.stringify(output.exceptionDetails)); return output.result.value;
  };
  await read(`globalThis.__recoPicker=(()=>{const node=document.querySelector('cssforge-ui').shadowRoot.querySelector('[data-cssforge]');let fiber=node[Object.getOwnPropertyNames(node).find(key=>key.startsWith('__reactFiber$'))];for(let depth=0;fiber&&depth<32;depth++,fiber=fiber.return){if(fiber.memoizedProps?.picker)return fiber.memoizedProps.picker;if(fiber.memoizedProps?.value?.picker)return fiber.memoizedProps.value.picker;}throw new Error('Built picker missing');})();globalThis.__retired=[];true`);
  const outcome = () => read(`(()=>{const p=__recoPicker,r=p.reconciliation(),e=p.targetLocator()?.identity.element,s=p.editor.getSnapshot();return {state:r.state,generation:r.generation,attempts:r.attempts,reason:r.reason,resolution:r.resolution?.state,confidence:r.resolution?.confidence,selection:p.getSnapshot().selection?.id||null,targetId:s.design?.targetId||null,undo:s.undoCount,context:s.context,overrides:s.overrides,locator:p.locatorStats(),reconciliation:p.reconciliationStats(),source:p.sourceStats(),cascade:p.cascadeStats(),selectors:p.selectorStats(),markers:e?[...e.attributes].filter(a=>a.name.startsWith('data-cssforge-target')).map(a=>a.name):[],retired:__retired.map(e=>({connected:e.isConnected,markers:[...e.attributes].filter(a=>a.name.startsWith('data-cssforge-target')).map(a=>a.name)}))};})()`);
  const remember = () => read(`__retired.push(__recoPicker.targetLocator().identity.element);true`);
  const waitMigrated = () => expect.poll(async () => (await outcome()).state).toBe('migrated');
  return { ...runtime, read, outcome, remember, waitMigrated };
}
async function edit(page: Parameters<typeof pick>[0], name = 'Font size', value = '32') {
  const input = page.getByRole('textbox', { name, exact: true }); await input.fill(value); await input.press('Enter');
}
async function evidence(info: TestInfo, result: unknown) {
  const directory = 'test-results/diagnostics/reconciliation'; await mkdir(directory, { recursive: true });
  const file = `${directory}/${info.title.split(' ')[0]}.json`; await writeFile(file, JSON.stringify(result, null, 2)); await info.attach('reconciliation-outcome', { path: file, contentType: 'application/json' });
}

const basics = [
  { label: 'R01 unique ID', old: '<button id="save">Old</button>', fresh: '<button id="save" style="font-size:20px">Fresh</button>', selector: '#save', migrated: true },
  { label: 'R02 stable data', old: '<button data-product-id="42">Old</button>', fresh: '<button data-product-id="42">Fresh</button>', selector: '[data-product-id="42"]', migrated: true },
  { label: 'R03 strong semantics', old: '<button name="order" type="button">Old</button>', fresh: '<button name="order" type="button">Fresh</button>', selector: '[name="order"]', migrated: true },
  { label: 'R04 class only', old: '<button class="primary">Old</button>', fresh: '<button class="primary">Fresh</button>', selector: '.primary', migrated: false },
  { label: 'R05 duplicate IDs', old: '<button id="save">Old</button>', fresh: '<button id="save">A</button><button id="save">B</button>', selector: '#save', migrated: false },
  { label: 'R06 duplicate stable data', old: '<button data-key="order">Old</button>', fresh: '<button data-key="order">A</button><button data-key="order">B</button>', selector: '[data-key="order"]', migrated: false },
];
for (const example of basics) test(`${example.label} transfers only proven ownership`, async ({}, info) => {
  const { page, context, read, outcome, remember, waitMigrated, errors } = await launch(info, example.old);
  try {
    await pick(page, example.selector); await edit(page); const before = await outcome(); await remember();
    await page.getByRole('tab', { name: 'Code', exact: true }).click();
    await page.locator('main').evaluate((main, html) => main.innerHTML = html, example.fresh);
    if (example.migrated) {
      await waitMigrated(); const result = await outcome(); expect(result.targetId).toBe(before.targetId); expect(result.undo).toBe(before.undo); expect(result.markers).toHaveLength(1); expect(result.markers[0]).not.toBe(before.markers[0]); expect(result.retired.every((e: any) => !e.markers.length)).toBe(true);
      await expect(page.locator(example.selector)).toHaveCSS('font-size', '32px'); await expect(page.getByTestId('live-code')).toContainText('32px');
      if (example.label.startsWith('R01')) { await expect(page.getByTestId('live-code').getByRole('region', { name: 'Inline authored CSS' })).toContainText('20px'); await expect(page.locator('#save')).toHaveAttribute('style', 'font-size:20px'); }
      await page.getByRole('tab', { name: 'Design', exact: true }).click(); await expect(page.getByRole('textbox', { name: 'Font size', exact: true })).toHaveValue('32');
      await read('__recoPicker.editor.undo();true'); await expect(page.locator(example.selector)).toHaveCSS('font-size', example.label.startsWith('R01') ? '20px' : '16px'); expect((await outcome()).undo).toBe(0);
    } else {
      await expect(identity(page)).toHaveText('No element selected'); await expect(page.getByTestId('live-code')).toHaveCount(0); expect((await outcome()).reconciliation.migrations).toBe(0);
      for (const node of await page.locator(example.selector).all()) await expect(node).toHaveCSS('font-size', '16px');
    }
    await evidence(info, { before, result: await outcome() }); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('R07 stable card ancestor reconciles after reorder and new authored context invalidates caches', async ({}, info) => {
  const { page, context, read, outcome, remember, waitMigrated, errors } = await launch(info, '<style>article:first-child button{color:green}article:last-child button{color:purple}</style><article data-id="1"><button class="buy">Buy</button></article><article data-id="42"><button class="buy">Old</button></article>');
  try {
    await pick(page, '[data-id="42"] button'); await edit(page); await read('__recoPicker.source();__recoPicker.cascade();__recoPicker.generateSelector();true'); const before = await outcome(); await remember();
    await page.locator('[data-id="42"]').evaluate(card => { card.parentElement!.prepend(card); card.querySelector('button')!.outerHTML = '<button class="buy">Fresh</button>'; });
    await waitMigrated(); await expect(page.locator('[data-id="42"] button')).toHaveCSS('font-size', '32px');
    const cache = await read(`(()=>{const p=__recoPicker;return {source:p.source().rules.map(r=>r.selector),cascade:p.cascade().properties.color,selector:p.generateSelector().selector};})()`);
    expect(cache.source).toContain('article:first-child button'); expect(cache.source).not.toContain('article:last-child button'); expect(cache.selector).toContain('data-id="42"');
    expect((await outcome()).selectors.generations).toBe(before.selectors.generations + 1); await evidence(info, { before, cache, result: await outcome() }); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

for (const [id, timing] of [['R08', 'same'], ['R09', 'next'], ['R10', 'delayed']] as const) test(`${id} ${timing} microtask/task replacement within the bounded window`, async ({}, info) => {
  const { page, context, read, outcome, remember, waitMigrated, errors } = await launch(info, '<button id="save">Old</button>');
  try {
    await pick(page, '#save'); await edit(page); await remember();
    await page.evaluate(timing => { const target = document.querySelector('#save')!, parent = target.parentElement!; target.remove(); const insert = () => parent.insertAdjacentHTML('beforeend', '<button id="save">Fresh</button>'); if (timing === 'same') queueMicrotask(insert); else if (timing === 'next') queueMicrotask(() => queueMicrotask(insert)); else setTimeout(insert, 150); }, timing);
    await waitMigrated(); await expect(page.locator('#save')).toHaveCSS('font-size', '32px'); const result = await outcome(); expect(result.reconciliation.resolutions).toBeLessThanOrEqual(6); expect(result.undo).toBe(1); expect(result.selectors.requests).toBe(0); await evidence(info, result); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('R11 window expiration prevents late resurrection and waiting does no source or cascade work', async ({}, info) => {
  const { page, context, read, outcome, remember, errors } = await launch(info, '<button id="save">Old</button>');
  try {
    await pick(page, '#save'); await edit(page); await remember(); await page.locator('#save').evaluate(node => node.remove());
    await expect.poll(async () => (await outcome()).state).toBe('waiting-for-replacement'); const waiting = await outcome();
    await page.evaluate(() => { for (let i = 0; i < 5; i++) { const span = document.createElement('span'); span.textContent = 'Unrelated'; document.querySelector('main')!.append(span); } });
    await expect.poll(async () => (await outcome()).state).toBe('missing'); const expired = await outcome(); expect(expired.source).toEqual(waiting.source); expect(expired.cascade).toEqual(waiting.cascade); expect(expired.reconciliation.resolutions).toBe(waiting.reconciliation.resolutions);
    await page.evaluate(() => document.querySelector('main')!.insertAdjacentHTML('beforeend', '<button id="save">Late</button>')); await page.waitForTimeout(150);
    await expect(identity(page)).toHaveText('No element selected'); await expect(page.locator('#save')).toHaveCSS('font-size', '16px'); expect((await outcome()).state).toBe('missing'); await evidence(info, { waiting, expired, result: await outcome() }); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('R12 repeated A B C migration retains one owner disabled state context and coherent undo/reset history', async ({}, info) => {
  const { page, context, read, outcome, remember, waitMigrated, errors } = await launch(info, '<style>@media(min-width:800px){#save:hover{letter-spacing:1px}}</style><button id="save">A</button>');
  try {
    await pick(page, '#save'); await edit(page, 'Font size', '24'); await edit(page, 'Font size', '32'); await edit(page, 'Letter spacing', '3');
    await read(`(()=>{const e=__recoPicker.editor,id=e.getSnapshot().design.targetId;e.toggle(id,{media:[],pseudo:''},'letter-spacing');e.setContext({media:['(min-width: 800px)'],pseudo:':hover'});e.apply(id,'color','#ff0000');return true;})()`);
    const before = await outcome(); expect(before.context.pseudo).toBe(':hover');
    for (const label of ['B', 'C']) {
      await remember(); await page.locator('#save').evaluate((node, label) => node.outerHTML = `<button id="save">${label}</button>`, label); await waitMigrated();
      const result = await outcome(); expect(result.targetId).toBe(before.targetId); expect(result.undo).toBe(before.undo); expect(result.context).toEqual(before.context); expect(result.overrides).toEqual(before.overrides); expect(result.markers).toHaveLength(1); await expect(page.locator('#save')).toHaveCSS('font-size', '32px');
    }
    await page.waitForTimeout(150); const current = await outcome(); expect(current.reconciliation.migrations).toBe(2); expect(current.retired.every((node: any) => !node.markers.length)).toBe(true);
    await read('__recoPicker.editor.undo();__recoPicker.editor.undo();__recoPicker.editor.undo();__recoPicker.editor.undo();true'); await expect(page.locator('#save')).toHaveCSS('font-size', '24px');
    await read('__recoPicker.editor.reset();true'); expect((await outcome()).undo).toBe(0); expect((await outcome()).markers).toHaveLength(0); await expect(page.locator('#save')).toHaveCSS('font-size', '16px'); expect(await page.locator('style[data-cssforge-edit-layer]').count()).toBe(0); await evidence(info, { before, current, result: await outcome() }); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

for (const nested of [false, true]) test(`R${nested ? '14' : '13'} same ${nested ? 'nested' : 'open'} ShadowRoot replacement migrates only inside captured root`, async ({}, info) => {
  const { page, context, read, outcome, remember, waitMigrated, errors } = await launch(info, '<button id="same">Document duplicate</button><div id="open-a"></div><div id="open-b"></div><div id="outer-host"></div>');
  try {
    const selector = nested ? '#outer-host #inner-host #same' : '#open-a #same'; await pick(page, selector); await edit(page); await remember();
    await page.locator(selector).evaluate(node => node.outerHTML = '<button id="same" style="padding:12px">Fresh</button>'); await waitMigrated(); await expect(page.locator(selector)).toHaveCSS('font-size', '32px'); await expect(page.locator('#open-b #same')).toHaveCSS('font-size', '13.3333px');
    await read('__recoPicker.editor.undo();true'); await expect(page.locator(selector)).not.toHaveCSS('font-size', '32px'); await evidence(info, await outcome()); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('R15 replaced shadow host or cross-root move never migrates', async ({}, info) => {
  const { page, context, outcome, remember, errors } = await launch(info, '<div id="open-a"></div><div id="open-b"></div><button id="save">Old</button>');
  try {
    await pick(page, '#open-a #same'); await edit(page); await remember(); await page.locator('#open-a').evaluate(host => { const next = document.createElement('div'); next.id = host.id; next.attachShadow({mode:'open'}).innerHTML = '<button id="same">Fresh</button>'; host.replaceWith(next); });
    await expect(identity(page)).toHaveText('No element selected'); expect((await outcome()).state).toBe('root-mismatch'); await expect(page.locator('#open-a #same')).not.toHaveCSS('font-size','32px');
    await pick(page, '#save'); await edit(page); await page.locator('#save').evaluate(node => document.querySelector('#open-b')!.shadowRoot!.append(node)); await expect(identity(page)).toHaveText('No element selected'); expect((await outcome()).state).toBe('root-mismatch'); await expect(page.locator('#open-b #save')).not.toHaveCSS('font-size','32px'); await evidence(info, await outcome()); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('R16 clone markers never authorize weak identity and B1 pre-paint containment remains honest', async ({}, info) => {
  const { page, context, read, outcome, remember, errors } = await launch(info, '<button class="primary">Old</button>');
  try {
    await pick(page, '.primary'); await edit(page); await remember();
    const sync = await page.locator('main > button').evaluate(old => { const copy = old.cloneNode(true) as HTMLElement; old.replaceWith(copy); return getComputedStyle(copy).fontSize; });
    await expect(identity(page)).toHaveText('No element selected'); await expect(page.locator('main > button')).toHaveCSS('font-size', '16px'); expect((await outcome()).reconciliation.migrations).toBe(0);
    const markers = await page.locator('main > button').evaluate(node => node.getAttributeNames().filter(name => name.startsWith('data-cssforge-target'))); expect(markers).toEqual([]); await evidence(info, { synchronousFontSize: sync, result: await outcome() }); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

for (const mode of ['reset', 'repick', 'select-other', 'deactivate'] as const) test(`R${({reset:'17',repick:'18','select-other':'19',deactivate:'20'})[mode]} pending ${mode} cancels stale session resurrection`, async ({}, info) => {
  const { page, context, read, outcome, remember, action, errors } = await launch(info, '<button id="save">Old</button><button id="other">Other</button>');
  try {
    await pick(page, '#save'); await edit(page); await remember(); await page.locator('#save').evaluate(node => node.remove()); await expect.poll(async () => (await outcome()).state).toBe('waiting-for-replacement');
    if (mode === 'reset') await read('__recoPicker.editor.reset();true');
    else if (mode === 'repick') await dock(page).getByRole('button',{name:'Pick page element',exact:true}).click();
    else if (mode === 'select-other') await pick(page, '#other');
    else await action();
    await page.evaluate(() => document.querySelector('main')!.insertAdjacentHTML('beforeend','<button id="save">Late</button>')); await page.waitForTimeout(150); await expect(page.locator('#save')).toHaveCSS('font-size','16px');
    if (mode === 'deactivate') await expect(page.locator('cssforge-ui')).toHaveCount(0);
    else { const result=await outcome(); expect(result.reconciliation.migrations).toBe(0); if(mode==='select-other')expect(result.selection).toBe('other'); else expect(result.selection).toBeNull(); await evidence(info,result); }
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('R21 raw pointer burst and noisy loss observations remain bounded without engine scans', async ({}, info) => {
  const { page, context, read, outcome, errors } = await launch(info, '<button id="save">Old</button><button id="other">Other</button>');
  try {
    const raw=await read(`(()=>{const a=document.querySelector('#save'),b=document.querySelector('#other');for(let i=0;i<1000;i++)(i%2?a:b).dispatchEvent(new PointerEvent('pointermove',{bubbles:true,composed:true}));return {locator:__recoPicker.locatorStats(),reconciliation:__recoPicker.reconciliationStats(),source:__recoPicker.sourceStats(),cascade:__recoPicker.cascadeStats(),selectors:__recoPicker.selectorStats()};})()`);
    expect(raw.locator.requests).toBe(0); expect(raw.reconciliation.starts).toBe(0); expect(raw.reconciliation.resolutions).toBe(0); expect(raw.source.scopeScans).toBe(0); expect(raw.cascade.resolutions).toBe(0); expect(raw.selectors.generations).toBe(0);
    await pick(page,'#save'); await edit(page); await page.locator('#save').evaluate(node=>node.remove()); await expect.poll(async()=>(await outcome()).state).toBe('waiting-for-replacement');
    await page.evaluate(()=>{const parent=document.querySelector('main')!;for(let i=0;i<70;i++)parent.append(document.createElement('button'));});
    await expect.poll(async()=>(await outcome()).state).toBe('migration-rejected'); const result=await outcome();expect(result.reconciliation.resolutions).toBeLessThanOrEqual(6);expect(result.reconciliation.migrations).toBe(0);await evidence(info,{raw,result});expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('R22 replacement already owned by another editing target is rejected', async ({}, info) => {
  const { page, context, read, outcome, errors } = await launch(info, '<button id="save">Old</button><button id="other">Owned</button>');
  try {
    await pick(page,'#other');await edit(page,'Font size','28');await pick(page,'#save');await edit(page);
    await page.evaluate(()=>{document.querySelector('#save')!.remove();document.querySelector('#other')!.id='save';});
    await expect(identity(page)).toHaveText('No element selected');expect((await outcome()).state).toBe('migration-rejected');expect((await outcome()).reconciliation.migrations).toBe(0);await expect(page.locator('#save')).toHaveCSS('font-size','28px');
    await read('__recoPicker.editor.reset();true');await expect(page.locator('#save')).toHaveCSS('font-size','16px');await evidence(info,await outcome());expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('R23 failed style staging rejects migration without author mutation or duplicate transactions', async ({}, info) => {
  const { page, context, read, outcome, errors } = await launch(info, '<button id="save">Old</button>');
  try {
    await pick(page,'#save');await edit(page);const before=await outcome();
    await read(`(()=>{const original=CSSStyleSheet.prototype.insertRule;CSSStyleSheet.prototype.insertRule=function(...args){if(this.ownerNode?.hasAttribute?.('data-cssforge-edit-layer'))throw new Error('Test-only simulated layer rejection');return original.apply(this,args);};return true;})()`);
    await page.locator('#save').evaluate(node=>node.outerHTML='<button id="save" style="font-size:21px">Fresh</button>');await expect(identity(page)).toHaveText('No element selected');expect((await outcome()).state).toBe('migration-rejected');expect((await outcome()).undo).toBe(before.undo);await expect(page.locator('#save')).toHaveCSS('font-size','21px');await expect(page.locator('#save')).toHaveAttribute('style','font-size:21px');expect(await page.locator('style[data-cssforge-edit-layer]').count()).toBe(0);await evidence(info,{before,result:await outcome()});expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('R24 all disabled declarations migrate as disabled and can be reenabled on the new owner', async ({}, info) => {
  const { page, context, read, outcome, waitMigrated, errors } = await launch(info, '<button id="save">Old</button>');
  try {
    await pick(page,'#save');await edit(page);await read(`__recoPicker.editor.toggle(__recoPicker.editor.getSnapshot().design.targetId,{media:[],pseudo:''},'font-size');true`);const before=await outcome();
    await page.locator('#save').evaluate(node=>node.outerHTML='<button id="save">Fresh</button>');await waitMigrated();expect((await outcome()).overrides).toEqual(before.overrides);expect((await outcome()).undo).toBe(before.undo);await expect(page.locator('#save')).toHaveCSS('font-size','16px');expect((await outcome()).markers).toHaveLength(0);
    await read(`__recoPicker.editor.toggle(__recoPicker.editor.getSnapshot().design.targetId,{media:[],pseudo:''},'font-size');true`);await expect(page.locator('#save')).toHaveCSS('font-size','32px');expect((await outcome()).markers).toHaveLength(1);await read('__recoPicker.editor.reset();true');expect((await outcome()).markers).toHaveLength(0);await evidence(info,{before,result:await outcome()});expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('R25 reset removes retired markers from copies inserted after migration without styling them', async ({}, info) => {
  const { page, context, read, outcome, waitMigrated, errors } = await launch(info, '<button id="save">Old</button>');
  try {
    await pick(page,'#save');await edit(page);await page.locator('#save').evaluate(node=>{(window as any).__lateCopy=node.cloneNode(true);node.outerHTML='<button id="save">Fresh</button>';});await waitMigrated();
    await page.evaluate(()=>{const copy=(window as any).__lateCopy as Element;copy.id='late-copy';document.querySelector('main')!.append(copy);});await expect(page.locator('#late-copy')).toHaveCSS('font-size','16px');await expect(page.locator('#save')).toHaveCSS('font-size','32px');
    await read('__recoPicker.editor.reset();true');expect(await page.locator('#late-copy').evaluate(node=>node.getAttributeNames().filter(name=>name.startsWith('data-cssforge-target')))).toEqual([]);expect((await outcome()).markers).toHaveLength(0);await evidence(info,await outcome());expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('R26 repeated migration stops safely at the per-target session bound', async ({}, info) => {
  const { page, context, outcome, errors } = await launch(info, '<button id="save">Old</button>');
  try {
    await pick(page,'#save');await edit(page);
    for(let i=1;i<=16;i++){await page.locator('#save').evaluate(node=>node.outerHTML='<button id="save">Fresh</button>');await expect.poll(async()=>(await outcome()).reconciliation.migrations).toBe(i);await expect(page.locator('#save')).toHaveCSS('font-size','32px');}
    await page.locator('#save').evaluate(node=>node.outerHTML='<button id="save">Limit</button>');await expect(identity(page)).toHaveText('No element selected');await expect(page.locator('#save')).toHaveCSS('font-size','16px');expect((await outcome()).reconciliation.migrations).toBe(16);await evidence(info,await outcome());expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('R27 one oversized added subtree stops before an unbounded candidate walk', async ({}, info) => {
  const { page, context, outcome, errors } = await launch(info, '<button id="save">Old</button>');
  try {
    await pick(page,'#save');await edit(page);await page.locator('#save').evaluate(node=>node.remove());await expect.poll(async()=>(await outcome()).state).toBe('waiting-for-replacement');
    await page.evaluate(()=>{const wrapper=document.createElement('div');wrapper.innerHTML='<button>Noise</button>'.repeat(90);document.querySelector('main')!.append(wrapper);});await expect.poll(async()=>(await outcome()).state).toBe('migration-rejected');const result=await outcome();expect(result.reconciliation.candidateNodes).toBeLessThanOrEqual(64);expect(result.reconciliation.resolutions).toBe(1);await evidence(info,result);expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('R28 native synchronous marker callback cannot commit a replacement after identity becomes ambiguous', async ({}, info) => {
  const { page, context, outcome, errors } = await launch(info, '<button id="save" is="reco-button">Old</button>');
  try {
    await pick(page,'#save');await edit(page);
    await page.locator('#save').evaluate(old=>{const marker=old.getAttributeNames().find(name=>name.startsWith('data-cssforge-target'))!+'-m1';customElements.define('reco-button',class extends HTMLButtonElement{static get observedAttributes(){return [marker];}attributeChangedCallback(_name:string,_previous:string|null,value:string|null){if(value&&this.isConnected){const duplicate=document.createElement('button');duplicate.id='save';duplicate.textContent='Ambiguous during staging';this.after(duplicate);}}},{extends:'button'});old.outerHTML='<button id="save" is="reco-button">Fresh</button>';});
    await expect(identity(page)).toHaveText('No element selected');expect((await outcome()).state).toBe('migration-rejected');expect((await outcome()).reconciliation.migrations).toBe(0);expect(await page.locator('#save').count()).toBe(2);for(const candidate of await page.locator('#save').all())await expect(candidate).toHaveCSS('font-size','16px');expect(await page.locator('style[data-cssforge-edit-layer]').count()).toBe(0);await evidence(info,await outcome());expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('R29 reset during marker quarantine makes the remaining retired ownership callbacks inert', async ({}, info) => {
  const { page, context, read, outcome, errors } = await launch(info, '<button id="save">Old</button><button id="other">Other</button>');
  try {
    await pick(page,'#save');await edit(page);await pick(page,'#other');await edit(page,'Font size','28');await pick(page,'#save');
    await read(`(()=>{let once=true;const e=__recoPicker.editor;e.subscribe(()=>{if(once&&!e.getSnapshot().design){once=false;e.reset();}});return true;})()`);
    await page.evaluate(()=>{const wrapper=document.createElement('div');wrapper.innerHTML='<span>Noise</span>'.repeat(300);document.querySelector('main')!.append(wrapper);});
    await expect(page.locator('#save')).toHaveCSS('font-size','16px');await expect(page.locator('#other')).toHaveCSS('font-size','16px');expect(await page.locator('style[data-cssforge-edit-layer]').count()).toBe(0);expect((await outcome()).undo).toBe(0);expect((await outcome()).reconciliation.migrations).toBe(0);await evidence(info,await outcome());expect(errors).toEqual([]);
  } finally { await context.close(); }
});
