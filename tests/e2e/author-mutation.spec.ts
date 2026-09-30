import { test, expect, type TestInfo, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { setup, pick } from './extensionHarness';

function fixture(css = '', content = '<button id="target">Target</button>', extra = '') {
  return `<!doctype html><html><head><style id="layout">body{margin:0;font-family:Arial}main{padding:70px;width:600px}button{padding:12px;margin:10px}</style><style id="author">${css}</style>${extra}</head><body><main>${content}</main></body></html>`;
}
async function launch(info: TestInfo, html: string, routes?: (page: Page) => Promise<void>) {
  const runtime = await setup(info, html, routes), cdp = await runtime.context.newCDPSession(runtime.page);
  const worlds: { id: number; origin: string }[] = [];
  cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context)); await cdp.send('Runtime.enable');
  const world = worlds.find(item => item.origin.startsWith('chrome-extension://'))!;
  const read = async <T = any>(expression: string): Promise<T> => {
    const result = await cdp.send('Runtime.evaluate', { contextId: world.id, expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value;
  };
  await read(`globalThis.__p=(()=>{const n=document.querySelector('cssforge-ui').shadowRoot.querySelector('[data-cssforge]');let f=n[Object.getOwnPropertyNames(n).find(k=>k.startsWith('__reactFiber$'))];for(let d=0;f&&d<32;d++,f=f.return){if(f.memoizedProps?.picker)return f.memoizedProps.picker;if(f.memoizedProps?.value?.picker)return f.memoizedProps.value.picker;}throw Error('Built picker missing');})();true`);
  const status = () => read(`(()=>{const e=__p.editor,s=e.getSnapshot(),r=s.lastMutation,t=r?.target;return {mode:s.mutationPolicy.mode,state:r?.state,reason:r?.reason,scope:r?.scope??t?.scope,sourceKind:t?.sourceKind,priority:t?.priority,strategy:t?.strategy,writable:t?.writable,undo:s.undoCount,edited:s.editedCount,error:s.error,target:s.design?.targetId,reconciliation:__p.reconciliation().state,overrides:s.overrides,stats:e.authorMutation.getStats()};})()`);
  const author = async (property: string, value: string, options = {}) => read(`__p.editor.applyAuthor(__p.editor.getSnapshot().design.targetId,${JSON.stringify(property)},${JSON.stringify(value)},${JSON.stringify(options)})`);
  return { ...runtime, read, status, author };
}
async function evidence(info: TestInfo, result: unknown) {
  const directory = 'artifacts/diagnostics/author-mutation'; await mkdir(directory, { recursive: true });
  const path = `${directory}/${info.title.split(' ')[0]}.json`; await writeFile(path, JSON.stringify(result, null, 2)); await info.attach('mutation-result', { path, contentType: 'application/json' });
}
async function ruleCSS(page: Page) { return page.locator('#author').evaluate(node => (node as HTMLStyleElement).sheet!.cssRules[0].cssText); }

for (const example of [
  { id: 'M01', property: 'font-size', value: '32px', inline: 'font-size:18px;color:purple;--brand:green', options: {} },
  { id: 'M02', property: 'letter-spacing', value: '3px', inline: 'font-size:18px;color:purple;--brand:green', options: { inline: true } },
  { id: 'M03', property: 'font-size', value: '32px', inline: 'font-size:18px!important;color:purple;--brand:green', options: {} },
  { id: 'M04', property: '--brand', value: '#00ff00', inline: 'font-size:18px;color:purple;--brand:green', options: {} },
]) test(`${example.id} inline declaration preserves unrelated state priority and undo/reset`, async ({}, info) => {
  const r = await launch(info, fixture('', `<button id="target" style="${example.inline}">Target</button>`));
  try {
    await pick(r.page, '#target'); const original = await r.page.locator('#target').evaluate(node => (node as HTMLElement).style.cssText);
    expect(await r.author(example.property, example.value, example.options)).toBe(true); const changed = await r.status(); expect(changed.state).toBe('mutated'); expect(changed.writable).toBe('accepted'); expect(changed.undo).toBe(1); expect(changed.overrides).toEqual([]);
    const css = await r.page.locator('#target').evaluate(node => ({ css: (node as HTMLElement).style.cssText, color: (node as HTMLElement).style.color, priority: (node as HTMLElement).style.getPropertyPriority('font-size') }));
    expect(css.color).toBe('purple'); expect(css.priority).toBe(example.id === 'M03' ? 'important' : ''); expect(css.css).not.toBe(original);
    await r.read('__p.editor.undo();true'); expect(await r.page.locator('#target').evaluate(node => (node as HTMLElement).style.cssText)).toBe(original);
    expect(await r.author(example.property, example.value, example.options)).toBe(true); await r.read('__p.editor.reset();true'); expect(await r.page.locator('#target').evaluate(node => (node as HTMLElement).style.cssText)).toBe(original); expect((await r.status()).undo).toBe(0);
    await evidence(info, { original, changed, restored: await r.status() }); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

for (const example of [
  { id: 'M05', css: '#target{font-size:18px;color:purple;--brand:green}' },
  { id: 'M06', css: '@media(min-width:800px){#target{font-size:18px;color:purple}}', context: { media: ['(min-width: 800px)'], pseudo: '' } },
  { id: 'M07', css: '#target:hover{font-size:18px;color:purple}', context: { media: [], pseudo: ':hover' } },
  { id: 'M08', css: '@supports(display:grid){#target{font-size:18px;color:purple}}' },
  { id: 'M09', css: '@layer theme{#target{font-size:18px;color:purple}}' },
]) test(`${example.id} exact authored rule stays in its grouping context with reversible CSSOM edit`, async ({}, info) => {
  const r = await launch(info, fixture(example.css));
  try {
    await pick(r.page, '#target'); if (example.context) await r.read(`__p.editor.setContext(${JSON.stringify(example.context)});true`);
    const original = await ruleCSS(r.page), sourceText = await r.page.locator('#author').textContent();
    expect(await r.author('font-size', '32px', {allowShared:!!example.context?.pseudo})).toBe(true); const changed = await r.status(); expect(changed.state).toBe('mutated'); expect(changed.sourceKind).toBe('style'); expect(await ruleCSS(r.page)).toContain('32px'); expect(await ruleCSS(r.page)).toContain('purple'); expect(await r.page.locator('#author').textContent()).toBe(sourceText);
    await r.read('__p.editor.undo();true'); expect(await ruleCSS(r.page)).toBe(original);
    await r.author('font-size', '28px', {allowShared:!!example.context?.pseudo}); await r.read('__p.editor.reset();true'); expect(await ruleCSS(r.page)).toBe(original); await evidence(info, { original, changed, restored: await r.status() }); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('M10 same-origin linked stylesheet changes live CSSOM only and restores exact declaration', async ({}, info) => {
  const r = await launch(info, fixture('', undefined, '<link id="linked" rel="stylesheet" href="/mutation-author.css">'), async page => {
    await page.route('**/mutation-author.css', route => route.fulfill({ contentType: 'text/css', body: '#target{font-size:18px!important;color:purple}' }));
  });
  try {
    await pick(r.page, '#target'); const native = () => r.page.locator('#linked').evaluate(node => (node as HTMLLinkElement).sheet!.cssRules[0].cssText); const before = await native();
    expect(await r.author('font-size', '32px')).toBe(true); expect((await r.status()).sourceKind).toBe('linked'); expect(await native()).toContain('32px !important');
    await r.read('__p.editor.reset();true'); expect(await native()).toBe(before); expect(await r.page.locator('#linked').getAttribute('href')).toBe('/mutation-author.css'); await evidence(info, { before, result: await r.status() }); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

for (const shadow of [false, true]) test(`M${shadow ? '12' : '11'} adopted ${shadow ? 'open-shadow' : 'document'} sheet requires shared-scope authorization`, async ({}, info) => {
  const script = shadow ? `<div id="host"></div><script>const root=document.querySelector('#host').attachShadow({mode:'open'});root.innerHTML='<button id="target">Shadow</button>';const sheet=new CSSStyleSheet();sheet.replaceSync('#target{font-size:18px;color:purple}');root.adoptedStyleSheets=[sheet];</script>` : `<button id="target">Target</button><script>const sheet=new CSSStyleSheet();sheet.replaceSync('#target{font-size:18px;color:purple}');document.adoptedStyleSheets=[sheet];</script>`;
  const r = await launch(info, fixture('', script));
  try {
    await pick(r.page, '#target'); const native = () => r.page.locator('#target').evaluate(node => ((node.getRootNode() as Document | ShadowRoot).adoptedStyleSheets[0].cssRules[0] as CSSStyleRule).style.cssText); const before = await native();
    expect(await r.author('font-size', '32px', { allowShared: true })).toBe(true); const changed = await r.status(); expect(changed.state).toBe('mutated'); expect(changed.sourceKind).toBe('adopted'); expect(changed.scope.kind).toBe('unknown'); expect(await native()).toContain('32px');
    await r.read('__p.editor.reset();true'); expect(await native()).toBe(before); await evidence(info, { before, changed }); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('M13 open ShadowRoot style rule retains local root identity', async ({}, info) => {
  const r = await launch(info, fixture('', `<div id="host"></div><script>document.querySelector('#host').attachShadow({mode:'open'}).innerHTML='<style>#target{font-size:18px;color:purple}</style><button id="target">Shadow</button>';</script>`));
  try {
    await pick(r.page, '#target'); expect(await r.author('font-size', '32px')).toBe(true); expect((await r.status()).state).toBe('mutated'); await expect(r.page.locator('#target')).toHaveCSS('font-size', '32px'); await r.read('__p.editor.undo();true'); await expect(r.page.locator('#target')).toHaveCSS('font-size', '18px'); await evidence(info, await r.status()); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('M14 shared rule defaults to local override and requires explicit blast-radius authorization', async ({}, info) => {
  const r = await launch(info, fixture('.button{font-size:18px;color:purple}', Array.from({length:40}, (_, i) => `<button id="${i ? `other-${i}` : 'target'}" class="button">${i}</button>`).join('')));
  try {
    await pick(r.page, '#target'); const before = await ruleCSS(r.page); expect(await r.author('font-size', '32px')).toBe(true); const fallback = await r.status(); expect(fallback.state).toBe('fallback'); expect(await ruleCSS(r.page)).toBe(before); await expect(r.page.locator('#other-1')).toHaveCSS('font-size','18px'); await expect(r.page.locator('#target')).toHaveCSS('font-size','32px');
    await r.read('__p.editor.reset();true'); expect(await r.author('font-size','28px',{allowShared:true})).toBe(true); const shared = await r.status(); expect(shared.state).toBe('mutated'); expect(shared.scope).toEqual({kind:'shared-rule',matchedCount:40,bounded:true,risk:'shared'}); await expect(r.page.locator('#other-39')).toHaveCSS('font-size','28px'); await r.read('__p.editor.undo();true'); expect(await ruleCSS(r.page)).toBe(before); await evidence(info,{fallback,shared}); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('M15 inaccessible CSS prevents certain provenance and falls back without mutation', async ({}, info) => {
  const r = await launch(info, fixture('#target{font-size:18px}', undefined, '<link rel="stylesheet" href="http://styles.test/mutation-locked.css">'), async page => { await page.route('http://styles.test/mutation-locked.css', route=>route.fulfill({contentType:'text/css',body:'#target{color:purple}'})); });
  try {
    await pick(r.page,'#target'); const before=await ruleCSS(r.page); expect(await r.author('font-size','32px')).toBe(true); expect((await r.status()).state).toBe('fallback'); expect(await ruleCSS(r.page)).toBe(before); await evidence(info,await r.status()); expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

for (const example of [
  {id:'M16',css:'#target{font:18px Arial;color:purple}',property:'font-size'},
  {id:'M17',css:'@layer {#target{font-size:18px}}',property:'font-size'},
  {id:'M18',css:'@container (width>10px){#target{font-size:18px}}',property:'font-size'},
  {id:'M19',css:'@media(min-width:800px){#target{font-size:18px}}',property:'font-size'},
]) test(`${example.id} unsafe shorthand uncertain layer or mismatched context falls back`, async ({},info)=>{
  const r=await launch(info,fixture(example.css));
  try {await pick(r.page,'#target');const before=await ruleCSS(r.page);expect(await r.author(example.property,'32px')).toBe(true);expect((await r.status()).state).toBe('fallback');expect(await ruleCSS(r.page)).toBe(before);await evidence(info,await r.status());expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

for (const change of ['delete-rule','replace-sheet','change-value','change-selector','change-context'] as const) test(`M${({'delete-rule':'20','replace-sheet':'21','change-value':'22','change-selector':'23','change-context':'24'})[change]} prepared stale source rejects without heuristic relocation`,async({},info)=>{
  const r=await launch(info,fixture('@media(min-width:800px){#target{font-size:18px;color:purple}}'));
  try {
    await pick(r.page,'#target');await r.read(`__p.editor.setContext({media:['(min-width: 800px)'],pseudo:''});globalThis.__t=__p.editor.authorMutation.prepare({element:document.querySelector('#target'),property:'font-size',value:'32px',context:__p.editor.getSnapshot().context});!('state' in __t)` ).then(ok=>expect(ok).toBe(true));
    await r.page.evaluate(change=>{const style=document.querySelector('#author') as HTMLStyleElement, sheet=style.sheet!,group=sheet.cssRules[0] as CSSMediaRule,rule=group.cssRules[0] as CSSStyleRule;if(change==='delete-rule')group.deleteRule(0);if(change==='replace-sheet')style.textContent='@media(min-width:800px){#target{font-size:21px}}';if(change==='change-value')rule.style.setProperty('font-size','21px');if(change==='change-selector')rule.selectorText='#target, .other';if(change==='change-context')group.media.mediaText='(min-width:900px)';},change);
    const before=await ruleCSS(r.page);const result=await r.read(`(()=>{const r=__p.editor.authorMutation.apply(__t,'32px');return {state:r.state,reason:r.reason};})()`);expect(result.state).toBe('fallback');expect(await ruleCSS(r.page)).toBe(before);await evidence(info,result);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('M25 CSSOM write throws leaves author state unchanged and safely falls back',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px;color:purple}'));
  try {
    await pick(r.page,'#target');const before=await ruleCSS(r.page);await r.read(`globalThis.__set=CSSStyleDeclaration.prototype.setProperty;CSSStyleDeclaration.prototype.setProperty=function(p,v,priority){if(this.parentRule?.selectorText==='#target'&&v==='32px')throw Error('Fixture rejects CSSOM');return __set.call(this,p,v,priority)};true`);
    expect(await r.author('font-size','32px')).toBe(true);expect((await r.status()).state).toBe('fallback');expect(await ruleCSS(r.page)).toBe(before);await expect(r.page.locator('#target')).toHaveCSS('font-size','32px');await r.read('CSSStyleDeclaration.prototype.setProperty=__set;__p.editor.reset();true');await evidence(info,await r.status());expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('M26 author transaction survives replacement with fresh provenance and undo on exact source',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px;color:purple}.changed{font-size:22px!important}'));
  try {
    await pick(r.page,'#target');const before=await ruleCSS(r.page);await r.author('font-size','32px');const old=await r.status();await r.page.locator('#target').evaluate(node=>node.outerHTML='<button id="target" class="changed">Replacement</button>');await expect.poll(async()=>(await r.status()).reconciliation).toBe('migrated');expect((await r.status()).target).toBe(old.target);await expect(r.page.locator('#target')).toHaveCSS('font-size','22px');
    await r.read(`__p.source(true);__p.cascade();true`);await r.author('font-size','29px');const refreshed=await r.page.locator('#author').evaluate(node=>(node as HTMLStyleElement).sheet!.cssRules[1].cssText);expect(refreshed).toContain('29px !important');await r.read('__p.editor.undo();__p.editor.undo();true');expect(await ruleCSS(r.page)).toBe(before);await expect(r.page.locator('#target')).toHaveCSS('font-size','22px');expect(await r.read(`__p.cascade().properties['font-size'].winner.declaration.value`)).toBe('22px');expect((await r.status()).undo).toBe(0);await evidence(info,{old,refreshed,result:await r.status()});expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('M27 external replacement blocks rollback preserves history and never mutates the new rule',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px;color:purple}'));
  try {await pick(r.page,'#target');await r.author('font-size','32px');await r.page.locator('#author').evaluate(node=>node.textContent='#target{font-size:21px;color:green}');const before=await ruleCSS(r.page);await r.read('__p.editor.undo();true');expect((await r.status()).undo).toBe(1);expect((await r.status()).error).toContain('Author source changed');await r.read('__p.editor.reset();true');expect(await ruleCSS(r.page)).toBe(before);expect((await r.status()).undo).toBe(1);await evidence(info,await r.status());expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M28 explicit mutation policy uses one Design and Code path while default stays session-only',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px;color:purple;--brand:green}'));
  try {
    await pick(r.page,'#target');const before=await ruleCSS(r.page);const input=r.page.getByRole('textbox',{name:'Font size',exact:true});await input.fill('32');await input.press('Enter');expect((await r.status()).mode).toBe('SESSION_OVERRIDE');expect(await ruleCSS(r.page)).toBe(before);await r.read(`__p.editor.reset();__p.editor.setMutationPolicy({mode:'SAFE_AUTHOR_MUTATION'});true`);await input.fill('28');await input.press('Enter');expect((await r.status()).state).toBe('mutated');expect(await ruleCSS(r.page)).toContain('28px');
    await r.page.getByRole('tab',{name:'Code',exact:true}).click();const region=r.page.getByRole('region',{name:'Readable matching CSS'});await expect(region.locator('[data-property="font-size"]')).toHaveAttribute('data-source-state','cssforge-mutated-author');await region.getByRole('button',{name:'Edit font-size',exact:true}).click();const value=region.getByRole('textbox',{name:'CSS value font-size'});await value.fill('30px');await value.press('Enter');await expect.poll(()=>ruleCSS(r.page)).toContain('30px');expect((await r.status()).undo).toBe(2);
    await region.getByRole('button',{name:'Edit --brand',exact:true}).click();const custom=region.getByRole('textbox',{name:'CSS value --brand'});await custom.fill('#00ff00');await custom.press('Enter');await expect.poll(()=>ruleCSS(r.page)).toContain('--brand: #00ff00');await r.read('__p.editor.reset();true');expect(await ruleCSS(r.page)).toBe(before);await evidence(info,await r.status());expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('M29 raw pointer burst does zero mutation analysis and all existing engine hot-path work',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px}'));
  try {
    const result=await r.read(`(()=>{__p.start();for(let i=0;i<1000;i++)document.querySelector('#target').dispatchEvent(new PointerEvent('pointermove',{bubbles:true,composed:true}));return {mutation:__p.editor.authorMutation.getStats(),selector:__p.selectorStats(),reconciliation:__p.reconciliationStats(),source:__p.sourceStats(),cascade:__p.cascadeStats(),locator:__p.locatorStats()};})()`);
    expect(result.mutation).toEqual({analyses:0,capabilityChecks:0,writes:0,rollbacks:0,rejections:0});expect(result.selector.generations).toBe(0);expect(result.reconciliation.starts).toBe(0);expect(result.source.scopeScans).toBe(0);expect(result.cascade.resolutions).toBe(0);expect(result.locator.requests).toBe(0);await evidence(info,result);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('M30 editing var use never chases custom token declaration',async({},info)=>{
  const r=await launch(info,fixture('#target{--brand:green;color:var(--brand)}'));
  try {await pick(r.page,'#target');expect(await r.author('color','purple')).toBe(true);expect((await r.status()).state).toBe('mutated');expect(await ruleCSS(r.page)).toContain('--brand: green');expect(await ruleCSS(r.page)).toContain('color: purple');await r.read('__p.editor.undo();true');expect(await ruleCSS(r.page)).toContain('color: var(--brand)');await evidence(info,await r.status());expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M31 deliberate priority changes undo exactly and unchanged values create no transaction',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px!important;color:purple}'));
  try {await pick(r.page,'#target');const before=await ruleCSS(r.page);expect(await r.author('font-size','18px')).toBe(true);expect((await r.status()).state).toBe('unchanged');expect((await r.status()).undo).toBe(0);await r.author('font-size','32px',{priority:''});expect((await r.status()).state).toBe('mutated');expect(await ruleCSS(r.page)).not.toContain('important');await r.read('__p.editor.undo();true');expect(await ruleCSS(r.page)).toBe(before);await evidence(info,await r.status());expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M32 mixed author and session transactions reset coherently in reverse order',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px;color:purple}'));
  try {await pick(r.page,'#target');const before=await ruleCSS(r.page);await r.author('font-size','32px');await r.author('color','green');await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'opacity','0.5');true`);expect((await r.status()).undo).toBe(3);await r.read('__p.editor.reset();true');expect(await ruleCSS(r.page)).toBe(before);expect((await r.status()).undo).toBe(0);expect(await r.page.locator('style[data-cssforge-edit-layer]').count()).toBe(0);await evidence(info,await r.status());expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M33 bounded blast-radius scan rejects automatic mutation when the root exceeds budget',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px}','<button id="target">Target</button>'+Array.from({length:520},()=>'<span>Noise</span>').join('')));
  try {await pick(r.page,'#target');const before=await ruleCSS(r.page);await r.author('font-size','32px');const result=await r.status();expect(result.state).toBe('fallback');expect(result.scope).toMatchObject({kind:'unknown',bounded:false,risk:'unknown'});expect(await ruleCSS(r.page)).toBe(before);await evidence(info,result);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M34 nonexistent inline property behind a shorthand stays in the session layer',async({},info)=>{
  const r=await launch(info,fixture('', '<button id="target" style="margin:1px 2px;color:purple">Target</button>'));
  try {await pick(r.page,'#target');const before=await r.page.locator('#target').getAttribute('style');await r.author('margin-top','8px',{inline:true});expect((await r.status()).state).toBe('fallback');expect(await r.page.locator('#target').getAttribute('style')).toBe(before);await expect(r.page.locator('#target')).toHaveCSS('margin-top','8px');await evidence(info,await r.status());expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M35 inline author undo after replacement restores only the original DOM object',async({},info)=>{
  const r=await launch(info,fixture('', '<button id="target" style="font-size:18px;color:purple">Target</button>'));
  try {await pick(r.page,'#target');await r.read('globalThis.__old=document.querySelector("#target");true');await r.author('font-size','32px');await r.page.locator('#target').evaluate(node=>node.outerHTML='<button id="target" style="font-size:21px;color:green">Replacement</button>');await expect.poll(async()=>(await r.status()).reconciliation).toBe('migrated');await r.read('__p.editor.undo();true');expect(await r.read('__old.style.fontSize')).toBe('18px');await expect(r.page.locator('#target')).toHaveCSS('font-size','21px');expect((await r.status()).undo).toBe(0);await evidence(info,await r.status());expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M36 external declaration conflict preserves history and can be retried after exact state restoration',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px;color:purple}'));
  try {await pick(r.page,'#target');const before=await ruleCSS(r.page);await r.author('font-size','32px');await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.setProperty('color','green'));await r.read('__p.editor.undo();true');expect((await r.status()).undo).toBe(1);expect(await ruleCSS(r.page)).toContain('green');await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.setProperty('color','purple'));await r.read('__p.editor.undo();true');expect(await ruleCSS(r.page)).toBe(before);expect((await r.status()).undo).toBe(0);await evidence(info,await r.status());expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M37 mismatched explicit declaration identity never edits a different author winner',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px}#target{font-size:20px}'));
  try {await pick(r.page,'#target');const before=await ruleCSS(r.page);await r.author('font-size','32px',{ruleId:'wrong-rule'});expect((await r.status()).state).toBe('fallback');expect(await ruleCSS(r.page)).toBe(before);expect(await r.page.locator('#author').evaluate(node=>(node as HTMLStyleElement).sheet!.cssRules[1].cssText)).toContain('20px');await evidence(info,await r.status());expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M38 deactivation restores reversible author declarations',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px;color:purple}'));
  try {await pick(r.page,'#target');const before=await ruleCSS(r.page);await r.author('font-size','32px');await r.action();await expect(r.page.locator('cssforge-ui')).toHaveCount(0);expect(await ruleCSS(r.page)).toBe(before);await evidence(info,{before,after:await ruleCSS(r.page)});expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M39 author mutation never deletes declarations to represent Code disabled state',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px;color:purple}'));
  try {await pick(r.page,'#target');await r.author('font-size','32px');const after=await ruleCSS(r.page);await r.read(`__p.editor.setMutationPolicy({mode:'SAFE_AUTHOR_MUTATION'});true`);await r.page.getByRole('tab',{name:'Code',exact:true}).click();await expect(r.page.getByRole('region',{name:'Readable matching CSS'}).getByRole('checkbox',{name:'Authored declaration font-size'})).toBeDisabled();expect(await ruleCSS(r.page)).toBe(after);await r.read('__p.editor.reset();true');await evidence(info,await r.status());expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M40 prepared mutation cannot survive reset or use stale selected-context authority',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px}'));
  try {await pick(r.page,'#target');const before=await ruleCSS(r.page);await r.read(`globalThis.__t=__p.editor.authorMutation.prepare({element:document.querySelector('#target'),property:'font-size',value:'32px',context:{media:[],pseudo:''}});__p.editor.reset();true`);const result=await r.read(`(()=>{const r=__p.editor.authorMutation.apply(__t,'32px');return {state:r.state,reason:r.reason};})()`);expect(result.state).toBe('fallback');expect(await ruleCSS(r.page)).toBe(before);await evidence(info,result);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

for(const mode of ['other-target','other-context'] as const)test(`M${mode==='other-target'?'41':'42'} prepared author binding rejects changed selection or pseudo context`,async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px}','<button id="target">Target</button><button id="other">Other</button>'));
  try {await pick(r.page,'#target');const before=await ruleCSS(r.page);await r.read(`globalThis.__t=__p.editor.authorMutation.prepare({element:document.querySelector('#target'),property:'font-size',value:'32px',context:{media:[],pseudo:''}});true`);if(mode==='other-target')await pick(r.page,'#other');else await r.read(`__p.editor.setContext({media:[],pseudo:':hover'});true`);const result=await r.read(`(()=>{const r=__p.editor.authorMutation.apply(__t,'32px');return {state:r.state,reason:r.reason};})()`);expect(result.state).toBe('fallback');expect(await ruleCSS(r.page)).toBe(before);await evidence(info,result);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M43 prepared rule rejects a stylesheet disabled after capture',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px}'));
  try {await pick(r.page,'#target');const before=await ruleCSS(r.page);await r.read(`globalThis.__t=__p.editor.authorMutation.prepare({element:document.querySelector('#target'),property:'font-size',value:'32px',context:{media:[],pseudo:''}});true`);await r.page.locator('#author').evaluate(node=>(node as HTMLStyleElement).sheet!.disabled=true);const result=await r.read(`(()=>{const r=__p.editor.authorMutation.apply(__t,'32px');return {state:r.state,reason:r.reason};})()`);expect(result.state).toBe('fallback');expect(await ruleCSS(r.page)).toBe(before);await evidence(info,result);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M44 CSSOM throws after partial intended write restores author state before fallback',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px;color:purple}'));
  try {await pick(r.page,'#target');const before=await ruleCSS(r.page);await r.read(`globalThis.__set=CSSStyleDeclaration.prototype.setProperty;CSSStyleDeclaration.prototype.setProperty=function(p,v,priority){const result=__set.call(this,p,v,priority);if(this.parentRule?.selectorText==='#target'&&v==='32px')throw Error('Fixture throws after write');return result;};true`);expect(await r.author('font-size','32px')).toBe(true);const result=await r.status();expect(result.state).toBe('fallback');expect(result.reason).toContain('restored');expect(await ruleCSS(r.page)).toBe(before);expect(result.undo).toBe(1);expect(result.stats.writes).toBe(0);await r.read('CSSStyleDeclaration.prototype.setProperty=__set;__p.editor.reset();true');await evidence(info,result);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M45 silent CSSOM rejection never commits an author transaction',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px;color:purple}'));
  try {await pick(r.page,'#target');const before=await ruleCSS(r.page);await r.read(`globalThis.__set=CSSStyleDeclaration.prototype.setProperty;CSSStyleDeclaration.prototype.setProperty=function(p,v,priority){if(this.parentRule?.selectorText==='#target'&&v==='32px')return;return __set.call(this,p,v,priority)};true`);expect(await r.author('font-size','32px')).toBe(true);const result=await r.status();expect(result.state).toBe('fallback');expect(await ruleCSS(r.page)).toBe(before);expect(result.stats.writes).toBe(0);await r.read('CSSStyleDeclaration.prototype.setProperty=__set;__p.editor.reset();true');await evidence(info,result);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M46 readable CORS stylesheet remains outside same-origin mutation policy',async({},info)=>{
  const r=await launch(info,fixture('',undefined,'<link id="cors" crossorigin="anonymous" rel="stylesheet" href="http://styles.test/mutation-readable.css">'),async page=>{await page.route('http://styles.test/mutation-readable.css',route=>route.fulfill({contentType:'text/css',headers:{'access-control-allow-origin':'*'},body:'#target{font-size:18px;color:purple}'}));});
  try {await pick(r.page,'#target');const native=()=>r.page.locator('#cors').evaluate(node=>(node as HTMLLinkElement).sheet!.cssRules[0].cssText);const before=await native();expect(before).toContain('18px');expect(await r.author('font-size','32px')).toBe(true);const result=await r.status();expect(result.state).toBe('fallback');expect(result.reason).toContain('Cross-origin');expect(await native()).toBe(before);await evidence(info,result);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M47 reset restores independent reversible author edits while retaining only conflicting history',async({},info)=>{
  const r=await launch(info,fixture('#target{font-size:18px;color:purple}#other{font-size:20px;color:green}','<button id="target">Target</button><button id="other">Other</button>'));
  try {await pick(r.page,'#target');const before=await ruleCSS(r.page);await r.author('font-size','32px');await pick(r.page,'#other');await r.author('font-size','28px');await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[1] as CSSStyleRule).style.setProperty('color','red'));await r.read('__p.editor.reset();true');expect(await ruleCSS(r.page)).toBe(before);const other=await r.page.locator('#author').evaluate(node=>(node as HTMLStyleElement).sheet!.cssRules[1].cssText);expect(other).toContain('28px');expect(other).toContain('red');expect((await r.status()).undo).toBe(1);expect((await r.status()).error).toContain('Author source changed');await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[1] as CSSStyleRule).style.setProperty('color','green'));await r.read('__p.editor.reset();true');expect((await r.status()).undo).toBe(0);await expect(r.page.locator('#other')).toHaveCSS('font-size','20px');await evidence(info,{before,conflict:other,result:await r.status()});expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('M48 inline rollback refuses a live move across root boundaries',async({},info)=>{
  const r=await launch(info,fixture('', '<button id="target" style="font-size:18px;color:purple">Target</button><div id="host"></div><script>document.querySelector("#host").attachShadow({mode:"open"});</script>'));
  try {await pick(r.page,'#target');await r.author('font-size','32px');await r.page.locator('#target').evaluate(node=>document.querySelector('#host')!.shadowRoot!.append(node));await r.read('__p.getSnapshot();__p.editor.undo();true');await expect(r.page.locator('#host #target')).toHaveCSS('font-size','32px');expect((await r.status()).undo).toBe(1);expect((await r.status()).error).toContain('Author source changed');await evidence(info,await r.status());expect(r.errors).toEqual([]);}finally{await r.context.close();}
});
