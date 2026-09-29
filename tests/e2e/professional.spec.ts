import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { browser } from 'wxt/browser';
import { setup, pick, dock, withinViewport } from './extensionHarness';
declare const chrome: typeof browser;
const field = (page: Page, label: string) => page.getByRole('textbox', { name:label, exact:true });
async function input(page: Page, label: string, value: string) { await field(page,label).fill(value); await field(page,label).press('Enter'); }
async function action(page: Page, label: string) { await page.getByRole('button', { name:'Inspector menu', exact:true }).click(); await page.getByRole('dialog', { name:'Inspector menu', exact:true }).getByRole('button', { name:label, exact:true }).click(); await page.keyboard.press('Escape'); }
async function choice(page: Page, label: string, value: string) { await page.getByRole('button', { name:label, exact:true }).click(); await page.getByRole('dialog', { name:label, exact:true }).getByRole('button', { name:value, exact:true }).click(); }
async function sections(page: Page, opened: string[]) { for (const name of ['Spacing','Typography','Background','Display','Border','Positioning','Box shadow','Text shadow','Filters']) { const header = page.locator(`[data-section="${name}"]`).getByRole('button', { name, exact:true }); if (await header.getAttribute('aria-expanded') !== String(opened.includes(name))) await header.click(); } }
async function shot(page: Page, name: string, section?: string) { await mkdir('artifacts/screenshots/phase-06.5', { recursive:true }); if (section) await page.locator(`[data-section="${section}"]`).evaluate(node => node.scrollIntoView({ block:'start' })); await page.screenshot({ path:`artifacts/screenshots/phase-06.5/${name}.png`, animations:'disabled' }); }

test('NumericScrubber inputs, unit preservation, step modifiers, drag, Escape and transaction isolation', async ({}, info) => {
  const { page,context,errors } = await setup(info);
  try {
    await pick(page,'#checkout'); const target=page.locator('#checkout'); const size=field(page,'Font size');
    await input(page,'Font size','20'); await expect(target).toHaveCSS('font-size','20px');
    await size.focus(); await size.press('ArrowUp'); await expect(target).toHaveCSS('font-size','21px');
    await size.press('Shift+ArrowUp'); await expect(target).toHaveCSS('font-size','31px');
    await size.press('Alt+ArrowDown'); await expect(target).toHaveCSS('font-size','30.9px');
    await size.press('Escape'); await expect(target).toHaveCSS('font-size','20px');
    await size.focus(); await size.press('ArrowDown'); await size.press('Enter'); await expect(target).toHaveCSS('font-size','19px');
    await action(page,'Undo last edit'); await expect(target).toHaveCSS('font-size','20px');
    await input(page,'Padding left','2em'); await field(page,'Padding left').focus(); await field(page,'Padding left').press('ArrowUp'); await field(page,'Padding left').press('Enter'); await expect(target).toHaveCSS('padding-left','60px');
    await expect(field(page,'Padding left')).toHaveValue('3em');
    await size.scrollIntoViewIfNeeded(); const box=(await size.boundingBox())!; await page.mouse.move(box.x+8,box.y+box.height/2); await page.mouse.down(); await page.mouse.move(box.x+18,box.y+box.height/2,{steps:3}); await page.mouse.up(); await size.press('Enter'); await expect(target).toHaveCSS('font-size','30px');
    await action(page,'Undo last edit'); await expect(target).toHaveCSS('font-size','20px');
    await choice(page,'Position','relative'); await input(page,'Position top','4'); await input(page,'Z-index','2'); await expect(target).toHaveCSS('top','4px');
    await choice(page,'Position','static'); await expect(field(page,'Position top')).toHaveCount(0);
    await choice(page,'Text decoration','underline'); await choice(page,'Text transform','uppercase'); await expect(target).toHaveCSS('text-transform','uppercase');
    await pick(page,'#headline'); await expect(page.locator('#headline')).toHaveCSS('font-size','28px'); await action(page,'Reset session edits'); await expect(target).toHaveCSS('font-size','18px'); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('shared color controls validate, edit HEX RGB HSL alpha and restore popover focus', async ({}, info) => {
  const { page,context,errors } = await setup(info);
  try {
    await pick(page,'#checkout'); const target=page.locator('#checkout');
    await input(page,'Text color','#123456'); await expect(target).toHaveCSS('color','rgb(18, 52, 86)');
    await field(page,'Text color').fill('not-a-color'); await expect(field(page,'Text color')).toHaveAttribute('aria-invalid','true'); await expect(target).toHaveCSS('color','rgb(18, 52, 86)');
    await input(page,'Text color','#ff0000'); await page.getByRole('button',{name:'Text color picker',exact:true}).click();
    const popup=page.getByRole('dialog',{name:'Text color picker',exact:true});
    await input(page,'Text color alpha','50%'); await expect(target).toHaveCSS('color','rgba(255, 0, 0, 0.5)');
    await popup.getByRole('button',{name:'RGB',exact:true}).click(); await input(page,'Text color RGB','rgba(0, 128, 255, 0.5)'); await expect(target).toHaveCSS('color','rgba(0, 128, 255, 0.5)');
    await popup.getByRole('button',{name:'HSL',exact:true}).click(); await input(page,'Text color HSL','hsl(120 100% 50% / 25%)'); await expect(target).toHaveCSS('color','rgba(0, 255, 0, 0.25)');
    await popup.getByRole('button',{name:'HEX',exact:true}).focus(); await page.keyboard.press('Escape'); await expect(popup).toHaveCount(0); await expect(page.getByRole('button',{name:'Text color picker',exact:true})).toBeFocused();
    await action(page,'Reset session edits'); await expect(target).toHaveCSS('color','rgb(255, 255, 255)'); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('curated background, shadow layers and filter controls use real reversible CSS', async ({}, info) => {
  const {page,context,errors}=await setup(info);
  try {
    await pick(page,'#checkout'); const target=page.locator('#checkout');
    await page.locator('[data-section="Background"] summary').click(); await page.getByRole('button',{name:'Background preset Tidal',exact:true}).click(); await expect(target).toHaveCSS('background-image',/linear-gradient/); await page.locator('[data-section="Background"] summary').click();
    await page.getByRole('button',{name:'Add gradient stop',exact:true}).click(); await input(page,'Stop 3 color','#ff000080'); await input(page,'Stop 3 position','70%'); await expect(target).toHaveCSS('background-image',/rgba\(255, 0, 0/);
    await page.getByRole('button',{name:'Distribute stops',exact:true}).click(); await expect(field(page,'Stop 2 position')).toHaveValue('50');
    await page.getByRole('button',{name:'Reverse gradient',exact:true}).click(); await page.getByRole('button',{name:'Remove gradient stop 3',exact:true}).click();
    await page.getByRole('button',{name:'Add background layer',exact:true}).click(); await page.getByRole('button',{name:'Move background layer 2 up',exact:true}).click(); await page.getByRole('button',{name:'Hide background layer 1',exact:true}).click(); await page.getByRole('button',{name:'Show background layer 1',exact:true}).click(); await page.getByRole('button',{name:'Select background layer 2',exact:true}).click(); await page.getByRole('button',{name:'Remove background layer 1',exact:true}).click();
    await page.locator('[data-section="Box shadow"] summary').click(); await page.getByRole('button',{name:'Box shadow preset Elevated',exact:true}).click(); await page.locator('[data-section="Box shadow"] summary').click(); await page.getByRole('button',{name:'Add box shadow',exact:true}).click();
    await input(page,'Box shadow x','8px'); await input(page,'Box shadow color','#aa3344'); await page.getByRole('button',{name:'Move box shadow 2 up',exact:true}).click(); await expect(target).toHaveCSS('box-shadow',/^rgb\(170, 51, 68\) 8px/);
    await page.getByRole('button',{name:'Hide box shadow 1',exact:true}).click(); await expect(target).toHaveCSS('box-shadow',/^rgba\(0, 0, 0, 0\)/); await page.getByRole('button',{name:'Show box shadow 1',exact:true}).click(); await page.getByRole('button',{name:'Remove box shadow 2',exact:true}).click();
    await page.locator('[data-section="Text shadow"] summary').click(); await page.getByRole('button',{name:'Text shadow preset Glow',exact:true}).click(); await page.locator('[data-section="Text shadow"] summary').click(); await input(page,'Text shadow blur','8px'); await expect(target).toHaveCSS('text-shadow',/8px/);
    await input(page,'Hue rotate value','90deg'); await input(page,'Contrast value','130%'); await input(page,'Blur value','2px'); await expect(target).toHaveCSS('filter','hue-rotate(90deg) contrast(1.3) blur(2px)');
    await page.getByRole('button',{name:'Reset filters',exact:true}).click(); await expect(target).toHaveCSS('filter','none'); await action(page,'Undo last edit'); await expect(target).toHaveCSS('filter',/hue-rotate\(90deg\)/); await action(page,'Reset session edits'); await expect(target).toHaveCSS('box-shadow','none'); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('Phase 06.5 thirteen focused views, coherent tokens/icons, narrow viewport and 200% zoom', async ({},info) => {
  const {page,context,worker,tabId,errors}=await setup(info);
  try {
    await page.setViewportSize({width:1440,height:1100}); await pick(page,'#checkout');
    const tokens=await page.getByTestId('live-design').evaluate(node => { const style=getComputedStyle(node); return { ui:style.getPropertyValue('--font-ui'), code:style.getPropertyValue('--font-code') }; }); expect(tokens.ui).toContain('Geist Sans'); expect(tokens.code).toContain('Geist Mono');
    const icons=await dock(page).locator('svg').evaluateAll(nodes => nodes.map(node => ({box:node.getAttribute('viewBox'),stroke:node.getAttribute('stroke-width')}))); expect(icons.every(icon => icon.box==='0 0 24 24'&&icon.stroke==='1.75')).toBe(true);
    await sections(page,[]); await page.getByRole('tabpanel',{name:'Design',exact:true}).evaluate(node=>node.scrollTop=0); await shot(page,'01-collapsed-sections');
    await sections(page,['Typography']); await shot(page,'02-typography','Typography');
    await page.getByRole('button',{name:'Text color picker',exact:true}).click(); await shot(page,'03-color-control'); await page.keyboard.press('Escape');
    await sections(page,['Background']); await page.getByRole('button',{name:'Add background layer',exact:true}).click(); await page.getByRole('button',{name:'Add background layer',exact:true}).click(); await shot(page,'04-background-layers','Background');
    await page.getByRole('button',{name:'Add gradient stop',exact:true}).click(); await input(page,'Stop 2 color','#b898ed'); await page.getByRole('button',{name:'Distribute stops',exact:true}).click(); await shot(page,'05-gradient-editor','Background');
    await sections(page,['Box shadow']); await page.locator('[data-section="Box shadow"] summary').click(); await shot(page,'06-box-shadow-presets','Box shadow'); await page.getByRole('button',{name:'Box shadow preset Elevated',exact:true}).click(); await page.locator('[data-section="Box shadow"] summary').click(); await page.getByRole('button',{name:'Add box shadow',exact:true}).click(); await shot(page,'07-box-shadow-editor','Box shadow');
    await sections(page,['Text shadow']); await page.locator('[data-section="Text shadow"] summary').click(); await page.getByRole('button',{name:'Text shadow preset Soft',exact:true}).click(); await page.locator('[data-section="Text shadow"] summary').click(); await shot(page,'08-text-shadow-editor','Text shadow');
    await sections(page,['Filters']); await input(page,'Contrast value','130%'); await input(page,'Hue rotate value','15deg'); await shot(page,'09-filters','Filters');
    await page.getByRole('tab',{name:'Code',exact:true}).click(); await shot(page,'10-code');
    await page.getByRole('button',{name:'Open Navigator',exact:true}).first().click(); await shot(page,'11-navigator'); await page.keyboard.press('Escape');
    await dock(page).screenshot({path:'artifacts/screenshots/phase-06.5/12-bottom-dock.png'});
    await page.getByRole('tab',{name:'Design',exact:true}).click(); await sections(page,['Typography']); await page.setViewportSize({width:390,height:844}); await withinViewport(page); await shot(page,'13-narrow-viewport','Typography');
    await page.getByRole('button',{name:'Text color picker',exact:true}).click(); const popup=page.getByRole('dialog',{name:'Text color picker',exact:true}); const b=(await popup.boundingBox())!; expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x+b.width).toBeLessThanOrEqual(390); await page.keyboard.press('Escape');
    await page.setViewportSize({width:1440,height:1000}); await worker.evaluate(id=>chrome.tabs.setZoom(id,2),tabId); await expect.poll(()=>worker.evaluate(id=>chrome.tabs.getZoom(id),tabId)).toBe(2); await withinViewport(page); await input(page,'Font size','20'); await expect(page.locator('#checkout')).toHaveCSS('font-size','20px'); expect(errors).toEqual([]);
  } finally { await context.close(); }
});
