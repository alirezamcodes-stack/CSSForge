import { test, expect, type CDPSession, type TestInfo } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { setup, pick, dock } from './extensionHarness';
const fixture = await readFile('tests/e2e/fixtures/target-locator.html', 'utf8');

async function launch(info: TestInfo, html: string) {
  const runtime = await setup(info, fixture.replace('<!-- scene -->', html));
  const cdp = await runtime.context.newCDPSession(runtime.page), worlds: { id: number; origin: string }[] = [];
  cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context)); await cdp.send('Runtime.enable');
  const world = worlds.find(item => item.origin.startsWith('chrome-extension://'))!; expect(world).toBeTruthy();
  const read = async <T = any>(expression: string): Promise<T> => {
    const output = await cdp.send('Runtime.evaluate', { contextId: world.id, expression, returnByValue: true, awaitPromise: true });
    if (output.exceptionDetails) throw new Error(JSON.stringify(output.exceptionDetails)); return output.result.value;
  };
  // Test-only isolated-world access to the actual built picker; no production instrumentation.
  await read(`globalThis.__selectorPicker=(()=>{
    const node=document.querySelector('cssforge-ui').shadowRoot.querySelector('[data-cssforge]');
    let fiber=node[Object.getOwnPropertyNames(node).find(key=>key.startsWith('__reactFiber$'))];
    for(let depth=0;fiber&&depth<32;depth++,fiber=fiber.return){if(fiber.memoizedProps?.picker)return fiber.memoizedProps.picker;if(fiber.memoizedProps?.value?.picker)return fiber.memoizedProps.value.picker;}
    throw new Error('Built picker context not found');
  })(); true`);
  const generate = (request = {}) => read(`(()=>{
    const r=__selectorPicker.generateSelector(${JSON.stringify(request)}); if(!r)return null; globalThis.__selectorResult=r;
    // Independent native Chrome validation, including complete boundary traversal from Document.
    let root=document, proof=true;
    const path=r.path.map(segment=>{const matches=root.querySelectorAll(segment.selector);const valid=root===segment.root&&matches.length===1&&matches[0]===segment.target;proof=proof&&valid;if(segment.boundary)root=matches[0]?.shadowRoot;return {selector:segment.selector,scope:segment.scope,boundary:segment.boundary,count:matches.length,valid};});
    if(r.state==='unique')proof=proof&&r.path.at(-1)?.target===__selectorPicker.targetLocator().identity.element&&root===r.root;
    return {selector:r.selector,state:r.state,strategy:r.strategy,origin:r.origin,stability:r.stability,risks:r.risks,validation:r.validation,scope:r.scope,path,proof,context:r.context,limitations:r.limitations,stats:__selectorPicker.selectorStats()};
  })()`);
  return { ...runtime, read, generate };
}
async function evidence(info: TestInfo, result: unknown) {
  const directory = 'test-results/diagnostics/selectors'; await mkdir(directory, { recursive: true });
  const file = `${directory}/${info.title.split(' ')[0]}.json`; await writeFile(file, JSON.stringify(result, null, 2)); await info.attach('selector-outcome', { path: file, contentType: 'application/json' });
}
function unique(result: any) { expect(result).toMatchObject({ state: 'unique', origin: 'generated', proof: true, validation: { count: 1, matchesTarget: true } }); expect(result.path.every((segment: any) => segment.valid)).toBe(true); expect(result.selector).not.toContain('cssforge'); }

test('S01 built escaping IDs and zero selector work in hover Design and Code editing', async ({}, info) => {
  const { page, context, read, generate, errors } = await launch(info, '<button id="probe">Target</button><button id="other">Other</button>');
  try {
    await read(`(()=>{const a=document.querySelector('#probe'),b=document.querySelector('#other');for(let i=0;i<1000;i++)(i%2?a:b).dispatchEvent(new PointerEvent('pointermove',{bubbles:true,composed:true}));return true;})()`);
    await pick(page, '#probe'); const font = page.getByRole('textbox', { name: 'Font size', exact: true }); await font.fill('31'); await font.press('Enter');
    await page.getByRole('tab', { name: 'Code', exact: true }).click();
    const overrides = page.getByTestId('live-code').getByRole('region', { name: 'CSSForge overrides', exact: true });
    await overrides.getByRole('button', { name: 'Edit font-size', exact: true }).click(); const cssValue = overrides.getByRole('textbox', { name: 'CSS value font-size', exact: true }); await cssValue.fill('32px'); await cssValue.press('Enter'); await expect(page.locator('#probe')).toHaveCSS('font-size', '32px');
    expect(await read('__selectorPicker.selectorStats()')).toEqual({ requests: 0, generations: 0, validations: 0, cacheHits: 0 });
    const outcomes = [];
    for (const id of ['checkout', '123buy', 'a:b.c#d', 'a b', '日本語-🎨', '-1', 'quote"slash\\end']) {
      await read(`__selectorPicker.targetLocator().identity.element.id=${JSON.stringify(id)}; true`);
      const result = await generate({ refresh: true }); unique(result); expect(result.strategy).toBe('stable-id'); expect(result.selector).toBe(await read(`'#'+CSS.escape(${JSON.stringify(id)})`)); outcomes.push(result);
    }
    await read(`__selectorPicker.targetLocator().identity.element.id='react-random'; true`);
    const generatedID = await generate({ refresh: true }); unique(generatedID); expect(generatedID).toMatchObject({ strategy: 'id', stability: 'low', risks: ['generated-id-may-change'] }); outcomes.push(generatedID);
    await evidence(info, outcomes); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

const examples = [
  { label: 'S02 duplicate ID chooses stable data', html: '<button id="dup" data-product-id="42">Target</button><button id="dup">Other</button>', pick: 'main > button:first-child', strategy: 'stable-attribute', selector: '[data-product-id="42"]' },
  { label: 'S03 duplicate attribute uses semantic name', html: '<button data-testid="buy" name="order">Target</button><button data-testid="buy">Other</button>', pick: '[name="order"]', strategy: 'semantic', selector: '[name="order"]' },
  { label: 'S04 unique class uses smallest combination', html: '<button class="buy primary quiet">Target</button><button class="primary quiet">Other</button>', pick: '.buy', strategy: 'class-based', selector: '.buy' },
  { label: 'S05 minimal pair ignores state hash and CSSForge classes', html: '<button class="primary buy active css-a12bd3 control__a1b2c3 cssforge-edit-7" data-cssforge-target-copy="7">Target</button><button class="primary">Other</button><button class="buy">Other</button>', pick: 'main > button:first-child', strategy: 'class-based', selector: '.buy.primary' },
  { label: 'S06 repeated cards use stable ancestor', html: '<article data-product-id="1"><button class="buy">Buy</button></article><article data-product-id="42"><button class="buy">Target</button></article>', pick: '[data-product-id="42"] button', strategy: 'ancestor-assisted', selector: '[data-product-id="42"] .buy' },
  { label: 'S07 structural fallback ignores temporary markers and generated edit IDs', html: '<button id="cssforge-edit-7" class="active css-a12bd3" data-cssforge-target-copy="7">Target</button><button>Other</button>', pick: 'main > button:first-child', strategy: 'structural', selector: 'button:nth-of-type(1)' },
];
for (const example of examples) test(`${example.label} with independent Chrome proof`, async ({}, info) => {
  const { page, context, generate, errors } = await launch(info, example.html);
  try { await pick(page, example.pick); const result = await generate(); unique(result); expect(result.strategy).toBe(example.strategy); expect(result.selector).toBe(example.selector); if (example.strategy === 'structural') expect(result.stability).toBe('low'); await evidence(info, result); expect(errors).toEqual([]); }
  finally { await context.close(); }
});

test('S08 escaped attribute quotes and bounded attribute pair are parsed by Chrome', async ({}, info) => {
  const { page, context, read, generate, errors } = await launch(info, '<button data-testid="buy" name="order">Target</button><button data-testid="buy" name="cancel">Other</button><button name="order">Other</button>');
  try {
    await pick(page, 'main > button:first-child'); const pair = await generate(); unique(pair); expect(pair.selector).toBe('[data-testid="buy"][name="order"]');
    await read(`__selectorPicker.targetLocator().identity.element.setAttribute('data-testid',${JSON.stringify('say "hello" \\ 日本語')}); true`);
    const escaped = await generate({ refresh: true }); unique(escaped); expect(escaped.strategy).toBe('stable-attribute'); await evidence(info, { pair, escaped }); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S09 cache revalidation class order stable ancestry DOM reorder and sibling insertion', async ({}, info) => {
  const { page, context, read, generate, errors } = await launch(info, '<article data-id="1"><button class="buy primary">Buy</button></article><article data-id="2"><button class="buy primary">Target</button></article>');
  try {
    await pick(page, '[data-id="2"] button'); const first = await generate(); unique(first);
    await page.locator('[data-id="2"]').evaluate(card => { card.parentElement!.prepend(card); card.prepend(document.createElement('span')); card.querySelector('button')!.className = 'primary buy active'; });
    const reused = await generate(); unique(reused); expect(reused.selector).toBe(first.selector); expect(reused.stats.generations).toBe(first.stats.generations); expect(reused.stats.cacheHits).toBe(1);
    await page.locator('[data-id="2"] button').evaluate(button => { const other = button.cloneNode(true) as Element; other.textContent = 'Duplicate'; button.before(other); });
    const changed = await generate(); unique(changed); expect(changed.strategy).toBe('structural'); expect(changed.selector).not.toBe(first.selector);
    await read('__selectorPicker.invalidateSelector(); true'); const refreshed = await generate(); unique(refreshed); expect(refreshed.stats.generations).toBe(changed.stats.generations + 1);
    await evidence(info, { first, reused, changed, refreshed }); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

for (const nested of [false, true]) test(`S${nested ? '11' : '10'} built ${nested ? 'nested' : 'open'} Shadow DOM paths prove every segment in its actual root`, async ({}, info) => {
  const { page, context, read, generate, errors } = await launch(info, '<button id="same" class="buy">Document duplicate</button><div id="open-a"></div><div id="open-b"></div><div id="outer-host"></div>');
  try {
    await pick(page, nested ? '#outer-host #inner-host #same' : '#open-a #same');
    await read(`__selectorPicker.targetLocator().identity.element.className='buy'; true`);
    const result = await generate(); unique(result); expect(result.scope).toBe('shadow-root'); expect(result.path).toHaveLength(nested ? 3 : 2); expect(result.selector).toBe('#same'); expect(result.path[0].scope).toBe('document'); expect(result.path.at(-1).boundary).toBeNull();
    // Duplicate a host ID in the parent root: cached host segment must also be revalidated.
    await page.locator(nested ? '#outer-host' : '#open-a').evaluate(host => { const duplicate = document.createElement('div'); duplicate.id = host.id; host.before(duplicate); });
    const changed = await generate(); unique(changed); expect(changed.path[0].selector).not.toBe(result.path[0].selector); await evidence(info, { result, changed }); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S12 actual SVG internals slotted light DOM and outer iframe keep original target and root', async ({}, info) => {
  const { page, context, generate, read, errors } = await launch(info, '<svg id="vector" width="320" height="130" style="display:block"><rect id="rectangle" x="0" y="0" width="45" height="45"/><circle id="round" cx="90" cy="25" r="20"/><path id="curve" d="M130 0H175V45H130Z"/><use id="reuse" href="#rectangle" x="200"/><text id="label" x="5" y="95" font-size="30">Vector text</text></svg><div id="slot-host"><button id="slotted">Slotted</button></div><iframe id="frame" srcdoc="<button>Interior</button>" style="width:200px;height:50px"></iframe>');
  try {
    const outcomes = [];
    for (const id of ['vector', 'rectangle', 'round', 'curve', 'reuse', 'label', 'slotted', 'frame']) {
      if (id === 'vector') {
        const start = dock(page).getByRole('button', { name: 'Pick page element', exact: true }); if (await start.count()) await start.click(); const box = await page.locator('#vector').boundingBox(); await page.mouse.click(box!.x + 305, box!.y + 115);
      } else if (id === 'frame') {
        await dock(page).getByRole('button', { name: 'Pick page element', exact: true }).click(); const box = await page.locator('#frame').boundingBox(); await page.mouse.click(box!.x + 1, box!.y + 1);
      } else await pick(page, '#'+id);
      expect(await read('__selectorPicker.targetLocator().identity.element.id')).toBe(id);
      const result = await generate(); unique(result); expect(result.selector).toBe('#'+id); expect(result.scope).toBe('document'); expect(result.path).toHaveLength(1); outcomes.push(result);
    }
    const unsupported = await generate({ frame: 'interior' }); expect(unsupported.state).toBe('unsupported'); await evidence(info, { outcomes, unsupported }); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S15 bounded triple class combination and reordered classes remain minimal', async ({}, info) => {
  const { page, context, generate, errors } = await launch(info, '<button class="alpha beta gamma">Target</button><button class="alpha beta">Other</button><button class="alpha gamma">Other</button><button class="beta gamma">Other</button>');
  try {
    await pick(page, 'main > button:first-child'); const first = await generate(); unique(first); expect(first.selector).toBe('.alpha.beta.gamma');
    await page.locator('main > button:first-child').evaluate(target => target.setAttribute('class', 'gamma active alpha beta'));
    const reordered = await generate({ refresh: true }); unique(reordered); expect(reordered.selector).toBe(first.selector); await evidence(info, { first, reordered }); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S16 semantic attributes and framework data filtering use native CSS validation', async ({}, info) => {
  const { page, context, read, generate, errors } = await launch(info, '<button id="probe">Target</button><button>Other</button>');
  try {
    await pick(page, '#probe'); const outcomes = [];
    for (const [name, value] of [['name', 'order'], ['type', 'submit'], ['role', 'switch'], ['aria-label', 'Save "order"']]) {
      await read(`(()=>{const e=__selectorPicker.targetLocator().identity.element;for(const name of [...e.attributes].map(a=>a.name))if(!name.startsWith('data-cssforge'))e.removeAttribute(name);e.setAttribute(${JSON.stringify(name)},${JSON.stringify(value)});e.setAttribute('data-react-key','tempting');return true;})()`);
      const result = await generate({ refresh: true }); unique(result); expect(result.strategy).toBe('semantic'); expect(result.selector).not.toContain('data-react'); outcomes.push(result);
    }
    await evidence(info, outcomes); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S17 long ancestry and shadow depth stop with truncated results', async ({}, info) => {
  const { page, context, read, generate, errors } = await launch(info, '<button id="probe">Target</button>');
  try {
    await pick(page, '#probe');
    await read(`(()=>{const target=__selectorPicker.targetLocator().identity.element;target.removeAttribute('id');const branch=()=>{const top=document.createElement('section');let next=top;for(let i=0;i<12;i++){const child=document.createElement('section');next.append(child);next=child;}return {top,next};};const a=branch(),b=branch();target.before(a.top,b.top);a.next.append(target);b.next.append(document.createElement('button'));return true;})()`);
    const deep = await generate(); expect(deep.state).toBe('truncated'); expect(deep.stats.validations).toBeLessThanOrEqual(96);
    // Build a deeply nested open shadow target, then use real picker events to select it.
    await page.evaluate(() => { document.querySelector('main')!.innerHTML = '<div id="deep-host"></div>'; let host = document.querySelector('#deep-host')!; for (let i = 0; i < 10; i++) { const root = host.attachShadow({ mode: 'open' }); root.innerHTML = '<div></div>'; host = root.firstElementChild!; } host.innerHTML = '<button style="padding:12px">Deep target</button>'; });
    await pick(page, '#deep-host button'); const shadow = await generate(); expect(shadow.state).toBe('truncated'); await evidence(info, { deep, shadow }); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S18 stable application attribute precedes semantic evidence regardless of DOM attribute order', async ({}, info) => {
  const { page, context, generate, errors } = await launch(info, '<button name="order" aria-label="Save" data-product-id="42">Target</button><button>Other</button>');
  try { await pick(page, '[name="order"]'); const result = await generate(); unique(result); expect(result.selector).toBe('[data-product-id="42"]'); expect(result.stability).toBe('high'); await evidence(info, result); expect(errors).toEqual([]); }
  finally { await context.close(); }
});

test('S13 authored source text non uniqueness invalid syntax and pseudo media groups remain separate', async ({}, info) => {
  const { page, context, read, generate, errors } = await launch(info, '<style>@media(min-width:800px){@supports(display:grid){@layer theme{.buy:hover{color:red}}}}.buy{font-size:16px}</style><button class="buy" data-key="order">Target</button><button class="buy">Other</button>');
  try {
    await pick(page, '[data-key="order"]'); await page.getByRole('tab', { name: 'Code', exact: true }).click();
    const source = await read(`__selectorPicker.source().rules.map(group=>({selector:group.selector,conditions:group.conditions}))`);
    expect(source.some((rule: any) => rule.selector === '.buy:hover' && rule.conditions.some((condition: string) => condition.includes('@layer theme')))).toBe(true);
    const authored = await read(`(()=>{const r=__selectorPicker.validateAuthoredSelector(' .buy ');return {selector:r.selector,state:r.state,origin:r.origin,count:r.validation.count};})()`);
    expect(authored).toEqual({ selector: ' .buy ', state: 'non-unique', origin: 'authored', count: 2 });
    const invalid = await read(`__selectorPicker.validateAuthoredSelector('[').state`); expect(invalid).toBe('invalid');
    const pseudoElement = await read(`__selectorPicker.validateAuthoredSelector('.buy::before').state`); expect(pseudoElement).toBe('non-unique');
    const result = await generate({ context: { pseudo: '::before', media: ['(min-width:800px)'], groups: [{ id: 'author-layer', kind: 'layer', text: '@layer theme', name: 'theme', matches: null }] } });
    unique(result); expect(result.selector).toBe('[data-key="order"]'); expect(result.context.pseudo).toBe('::before'); expect(result.context.groups[0].text).toBe('@layer theme'); await evidence(info, { source, authored, invalid, pseudoElement, result }); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S14 built bounds report truncation and unsafe binding cannot produce cached unique selector', async ({}, info) => {
  const { page, context, read, generate, errors } = await launch(info, '<button>Target</button>');
  try {
    await pick(page, 'main > button'); const first = await generate(); unique(first);
    await read(`(()=>{const target=__selectorPicker.targetLocator().identity.element;for(let i=0;i<140;i++){const sibling=document.createElement('button');sibling.style.display='none';target.before(sibling);}return true;})()`);
    const truncated = await generate(); expect(truncated.state).toBe('truncated'); expect(truncated.validation.matchesTarget).toBe(false); expect(truncated.stats.validations - first.stats.validations).toBeLessThanOrEqual(96);
    await read(`__selectorPicker.targetLocator().identity.element.remove(); true`); expect(await generate()).toBeNull(); await evidence(info, { first, truncated }); expect(errors).toEqual([]);
  } finally { await context.close(); }
});
