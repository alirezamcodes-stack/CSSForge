import { test, expect, type TestInfo, type Page } from '@playwright/test';
import { setup, pick } from './extensionHarness';

const fixture = `<!doctype html><html><head><style>body{margin:0;font:20px Arial}main{padding:80px}#target{width:240px;height:80px;font-size:20px;filter:none;background:linear-gradient(red,blue);background-position:10% 20%;background-size:50% 60%}</style></head><body><main><button id="target">Owner A</button></main></body></html>`;
const field = (page: Page, label: string) => page.getByRole('textbox', { name: label, exact: true });

async function launch(info: TestInfo) {
  const runtime = await setup(info, fixture), cdp = await runtime.context.newCDPSession(runtime.page);
  const worlds: { id: number; origin: string }[] = [];
  cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context));
  await cdp.send('Runtime.enable');
  const world = worlds.find(item => item.origin.startsWith('chrome-extension://'))!;
  const read = async <T = any>(expression: string): Promise<T> => {
    const result = await cdp.send('Runtime.evaluate', { contextId: world.id, expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  // Observe the current built controller; no mutation/edit action is substituted for the visible controls.
  await read(`globalThis.__phase08Picker=(()=>{const n=document.querySelector('cssforge-ui').shadowRoot.querySelector('[data-cssforge]');let f=n[Object.getOwnPropertyNames(n).find(k=>k.startsWith('__reactFiber$'))];for(let i=0;f&&i<32;i++,f=f.return){if(f.memoizedProps?.picker)return f.memoizedProps.picker;if(f.memoizedProps?.value?.picker)return f.memoizedProps.value.picker;}throw Error('Built picker missing');})();true`);
  const state = () => read(`(()=>{const s=__phase08Picker.editor.getSnapshot();return {targetId:s.design?.targetId,bindingGeneration:s.design?.bindingGeneration,undo:s.undoCount,context:s.context,overrides:s.overrides,reconciliation:__phase08Picker.reconciliation().state};})()`);
  const replace = async () => {
    await runtime.page.locator('#target').evaluate(node => {
      (window as any).retiredPhase08Target = node;
      node.outerHTML = '<button id="target" style="font-size:27px;width:300px">Owner B</button>';
    });
    await expect.poll(async () => (await state()).reconciliation).toBe('migrated');
  };
  return { ...runtime, read, state, replace };
}

async function committedEdit(page: Page, label: string, value: string) {
  await field(page, label).fill(value); await field(page, label).press('Enter');
}

test('replacement rebinds a focused invalid Numeric draft without a stale Enter or Escape', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page, '#target');
    await committedEdit(r.page, 'Width', '220px'); // A real accepted edit authorizes strong reconciliation.
    const before = await r.state();
    await field(r.page, 'Font size').fill('11qu');
    await expect(field(r.page, 'Font size')).toHaveAttribute('aria-invalid', 'true');
    await r.replace();
    const after = await r.state();
    expect(after.targetId).toBe(before.targetId); expect(after.bindingGeneration).toBeGreaterThan(before.bindingGeneration);
    expect(after.undo).toBe(before.undo);
    await expect(field(r.page, 'Font size')).toHaveValue('27');
    await expect(field(r.page, 'Font size')).not.toHaveAttribute('aria-invalid', 'true');
    await field(r.page, 'Font size').press('Enter'); await field(r.page, 'Font size').press('Escape');
    await expect(r.page.locator('#target')).toHaveCSS('font-size', '27px');
    await expect(r.page.locator('#target')).toHaveCSS('width', '220px');
    expect((await r.state()).undo).toBe(before.undo);
    expect(await r.page.evaluate(() => [...(window as any).retiredPhase08Target.attributes].filter((a:any)=>a.name.startsWith('data-cssforge-target')).length)).toBe(0);
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('replacement keeps accepted Numeric history but retires the old physical gesture baseline', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page, '#target');
    await field(r.page, 'Font size').fill('23px'); // Accepted live preview, still focused.
    const before = await r.state(); expect(before.undo).toBe(1);
    await r.replace();
    await expect(r.page.locator('#target')).toHaveCSS('font-size', '23px');
    // Pressing Escape after the rebind cannot cancel an A-owned gesture against B.
    await field(r.page, 'Font size').press('Escape');
    await expect(r.page.locator('#target')).toHaveCSS('font-size', '23px');
    expect((await r.state()).undo).toBe(before.undo);
    await r.page.getByRole('button', { name:'Inspector menu', exact:true }).click();
    await r.page.getByRole('dialog', { name:'Inspector menu', exact:true }).getByRole('button', { name:'Undo last edit', exact:true }).click();
    await expect(r.page.locator('#target')).toHaveCSS('font-size', '27px');
    expect((await r.state()).undo).toBe(0); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('replacement cancels an A-owned queued filter frame before it can write B', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page, '#target'); await committedEdit(r.page, 'Width', '220px');
    const before = await r.state();
    const slider = r.page.getByRole('slider', { name:'Blur', exact:true }); await slider.focus();
    // Hold only requestAnimationFrame delivery, so an otherwise real slider input stays queued.
    // MutationObservers and React/controller notifications retain their normal browser ordering.
    await r.read(`globalThis.__phase08Frames=new Map();globalThis.__phase08FrameId=1000000;globalThis.__phase08NativeRAF=window.requestAnimationFrame;globalThis.__phase08NativeCancel=window.cancelAnimationFrame;window.requestAnimationFrame=callback=>{const id=++__phase08FrameId;__phase08Frames.set(id,callback);return id;};window.cancelAnimationFrame=id=>{if(!__phase08Frames.delete(id))__phase08NativeCancel.call(window,id);};true`);
    await slider.evaluate(node => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, '9');
      node.dispatchEvent(new Event('input', { bubbles:true }));
    });
    expect(await r.read('__phase08Frames.size')).toBeGreaterThan(0);
    await expect(r.page.locator('#target')).toHaveCSS('filter', 'none');
    await r.replace();
    expect((await r.state()).undo).toBe(before.undo);
    await r.read(`window.requestAnimationFrame=__phase08NativeRAF;window.cancelAnimationFrame=__phase08NativeCancel;const held=[...__phase08Frames.values()];__phase08Frames.clear();for(const callback of held)callback(performance.now());true`);
    // The queued callback has now been explicitly delivered; no timeout is used as an assertion.
    await expect(r.page.locator('#target')).toHaveCSS('filter', 'none');
    expect((await r.state()).undo).toBe(before.undo);
    await slider.focus(); await slider.press('ArrowRight'); await slider.press('Tab');
    await expect(r.page.locator('#target')).toHaveCSS('filter', 'blur(0.1px)');
    expect((await r.state()).undo).toBe(before.undo + 1); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});
