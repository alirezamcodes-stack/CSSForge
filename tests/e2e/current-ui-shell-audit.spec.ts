import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import type { browser } from 'wxt/browser';
import { setup, fixture, pick, dock, inspector, identity, outline } from './extensionHarness';
declare const chrome: typeof browser;
const directory='artifacts/diagnostics/current-ui-p1/audit/shell';
const selectionFixture=(await readFile('tests/e2e/fixtures/selection-audit.html','utf8')).replace('<cssforge-ui></cssforge-ui>','');
async function save(info:TestInfo,actual:unknown) {
  await mkdir(directory,{recursive:true});const path=`${directory}/${info.title.split(' ')[0]}.json`;
  await writeFile(path,JSON.stringify({case:info.title,actual},null,2));await info.attach('current-ui-audit',{path,contentType:'application/json'});
}
async function shot(page:Page,name:string) {await mkdir(directory,{recursive:true});await page.mouse.move(0,0);await page.screenshot({path:`${directory}/${name}.png`,animations:'disabled'});}
async function selected(page:Page) {return identity(page).textContent();}
async function bounds(page:Page) {
  const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
  const panel=await inspector(page).boundingBox(),tools=await dock(page).boundingBox();
  const within=(b:typeof panel)=>!!b&&b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1;
  return {viewport,panel,tools,panelWithin:within(panel),dockWithin:within(tools),overlap:!!panel&&!!tools&&panel.y+panel.height>tools.y};
}
async function edit(page:Page,label:string,value:string) {const input=page.getByRole('textbox',{name:label,exact:true});await input.fill(value);await input.press('Enter');}
async function menuAction(page:Page,label:string) {
  await page.getByRole('button',{name:'Inspector menu',exact:true}).click();
  await page.getByRole('dialog',{name:'Inspector menu',exact:true}).getByRole('button',{name:label,exact:true}).click();await page.keyboard.press('Escape');
}

test('SH01 built picker target geometry and lifecycle matrix',async({},info)=>{
  test.setTimeout(90000);const r=await setup(info,selectionFixture,async page=>{
    await page.route('http://frames.test/selection-audit-frame.html',route=>route.fulfill({contentType:'text/html',body:'<button>Frame</button>'}));
  });const rows:any[]=[];
  try {
    for(const selector of ['#nested-path','#transparent','#pointer-button','#absolute','#fixed','#transformed','#sticky','#clipped-child','#tiny','#svg-rect','#shadow-button','#nested-shadow','#slotted']) {
      try {
        await pick(r.page,selector);const target=await r.page.locator(selector).boundingBox();
        await expect(outline(r.page)).toBeVisible();const highlight=await outline(r.page).boundingBox();
        const difference=target&&highlight?Math.max(...(['x','y','width','height'] as const).map(k=>Math.abs(target[k]-highlight[k]))):null;
        rows.push({selector,selected:await selected(r.page),target,highlight,difference});
      }catch(error){rows.push({selector,error:String(error),selected:await selected(r.page)});await r.page.keyboard.press('Escape');}
    }
    await pick(r.page,'#zero-host');await r.page.getByRole('button',{name:'Select child',exact:true}).click();
    rows.push({case:'zero-size through child navigation',selected:await selected(r.page),highlightVisible:await outline(r.page).isVisible()});
    await dock(r.page).getByRole('button',{name:'Pick page element',exact:true}).click();
    await r.page.locator('#same-frame').click({position:{x:2,y:2}});rows.push({case:'iframe border selection',selected:await selected(r.page)});await r.page.keyboard.press('Escape');
    await pick(r.page,'#dynamic');await edit(r.page,'Font size','27px');
    await r.page.locator('#dynamic').evaluate(node=>node.outerHTML='<div id="dynamic" class="box" style="font-size:18px">Re-rendered</div>');
    await expect(r.page.locator('#dynamic')).toHaveCSS('font-size','27px');
    rows.push({case:'SPA replacement with session edit',selected:await selected(r.page),font:await r.page.locator('#dynamic').evaluate(node=>getComputedStyle(node).fontSize)});
    await r.page.locator('#dynamic').evaluate(node=>node.remove());await expect(identity(r.page)).toContainText('No element');
    rows.push({case:'removal',selected:await selected(r.page),highlightVisible:await outline(r.page).isVisible()});
    await shot(r.page,'01-picker-loss');await save(info,{rows,errors:r.errors});
  }finally{await r.context.close();}
});

test('SH02 built inspector drag clamp focus scroll Escape and resize',async({},info)=>{
  const r=await setup(info);const rows:any[]=[];
  try {
    await pick(r.page,'#checkout');const handle=r.page.getByRole('group',{name:'Move inspector',exact:true});
    const initial=await inspector(r.page).boundingBox();await handle.focus();await handle.press('ArrowLeft');rows.push({case:'keyboard move',initial,after:await inspector(r.page).boundingBox()});await handle.press('Home');
    for(const [x,y]of [[20,20],[1435,20],[1435,895],[20,895]]){
      const b=(await handle.boundingBox())!;await r.page.mouse.move(b.x+50,b.y+18);await r.page.mouse.down();await r.page.mouse.move(x,y,{steps:8});await r.page.mouse.up();rows.push({case:'drag',x,y,...await bounds(r.page)});
    }
    await handle.focus();await handle.press('Home');const beforeCancel=await inspector(r.page).boundingBox();
    const b=(await handle.boundingBox())!;await r.page.mouse.move(b.x+50,b.y+18);await r.page.mouse.down();await r.page.mouse.move(400,200);await r.page.keyboard.press('Escape');await r.page.mouse.up();rows.push({case:'cancel drag',beforeCancel,after:await inspector(r.page).boundingBox()});
    await r.page.getByRole('button',{name:'Hide inspector',exact:true}).click();rows.push({case:'header close',hidden:!await inspector(r.page).isVisible()});
    await dock(r.page).getByRole('button',{name:'Show inspector panel',exact:true}).click();
    for(const [width,height] of [[390,844],[320,450],[390,280],[1440,900]]) {
      await r.page.setViewportSize({width,height});rows.push({case:'resize',...await bounds(r.page)});
      if(height>400){await r.page.getByRole('slider',{name:'Sepia',exact:true}).scrollIntoViewIfNeeded();rows.push({case:'last field reachable',width,height,inViewport:await r.page.getByRole('slider',{name:'Sepia',exact:true}).isVisible()});}
    }
    await r.page.getByRole('button',{name:'Font family',exact:true}).click();await r.page.keyboard.press('Escape');
    rows.push({case:'Escape closes popover not inspector',dialogCount:await r.page.getByRole('dialog').count(),inspectorVisible:await inspector(r.page).isVisible(),focusReturned:await r.page.getByRole('button',{name:'Font family',exact:true}).evaluate(node=>node===(node.getRootNode() as ShadowRoot).activeElement)});
    await shot(r.page,'02-inspector-normal');await save(info,{rows,errors:r.errors});
  }finally{await r.context.close();}
});

test('SH03 every visible live dock action tooltip state keyboard and repeated click',async({},info)=>{
  const r=await setup(info);const rows:any[]=[];
  try {
    await pick(r.page,'#checkout');
    rows.push({case:'inventory',buttons:await dock(r.page).getByRole('button').evaluateAll(nodes=>nodes.map(node=>({label:node.getAttribute('aria-label'),disabled:(node as HTMLButtonElement).disabled,pressed:node.getAttribute('aria-pressed')})))});
    for(const name of ['Background tools','Color tools','Eyedropper information']) await expect(dock(r.page).getByRole('button',{name,exact:true})).toHaveCount(0);
    await expect(dock(r.page).getByRole('button')).toHaveCount(7);
    for(const name of ['Measurement tools','More tools']) {
      const trigger=dock(r.page).getByRole('button',{name,exact:true});await trigger.focus();
      await expect(r.page.getByRole('tooltip',{name,exact:true})).toBeVisible();
      await trigger.press('Enter');const popup=r.page.getByRole('dialog',{name,exact:true});await expect(popup).toBeVisible();
      rows.push({name,text:await popup.innerText(),active:await trigger.getAttribute('data-active'),expanded:await trigger.getAttribute('aria-expanded'),buttons:await popup.getByRole('button').allTextContents()});
      await trigger.click();rows.push({name,case:'repeat click closes',closed:!await popup.isVisible()});await r.page.keyboard.press('Escape');
    }
    await dock(r.page).getByRole('button',{name:'Hide inspector panel',exact:true}).press('Enter');
    rows.push({case:'hide inspector',hidden:!await inspector(r.page).isVisible()});await dock(r.page).getByRole('button',{name:'Show inspector panel',exact:true}).press('Enter');
    await dock(r.page).getByRole('button',{name:'Pick page element',exact:true}).click();rows.push({case:'pick enabled',active:await dock(r.page).getByRole('button',{name:'Cancel element picking',exact:true}).getAttribute('aria-pressed')});
    await r.page.keyboard.press('Escape');rows.push({case:'Escape cancels picker',pickVisible:await dock(r.page).getByRole('button',{name:'Pick page element',exact:true}).isVisible()});
    await dock(r.page).getByRole('button',{name:'Open Changes',exact:true}).click();rows.push({case:'Changes opened',visible:await r.page.getByRole('dialog',{name:'Changes',exact:true}).isVisible()});await r.page.keyboard.press('Escape');
    await dock(r.page).getByRole('button',{name:'Open Navigator',exact:true}).click();rows.push({case:'Navigator opened',visible:await r.page.getByRole('dialog',{name:'Navigator',exact:true}).isVisible()});await r.page.keyboard.press('Escape');
    await shot(r.page,'03-dock');await dock(r.page).getByRole('button',{name:'Deactivate CSSForge',exact:true}).click();
    rows.push({case:'power',hosts:await r.page.locator('cssforge-ui').count()});await r.action();await expect(inspector(r.page)).toBeVisible();rows.push({case:'actual action reactivation',visible:true});
    await save(info,{rows,errors:r.errors});
  }finally{await r.context.close();}
});

test('SH04 live Changes truth all interactions and focus containment',async({},info)=>{
  const r=await setup(info);const rows:any[]=[];
  try {
    await pick(r.page,'#checkout');await edit(r.page,'Font size','27px');await edit(r.page,'Text color','#abcdef');
    await dock(r.page).getByRole('button',{name:'Open Changes',exact:true}).click();const changes=r.page.getByRole('dialog',{name:'Changes',exact:true});
    rows.push({case:'current changes',text:await changes.innerText(),buttons:await changes.getByRole('button').evaluateAll(nodes=>nodes.map(node=>({name:node.getAttribute('aria-label')||node.textContent,disabled:(node as HTMLButtonElement).disabled}))),focused:await changes.evaluate(node=>(node.getRootNode() as ShadowRoot).activeElement?.getAttribute('aria-label'))});
    const focus=[];for(let i=0;i<10;i++){await r.page.keyboard.press(i<5?'Tab':'Shift+Tab');focus.push(await changes.evaluate(node=>node.contains((node.getRootNode() as ShadowRoot).activeElement)));}
    rows.push({case:'modal focus',focus});await shot(r.page,'04-live-changes');
    await changes.getByRole('button',{name:'Undo last edit',exact:true}).click();rows.push({case:'Undo from Changes',color:await r.page.locator('#checkout').evaluate(node=>getComputedStyle(node).color),text:await changes.innerText()});
    await changes.getByRole('button',{name:'Reset session edits',exact:true}).click();rows.push({case:'Reset from Changes',font:await r.page.locator('#checkout').evaluate(node=>getComputedStyle(node).fontSize),text:await changes.innerText()});
    await changes.getByRole('button',{name:'Close Changes',exact:true}).click();rows.push({case:'Close focus origin',focused:await dock(r.page).getByRole('button',{name:'Open Changes',exact:true}).evaluate(node=>node===(node.getRootNode() as ShadowRoot).activeElement)});
    await dock(r.page).getByRole('button',{name:'More tools',exact:true}).click();await r.page.getByRole('button',{name:'Review changes',exact:true}).click();await r.page.keyboard.press('Escape');
    rows.push({case:'nested menu origin',focused:await dock(r.page).getByRole('button',{name:'More tools',exact:true}).evaluate(node=>node===(node.getRootNode() as ShadowRoot).activeElement)});
    await save(info,{rows,errors:r.errors});
  }finally{await r.context.close();}
});

test('SH05 current UI short narrow and actual 125 150 200 percent zoom',async({},info)=>{
  test.setTimeout(60000);const r=await setup(info);const rows:any[]=[];
  try {
    await pick(r.page,'#checkout');
    for(const [width,height,zoom] of [[1440,900,1],[390,844,1],[320,450,1],[390,280,1],[1440,900,1.25],[1440,900,1.5],[1440,900,2]]) {
      await r.page.setViewportSize({width,height});await r.worker.evaluate(({id,zoom})=>chrome.tabs.setZoom(id,zoom),{id:r.tabId,zoom});await expect.poll(()=>r.worker.evaluate(id=>chrome.tabs.getZoom(id),r.tabId)).toBe(zoom);
      await r.page.getByRole('tab',{name:'Design',exact:true}).click();rows.push({case:'viewport',zoom,...await bounds(r.page),scroll:await r.page.getByRole('tabpanel',{name:'Design',exact:true}).evaluate(node=>({clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,clientHeight:node.clientHeight,scrollHeight:node.scrollHeight}))});
      for(const label of ['Media','State or pseudo','Inspector menu']) {
        try{await r.page.getByRole('button',{name:label,exact:true}).click({timeout:4000});const popup=r.page.getByRole('dialog',{name:label,exact:true});const b=await popup.boundingBox();rows.push({case:'popover',label,zoom,viewport:await r.page.evaluate(()=>({w:innerWidth,h:innerHeight})),bounds:b,scroll:await popup.evaluate(node=>({w:node.clientWidth,sw:node.scrollWidth,h:node.clientHeight,sh:node.scrollHeight}))});await r.page.keyboard.press('Escape');}catch(error){rows.push({case:'popover inaccessible',label,width,height,zoom,error:String(error)});await r.page.keyboard.press('Escape');}
      }
      if(width===390&&height===280||zoom===2)await shot(r.page,zoom===2?'05-zoom-200':'06-short-viewport');
    }
    await save(info,{rows,errors:r.errors});
  }finally{await r.context.close();}
});

test('SH06 host resets clipping transforms and high z-index interference',async({},info)=>{
  const hostile=fixture.replace('</style>','button,input{font:48px cursive!important;color:red!important;border:14px solid red!important} body{overflow-x:hidden} </style>');
  const r=await setup(info,hostile);const rows:any[]=[];
  try {
    await pick(r.page,'#checkout');const trigger=dock(r.page).getByRole('button',{name:'Measurement tools',exact:true});
    rows.push({case:'global host styles',host:await r.page.locator('#checkout').evaluate(node=>({color:getComputedStyle(node).color,font:getComputedStyle(node).fontSize})),ui:await trigger.evaluate(node=>({color:getComputedStyle(node).color,font:getComputedStyle(node).fontSize,border:getComputedStyle(node).borderWidth}))});
    for(const node of ['html','body']) {
      await r.page.evaluate(name=>(name==='html'?document.documentElement:document.body).style.transform='translate(30px,20px) scale(.9)',node);
      let interactionError:string|null=null;try{await trigger.click({timeout:4000});}catch(error){interactionError=String(error);}
      rows.push({case:'transformed host',node,...await bounds(r.page),interactionError,popup:await r.page.getByRole('dialog',{name:'Measurement tools',exact:true}).boundingBox()});await shot(r.page,`07-transform-${node}`);await r.page.keyboard.press('Escape');
      expect(interactionError).toBeNull();const geometry=await bounds(r.page);expect(geometry.panelWithin).toBe(true);expect(geometry.dockWithin).toBe(true);
      await r.page.evaluate(name=>(name==='html'?document.documentElement:document.body).style.transform='',node);
    }
    await r.page.evaluate(()=>{const overlay=document.createElement('div');overlay.id='host-cover';Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'2147483647',background:'rgba(200,30,30,.15)'});document.body.append(overlay);});
    const box=(await trigger.boundingBox())!;const hit=await r.page.evaluate(({x,y})=>{const node=document.elementFromPoint(x,y);return {tag:node?.localName,id:node?.id};},{x:box.x+box.width/2,y:box.y+box.height/2});rows.push({case:'highest host overlay',hit,uiHostZ:await r.page.locator('cssforge-ui').evaluate(node=>getComputedStyle(node).zIndex)});await shot(r.page,'08-host-high-z');
    expect(hit.tag).toBe('cssforge-ui');await trigger.click();await expect(r.page.getByRole('dialog',{name:'Measurement tools',exact:true})).toBeVisible();await r.page.keyboard.press('Escape');
    await r.page.locator('#host-cover').evaluate(node=>node.remove());await trigger.click();rows.push({case:'after overlay removed',dialogVisible:await r.page.getByRole('dialog',{name:'Measurement tools',exact:true}).isVisible()});await r.page.keyboard.press('Escape');
    await save(info,{rows,errors:r.errors});
  }finally{await r.context.close();}
});

test('SH08 built picker hover accuracy iframe outer border and cleanup',async({},info)=>{
  const r=await setup(info,selectionFixture,async page=>{
    await page.route('http://frames.test/selection-audit-frame.html',route=>route.fulfill({contentType:'text/html',body:'<button>Frame</button>'}));
  });const rows:any[]=[];
  try {
    for(const selector of ['#tiny','#transformed','#shadow-button','#slotted']){
      await r.page.locator(selector).scrollIntoViewIfNeeded();
      const start=dock(r.page).getByRole('button',{name:'Pick page element',exact:true});if(await start.count())await start.click();
      await r.page.locator(selector).hover();await expect(outline(r.page)).toBeVisible();
      rows.push({case:'hover',selector,target:await r.page.locator(selector).boundingBox(),highlight:await outline(r.page).boundingBox(),selected:await selected(r.page)});
      await r.page.keyboard.press('Escape');
    }
    for(const selector of ['#same-frame','#cross-frame']){
      await r.page.locator(selector).scrollIntoViewIfNeeded();await dock(r.page).getByRole('button',{name:'Pick page element',exact:true}).click();
      const b=(await r.page.locator(selector).boundingBox())!;const point={x:b.x+2,y:b.y+b.height/2};
      const hit=await r.page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,point);
      await r.page.mouse.move(point.x,point.y);await r.page.mouse.click(point.x,point.y);
      rows.push({case:'iframe outer border',selector,point,hit,selected:await selected(r.page),pickerActive:await dock(r.page).getByRole('button',{name:'Cancel element picking',exact:true}).count(),highlight:await outline(r.page).boundingBox()});
      await r.page.keyboard.press('Escape');
    }
    await r.page.getByRole('button',{name:'Deactivate CSSForge',exact:true}).click();
    rows.push({case:'deactivate cleanup',hosts:await r.page.locator('cssforge-ui').count(),outlines:await outline(r.page).count(),overlays:await r.page.locator('[data-cssforge-overlay]').count()});
    await save(info,{rows,errors:r.errors});
  }finally{await r.context.close();}
});

test('SH07 keyboard focus tabs popovers host events and current control inventory',async({},info)=>{
  const r=await setup(info);const rows:any[]=[];
  try {
    await pick(r.page,'#checkout');await r.page.evaluate(()=>{(window as any).pageKeys=0;document.addEventListener('keydown',()=>{(window as any).pageKeys++;});});
    const design=r.page.getByRole('tab',{name:'Design',exact:true});await design.focus();
    for(const key of ['ArrowRight','ArrowRight','ArrowLeft','Home','End','Home']){await r.page.keyboard.press(key);rows.push({case:'tab key',key,selected:await r.page.getByRole('tab',{selected:true}).textContent(),focused:await r.page.locator('cssforge-ui').evaluate(node=>node.shadowRoot!.activeElement?.textContent)});}
    rows.push({case:'UI key leakage',pageKeys:await r.page.evaluate(()=>(window as any).pageKeys)});
    const family=r.page.getByRole('button',{name:'Font family',exact:true});await family.press('ArrowDown');const menu=r.page.getByRole('dialog',{name:'Font family',exact:true});await menu.getByRole('button',{name:'Arial',exact:true}).focus();await r.page.keyboard.press('End');await r.page.keyboard.press('Home');rows.push({case:'menu keys',focused:await menu.evaluate(node=>(node.getRootNode() as ShadowRoot).activeElement?.textContent)});await r.page.keyboard.press('Escape');
    const focus=[];await design.focus();for(let i=0;i<25;i++){await r.page.keyboard.press('Tab');focus.push(await r.page.locator('cssforge-ui').evaluate(node=>({tag:node.shadowRoot!.activeElement?.localName,label:node.shadowRoot!.activeElement?.getAttribute('aria-label')||node.shadowRoot!.activeElement?.textContent?.slice(0,65)})));}
    rows.push({case:'Tab sequence',focus});await r.page.keyboard.press('Shift+Tab');
    rows.push({case:'current Design inventory',controls:await r.page.getByRole('tabpanel',{name:'Design',exact:true}).locator('button,input').evaluateAll(nodes=>nodes.map(node=>({tag:node.localName,role:node.getAttribute('role'),label:node.getAttribute('aria-label')||node.textContent?.trim(),type:node.getAttribute('type'),disabled:(node as HTMLInputElement).disabled,value:(node as HTMLInputElement).value,expanded:node.getAttribute('aria-expanded')})))});
    await r.page.getByRole('button',{name:'Measurement tools',exact:true}).click();await r.page.locator('#host-link').click();rows.push({case:'outside click',popupCount:await r.page.getByRole('dialog').count(),hostHash:new URL(r.page.url()).hash});
    await shot(r.page,'09-current-design');await save(info,{rows,errors:r.errors});
  }finally{await r.context.close();}
});
