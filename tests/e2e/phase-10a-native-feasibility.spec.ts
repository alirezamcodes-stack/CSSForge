import { test, expect } from '@playwright/test';
import { launch } from './mutationHarness';
import { pick } from './extensionHarness';

test('native EyeDropper is exposed and opens from a trusted CSSForge ShadowRoot click', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page, '#target');
    const exposed = await r.read(`({secure:isSecureContext,type:typeof EyeDropper,origin:location.origin})`);
    const browserVersion = r.context.browser()!.version();
    expect(exposed.type).toBe('function');
    await r.read(`(()=>{globalThis.__nativeProbe={state:'idle'};const button=document.querySelector('cssforge-ui').shadowRoot.querySelector('button');button.setAttribute('data-native-probe','');button.addEventListener('click',event=>{__nativeProbe.trusted=event.isTrusted;__nativeProbe.activation=navigator.userActivation.isActive;__nativeProbe.state='opening';globalThis.__abort=new AbortController();try{new EyeDropper().open({signal:__abort.signal}).then(result=>{__nativeProbe.state='success';__nativeProbe.result=result;},error=>{__nativeProbe.state='rejected';__nativeProbe.name=error.name;__nativeProbe.message=error.message;});__nativeProbe.returned=true;}catch(error){__nativeProbe.state='threw';__nativeProbe.name=error.name;__nativeProbe.message=error.message;}});return true;})()`);
    await r.page.locator('[data-native-probe]').click();
    const opening = await r.read(`__nativeProbe`);
    await r.read(`__abort.abort();true`);
    await expect.poll(() => r.read(`__nativeProbe.state`)).not.toBe('opening');
    const settled = await r.read(`__nativeProbe`);
    await info.attach('native-isolated-world-probe', { body: JSON.stringify({browserVersion,exposed,opening,settled}), contentType: 'application/json' });
    console.log(JSON.stringify({browserVersion,exposed,opening,settled}));
    expect(opening).toMatchObject({trusted:true,activation:true,returned:true,state:'opening'});
    expect(settled).toMatchObject({state:'rejected',name:'AbortError'});
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('records native Escape delivery separately from the web keyboard driver', async ({}, info) => {
  const r=await launch(info);
  try {
    await pick(r.page,'#target');await r.page.getByRole('button',{name:'Text color picker',exact:true}).click();
    await r.read(`(()=>{globalThis.__nativeEscape={state:'idle',htmlKeys:0};document.addEventListener('keydown',event=>{if(event.key==='Escape')__nativeEscape.htmlKeys++;},true);const button=[...document.querySelector('cssforge-ui').shadowRoot.querySelectorAll('button')].find(b=>b.textContent==='HEX');button.addEventListener('click',()=>{globalThis.__escapeAbort=new AbortController();__nativeEscape.state='opening';new EyeDropper().open({signal:__escapeAbort.signal}).then(result=>{__nativeEscape.state='success';__nativeEscape.result=result;},error=>{__nativeEscape.state='rejected';__nativeEscape.name=error.name;});});return true;})()`);
    await r.page.getByRole('button',{name:'HEX',exact:true}).click();await r.page.keyboard.press('Escape');
    const afterKeyboard=await r.read('__nativeEscape');
    if(afterKeyboard.state==='opening') await r.read('__escapeAbort.abort();true');
    await expect.poll(()=>r.read('__nativeEscape.state')).toBe('rejected');
    const settled=await r.read('__nativeEscape');expect(settled.name).toBe('AbortError');
    console.log(JSON.stringify({nativeEscapeDriver:afterKeyboard,settled}));
    await info.attach('native-escape-driver',{body:JSON.stringify({afterKeyboard,settled}),contentType:'application/json'});
    expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

test('native activation is required and abort retains the existing color popover', async ({}, info) => {
  const r = await launch(info);
  try {
    await r.page.waitForTimeout(5500); // Expire activation granted by extension toolbar dispatch.
    const noGesture = await r.read(`new EyeDropper().open().then(()=>({unexpected:true}),error=>({name:error.name,message:error.message}))`);
    expect(noGesture.name).toBe('NotAllowedError');
    await pick(r.page, '#target');
    await r.page.getByRole('button', {name:'Text color picker',exact:true}).click();
    await r.read(`(()=>{globalThis.__nativeProbe={state:'idle'};const button=[...document.querySelector('cssforge-ui').shadowRoot.querySelectorAll('button')].find(b=>b.textContent==='HEX');button.addEventListener('click',event=>{__nativeProbe.trusted=event.isTrusted;__nativeProbe.state='opening';globalThis.__abort=new AbortController();new EyeDropper().open({signal:__abort.signal}).then(result=>{__nativeProbe.state='success';__nativeProbe.result=result;},error=>{__nativeProbe.state='rejected';__nativeProbe.name=error.name;});});return true;})()`);
    await r.page.getByRole('button',{name:'HEX',exact:true}).click();
    expect(await r.read(`__nativeProbe.state`)).toBe('opening');
    await r.read(`__abort.abort();true`);
    await expect.poll(() => r.read(`__nativeProbe.state`)).toBe('rejected');
    const settled = await r.read(`__nativeProbe`);
    expect(settled).toMatchObject({trusted:true,name:'AbortError'});
    await expect(r.page.getByRole('dialog',{name:'Text color picker',exact:true})).toBeVisible();
    expect((await r.status()).undo).toBe(0);
    await info.attach('native-popover-probe',{body:JSON.stringify({noGesture,settled,popoverRetained:true,undo:0}),contentType:'application/json'});
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('production ColorControl opens the real native API once and inspector closure aborts it',async({},info)=>{
  const r=await launch(info);
  try {
    await r.read(`globalThis.__realNative={calls:0,state:'idle'};globalThis.__OriginalEyeDropper=EyeDropper;globalThis.EyeDropper=class extends __OriginalEyeDropper {open(options){__realNative.calls++;__realNative.state='opening';__realNative.signal=options.signal;const opened=super.open(options);opened.then(result=>{__realNative.state='success';__realNative.result=result;},error=>{__realNative.state='rejected';__realNative.name=error.name;});return opened;}};true`);
    await pick(r.page,'#target');await r.page.getByRole('button',{name:'Text color picker',exact:true}).click();
    await r.page.getByRole('button',{name:'Sample text color from screen',exact:true}).click();
    expect(await r.read(`({calls:__realNative.calls,state:__realNative.state,aborted:__realNative.signal.aborted})`)).toEqual({calls:1,state:'opening',aborted:false});
    await r.page.getByRole('button',{name:'Hide inspector panel',exact:true}).click();
    await expect.poll(()=>r.read('__realNative.state')).toBe('rejected');
    const settled=await r.read(`({calls:__realNative.calls,state:__realNative.state,name:__realNative.name,aborted:__realNative.signal.aborted})`);
    expect(settled).toEqual({calls:1,state:'rejected',name:'AbortError',aborted:true});expect((await r.status()).undo).toBe(0);
    await info.attach('production-native-request',{body:JSON.stringify(settled),contentType:'application/json'});expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});
