import { test, expect } from '@playwright/test';
import { html, launch, evidence, nativeCallback } from './mutationHarness';
import { pick, inspector } from './extensionHarness';

const callback = (body: string) => `<script>customElements.define('audit-button',class extends HTMLButtonElement{static get observedAttributes(){return ['style']}attributeChangedCallback(){${body}}},{extends:'button'});</script>`;
const inline = '<button is="audit-button" id="target" style="font-size:18px;color:purple">Target</button>';
type Runtime = Awaited<ReturnType<typeof launch>>;
const toggle = async (r: Runtime) => {
  await r.action(); await expect(r.page.locator('cssforge-ui')).toHaveCount(0);
  await r.action(); await expect(inspector(r.page)).toBeVisible(); await r.bind();
};
const attribution = (r: Runtime) => r.read(`(()=>{const s=__p.source(true);return s.rules.flatMap(r=>r.declarations).find(d=>d.property==='font-size')?.mutationState??null})()`);

test('F01 normal selector-list union requires authorization for all recipients', async ({}, info) => {
  const r = await launch(info, html('#target, .other{font-size:18px;color:purple}', '<button id="target">A</button><button class="other">B</button>'));
  try {
    await pick(r.page,'#target'); const original = await r.css(); await r.author('font-size','24px'); const denied = await r.status();
    expect(denied.state).toBe('fallback'); expect(denied.scope).toMatchObject({kind:'shared-rule',matchedCount:2}); expect(await r.css()).toEqual(original);
    await r.read('__p.editor.undo();true'); await r.author('font-size','24px',{allowShared:true}); await expect(r.page.locator('.other')).toHaveCSS('font-size','24px');
    await r.read('__p.editor.undo();true'); expect(await r.css()).toEqual(original);
    await evidence(info,['A'],denied,'Normal selector lists union all recipients.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

for (const [id, suffix] of [['F02',':hover'],['F03',':focus'],['F04','::before']] as const) test(`${id} ${suffix} branch stays unknown until explicitly authorized`, async ({}, info) => {
  const r = await launch(info, html(`#target, .other${suffix}{font-size:18px;color:purple}`, '<button id="target">A</button><button class="other">B</button>'));
  try {
    await pick(r.page,'#target'); const original = await r.css(); await r.author('font-size','24px'); const denied = await r.status();
    expect(denied.state).toBe('fallback'); expect(denied.scope).toMatchObject({kind:'unknown',matchedCount:2,risk:'unknown'}); expect(await r.css()).toEqual(original);
    await r.read('__p.editor.undo();true'); expect(await r.author('font-size','24px',{allowShared:true})).toBe(true); expect((await r.status()).state).toBe('mutated');
    if (suffix === ':hover') { await r.page.locator('.other').hover(); await expect(r.page.locator('.other')).toHaveCSS('font-size','24px'); }
    if (suffix === ':focus') { await r.page.locator('.other').focus(); await expect(r.page.locator('.other')).toHaveCSS('font-size','24px'); }
    if (suffix === '::before') expect(await r.page.locator('.other').evaluate(node=>getComputedStyle(node,'::before').fontSize)).toBe('24px');
    await r.read('__p.editor.reset();true'); expect(await r.css()).toEqual(original);
    await evidence(info,['A'],denied,'Potential originating elements are bounded without activating fake pseudo states.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('F05 unsupported state branch cannot turn uncertain cascade into local authorization', async ({}, info) => {
  const r = await launch(info, html('#target, .other:focus-visible{font-size:18px;color:purple}', '<button id="target">A</button><button class="other">B</button>'));
  try {
    await pick(r.page,'#target'); const original = await r.css(); await r.author('font-size','24px'); const denied = await r.status();
    expect(denied.state).toBe('fallback'); expect(denied.scope).toMatchObject({kind:'unknown',risk:'unknown'}); expect(await r.css()).toEqual(original);
    await r.read('__p.editor.undo();true'); await r.author('font-size','24px',{allowShared:true}); expect((await r.status()).state).toBe('fallback'); expect(await r.css()).toEqual(original);
    await evidence(info,['B'],denied,'Shared authorization does not bypass an unresolved cascade.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('F06 duplicate selector branches count the same native recipient only once', async ({}, info) => {
  const r = await launch(info, html('#target, .button{font-size:18px;color:purple}', '<button id="target" class="button">A</button>'));
  try {
    await pick(r.page,'#target'); expect(await r.author('font-size','24px')).toBe(true); const result = await r.status();
    expect(result.state).toBe('mutated'); expect(result.scope).toMatchObject({kind:'target-specific',matchedCount:1,risk:'local'});
    await r.read('__p.editor.undo();true'); await expect(r.page.locator('#target')).toHaveCSS('font-size','18px');
    await evidence(info,['A'],result,'Duplicate authored branches are deduplicated by native element.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('F07 scope exhaustion stays unknown and never claims a complete local count', async ({}, info) => {
  const r = await launch(info, html('#target{font-size:18px;color:purple}', '<button id="target">A</button>'+ '<div hidden>filler</div>'.repeat(530)));
  try {
    await pick(r.page,'#target'); const original = await r.css(); await r.author('font-size','24px'); const denied = await r.status();
    expect(denied.state).toBe('fallback'); expect(denied.scope).toMatchObject({kind:'unknown',bounded:false}); expect(await r.css()).toEqual(original);
    await r.read('__p.editor.undo();true'); await r.author('font-size','24px',{allowShared:true}); expect((await r.status()).state).toBe('mutated');
    await r.read('__p.editor.reset();true'); expect(await r.css()).toEqual(original);
    await evidence(info,['A'],denied,'The existing scan bound requires explicit unknown-scope authorization.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('F08 Reset resolves a partial write without reverting unrelated native page changes', async ({}, info) => {
  const r = await launch(info, html('',inline,nativeCallback()));
  try {
    await pick(r.page,'#target'); expect(await r.author('font-size','24px')).toBe(false);
    await r.read('globalThis.__change=__p.editor.authorMutation.active()[0];true'); const partial = await r.status();
    expect(partial.undo).toBe(1); expect(partial.active[0].kind).toBe('partial'); await r.read('__p.editor.reset();true');
    await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); await expect(r.page.locator('#target')).toHaveCSS('color','rgb(0, 128, 0)');
    expect((await r.status()).undo).toBe(0); expect(await r.read('__change.state')).toBe('resolved');
    await evidence(info,['A'],partial,'Partial Reset restores only the proven attempted property.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

const competingCallback = callback("if(this.style.fontSize!=='24px'||this.once)return;this.once=true;this.style.fontSize='21px';this.style.color='green';");
test('F09 partial write with unproven ownership retains one blocked record and never overwrites the page', async ({}, info) => {
  const r = await launch(info, html('',inline,competingCallback));
  try {
    await pick(r.page,'#target'); expect(await r.author('font-size','24px')).toBe(false); const rejected = await r.status();
    expect(rejected.undo).toBe(1); expect(rejected.active[0]).toMatchObject({kind:'partial',state:'blocked',before:{value:'18px'},attempted:{value:'24px'},current:{value:'21px'}});
    await r.read('__p.editor.undo();__p.editor.reset();true'); expect((await r.status()).undo).toBe(1);
    await expect(r.page.locator('#target')).toHaveCSS('font-size','21px'); await expect(r.page.locator('#target')).toHaveCSS('color','rgb(0, 128, 0)');
    await r.page.locator('#target').evaluate(node=>(node as HTMLElement).style.fontSize='24px'); await r.read('__p.editor.undo();true');
    await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); await expect(r.page.locator('#target')).toHaveCSS('color','rgb(0, 128, 0)'); expect((await r.status()).undo).toBe(0);
    await evidence(info,['A','B'],rejected,'A newer intended-property value is blocked until exact ownership is restored.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

for (const [id, propertyReaction] of [['F10',false],['F11',true]] as const) test(`${id} synchronous rollback reaction preserves external state and honest recovery status`, async ({}, info) => {
  const reaction = callback(`if(!window.rollbackArmed||this.style.fontSize!=='18px'||this.once)return;this.once=true;${propertyReaction?"this.style.fontSize='21px';":"this.style.color='green';"}`);
  const r = await launch(info, html('',inline,reaction));
  try {
    await pick(r.page,'#target'); expect(await r.author('font-size','24px')).toBe(true); await r.read('globalThis.__change=__p.editor.authorMutation.active()[0];true');
    await r.page.evaluate(()=>{(window as any).rollbackArmed=true;}); await r.read('__p.editor.undo();true'); const result = await r.status();
    if (propertyReaction) {
      expect(result.undo).toBe(1); expect(result.active[0]).toMatchObject({state:'blocked',current:{value:'21px'}}); await expect(r.page.locator('#target')).toHaveCSS('font-size','21px');
      await r.read('__p.editor.reset();true'); expect((await r.status()).undo).toBe(1); await expect(r.page.locator('#target')).toHaveCSS('font-size','21px');
      await r.page.locator('#target').evaluate(node=>(node as HTMLElement).style.fontSize='24px'); await r.read('__p.editor.undo();true');
    } else { expect(result.undo).toBe(0); await expect(r.page.locator('#target')).toHaveCSS('color','rgb(0, 128, 0)'); }
    await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); expect(await r.read('__change.state')).toBe('resolved');
    await evidence(info,['A',...(propertyReaction?['B' as const]:[])],result,'Native rollback callbacks never cause a forced external overwrite or lost recovery record.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('F12 partial conflict survives teardown and can recover only its own property after reactivation', async ({}, info) => {
  const r = await launch(info, html('',inline,competingCallback));
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); await toggle(r); await pick(r.page,'#target'); const retained = await r.status();
    expect(retained.undo).toBe(1); expect(retained.active[0]).toMatchObject({kind:'partial',state:'blocked'});
    await r.read('__p.editor.undo();true'); await expect(r.page.locator('#target')).toHaveCSS('font-size','21px');
    await r.page.locator('#target').evaluate(node=>(node as HTMLElement).style.fontSize='24px'); await r.read('__p.editor.undo();true');
    await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); await expect(r.page.locator('#target')).toHaveCSS('color','rgb(0, 128, 0)'); expect((await r.status()).undo).toBe(0);
    await evidence(info,['A','B'],retained,'Normal and partial records share the same bounded live-document ledger.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('F13 blocked Reset survives repeated toggles and unrelated selection without duplicate history', async ({}, info) => {
  const r = await launch(info, html('#target{font-size:18px;color:purple}#other{font-size:20px}', '<button id="target">A</button><button id="other">B</button>'));
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='21px');
    await r.read('__p.editor.reset();true'); const blocked = await r.status(); expect(blocked.undo).toBe(1);
    for (let i=0;i<3;i++) { await toggle(r); await pick(r.page,'#other'); const current = await r.status(); expect(current.undo).toBe(1); expect(current.active).toHaveLength(1); await expect(r.page.locator('#target')).toHaveCSS('font-size','21px'); }
    await expect(r.page.getByRole('button',{name:'Reset session edits',exact:true})).toBeEnabled();
    await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='24px');
    await r.page.getByRole('button',{name:'Reset session edits',exact:true}).click(); expect((await r.status()).undo).toBe(0); await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); await expect(r.page.locator('#other')).toHaveCSS('font-size','20px');
    await evidence(info,['A','B'],blocked,'Retained author history is session-wide; routine UI toggles do not duplicate it.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('F14 navigation starts fresh rather than reusing native ownership from the old document', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='21px'); await r.read('__p.editor.undo();true'); expect((await r.status()).undo).toBe(1);
    await r.page.reload(); await expect(r.page.locator('cssforge-ui')).toHaveCount(0); await r.action(); await expect(inspector(r.page)).toBeVisible(); await r.bind(); await pick(r.page,'#target');
    const fresh = await r.status(); expect(fresh.undo).toBe(0); expect(fresh.active).toEqual([]); await r.read('__p.editor.undo();__p.editor.reset();true'); await expect(r.page.locator('#target')).toHaveCSS('font-size','18px');
    await evidence(info,['A'],fresh,'A new document cannot import old native references.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('F15 document tree replacement while inactive retires the old live-document ledger', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='21px'); await r.read('__p.editor.undo();true');
    await r.action(); await expect(r.page.locator('cssforge-ui')).toHaveCount(0);
    await r.page.evaluate(markup=>{document.open();document.write(markup);document.close();},html('#target{font-size:31px;color:green}'));
    await r.action(); await expect(inspector(r.page)).toBeVisible(); await r.bind(); await pick(r.page,'#target'); const fresh = await r.status(); expect(fresh.undo).toBe(0); expect(fresh.active).toEqual([]);
    await r.read('__p.editor.undo();__p.editor.reset();true'); await expect(r.page.locator('#target')).toHaveCSS('font-size','31px');
    await evidence(info,['A'],fresh,'Root replacement retires stale capabilities even if Document object identity survives.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

for (const [id, external] of [['F16','value'],['F17','priority'],['F18','removal']] as const) test(`${id} current attribution follows live ${external} while historical ownership survives`, async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); const declarationId = (await r.status()).declarationId; expect(await attribution(r)).toBe('cssforge-mutated-author');
    await r.page.locator('#author').evaluate((node,kind)=>{const style=((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style;if(kind==='value')style.fontSize='21px';if(kind==='priority')style.setProperty('font-size','24px','important');if(kind==='removal')style.removeProperty('font-size');},external);
    expect(await attribution(r)).toBe(external==='removal'?null:'authored'); expect(await r.read(`__p.editor.authorMutation.declarationState(${JSON.stringify(declarationId)})`)).toBe('authored'); expect((await r.status()).undo).toBe(1);
    await r.read('__p.editor.undo();true'); const blocked = await r.status(); expect(blocked.undo).toBe(1); expect(blocked.active[0].state).toBe('blocked');
    await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.cssText='font-size:24px;color:purple');
    expect(await attribution(r)).toBe('cssforge-mutated-author'); expect((await r.status()).undo).toBe(1); await r.read('__p.editor.undo();true'); await expect(r.page.locator('#target')).toHaveCSS('font-size','18px');
    await evidence(info,['A','B'],blocked,'Value, priority and declaration existence qualify current attribution independently from history.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('F19 identical replacement values never inherit current author attribution through recycled IDs', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); await r.page.locator('#author').evaluate(node=>node.textContent='#target{font-size:24px;color:purple}');
    expect(await attribution(r)).toBe('authored'); await r.read('__p.editor.undo();true'); expect((await r.status()).undo).toBe(1); expect((await r.status()).active[0].state).toBe('retired');
    await toggle(r); await pick(r.page,'#target'); expect(await attribution(r)).toBe('authored'); const retained = await r.status(); expect(retained.undo).toBe(1);
    await r.read('__p.editor.reset();true'); await expect(r.page.locator('#target')).toHaveCSS('font-size','24px'); expect((await r.status()).undo).toBe(1);
    await evidence(info,['B'],retained,'Native source identity outranks both equal values and presentation identifiers.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('F20 author recovery capacity is reserved before writes and never evicts unresolved ownership', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page,'#target'); const filled = await r.read(`(()=>{const e=__p.editor,id=e.getSnapshot().design.targetId;for(let i=0;i<256;i++){if(!e.applyAuthor(id,'font-size',(24+i)+'px'))throw Error('Unexpected capacity rejection');}return {active:e.authorMutation.active().length,undo:e.getSnapshot().undoCount};})()`);
    expect(filled).toEqual({active:256,undo:256}); const before = await r.css(); await r.author('font-size','400px'); const limited = await r.status();
    expect(limited.state).toBe('fallback'); expect(limited.reason).toContain('history limit'); expect(limited.active).toHaveLength(256); expect(await r.css()).toEqual(before);
    await r.read('__p.editor.undo();__p.editor.reset();true'); await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); expect((await r.status()).undo).toBe(0);
    await evidence(info,['A'],{filled,reason:limited.reason},'Recovery capacity is bounded before touching native state, without silent eviction.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('F21 successful and partial transactions on the same declaration unwind without duplicates', async ({}, info) => {
  const reaction = callback("if(this.style.fontSize!=='30px'||this.once)return;this.once=true;this.style.color='green';");
  const r = await launch(info,html('',inline,reaction));
  try {
    await pick(r.page,'#target'); expect(await r.author('font-size','24px')).toBe(true); expect(await r.author('font-size','30px')).toBe(false);
    const mixed = await r.status(); expect(mixed.undo).toBe(2); expect(mixed.active.map((change:any)=>change.kind)).toEqual(['applied','partial']);
    await r.read('__p.editor.undo();true'); await expect(r.page.locator('#target')).toHaveCSS('font-size','24px'); await expect(r.page.locator('#target')).toHaveCSS('color','rgb(0, 128, 0)'); expect((await r.status()).undo).toBe(1);
    await r.read('__p.editor.undo();true'); expect((await r.status()).undo).toBe(1); await expect(r.page.locator('#target')).toHaveCSS('font-size','24px');
    await r.page.locator('#target').evaluate(node=>(node as HTMLElement).style.color='purple'); await r.read('__p.editor.reset();true'); await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); expect((await r.status()).undo).toBe(0);
    await evidence(info,['A','B'],mixed,'Partial recovery does not relax the older normal transaction fingerprint or duplicate one attempted action.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('F22 partial priority conflict cannot be recovered by overwriting a newer important declaration', async ({}, info) => {
  const reaction = callback("if(this.style.fontSize!=='24px'||this.once)return;this.once=true;this.style.setProperty('font-size','24px','important');this.style.color='green';");
  const r = await launch(info,html('',inline,reaction));
  try {
    await pick(r.page,'#target'); expect(await r.author('font-size','24px')).toBe(false); const partial = await r.status();
    expect(partial.active[0]).toMatchObject({kind:'partial',state:'blocked',attempted:{value:'24px',priority:''},current:{value:'24px',priority:'important'}});
    await r.read('__p.editor.undo();__p.editor.reset();true'); expect((await r.status()).undo).toBe(1); expect(await r.page.locator('#target').evaluate(node=>(node as HTMLElement).style.getPropertyPriority('font-size'))).toBe('important');
    await r.page.locator('#target').evaluate(node=>(node as HTMLElement).style.setProperty('font-size','24px','')); await r.read('__p.editor.undo();true');
    await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); await expect(r.page.locator('#target')).toHaveCSS('color','rgb(0, 128, 0)'); expect((await r.status()).undo).toBe(0);
    await evidence(info,['A','B'],partial,'Partial ownership includes priority, not just equal values.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('F23 clean deactivation restores safe author state and reactivation has no recovery history', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px'); const before = await r.status();
    for(let i=0;i<3;i++) { await toggle(r); await pick(r.page,'#target'); const clean = await r.status(); expect(clean.undo).toBe(0); expect(clean.active).toEqual([]); await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); expect(await attribution(r)).toBe('authored'); }
    expect(await r.read('__p.editor.getSnapshot().mutationPolicy.mode')).toBe('SESSION_OVERRIDE');
    await evidence(info,['A'],before,'A successful lifecycle rollback leaves no phantom recovery transaction.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('F24 migrated A B C author history remains recoverable through conflict and UI teardown', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page,'#target'); await r.author('font-size','24px');
    for(const [index,name] of ['B','C'].entries()) {
      await r.page.locator('#target').evaluate((node,name)=>node.outerHTML=`<button id="target">${name}</button>`,name);
      await expect.poll(async()=>(await r.status()).reconciliationStats.migrations).toBe(index+1); await r.read('__p.source(true);__p.cascade();true');
    }
    await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='21px'); await r.read('__p.editor.undo();true'); const conflict = await r.status(); expect(conflict.undo).toBe(1);
    await toggle(r); await pick(r.page,'#target'); expect((await r.status()).undo).toBe(1); expect(await attribution(r)).toBe('authored'); expect(await r.read(`__p.cascade().properties['font-size'].winner.declaration.value`)).toBe('21px');
    await r.page.locator('#author').evaluate(node=>((node as HTMLStyleElement).sheet!.cssRules[0] as CSSStyleRule).style.fontSize='24px'); await r.read('__p.editor.undo();true'); await expect(r.page.locator('#target')).toHaveCSS('font-size','18px'); expect((await r.status()).undo).toBe(0);
    await evidence(info,['A','B'],conflict,'Reconciliation and teardown cannot erase blocked author ownership or reuse stale source associations.'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});
