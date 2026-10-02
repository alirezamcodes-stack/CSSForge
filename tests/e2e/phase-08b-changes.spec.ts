import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { launch, html } from './mutationHarness';
import { dock, pick } from './extensionHarness';

const dialog=(page:Page)=>page.getByRole('dialog',{name:'Changes',exact:true});
const edit=async(page:Page,value:string)=>{const field=page.getByRole('textbox',{name:'Font size',exact:true});await field.fill(value);await field.press('Enter');};
const open=async(page:Page)=>{await dock(page).getByRole('button',{name:'Open Changes',exact:true}).click();return dialog(page);};
const row=(page:Page,property='font-size')=>dialog(page).locator(`[data-change-property="${property}"]`);
const clipboard=async(r:Awaited<ReturnType<typeof launch>>)=>{
  await r.context.grantPermissions(['clipboard-read'],{origin:'http://127.0.0.1:5173'});
  try{return (await r.page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n');}finally{await r.context.clearPermissions();}
};

test('08B net review: original, repeated edits, atomic properties, targets, Undo and Reset',async({},info)=>{
  const r=await launch(info,html('button{font-size:18px;color:purple}','<button id="target">A</button><button id="second">B</button>'));
  try{
    await pick(r.page,'#target');for(const value of ['20px','24px','22px'])await edit(r.page,value);
    let review=await open(r.page);await expect(row(r.page)).toHaveCount(1);await expect(row(r.page)).toContainText('Original (computed): 18px');await expect(row(r.page)).toContainText('Current requested: 22px');
    await review.getByRole('button',{name:'Undo last edit',exact:true}).click();await expect(row(r.page)).toContainText('Current requested: 24px');await expect(row(r.page)).toContainText('18px');
    await r.page.keyboard.press('Escape');
    await r.read(`__p.editor.applyBatch(__p.editor.getSnapshot().design.targetId,{'color':'red','background-color':'blue'});true`);
    await pick(r.page,'#second');await edit(r.page,'26px');review=await open(r.page);
    await expect(review.locator('[data-change-target]')).toHaveCount(2);await expect(review.locator('[data-change-property]')).toHaveCount(4);
    await expect(review).toContainText('4 current declarations');await expect(review).toContainText('button#second');
    await review.getByRole('button',{name:'Reset session edits',exact:true}).click();await expect(review).toContainText('No session changes yet.');await expect(review.getByRole('button',{name:'Copy all CSS',exact:true})).toBeDisabled();
    await expect(r.page.locator('#target')).toHaveCSS('font-size','18px');await expect(r.page.locator('#second')).toHaveCSS('font-size','18px');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('08B context, disabled and blocked truth survives copy with exact CSS',async({},info)=>{
  const r=await launch(info,html('#target{font-size:18px!important}@media(min-width:9999px){button{font-size:20px}}'));
  try{
    await pick(r.page,'#target');await edit(r.page,'32px');
    await r.read(`(()=>{const e=__p.editor,id=e.getSnapshot().design.targetId;e.apply(id,'color','red');e.toggle(id,{media:[],pseudo:''},'color');e.setContext({media:['(min-width: 9999px)'],pseudo:':hover'});e.apply(id,'font-size','34px');e.setContext({media:[],pseudo:'::before'});e.apply(id,'content','"Preview"');return true;})()`);
    // content is outside the registered editor boundary: no fabricated extra row.
    const review=await open(r.page);await expect(review.locator('[data-change-property]')).toHaveCount(3);
    await expect(row(r.page).first().locator('[data-edit-effect]')).toHaveAttribute('data-edit-effect','blocked');
    await expect(row(r.page).first()).toContainText('Browser: 18px');await expect(row(r.page).last()).toContainText('Original: Unknown');
    await expect(row(r.page).last().locator('[data-edit-effect]')).toHaveAttribute('data-edit-effect','pending');
    await expect(row(r.page,'color')).toContainText('Disabled · omitted from CSS');
    await review.getByRole('button',{name:'Copy all CSS',exact:true}).click();await expect(review.getByRole('status')).toContainText('Copied CSS');
    expect(await clipboard(r)).toBe('#target {\n  font-size: 32px !important;\n}\n\n@media (min-width: 9999px) {\n  #target:hover {\n    font-size: 34px !important;\n  }\n}\n');
    await expect(review).toContainText('specificity');expect((await r.status()).undo).toBe(4);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('08B target/all clipboard and one downloadable file have deterministic exact contents and URL cleanup',async({},info)=>{
  const r=await launch(info,html('button{font-size:18px}','<button id="target">A</button><button id="second">B</button>'));
  try{
    await pick(r.page,'#target');await edit(r.page,'22px');await pick(r.page,'#second');await edit(r.page,'26px');
    const review=await open(r.page);
    await review.getByRole('button',{name:'Copy target CSS for button#target',exact:true}).click();await expect(review.getByRole('status')).toContainText('Copied CSS');expect(await clipboard(r)).toBe('#target {\n  font-size: 22px !important;\n}\n');
    const all='#target {\n  font-size: 22px !important;\n}\n\n#second {\n  font-size: 26px !important;\n}\n';
    for(let n=0;n<2;n++){await review.getByRole('button',{name:'Copy all CSS',exact:true}).click();await expect(review.getByRole('status')).toContainText('Copied CSS');expect(await clipboard(r)).toBe(all);}
    await r.read(`globalThis.__urls={created:[],revoked:[]};const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);__urls.created.push(url);return url};URL.revokeObjectURL=url=>{__urls.revoked.push(url);return revoke(url)};true`);
    let downloads=0;r.page.on('download',()=>downloads++);
    const downloadEvent=r.page.waitForEvent('download');await review.getByRole('button',{name:'Export CSS',exact:true}).click();const download=await downloadEvent;
    expect(download.suggestedFilename()).toBe('cssforge-changes.css');const saved=info.outputPath('cssforge-changes.css');await download.saveAs(saved);
    expect(await readFile(saved,'utf8')).toBe(all);expect(downloads).toBe(1);
    await expect.poll(()=>r.read('__urls.revoked.length')).toBe(1);const urls=await r.read('__urls');expect(urls.revoked).toEqual(urls.created);
    expect(await readFile(saved,'utf8')).not.toMatch(/data-cssforge|targetId|bindingGeneration|http|sourceId/);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('08B migration keeps one logical group and baseline; unavailable ownership is never exported',async({},info)=>{
  const r=await launch(info,html('button{font-size:18px;width:200px}'));
  try{
    await pick(r.page,'#target');await edit(r.page,'22px');const id=(await r.status()).target;
    await r.page.locator('#target').evaluate(node=>node.outerHTML='<button id="target" style="font-size:27px;width:300px">B</button>');
    await expect.poll(async()=>(await r.status()).reconciliation).toBe('migrated');
    const review=await open(r.page);await expect(review.locator('[data-change-target]')).toHaveCount(1);await expect(review.locator('[data-change-target]')).toHaveAttribute('data-change-target',id);
    await expect(row(r.page)).toContainText('18px');await expect(row(r.page)).toContainText('22px');
    expect((await r.read('__p.prepareChanges()')).css).toBe('#target {\n  font-size: 22px !important;\n}\n');
    await review.getByRole('button',{name:'Undo last edit',exact:true}).click();await expect(review).toContainText('No session changes yet.');await expect(r.page.locator('#target')).toHaveCSS('font-size','27px');
    await r.page.keyboard.press('Escape');await edit(r.page,'29px');
    // Nonselected target loss follows the existing ownership-clearing contract.
    await r.page.locator('#target').evaluate(node=>node.remove());
    await expect.poll(()=>r.read('__p.prepareChanges().css')).toBe('');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('08B shadow changes remain reviewable with explicit partial export accounting',async({},info)=>{
  const r=await launch(info,html('button{font-size:18px}','<button id="target">A</button><div id="host"></div>','<script>document.addEventListener("DOMContentLoaded",()=>document.querySelector("#host").attachShadow({mode:"open"}).innerHTML="<button id=shadow style=font-size:19px>Shadow</button>");</script>'));
  try{
    await pick(r.page,'#target');await edit(r.page,'22px');await pick(r.page,'#shadow');await edit(r.page,'23px');
    const review=await open(r.page);await expect(review).toContainText('Shadow DOM');await expect(review.getByRole('button',{name:'Copy target CSS for button#shadow',exact:true})).toBeDisabled();
    await review.getByRole('button',{name:'Copy all CSS',exact:true}).click();await expect(review.getByRole('status')).toContainText('1 declarations included · 1 not representable');expect(await clipboard(r)).toBe('#target {\n  font-size: 22px !important;\n}\n');
    const downloadEvent=r.page.waitForEvent('download');await review.getByRole('button',{name:'Export CSS',exact:true}).click();const download=await downloadEvent;const path=info.outputPath('partial.css');await download.saveAs(path);expect(await readFile(path,'utf8')).toBe('#target {\n  font-size: 22px !important;\n}\n');
    await expect(review).toContainText('flat document CSS cannot reach');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

for(const [width,height,zoom] of [[320,480,1],[390,540,1],[1440,900,2]] as const)test(`08B keyboard and bounded review at ${width}x${height}, native zoom ${zoom}`,async({},info)=>{
  const r=await launch(info);
  try{
    await pick(r.page,'#target');await edit(r.page,'22px');await r.page.setViewportSize({width,height});await r.worker.evaluate(async({id,zoom})=>(globalThis as any).chrome.tabs.setZoom(id,zoom),{id:r.tabId,zoom});
    expect(await r.worker.evaluate(async id=>(globalThis as any).chrome.tabs.getZoom(id),r.tabId)).toBe(zoom);
    const opener=dock(r.page).getByRole('button',{name:'Open Changes',exact:true});await opener.focus();await opener.press('Enter');const review=dialog(r.page);
    await expect(review).toBeVisible();expect(await review.evaluate(node=>{const rect=node.getBoundingClientRect();return rect.x>=0&&rect.y>=0&&rect.right<=innerWidth+1&&rect.bottom<=innerHeight+1&&node.scrollWidth<=node.clientWidth+1;})).toBe(true);
    await review.getByRole('button',{name:'Copy all CSS',exact:true}).focus();await r.page.keyboard.press('Tab');await expect(review.getByRole('button',{name:'Export CSS',exact:true})).toBeFocused();
    for(let n=0;n<12;n++)await r.page.keyboard.press('Tab');expect(await review.evaluate(node=>node.contains((node.getRootNode() as ShadowRoot).activeElement))).toBe(true);
    await review.getByRole('button',{name:'Undo last edit',exact:true}).click();await expect(review).toContainText('No session changes yet.');
    await r.page.keyboard.press('Escape');await expect(opener).toBeFocused();expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('08B failed clipboard is accessible; hover never prepares or serializes Changes',async({},info)=>{
  const r=await launch(info);
  try{
    await pick(r.page,'#target');await edit(r.page,'22px');const review=await open(r.page);
    await r.read(`Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:()=>Promise.reject(new Error('Unavailable'))});true`);
    await review.getByRole('button',{name:'Copy all CSS',exact:true}).click();await expect(review.getByRole('status')).toContainText('Copy failed');
    await r.page.keyboard.press('Escape');
    const snapshot=()=>r.read(`({source:__p.sourceStats(),cascade:__p.cascadeStats(),locator:__p.locatorStats(),selector:__p.selectorStats(),reconciliation:__p.reconciliationStats(),author:__p.editor.authorMutation.getStats(),changes:__p.changesStats()})`);
    await r.read('__p.start();true');const before=await snapshot();
    await r.page.locator('#target').evaluate(node=>{for(let i=0;i<1000;i++)node.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,composed:true}));});
    expect(await snapshot()).toEqual(before);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('08B escaped selectors, generated pseudos and long tokens preserve full CSS at narrow widths',async({},info)=>{
  const r=await launch(info,html('button{font-size:18px}','<button id="target:hover">A</button>'));
  try{
    await pick(r.page,'[id="target:hover"]');
    const family='"'+('LongFamily'.repeat(250))+'"';
    await r.read(`(()=>{const e=__p.editor,id=e.getSnapshot().design.targetId;e.apply(id,'font-family',${JSON.stringify(family)});e.setContext({media:[],pseudo:':hover'});e.apply(id,'font-size','24px');e.setContext({media:[],pseudo:'::after'});e.apply(id,'font-size','26px');return true;})()`);
    await r.page.setViewportSize({width:320,height:480});const review=await open(r.page);await expect(row(r.page,'font-family')).toContainText(family);
    expect(await review.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    await review.getByRole('button',{name:'Copy all CSS',exact:true}).click();await expect(review.getByRole('status')).toContainText('Copied CSS');const copied=await clipboard(r);
    expect(copied).toContain(`#target\\:hover {\n  font-family: ${family} !important;`);expect(copied).toContain('#target\\:hover:hover {');expect(copied).toContain('#target\\:hover::after {');
    await expect(row(r.page).last().locator('[data-edit-effect]')).toHaveAttribute('data-edit-effect','unknown');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('08B structural selectors warn and duplicate human labels remain distinguishable',async({},info)=>{
  const r=await launch(info,html('button{font-size:18px}','<button>A</button><button>B</button>'));
  try{
    await pick(r.page,'main button:nth-child(1)');await edit(r.page,'22px');await pick(r.page,'main button:nth-child(2)');await edit(r.page,'26px');
    const review=await open(r.page);await expect(review.getByRole('heading',{name:'button (target 1)',exact:true})).toBeVisible();await expect(review.getByRole('heading',{name:'button (target 2)',exact:true})).toBeVisible();
    await review.getByRole('button',{name:'Copy target CSS for button (target 1)',exact:true}).click();await expect(review.getByRole('status')).toContainText('Copied CSS');
    await expect(review).toContainText('position-dependent');const copied=await clipboard(r);expect(copied).toBe('button:nth-of-type(1) {\n  font-size: 22px !important;\n}\n');expect(copied).not.toContain('cssforge');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('08B dormant author records are classified, excluded from session CSS, and remain Reset-owned',async({},info)=>{
  const r=await launch(info);
  try{
    await pick(r.page,'#target');expect(await r.author('font-size','24px',{priority:'important'})).toBe(true);expect(await r.author('font-size','26px',{priority:''})).toBe(true);
    const review=await open(r.page);await expect(row(r.page)).toContainText('Author recovery · excluded from CSS');await expect(row(r.page)).toContainText('Original (authored): 18px');
    await expect(review).not.toContainText('Target unavailable');await expect(row(r.page)).toContainText('Recorded current: 26px');await expect(row(r.page)).not.toContainText('26px !important');
    expect(await r.read('__p.prepareChanges()')).toMatchObject({css:'',exported:0,omitted:1});
    await review.getByRole('button',{name:'Reset session edits',exact:true}).click();await expect(review).toContainText('No session changes yet.');await expect(r.page.locator('#target')).toHaveCSS('font-size','18px');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('08B recovered author records appear before any new selection and survive conflicting Reset',async({},info)=>{
  const r=await launch(info);
  try{
    await pick(r.page,'#target');expect(await r.author('font-size','24px')).toBe(true);
    await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='21px');await r.read('__p.editor.undo();true');
    await r.action();await expect(r.page.locator('cssforge-ui')).toHaveCount(0);await r.action();await expect(r.page.locator('cssforge-ui')).toHaveCount(1);await r.bind();
    const review=await open(r.page);await expect(row(r.page)).toHaveCount(1);await expect(row(r.page)).toContainText('Original (authored): 18px');await expect(row(r.page)).toContainText('Recorded current: 21px');
    await review.getByRole('button',{name:'Reset session edits',exact:true}).click();await expect(row(r.page)).toHaveCount(1);await expect(review.getByRole('alert')).toContainText('Pending author rollback retained');
    expect(await r.read('__p.prepareChanges()')).toMatchObject({css:'',exported:0,omitted:1});
    await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='24px');await review.getByRole('button',{name:'Reset session edits',exact:true}).click();await expect(review).toContainText('No session changes yet.');await expect(r.page.locator('#target')).toHaveCSS('font-size','18px');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('08B cached target effects hand back correctly to Design, Code and Changes',async({},info)=>{
  const r=await launch(info,html('button{font-size:18px}#target{font-size:18px!important}','<button id="target">A</button><button id="second">B</button>'));
  try{
    await pick(r.page,'#target');await edit(r.page,'32px');await pick(r.page,'#second');await edit(r.page,'26px');await pick(r.page,'#target');
    await expect(r.page.getByTestId('live-design').locator('[data-edit-property="font-size"]')).toHaveAttribute('data-edit-effect','blocked');
    await r.page.getByRole('tab',{name:'Code',exact:true}).click();await expect(r.page.getByTestId('live-code').locator('[data-edit-property="font-size"]')).toHaveAttribute('data-edit-effect','blocked');
    const review=await open(r.page);await expect(review.locator('[data-change-target="1"] [data-edit-property="font-size"]')).toHaveAttribute('data-edit-effect','blocked');await expect(review.locator('[data-change-target="2"] [data-edit-property="font-size"]')).toHaveAttribute('data-edit-effect','effective');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
