import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { launch, html } from './mutationHarness';
import { pick, dock, aligned } from './extensionHarness';

const dialog=(page:Page)=>page.getByRole('dialog',{name:'Edit text',exact:true});
const review=(page:Page)=>page.getByRole('dialog',{name:'Changes',exact:true});
const textRow=(page:Page)=>review(page).locator('[data-change-kind="DOM_TEXT_MUTATION"]');
async function open(page:Page){await page.getByRole('button',{name:'Inspector menu',exact:true}).click();await page.getByRole('button',{name:'Edit text',exact:true}).click();return dialog(page);}
async function edit(page:Page,value:string){const d=await open(page);await d.getByRole('textbox',{name:'Text content',exact:true}).fill(value);await d.getByRole('button',{name:'Apply text',exact:true}).click();await expect(d).toHaveCount(0);}
async function changes(page:Page){await dock(page).getByRole('button',{name:'Open Changes',exact:true}).click();return review(page);}
async function pickEdge(page:Page,selector:string){await dock(page).getByRole('button',{name:'Pick page element',exact:true}).click();const edge=(await page.locator(selector).boundingBox())!;await page.mouse.click(edge.x+1,edge.y+1);await expect(dock(page).getByRole('button',{name:'Pick page element',exact:true})).toBeVisible();}

test('09A A/C/D/M: real Apply, one text transaction, Changes, Undo and Reset',async({},info)=>{
  const r=await launch(info);
  try{
    await pick(r.page,'#target');await edit(r.page,'Longer edited text 🧑🏽‍💻');await expect(r.page.locator('#target')).toHaveText('Longer edited text 🧑🏽‍💻');expect((await r.status()).undo).toBe(1);await aligned(r.page,'#target');
    const scans=await r.read('__p.sourceStats().scopeScans'),selectors=await r.read('__p.selectorStats()');
    const c=await changes(r.page);await expect(c).toContainText('1 edited elements');await expect(c).toContainText('0 current declarations (CSS)');await expect(c).toContainText('1 DOM changes');await expect(textRow(r.page)).toContainText('Original (text): Target');await expect(textRow(r.page)).toContainText('Applied · exact Text owned');
    expect((await r.read('__p.prepareChanges()')).css).toBe('');expect(await r.read('__p.selectorStats()')).toEqual(selectors);await r.read('__p.source();true');expect(await r.read('__p.sourceStats().scopeScans')).toBe(scans);
    await expect(c.getByRole('button',{name:'Copy all CSS',exact:true})).toBeDisabled();await expect(c.getByRole('button',{name:'Export CSS',exact:true})).toBeDisabled();await expect(c.getByRole('button',{name:'Copy target CSS for button#target',exact:true})).toBeDisabled();
    await c.getByRole('button',{name:'Undo last edit',exact:true}).click();await expect(r.page.locator('#target')).toHaveText('Target');await expect(c).toContainText('No session changes yet.');await r.page.keyboard.press('Escape');
    await edit(r.page,'Again');await changes(r.page);await review(r.page).getByRole('button',{name:'Reset session edits',exact:true}).click();await expect(r.page.locator('#target')).toHaveText('Target');expect((await r.status()).undo).toBe(0);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('09A B/R: Cancel and Escape discard local drafts and return focus to opener',async({},info)=>{
  const r=await launch(info);
  try{
    await pick(r.page,'#target');for(const cancel of ['Cancel','Escape']){const d=await open(r.page);await d.getByRole('textbox',{name:'Text content'}).fill('Draft');if(cancel==='Cancel')await d.getByRole('button',{name:'Cancel',exact:true}).click();else await r.page.keyboard.press('Escape');await expect(d).toHaveCount(0);await expect(r.page.getByRole('button',{name:'Inspector menu',exact:true})).toBeFocused();await expect(r.page.locator('#target')).toHaveText('Target');expect((await r.status()).undo).toBe(0);}expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('09A R: ordinary Enter, Ctrl/Meta Enter, contained Tab focus and IME guard',async({},info)=>{
  const r=await launch(info);
  try{
    await pick(r.page,'#target');let d=await open(r.page),field=d.getByRole('textbox',{name:'Text content'});await field.fill('First');await field.press('Enter');await field.press('End');await field.type('Second');expect((await r.status()).undo).toBe(0);await expect(d).toBeVisible();
    await field.evaluate(node=>node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,isComposing:true,bubbles:true})));expect((await r.status()).undo).toBe(0);
    await field.press('Control+Enter');await expect(r.page.locator('#target')).toHaveText('First\nSecond');expect((await r.status()).undo).toBe(1);
    d=await open(r.page);await d.getByRole('textbox',{name:'Text content'}).fill('Meta');for(let n=0;n<8;n++){await r.page.keyboard.press('Tab');expect(await d.evaluate(node=>node.contains((node.getRootNode() as ShadowRoot).activeElement))).toBe(true);}await d.getByRole('textbox',{name:'Text content'}).press('Meta+Enter');await expect(r.page.locator('#target')).toHaveText('Meta');expect((await r.status()).undo).toBe(2);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('09A F: framework update conflicts without a mutation war and Reset remains safe',async({},info)=>{
  const r=await launch(info);
  try{
    await pick(r.page,'#target');await edit(r.page,'CSSForge');await r.page.locator('#target').evaluate(node=>{node.firstChild!.nodeValue='Host update';});const c=await changes(r.page);await expect(textRow(r.page)).toContainText('CONFLICT');await expect(textRow(r.page)).toContainText('Host update');
    const before=await r.read('__p.editor.domMutation.getStats().writes');await c.getByRole('button',{name:'Undo last edit',exact:true}).click();await expect(r.page.locator('#target')).toHaveText('Host update');expect((await r.status()).undo).toBe(1);expect(await r.read('__p.editor.domMutation.getStats().writes')).toBe(before);
    await c.getByRole('button',{name:'Reset session edits',exact:true}).click();await expect(textRow(r.page)).toContainText('CONFLICT');await expect(r.page.locator('#target')).toHaveText('Host update');expect((await r.status()).undo).toBe(1);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('09A draft baseline conflict cannot overwrite a host update',async({},info)=>{
  const r=await launch(info);
  try{await pick(r.page,'#target');const d=await open(r.page);await d.getByRole('textbox',{name:'Text content'}).fill('Draft');await r.page.locator('#target').evaluate(node=>{node.firstChild!.nodeValue='Host';});await d.getByRole('button',{name:'Apply text',exact:true}).click();await expect(d.getByRole('status')).toContainText('CONFLICT');await expect(r.page.locator('#target')).toHaveText('Host');expect((await r.status()).undo).toBe(0);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('09A G: replacement while draft is open retires its physical authority',async({},info)=>{
  const r=await launch(info);
  try{await pick(r.page,'#target');await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'color','red');true`);const d=await open(r.page);await d.getByRole('textbox',{name:'Text content'}).fill('Stale');await r.page.locator('#target').evaluate(node=>{node.outerHTML='<button id="target">Replacement</button>';});await expect.poll(async()=>(await r.status()).reconciliation).toBe('migrated');await expect(d.getByRole('status')).toContainText('STALE');await expect(d.getByRole('button',{name:'Apply text',exact:true})).toBeDisabled();await expect(r.page.locator('#target')).toHaveText('Replacement');expect((await r.status()).undo).toBe(1);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('09A H: strong replacement migrates CSS alone and retains one logical Changes group',async({},info)=>{
  const r=await launch(info);
  try{
    await pick(r.page,'#target');await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'color','red');true`);await edit(r.page,'CSSForge');const id=(await r.status()).target;
    await r.page.locator('#target').evaluate(node=>{node.outerHTML='<button id="target">Replacement</button>';});await expect.poll(async()=>(await r.status()).reconciliation).toBe('migrated');await expect(r.page.locator('#target')).toHaveText('Replacement');await expect(r.page.locator('#target')).toHaveCSS('color','rgb(255, 0, 0)');
    const c=await changes(r.page);await expect(c.locator('[data-change-target]')).toHaveCount(1);await expect(c.locator('[data-change-target]')).toHaveAttribute('data-change-target',id);await expect(textRow(r.page)).toContainText('UNAVAILABLE');await c.getByRole('button',{name:'Undo last edit',exact:true}).click();expect((await r.status()).undo).toBe(2);await expect(r.page.locator('#target')).toHaveText('Replacement');
    await c.getByRole('button',{name:'Reset session edits',exact:true}).click();expect((await r.status()).undo).toBe(1);await expect(r.page.locator('#target')).toHaveCSS('color','rgb(128, 0, 128)');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('09A equal-string replacement Text does not inherit committed or draft ownership',async({},info)=>{
  const r=await launch(info);
  try{await pick(r.page,'#target');await edit(r.page,'New');await r.page.locator('#target').evaluate(node=>{node.replaceChild(document.createTextNode('New'),node.firstChild!);});await changes(r.page);await expect(textRow(r.page)).toContainText('UNAVAILABLE');await review(r.page).getByRole('button',{name:'Undo last edit',exact:true}).click();await expect(r.page.locator('#target')).toHaveText('New');expect((await r.status()).undo).toBe(1);await r.page.keyboard.press('Escape');const d=await open(r.page);await r.page.locator('#target').evaluate(node=>node.replaceChild(document.createTextNode('New'),node.firstChild!));await d.getByRole('textbox',{name:'Text content'}).fill('Draft');await d.getByRole('button',{name:'Apply text',exact:true}).click();await expect(d.getByRole('status')).toContainText('UNAVAILABLE');expect((await r.status()).undo).toBe(1);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

for(const [name,scene] of [['nested','<button id="target">Hello <strong>world</strong></button>'],['multiple','<button id="target">One<!-- separate -->Two</button>'],['form','<textarea id="target">Form</textarea>'],['editable','<div contenteditable="true"><button id="target">Editable</button></div>'],['svg','<svg width="200" height="100"><text id="target" x="20" y="40">SVG</text></svg>']] as const){
  test(`09A I/P: ${name} target is refused with a visible reason and intact structure`,async({},info)=>{const r=await launch(info,html('',scene));try{await pick(r.page,'#target');if(name==='nested')await r.page.getByRole('button',{name:'Select parent',exact:true}).click();await expect(r.page.getByTestId('selected-identity')).toContainText('#target');const original=await r.page.locator('#target').evaluate(node=>node.outerHTML);await r.page.getByRole('button',{name:'Inspector menu',exact:true}).click();const action=r.page.getByRole('button',{name:'Edit text',exact:true});await expect(action).toBeDisabled();expect(await action.getAttribute('aria-describedby')).toBeTruthy();expect(await r.page.locator('#target').evaluate(node=>node.outerHTML)).toBe(original);expect((await r.status()).undo).toBe(0);expect(r.errors).toEqual([]);}finally{await r.context.close();}});
}

test('09A J: HTML-looking input stays literal, same Text, no request or script execution',async({},info)=>{
  const r=await launch(info);
  try{await pick(r.page,'#target');await r.page.locator('#target').evaluate(node=>{(window as any).__originalText=node.firstChild;});let requests=0;r.page.on('request',()=>requests++);const value='<img src="/unexpected" onerror="window.executed=true"><script>window.executed=true</script>';await edit(r.page,value);expect(await r.page.locator('#target').evaluate(node=>node.firstChild!.nodeValue)).toBe(value);expect(await r.page.evaluate(()=>(window as any).executed)).toBeUndefined();expect(await r.page.locator('#target').evaluate(node=>node.firstChild===(window as any).__originalText&&node.children.length===0)).toBe(true);expect(requests).toBe(0);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

for(const value of ['', '  Leading\nمرحبا 🧑🏽‍💻 e\u0301\nTrailing  '])test(`09A K/L: exact empty or Unicode multiline content ${JSON.stringify(value)}`,async({},info)=>{
  const r=await launch(info);
  try{await pick(r.page,'#target');await edit(r.page,value);expect(await r.page.locator('#target').evaluate(node=>node.firstChild!.nodeValue)).toBe(value);await changes(r.page);await expect(textRow(r.page)).toHaveCount(1);await review(r.page).getByRole('button',{name:'Undo last edit',exact:true}).click();await expect(r.page.locator('#target')).toHaveText('Target');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('09A native CR/CRLF and whitespace are preserved through unrelated draft edits',async({},info)=>{
  const r=await launch(info);
  try{await pick(r.page,'#target');await r.page.locator('#target').evaluate(node=>{node.firstChild!.nodeValue=' A\r\nB\rC ';});const d=await open(r.page);await d.getByRole('textbox',{name:'Text content'}).fill(' Z\nB\nC ');await d.getByRole('button',{name:'Apply text',exact:true}).click();expect(await r.page.locator('#target').evaluate(node=>node.firstChild!.nodeValue)).toBe(' Z\r\nB\rC ');await r.read('__p.editor.undo();true');expect(await r.page.locator('#target').evaluate(node=>node.firstChild!.nodeValue)).toBe(' A\r\nB\rC ');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('09A N: blocked CSS and successful text share review; clipboard/download stay CSS only',async({},info)=>{
  const r=await launch(info,html('#target{font-size:18px!important}'));
  try{await pick(r.page,'#target');await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'font-size','32px');true`);await edit(r.page,'DOM secret');const c=await changes(r.page);await expect(c.locator('[data-edit-effect]')).toHaveAttribute('data-edit-effect','blocked');await expect(textRow(r.page)).toContainText('DOM secret');
    await c.getByRole('button',{name:'Copy target CSS for button#target',exact:true}).click();await expect(c.getByRole('status')).toContainText('1 DOM changes omitted');await r.context.grantPermissions(['clipboard-read'],{origin:'http://127.0.0.1:5173'});const copied=(await r.page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n');await r.context.clearPermissions();expect(copied).toBe('#target {\n  font-size: 32px !important;\n}\n');
    await c.getByRole('button',{name:'Copy all CSS',exact:true}).click();await expect(c.getByRole('status')).toContainText('1 DOM changes omitted');const event=r.page.waitForEvent('download');await c.getByRole('button',{name:'Export CSS',exact:true}).click();const download=await event;const path=info.outputPath('text-excluded.css');await download.saveAs(path);expect(await readFile(path,'utf8')).toBe(copied);expect(await r.read('__p.prepareChanges().domOmitted')).toBe(1);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('09A multiple targets and repeated text edits collapse net rows, Undo then Reset',async({},info)=>{
  const r=await launch(info,html('button{font-size:18px}','<button id="target">A</button><button id="second">B</button>'));
  try{await pick(r.page,'#target');await edit(r.page,'One');await edit(r.page,'Two');await pick(r.page,'#second');await edit(r.page,'Three');const c=await changes(r.page);await expect(c.locator('[data-change-target]')).toHaveCount(2);await expect(textRow(r.page)).toHaveCount(2);await expect(textRow(r.page).first()).toContainText('Original (text): A');await expect(textRow(r.page).first()).toContainText('Current: Two');expect((await r.status()).undo).toBe(3);await c.getByRole('button',{name:'Undo last edit',exact:true}).click();await expect(textRow(r.page)).toHaveCount(1);await c.getByRole('button',{name:'Reset session edits',exact:true}).click();await expect(r.page.locator('#target')).toHaveText('A');await expect(r.page.locator('#second')).toHaveText('B');await expect(c).toContainText('No session changes yet.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('09A O/P: open-shadow exact text supported, closed host and iframe stay unavailable',async({},info)=>{
  const r=await launch(info,html('','<button id="target">Main</button><div id="open"></div><div id="closed" style="width:100px;height:50px"></div><iframe id="frame" srcdoc="<button>Frame</button>"></iframe>','<script>document.addEventListener("DOMContentLoaded",()=>{document.querySelector("#open").attachShadow({mode:"open"}).innerHTML="<button id=shadow>Shadow</button>";document.querySelector("#closed").attachShadow({mode:"closed"}).innerHTML="<button>Closed</button>";});</script>'));
  try{await pick(r.page,'#shadow');await edit(r.page,'Open edited');await expect(r.page.locator('#shadow')).toHaveText('Open edited');await changes(r.page);await expect(textRow(r.page)).toContainText('Shadow');await review(r.page).getByRole('button',{name:'Undo last edit',exact:true}).click();await expect(r.page.locator('#shadow')).toHaveText('Shadow');await r.page.keyboard.press('Escape');for(const selector of ['#closed','#frame']){if(selector==='#frame')await pickEdge(r.page,selector);else await pick(r.page,selector);await expect(r.page.getByTestId('selected-identity')).toContainText(selector);await r.page.getByRole('button',{name:'Inspector menu',exact:true}).click();await expect(r.page.getByRole('button',{name:'Edit text',exact:true})).toBeDisabled();await r.page.keyboard.press('Escape');}expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

for(const mode of ['320','390','200%'] as const)test(`09A Q/R: ${mode} editor geometry, reduced motion and keyboard`,async({},info)=>{
  const r=await launch(info);
  try{await pick(r.page,'#target');if(mode==='200%'){await r.worker.evaluate(async id=>{await (globalThis as any).chrome.tabs.setZoom(id,2);},r.tabId);expect(await r.worker.evaluate(id=>(globalThis as any).chrome.tabs.getZoom(id),r.tabId)).toBe(2);}else await r.page.setViewportSize({width:Number(mode),height:850});await r.page.emulateMedia({reducedMotion:'reduce'});const d=await open(r.page);const viewport=await r.page.evaluate(()=>({width:innerWidth,height:innerHeight})),box=(await d.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+1);const field=d.getByRole('textbox',{name:'Text content'});await field.fill('Narrow');await field.press('Control+Enter');await expect(r.page.locator('#target')).toHaveText('Narrow');await expect(r.page.getByRole('button',{name:'Inspector menu',exact:true})).toBeFocused();expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('09A same-task host MutationObserver makes one truthful conflict, no recursion or migration',async({},info)=>{
  const r=await launch(info,html(undefined,undefined,'<script>document.addEventListener("DOMContentLoaded",()=>{window.hostWrites=0;new MutationObserver(()=>{const n=document.querySelector("#target").firstChild;if(n.data==="CSSForge"){window.hostWrites++;n.data="Host reaction";}}).observe(document.querySelector("#target"),{characterData:true,subtree:true});});</script>'));
  try{await pick(r.page,'#target');await edit(r.page,'CSSForge');await expect(r.page.locator('#target')).toHaveText('Host reaction');await changes(r.page);await expect(textRow(r.page)).toContainText('CONFLICT');expect((await r.status()).undo).toBe(1);expect((await r.status()).reconciliation).not.toBe('migrated');expect(await r.page.evaluate(()=>(window as any).hostWrites)).toBe(1);expect(await r.read('__p.editor.domMutation.getStats().writes')).toBe(1);await review(r.page).getByRole('button',{name:'Undo last edit',exact:true}).click();await expect(r.page.locator('#target')).toHaveText('Host reaction');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('09A deactivation restores safe text; conflicted recovery survives reactivation and navigation retires it',async({},info)=>{
  const r=await launch(info);
  try{await pick(r.page,'#target');await edit(r.page,'Safe');await r.action();await expect(r.page.locator('#target')).toHaveText('Target');await r.action();await r.bind();await pick(r.page,'#target');await edit(r.page,'Conflict');await r.page.locator('#target').evaluate(node=>{node.firstChild!.nodeValue='Host';});await r.action();await expect(r.page.locator('#target')).toHaveText('Host');await r.action();await r.bind();expect((await r.status()).undo).toBe(1);await changes(r.page);await expect(textRow(r.page)).toContainText('CONFLICT');await review(r.page).getByRole('button',{name:'Reset session edits',exact:true}).click();await expect(r.page.locator('#target')).toHaveText('Host');await r.page.reload();await r.action();await r.bind();expect((await r.status()).undo).toBe(0);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('09A exact text works without marker authority; DOM changes refresh :empty without source scans',async({},info)=>{
  const r=await launch(info,html('#target{font-size:18px}#target:empty{font-size:29px}'));
  try{await pick(r.page,'#target');const scans=await r.read('__p.sourceStats().scopeScans');await edit(r.page,'');await expect(r.page.locator('#target')).toHaveCSS('font-size','29px');expect(await r.read('__p.editor.getSnapshot().design.values["font-size"].computed')).toBe('29px');expect(await r.read('__p.sourceStats().scopeScans')).toBe(scans);await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveCSS('font-size','18px');expect(await r.read('__p.sourceStats().scopeScans')).toBe(scans);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('09A S: 1000 pointer events add zero DOM/source/cascade/locator/selector/reconciliation/author/output work',async({},info)=>{
  const r=await launch(info);
  try{await pick(r.page,'#target');await edit(r.page,'Owned');await r.read('__p.start();true');const stats=()=>r.read(`({dom:__p.editor.domMutation.getStats(),source:__p.sourceStats(),cascade:__p.cascadeStats(),locator:__p.locatorStats(),selector:__p.selectorStats(),reconciliation:__p.reconciliationStats(),author:__p.editor.authorMutation.getStats(),output:__p.changesStats()})`);const before=await stats();await r.page.locator('#target').evaluate(node=>{for(let n=0;n<1000;n++)node.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,composed:true,clientX:80,clientY:100}));});await r.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));expect(await stats()).toEqual(before);expect(r.errors).toEqual([]);}finally{await r.context.close();}
});
