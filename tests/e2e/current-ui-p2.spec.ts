import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { setup, fixture, pick, dock, inspector, withinViewport } from './extensionHarness';
import { feedbackPaintComparison, feedbackRasterBounds } from './paintOrder';

const out = 'artifacts/diagnostics/current-ui-p2';
const html = fixture.replace('</style>', `
#checkout{position:relative;z-index:5;border:3px solid #789abc;box-shadow:1px 2px 3px #123456;text-shadow:1px 2px 3px #345678;background-image:linear-gradient(90deg,red 0%,green 50%,blue 100%)}
#leaf{position:absolute;left:0;top:0;width:4px;height:4px;overflow:hidden}
#mixed{border:5px solid;border-color:red green blue yellow}
#hint{background-image:linear-gradient(90deg,red 0% 20%,45%,blue 100%)}
</style>`).replace('id="checkout"', 'id="checkout" style="font-size:18px"').replace('Explore the collection</button>', '<span id="leaf">Explore the collection</span></button>').replace('</main>', '<section class="card" id="mixed">Mixed borders</section><section class="card" id="hint">Hint gradient</section></main>');
const button = (page:Page,name:string) => page.getByRole('button',{name,exact:true});
const field = (page:Page,name:string) => page.getByRole('textbox',{name,exact:true});
const css = async (page:Page,property:string,target='#checkout') => {
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
  return page.locator(target).evaluate((node,p)=>getComputedStyle(node).getPropertyValue(p),property);
};
async function section(page:Page,name:string) {
  for (const item of await page.locator('[data-section]').all()) {
    const title=(await item.getAttribute('data-section'))!;
    const toggle=item.getByRole('button',{name:title,exact:true});
    if(await toggle.getAttribute('aria-expanded')!==String(title===name)) await toggle.click();
  }
}
async function edit(page:Page,label:string,value:string) { await field(page,label).fill(value);await field(page,label).press('Enter'); }
async function session(page:Page,name:string) {
  await button(page,'Inspector menu').click();
  const option=page.getByRole('dialog',{name:'Inspector menu',exact:true}).getByRole('button',{name,exact:true});
  if(await option.isEnabled()) await option.click();
  await page.keyboard.press('Escape');
}
async function associated(input:Locator) {
  await expect(input).toHaveAttribute('aria-invalid','true');
  const description = await input.evaluate(node => {
    const id=node.getAttribute('aria-describedby') ?? node.getAttribute('aria-errormessage');
    return id ? (node.getRootNode() as ShadowRoot).getElementById(id)?.textContent : null;
  });
  expect(description).toMatch(/valid|unit|integer/i);
}
async function save(page:Page,name:string,observations:unknown) {
  await mkdir(out,{recursive:true});
  await writeFile(`${out}/${name}.json`,JSON.stringify({observations,chrome:await page.context().browser()!.version()},null,2));
  await page.screenshot({path:`${out}/${name}.png`,animations:'disabled',caret:'hide'});
}

for (const [title,label,property] of [
  ['Typography','Text color','color'],['Background','Background color','background-color'],['Border','Border color','border-color'],
  ['Box shadow','Box shadow color','box-shadow'],['Text shadow','Text shadow color','text-shadow'],['Background','Stop 1 color','background-image'],
]) test(`EFF-A-01 EFF-A-02 EFF-F-01 ${label}: cancellation, tokens, formats and alpha`,async({},info)=>{
  test.setTimeout(100000);
  const r=await setup(info,html), {page}=r;
  try {
    await pick(page,'#checkout');await section(page,title);
    const before=await css(page,property);
    await field(page,label).fill('#00ff00');expect(await css(page,property)).toContain('0, 255, 0');await field(page,label).press('Escape');
    expect(await css(page,property)).toBe(before);
    await button(page,'Inspector menu').click();
    await expect(page.getByRole('dialog',{name:'Inspector menu',exact:true}).getByRole('button',{name:'Undo last edit',exact:true})).toBeDisabled();
    await page.keyboard.press('Escape');
    await edit(page,label,'#123456');await session(page,'Undo last edit');expect(await css(page,property)).toBe(before);
    await button(page,`${label} picker`).click();
    const popup=page.getByRole('dialog',{name:`${label} picker`,exact:true});
    for (const [format,valid,expected] of [['HEX','#ab34cd80','171, 52, 205'],['RGB','rgba(20, 40, 60, .6)','20, 40, 60'],['HSL','hsla(120, 100%, 25%, .4)','0, 128, 0']]) {
      await popup.getByRole('button',{name:format,exact:true}).click();
      const input=field(page,`${label} ${format}`), unchanged=await css(page,property);
      await input.fill('11qu');await associated(input);expect(await css(page,property)).toBe(unchanged);
      await input.fill(valid);await expect(input).not.toHaveAttribute('aria-invalid','true');
      expect(await css(page,property)).toContain(expected);
      await input.press('Enter');
    }
    const alpha=field(page,`${label} alpha`), alphaBefore=await css(page,property);
    await alpha.fill('25%');expect(await css(page,property)).toContain('0.25');await alpha.press('Escape');expect(await css(page,property)).toBe(alphaBefore);
    await edit(page,`${label} alpha`,'50%');expect(await css(page,property)).toContain('0.5');
    // A committed field must not be undone by merely closing its picker.
    await popup.getByRole('button',{name:'HEX',exact:true}).click();await page.keyboard.press('Escape');
    expect(await css(page,property)).toContain('0.5');
    await button(page,`${label} picker`).click();const popupBefore=await css(page,property);
    await field(page,`${label} HEX`).fill('#ff0000');await field(page,`${label} HEX`).press('Escape');expect(await css(page,property)).toBe(popupBefore);
    await edit(page,label,'currentColor');await expect(field(page,label)).toHaveValue('currentColor');
    const tokenBefore=await css(page,property);
    await button(page,`${label} picker`).click();await expect(field(page,`${label} alpha`)).toBeDisabled();
    await expect(popup.getByRole('slider')).toHaveCount(0);await expect(popup).toContainText('Spectrum, hue and alpha are unavailable');
    expect(await css(page,property)).toBe(tokenBefore);await expect(field(page,`${label} HEX`)).toHaveValue('currentColor');
    await field(page,`${label} HEX`).fill('#123456');await field(page,`${label} HEX`).press('Enter');
    await expect(field(page,`${label} alpha`)).toBeEnabled();await expect(popup.getByRole('slider')).toHaveCount(3);
    await popup.getByRole('slider').nth(1).focus();await page.keyboard.press('ArrowRight');expect(await css(page,property)).not.toBe(tokenBefore);
    await page.keyboard.press('Escape');
    await button(page,`${label} picker`).click();const recentBefore=await css(page,property);
    await popup.getByRole('button',{name:/^Use #/}).first().click();await page.keyboard.press('Escape');expect(await css(page,property)).toBe(recentBefore);
    await save(page,label.replaceAll(' ','-').toLowerCase(),{colorEscapeRestores:true,noDuplicateUndo:true,formats:['HEX','RGB','HSL'],invalidAssociated:true,alpha:true,unresolvedTokenPreserved:true});
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('EFF-B-01 interpolation hint is preserved without fake stops; ordinary gradient Undo/Reset',async({},info)=>{
  const r=await setup(info,html),{page}=r;
  try {
    await pick(page,'#hint');await section(page,'Background');const before=await css(page,'background-image','#hint');
    await expect(page.getByRole('tabpanel',{name:'Design'})).toContainText('including interpolation hints, have no stop editor');
    await expect(field(page,'Stop 1 color')).toHaveCount(0);expect(await css(page,'background-image','#hint')).toBe(before);
    await edit(page,'Background position','20% 30%');expect(await css(page,'background-image','#hint')).toBe(before);
    await session(page,'Undo last edit');expect(await css(page,'background-image','#hint')).toBe(before);
    await session(page,'Reset session edits');expect(await css(page,'background-image','#hint')).toBe(before);
    await pick(page,'#checkout');const normal=await css(page,'background-image');
    await expect(field(page,'Stop 3 color')).toBeVisible();await edit(page,'Stop 2 color','#123456');expect(await css(page,'background-image')).toContain('18, 52, 86');
    await session(page,'Undo last edit');expect(await css(page,'background-image')).toBe(normal);
    await edit(page,'Stop 2 position','60%');await session(page,'Reset session edits');expect(await css(page,'background-image')).toBe(normal);
    await save(page,'gradient',{hintBefore:before,hintPreserved:true,normalUndoReset:true});expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('EFF-B-02 four mixed border colors, replace all, Escape and Undo',async({},info)=>{
  const r=await setup(info,html),{page}=r;
  try {
    await pick(page,'#mixed');await section(page,'Border');const before=await css(page,'border-color','#mixed');
    await expect(field(page,'Border color')).toHaveAttribute('placeholder','Mixed');await expect(field(page,'Border color')).toHaveValue('');
    await button(page,'Border color picker').click();const popup=page.getByRole('dialog',{name:'Border color picker',exact:true});
    await expect(popup).toContainText('Choosing one color replaces all four sides');await expect(popup.getByRole('slider')).toHaveCount(0);await page.keyboard.press('Escape');
    await field(page,'Border color').fill('#abcdef');await field(page,'Border color').press('Escape');expect(await css(page,'border-color','#mixed')).toBe(before);
    await edit(page,'Border color','#abcdef');await expect(page.locator('#mixed')).toHaveCSS('border-color','rgb(171, 205, 239)');
    await session(page,'Undo last edit');expect(await css(page,'border-color','#mixed')).toBe(before);
    await save(page,'mixed-border',{before,afterUndo:await css(page,'border-color','#mixed')});expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('CA61 CA62 Code Escape, Apply/Cancel focus and Tab continuation including replaced rows',async({},info)=>{
  const r=await setup(info,html),{page}=r;
  try {
    await pick(page,'#checkout');await page.getByRole('tab',{name:'Code',exact:true}).click();
    const inline=page.getByRole('region',{name:'Inline authored CSS',exact:true}), own=page.getByRole('region',{name:'CSSForge overrides',exact:true});
    await inline.getByRole('button',{name:'Edit font-size',exact:true}).click();await field(page,'CSS value font-size').fill('25px');await field(page,'CSS value font-size').press('Enter');
    await expect(inline.getByRole('button',{name:'Edit font-size',exact:true})).toBeFocused();await expect(page.locator('#checkout')).toHaveCSS('font-size','25px');
    await page.keyboard.press('Tab');expect(await inline.evaluate(node=>node.contains((node.getRootNode() as ShadowRoot).activeElement))).toBe(false);
    const value=own.getByRole('button',{name:'Edit font-size',exact:true});
    await value.click();await field(page,'CSS value font-size').fill('33px');await field(page,'CSS value font-size').press('Escape');
    await expect(value).toBeFocused();await expect(page.locator('#checkout')).toHaveCSS('font-size','25px');await expect(field(page,'CSS value font-size')).toHaveCount(0);
    await value.click();await field(page,'CSS value font-size').fill('34px');await own.getByRole('button',{name:'Cancel',exact:true}).click();await expect(value).toBeFocused();
    await expect(page.locator('#checkout')).toHaveCSS('font-size','25px');
    await value.click();await field(page,'CSS value font-size').fill('30px');await field(page,'CSS value font-size').press('Enter');await expect(value).toBeFocused();
    await page.keyboard.press('Tab');await expect(own.getByRole('button',{name:'Add session declaration',exact:true})).toBeFocused();
    await save(page,'code-focus',{escape:true,cancel:true,apply:true,tabContinuation:true,remountedOverride:true});expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

for(const surface of ['HTML','Navigator']) test(`CA63 ${surface} complete tree keys and roving tabindex`,async({},info)=>{
  const r=await setup(info,html),{page}=r;
  try {
    await pick(page,'#checkout');if(surface==='HTML')await page.getByRole('tab',{name:'HTML',exact:true}).click();else await dock(page).getByRole('button',{name:'Open Navigator',exact:true}).click();
    const tree=page.getByRole('tree',{name:'Page DOM tree',exact:true});
    const parent=tree.getByRole('treeitem',{name:'button#checkout.primary',exact:true}), child=tree.getByRole('treeitem',{name:'span#leaf',exact:true});
    await parent.focus();if(await parent.getAttribute('aria-expanded')==='true')await parent.press('ArrowLeft');
    await expect(parent).toHaveAttribute('aria-expanded','false');await parent.press('ArrowRight');await expect(parent).toHaveAttribute('aria-expanded','true');await expect(parent).toBeFocused();
    await parent.press('ArrowRight');await expect(child).toBeFocused();await expect(child).toHaveAttribute('tabindex','0');await expect(parent).toHaveAttribute('tabindex','-1');
    await child.press('ArrowLeft');await expect(parent).toBeFocused();await parent.press('ArrowLeft');await expect(parent).toHaveAttribute('aria-expanded','false');
    await parent.press('ArrowLeft');await expect(tree.getByRole('treeitem',{name:'section#collection.card',exact:true})).toBeFocused();
    await page.keyboard.press('Home');await expect(tree.getByRole('treeitem').first()).toBeFocused();await page.keyboard.press('ArrowDown');await expect(tree.getByRole('treeitem').nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');await expect(tree.getByRole('treeitem').first()).toBeFocused();await page.keyboard.press('End');await expect(tree.getByRole('treeitem').last()).toBeFocused();
    await page.keyboard.press('Enter');await expect(tree.getByRole('treeitem',{selected:true})).toBeFocused();
    await expect(tree.locator('[role=treeitem][tabindex="0"]')).toHaveCount(1);
    await save(page,`tree-${surface.toLowerCase()}`,{keys:true,selection:true,roving:true});expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('DA02 DA03 integer modifiers, local unsupported-unit errors and decimal controls',async({},info)=>{
  const r=await setup(info,html),{page}=r;
  try {
    await pick(page,'#checkout');await section(page,'Positioning');const z=field(page,'Z-index');await z.focus();
    for(const [key,value] of [['Alt+ArrowDown','4'],['Alt+ArrowUp','5'],['Shift+ArrowUp','15'],['Shift+ArrowDown','5']]) {await z.press(key);await expect(z).toHaveValue(value);await expect(z).not.toHaveAttribute('aria-invalid','true');}
    await z.press('Escape');await expect(z).toHaveValue('5');
    await section(page,'Typography');await field(page,'Font size').focus();await field(page,'Font size').press('Alt+ArrowUp');await expect(field(page,'Font size')).toHaveValue('18.1');await field(page,'Font size').press('Escape');
    await section(page,'');const before=await css(page,'width');await field(page,'Width').fill('11qu');await associated(field(page,'Width'));expect(await css(page,'width')).toBe(before);
    await save(page,'numeric-invalid',{zIndexInteger:true,decimalPreserved:true,localErrorAssociated:true,cssUnchanged:true});
    await field(page,'Width').press('Escape');await expect(field(page,'Width')).not.toHaveAttribute('aria-invalid','true');expect(await css(page,'width')).toBe(before);
    await field(page,'Width').fill('-5px');await associated(field(page,'Width'));await expect(page.getByRole('alert')).toHaveCount(1);expect(await css(page,'width')).toBe(before);
    await field(page,'Width').fill('60px');await field(page,'Width').press('Escape');expect(await css(page,'width')).toBe(before);
    expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('J04 Changes reports real count, limitations, Undo/Reset and restores modal focus',async({},info)=>{
  const r=await setup(info,html),{page}=r;
  try {
    await pick(page,'#checkout');await edit(page,'Font size','24px');
    const opener=dock(page).getByRole('button',{name:'Open Changes',exact:true});await opener.click();
    const dialog=page.getByRole('dialog',{name:'Changes',exact:true});await expect(dialog).toContainText('1 edited elements');
    await expect(dialog).toContainText('Detailed review and export are unavailable');await expect(dialog.getByRole('button',{name:/Export/})).toHaveCount(0);
    await dialog.getByRole('button',{name:'Undo last edit',exact:true}).click();await expect(dialog).toContainText('0 edited elements');await expect(page.locator('#checkout')).toHaveCSS('font-size','18px');
    await page.keyboard.press('Escape');await expect(opener).toBeFocused();await edit(page,'Font size','28px');await opener.click();
    await dialog.getByRole('button',{name:'Reset session edits',exact:true}).click();await expect(dialog).toContainText('0 edited elements');await expect(page.locator('#checkout')).toHaveCSS('font-size','18px');
    await save(page,'changes',{realCount:true,undoReset:true,limitationWording:true});await page.keyboard.press('Escape');await expect(opener).toBeFocused();expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('P2 narrow viewport and actual Chrome 200% zoom with accessible validation',async({},info)=>{
  const r=await setup(info,html),{page}=r;
  try {
    await pick(page,'#checkout');await section(page,'Typography');
    for(const [width,zoom] of [[320,1],[1440,2]]) {
      await page.setViewportSize({width,height:1000});await r.worker.evaluate(async({id,zoom})=>(globalThis as any).chrome.tabs.setZoom(id,zoom),{id:r.tabId,zoom});
      expect(await r.worker.evaluate(async id=>(globalThis as any).chrome.tabs.getZoom(id),r.tabId)).toBe(zoom);await withinViewport(page);
      await button(page,'Text color picker').click();const popup=page.getByRole('dialog',{name:'Text color picker',exact:true});
      await field(page,'Text color HEX').fill('invalid');await associated(field(page,'Text color HEX'));
      expect(await popup.evaluate(node=>{const r=node.getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&node.scrollWidth<=node.clientWidth+1;})).toBe(true);
      await save(page,zoom===2?'zoom-200':'narrow-320',{zoom,width,invalidAssociated:true,fits:true});await page.keyboard.press('Escape');
    }
    expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('P1 opaque UI still covers feedback with bounded Chrome raster noise',async({},info)=>{
  test.setTimeout(60000);
  const r=await setup(info),{page}=r, comparisons:unknown[]=[];
  const compare = async(control:Locator,name:string) => {comparisons.push(await feedbackPaintComparison(page,control,info,name));};
  try {
    await pick(page,'#checkout');await compare(inspector(page),'inspector');await compare(dock(page).getByRole('button',{name:'Open Changes',exact:true}),'dock');
    await button(page,'Text color picker').click();await compare(page.getByRole('dialog',{name:'Text color picker',exact:true}),'color-popup');await page.keyboard.press('Escape');
    await section(page,'Spacing');await edit(page,'Margin top','16px');await button(page,'Margin top unit').click();await compare(page.getByRole('dialog',{name:'Margin top unit',exact:true}),'spacing-units');await page.keyboard.press('Escape');
    for(const name of ['Changes','Navigator']){await dock(page).getByRole('button',{name:`Open ${name}`,exact:true}).click();await compare(page.getByRole('dialog',{name,exact:true}),name);await page.keyboard.press('Escape');}
    await page.evaluate(()=>{const cover=document.createElement('div');Object.assign(cover.style,{position:'fixed',inset:'0',zIndex:'2147483647',background:'#ff000022'});document.body.append(cover);});await compare(inspector(page),'hostile-inspector');
    await save(page,'p1-feedback-order',{comparisons,maximumAllowedChannelDifference:feedbackRasterBounds.maximumChannelDifference,maximumChangedPixelRatio:feedbackRasterBounds.maximumChangedPixelRatio});expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
