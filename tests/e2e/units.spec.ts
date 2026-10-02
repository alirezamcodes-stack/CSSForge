import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { browser } from 'wxt/browser';
import { setup, fixture, pick, withinViewport } from './extensionHarness';
declare const chrome: typeof browser;
const out = 'test-results/diagnostics/phase-06.5.4';
const field = (page:Page,name:string) => page.getByRole('textbox',{name,exact:true});
async function edit(page:Page,name:string,value:string) { await field(page,name).fill(value); await field(page,name).press('Enter'); }
async function convert(page:Page,name:string,unit:string) {
  await page.getByRole('button',{name:`${name} unit`,exact:true}).click();
  const option = page.getByRole('dialog',{name:`${name} unit`,exact:true}).getByRole('button',{name:unit,exact:true});
  await expect(option).toBeEnabled(); await option.click();
}
async function action(page:Page,name:string) { await page.getByRole('button',{name:'Inspector menu',exact:true}).click(); await page.getByRole('dialog',{name:'Inspector menu',exact:true}).getByRole('button',{name,exact:true}).click(); await page.keyboard.press('Escape'); }
async function section(page:Page,name:string) {
  for (const item of await page.locator('[data-section]').all()) {
    const title = (await item.getAttribute('data-section'))!; const button = item.getByRole('button',{name:title,exact:true});
    if (await button.getAttribute('aria-expanded') !== String(title === name)) await button.click();
  }
  if (name) await page.locator(`[data-section="${name}"]`).evaluate(node => node.scrollIntoView({block:'start'}));
}
async function capture(page:Page,name:string) { await page.mouse.move(0,0); await page.screenshot({path:`${out}/${name}.png`,animations:'disabled'}); }
async function fits(page:Page) {
  await withinViewport(page);
  expect(await page.getByRole('tabpanel',{name:'Design',exact:true}).evaluate(node => node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
  for (const control of await page.locator('[data-scrubbing]:visible').all()) {
    expect(await control.evaluate(node => node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
  }
  const spacing = await page.locator('[data-section="Spacing"] input:visible').evaluateAll(nodes => nodes.map(node => {
    const input=node as HTMLInputElement, style=getComputedStyle(input), canvas=document.createElement('canvas'), context=canvas.getContext('2d')!;
    context.font=style.font;
    return context.measureText(input.value).width <= input.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)+1;
  }));
  expect(spacing.every(Boolean)).toBe(true);
}
const styledFixture = fixture.replace('<html>','<html style="font-size:16px">').replace('id="collection"','id="collection" style="width:400px!important;padding:0;border:0"').replace('id="checkout"','id="checkout" style="width:200px;height:200px;box-sizing:border-box;font-size:32px;line-height:1.5;letter-spacing:1px;border-radius:16px;padding:16px;margin-left:16px;box-shadow:16px 8px 12px 0px #0004;text-shadow:2px 2px 4px #0004;background-image:linear-gradient(180deg,red 0%,blue 100%)"');

test('Phase 06.5.4 built Chrome units, preservation, transactions, six views, narrow and zoom', async ({},info) => {
  test.setTimeout(60000);
  const {page,context,worker,tabId,errors} = await setup(info,styledFixture);
  try {
    await mkdir(out,{recursive:true}); await page.setViewportSize({width:1440,height:1100}); await pick(page,'#checkout');
    const target = page.locator('#checkout');
    await section(page,''); await page.getByRole('tabpanel',{name:'Design',exact:true}).evaluate(node => node.scrollTop=0);
    await page.getByRole('button',{name:'Width unit',exact:true}).click();
    const widthMenu = page.getByRole('dialog',{name:'Width unit',exact:true});
    await expect(widthMenu.getByRole('button',{name:'%',exact:true})).toBeEnabled();
    await expect(widthMenu.getByRole('button',{name:'ch',exact:true})).toBeDisabled();
    await expect(widthMenu.getByRole('button',{name:'deg',exact:true})).toHaveCount(0); await capture(page,'01-width-unit-picker');
    await widthMenu.getByRole('button',{name:'%',exact:true}).click(); await expect(field(page,'Width')).toHaveValue('50'); await expect(target).toHaveCSS('width','200px');
    await action(page,'Undo last edit'); await expect(page.getByRole('button',{name:'Width unit',exact:true})).toHaveText('px');
    await convert(page,'Width','%'); await page.getByRole('tab',{name:'Code',exact:true}).click();
    await expect(page.locator('[data-owned=true][data-property=width]')).toContainText('50%'); await page.getByRole('tab',{name:'Design',exact:true}).click();
    await convert(page,'Width','vw'); expect(parseFloat(await target.evaluate(node => getComputedStyle(node).width))).toBeCloseTo(200,1);
    await convert(page,'Width','px'); await convert(page,'Geometry radius','%'); await expect(target).toHaveCSS('border-radius','8%');
    await page.getByRole('button',{name:'Height unit',exact:true}).click(); await expect(page.getByRole('dialog',{name:'Height unit',exact:true}).getByRole('button',{name:'%',exact:true})).toBeDisabled(); await page.keyboard.press('Escape');
    await section(page,'Typography'); await convert(page,'Font size','rem'); await expect(field(page,'Font size')).toHaveValue('2'); await expect(target).toHaveCSS('font-size','32px'); await capture(page,'02-font-size-rem');
    await field(page,'Font size').focus(); await field(page,'Font size').press('ArrowUp'); await expect(field(page,'Font size')).toHaveValue('2.1'); await expect(target).toHaveCSS('font-size','33.6px');
    await field(page,'Font size').press('Escape'); await expect(target).toHaveCSS('font-size','32px');
    const box = (await field(page,'Font size').boundingBox())!;
    await page.mouse.move(box.x+12,box.y+box.height/2); await page.mouse.down(); await page.mouse.move(box.x+22,box.y+box.height/2); await page.mouse.up();
    await expect(target).toHaveCSS('font-size','48px'); await field(page,'Font size').press('Escape'); await expect(target).toHaveCSS('font-size','32px');
    await convert(page,'Line height','px'); await expect(target).toHaveCSS('line-height','48px'); await convert(page,'Line height','unitless'); await expect(field(page,'Line height')).toHaveValue('1.5');
    await section(page,'Spacing'); await convert(page,'Padding top','em'); await expect(target).toHaveCSS('padding-top','16px'); await expect(field(page,'Padding top')).toHaveValue('0.5');
    await convert(page,'Margin left','rem'); await expect(target).toHaveCSS('margin-left','16px'); await capture(page,'03-spacing-non-px');
    await edit(page,'Margin left','2rem'); await expect(target).toHaveCSS('margin-left','32px');
    await section(page,'Box shadow'); await convert(page,'Box shadow x','rem'); await expect(field(page,'Box shadow x')).toHaveValue('1'); await expect(target).toHaveCSS('box-shadow',/16px 8px 12px 0px/); await capture(page,'04-shadow-rem');
    await section(page,'Text shadow'); await convert(page,'Text shadow blur','em'); await expect(target).toHaveCSS('text-shadow',/2px 2px 4px/);
    await section(page,'Background'); const gradientBefore = await target.evaluate(node => getComputedStyle(node).backgroundImage); await convert(page,'Gradient direction','turn'); await expect(field(page,'Gradient direction')).toHaveValue('0.5'); await expect(target).toHaveCSS('background-image',gradientBefore); await capture(page,'05-gradient-turn');
    await page.getByRole('button',{name:'Stop 1 position unit',exact:true}).click(); await expect(page.getByRole('dialog',{name:'Stop 1 position unit',exact:true}).getByRole('button',{name:'px',exact:true})).toBeEnabled(); await page.keyboard.press('Escape');
    // A nonzero gradient percentage has no proven length reference.
    await page.getByRole('button',{name:'Stop 2 position unit',exact:true}).click(); await expect(page.getByRole('dialog',{name:'Stop 2 position unit',exact:true}).getByRole('button',{name:'px',exact:true})).toBeDisabled(); await page.keyboard.press('Escape');
    await pick(page,'#headline'); await expect(page.getByRole('button',{name:'Width unit',exact:true})).toHaveText('px');
    await pick(page,'#checkout'); await section(page,'Typography'); await expect(page.getByRole('button',{name:'Font size unit',exact:true})).toHaveText('rem');
    await page.setViewportSize({width:390,height:844}); await fits(page); await capture(page,'06-narrow-viewport');
    for (const width of [320,390]) {
      await page.setViewportSize({width,height:844});
      for (const name of ['Typography','Spacing','Box shadow']) { await section(page,name); await fits(page); }
      await page.getByRole('button',{name:'Box shadow x unit',exact:true}).press('ArrowDown');
      const popup = page.getByRole('dialog',{name:'Box shadow x unit',exact:true}); const b=(await popup.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(8); expect(b.x+b.width).toBeLessThanOrEqual(width-8); await page.keyboard.press('Escape');
      await expect(page.getByRole('button',{name:'Box shadow x unit',exact:true})).toBeFocused();
    }
    await page.setViewportSize({width:1440,height:1000}); await worker.evaluate(id=>chrome.tabs.setZoom(id,2),tabId);
    await expect.poll(()=>worker.evaluate(id=>chrome.tabs.getZoom(id),tabId)).toBe(2);
    for (const name of ['Typography','Spacing','Box shadow']) { await section(page,name); await fits(page); }
    await action(page,'Reset session edits'); await expect(target).toHaveCSS('font-size','32px'); await expect(target).toHaveCSS('margin-left','16px'); await expect(target).toHaveCSS('border-radius','16px');
    await worker.evaluate(id=>chrome.tabs.setZoom(id,1),tabId);
    await target.evaluate(node => { const el=node as HTMLElement; el.style.width='2rem'; el.style.paddingTop='10%'; el.style.setProperty('--space','12px'); el.style.marginLeft='var(--space)'; el.style.letterSpacing='calc(1px + .1em)'; });
    await pick(page,'#checkout'); await expect(page.getByRole('button',{name:'Width unit',exact:true})).toHaveText('rem');
    await section(page,'Spacing'); await expect(page.getByRole('button',{name:'Padding top unit',exact:true})).toHaveText('%'); await expect(field(page,'Margin left')).toHaveValue('var(--space)');
    await field(page,'Margin left').press('ArrowUp'); await expect(field(page,'Margin left')).toHaveValue('var(--space)');
    await section(page,'Typography'); await expect(field(page,'Letter spacing')).toHaveValue(await target.evaluate(node => (node as HTMLElement).style.letterSpacing)); await expect(page.getByRole('button',{name:'Letter spacing unit',exact:true})).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('unit safety rejects ambiguous percentages and preserves raw manual CSS', async ({},info) => {
  const {page,context,errors} = await setup(info);
  try {
    await page.locator('#checkout').evaluate(node => { const el=node as HTMLElement; el.style.width='200px'; el.style.height='100px'; el.style.borderRadius='10px'; });
    await pick(page,'#checkout'); await section(page,'');
    const target=page.locator('#checkout');
    for (const name of ['Width','Height','Geometry radius']) {
      await page.getByRole('button',{name:`${name} unit`,exact:true}).click();
      await expect(page.getByRole('dialog',{name:`${name} unit`,exact:true}).getByRole('button',{name:'%',exact:true})).toBeDisabled();
      await page.keyboard.press('Escape');
    }
    await expect(target).toHaveCSS('width','200px'); await expect(target).toHaveCSS('border-radius','10px');
    await edit(page,'Width','50%'); await expect(page.getByRole('button',{name:'Width unit',exact:true})).toHaveText('%');
    await edit(page,'Width','calc(100% - 2rem)'); await expect(field(page,'Width')).toHaveValue('calc(100% - 2rem)');
    await field(page,'Width').press('ArrowUp'); await expect(field(page,'Width')).toHaveValue('calc(100% - 2rem)');
    await edit(page,'Width','auto'); await expect(field(page,'Width')).toHaveValue('auto');
    await action(page,'Reset session edits');
    // Opening a conversion menu must use fresh references after resize/host edits.
    await page.locator('#collection').evaluate(node => { const el=node as HTMLElement; el.style.setProperty('width','400px','important'); el.style.padding='0'; el.style.border='0'; });
    await page.locator('#collection').evaluate(node => (node as HTMLElement).style.columnCount='2');
    await page.getByRole('button',{name:'Width unit',exact:true}).click(); await expect(page.getByRole('dialog',{name:'Width unit',exact:true}).getByRole('button',{name:'%',exact:true})).toBeDisabled(); await page.keyboard.press('Escape');
    await page.locator('#collection').evaluate(node => (node as HTMLElement).style.columnCount='auto');
    await convert(page,'Width','%'); await expect(field(page,'Width')).toHaveValue('50');
    await page.locator('#collection').evaluate(node => (node as HTMLElement).style.setProperty('width','500px','important'));
    await convert(page,'Width','px'); await expect(field(page,'Width')).toHaveValue('250'); await expect(target).toHaveCSS('width','250px');
    await action(page,'Reset session edits');
    await target.evaluate(node => (node as HTMLElement).style.minWidth='300px');
    await page.getByRole('button',{name:'Width unit',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Width unit',exact:true}).getByRole('button',{name:'rem',exact:true})).toBeDisabled(); await page.keyboard.press('Escape');
    await expect(target).toHaveCSS('width','300px');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
