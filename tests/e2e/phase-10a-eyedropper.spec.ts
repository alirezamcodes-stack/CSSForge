import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { launch, html } from './mutationHarness';
import { pick, dock } from './extensionHarness';

type Runtime = Awaited<ReturnType<typeof launch>>;
const button = (page:Page,label='Text color') => page.getByRole('button',{name:`Sample ${label.toLowerCase()} from screen`,exact:true});
const popup = (page:Page,label='Text color') => page.getByRole('dialog',{name:`${label} picker`,exact:true});
async function platform(r:Runtime,unsupported=false) {
  // Only the native platform boundary is substituted, in the content-script world.
  // The built React control, rich callbacks, transactions, history and export are real.
  await r.read(`globalThis.__samples={requests:[],detections:0};Object.defineProperty(globalThis,'EyeDropper',{configurable:true,get(){__samples.detections++;return ${unsupported?'undefined':`class {open({signal}) {return new Promise((resolve,reject)=>__samples.requests.push({signal,resolve,reject}));}}`}}});true`);
}
async function open(r:Runtime,label='Text color') {
  await r.page.getByRole('button',{name:`${label} picker`,exact:true}).click(); await expect(button(r.page,label)).toBeVisible();
}
const count=(r:Runtime)=>r.read<number>('__samples.requests.length');
async function accept(r:Runtime,index=0,color='#123456') {await r.read(`__samples.requests[${index}].resolve({sRGBHex:${JSON.stringify(color)}});true`);}
const undo=(r:Runtime)=>r.read<number>('__p.editor.getSnapshot().undoCount');
const baseCSS='#target{color:purple;background-color:rgba(10,20,30,.3);border:2px solid;border-color:red green blue yellow;background-image:linear-gradient(90deg,red 10%,blue 90%),linear-gradient(45deg,white 0%,black 100%);box-shadow:1px 2px 3px red,4px 5px 6px blue;text-shadow:1px 2px 3px red,4px 5px 6px blue}';

test('10A identical Design refresh preserves request and accepts exactly one sample',async({},info)=>{
  const r=await launch(info,html(baseCSS));
  try {
    await pick(r.page,'#target');await platform(r);await open(r);await button(r.page).click();
    const refreshed=await r.read(`(()=>{const before=__p.editor.getSnapshot().design;__p.source(true);const after=__p.editor.getSnapshot().design;return {replaced:before.values!==after.values,equal:JSON.stringify(before.values)===JSON.stringify(after.values),aborted:__samples.requests[0].signal.aborted};})()`);
    expect(refreshed).toEqual({replaced:true,equal:true,aborted:false});
    await expect(button(r.page)).toHaveAttribute('aria-busy','true');await accept(r);
    await expect(r.page.locator('#target')).toHaveCSS('color','rgb(18, 52, 86)');expect(await undo(r)).toBe(1);
    await expect(button(r.page)).toBeFocused();expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

test('10A changed Design values returning synchronously cannot revive a request',async({},info)=>{
  const r=await launch(info,html(baseCSS));
  try {
    await pick(r.page,'#target');await platform(r);await open(r);await button(r.page).click();
    const changed=await r.read(`(()=>{const node=document.querySelector('#target'),before=JSON.stringify(__p.editor.getSnapshot().design.values);node.style.color='red';__p.source(true);node.style.removeProperty('color');__p.source(true);return {equal:before===JSON.stringify(__p.editor.getSnapshot().design.values),aborted:__samples.requests[0].signal.aborted};})()`);
    expect(changed).toEqual({equal:true,aborted:true});await accept(r);
    await expect(r.page.locator('#target')).toHaveCSS('color','rgb(128, 0, 128)');expect(await undo(r)).toBe(0);
    await expect(button(r.page)).toBeEnabled();expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

for(const format of ['HEX','RGB','HSL'] as const) test(`10A ${format}: trusted sample uses one CSS gesture, focus, Escape, Undo and Reset`,async({},info)=>{
  const r=await launch(info,html(baseCSS));
  try {
    await pick(r.page,'#target'); await platform(r); await open(r);
    await popup(r.page).getByRole('button',{name:format,exact:true}).click();
    await button(r.page).focus(); await r.page.keyboard.press('Enter');
    expect(await count(r)).toBe(1); await expect(button(r.page)).toBeDisabled(); expect(await undo(r)).toBe(0);
    await accept(r); await expect(r.page.locator('#target')).toHaveCSS('color','rgb(18, 52, 86)'); expect(await undo(r)).toBe(1);
    await expect(button(r.page)).toBeFocused();
    const token=await r.page.getByRole('textbox',{name:`Text color ${format}`,exact:true}).inputValue();
    expect(token).toMatch(format==='HEX'?/^#123456ff$/:format==='RGB'?/^rgb\(18, 52, 86\)$/:/^hsl\(/);
    expect(await r.read(`__p.editor.getSnapshot().changes.flatMap(g=>g.contexts).flatMap(c=>c.declarations).length`)).toBe(1);
    await r.page.keyboard.press('Escape'); await expect(r.page.locator('#target')).toHaveCSS('color','rgb(128, 0, 128)'); expect(await undo(r)).toBe(0);
    await open(r); await button(r.page).click(); await accept(r,1); expect(await undo(r)).toBe(1);
    await r.page.getByRole('button',{name:'Text color picker',exact:true}).click();
    await r.page.getByRole('button',{name:'Undo last edit',exact:true}).click(); expect(await undo(r)).toBe(0);
    await open(r); await button(r.page).click(); await accept(r,2,'#abcdef');
    await r.page.getByRole('button',{name:'Text color picker',exact:true}).click(); await r.page.getByRole('button',{name:'Reset session edits',exact:true}).click();
    await expect(r.page.locator('#target')).toHaveCSS('color','rgb(128, 0, 128)'); expect(await undo(r)).toBe(0); expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

for(const [label,property,expected] of [
  ['Background color','background-color','rgb(18, 52, 86)'],
  ['Border color','border-top-color','rgb(18, 52, 86)'],
  ['Stop 2 color','background-image',''],
  ['Box shadow color','box-shadow',''],
  ['Text shadow color','text-shadow',''],
] as const) test(`10A ${label}: exact rich consumer and opaque acceptance`,async({},info)=>{
  const r=await launch(info,html(baseCSS));
  try {
    await pick(r.page,'#target'); await platform(r);
    if(label.includes('shadow')) await r.page.getByRole('button',{name:`Select ${label.startsWith('Box')?'box':'text'} shadow 2`,exact:true}).click();
    await open(r,label); await button(r.page,label).click(); await accept(r);
    await expect.poll(()=>undo(r)).toBe(1); const css=await r.page.locator('#target').evaluate((node,p)=>getComputedStyle(node).getPropertyValue(p),property);
    if(expected) expect(css).toBe(expected);
    else if(property==='background-image') {expect(css).toContain('rgb(255, 0, 0) 10%, rgb(18, 52, 86) 90%');expect(css).toContain('rgb(255, 255, 255) 0%, rgb(0, 0, 0) 100%');}
    else {expect(css).toContain('rgb(255, 0, 0) 1px 2px 3px');expect(css).toContain('rgb(18, 52, 86) 4px 5px 6px');}
    if(label==='Border color') expect(await r.page.locator('#target').evaluate(node=>['Top','Right','Bottom','Left'].map(side=>(getComputedStyle(node) as any)[`border${side}Color`]))).toEqual(Array(4).fill(expected));
    await r.read('__p.editor.undo();true'); expect(await undo(r)).toBe(0); expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

for(const reason of ['AbortError','NotAllowedError','OperationError','malformed','keyboard']) test(`10A ${reason}: cancellation/failure preserves unresolved token and history`,async({},info)=>{
  const r=await launch(info,html('', '<button id="target" style="color:var(--unknown)">Target</button>'));
  try {
    await pick(r.page,'#target'); await platform(r); await open(r);
    const before=await r.page.getByRole('textbox',{name:'Text color',exact:true}).inputValue(); expect(before).toBe('var(--unknown)');
    await button(r.page).click();
    if(reason==='keyboard') await r.page.keyboard.press('Escape');
    else if(reason==='malformed') await accept(r,0,'#12345680');
    else await r.read(`__samples.requests[0].reject(new DOMException('private error text',${JSON.stringify(reason)}));true`);
    await expect(button(r.page)).toBeEnabled(); await expect(popup(r.page)).toBeVisible(); await expect(button(r.page)).toBeFocused();
    await expect(r.page.getByRole('textbox',{name:'Text color',exact:true})).toHaveValue(before); expect(await undo(r)).toBe(0);
    expect(await r.read('__p.editor.getSnapshot().changes')).toEqual([]); await expect(popup(r.page)).not.toContainText('private error text');
    if(reason==='AbortError'||reason==='keyboard') await expect(popup(r.page).getByRole('status')).toHaveCount(0);
    await button(r.page).click(); await accept(r,1); await expect(r.page.locator('#target')).toHaveCSS('color','rgb(18, 52, 86)'); expect(await undo(r)).toBe(1); expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

test('10A unsupported constructor has a disabled accessible reason and no requests',async({},info)=>{
  const r=await launch(info);
  try {await platform(r,true);await pick(r.page,'#target');await open(r);await expect(button(r.page)).toBeDisabled();await expect(popup(r.page).getByRole('status')).toContainText('unavailable');expect(await count(r)).toBe(0);expect(await undo(r)).toBe(0);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

for(const change of ['selection','replacement','context','property','layer','stop','shadow','unmount','close','deactivate']) test(`10A ${change}: pending result is aborted and discarded`,async({},info)=>{
  const r=await launch(info,html(baseCSS,'<button id="target">Target</button><button id="other">Other</button>'));
  try {
    await pick(r.page,'#target');await platform(r);
    if(change==='replacement') {const field=r.page.getByRole('textbox',{name:'Width',exact:true});await field.fill('200px');await field.press('Enter');}
    const label=change==='layer'||change==='stop'?'Stop 1 color':change==='shadow'?'Box shadow color':'Text color';
    await open(r,label);await button(r.page,label).click();const before=await undo(r);
    if(change==='selection') await r.read(`__p.next();true`);
    if(change==='replacement') {await r.page.locator('#target').evaluate(node=>node.outerHTML='<button id="target">Replacement</button>');await expect.poll(()=>r.read('__p.reconciliation().state')).toBe('migrated');}
    if(change==='context') await r.read(`__p.editor.setContext({media:[],pseudo:':hover'});true`);
    if(change==='property') await open(r,'Background color');
    if(change==='layer'||change==='shadow') {await r.page.getByRole('button',{name:change==='layer'?'Select background layer 2':'Select box shadow 2',exact:true}).click();}
    if(change==='stop') await r.page.getByRole('button',{name:'Stop 2 color picker',exact:true}).click();
    if(change==='unmount') await r.page.getByRole('tab',{name:'Code',exact:true}).click();
    if(change==='close') await dock(r.page).getByRole('button',{name:'Hide inspector panel',exact:true}).click();
    if(change==='deactivate') await r.action();
    await expect.poll(()=>r.read('__samples.requests[0].signal.aborted')).toBe(true);
    await accept(r); if(change!=='deactivate') expect(await undo(r)).toBe(before);
    await expect(r.page.locator('#target')).not.toHaveCSS('color','rgb(18, 52, 86)'); expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

test('10A newer request survives late older result and overlapping activation creates one request',async({},info)=>{
  const r=await launch(info,html(baseCSS));
  try {
    await pick(r.page,'#target');await platform(r);await open(r);
    await r.read(`document.querySelector('cssforge-ui').shadowRoot.querySelector('button[aria-label="Sample text color from screen"]').click();true`);expect(await count(r)).toBe(0);
    await button(r.page).click();
    await r.read(`document.querySelector('cssforge-ui').shadowRoot.querySelector('button[aria-busy=true]').click();true`);expect(await count(r)).toBe(1);
    await r.page.keyboard.press('Escape');await button(r.page).click();expect(await count(r)).toBe(2);
    await accept(r,0,'#ffffff');expect(await undo(r)).toBe(0);await expect(button(r.page)).toBeDisabled();
    await accept(r,1);await expect(r.page.locator('#target')).toHaveCSS('color','rgb(18, 52, 86)');expect(await undo(r)).toBe(1);expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

test('10A successful sample produces ordinary Changes, clipboard and downloadable CSS only',async({},info)=>{
  const r=await launch(info);
  try {
    await pick(r.page,'#target');await platform(r);await open(r);await button(r.page).click();await accept(r);
    await dock(r.page).getByRole('button',{name:'Open Changes',exact:true}).click();const changes=r.page.getByRole('dialog',{name:'Changes',exact:true});
    await expect(changes.locator('[data-change-property="color"]')).toContainText('#123456ff');await expect(changes.locator('[data-change-property]')).toHaveCount(1);
    await changes.getByRole('button',{name:'Copy all CSS',exact:true}).click();await r.context.grantPermissions(['clipboard-read'],{origin:'http://127.0.0.1:5173'});
    const css=(await r.page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n');expect(css).toBe('#target {\n  color: #123456ff !important;\n}\n');await r.context.clearPermissions();
    const downloaded=r.page.waitForEvent('download');await changes.getByRole('button',{name:'Export CSS',exact:true}).click();const download=await downloaded;const path=info.outputPath('sample.css');await download.saveAs(path);expect(await readFile(path,'utf8')).toBe(css);
    expect(css).not.toMatch(/EyeDropper|sampling|binding|sourceElement|screen|alpha/);expect(await undo(r)).toBe(1);expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

for(const [name,width,height,zoom] of [['320',320,740,1],['390',390,844,1],['zoom200',1440,900,2]] as const) test(`10A ${name}: keyboard sample and native page zoom remain usable`,async({},info)=>{
  const r=await launch(info);
  try {
    await pick(r.page,'#target');
    await r.page.setViewportSize({width,height});if(zoom===2){await r.worker.evaluate(async id=>{await (globalThis as any).chrome.tabs.setZoom(id,2);},r.tabId);expect(await r.worker.evaluate(id=>(globalThis as any).chrome.tabs.getZoom(id),r.tabId)).toBe(2);}
    await platform(r);await open(r);const box=(await popup(r.page).boundingBox())!, viewport=await r.page.evaluate(()=>({width:innerWidth,height:innerHeight}));
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+1);
    await button(r.page).focus();await r.page.keyboard.press('Space');expect(await count(r)).toBe(1);await accept(r);await expect(button(r.page)).toBeFocused();expect(await undo(r)).toBe(1);expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

test('10A 1000 pointer events create zero sampling, source, mutation, reconciliation or serialization work',async({},info)=>{
  const r=await launch(info);
  try {
    await pick(r.page,'#target');await platform(r);await open(r);await r.read('__p.source();true');
    const stats=()=>r.read(`({platform:{requests:__samples.requests.length,detections:__samples.detections},source:__p.sourceStats(),cascade:__p.cascadeStats(),locator:__p.locatorStats(),selector:__p.selectorStats(),reconciliation:__p.reconciliationStats(),changes:__p.changesStats(),author:__p.editor.authorMutation.getStats(),text:__p.editor.domMutation.getStats(),structure:__p.editor.structureMutation.getStats()})`);
    const before=await stats();await r.page.evaluate(()=>{for(let n=0;n<1000;n++)document.querySelector('#target')!.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:100,clientY:100}));});expect(await stats()).toEqual(before);
    await button(r.page).click();const sampling=await stats();await r.page.evaluate(()=>{for(let n=0;n<1000;n++)document.querySelector('#target')!.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:100,clientY:100}));});expect(await stats()).toEqual(sampling);
    expect(await undo(r)).toBe(0);await info.attach('zero-work',{body:JSON.stringify({idle:before,sampling,pointerEventsPerBurst:1000}),contentType:'application/json'});expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

test('10A cancellation preserves mixed border colors and currentColor until explicit opaque success',async({},info)=>{
  const r=await launch(info,html(baseCSS,'<button id="target" style="background-color:currentColor">Target</button>'));
  try {
    await pick(r.page,'#target');await platform(r);
    const colors=()=>r.page.locator('#target').evaluate(node=>['Top','Right','Bottom','Left'].map(side=>(getComputedStyle(node) as any)[`border${side}Color`]));
    const before=await colors();expect(new Set(before).size).toBe(4);
    await open(r,'Border color');await button(r.page,'Border color').click();await r.page.keyboard.press('Escape');expect(await colors()).toEqual(before);expect(await undo(r)).toBe(0);
    await r.page.getByRole('button',{name:'Border color picker',exact:true}).click();await open(r,'Background color');
    await expect(r.page.getByRole('textbox',{name:'Background color',exact:true})).toHaveValue(/currentcolor/i);
    await button(r.page,'Background color').click();await r.page.keyboard.press('Escape');await expect(r.page.getByRole('textbox',{name:'Background color',exact:true})).toHaveValue(/currentcolor/i);expect(await undo(r)).toBe(0);
    await button(r.page,'Background color').click();await accept(r,2);await expect(r.page.locator('#target')).toHaveCSS('background-color','rgb(18, 52, 86)');expect(await undo(r)).toBe(1);expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

test('10A unsupported gradient keeps its existing read-only boundary',async({},info)=>{
  const r=await launch(info,html('#target{background-image:linear-gradient(in oklab,red,blue)}'));
  try {
    await pick(r.page,'#target');await platform(r);await expect(r.page.getByRole('button',{name:/Stop \d+ color picker/})).toHaveCount(0);
    await open(r,'Background color');await button(r.page,'Background color').click();await accept(r);expect(await undo(r)).toBe(1);
    await expect(r.page.locator('#target')).toHaveCSS('background-image',/in oklab/);expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

test('10A accepted inactive media sample remains a pending ordinary CSS declaration',async({},info)=>{
  const r=await launch(info,html('#target{color:purple}@media(min-width:9999px){#target{color:green}}'));
  try {
    await pick(r.page,'#target');await platform(r);await r.read(`__p.editor.setContext({media:['(min-width: 9999px)'],pseudo:''});true`);
    await open(r);await button(r.page).click();await accept(r);expect(await undo(r)).toBe(1);await expect(r.page.locator('#target')).toHaveCSS('color','rgb(128, 0, 128)');
    await dock(r.page).getByRole('button',{name:'Open Changes',exact:true}).click();const changes=r.page.getByRole('dialog',{name:'Changes',exact:true});await expect(changes.locator('[data-change-property="color"]')).toContainText('#123456ff');await expect(changes.locator('[data-edit-effect]')).toHaveAttribute('data-edit-effect','pending');expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

for(const change of ['selection','context'] as const) test(`10A ${change} roundtrip cannot revive an older pending request`,async({},info)=>{
  const r=await launch(info,html(baseCSS,'<button id="target">Target</button><button id="other">Other</button>'));
  try {
    await pick(r.page,'#target');await platform(r);await open(r);await button(r.page).click();
    await r.read(change==='selection'?`__p.next();__p.previous();true`:`__p.editor.setContext({media:[],pseudo:':hover'});__p.editor.setContext({media:[],pseudo:''});true`);
    expect(await r.read('__samples.requests[0].signal.aborted')).toBe(true);await accept(r);expect(await undo(r)).toBe(0);expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

test('10A sampling suspends the existing picker and restores independent suspension owners',async({},info)=>{
  const r=await launch(info,html(baseCSS,'<button id="target">Target</button><button id="other">Other</button>'));
  try {
    await pick(r.page,'#target');await platform(r);await r.read('__p.start();true');await open(r);await button(r.page).click();const before=await r.status();
    await r.page.locator('#other').click();expect((await r.status()).target).toBe(before.target);expect(await r.read('__p.getSnapshot().active')).toBe(true);
    // Acquire the actual independent surface owner through the existing UI.
    await dock(r.page).getByRole('button',{name:'Open Changes',exact:true}).click();expect(await r.read('__samples.requests[0].signal.aborted')).toBe(true);
    await r.page.evaluate(()=>document.querySelector('#other')!.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true,button:0})));expect((await r.status()).target).toBe(before.target);
    await r.page.getByRole('button',{name:'Close Changes',exact:true}).click();await r.page.locator('#other').click();expect((await r.status()).target).not.toBe(before.target);expect(await r.read('__p.getSnapshot().active')).toBe(false);expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});
