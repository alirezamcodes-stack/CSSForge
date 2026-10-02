import { test, expect, type Page } from '@playwright/test';
import { launch, html } from './mutationHarness';
import { pick, dock, aligned } from './extensionHarness';

const scene='<section id="scene"><span id="before">Before</span><button id="target">Target</button><span id="after">After</span></section>';
const review=(page:Page)=>page.getByRole('dialog',{name:'Changes',exact:true});
const insertDialog=(page:Page)=>page.getByRole('dialog',{name:'Insert element',exact:true});
async function menu(page:Page,label:string){await page.getByRole('button',{name:'Inspector menu',exact:true}).click();await page.getByRole('button',{name:label,exact:true}).click();}
async function insertUI(page:Page,tag='div',text='Created',position='after'){
  await menu(page,'Insert element');const d=insertDialog(page);await d.getByLabel('Element type',{exact:true}).selectOption(tag);await d.getByLabel('Position',{exact:true}).selectOption(position);await d.getByRole('textbox',{name:'Optional text',exact:true}).fill(text);await d.getByRole('button',{name:'Insert',exact:true}).click();await expect(d).toHaveCount(0);
}
async function changes(page:Page){await dock(page).getByRole('button',{name:'Open Changes',exact:true}).click();return review(page);}
const mutate=(r:Awaited<ReturnType<typeof launch>>,op:string,position='after',tag='div',text='Created')=>r.read(`(()=>{const e=__p.editor,p=e.prepareStructure(${JSON.stringify(op)},${JSON.stringify(position)});if('state' in p)return p.state;return e.applyStructure(p,${JSON.stringify(tag)},${JSON.stringify(text)}).state})()`);

test('09B A: real Insert, primitive Changes, CSS-only omissions and Undo',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#target');const id=(await r.status()).target;await insertUI(r.page,'div','<b>Literal 🧑🏽‍💻</b>');
    const node=r.page.locator('#target + div');await expect(node).toHaveText('<b>Literal 🧑🏽‍💻</b>');await expect(node.locator('b')).toHaveCount(0);expect((await r.status()).target).toBe(id);expect((await r.status()).undo).toBe(1);
    const c=await changes(r.page);await expect(c.locator('[data-change-kind="DOM_INSERT"]')).toContainText('applied');await expect(c).toContainText('0 text · 1 structure');await expect(c.getByRole('button',{name:'Copy all CSS',exact:true})).toBeDisabled();
    const output=await r.read('__p.prepareChanges()');expect(output.css).toBe('');expect(output.structureOmitted).toBe(1);expect(output.domOmitted).toBeUndefined();
    expect(await r.read(`JSON.stringify(__p.editor.getSnapshot().changes).includes('childNodes')`)).toBe(false);
    await c.getByRole('button',{name:'Undo last edit',exact:true}).click();await expect(node).toHaveCount(0);await expect(c).toContainText('No session changes yet.');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B B/C: inserted button has safe type, fresh ownership, literal text edits and reverse history',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#target');const original=(await r.status()).target;await insertUI(r.page,'button','New');await expect(r.page.locator('#target + button')).toHaveAttribute('type','button');
    await pick(r.page,'#target + button');expect((await r.status()).target).not.toBe(original);await r.read(`__p.editor.applyText(__p.editor.prepareText(),'Edited');true`);
    await expect(r.page.locator('#target + button')).toHaveText('Edited');expect((await r.status()).undo).toBe(2);const c=await changes(r.page);await expect(c.locator('[data-change-kind="DOM_INSERT"]')).toContainText('superseded');await expect(c.locator('[data-change-kind="DOM_TEXT_MUTATION"]')).toHaveCount(1);
    await r.read('__p.editor.undo();true');await expect(r.page.locator('#target + button')).toHaveText('New');await r.read('__p.editor.undo();true');await expect(r.page.locator('#scene > button')).toHaveCount(1);expect((await r.status()).undo).toBe(0);expect((await r.status()).target).toBeUndefined();expect((await r.status()).reconciliation).not.toBe('migrated');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B C/U: Cancel, Escape and contained keyboard focus return to opener with zero writes',async({},info)=>{
  const r=await launch(info);try{
    await pick(r.page,'#target');for(const method of ['Cancel','Escape']){await menu(r.page,'Insert element');const d=insertDialog(r.page);await d.getByLabel('Optional text').fill('Draft');for(let n=0;n<9;n++){await r.page.keyboard.press('Tab');await expect.poll(()=>d.evaluate(node=>node.contains((node.getRootNode() as ShadowRoot).activeElement))).toBe(true);}
      if(method==='Cancel')await d.getByRole('button',{name:'Cancel',exact:true}).click();else await r.page.keyboard.press('Escape');await expect(d).toHaveCount(0);await expect(r.page.getByRole('button',{name:'Inspector menu',exact:true})).toBeFocused();expect((await r.status()).undo).toBe(0);}
    expect(await r.read('__p.editor.structureMutation.getStats().writes')).toBe(0);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B D: Duplicate strips proven markers, retains host lookalikes and has fresh physical/logical ownership',async({},info)=>{
  const r=await launch(info,html('.target{color:purple}','<section id="scene"><button class="target" data-cssforge-host-like="host">Target</button></section>'));try{
    await pick(r.page,'.target');const original=(await r.status()).target;await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'color','red');true`);await menu(r.page,'Duplicate');
    await expect(r.page.locator('.target')).toHaveCount(2);const clone=r.page.locator('.target').nth(1);await expect(clone).toHaveCSS('color','rgb(128, 0, 128)');await expect(clone).toHaveAttribute('data-cssforge-host-like','host');
    expect(await clone.evaluate(node=>node.getAttributeNames().filter(name=>name.startsWith('data-cssforge-target-')))).toEqual([]);
    await pick(r.page,'.target:last-child');expect((await r.status()).target).not.toBe(original);expect((await r.status()).overrides).toEqual([]);await r.read('__p.editor.undo();true');await expect(r.page.locator('.target')).toHaveCount(1);expect((await r.status()).undo).toBe(1);await r.read('__p.editor.undo();true');await expect(r.page.locator('.target')).toHaveCSS('color','rgb(128, 0, 128)');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B E: IDs/IDREF and unsafe descendants refuse the whole Duplicate and explain disabled actions',async({},info)=>{
  const r=await launch(info);try{
    await pick(r.page,'#target');await r.page.getByRole('button',{name:'Inspector menu',exact:true}).click();const button=r.page.getByRole('button',{name:'Duplicate',exact:true});await expect(button).toBeDisabled();expect(await button.getAttribute('aria-describedby')).toBeTruthy();await expect(r.page.getByText('Duplicate: Duplicate refuses IDs', {exact:false})).toBeVisible();await r.page.keyboard.press('Escape');
    await r.page.locator('#target').evaluate(node=>{node.removeAttribute('id');node.setAttribute('aria-labelledby','label');});await pick(r.page,'button[aria-labelledby]');expect(await mutate(r,'duplicate')).toBe('UNSUPPORTED');expect((await r.status()).undo).toBe(0);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B F/G: Delete clears selection without reconciliation; Undo restores native object/listener and older CSS',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#target');const id=(await r.status()).target;await r.page.locator('#target').evaluate(node=>{(window as any).original=node;(window as any).text=node.firstChild;node.addEventListener('click',()=>{(window as any).clicked=true;});});
    await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'color','red');true`);await menu(r.page,'Delete');await expect(r.page.locator('#target')).toHaveCount(0);expect((await r.status()).target).toBeUndefined();expect((await r.status()).undo).toBe(2);expect((await r.status()).reconciliation).not.toBe('migrated');
    await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveCSS('color','rgb(255, 0, 0)');expect(await r.page.locator('#target').evaluate(node=>node===(window as any).original&&node.firstChild===(window as any).text)).toBe(true);expect((await r.status()).target).toBeUndefined();
    await pick(r.page,'#target');expect((await r.status()).target).toBe(id);await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveCSS('color','rgb(128, 0, 128)');await r.page.locator('#target').click();expect(await r.page.evaluate(()=>(window as any).clicked)).toBe(true);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B H: text then Delete then Undo Delete then Undo text restores exact Text authority',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#target');await r.read(`__p.editor.applyText(__p.editor.prepareText(),'Edited');true`);expect(await mutate(r,'delete')).toBe('applied');await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveText('Edited');await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveText('Target');expect((await r.status()).undo).toBe(0);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B I: Delete refuses changed restore gap and preserves detached host changes through Reset/deactivation',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#target');await r.page.locator('#target').evaluate(node=>(window as any).removed=node);await mutate(r,'delete');await r.page.locator('#after').evaluate(node=>{const host=document.createElement('b');host.textContent='Host';node.before(host);});
    await r.read('__p.editor.undo();true');expect((await r.status()).undo).toBe(1);await expect(r.page.locator('#target')).toHaveCount(0);await expect(r.page.locator('#scene > b')).toHaveText('Host');const c=await changes(r.page);await expect(c.locator('[data-change-kind="DOM_DELETE"]')).toContainText('CONFLICT');
    await r.read('__p.editor.reset();true');expect((await r.status()).undo).toBe(1);await r.action();await r.action();await r.bind();expect((await r.status()).undo).toBe(1);await expect(r.page.locator('#scene > b')).toHaveText('Host');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
for(const [operation,label,order] of [['up','Move up','target,before,after'],['down','Move down','before,after,target']] as const){
  test(`09B J/K: ${label} preserves owner/generation/CSS/text, geometry and exact Undo`,async({},info)=>{
    const r=await launch(info,html(undefined,scene));try{
      await pick(r.page,'#target');const id=(await r.status()).target,generation=await r.read('__p.editor.getSnapshot().design.bindingGeneration');await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'color','red');__p.editor.applyText(__p.editor.prepareText(),'Edited');true`);await menu(r.page,label);
      expect(await r.page.locator('#scene').evaluate(node=>Array.from(node.children).map(child=>child.id).join(','))).toBe(order);expect((await r.status()).target).toBe(id);expect(await r.read('__p.editor.getSnapshot().design.bindingGeneration')).toBe(generation);await expect(r.page.locator('#target')).toHaveCSS('color','rgb(255, 0, 0)');await aligned(r.page,'#target');
      await r.read('__p.editor.undo();true');expect(await r.page.locator('#scene').evaluate(node=>Array.from(node.children).map(child=>child.id).join(','))).toBe('before,target,after');await r.read('__p.editor.undo();__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveText('Target');expect((await r.status()).undo).toBe(0);expect(r.errors).toEqual([]);
    }finally{await r.context.close();}
  });
}
test('09B L: first/last boundaries disable safely without a transaction',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#before');await r.page.getByRole('button',{name:'Inspector menu',exact:true}).click();await expect(r.page.getByRole('button',{name:'Move up',exact:true})).toBeDisabled();await r.page.keyboard.press('Escape');await pick(r.page,'#after');await r.page.getByRole('button',{name:'Inspector menu',exact:true}).click();await expect(r.page.getByRole('button',{name:'Move down',exact:true})).toBeDisabled();expect((await r.status()).undo).toBe(0);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
for(const operation of ['insert','duplicate','delete','up'] as const){
  test(`09B M/N: same-task host observer reaction to ${operation} stays one transaction with visible conflict and no war`,async({},info)=>{
    const r=await launch(info,html('.target{color:purple}',scene.replace('id="target"','class="target"'),`<script>document.addEventListener('DOMContentLoaded',()=>{const p=document.getElementById('scene');window.reactions=0;new MutationObserver(()=>{if(window.reactions++)return;${operation==='delete'?'p.insertBefore(document.createElement("b"),document.getElementById("after"));':operation==='up'?'p.appendChild(p.querySelector(".target"));':'const n=p.querySelector(".target").nextElementSibling;n.setAttribute("data-host","changed");'}}).observe(p,{childList:true});});</script>`));try{
      await pick(r.page,'.target');expect(await mutate(r,operation)).toBe('applied');await expect.poll(()=>r.read('__p.editor.getSnapshot().changes.flatMap(g=>g.structures??[]).at(-1)?.state')).toBe('CONFLICT');expect((await r.status()).undo).toBe(1);expect(await r.read('__p.editor.structureMutation.getStats().writes')).toBe(1);await r.read('__p.editor.undo();true');expect((await r.status()).undo).toBe(1);expect(await r.read('__p.editor.structureMutation.getStats().writes')).toBe(1);expect((await r.status()).reconciliation).not.toBe('migrated');expect(r.errors).toEqual([]);
    }finally{await r.context.close();}
  });
}
test('09B host mutation of inserted content is retained; later owned text remains reversible',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#target');await insertUI(r.page,'button','Created');await pick(r.page,'#target + button');await r.read(`__p.editor.applyText(__p.editor.prepareText(),'Owned');true`);await r.page.locator('#target + button').evaluate(node=>node.setAttribute('data-host','preserve'));await r.read('__p.editor.undo();__p.editor.undo();true');
    await expect(r.page.locator('#target + button')).toHaveText('Created');await expect(r.page.locator('#target + button')).toHaveAttribute('data-host','preserve');expect((await r.status()).undo).toBe(1);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B O: open shadow root supports exact native structure; closed host and iframe remain unsupported',async({},info)=>{
  const r=await launch(info,html('',`<div id="open"></div><x-closed id="closed" style="display:block;width:100px;height:40px"></x-closed><iframe id="frame" srcdoc="<button>Inside</button>"></iframe>`,`<script>document.addEventListener('DOMContentLoaded',()=>{const r=document.getElementById('open').attachShadow({mode:'open'});r.innerHTML='<button class="target">Shadow</button><p>After</p>';customElements.define('x-closed',class extends HTMLElement{constructor(){super();this.attachShadow({mode:'closed'}).innerHTML='<button>Closed</button>';}});});</script>`));try{
    await pick(r.page,'#open .target');expect(await mutate(r,'insert')).toBe('applied');await expect(r.page.locator('#open .target + div')).toHaveText('Created');await r.read('__p.editor.undo();true');await expect(r.page.locator('#open .target + div')).toHaveCount(0);expect(await mutate(r,'delete')).toBe('applied');await r.read('__p.editor.undo();true');await expect(r.page.locator('#open .target')).toHaveText('Shadow');
    await pick(r.page,'#closed');expect(await mutate(r,'delete')).toBe('UNSUPPORTED');await dock(r.page).getByRole('button',{name:'Pick page element',exact:true}).click();const box=(await r.page.locator('#frame').boundingBox())!;await r.page.mouse.click(box.x+1,box.y+1);expect(await mutate(r,'delete')).toBe('UNSUPPORTED');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B P/Q: HTML and Navigator read actual children after Insert, Reorder, Undo and Reset',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#target');await insertUI(r.page,'span','Tree child','first');await r.page.getByRole('tab',{name:'HTML',exact:true}).click();await expect(r.page.getByRole('tree')).toContainText('span');await dock(r.page).getByRole('button',{name:'Open Navigator',exact:true}).click();await expect(r.page.getByRole('dialog',{name:'Navigator',exact:true})).toContainText('span');await r.page.keyboard.press('Escape');
    await r.read('__p.editor.undo();true');await expect(r.page.getByRole('tree')).not.toContainText('Tree child');await mutate(r,'down');await r.read('__p.editor.undo();true');await insertUI(r.page,'span','Reset child','first');await r.read('__p.editor.reset();true');await expect(r.page.locator('#target > span')).toHaveCount(0);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B R/S/T: mixed CSS/text/structure, truthful separate omissions and reverse Reset',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#target');await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'color','red');__p.editor.applyText(__p.editor.prepareText(),'Edited');true`);await mutate(r,'insert');await mutate(r,'down');expect((await r.status()).undo).toBe(4);
    const c=await changes(r.page);const output=await r.read('__p.prepareChanges()');expect(output.css).toContain('color: red !important');expect(output.css).not.toContain('Edited');expect(output.domOmitted).toBe(1);expect(output.structureOmitted).toBe(2);await expect(c).toContainText('1 text · 2 structure');
    await r.read('__p.editor.reset();true');expect((await r.status()).undo).toBe(0);await expect(r.page.locator('#scene > div')).toHaveCount(0);await expect(r.page.locator('#target')).toHaveText('Target');await expect(r.page.locator('#target')).toHaveCSS('color','rgb(128, 0, 128)');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B net projection: Duplicate then exact Delete and move back disappear without erasing Undo',async({},info)=>{
  const r=await launch(info,html('.target{color:purple}',scene.replace('id="target"','class="target"')));try{
    await pick(r.page,'.target');await mutate(r,'duplicate');await pick(r.page,'.target:nth-of-type(2)');await mutate(r,'delete');expect(await r.read('__p.editor.getSnapshot().changes.flatMap(g=>g.structures??[]).length')).toBe(0);expect((await r.status()).undo).toBe(2);await r.read('__p.editor.undo();__p.editor.undo();true');await pick(r.page,'.target');await mutate(r,'up');await mutate(r,'down');expect(await r.read('__p.editor.getSnapshot().changes.flatMap(g=>g.structures??[]).length')).toBe(0);expect((await r.status()).undo).toBe(2);await r.read('__p.editor.reset();true');expect((await r.status()).undo).toBe(0);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B stale draft after strong replacement cannot insert onto a migrated target',async({},info)=>{
  const r=await launch(info);try{
    await pick(r.page,'#target');await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'color','red');true`);await menu(r.page,'Insert element');await r.page.locator('#target').evaluate(node=>node.outerHTML='<button id="target">Replacement</button>');await expect.poll(async()=>(await r.status()).reconciliation).toBe('migrated');await expect(insertDialog(r.page).getByRole('status')).toContainText('STALE');await expect(insertDialog(r.page).getByRole('button',{name:'Insert',exact:true})).toBeDisabled();expect((await r.status()).undo).toBe(1);expect(await r.read('__p.editor.structureMutation.getStats().writes')).toBe(0);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B deactivation reverses mixed structural history and retains exact conflict recovery',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#target');await mutate(r,'insert', 'after','button','Created');await pick(r.page,'#target + button');await r.read(`__p.editor.applyText(__p.editor.prepareText(),'Edited');true`);await r.action();await expect(r.page.locator('#scene > button')).toHaveCount(1);await r.action();await r.bind();expect((await r.status()).undo).toBe(0);
    await pick(r.page,'#target');await mutate(r,'insert');await r.page.locator('#target + div').evaluate(node=>node.setAttribute('data-host','owned'));await r.action();await expect(r.page.locator('#target + div')).toHaveAttribute('data-host','owned');await r.action();await r.bind();expect((await r.status()).undo).toBe(1);const c=await changes(r.page);await expect(c.locator('[data-change-kind="DOM_INSERT"]')).toContainText('CONFLICT');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B U: narrow viewport and native Chrome zoom keep Insert keyboard reachable',async({},info)=>{
  const r=await launch(info);try{
    await pick(r.page,'#target');await r.page.setViewportSize({width:540,height:900});await r.worker.evaluate(async id=>{await (globalThis as any).chrome.tabs.setZoom(id,2);},r.tabId);expect(await r.worker.evaluate(id=>(globalThis as any).chrome.tabs.getZoom(id),r.tabId)).toBe(2);await menu(r.page,'Insert element');const d=insertDialog(r.page);const bounds=await d.boundingBox(),viewport=await r.page.evaluate(()=>({width:innerWidth,height:innerHeight}));expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(viewport.width+1);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(viewport.height+1);await d.getByLabel('Optional text').fill('Zoom');await d.getByRole('button',{name:'Insert',exact:true}).focus();await r.page.keyboard.press('Enter');await expect(d).toHaveCount(0);expect((await r.status()).undo).toBe(1);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B V: 1000 pointer moves perform zero structural work beyond idle',async({},info)=>{
  const r=await launch(info);try{
    await pick(r.page,'#target');await r.read('__p.source();true');const stats=()=>r.read(`({structure:__p.editor.structureMutation.getStats(),text:__p.editor.domMutation.getStats(),source:__p.sourceStats(),cascade:__p.cascadeStats(),selector:__p.selectorStats(),locator:__p.locatorStats(),reconciliation:__p.reconciliationStats(),author:__p.editor.authorMutation.getStats(),changes:__p.changesStats()})`);const before=await stats();
    await r.page.evaluate(()=>{for(let i=0;i<1000;i++)document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:500+i%50,clientY:400+i%50}));});await r.page.waitForTimeout(250);expect(await stats()).toEqual(before);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B W: nth-child/has/sibling matching refreshes without rescanning stylesheet scopes or generating selectors',async({},info)=>{
  const r=await launch(info,html('#target:nth-child(2){color:purple} #scene:has(>div) #target{color:green} div + #target{font-size:25px}',scene));try{
    await pick(r.page,'#target');expect(await r.read('__p.source().rules.map(rule=>rule.selector)')).toContain('#target:nth-child(2)');const scans=await r.read('__p.sourceStats().scopeScans'),selector=await r.read('__p.selectorStats()');
    await mutate(r,'insert','before');await expect(r.page.locator('#target')).toHaveCSS('color','rgb(0, 128, 0)');const rules=await r.read('__p.source().rules.map(rule=>rule.selector)');expect(rules).not.toContain('#target:nth-child(2)');expect(rules).toContain('#scene:has(> div) #target');expect(rules).toContain('div + #target');expect(await r.read('__p.sourceStats().scopeScans')).toBe(scans);expect(await r.read('__p.selectorStats()')).toEqual(selector);
    await r.read('__p.editor.undo();true');expect(await r.read('__p.source().rules.map(rule=>rule.selector)')).toContain('#target:nth-child(2)');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B X: CSS on a created element exports only a freshly validated unique selector',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#target');await mutate(r,'insert','after','button','Created');await pick(r.page,'#target + button');await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'color','red');true`);const before=await r.read('__p.selectorStats()');await mutate(r,'down');expect(await r.read('__p.selectorStats()')).toEqual(before);
    const output=await r.read('__p.prepareChanges()');expect(output.css).toContain('color: red !important');expect(output.css).not.toContain('data-cssforge');expect(output.exported).toBe(1);expect(output.structureOmitted).toBe(2);expect(await r.read('__p.selectorStats()')).not.toEqual(before);await r.read('__p.editor.reset();true');await expect(r.page.locator('#scene > button')).toHaveCount(1);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B Y: blocked newer text prevents Reset/deactivation from removing an equal-baseline creation',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#target');await mutate(r,'insert','after','button','Original');await pick(r.page,'#target + button');await r.read(`__p.editor.applyText(__p.editor.prepareText(),'Owned');true`);await r.page.locator('#target + button').evaluate(node=>{node.firstChild!.nodeValue='Original';});
    await r.read('__p.editor.reset();true');await expect(r.page.locator('#target + button')).toHaveText('Original');expect((await r.status()).undo).toBe(2);await r.action();await expect(r.page.locator('#target + button')).toHaveText('Original');await r.action();await r.bind();expect((await r.status()).undo).toBe(2);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B stale anchors and modified duplicate subtree refuse writes or destructive Undo',async({},info)=>{
  const r=await launch(info,html('.target{color:purple}',scene.replace('id="target"','class="target"')));try{
    await pick(r.page,'.target');await r.read(`globalThis.__structure=__p.editor.prepareStructure('insert');true`);await r.page.locator('#after').evaluate(node=>node.before(document.createElement('i')));expect(await r.read(`__p.editor.applyStructure(__structure).state`)).toBe('CONFLICT');expect((await r.status()).undo).toBe(0);
    await mutate(r,'duplicate');await r.page.locator('.target').nth(1).evaluate(node=>{node.firstChild!.nodeValue='Host clone';});await r.read('__p.editor.undo();true');await expect(r.page.locator('.target').nth(1)).toHaveText('Host clone');expect((await r.status()).undo).toBe(1);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B safe author then Delete reverses with exact native ownership in global order',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#target');expect(await r.author('color','red',{inline:true})).toBe(true);await mutate(r,'delete');await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveCSS('color','rgb(255, 0, 0)');await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveCSS('color','rgb(128, 0, 128)');expect((await r.status()).undo).toBe(0);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B parent Delete parks descendant CSS and Text owners and restores them without migration',async({},info)=>{
  const r=await launch(info,html('#target{color:purple}','<section id="scene"><div id="parent"><button id="target">Target</button></div><span id="after">After</span></section>'));try{
    await pick(r.page,'#target');const id=(await r.status()).target;await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'color','red');__p.editor.applyText(__p.editor.prepareText(),'Edited');__p.parent();true`);expect(await mutate(r,'delete')).toBe('applied');await expect(r.page.locator('#parent')).toHaveCount(0);await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveCSS('color','rgb(255, 0, 0)');await expect(r.page.locator('#target')).toHaveText('Edited');await pick(r.page,'#target');expect((await r.status()).target).toBe(id);await r.read('__p.editor.undo();__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveText('Target');await expect(r.page.locator('#target')).toHaveCSS('color','rgb(128, 0, 128)');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B Insert supports all allowed placements and preserves non-element sibling order through reverse Reset',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#target');await r.page.locator('#target').evaluate(node=>{node.before(document.createTextNode('gap'));node.after(document.createComment('comment'));});const original=await r.page.locator('#scene').evaluate(node=>Array.from(node.childNodes).map(child=>[child.nodeType,child.nodeName,child.nodeValue]));
    for(const position of ['before','after','first','last'])expect(await mutate(r,'insert',position,'span',position)).toBe('applied');expect((await r.status()).undo).toBe(4);await r.read('__p.editor.reset();true');expect(await r.page.locator('#scene').evaluate(node=>Array.from(node.childNodes).map(child=>[child.nodeType,child.nodeName,child.nodeValue]))).toEqual(original);expect((await r.status()).undo).toBe(0);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B committed structure authority never transfers through strong CSS replacement reconciliation',async({},info)=>{
  const r=await launch(info,html(undefined,scene));try{
    await pick(r.page,'#target');await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'color','red');true`);await mutate(r,'up');const id=(await r.status()).target;await r.page.locator('#target').evaluate(node=>node.outerHTML='<button id="target">Replacement</button>');await expect.poll(async()=>(await r.status()).reconciliation).toBe('migrated');expect((await r.status()).target).toBe(id);
    await expect(r.page.locator('#target')).toHaveCSS('color','rgb(255, 0, 0)');await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveText('Replacement');expect((await r.status()).undo).toBe(2);expect(await r.read('__p.editor.getSnapshot().changes[0].structures[0].state')).toBe('UNAVAILABLE');await r.read('__p.editor.reset();true');await expect(r.page.locator('#target')).toHaveCSS('color','rgb(128, 0, 128)');expect((await r.status()).undo).toBe(1);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B root-level shadow CSS layers never become structural restore anchors',async({},info)=>{
  const r=await launch(info,html('', '<div id="open"></div>',`<script>document.addEventListener('DOMContentLoaded',()=>{const root=document.getElementById('open').attachShadow({mode:'open'});root.innerHTML='<button class="target">Shadow</button>';});</script>`));try{
    await pick(r.page,'#open .target');await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'color','red');__p.editor.applyText(__p.editor.prepareText(),'Edited');true`);await mutate(r,'delete');expect(await r.read('__p.editor.getSnapshot().changes.flatMap(g=>g.structures??[])[0].state')).toBe('applied');await r.read('__p.editor.undo();true');await expect(r.page.locator('#open .target')).toHaveText('Edited');await expect(r.page.locator('#open .target')).toHaveCSS('color','rgb(255, 0, 0)');await r.read('__p.editor.undo();__p.editor.undo();true');await expect(r.page.locator('#open .target')).toHaveText('Shadow');expect((await r.status()).undo).toBe(0);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
test('09B page-end Delete recovery uses page anchors across replacement UI lifetimes',async({},info)=>{
  const r=await launch(info);try{
    await pick(r.page,'#target');await r.read('__p.parent();true');await r.page.locator('main').evaluate(node=>{(window as any).originalMain=node;while(node.nextSibling?.nodeType===3&&!node.nextSibling.nodeValue?.trim())node.nextSibling.remove();});await mutate(r,'delete');expect(await r.read('__p.editor.getSnapshot().changes.flatMap(g=>g.structures??[])[0].state')).toBe('applied');
    await r.page.evaluate(()=>{const host=document.createElement('b');host.id='host-gap';document.body.appendChild(host);});await r.action();await r.action();await r.bind();expect((await r.status()).undo).toBe(1);await r.page.locator('#host-gap').evaluate(node=>node.remove());await r.read('__p.editor.undo();true');await expect(r.page.locator('main')).toHaveCount(1);expect(await r.page.locator('main').evaluate(node=>node===(window as any).originalMain)).toBe(true);expect((await r.status()).undo).toBe(0);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
