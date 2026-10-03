import { chromium, expect, test } from '@playwright/test';
import { html, launch } from './mutationHarness';
import { pick } from './extensionHarness';

// The native constructor and promise are passed through unchanged. Counters live
// only in the extension's isolated test world and disappear with its context.
const instrument = `(()=>{
  const probe=globalThis.__nativeInvestigation={calls:0,events:[],suspensions:[],editor:[],keys:0,state:'idle',frames:0};
  const push=(kind,details={})=>probe.events.push({kind,at:performance.now(),...details});
  const Native=EyeDropper;
  globalThis.EyeDropper=class extends Native {open(options){
    probe.calls++;probe.state='pending';probe.signal=options.signal;
    push('open',{activation:navigator.userActivation.isActive,focused:document.hasFocus()});
    options.signal.addEventListener('abort',()=>push('abort',{stack:new Error().stack}),{once:true});
    const promise=super.open(options);
    push('returned');
    promise.then(result=>{probe.state='resolved';probe.result=result;push('resolved',{result});},error=>{probe.state='rejected';probe.error={name:error.name,message:error.message};push('rejected',probe.error);});
    return promise;
  }};
  const suspend=__p.setSuspended;
  __p.setSuspended=function(value,reason){probe.suspensions.push({value,reason,at:performance.now()});return suspend(value,reason);};
  let values=__p.editor.getSnapshot().design?.values;
  probe.stopEditor=__p.editor.subscribe(()=>{const snapshot=__p.editor.getSnapshot();probe.editor.push({at:performance.now(),sameValues:snapshot.design?.values===values,targetId:snapshot.design?.targetId,generation:snapshot.design?.bindingGeneration});values=snapshot.design?.values;});
  for(const type of ['focus','blur','focusin','focusout','resize','keydown','pointerdown','click']){
    document.addEventListener(type,event=>{if(type==='keydown'&&event.key==='Escape')probe.keys++;push(type,{trusted:event.isTrusted,target:event.composedPath()[0]?.tagName,key:event.key});},true);
  }
  window.addEventListener('blur',()=>push('window-blur'));window.addEventListener('focus',()=>push('window-focus'));
  const frame=()=>{probe.frames++;probe.raf=requestAnimationFrame(frame);};probe.raf=requestAnimationFrame(frame);
  return true;
})()`;

const snapshot = `(()=>{const p=__nativeInvestigation;const root=document.querySelector('cssforge-ui')?.shadowRoot;const button=root?.querySelector('button[aria-label^="Sample "][aria-busy]')??root?.querySelector('button[aria-label^="Sample "]');return {calls:p.calls,state:p.state,error:p.error,aborted:p.signal?.aborted,events:p.events,suspensions:p.suspensions,editor:p.editor,frames:p.frames,keys:p.keys,busy:button?.getAttribute('aria-busy'),buttonConnected:button?.isConnected,dialog:!!root?.querySelector('[role="dialog"]'),focus:root?.activeElement?.getAttribute('aria-label'),undo:__p.editor.getSnapshot().undoCount}})()`;

for (const headed of [false, true]) {
  test(`production native request stays pending and cleans up after native abort (${headed ? 'headed' : 'headless'})`, async ({}, info) => {
    test.setTimeout(40000);
    const original = chromium.launchPersistentContext.bind(chromium);
    chromium.launchPersistentContext = ((profile, options) => original(profile, { ...options, headless: !headed, args: [...(options?.args ?? []), '--enable-automation'] })) as typeof chromium.launchPersistentContext;
    let r: Awaited<ReturnType<typeof launch>> | undefined;
    try {
      r = await launch(info);
      const browserCDP = await r.context.browser()!.newBrowserCDPSession();
      const { arguments: browserArguments } = await browserCDP.send('Browser.getBrowserCommandLine');
      const browserHeadless = browserArguments.some(argument => argument.startsWith('--headless'));
      expect(browserHeadless).toBe(!headed);
      await pick(r.page, '#target');
      await r.page.getByRole('button', { name: 'Text color picker', exact: true }).click();
      await r.read(instrument);
      await r.page.getByRole('button', { name: 'Sample text color from screen', exact: true }).click();
      const opened = await r.read(snapshot);
      await r.page.waitForTimeout(2000);
      const pending = await r.read(snapshot);
      await r.page.mouse.move(200, 200);
      await r.page.setViewportSize({ width: 1400, height: 900 });
      await r.page.waitForTimeout(300);
      const afterGeometry = await r.read(snapshot);
      await r.page.keyboard.press('Escape');
      await r.page.waitForTimeout(100);
      const afterEscape = await r.read(snapshot);
      if (!afterEscape.aborted && afterEscape.state === 'pending') {
        // Playwright keyboard is delivered to the web renderer, not necessarily
        // the native OS capture. Explicit production unmount still drives the
        // original AbortSignal and the original native rejection.
        await r.page.getByRole('button', { name: 'Hide inspector panel', exact: true }).click();
      }
      await expect.poll(() => r!.read('__nativeInvestigation.state')).toBe('rejected');
      const settled = await r.read(snapshot);
      const evidence = { headed, browserHeadless, browser: r.context.browser()!.version(), opened, pending, afterGeometry, afterEscape, settled };
      await info.attach('native-lifecycle-investigation', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
      console.log(JSON.stringify(evidence));
      expect(opened).toMatchObject({ calls: 1, state: 'pending', aborted: false, busy: 'true', dialog: true });
      expect(pending).toMatchObject({ calls: 1, state: 'pending', aborted: false, busy: 'true', dialog: true });
      expect(pending.frames).toBeGreaterThan(opened.frames);
      expect(afterGeometry).toMatchObject({ calls: 1, state: 'pending', aborted: false, busy: 'true', dialog: true });
      expect(settled).toMatchObject({ calls: 1, state: 'rejected', error: { name: 'AbortError' }, aborted: true, undo: 0 });
      expect(settled.suspensions.filter((item: any) => item.reason === 'sampling')).toEqual([
        expect.objectContaining({ value: true, reason: 'sampling' }),
        expect.objectContaining({ value: false, reason: 'sampling' }),
      ]);
      expect(r.errors).toEqual([]);
    } finally {
      chromium.launchPersistentContext = original;
      await r?.context.close();
    }
  });
}

test('identical source refresh keeps a production native request pending', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page, '#target');
    await r.page.getByRole('button', { name: 'Text color picker', exact: true }).click();
    await r.read(instrument);
    await r.page.getByRole('button', { name: 'Sample text color from screen', exact: true }).click();
    await r.read('__p.source(true);true');
    const refreshed = await r.read(snapshot);
    await info.attach('native-identical-source-refresh', { body: JSON.stringify(refreshed, null, 2), contentType: 'application/json' });
    console.log(JSON.stringify({ identicalSourceRefresh: refreshed }));
    expect(refreshed).toMatchObject({ calls: 1, state: 'pending', aborted: false, busy: 'true', dialog: true, undo: 0 });
    await r.page.keyboard.press('Escape');
    await expect.poll(() => r.read('__nativeInvestigation.state')).toBe('rejected');
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('real native request aborts when the actual editing value changes', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page, '#target');
    await r.page.getByRole('button', { name: 'Text color picker', exact: true }).click();
    await r.read(instrument);
    await r.page.getByRole('button', { name: 'Sample text color from screen', exact: true }).click();
    await r.read("__p.editor.apply(__p.editor.getSnapshot().design.targetId,'color','teal');true");
    await expect.poll(() => r.read('__nativeInvestigation.state')).toBe('rejected');
    const settled = await r.read(snapshot);
    await info.attach('native-value-change-abort', { body: JSON.stringify(settled, null, 2), contentType: 'application/json' });
    expect(settled).toMatchObject({ calls: 1, state: 'rejected', error: { name: 'AbortError' }, aborted: true, undo: 1 });
    expect(settled.suspensions.filter((item: any) => item.reason === 'sampling')).toEqual([
      expect.objectContaining({ value: true, reason: 'sampling' }),
      expect.objectContaining({ value: false, reason: 'sampling' }),
    ]);
    await expect(r.page.locator('#target')).toHaveCSS('color', 'rgb(0, 128, 128)');
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('six production native open-cancel cycles release sampling and restore focus exactly once each', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page, '#target');
    await r.page.getByRole('button', { name: 'Text color picker', exact: true }).click();
    await r.read(instrument);
    for (let index = 0; index < 6; index++) {
      await r.page.getByRole('button', { name: 'Sample text color from screen', exact: true }).click();
      expect(await r.read(snapshot)).toMatchObject({ calls: index + 1, state: 'pending', aborted: false, busy: 'true', undo: 0 });
      await r.page.keyboard.press('Escape');
      await expect.poll(() => r.read('__nativeInvestigation.state')).toBe('rejected');
      await expect(r.page.getByRole('button', { name: 'Sample text color from screen', exact: true })).toBeFocused();
      await expect(r.page.getByRole('dialog', { name: 'Text color picker', exact: true })).toBeVisible();
    }
    const settled = await r.read(snapshot);
    const reasons = settled.suspensions.filter((item: any) => item.reason === 'sampling').map((item: any) => item.value);
    expect(reasons).toEqual(Array.from({ length: 6 }, () => [true, false]).flat());
    expect(settled).toMatchObject({ calls: 6, busy: null, undo: 0 });
    await info.attach('native-six-cycles', { body: JSON.stringify(settled, null, 2), contentType: 'application/json' });
    await r.page.getByRole('button', { name: 'Text color picker', exact: true }).click();
    await pick(r.page, '#target');
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('second gradient stop native request remains pending across selected-stop focus', async ({}, info) => {
  const r = await launch(info, html('#target{color:purple;background-image:linear-gradient(90deg,red 10%,blue 90%)}'));
  try {
    await pick(r.page, '#target');
    await r.page.getByRole('button', { name: 'Stop 2 color picker', exact: true }).click();
    await r.read(instrument);
    await r.page.getByRole('button', { name: 'Sample stop 2 color from screen', exact: true }).focus();
    await r.page.keyboard.press('Enter');
    await r.page.waitForTimeout(500);
    const pending = await r.read(snapshot);
    await info.attach('native-second-stop', { body: JSON.stringify(pending, null, 2), contentType: 'application/json' });
    expect(pending).toMatchObject({ calls: 1, state: 'pending', aborted: false, busy: 'true', undo: 0 });
    await r.page.keyboard.press('Escape');
    await expect.poll(() => r.read('__nativeInvestigation.state')).toBe('rejected');
    await expect(r.page.getByRole('button', { name: 'Sample stop 2 color from screen', exact: true })).toBeFocused();
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('headed native pixel-driver probe records a native result or exact driver limitation', async ({}, info) => {
  const original = chromium.launchPersistentContext.bind(chromium);
  chromium.launchPersistentContext = ((profile, options) => original(profile, { ...options, headless: false })) as typeof chromium.launchPersistentContext;
  let r: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    r = await launch(info);
    await pick(r.page, '#target');
    await r.page.getByRole('button', { name: 'Text color picker', exact: true }).click();
    await r.read(instrument);
    await r.page.getByRole('button', { name: 'Sample text color from screen', exact: true }).click();
    await r.page.waitForTimeout(1200);
    await r.page.mouse.click(200, 200);
    await r.page.waitForTimeout(300);
    const nativeDriver = await r.read(snapshot);
    let escapeDriver;
    if (nativeDriver.state === 'pending') {
      await r.page.keyboard.press('Escape');
      await r.page.waitForTimeout(100);
      escapeDriver = await r.read(snapshot);
      if (escapeDriver.state === 'pending') await r.page.getByRole('button', { name: 'Hide inspector panel', exact: true }).click();
      await expect.poll(() => r!.read('__nativeInvestigation.state')).toBe('rejected');
    }
    const settled = await r.read(snapshot);
    await info.attach('headed-native-pixel-driver', { body: JSON.stringify({ nativeDriver, escapeDriver, settled }, null, 2), contentType: 'application/json' });
    console.log(JSON.stringify({ headedNativePixelDriver: nativeDriver, escapeDriver, settled }));
    expect(nativeDriver.calls).toBe(1);
    if (nativeDriver.state === 'resolved') {
      expect(nativeDriver.undo).toBe(1);
      expect(nativeDriver.aborted).toBe(false);
    } else {
      // This is evidence about the renderer input driver's reach, not simulated
      // native success. The original native promise remains observable.
      expect(nativeDriver).toMatchObject({ state: 'pending', aborted: false, undo: 0 });
      expect(settled).toMatchObject({ state: 'rejected', error: { name: 'AbortError' }, aborted: true, undo: 0 });
    }
    expect(r.errors).toEqual([]);
  } finally {
    chromium.launchPersistentContext = original;
    await r?.context.close();
  }
});
