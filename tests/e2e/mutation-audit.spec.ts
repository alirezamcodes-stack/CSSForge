import { test, expect } from '@playwright/test';
import { pick, dock, inspector } from './extensionHarness';
import { html, launch, evidence, nativeCallback } from './mutationHarness';

// Q01–Q04 are corrected 07.4B regressions; Q05 remains deferred.
test('Q01 whole mixed-state selector scope requires explicit authorization', async ({}, info) => {
  const r = await launch(info, html('#target, .other:hover{font-size:18px;color:purple}', '<button id="target">Target</button>'+Array.from({length:5},(_,i)=>`<button id="other-${i}" class="other">Other ${i}</button>`).join('')));
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); const result = await r.status();
    expect(result.state).toBe('fallback'); expect(result.scope).toMatchObject({kind:'unknown',matchedCount:6,risk:'unknown'});
    await r.page.locator('#other-0').hover(); await expect(r.page.locator('#other-0')).toHaveCSS('font-size','18px');
    await r.read('__p.editor.undo();true'); await r.author('font-size','24px',{allowShared:true}); const authorized=await r.status(); expect(authorized.state).toBe('mutated'); expect(authorized.scope).toMatchObject({kind:'unknown',matchedCount:6});
    await r.page.locator('#other-0').hover(); await expect(r.page.locator('#other-0')).toHaveCSS('font-size','24px');
    const actual = await r.page.evaluate(() => ({ potential: document.querySelectorAll('#target, .other').length, hovered: getComputedStyle(document.querySelector('#other-0')!).fontSize }));
    await r.read('__p.editor.undo();true'); await expect(r.page.locator('#other-0')).toHaveCSS('font-size','18px');
    await evidence(info,['A'],{result,authorized,actual},'Every potential selector-list branch is conservatively authorized.'); expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});


test('Q02 native partial write retains recovery and Undo preserves the page callback', async ({}, info) => {
  const r = await launch(info, html('', '<button is="audit-button" id="target" style="font-size:18px;color:purple">Target</button>', nativeCallback()));
  try {
    await pick(r.page,'#target'); expect(await r.author('font-size','24px')).toBe(false); const rejected = await r.status();
    expect(rejected.state).toBe('rejected'); expect(rejected.undo).toBe(1); expect(rejected.active).toHaveLength(1); expect(rejected.active[0]).toMatchObject({kind:'partial',state:'partial-write',before:{value:'18px'},attempted:{value:'24px'},current:{value:'24px'}});
    const changed = await r.page.locator('#target').evaluate(node => (node as HTMLElement).style.cssText); expect(changed).toContain('24px'); expect(changed).toContain('green');
    await r.read('__p.editor.undo();true'); await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); await expect(r.page.locator('#target')).toHaveCSS('color','rgb(0, 128, 0)'); expect((await r.status()).undo).toBe(0); expect((await r.status()).active).toEqual([]);
    await r.read('__p.editor.reset();true'); await expect(r.page.locator('#target')).toHaveCSS('color','rgb(0, 128, 0)');
    await evidence(info,['A'],{rejected,changed,afterReset:await r.status()},'Rejected partial native writes remain recoverable without overwriting unrelated page changes.'); expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

test('Q03 deactivation retains blocked author history until exact safe retry', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); await r.page.locator('#author').evaluate(node => ((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.color='green');
    await r.read('__p.editor.undo();true'); const conflict = await r.status(); expect(conflict.undo).toBe(1);
    await r.action(); await expect(r.page.locator('cssforge-ui')).toHaveCount(0); expect((await r.css())[0]).toContain('24px'); expect((await r.css())[0]).toContain('green');
    await r.action(); await expect(inspector(r.page)).toBeVisible(); await r.bind(); await pick(r.page,'#target'); const restarted = await r.status(); expect(restarted.undo).toBe(1); expect(restarted.active).toHaveLength(1); expect(restarted.active[0].state).toBe('blocked');
    await r.read('__p.editor.reset();true'); expect((await r.css())[0]).toContain('24px');
    expect((await r.status()).undo).toBe(1); await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.color='purple'); await r.read('__p.editor.undo();true'); await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); expect((await r.status()).undo).toBe(0);
    await evidence(info,['A','B'],{conflict,restarted,liveCSS:await r.css()},'Blocked author history survives UI teardown and retries only against the exact safe native state.'); expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

test('Q04 current attribution changes independently of retained historical ownership', async ({}, info) => {
  const r=await launch(info);
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='21px');
    const refreshed=await r.read(`(()=>{const s=__p.source(true),c=__p.cascade();return {declaration:s.rules.flatMap(r=>r.declarations).find(d=>d.property==='font-size'),winner:c.properties['font-size'].winner.declaration.value};})()`);
    expect(refreshed.declaration.value).toBe('21px'); expect(refreshed.winner).toBe('21px'); expect(refreshed.declaration.mutationState).toBe('authored');
    await r.read('__p.editor.undo();true'); expect((await r.status()).undo).toBe(1);
    await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='24px'); expect(await r.read(`__p.source(true).rules.flatMap(r=>r.declarations).find(d=>d.property==='font-size').mutationState`)).toBe('cssforge-mutated-author'); expect((await r.status()).undo).toBe(1); await r.read('__p.editor.undo();true');
    await evidence(info,['A','B'],refreshed,'Current live attribution is separate from retained historical ownership.'); expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

test('Q05 custom token scope counts direct selector matches but misses inherited dependents', async ({}, info) => {
  const scene='<section id="target" style="padding:24px">Parent'+Array.from({length:6},(_,i)=>`<span class="dependent">Dependent ${i}</span>`).join('')+'</section>';
  const r=await launch(info,html('#target{--token:green}.dependent{color:var(--token)}',scene));
  try {
    const start=dock(r.page).getByRole('button',{name:'Pick page element',exact:true}); if(await start.count())await start.click(); await r.page.locator('#target').click({position:{x:8,y:8}}); await expect(start).toBeVisible(); expect(await r.read('__p.targetLocator().identity.element.id')).toBe('target'); expect(await r.author('--token','purple')).toBe(true); const result=await r.status(); expect(result.scope).toMatchObject({kind:'target-specific',matchedCount:1,risk:'local'});
    const actual=await r.page.locator('.dependent').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).color)); expect(actual).toEqual(Array(6).fill('rgb(128, 0, 128)'));
    await r.read('__p.editor.undo();true'); await expect(r.page.locator('.dependent').first()).toHaveCSS('color','rgb(0, 128, 0)');
    await evidence(info,['A','F'],{result,affectedDependents:actual},'Direct selector count is accurate; computed dependent/inherited impact must not be represented as proven local-only scope.',true); expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

for (const [id,external] of [['Q06','value'],['Q07','unrelated'],['Q08','removed'],['Q09','important-added'],['Q10','important-removed'],['Q11','shorthand']] as const) test(`${id} external ${external} change blocks Undo and Reset without overwriting page state`,async({},info)=>{
  const r=await launch(info,html(`#target{font-size:18px${external==='important-removed'?'!important':''};color:purple}`));
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px');
    await r.page.locator('#author').evaluate((node,kind)=>{const style=((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style;if(kind==='value')style.fontSize='21px';if(kind==='unrelated')style.color='green';if(kind==='removed')style.removeProperty('font-size');if(kind==='important-added')style.setProperty('font-size','24px','important');if(kind==='important-removed')style.setProperty('font-size','24px','');if(kind==='shorthand')style.setProperty('font','21px serif');},external);
    const before=await r.css();await r.read('__p.editor.undo();true');const undo=await r.status();expect(undo.undo).toBe(1);expect(undo.error).toContain('Author source changed');expect(await r.css()).toEqual(before);
    await r.read('__p.editor.reset();true');expect((await r.status()).undo).toBe(1);expect(await r.css()).toEqual(before);
    await evidence(info,['B'],{before,undo,reset:await r.status()},'Detect changed/removed declarations, priority and unrelated author edits; retain the blocked transaction.');expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

for(const count of [1,4,50])test(`Q${count===1?'12':count===4?'13':'14'} direct shared scope ${count} matches agrees with native selector count`,async({},info)=>{
  const scene=Array.from({length:count},(_,i)=>`<button class="button" id="${i?'other-'+i:'target'}">${i}</button>`).join('');const r=await launch(info,html('.button{font-size:18px;color:purple}',scene));
  try {await pick(r.page,'#target');const before=await r.css();await r.read(`__p.editor.setMutationPolicy({mode:'SAFE_AUTHOR_MUTATION'});__p.editor.apply(__p.editor.getSnapshot().design.targetId,'font-size','24px');true`);const result=await r.status();expect(result.scope.matchedCount).toBe(await r.page.locator('.button').count());expect(result.state).toBe(count===1?'mutated':'fallback');if(count>1){expect(await r.css()).toEqual(before);await expect(r.page.locator('#other-1')).toHaveCSS('font-size','18px');}await r.read('__p.editor.reset();true');await r.author('font-size','28px',{allowShared:true});const authorized=await r.status();expect(authorized.state).toBe('mutated');expect(authorized.scope.matchedCount).toBe(count);for(const node of await r.page.locator('.button').all())await expect(node).toHaveCSS('font-size','28px');await r.read('__p.editor.undo();true');expect(await r.css()).toEqual(before);await evidence(info,['A'],{result,authorized},'Default policy requires explicit shared authorization; exact direct scope and Undo must agree with native CSSOM.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q15 same declaration edited from two selected elements keeps one coherent source history',async({},info)=>{
  const r=await launch(info,html('.button{font-size:18px;color:purple}','<button id="target" class="button">A</button><button id="other" class="button">B</button>'));
  try {await pick(r.page,'#target');const before=await r.css();await r.author('font-size','24px',{allowShared:true});const a=await r.status();await pick(r.page,'#other');await r.author('font-size','30px',{allowShared:true});const b=await r.status();expect(b.target).not.toBe(a.target);expect(b.active[0].ruleId).toBe(b.active[1].ruleId);expect(b.undo).toBe(2);await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveCSS('font-size','24px');await r.read('__p.editor.undo();true');expect(await r.css()).toEqual(before);expect((await r.status()).undo).toBe(0);await evidence(info,['A'],{a,b,restored:await r.status()},'Source identity, not selected target ID, governs reverse restoration of a shared declaration.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q16 repeated property and multiple declarations on one rule reverse in transaction order',async({},info)=>{
  const r=await launch(info,html('#target{font-size:18px;color:purple;opacity:1}'));
  try {await pick(r.page,'#target');const before=await r.css();await r.author('font-size','24px');await r.author('font-size','30px');await r.author('color','green');await r.author('opacity','0.5');const applied=await r.status();expect(applied.undo).toBe(4);expect(new Set(applied.active.map((c:any)=>c.ruleId)).size).toBe(1);await r.read('__p.editor.undo();__p.editor.undo();__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveCSS('font-size','24px');await r.read('__p.editor.reset();true');expect(await r.css()).toEqual(before);expect((await r.status()).undo).toBe(0);await evidence(info,['A'],applied,'Same-rule fingerprints must reverse in order without duplicate/missing history.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q17 shared rule external change remains blocked for every matching recipient',async({},info)=>{
  const r=await launch(info,html('.button{font-size:18px;color:purple}','<button id="target" class="button">A</button><button class="button">B</button>'));
  try {await pick(r.page,'#target');await r.author('font-size','24px',{allowShared:true});await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='21px');await r.read('__p.editor.reset();true');const result=await r.status();expect(result.undo).toBe(1);for(const node of await r.page.locator('.button').all())await expect(node).toHaveCSS('font-size','21px');await evidence(info,['B'],result,'Shared-source conflicts must preserve external values for all recipients.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q18 reset partial conflict clears session layers restores independent author edits and permits retry',async({},info)=>{
  const r=await launch(info,html('#target{font-size:18px;color:purple}#other{font-size:20px;color:green}','<button id="target">A</button><button id="other">B</button>'));
  try {await pick(r.page,'#target');const before=(await r.css())[0];await r.author('font-size','24px');await pick(r.page,'#other');await r.author('font-size','28px');await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'opacity','0.5');true`);await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[1] as CSSStyleRule).style.color='red');await r.read('__p.editor.reset();true');const conflict=await r.status();expect(conflict.undo).toBe(1);expect(conflict.overrides).toEqual([]);expect(await r.page.locator('style[data-cssforge-edit-layer]').count()).toBe(0);expect((await r.css())[0]).toBe(before);await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[1] as CSSStyleRule).style.color='green');await r.read('__p.editor.reset();true');expect((await r.status()).undo).toBe(0);await expect(r.page.locator('#other')).toHaveCSS('font-size','20px');await evidence(info,['A','B'],{conflict,afterRetry:await r.status()},'Only blocked author history survives partial Reset; session edits and independent author edits must be removed.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q19 a new author edit captures external state rather than resurrecting stale previous state',async({},info)=>{
  const r=await launch(info);
  try {await pick(r.page,'#target');await r.author('font-size','24px');await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='21px');await r.author('font-size','28px');const edits=await r.status();expect(edits.active[1].before.value).toBe('21px');await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveCSS('font-size','21px');await r.read('__p.editor.undo();true');expect((await r.status()).undo).toBe(1);await expect(r.page.locator('#target')).toHaveCSS('font-size','21px');await evidence(info,['A','B'],edits,'Fresh writes capture the external baseline; older conflicting history must not overwrite it.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

for(const mode of ['delete-insert','style-rewrite','replaceSync','adopted-replace'] as const)test(`Q${({'delete-insert':'20','style-rewrite':'21','replaceSync':'22','adopted-replace':'23'})[mode]} stale native rule/sheet identities refuse similar replacements`,async({},info)=>{
  const adopted=mode==='replaceSync'||mode==='adopted-replace';const r=await launch(info,adopted?html('',undefined,'<script>window.auditSheet=new CSSStyleSheet();auditSheet.replaceSync("#target{font-size:18px;color:purple}");document.adoptedStyleSheets=[auditSheet];</script>'):html());
  try {await pick(r.page,'#target');expect(await r.prepare('font-size',{allowShared:adopted})).toBe(true);await r.page.evaluate(mode=>{const sheet=(window as any).auditSheet??(document.querySelector('#author') as HTMLStyleElement).sheet;if(mode==='delete-insert'){sheet.deleteRule(0);sheet.insertRule('#target{font-size:21px;color:purple}',0);}if(mode==='style-rewrite')document.querySelector('#author')!.textContent='#target{font-size:21px;color:purple}';if(mode==='replaceSync')sheet.replaceSync('#target{font-size:21px;color:purple}');if(mode==='adopted-replace'){const fresh=new CSSStyleSheet();fresh.replaceSync('#target{font-size:21px;color:purple}');document.adoptedStyleSheets=[fresh];}},mode);const before=await r.page.locator('#target').evaluate(node=>getComputedStyle(node).fontSize);expect(before).toBe('21px');const result=await r.applyPlan();expect(result.state).toBe('fallback');await expect(r.page.locator('#target')).toHaveCSS('font-size','21px');expect((await r.status()).undo).toBe(0);await evidence(info,['B'],result,'Captured object identity cannot be replaced by a similar selector/rule.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q24 insertRule reorders the original native object without fabricating a new identity',async({},info)=>{
  const r=await launch(info);
  try {await pick(r.page,'#target');expect(await r.prepare()).toBe(true);const captured=await r.read(`({sourceId:__plan.sourceId,ruleId:__plan.ruleId})`);await r.page.locator('#author').evaluate(node=>(node as HTMLStyleElement).sheet!.insertRule('.unrelated{font-size:55px}',0));const result=await r.applyPlan();expect(result.state).toBe('mutated');expect(result.ruleId).toBe(captured.ruleId);expect(result.sourceId).toBe(captured.sourceId);expect((await r.css())[0]).toContain('55px');expect((await r.css())[1]).toContain('24px');expect(await r.read('__p.editor.authorMutation.rollback(__planResult.change)')).toBe(true);expect((await r.css())[1]).toContain('18px');await evidence(info,['A'],{captured,result,after:await r.css()},'A path/order change is supported only for the same native rule and fresh certain provenance.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q25 stylesheet node reorder records whether the native sheet identity survives',async({},info)=>{
  const r=await launch(info);
  try {await pick(r.page,'#target');expect(await r.prepare()).toBe(true);await r.read('globalThis.__sheet=__plan.binding.sheet;true');await r.page.locator('#author').evaluate(node=>document.head.append(node));const same=await r.read(`__sheet===document.querySelector('#author').sheet`),result=await r.applyPlan();expect(result.state).toBe(same?'mutated':'fallback');if(same)expect(await r.read('__p.editor.authorMutation.rollback(__planResult.change)')).toBe(true);await evidence(info,[same?'A':'B'],{sameNativeSheet:same,result},'DOM reorder must follow actual CSSOM object identity, never assumed persistence.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

for(const [id,property,css,value]of[
  ['Q26','margin-top','margin:1px 2px','8px'],['Q27','padding-left','padding:1px 2px','8px'],['Q28','border-color','border:1px solid red','purple'],['Q29','background-color','background:red','purple'],['Q30','font-size','font:18px Arial','24px']
] as const)test(`${id} authored ${css.split(':')[0]} shorthand safely falls back for ${property}`,async({},info)=>{
  const r=await launch(info,html(`#target{${css};color:green}`));
  try {await pick(r.page,'#target');const before=await r.css();await r.author(property,value);expect((await r.status()).state).toBe('fallback');expect(await r.css()).toEqual(before);await r.read('__p.editor.undo();true');expect(await r.css()).toEqual(before);await evidence(info,['A'],{before,result:await r.status()},'No destructive authored shorthand rewrite; keep fallback in the session layer.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q31 external custom token changes keep dependent computed values and blocked history',async({},info)=>{
  const r=await launch(info,html('#target{--token:green}.dependent{color:var(--token)}','<section id="target">Parent<span class="dependent">Child</span></section>'));
  try {await pick(r.page,'#target');await r.author('--token','purple');await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.setProperty('--token','blue'));await r.read('__p.editor.undo();__p.editor.reset();true');expect((await r.status()).undo).toBe(1);await expect(r.page.locator('.dependent')).toHaveCSS('color','rgb(0, 0, 255)');await evidence(info,['B'],await r.status(),'External token changes must survive without a var evaluator or token-definition chase.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q32 inherited token mutation is unsupported while direct var use remains a separate source',async({},info)=>{
  const r=await launch(info,html('#parent{--token:green}#target{color:var(--token)}','<section id="parent"><button id="target">Child</button></section>'));
  try {await pick(r.page,'#target');const before=await r.css();expect(await r.author('--token','purple')).toBe(false);const inherited=await r.status();expect(inherited.state).toBe('fallback');expect(inherited.undo).toBe(0);expect(await r.css()).toEqual(before);expect(await r.author('color','purple')).toBe(true);expect((await r.css())[0]).toContain('--token: green');await r.read('__p.editor.reset();true');expect(await r.css()).toEqual(before);await evidence(info,['A','B'],inherited,'Inherited custom sources are intentionally unsupported; editing a direct var use does not rewrite its ancestor token.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q33 media deactivation after mutation keeps contextual rollback safe',async({},info)=>{
  const r=await launch(info,html('@media(min-width:1000px){#target{font-size:18px;color:purple}}'));
  try {await pick(r.page,'#target');const before=await r.css();await r.read(`__p.editor.setContext({media:['(min-width: 1000px)'],pseudo:''});true`);await r.author('font-size','24px');expect((await r.status()).state).toBe('mutated');await r.page.setViewportSize({width:800,height:900});await r.author('font-size','28px');const inactive=await r.status();expect(inactive.state).toBe('fallback');expect((await r.css())[0]).toContain('24px');await r.read('__p.editor.undo();__p.editor.undo();true');expect(await r.css()).toEqual(before);expect((await r.status()).undo).toBe(0);await evidence(info,['A','B'],inactive,'Inactive media prevents a new author write; Undo restores the unchanged contextual rule without lifting it to base.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

for(const [id,css,context,supported]of[
  ['Q34','#target:hover{font-size:18px;color:purple}',{media:[],pseudo:':hover'},true],
  ['Q35','@layer theme{@supports(display:grid){#target{font-size:18px;color:purple}}}',{media:[],pseudo:''},true],
  ['Q36','@container (width>10px){#target{font-size:18px}}',{media:[],pseudo:''},false],
  ['Q37','@layer {#target{font-size:18px}}',{media:[],pseudo:''},false],
] as const)test(`${id} supported or intentionally unresolved grouping context stays in place`,async({},info)=>{
  const r=await launch(info,html(css));
  try {await pick(r.page,'#target');const before=await r.css();await r.read(`__p.editor.setContext(${JSON.stringify(context)});true`);await r.author('font-size','24px',{allowShared:!!context.pseudo});const result=await r.status();expect(result.state).toBe(supported?'mutated':'fallback');if(!supported)expect(await r.css()).toEqual(before);await r.read('__p.editor.reset();true');expect(await r.css()).toEqual(before);await evidence(info,['A',...(!supported?['B' as const]:[])],result,'Explicitly authorized pseudo scope and supported grouping remain in place; container/unresolved layer contexts stay in fallback.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q38 reconciliation refreshes a different replacement winner before further mutation and Undo',async({},info)=>{
  const r=await launch(info,html('#target{font-size:18px;color:purple}.fresh{font-size:21px!important}'));
  try {await pick(r.page,'#target');const original=await r.css();await r.author('font-size','24px');const first=await r.status();await r.page.locator('#target').evaluate(node=>node.outerHTML='<button id="target" class="fresh">Replacement</button>');await expect.poll(async()=>(await r.status()).reconciliation).toBe('migrated');const refreshed=await r.read(`(()=>{__p.source(true);return {winner:__p.cascade().properties['font-size'].winner.declaration.value,selector:__p.generateSelector().selector};})()`);expect(refreshed.winner).toBe('21px');expect(refreshed.selector).toBe('#target');await r.author('font-size','28px');const second=await r.status();expect(second.ruleId).not.toBe(first.ruleId);await r.read('__p.editor.undo();__p.editor.undo();true');expect(await r.css()).toEqual(original);await expect(r.page.locator('#target')).toHaveCSS('font-size','21px');expect(await r.read(`__p.cascade().properties['font-size'].winner.declaration.value`)).toBe('21px');await evidence(info,['A'],{first,second,refreshed},'Migrated DOM ownership does not reuse source/cascade/selector association from the old object.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q39 replacement followed by external author change blocks Undo against the original source',async({},info)=>{
  const r=await launch(info);
  try {await pick(r.page,'#target');await r.author('font-size','24px');await r.page.locator('#target').evaluate(node=>node.outerHTML='<button id="target">Replacement</button>');await expect.poll(async()=>(await r.status()).reconciliation).toBe('migrated');await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='21px');await r.read('__p.source(true);__p.editor.undo();true');const result=await r.status();expect(result.undo).toBe(1);await expect(r.page.locator('#target')).toHaveCSS('font-size','21px');await evidence(info,['B'],result,'Reconciliation never authorizes overwriting a newer external source value.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q40 author history survives A B C replacements with fresh binding and selector generations',async({},info)=>{
  const r=await launch(info);
  try {await pick(r.page,'#target');const before=await r.css();await r.author('font-size','24px');const first=await r.status();await r.read('__p.generateSelector();true');for(const name of ['B','C']){await r.page.locator('#target').evaluate((node,name)=>node.outerHTML=`<button id="target">${name}</button>`,name);await expect.poll(async()=>(await r.status()).reconciliation).toBe('migrated');await r.read('__p.source(true);__p.cascade();__p.generateSelector();true');await expect(r.page.locator('#target')).toHaveCSS('font-size','24px');}const final=await r.status();expect(final.target).toBe(first.target);expect(final.undo).toBe(1);expect(final.reconciliationStats.migrations).toBe(2);expect(await r.read('__p.selectorStats().generations')).toBe(3);await r.read('__p.editor.undo();true');expect(await r.css()).toEqual(before);expect((await r.status()).undo).toBe(0);await evidence(info,['A'],{first,final},'Repeated replacement preserves logical history and retires stale DOM/cache bindings.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q41 native replacement during author write restores the detached original without blind transfer',async({},info)=>{
  const r=await launch(info,html('', '<button is="audit-button" id="target" style="font-size:18px;color:purple">Target</button>',nativeCallback(true,false)));
  try {await pick(r.page,'#target');expect(await r.author('font-size','24px')).toBe(false);expect(await r.page.evaluate(()=>(window as any).retired.style.fontSize)).toBe('18px');await expect(r.page.locator('#target')).toHaveCSS('font-size','21px');const result=await r.status();expect(result.undo).toBe(0);expect(result.active).toEqual([]);await evidence(info,['A'],result,'A synchronous replacement invalidates author authorization; restore the exact original object and never copy inline edits to the replacement.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

test('Q42 raw pointer burst performs no audit mutation or engine analysis',async({},info)=>{
  const r=await launch(info);
  try {const result=await r.read(`(()=>{__p.start();for(let i=0;i<1000;i++)document.querySelector('#target').dispatchEvent(new PointerEvent('pointermove',{bubbles:true,composed:true}));return {mutation:__p.editor.authorMutation.getStats(),selectors:__p.selectorStats(),reconciliation:__p.reconciliationStats(),source:__p.sourceStats(),cascade:__p.cascadeStats(),locator:__p.locatorStats()};})()`);expect(result.mutation.analyses).toBe(0);expect(result.selectors.generations).toBe(0);expect(result.reconciliation.starts).toBe(0);expect(result.source.scopeScans).toBe(0);expect(result.cascade.resolutions).toBe(0);expect(result.locator.requests).toBe(0);await evidence(info,['A'],result,'Diagnostic observation must add no production pointer instrumentation or work.');expect(r.errors).toEqual([]);}finally{await r.context.close();}
});

for (const [id, mode] of [['Q43','delete-insert'],['Q44','style-rewrite'],['Q45','replaceSync'],['Q46','adopted-replace']] as const) test(`${id} applied author history refuses rollback onto a replacement native source`, async ({}, info) => {
  const adopted = mode === 'replaceSync' || mode === 'adopted-replace';
  const r = await launch(info, adopted ? html('', undefined, '<script>window.auditSheet=new CSSStyleSheet();auditSheet.replaceSync("#target{font-size:18px;color:purple}");document.adoptedStyleSheets=[auditSheet];</script>') : html());
  try {
    await pick(r.page, '#target'); expect(await r.author('font-size', '24px', { allowShared: adopted })).toBe(true);
    await r.page.evaluate(mode => {
      const sheet = (window as any).auditSheet ?? (document.querySelector('#author') as HTMLStyleElement).sheet;
      if (mode === 'delete-insert') { sheet.deleteRule(0); sheet.insertRule('#target{font-size:21px;color:purple}', 0); }
      if (mode === 'style-rewrite') document.querySelector('#author')!.textContent = '#target{font-size:21px;color:purple}';
      if (mode === 'replaceSync') sheet.replaceSync('#target{font-size:21px;color:purple}');
      if (mode === 'adopted-replace') { const fresh = new CSSStyleSheet(); fresh.replaceSync('#target{font-size:21px;color:purple}'); document.adoptedStyleSheets = [fresh]; }
    }, mode);
    const nativeCSS = () => r.page.evaluate(() => [...((window as any).auditSheet && document.adoptedStyleSheets[0] || (document.querySelector('#author') as HTMLStyleElement).sheet).cssRules].map(rule => rule.cssText));
    const before = await nativeCSS();
    await r.read('__p.editor.undo();true'); const undo = await r.status(); expect(undo.undo).toBe(1); expect(undo.error).toContain('Author source changed'); expect(await nativeCSS()).toEqual(before);
    await r.read('__p.editor.reset();true'); const reset = await r.status(); expect(reset.undo).toBe(1); expect(await nativeCSS()).toEqual(before); await expect(r.page.locator('#target')).toHaveCSS('font-size', '21px');
    await evidence(info, ['B'], { before, undo, reset }, 'Undo and Reset retain stale-source history without touching the newer similar rule or stylesheet.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('Q47 source deletion after author write blocks rollback without recreating the rule', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page, '#target'); await r.author('font-size', '24px'); await r.page.locator('#author').evaluate(node => (node as HTMLStyleElement).sheet!.deleteRule(0));
    await r.read('__p.editor.undo();__p.editor.reset();true'); const result = await r.status(); expect(result.undo).toBe(1); expect(await r.css()).toEqual([]);
    await evidence(info, ['B'], result, 'Disappeared source must not be recreated or replaced by a selector search.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('Q48 applied native rule survives insertRule reordering and rolls back the exact object', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page, '#target'); await r.author('font-size', '24px'); const applied = await r.status(); await r.page.locator('#author').evaluate(node => (node as HTMLStyleElement).sheet!.insertRule('.unrelated{font-size:55px}', 0));
    await r.read('__p.editor.undo();true'); const restored = await r.status(); expect(restored.undo).toBe(0); expect((await r.css())[0]).toContain('55px'); expect((await r.css())[1]).toContain('18px');
    await evidence(info, ['A'], { applied, restored, nativeCSS: await r.css() }, 'Undo follows the unchanged native object after index shifts and preserves the inserted rule.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});
