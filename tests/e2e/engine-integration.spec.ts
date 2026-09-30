import { test, expect, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { html, launch, nativeCallback } from './mutationHarness';
import { pick, inspector } from './extensionHarness';

type Runtime = Awaited<ReturnType<typeof launch>>;
const inline = '<button is="integration-button" id="target" style="font-size:18px;color:purple">Target</button>';
const callback = (body: string) => `<script>customElements.define('integration-button',class extends HTMLButtonElement{static get observedAttributes(){return ['style']}attributeChangedCallback(){${body}}},{extends:'button'});</script>`;
async function evidence(info: TestInfo, actual: unknown) {
  const dir = 'artifacts/diagnostics/engine-integration'; await mkdir(dir, { recursive: true });
  const file = `${dir}/${info.title.split(' ')[0]}.json`;
  await writeFile(file, JSON.stringify({ case: info.title, actual }, null, 2));
  await info.attach('engine-integration', { path: file, contentType: 'application/json' });
}
async function bridge(r: Runtime, expression: string) {
  // Test-only event bridge: real native custom-element reactions synchronously enter
  // the extension's isolated world. There is no production hook or page API.
  await r.read(`globalThis.__nested=[];document.addEventListener('integration-reentry',()=>{__nested.push((()=>{${expression}})())});true`);
}
const reenter = "if(!window.armed||this.once||this.style.fontSize!==window.triggerSize)return;this.once=true;document.dispatchEvent(new Event('integration-reentry'));";

for (const [id, action] of [['T01','apply'],['T02','reset'],['T03','undo']] as const) test(`${id} author apply excludes synchronous nested ${action}`, async ({}, info) => {
  const r = await launch(info, html('',inline,callback(reenter)));
  try {
    await pick(r.page,'#target');
    await bridge(r, action==='apply' ? "return __p.editor.applyAuthor(__p.editor.getSnapshot().design.targetId,'font-size','30px');" : `__p.editor.${action}();return true;`);
    await r.page.evaluate(()=>Object.assign(window,{armed:true,triggerSize:'24px'}));
    const ok = await r.author('font-size','24px'); const status = await r.status();
    const nested = await r.read('__nested'); await evidence(info,{ok,status,nested});
    expect(ok).toBe(true); expect(status.undo).toBe(1); expect(status.active).toHaveLength(1);
    await expect(r.page.locator('#target')).toHaveCSS('font-size','24px');
    if(action==='apply') expect(nested).toEqual([false]);
    await r.read('__p.editor.undo();true'); expect((await r.status()).undo).toBe(0);
    await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('T04 Reset excludes nested Reset while reversing a mixed history', async ({}, info) => {
  const r = await launch(info,html('',inline,callback(reenter)));
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); await r.author('font-size','30px');
    await r.read("__p.editor.apply(__p.editor.getSnapshot().design.targetId,'opacity','0.6');true");
    await bridge(r,'__p.editor.reset();return true;');
    await r.page.evaluate(()=>Object.assign(window,{armed:true,triggerSize:'24px'}));
    const result = await r.read(`(()=>{try{__p.editor.reset();return {ok:true}}catch(e){return {ok:false,error:String(e)}}})()`);
    const status = await r.status(); await evidence(info,{result,status,nested:await r.read('__nested')});
    expect(result.ok).toBe(true); expect(status.undo).toBe(0); expect(status.active).toHaveLength(0);
    await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); await expect(r.page.locator('#target')).toHaveCSS('opacity','1'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('T05 direct engine writes exclude reentry during native capability verification', async ({}, info) => {
  const r = await launch(info,html('',inline,callback(reenter)));
  try {
    await pick(r.page,'#target'); await r.prepare();
    await bridge(r,"const e=__p.editor.authorMutation;const x=e.mutate({element:document.querySelector('#target'),property:'font-size',value:'30px',context:{media:[],pseudo:''}});return {state:x.state,safeFallback:x.safeFallback};");
    await r.page.evaluate(()=>Object.assign(window,{armed:true,triggerSize:'18px'}));
    const result = await r.applyPlan(); const status = await r.status(); const nested = await r.read('__nested');
    await evidence(info,{result,status,nested}); expect(result.state).toBe('mutated'); expect(status.active).toHaveLength(1);
    expect(nested).toEqual([{state:'rejected',safeFallback:false}]);
    await r.read('__p.editor.authorMutation.rollback(__p.editor.authorMutation.active()[0]);true');
    await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('T06 Undo excludes nested author edit and preserves unrelated native changes', async ({}, info) => {
  const r = await launch(info,html('',inline,callback(reenter+"if(window.armed&&this.style.fontSize==='18px')this.style.color='green';")));
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px');
    await bridge(r,"return __p.editor.applyAuthor(__p.editor.getSnapshot().design.targetId,'font-size','30px');");
    await r.page.evaluate(()=>Object.assign(window,{armed:true,triggerSize:'18px'}));
    await r.read('__p.editor.undo();true'); const status = await r.status();
    expect(status.undo).toBe(0); expect(status.active).toHaveLength(0); expect(await r.read('__nested')).toEqual([false]);
    await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); await expect(r.page.locator('#target')).toHaveCSS('color','rgb(0, 128, 0)');
    await evidence(info,status); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('T07 mixed session author partial history resets only proven ownership', async ({}, info) => {
  const r = await launch(info,html('',inline,callback("if(this.once||this.style.fontSize!=='30px')return;this.once=true;this.style.color='green';")));
  try {
    await pick(r.page,'#target'); await r.read("__p.editor.apply(__p.editor.getSnapshot().design.targetId,'letter-spacing','1px');true");
    await r.author('font-size','24px'); await r.read("__p.editor.apply(__p.editor.getSnapshot().design.targetId,'opacity','0.6');true");
    expect(await r.author('font-size','30px')).toBe(false); const mixed = await r.status(); expect(mixed.undo).toBe(4); expect(mixed.active).toHaveLength(2);
    await r.read('__p.editor.undo();true'); expect((await r.status()).undo).toBe(3);
    await r.page.locator('#target').evaluate(node=>(node as HTMLElement).style.fontSize='21px');
    await r.read('__p.editor.reset();true'); const blocked = await r.status(); expect(blocked.undo).toBe(1); expect(blocked.active).toHaveLength(1);
    await expect(r.page.locator('#target')).toHaveCSS('font-size','21px'); await expect(r.page.locator('#target')).toHaveCSS('opacity','1'); await expect(r.page.locator('#target')).toHaveCSS('letter-spacing','normal');
    await r.page.locator('#target').evaluate(node=>(node as HTMLElement).style.cssText='font-size:24px;color:purple'); await r.read('__p.editor.reset();true');
    expect((await r.status()).undo).toBe(0); await expect(r.page.locator('#target')).toHaveCSS('font-size','18px');
    await evidence(info,{mixed,blocked,recovered:await r.status()}); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('T08 partial inline write during React-style replacement recovers detached original only', async ({}, info) => {
  const r = await launch(info,html('', '<button is="audit-button" id="target" style="font-size:18px;color:purple">A</button>',nativeCallback(true,true).replace('<button id=target style=', '<button is=audit-button id=target style=')));
  try {
    await pick(r.page,'#target'); await r.read("__p.editor.apply(__p.editor.getSnapshot().design.targetId,'opacity','0.6');true");
    expect(await r.author('font-size','24px')).toBe(false);
    await evidence(info,{beforeMigration:await r.status()});
    await expect.poll(async()=>(await r.status()).reconciliationStats.migrations).toBe(1);
    const partial = await r.status(); expect(partial.undo).toBe(2); expect(partial.active[0].kind).toBe('partial');
    const fresh = await r.read("(()=>{__p.source(true);return {value:__p.cascade().properties['font-size'].winner.declaration.value,selector:__p.generateSelector().selector}})()");
    expect(fresh).toEqual({value:'21px',selector:'#target'});
    await r.read('__p.editor.undo();true'); expect(await r.page.evaluate(()=>(window as any).retired.style.fontSize)).toBe('18px');
    expect(await r.page.evaluate(()=>(window as any).retired.style.color)).toBe('green'); await expect(r.page.locator('#target')).toHaveCSS('font-size','21px');
    await r.read('__p.editor.undo();true'); await expect(r.page.locator('#target')).toHaveCSS('opacity','1'); expect((await r.status()).undo).toBe(0);
    await evidence(info,{partial,fresh,recovered:await r.status()}); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('T09 replacement during native rollback never receives old inline provenance', async ({}, info) => {
  const r = await launch(info,html('',inline,callback("if(!window.armed||this.once||this.style.fontSize!=='18px')return;this.once=true;window.retired=this;this.outerHTML='<button id=target style=font-size:31px;color:green>Replacement</button>';")));
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); await r.page.evaluate(()=>Object.assign(window,{armed:true}));
    await r.read('__p.editor.undo();true'); expect((await r.status()).undo).toBe(0); await expect(r.page.locator('#target')).toHaveCSS('font-size','31px');
    await pick(r.page,'#target'); const fresh = await r.read("(()=>{const s=__p.source(true);return {winner:__p.cascade().properties['font-size'].winner.declaration.value,attribution:s.inline.find(d=>d.property==='font-size').mutationState}})()");
    expect(fresh).toEqual({winner:'31px',attribution:'authored'}); expect(await r.page.evaluate(()=>(window as any).retired.style.fontSize)).toBe('18px');
    await evidence(info,{fresh,status:await r.status()}); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('T10 session marker callback cannot Reset or duplicate the committing transaction', async ({}, info) => {
  const r = await launch(info,html(undefined,'<button is="integration-button" id="target">Target</button>'));
  try {
    await pick(r.page,'#target');
    await bridge(r,"__p.editor.reset();return __p.editor.apply(__p.editor.getSnapshot().design.targetId,'opacity','0.5');");
    await r.read("__p.editor.apply(__p.editor.getSnapshot().design.targetId,'opacity','0.8');true");
    const marker=await r.page.locator('#target').evaluate(node=>node.getAttributeNames().find(name=>name.startsWith('data-cssforge-target'))!);
    await r.read('__p.editor.undo();true');
    await r.page.evaluate(marker=>{
      customElements.define('integration-button',class extends HTMLButtonElement{static get observedAttributes(){return [marker]}attributeChangedCallback(_n:string,_o:string|null,value:string|null){if(value)document.dispatchEvent(new Event('integration-reentry'));}},{extends:'button'});
    },marker);
    expect(await r.read("__p.editor.apply(__p.editor.getSnapshot().design.targetId,'letter-spacing','2px')")).toBe(true);
    const status=await r.status(); expect(status.undo).toBe(1); expect(status.active).toHaveLength(0); expect(await r.read('__nested')).toEqual([false]);
    await r.read('__p.editor.undo();true'); expect((await r.status()).undo).toBe(0); await expect(r.page.locator('#target')).toHaveCSS('letter-spacing','normal');
    await evidence(info,status); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('T11 native migration callback cannot Reset a staged replacement', async ({}, info) => {
  const r=await launch(info,html('#target{font-size:18px;color:purple}','<button id="target" is="integration-button">A</button>'));
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); await r.read("__p.editor.apply(__p.editor.getSnapshot().design.targetId,'opacity','0.6');true");
    await bridge(r,'__p.editor.reset();return true;');
    await r.page.locator('#target').evaluate(node=>{
      const marker=node.getAttributeNames().find(name=>name.startsWith('data-cssforge-target'))!+'-m1';
      customElements.define('integration-button',class extends HTMLButtonElement{static get observedAttributes(){return [marker]}attributeChangedCallback(_n:string,_o:string|null,value:string|null){if(value)document.dispatchEvent(new Event('integration-reentry'));}},{extends:'button'});
      node.outerHTML='<button id="target" is="integration-button">B</button>';
    });
    await expect.poll(async()=>(await r.status()).reconciliationStats.migrations).toBe(1);
    const migrated=await r.status(); expect(migrated.undo).toBe(2); expect(migrated.active).toHaveLength(1); expect(await r.read('__nested')).toEqual([true]);
    await expect(r.page.locator('#target')).toHaveCSS('opacity','0.6'); await r.read('__p.editor.reset();true');
    await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); await expect(r.page.locator('#target')).toHaveCSS('opacity','1');
    expect((await r.status()).undo).toBe(0); await evidence(info,migrated); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('T12 deferred teardown drains native author ownership after the current callback unwinds', async ({}, info) => {
  const r=await launch(info,html('',inline,callback(reenter)));
  try {
    await pick(r.page,'#target'); await bridge(r,'__p.editor.destroy();return true;');
    await r.page.evaluate(()=>Object.assign(window,{armed:true,triggerSize:'24px'}));
    await r.author('font-size','24px'); const status=await r.status(); expect(status.undo).toBe(0); expect(status.active).toHaveLength(0);
    await expect(r.page.locator('#target')).toHaveCSS('font-size','18px');
    await r.action(); await expect(r.page.locator('cssforge-ui')).toHaveCount(0); await r.action(); await expect(inspector(r.page)).toBeVisible(); await r.bind(); await pick(r.page,'#target');
    expect((await r.status()).undo).toBe(0); await evidence(info,{destroyed:status,reactivated:await r.status()}); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('T13 the 256 record bound holds when the final write synchronously attempts another edit', async ({}, info) => {
  const r=await launch(info,html('',inline,callback(reenter)));
  try {
    await pick(r.page,'#target');
    expect(await r.read("(()=>{const e=__p.editor,id=e.getSnapshot().design.targetId;for(let i=0;i<255;i++)if(!e.applyAuthor(id,'font-size',(24+i)+'px'))return false;return true})()")).toBe(true);
    await bridge(r,"return __p.editor.applyAuthor(__p.editor.getSnapshot().design.targetId,'font-size','500px');");
    await r.page.evaluate(()=>Object.assign(window,{armed:true,triggerSize:'400px'}));
    expect(await r.author('font-size','400px')).toBe(true); expect(await r.read('__nested')).toEqual([false]);
    const full=await r.status(); expect(full.undo).toBe(256); expect(full.active).toHaveLength(256);
    await r.author('font-size','416px'); const fallback=await r.status(); expect(fallback.state).toBe('fallback'); expect(fallback.undo).toBe(257); expect(fallback.active).toHaveLength(256);
    await r.read('__p.editor.undo();__p.editor.reset();true'); expect((await r.status()).undo).toBe(0); await expect(r.page.locator('#target')).toHaveCSS('font-size','18px');
    await evidence(info,{recordBound:full.active.length,historyAtFallback:fallback.undo,restored:await r.status()}); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

const raceModes=['style-text','delete-insert','adopted-replace','replaceSync','owner-replace','delete-only'] as const;
for(const [index,mode] of raceModes.entries())for(const stage of ['apply','undo','reset'] as const)test(`T${stage==='reset'?33+index:14+index*2+(stage==='undo'?1:0)} ${mode} during ${stage} verifies exact native identity`,async({},info)=>{
  const adopted=mode==='adopted-replace'||mode==='replaceSync';
  const r=await launch(info,adopted?html('',undefined,'<script>const sheet=new CSSStyleSheet();sheet.replaceSync("#target{font-size:18px;color:purple}");document.adoptedStyleSheets=[sheet];</script>'):html());
  try {
    await pick(r.page,'#target');
    if(stage!=='apply') { expect(await r.author('font-size','24px',{allowShared:adopted})).toBe(true); await r.read('globalThis.__bound=__p.editor.authorMutation.active()[0].target.binding;true'); }
    else { expect(await r.prepare('font-size',{allowShared:adopted})).toBe(true); await r.read('globalThis.__bound=__plan.binding;true'); }
    const effect=mode==='style-text'?"document.querySelector('#author').textContent='#target{font-size:31px;color:green}';":mode==='delete-insert'?"__bound.sheet.deleteRule(0);__bound.sheet.insertRule('#target{font-size:31px;color:green}',0);":mode==='adopted-replace'?"const fresh=new CSSStyleSheet();fresh.replaceSync('#target{font-size:31px;color:green}');document.adoptedStyleSheets=[fresh];":mode==='replaceSync'?"__bound.sheet.replaceSync('#target{font-size:31px;color:green}');":mode==='owner-replace'?"const fresh=document.createElement('style');fresh.id='author';fresh.textContent='#target{font-size:31px;color:green}';document.querySelector('#author').replaceWith(fresh);":"__bound.sheet.deleteRule(0);";
    // Test-only isolated-world wrapper deterministically inserts the race after the
    // actual native setProperty. It is restored before the page source operation.
    await r.read(`(()=>{const proto=CSSStyleDeclaration.prototype,native=proto.setProperty;proto.setProperty=function(p,v,q){const result=native.call(this,p,v,q);if(this===__bound.style&&p==='font-size'&&v==='${stage==='apply'?'24px':'18px'}'){proto.setProperty=native;${effect}}return result;};return true})()`);
    if(stage==='apply') { const result=await r.applyPlan(); expect(result.state).toBe('rejected'); expect((await r.status()).active).toHaveLength(1); }
    else await r.read(`__p.editor.${stage}();true`);
    const source=await r.read("(()=>{const s=__p.source(true);return {winner:__p.cascade().properties['font-size'].winner?.declaration.value,attribution:s.rules.flatMap(r=>r.declarations).find(d=>d.property==='font-size')?.mutationState}})()");
    if(mode!=='delete-only') { await expect(r.page.locator('#target')).toHaveCSS('font-size','31px'); expect(source).toEqual({winner:'31px',attribution:'authored'}); }
    const before=await r.page.locator('#target').evaluate(node=>({font:getComputedStyle(node).fontSize,color:getComputedStyle(node).color}));
    if(stage==='apply') expect(await r.read('__p.editor.authorMutation.rollback(__p.editor.authorMutation.active()[0])')).toBe(false);
    await r.read('__p.editor.reset();true'); const status=await r.status(); expect(status.active).toHaveLength(1); expect(status.active[0].state).toBe('retired');
    if(stage!=='apply')expect(status.undo).toBe(1);
    expect(await r.page.locator('#target').evaluate(node=>({font:getComputedStyle(node).fontSize,color:getComputedStyle(node).color}))).toEqual(before);
    await evidence(info,{source,before,status}); expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('T26 open Shadow DOM adopted author and session history survive replacement and external CSSOM conflict',async({},info)=>{
  const r=await launch(info,html('','<div id="host"></div>','<script>document.addEventListener("DOMContentLoaded",()=>{const root=document.querySelector("#host").attachShadow({mode:"open"});const sheet=new CSSStyleSheet();sheet.replaceSync("#target{font-size:18px;color:purple}");root.adoptedStyleSheets=[sheet];root.innerHTML="<button id=target>A</button>";});</script>'));
  try {
    await pick(r.page,'#target'); expect(await r.author('font-size','24px',{allowShared:true})).toBe(true); const first=await r.status();
    expect(first.scope).toMatchObject({kind:'unknown',matchedCount:1,bounded:false});
    await r.read("__p.editor.apply(__p.editor.getSnapshot().design.targetId,'opacity','0.6');true");
    for(const name of ['B','C']) { await r.page.locator('#target').evaluate((node,name)=>node.outerHTML=`<button id=target>${name}</button>`,name);await expect.poll(async()=>(await r.status()).reconciliationStats.migrations).toBe(name==='B'?1:2);await r.read('__p.source(true);__p.cascade();__p.generateSelector();true'); }
    await r.page.locator('#host').evaluate(node=>((node.shadowRoot!.adoptedStyleSheets[0].cssRules[0]) as CSSStyleRule).style.color='green');
    await r.read('__p.editor.reset();true'); const blocked=await r.status(); expect(blocked.undo).toBe(1); await expect(r.page.locator('#target')).toHaveCSS('opacity','1'); await expect(r.page.locator('#target')).toHaveCSS('color','rgb(0, 128, 0)');
    await r.page.locator('#host').evaluate(node=>((node.shadowRoot!.adoptedStyleSheets[0].cssRules[0]) as CSSStyleRule).style.color='purple');
    await r.read('__p.editor.undo();true'); await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); expect((await r.status()).undo).toBe(0);
    await evidence(info,{first,blocked,restored:await r.status()}); expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('T27 shared source remains shared across two logical targets and replacement',async({},info)=>{
  const r=await launch(info,html('.button{font-size:18px;color:purple}','<button id="target" class="button">A</button><button id="other" class="button">B</button>'));
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px',{allowShared:true}); await pick(r.page,'#other'); await r.author('font-size','30px',{allowShared:true});
    await r.page.locator('#other').evaluate(node=>node.outerHTML='<button id="other" class="button">Fresh B</button>'); await expect.poll(async()=>(await r.status()).reconciliationStats.migrations).toBe(1);
    await r.author('font-size','36px',{allowShared:true}); const shared=await r.status(); expect(shared.undo).toBe(3); expect(shared.scope).toMatchObject({kind:'shared-rule',matchedCount:2,risk:'shared'}); expect(new Set(shared.active.map((c:any)=>c.ruleId)).size).toBe(1);
    await pick(r.page,'#target'); await r.read('__p.editor.undo();true'); for(const node of await r.page.locator('.button').all())await expect(node).toHaveCSS('font-size','30px');
    await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='21px'); await r.read('__p.editor.reset();true');
    expect((await r.status()).undo).toBe(2); for(const node of await r.page.locator('.button').all())await expect(node).toHaveCSS('font-size','21px');
    await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='30px'); await r.read('__p.editor.reset();true');
    expect((await r.status()).undo).toBe(0); for(const node of await r.page.locator('.button').all())await expect(node).toHaveCSS('font-size','18px');
    await evidence(info,{shared,restored:await r.status()}); expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('T28 partial conflict survives repeated toggles repick and detached-target recovery',async({},info)=>{
  const r=await launch(info,html('#other{font-size:20px}',inline+'<button id="other">Other</button>',callback("if(this.once||this.style.fontSize!=='24px')return;this.once=true;this.style.fontSize='21px';this.style.color='green';")));
  try {
    await pick(r.page,'#target'); await r.read("__p.editor.apply(__p.editor.getSnapshot().design.targetId,'opacity','0.6');true");
    expect(await r.author('font-size','24px')).toBe(false); expect((await r.status()).undo).toBe(2);
    for(let i=0;i<3;i++) {
      await r.action(); await expect(r.page.locator('cssforge-ui')).toHaveCount(0); await expect(r.page.locator('#target')).toHaveCSS('opacity','1');
      await r.action(); await expect(inspector(r.page)).toBeVisible(); await r.bind(); await pick(r.page,i===1?'#target':'#other');
      expect((await r.status()).undo).toBe(1); expect((await r.status()).active).toHaveLength(1); await r.read('__p.editor.undo();true');
      await expect(r.page.locator('#target')).toHaveCSS('font-size','21px');
    }
    await r.page.locator('#target').evaluate(node=>{(window as any).retired=node;node.outerHTML='<button id=target style=font-size:31px;color:green>New</button>';});
    await pick(r.page,'#target'); await r.page.evaluate(()=>(window as any).retired.style.fontSize='24px'); await r.read('__p.editor.undo();true');
    expect((await r.status()).undo).toBe(0); expect(await r.page.evaluate(()=>(window as any).retired.style.fontSize)).toBe('18px'); await expect(r.page.locator('#target')).toHaveCSS('font-size','31px');
    await evidence(info,await r.status()); expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('T29 document replacement retires partial ownership and old callbacks remain inert',async({},info)=>{
  const r=await launch(info,html('',inline,callback("if(this.once||this.style.fontSize!=='24px')return;this.once=true;this.style.fontSize='21px';this.style.color='green';")));
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); await r.read('globalThis.__old=__p.editor;globalThis.__oldChange=__old.authorMutation.active()[0];true');
    await r.action(); await expect(r.page.locator('cssforge-ui')).toHaveCount(0);
    await r.page.evaluate(markup=>{document.open();document.write(markup);document.close();},html('#target{font-size:31px;color:green}'));
    expect(await r.read('__old.authorMutation.rollback(__oldChange)')).toBe(false); await r.read('__old.undo();__old.reset();true');
    await r.action(); await expect(inspector(r.page)).toBeVisible(); await r.bind(); await pick(r.page,'#target'); const fresh=await r.status();
    expect(fresh.undo).toBe(0); expect(fresh.active).toHaveLength(0); await expect(r.page.locator('#target')).toHaveCSS('font-size','31px');
    await evidence(info,fresh); expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('T30 native state pseudo and media switches preserve independent source history',async({},info)=>{
  const css='#target{font-size:18px;color:purple}#target:hover{font-size:20px}#target:focus{color:green}#target::before{content:"Before";font-size:12px}@media(min-width:800px){#target{letter-spacing:1px}}';
  const r=await launch(info,html(css));
  try {
    await pick(r.page,'#target'); const original=await r.css();
    await r.page.locator('#target').hover(); await r.read("__p.editor.setContext({media:[],pseudo:':hover'});true"); expect(await r.author('font-size','24px',{allowShared:true})).toBe(true);
    await r.page.locator('#target').focus(); await r.read("__p.editor.setContext({media:[],pseudo:':focus'});true"); expect(await r.author('color','blue',{allowShared:true})).toBe(true);
    await r.read("__p.editor.setContext({media:[],pseudo:'::before'});true"); expect(await r.author('font-size','16px',{allowShared:true})).toBe(true);
    expect(await r.page.locator('#target').evaluate(node=>getComputedStyle(node,'::before').fontSize)).toBe('16px');
    await r.read("__p.editor.setContext({media:['(min-width: 800px)'],pseudo:''});true"); expect(await r.author('letter-spacing','2px')).toBe(true);
    const contextual=await r.status(); expect(contextual.undo).toBe(4); expect(new Set(contextual.active.map((c:any)=>c.ruleId)).size).toBe(4);
    await r.page.setViewportSize({width:700,height:900}); await r.read("__p.editor.setContext({media:[],pseudo:''});__p.editor.undo();__p.editor.reset();true");
    expect((await r.status()).undo).toBe(0); expect(await r.css()).toEqual(original); await evidence(info,contextual); expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('T31 loss then Reset prevents a delayed replacement from reviving mixed author session ownership',async({},info)=>{
  const r=await launch(info);
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); await r.read("__p.editor.apply(__p.editor.getSnapshot().design.targetId,'opacity','0.6');true");
    await r.page.locator('#target').evaluate(node=>node.remove()); await expect.poll(async()=>(await r.status()).reconciliation).toBe('waiting-for-replacement');
    await r.read('__p.editor.reset();true'); await r.page.locator('main').evaluate(node=>node.insertAdjacentHTML('beforeend','<button id=target>Late replacement</button>'));
    await r.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const retired=await r.status(); expect(retired.undo).toBe(0); expect(retired.active).toHaveLength(0); expect(retired.reconciliationStats.migrations).toBe(0);
    await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); await expect(r.page.locator('#target')).toHaveCSS('opacity','1');
    expect(await r.page.locator('style[data-cssforge-edit-layer]').count()).toBe(0); await evidence(info,retired); expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('T32 pointer burst after mixed-history recovery performs zero engine analysis',async({},info)=>{
  const r=await launch(info);
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); await r.read("__p.editor.apply(__p.editor.getSnapshot().design.targetId,'opacity','0.6');__p.editor.reset();true");
    const metrics=await r.read(`(()=>{__p.start();const stats=()=>({mutation:__p.editor.authorMutation.getStats(),selectors:__p.selectorStats(),reconciliation:__p.reconciliationStats(),source:__p.sourceStats(),cascade:__p.cascadeStats(),locator:__p.locatorStats()});const before=stats();for(let i=0;i<1000;i++)document.querySelector('#target').dispatchEvent(new PointerEvent('pointermove',{bubbles:true,composed:true}));return {before,after:stats()}})()`);
    expect(metrics.after).toEqual(metrics.before); await evidence(info,{events:1000,metrics}); expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
