import { expect, test } from '@playwright/test';
import { launch, html } from './mutationHarness';
import { pick, inspector } from './extensionHarness';

// The Phase 09B A/B profile mounted this exact eight-stop fixture with 13
// ColorControls and 107 editor / 8 picker listeners. Keep the healthy reference
// explicit so an idle per-control sampling subscription cannot hide in a budget.
const fixture = () => html(
  '#target,#other{width:500px;height:160px;padding:24px;margin:70px 0;color:#572ca8;border:3px solid #884422;background-color:#bbaa88;background-image:linear-gradient(70deg,#ff0000 0%,#ee4422 14%,#cc8800 28%,#99aa22 42%,#22bb66 56%,#1188bb 70%,#4433ee 84%,#8822aa 100%);box-shadow:1px 2px 5px #333333,4px 7px 8px #777777;text-shadow:1px 2px 1px #222222}',
  '<div id="target">Rich selected target</div><div id="other">Second selected target</div>',
);

async function observe(r: Awaited<ReturnType<typeof launch>>) {
  await r.read(`globalThis.__work={editor:new Set(),picker:new Set(),duplicateCleanup:0,raf:0,resize:0,focus:0};
    for(const [key,owner] of [['editor',__p.editor],['picker',__p]]){
      const original=owner.subscribe;owner.subscribe=function(listener){const stop=original.call(this,listener),lease={};__work[key].add(lease);return()=>{if(!__work[key].delete(lease))__work.duplicateCleanup++;stop()}};
    }
    const raf=requestAnimationFrame;globalThis.requestAnimationFrame=callback=>raf(time=>{__work.raf++;callback(time)});
    const NativeResize=ResizeObserver;globalThis.ResizeObserver=class extends NativeResize{constructor(callback){super((...args)=>{__work.resize++;callback(...args)})}};
    const focus=HTMLElement.prototype.focus;HTMLElement.prototype.focus=function(...args){__work.focus++;return focus.apply(this,args)};
    globalThis.__requests=[];globalThis.__deferAbort=false;globalThis.EyeDropper=class{open(options){return new Promise((resolve,reject)=>{__requests.push({resolve,reject,signal:options.signal});options.signal.addEventListener('abort',()=>{if(!__deferAbort)reject(new DOMException('Cancelled','AbortError'))},{once:true})})}};
    true`);
}
const listeners = (r: Awaited<ReturnType<typeof launch>>) => r.read<{ editor: number; picker: number }>('({editor:__work.editor.size,picker:__work.picker.size})');
const work = (r: Awaited<ReturnType<typeof launch>>) => r.read<{ raf: number; resize: number; focus: number }>('({raf:__work.raf,resize:__work.resize,focus:__work.focus})');

test('10A idle controls match Phase 09B subscriptions and sampling cycles release their only extra listener', async ({}, info) => {
  const r = await launch(info, fixture());
  try {
    await observe(r); await pick(r.page, '#target');
    await expect.poll(() => listeners(r)).toEqual({ editor: 107, picker: 8 });
    const trigger = inspector(r.page).getByRole('button', { name: 'Text color picker', exact: true });
    await trigger.click();
    await expect.poll(() => listeners(r)).toEqual({ editor: 108, picker: 8 });
    const sample = inspector(r.page).getByRole('button', { name: 'Sample text color from screen', exact: true });
    const rows = [];
    for (let attempt = 0; attempt < 12; attempt++) {
      await sample.click();
      await expect.poll(() => listeners(r)).toEqual({ editor: 109, picker: 8 });
      await r.page.keyboard.press('Escape');
      await expect(sample).not.toHaveAttribute('aria-busy', 'true');
      await expect.poll(() => listeners(r)).toEqual({ editor: 108, picker: 8 });
      rows.push(await listeners(r));
    }
    expect(await r.read('__requests.every(request=>request.signal.aborted)')).toBe(true);
    expect((await r.status()).undo).toBe(0);
    await r.page.keyboard.press('Escape');
    await expect.poll(() => listeners(r)).toEqual({ editor: 107, picker: 8 });
    await pick(r.page, '#other');
    await expect.poll(() => listeners(r)).toEqual({ editor: 107, picker: 8 });
    await info.attach('Phase09B-subscription-reference', { body: JSON.stringify({ baseline: { controls: 13, editor: 107, picker: 8 }, rows }), contentType: 'application/json' });
    expect(await r.read('__work.duplicateCleanup')).toBe(0);
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('10A success failure stale close and late overlap all release sampling lifecycle subscriptions once', async ({}, info) => {
  const r = await launch(info, fixture());
  try {
    await observe(r); await pick(r.page, '#target');
    const trigger = inspector(r.page).getByRole('button', { name: 'Text color picker', exact: true });
    const sample = inspector(r.page).getByRole('button', { name: 'Sample text color from screen', exact: true });
    await trigger.click();
    const start = async () => { await sample.click(); await expect.poll(() => listeners(r)).toEqual({ editor: 109, picker: 8 }); };
    const finished = async () => { await expect(sample).not.toHaveAttribute('aria-busy', 'true'); await expect.poll(() => listeners(r)).toEqual({ editor: 108, picker: 8 }); };
    await start(); await r.read("__requests.at(-1).resolve({sRGBHex:'#13579b'});true"); await finished();
    await start(); await r.read("__requests.at(-1).reject(new DOMException('Blocked','OperationError'));true"); await finished();
    await start(); await r.read("__p.editor.apply(__p.editor.getSnapshot().design.targetId,'color','#abcdef');true"); await finished();
    expect(await r.read('__requests.at(-1).signal.aborted')).toBe(true);
    await r.read('__deferAbort=true;true');
    await start(); const retired = await r.read('__requests.length-1');
    await r.page.keyboard.press('Escape'); await finished();
    await start(); await r.read(`__requests[${retired}].resolve({sRGBHex:'#ff0000'});true`);
    await expect(sample).toHaveAttribute('aria-busy', 'true');
    expect(await listeners(r)).toEqual({ editor: 109, picker: 8 });
    await r.read("__requests.at(-1).resolve({sRGBHex:'#2468ac'});true"); await finished();
    await start(); await inspector(r.page).getByRole('button', { name: 'Hide inspector', exact: true }).click();
    await expect.poll(() => listeners(r)).toEqual({ editor: 107, picker: 8 });
    expect(await r.read('__work.duplicateCleanup')).toBe(0);
    expect(await r.read('__requests.at(-1).signal.aborted')).toBe(true);
    await r.read("__requests.at(-1).resolve({sRGBHex:'#ff0000'});true");
    await expect.poll(() => listeners(r)).toEqual({ editor: 107, picker: 8 });
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('10A pending and closed color popovers retain the Phase 09B zero-work idle behavior', async ({}, info) => {
  const r = await launch(info, fixture());
  try {
    await observe(r); await pick(r.page, '#target');
    const trigger = inspector(r.page).getByRole('button', { name: 'Text color picker', exact: true });
    await trigger.click();
    const sample = inspector(r.page).getByRole('button', { name: 'Sample text color from screen', exact: true });
    await sample.click(); await r.page.waitForTimeout(200);
    const pending = await work(r); await r.page.waitForTimeout(500); expect(await work(r)).toEqual(pending);
    await r.page.keyboard.press('Escape'); await r.page.keyboard.press('Escape');
    for (let cycle = 0; cycle < 12; cycle++) { await trigger.click(); await r.page.keyboard.press('Escape'); }
    await r.page.waitForTimeout(200); const closed = await work(r);
    await r.page.waitForTimeout(500); expect(await work(r)).toEqual(closed);
    await expect.poll(() => listeners(r)).toEqual({ editor: 107, picker: 8 });
    await info.attach('idle-work', { body: JSON.stringify({ measuredHealthyBaseline: { idleRAF: 0, idleObserverCallbacks: 0, idleFocusCalls: 0 }, pending, closed }), contentType: 'application/json' });
    expect(await r.read('__work.duplicateCleanup')).toBe(0);
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});
