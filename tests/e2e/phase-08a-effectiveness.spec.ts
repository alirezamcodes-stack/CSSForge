import { test, expect } from '@playwright/test';
import { launch, html } from './mutationHarness';
import { pick } from './extensionHarness';

for (const [name, css, reason] of [
  ['authored ID important', '#target{font-size:18px!important}', 'specificity'],
  ['flat important layer', '@layer theme { button{font-size:18px!important} }', 'layer-order'],
] as const) test(`D01 ${name}: accepted edit reports blocked truth in Design and Code`, async ({}, info) => {
  const r = await launch(info, html(css));
  try {
    await pick(r.page, '#target');
    const input = r.page.getByRole('textbox', { name:'Font size', exact:true });
    await input.fill('32px'); await input.press('Enter');
    const proof = await r.read(`(()=>{const s=__p.editor.getSnapshot(),p=__p.cascade().properties['font-size'];return {error:s.error,undo:s.undoCount,field:s.design.values['font-size'],winner:p.winner.source.kind,loss:p.overridden.find(x=>x.candidate.source.kind==='override').reason};})()`);
    expect(proof.error).toBeNull(); expect(proof.undo).toBe(1); expect(proof.field.override).toBe('32px');
    expect(proof.winner).toBe('style'); expect(proof.loss).toBe(reason);
    await expect(r.page.locator('#target')).toHaveCSS('font-size', '18px');
    // This assertion fails against the original build AFTER proving an accepted, correctly targeted losing edit.
    const designEffect = r.page.getByTestId('live-design').locator('[data-edit-property="font-size"]');
    await expect(designEffect).toHaveAttribute('data-edit-effect', 'blocked');
    await expect(designEffect).toContainText('32px'); await expect(designEffect).toContainText('18px');
    await r.page.getByRole('tab', { name:'Code', exact:true }).click();
    const codeEffect = r.page.getByTestId('live-code').locator('[data-edit-property="font-size"]');
    await expect(codeEffect).toHaveAttribute('data-edit-effect', 'blocked');
    await expect(codeEffect).toContainText('32px'); await expect(codeEffect).toContainText('18px');
    await r.page.getByRole('button', { name:'Refresh sources', exact:true }).click();
    expect((await r.status()).undo).toBe(1);
    await r.page.getByRole('button', { name:'Undo last edit', exact:true }).click();
    expect((await r.status()).undo).toBe(0);
    await expect(r.page.getByTestId('live-code').locator('[data-edit-effect]')).toHaveCount(0);
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('D01 stylesheet namespace selectors cannot throw after accepting a contextual edit',async({},info)=>{
  const r=await launch(info,html('@namespace h url("http://www.w3.org/1999/xhtml");button{font-size:18px}@media(min-width:1000px){button{font-size:21px}}@media(min-width:1200px){h|button#target{font-size:20px!important}}'));
  try{
    await pick(r.page,'#target');
    const proof=await r.read(`(()=>{__p.editor.setContext({media:['(min-width: 1000px)'],pseudo:''});let accepted=false,error=null;try{accepted=__p.editor.apply(__p.editor.getSnapshot().design.targetId,'font-size','32px');}catch(e){error=String(e);}return {accepted,error,undo:__p.editor.getSnapshot().undoCount};})()`);
    await expect(r.page.locator('#target')).toHaveCSS('font-size','20px');
    expect(proof.error).toBeNull();expect(proof.accepted).toBe(true);expect(proof.undo).toBe(1);
    await expect(r.page.getByTestId('live-design').locator('[data-edit-property="font-size"]')).toHaveAttribute('data-edit-effect','unknown');
    expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('D01 winning contributions preserve CSS expressions and refresh truth without adding history', async ({}, info) => {
  const r = await launch(info, html('button{width:200px;font-size:18px}'));
  try {
    await pick(r.page, '#target');
    const input = r.page.getByRole('textbox', { name:'Width', exact:true });
    await input.fill('calc(100px + 30px)'); await input.press('Enter');
    const effect = r.page.getByTestId('live-design').locator('[data-edit-property="width"]');
    await expect(effect).toHaveAttribute('data-edit-effect', 'effective');
    await expect(effect).toContainText('calc(100px + 30px)');
    await expect(r.page.locator('#target')).toHaveCSS('width', '130px');
    await r.page.getByRole('tab', { name:'Code', exact:true }).click();
    await r.page.evaluate(() => { const style=document.createElement('style');style.textContent='#target{width:180px!important}';document.head.append(style); });
    await r.page.getByRole('button', { name:'Refresh sources', exact:true }).click();
    await expect(r.page.getByTestId('live-code').locator('[data-edit-property="width"]')).toHaveAttribute('data-edit-effect', 'blocked');
    expect((await r.status()).undo).toBe(1);
    await r.read('__p.editor.reset();true');
    await expect(r.page.locator('[data-edit-effect]')).toHaveCount(0);
    await expect(r.page.locator('#target')).toHaveCSS('width','180px'); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('D01 inactive media and interactive states stay pending; generated pseudos stay unverified', async ({}, info) => {
  const r = await launch(info, html('button{font-size:18px}@media(min-width:9999px){button{font-size:22px}}'));
  try {
    await pick(r.page, '#target'); await r.page.mouse.move(1400, 850);
    const effect = r.page.getByTestId('live-design').locator('[data-edit-property="font-size"]');
    for (const pseudo of [':hover', ':focus', ':active']) {
      await r.read(`__p.editor.setContext({media:[],pseudo:${JSON.stringify(pseudo)}});__p.editor.apply(__p.editor.getSnapshot().design.targetId,'font-size','32px');true`);
      await expect(effect).toHaveAttribute('data-edit-effect','pending');
    }
    await r.read(`__p.editor.setContext({media:['(min-width: 9999px)'],pseudo:''});__p.editor.apply(__p.editor.getSnapshot().design.targetId,'font-size','32px');true`);
    await expect(effect).toHaveAttribute('data-edit-effect','pending'); await expect(effect).toContainText('Media query inactive');
    await expect(r.page.locator('#target')).toHaveCSS('font-size','18px');
    for (const pseudo of ['::before','::after']) {
      await r.read(`__p.editor.setContext({media:[],pseudo:${JSON.stringify(pseudo)}});__p.editor.apply(__p.editor.getSnapshot().design.targetId,'font-size','32px');true`);
      await expect(effect).toHaveAttribute('data-edit-effect','unknown');
      await expect(effect).toContainText('Generated pseudo-element not verified');
    }
    expect((await r.status()).undo).toBe(6); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('D01 inaccessible and unsupported sources withhold effectiveness certainty', async ({}, info) => {
  const r = await launch(info, html('button{font-size:18px}'));
  try {
    await pick(r.page, '#target');
    const input=r.page.getByRole('textbox',{name:'Font size',exact:true});await input.fill('32px');await input.press('Enter');
    await r.page.getByRole('tab',{name:'Code',exact:true}).click();
    const effect=r.page.getByTestId('live-code').locator('[data-edit-property="font-size"]');
    await r.page.route('http://styles.test/phase08.css', route=>route.fulfill({contentType:'text/css',body:'#target{font-size:20px!important}'}));
    await r.page.evaluate(async()=>{const link=document.createElement('link');link.rel='stylesheet';link.href='http://styles.test/phase08.css';const loaded=new Promise<void>(resolve=>link.onload=()=>resolve());document.head.append(link);await loaded;});
    await r.page.getByRole('button',{name:'Refresh sources',exact:true}).click();
    await expect(effect).toHaveAttribute('data-edit-effect','unknown');
    await r.page.evaluate(()=>{document.querySelector('link')!.remove();const style=document.createElement('style');style.textContent='@layer outer { @layer inner { button{font-size:19px!important} } }';document.head.append(style);});
    await r.page.getByRole('button',{name:'Refresh sources',exact:true}).click();
    await expect(effect).toHaveAttribute('data-edit-effect','unknown');
    expect((await r.status()).undo).toBe(1); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('D01 concurrent active browser states outside the inspected state withhold certainty', async ({}, info) => {
  const r=await launch(info,html('button{font-size:18px;width:200px;height:60px}#target:hover{font-size:20px!important}'));
  try {
    await pick(r.page,'#target');await r.page.mouse.move(1400,850);
    await r.read(`__p.editor.apply(__p.editor.getSnapshot().design.targetId,'font-size','32px');true`);
    const effect=r.page.getByTestId('live-design').locator('[data-edit-property="font-size"]');
    await expect(effect).toHaveAttribute('data-edit-effect','effective');
    await r.page.locator('#target').hover();
    await r.read('__p.source(true);true');
    await expect(r.page.locator('#target')).toHaveCSS('font-size','20px');
    await expect(effect).toHaveAttribute('data-edit-effect','unknown');
    await r.page.locator('#target').evaluate(node=>(node as HTMLElement).focus());
    await r.read(`__p.editor.setContext({media:[],pseudo:':focus'});__p.editor.apply(__p.editor.getSnapshot().design.targetId,'font-size','34px');true`);
    await expect(effect).toHaveAttribute('data-edit-effect','unknown');
    await expect(r.page.locator('#target')).toHaveCSS('font-size','20px');
    expect((await r.status()).undo).toBe(2);expect(r.errors).toEqual([]);
  } finally {await r.context.close();}
});

test('D01 concurrently matching media branches outside the chosen branch withhold certainty',async({},info)=>{
  const r=await launch(info,html('button{font-size:18px}@media(min-width:1000px){button{font-size:21px}}@media(min-width:1200px){#target{font-size:20px!important}}'));
  try {
    await pick(r.page,'#target');
    await r.read(`__p.editor.setContext({media:['(min-width: 1000px)'],pseudo:''});__p.editor.apply(__p.editor.getSnapshot().design.targetId,'font-size','32px');true`);
    await expect(r.page.locator('#target')).toHaveCSS('font-size','20px');
    await expect(r.page.getByTestId('live-design').locator('[data-edit-property="font-size"]')).toHaveAttribute('data-edit-effect','unknown');
    expect((await r.status()).undo).toBe(1);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
