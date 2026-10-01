import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { setup, fixture, pick, inspector } from './extensionHarness';

// Diagnostic audit only. All product changes happen through exposed UI controls.
const out = 'artifacts/diagnostics/current-ui-p1/audit/design';
const auditFixture = fixture.replace('</main>', `<section id="audit-parent" style="width:600px;height:300px;position:relative;font:24px/1.5 Georgia;color:rgb(20,40,60);text-align:left;--audit-length:18px;--audit-line:1.5;--audit-opacity:.6;--audit-index:7"><button id="audit-target" style="display:inline-block;position:relative;top:0;right:0;bottom:0;left:0;z-index:1;width:240px;height:80px;margin:8px;padding:8px;border:2px solid rgb(70,80,90);border-radius:8px;font:20px/1.4 Arial;letter-spacing:1px;color:rgb(40,50,60);opacity:1">Audit control target</button><div><span id="audit-inherited" style="display:inline-block">Inherited child</span><span id="audit-owned" style="display:inline-block;font-size:16px;color:rgb(90,100,110);font-family:Verdana;line-height:2">Owned child</span></div></section></main>`);
type Observation = { id: string; case: string; status: 'pass'|'mismatch'|'error'|'observed'|'expected-limitation'; expected?: unknown; actual?: unknown; evidence?: string; module?: string };
type Run = { name: string; observations: Observation[]; errors: string[]; inventory?: unknown; screenshots: string[] };
const f = (page:Page,name:string) => page.getByRole('textbox',{name,exact:true});
function add(run:Run, name:string, actual:unknown, expected?:unknown, module?:string) {
  const status = expected === undefined ? 'observed' : JSON.stringify(actual) === JSON.stringify(expected) ? 'pass' : 'mismatch';
  run.observations.push({id:`${run.name}-${String(run.observations.length+1).padStart(3,'0')}`,case:name,status,expected,actual,module});
}
async function save(run:Run) { await mkdir(out,{recursive:true}); await writeFile(`${out}/${run.name}.json`,JSON.stringify(run,null,2)); }
async function attempt(run:Run,name:string,task:()=>Promise<void>) { try { await task(); } catch(error) { run.observations.push({id:`${run.name}-${String(run.observations.length+1).padStart(3,'0')}`,case:name,status:'error',actual:String(error)}); } }
async function section(page:Page,name:string) {
  for (const item of await page.locator('[data-section]').all()) {
    const title=(await item.getAttribute('data-section'))!;
    const button=item.getByRole('button',{name:title,exact:true});
    if(await button.getAttribute('aria-expanded') !== String(title===name)) await button.click();
  }
  if(name) await page.locator(`[data-section="${name}"]`).evaluate(node=>node.scrollIntoView({block:'start'}));
}
async function edit(page:Page,name:string,value:string) { await f(page,name).fill(value); await f(page,name).press('Enter'); await page.waitForTimeout(70); }
async function choose(page:Page,name:string,value:string) {
  await page.getByRole('button',{name,exact:true}).click();
  await page.getByRole('dialog',{name,exact:true}).getByRole('button',{name:value,exact:true}).click();
  await page.waitForTimeout(70);
}
async function session(page:Page,name:string) {
  await page.getByRole('button',{name:'Inspector menu',exact:true}).click();
  const option=page.getByRole('dialog',{name:'Inspector menu',exact:true}).getByRole('button',{name,exact:true});
  if(await option.isEnabled()) await option.click();
  await page.keyboard.press('Escape'); await page.waitForTimeout(70);
}
async function css(page:Page,property:string,selector='#audit-target') { return page.locator(selector).evaluate((node,p)=>getComputedStyle(node).getPropertyValue(p),property); }
async function snapshot(page:Page,property:string,label?:string,selector='#audit-target') {
  return {computed:await css(page,property,selector),ui:label && await f(page,label).count()?await f(page,label).inputValue():null,invalid:label && await f(page,label).count()?await f(page,label).getAttribute('aria-invalid'):null,unit:label && await page.getByRole('button',{name:`${label} unit`,exact:true}).count()?await page.getByRole('button',{name:`${label} unit`,exact:true}).innerText():null};
}
async function shot(page:Page,run:Run,name:string) { await page.mouse.move(0,0); const file=`${out}/${name}.png`;await page.screenshot({path:file,animations:'disabled'});run.screenshots.push(file); }

type NumericField = {label:string;property:string;section:string;value:string;computed:string;keyword:string;negative?:boolean;integer?:boolean;unitless?:boolean};
const numericFields:NumericField[] = [
  {label:'Width',property:'width',section:'',value:'240.5',computed:'240.5px',keyword:'auto'},
  {label:'Height',property:'height',section:'',value:'80.5',computed:'80.5px',keyword:'auto'},
  {label:'Geometry radius',property:'border-radius',section:'',value:'10.5',computed:'10.5px',keyword:'initial'},
  ...['top','right','bottom','left'].map(side=>({label:`Margin ${side}`,property:`margin-${side}`,section:'Spacing',value:'10.5',computed:'10.5px',keyword:'auto',negative:true})),
  ...['top','right','bottom','left'].map(side=>({label:`Padding ${side}`,property:`padding-${side}`,section:'Spacing',value:'10.5',computed:'10.5px',keyword:'initial'})),
  {label:'Font size',property:'font-size',section:'Typography',value:'20.5',computed:'20.5px',keyword:'inherit'},
  {label:'Line height',property:'line-height',section:'Typography',value:'1.5',computed:'30px',keyword:'normal',unitless:true},
  {label:'Letter spacing',property:'letter-spacing',section:'Typography',value:'1.5',computed:'1.5px',keyword:'normal',negative:true},
  {label:'Opacity',property:'opacity',section:'Display',value:'.75',computed:'0.75',keyword:'initial',unitless:true},
  {label:'Border width',property:'border-width',section:'Border',value:'3.5',computed:'3px',keyword:'medium'},
  {label:'Border radius',property:'border-radius',section:'Border',value:'10.5',computed:'10.5px',keyword:'initial'},
  ...['top','right','bottom','left'].map(side=>({label:`Position ${side}`,property:side,section:'Positioning',value:'10.5',computed:'10.5px',keyword:'auto',negative:true})),
  {label:'Z-index',property:'z-index',section:'Positioning',value:'5',computed:'5',keyword:'auto',negative:true,integer:true,unitless:true},
];

test('current UI design audit — every exposed numeric field and raw CSS grammar',async({},info)=>{
  test.setTimeout(180000);
  const run:Run={name:'numeric',observations:[],errors:[],screenshots:[]};
  const {page,context,errors}=await setup(info,auditFixture);
  try {
    await mkdir(out,{recursive:true});await pick(page,'#audit-target');await section(page,'');
    run.inventory={numericFieldInstances:numericFields.length,fields:numericFields.map(({label,property,section})=>({label,property,section})),notExposed:['min-width','max-width','min-height','max-height','aspect-ratio','border per-side controls','corner-specific radius controls','font-style/italic','gap','flex/grid child controls']};
    await shot(page,run,'01-geometry-baseline');
    for(const item of numericFields) {
      await attempt(run,`${item.label} complete grammar sequence`,async()=>{
        await session(page,'Reset session edits');await section(page,item.section);
        add(run,`${item.label}: baseline`,await snapshot(page,item.property,item.label));
        await edit(page,item.label,item.value);
        add(run,`${item.label}: decimal/direct input`,await css(page,item.property),item.computed,'src/ui/shared/NumericScrubber.tsx');
        const before=await css(page,item.property);await edit(page,item.label,'11qu');
        add(run,`${item.label}: unsupported unit rejects without mutation`,{computed:await css(page,item.property),invalid:await f(page,item.label).getAttribute('aria-invalid')},{computed:before,invalid:'true'},'src/ui/shared/NumericScrubber.tsx');
        await edit(page,item.label,item.value);await edit(page,item.label,item.negative?'-2':'-2px');
        if(item.negative) add(run,`${item.label}: negative valid input`,await css(page,item.property),item.integer?'-2':'-2px');
        else if(item.property==='opacity') add(run,`${item.label}: negative invalid unit rejected`,await f(page,item.label).getAttribute('aria-invalid'),'true');
        else add(run,`${item.label}: negative length rejected`,await f(page,item.label).getAttribute('aria-invalid'),'true');
        await edit(page,item.label,item.value);
        if(item.integer) {await edit(page,item.label,'2.5');add(run,`${item.label}: fractional integer rejects`,await f(page,item.label).getAttribute('aria-invalid'),'true');}
        await edit(page,item.label,item.keyword);add(run,`${item.label}: keyword preserved`,await f(page,item.label).inputValue(),item.keyword);
        await f(page,item.label).press('ArrowUp');add(run,`${item.label}: keyword arrow does not rewrite`,await f(page,item.label).inputValue(),item.keyword);
        const expression=item.property==='opacity'?'calc(.5 + .1)':item.property==='line-height'?'calc(1 + .5)':item.integer?'calc(2 + 1)':'calc(10px + 2px)';
        await edit(page,item.label,expression);add(run,`${item.label}: calc expression`,await snapshot(page,item.property,item.label));
        await f(page,item.label).press('ArrowUp');add(run,`${item.label}: calc arrow preserves token`,await f(page,item.label).inputValue(),expression);
        const variable=item.property==='opacity'?'var(--audit-opacity)':item.property==='line-height'?'var(--audit-line)':item.integer?'var(--audit-index)':'var(--audit-length)';
        await edit(page,item.label,variable);add(run,`${item.label}: var token retained`,await f(page,item.label).inputValue(),variable);
        await f(page,item.label).press('ArrowUp');add(run,`${item.label}: var arrow preserves token`,await f(page,item.label).inputValue(),variable);
        await edit(page,item.label,'10px; color:red');add(run,`${item.label}: malformed declaration rejects`,await f(page,item.label).getAttribute('aria-invalid'),'true');
        await edit(page,item.label,item.value);await session(page,'Reset session edits');
      });
    }
    await section(page,'Spacing');await shot(page,run,'02-spacing-baseline');
    await section(page,'Border');await shot(page,run,'03-border-baseline');
    add(run,'Radius geometry/Border synchronization: initial',{geometry:await f(page,'Geometry radius').inputValue(),border:await f(page,'Border radius').inputValue()});
    await edit(page,'Border radius','15px');add(run,'Radius geometry/Border synchronization: edit',{geometry:await f(page,'Geometry radius').inputValue(),border:await f(page,'Border radius').inputValue()},{geometry:'15',border:'15'},'src/ui/design/LiveDesignView.tsx');
    await session(page,'Reset session edits');
  } finally {run.errors=errors;await save(run);await context.close();}
});

test('current UI design audit — selectors, alignment, colors, and conditional positioning',async({},info)=>{
  test.setTimeout(180000);
  const run:Run={name:'choices',observations:[],errors:[],screenshots:[]};
  const {page,context,errors}=await setup(info,auditFixture);
  try {
    await mkdir(out,{recursive:true});await pick(page,'#audit-target');
    const choices=[
      {label:'Font family',property:'font-family',section:'Typography',values:['Arial','Georgia','Verdana','system-ui','serif','sans-serif','monospace']},
      {label:'Font weight',property:'font-weight',section:'Typography',values:['100','200','300','400','500','600','700','800','900','normal','bold']},
      {label:'Text decoration',property:'text-decoration-line',section:'Typography',values:['none','underline','line-through','overline']},
      {label:'Text transform',property:'text-transform',section:'Typography',values:['none','uppercase','lowercase','capitalize']},
      {label:'Display mode',property:'display',section:'Display',values:['block','inline','inline-block','flex','inline-flex','grid','inline-grid','flow-root','contents','none']},
      {label:'Border style',property:'border-style',section:'Border',values:['none','solid','dashed','dotted','double','groove','ridge','inset','outset']},
      {label:'Position',property:'position',section:'Positioning',values:['static','relative','absolute','fixed','sticky']},
    ];
    run.inventory={selects:choices,alignment:['left','center','right','justify'],manualColors:['Text color','Border color'],pickerCoverage:'effects audit sibling'};
    for(const item of choices) {
      for(const value of item.values) await attempt(run,`${item.label}: ${value}`,async()=>{
        await section(page,item.section);await choose(page,item.label,value);
        const expected=item.property==='font-weight'?(value==='normal'?'400':value==='bold'?'700':value):value;
        add(run,`${item.label}: choose ${value}`,await css(page,item.property),expected,'src/ui/design/EditControls.tsx');
        add(run,`${item.label}: active trigger`,await page.getByRole('button',{name:item.label,exact:true}).innerText(),value);
        if(item.label==='Position')add(run,`Position ${value}: offsets visibility`,await f(page,'Position top').isVisible().catch(()=>false),value!=='static');
        await session(page,'Reset session edits');
      });
    }
    await section(page,'Typography');
    await page.getByRole('button',{name:'Font family',exact:true}).click();
    await f(page,'Custom font family').fill('"Courier New", monospace');await f(page,'Custom font family').press('Enter');await page.keyboard.press('Escape');
    add(run,'Custom font family multi-token edit',await css(page,'font-family'),'"Courier New", monospace');
    for(const align of ['left','center','right','justify'])await attempt(run,`Align ${align}`,async()=>{
      const button=page.getByRole('button',{name:`Align ${align}`,exact:true});await button.focus();await page.keyboard.press('Enter');
      add(run,`Align ${align}: keyboard action`,{computed:await css(page,'text-align'),pressed:await button.getAttribute('aria-pressed')},{computed:align,pressed:'true'});
    });
    for(const item of [{label:'Text color',property:'color',section:'Typography'},{label:'Border color',property:'border-color',section:'Border'}])await attempt(run,`${item.label} manual grammar`,async()=>{
      await section(page,item.section);
      for(const [value,computed] of [['#123456','rgb(18, 52, 86)'],['rgba(10, 20, 30, .5)','rgba(10, 20, 30, 0.5)'],['rebeccapurple','rgb(102, 51, 153)'],['var(--unknown, red)','rgb(255, 0, 0)'],['currentColor',item.property==='color'?'rgb(20, 40, 60)':await css(page,'color')]]) {
        await edit(page,item.label,value);add(run,`${item.label}: ${value}`,await css(page,item.property),computed,'src/ui/shared/ColorControl.tsx');
      }
      const before=await css(page,item.property);await edit(page,item.label,'banana');add(run,`${item.label}: invalid rejection`,{computed:await css(page,item.property),invalid:await f(page,item.label).getAttribute('aria-invalid')},{computed:before,invalid:'true'});
      await session(page,'Reset session edits');
    });
    await section(page,'Typography');await shot(page,run,'04-typography-baseline');
    await section(page,'Positioning');await shot(page,run,'05-positioning-baseline');
  } finally {run.errors=errors;await save(run);await context.close();}
});

test('current UI design audit — units, arrows, scrubbing, Undo, Reset, and Escape',async({},info)=>{
  test.setTimeout(180000);
  const run:Run={name:'units-gestures',observations:[],errors:[],screenshots:[]};
  const {page,context,errors}=await setup(info,auditFixture);
  try {
    await mkdir(out,{recursive:true});await pick(page,'#audit-target');
    for(const item of numericFields)await attempt(run,`${item.label} gestures`,async()=>{
      await session(page,'Reset session edits');await section(page,item.section);await edit(page,item.label,item.value);
      const base=await f(page,item.label).inputValue(),computed=await css(page,item.property);
      await f(page,item.label).focus();await f(page,item.label).press('ArrowUp');const arrow=await snapshot(page,item.property,item.label);
      add(run,`${item.label}: ArrowUp`,arrow);
      await f(page,item.label).press('ArrowDown');add(run,`${item.label}: ArrowDown reverses up`,await f(page,item.label).inputValue(),base);
      await f(page,item.label).press('Shift+ArrowUp');add(run,`${item.label}: Shift step`,await snapshot(page,item.property,item.label));
      await f(page,item.label).press('Alt+ArrowDown');add(run,`${item.label}: Alt step`,await snapshot(page,item.property,item.label));
      await f(page,item.label).press('Escape');add(run,`${item.label}: Escape restores gesture`,await css(page,item.property),computed,'src/ui/shared/NumericScrubber.tsx');
      // Use exposed input's pointer surface; no editor methods or value injection.
      const box=await f(page,item.label).boundingBox();if(box){await page.mouse.move(box.x+Math.min(8,box.width/2),box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+Math.min(8,box.width/2)+12,box.y+box.height/2,{steps:6});await page.mouse.up();await page.waitForTimeout(100);}
      add(run,`${item.label}: horizontal scrub`,await snapshot(page,item.property,item.label));
      await session(page,'Undo last edit');add(run,`${item.label}: Undo restores scrub`,await css(page,item.property),computed,'src/ui/shared/NumericScrubber.tsx');
      const unitTrigger=page.getByRole('button',{name:`${item.label} unit`,exact:true});
      if(await unitTrigger.count()){
        await unitTrigger.click();const dialog=page.getByRole('dialog',{name:`${item.label} unit`,exact:true});
        const options=await dialog.getByRole('button').evaluateAll(nodes=>nodes.map(node=>({label:node.textContent?.trim(),disabled:(node as HTMLButtonElement).disabled,title:node.getAttribute('title'),pressed:node.getAttribute('aria-pressed')})));
        add(run,`${item.label}: available unit menu`,options);await shot(page,run,`unit-${item.label.toLowerCase().replaceAll(' ','-')}`);await page.keyboard.press('Escape');
        add(run,`${item.label}: unit Escape returns focus`,await unitTrigger.evaluate(node=>node===(node.getRootNode() as Document | ShadowRoot).activeElement),true,'src/ui/popovers/Popover.tsx');
        const desired=item.property==='opacity'?'%':'rem';await unitTrigger.click();const option=dialog.getByRole('button',{name:desired,exact:true});
        if(await option.isEnabled()){const before=parseFloat(await css(page,item.property));await option.click();const after=parseFloat(await css(page,item.property));add(run,`${item.label}: ${desired} conversion preserves native size`,Math.abs(after-before)<.05,true,'src/editing/values.ts');add(run,`${item.label}: converted UI`,await snapshot(page,item.property,item.label));}
        else{run.observations.push({id:`${run.name}-${String(run.observations.length+1).padStart(3,'0')}`,case:`${item.label}: ${desired} disabled with explanation`,status:'expected-limitation',actual:await option.getAttribute('title')});await page.keyboard.press('Escape');}
      }else add(run,`${item.label}: no unit menu (unitless integer)`,item.integer,true);
      await session(page,'Reset session edits');
    });
    await section(page,'');await page.getByRole('button',{name:'Width unit',exact:true}).click();
    const menu=page.getByRole('dialog',{name:'Width unit',exact:true});add(run,'Width ch conversion is disabled rather than guessed',await menu.getByRole('button',{name:'ch',exact:true}).isDisabled(),true);await page.keyboard.press('Escape');
    await edit(page,'Width','12ch');add(run,'Width ch raw entry is supported',await snapshot(page,'width','Width'));await session(page,'Reset session edits');
    await edit(page,'Width','50%');add(run,'Width percent authored token',await snapshot(page,'width','Width'));await session(page,'Reset session edits');
  } finally {run.errors=errors;await save(run);await context.close();}
});

test('current UI design audit — inheritance, selection sync, narrow UI, and accessible controls',async({},info)=>{
  test.setTimeout(120000);
  const run:Run={name:'inheritance-layout',observations:[],errors:[],screenshots:[]};
  const {page,context,errors}=await setup(info,auditFixture);
  try {
    await mkdir(out,{recursive:true});await pick(page,'#audit-parent');await section(page,'Typography');
    add(run,'Inherited/owned baseline',await page.locator('#audit-parent,#audit-inherited,#audit-owned').evaluateAll(nodes=>nodes.map(node=>({id:node.id,font:getComputedStyle(node).fontSize,family:getComputedStyle(node).fontFamily,color:getComputedStyle(node).color,lineHeight:getComputedStyle(node).lineHeight}))));
    await edit(page,'Font size','30px');await edit(page,'Text color','#aa1122');await choose(page,'Font family','Arial');await edit(page,'Line height','1.8');
    add(run,'Parent font flows to inherited child',await css(page,'font-size','#audit-inherited'),'30px');add(run,'Child-owned font size resists parent edit',await css(page,'font-size','#audit-owned'),'16px');
    add(run,'Parent color flows to inherited child',await css(page,'color','#audit-inherited'),'rgb(170, 17, 34)');add(run,'Child-owned color resists parent edit',await css(page,'color','#audit-owned'),'rgb(90, 100, 110)');
    add(run,'Parent family flows to inherited child',await css(page,'font-family','#audit-inherited'),'Arial');add(run,'Child-owned family resists parent edit',await css(page,'font-family','#audit-owned'),'Verdana');
    add(run,'Parent unitless line-height flows to inherited child',await css(page,'line-height','#audit-inherited'),'54px');add(run,'Child-owned line-height resists parent edit',await css(page,'line-height','#audit-owned'),'32px');
    await pick(page,'#audit-inherited');await section(page,'Typography');add(run,'Selected inherited child UI sync',await f(page,'Font size').inputValue(),'30');await edit(page,'Font size','22px');
    add(run,'Child local edit owns its value',await css(page,'font-size','#audit-inherited'),'22px');add(run,'Child edit leaves parent unchanged',await css(page,'font-size','#audit-parent'),'30px');
    await page.getByRole('tab',{name:'Code',exact:true}).click();await page.getByRole('tab',{name:'Design',exact:true}).click();add(run,'Design/Code/Design value sync',await f(page,'Font size').inputValue(),'22');
    await session(page,'Undo last edit');add(run,'Undo child restores inherited parent value',await css(page,'font-size','#audit-inherited'),'30px');await session(page,'Reset session edits');add(run,'Reset restores inherited baseline',await css(page,'font-size','#audit-inherited'),'24px');
    await pick(page,'#audit-target');
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:900});
      for(const name of ['Spacing','Typography','Display','Border','Positioning'])await attempt(run,`${name} at ${width}px`,async()=>{
        await section(page,name);
        const native=await inspector(page).evaluate(node=>{const r=node.getBoundingClientRect();return{rect:{x:r.x,y:r.y,width:r.width,height:r.height},overflow:node.scrollWidth-node.clientWidth,viewport:{width:innerWidth,height:innerHeight}};});
        add(run,`${name} at ${width}: inspector fits viewport`,native.rect.x>=0&&native.rect.y>=0&&native.rect.x+native.rect.width<=native.viewport.width+1&&native.rect.y+native.rect.height<=native.viewport.height+1,true);
        add(run,`${name} at ${width}: inspector horizontal overflow`,native.overflow<=1,true);
        const controls=await page.locator(`[data-section="${name}"] input:visible,[data-section="${name}"] button:visible`).evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();const input=node as HTMLInputElement;const style=getComputedStyle(node);return{tag:node.tagName,label:node.getAttribute('aria-label')||node.textContent?.trim(),width:r.width,height:r.height,disabled:input.disabled,value:input.value,outline:style.outline,role:node.getAttribute('role')};}));
        add(run,`${name} at ${width}: control geometry/labels`,controls);
        if(width!==1440 || name==='Typography')await shot(page,run,`layout-${width}-${name.toLowerCase()}`);
      });
    }
    await page.setViewportSize({width:1440,height:900});await section(page,'Typography');
    for(const name of ['Font family','Font weight','Text decoration','Text transform'])await attempt(run,`${name} keyboard menu`,async()=>{
      const trigger=page.getByRole('button',{name,exact:true});await trigger.focus();await page.keyboard.press('ArrowDown');
      add(run,`${name}: keyboard opens dialog`,await page.getByRole('dialog',{name,exact:true}).isVisible(),true);await page.keyboard.press('End');
      add(run,`${name}: End focuses option`,await page.getByRole('dialog',{name,exact:true}).evaluate(node=>({focused:(node.getRootNode() as Document | ShadowRoot).activeElement?.textContent?.trim()})));
      await page.keyboard.press('Escape');add(run,`${name}: Escape returns focus`,await trigger.evaluate(node=>node===(node.getRootNode() as Document | ShadowRoot).activeElement),true);
    });
    add(run,'Inspectable target inline authored values remain untouched by session edits',await page.locator('#audit-target').getAttribute('style'));
  } finally {run.errors=errors;await save(run);await context.close();}
});

test('current UI design audit — every enabled unit option, native comparisons, and zoom',async({},info)=>{
  test.setTimeout(240000);
  const run:Run={name:'unit-option-matrix',observations:[],errors:[],screenshots:[]};
  const nativeFixture=auditFixture.replace('</main>','<button id="audit-native-inline" style="display:inline">Native inline button</button><span id="audit-native-span" style="display:inline">Native inline span</span></main>');
  const {page,context,worker,tabId,errors}=await setup(info,nativeFixture);
  try {
    await mkdir(out,{recursive:true});
    const nativeButton=await css(page,'display','#audit-native-inline');
    add(run,'Native unedited button with authored display:inline',nativeButton);
    await pick(page,'#audit-target');await section(page,'Display');await choose(page,'Display mode','inline');
    add(run,'Extension display:inline equals unedited native button behavior',await css(page,'display'),nativeButton);
    await session(page,'Reset session edits');
    for(const item of numericFields.filter(item=>!item.integer))await attempt(run,`${item.label}: all exposed unit options`,async()=>{
      await section(page,item.section);await edit(page,item.label,item.property==='border-width'?'3px':item.value);
      const trigger=page.getByRole('button',{name:`${item.label} unit`,exact:true});await trigger.click();
      const dialog=page.getByRole('dialog',{name:`${item.label} unit`,exact:true});
      const units=await dialog.getByRole('button').allTextContents();await page.keyboard.press('Escape');
      for(const text of units){
        const unit=text.trim();await session(page,'Reset session edits');await edit(page,item.label,item.property==='border-width'?'3px':item.value);
        const before=parseFloat(await css(page,item.property));await trigger.click();const option=dialog.getByRole('button',{name:unit,exact:true});
        if(await option.isEnabled()){
          const pointerTarget=await option.evaluate(node=>{const rect=node.getBoundingClientRect();const hit=(node.getRootNode() as ShadowRoot).elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);return {reachable:hit===node||node.contains(hit),hit:hit?.className,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};});
          add(run,`${item.label}: ${unit} option pointer reachability`,pointerTarget.reachable,true,'src/ui/ui.module.css');
          expect(pointerTarget.reachable,`${item.label} ${unit} must accept pointer interaction`).toBe(true);
          if(pointerTarget.reachable)await option.click({timeout:1500});
          else {await shot(page,run,`blocked-unit-${item.label.toLowerCase().replaceAll(' ','-')}-${unit||'unitless'}`);add(run,`${item.label}: ${unit} occluding geometry`,pointerTarget);await option.focus();await page.keyboard.press('Enter');}
          await page.waitForTimeout(70);const after=parseFloat(await css(page,item.property));
          add(run,`${item.label}: ${unit} enabled option applies and preserves computed size`,{differenceWithinTolerance:Math.abs(after-before)<.05,invalid:await f(page,item.label).getAttribute('aria-invalid')},{differenceWithinTolerance:true,invalid:null},'src/editing/values.ts');
          add(run,`${item.label}: ${unit} converted value`,await snapshot(page,item.property,item.label));
        }else{
          run.observations.push({id:`${run.name}-${String(run.observations.length+1).padStart(3,'0')}`,case:`${item.label}: ${unit} disabled option`,status:'expected-limitation',actual:await option.getAttribute('title')});await page.keyboard.press('Escape');
        }
      }
      await session(page,'Reset session edits');
    });
    await pick(page,'#audit-native-span');await section(page,'');add(run,'Native inline span sizes correctly disabled',{width:await f(page,'Width').isDisabled(),height:await f(page,'Height').isDisabled()},{width:true,height:true});
    await pick(page,'#audit-target');await section(page,'Spacing');await edit(page,'Margin left','11qu');
    add(run,'Invalid unit accessibility diagnostic',await f(page,'Margin left').evaluate(node=>({invalid:node.getAttribute('aria-invalid'),describedBy:node.getAttribute('aria-describedby'),errorMessage:node.getAttribute('aria-errormessage'),title:node.getAttribute('title')})));
    add(run,'Invalid unit visible alert',await page.getByRole('alert').allTextContents());await shot(page,run,'invalid-unit-spacing');
    await edit(page,'Margin left','8px');await session(page,'Reset session edits');
    await worker.evaluate(async id=>{await (globalThis as any).chrome.tabs.setZoom(id,2);},tabId);await page.waitForTimeout(150);
    add(run,'Native Chrome 200% zoom applied',await worker.evaluate(async id=>(globalThis as any).chrome.tabs.getZoom(id),tabId),2);
    for(const name of ['Spacing','Typography','Border','Positioning']){
      await section(page,name);add(run,`${name}: 200% zoom visible layout`,await inspector(page).evaluate(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight,overflow:node.scrollWidth-node.clientWidth};}));await shot(page,run,`zoom-200-${name.toLowerCase()}`);
    }
    await worker.evaluate(async id=>{await (globalThis as any).chrome.tabs.setZoom(id,1);},tabId);
  } finally {run.errors=errors;await save(run);await context.close();}
});

test('current UI design audit — remaining typography inheritance, SVG, and integer-keyboard evidence',async({},info)=>{
  test.setTimeout(120000);
  const run:Run={name:'supplement',observations:[],errors:[],screenshots:[]};
  const owned='display:inline-block;font:200 16px/2 Verdana;color:rgb(90,100,110);letter-spacing:3px;text-align:right;text-transform:lowercase;text-decoration-line:overline';
  const nativeTypography=`<section id="audit-native-typography" style="width:600px;position:relative;font:700 30px/1.8 Arial;color:#aa1122;letter-spacing:2px;text-align:center;text-transform:uppercase;text-decoration-line:underline"><span id="audit-native-inherited" style="display:inline-block">Inherited child</span><span id="audit-native-owned" style="${owned}">Owned child</span></section>`;
  const svg=`<svg id="audit-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80" width="160" height="80"><rect id="audit-svg-rect" x="10" y="10" width="60" height="30" fill="steelblue"/><circle id="audit-svg-circle" cx="120" cy="40" r="15" fill="tomato"/></svg>`;
  const provenPercent=`<div style="position:absolute;left:48px;top:780px"><section style="display:block;width:400px!important"><div id="audit-percent-proven" style="display:block;width:200px;height:200px;margin:10px;padding:10px;border-radius:10px;background:#aac3a5">Proven percentage target</div></section></div>`;
  const html=auditFixture.replace('display:inline-block;font-size:16px;color:rgb(90,100,110);font-family:Verdana;line-height:2',owned).replace('</main>',`${nativeTypography}${svg}${provenPercent}</main>`);
  const {page,context,errors}=await setup(info,html);
  const typography=['font-family','font-size','font-weight','line-height','letter-spacing','text-align','text-transform','text-decoration-line','color'];
  const computedTypography=async(selector:string)=>page.locator(selector).evaluate((node,properties)=>Object.fromEntries(properties.map(property=>[property,getComputedStyle(node).getPropertyValue(property)])),typography);
  try {
    await mkdir(out,{recursive:true});await pick(page,'#audit-parent');await section(page,'Typography');
    await edit(page,'Font size','30px');await edit(page,'Text color','#aa1122');await choose(page,'Font family','Arial');await edit(page,'Line height','1.8');
    await choose(page,'Font weight','700');await edit(page,'Letter spacing','2px');await page.getByRole('button',{name:'Align center',exact:true}).click();await choose(page,'Text transform','uppercase');await choose(page,'Text decoration','underline');
    add(run,'All parent typography controls match native declarations',await computedTypography('#audit-parent'),await computedTypography('#audit-native-typography'),'src/ui/design/LiveDesignView.tsx');
    add(run,'All inherited child typography matches native CSS behavior',await computedTypography('#audit-inherited'),await computedTypography('#audit-native-inherited'),'src/ui/design/LiveDesignView.tsx');
    add(run,'All descendant-owned typography matches native CSS behavior',await computedTypography('#audit-owned'),await computedTypography('#audit-native-owned'),'src/ui/design/LiveDesignView.tsx');
    await shot(page,run,'supplement-typography-inheritance');
    await session(page,'Undo last edit');add(run,'Typography decoration Undo restores parent',await css(page,'text-decoration-line','#audit-parent'),'none');
    await session(page,'Reset session edits');add(run,'Typography Reset restores parent baseline',await css(page,'font-size','#audit-parent'),'24px');
    await pick(page,'#audit-svg');await section(page,'');
    add(run,'SVG root dimensions enabled',{width:await f(page,'Width').isEnabled(),height:await f(page,'Height').isEnabled()},{width:true,height:true});
    add(run,'SVG root dimensions initial value',{width:await f(page,'Width').inputValue(),height:await f(page,'Height').inputValue()},{width:'160',height:'80'});
    await edit(page,'Width','200px');await edit(page,'Height','100px');add(run,'SVG root size edits apply',{width:await css(page,'width','#audit-svg'),height:await css(page,'height','#audit-svg')},{width:'200px',height:'100px'});
    await shot(page,run,'supplement-svg-root-edited');await session(page,'Undo last edit');add(run,'SVG root height Undo',await css(page,'height','#audit-svg'),'80px');
    await session(page,'Reset session edits');add(run,'SVG root size Reset',await css(page,'width','#audit-svg'),'160px');
    await pick(page,'#audit-svg-rect');await section(page,'');add(run,'SVG rect size controls enabled',{width:await f(page,'Width').isEnabled(),height:await f(page,'Height').isEnabled()},{width:true,height:true});
    await edit(page,'Width','80px');await edit(page,'Height','40px');add(run,'SVG rect dimensions edit geometry',{width:await css(page,'width','#audit-svg-rect'),height:await css(page,'height','#audit-svg-rect')},{width:'80px',height:'40px'});await shot(page,run,'supplement-svg-rect-edited');
    await session(page,'Undo last edit');add(run,'SVG rect height Undo',await css(page,'height','#audit-svg-rect'),'30px');await session(page,'Reset session edits');add(run,'SVG rect width Reset',await css(page,'width','#audit-svg-rect'),'60px');
    await pick(page,'#audit-svg-circle');await section(page,'');add(run,'SVG circle size controls currently disabled',{width:await f(page,'Width').isDisabled(),height:await f(page,'Height').isDisabled()},{width:true,height:true});await shot(page,run,'supplement-svg-circle-disabled');
    await pick(page,'#audit-target');await section(page,'Positioning');await edit(page,'Z-index','5');await f(page,'Z-index').focus();await f(page,'Z-index').press('Alt+ArrowDown');
    add(run,'Z-index Alt+ArrowDown generates invalid fractional draft',await snapshot(page,'z-index','Z-index'),{computed:'4',ui:'4',invalid:null,unit:null},'src/ui/shared/NumericScrubber.tsx');
    await shot(page,run,'supplement-z-index-alt-step');await f(page,'Z-index').press('Escape');await session(page,'Reset session edits');
    await section(page,'');await edit(page,'Width','0');add(run,'Width bare zero accepted',await f(page,'Width').getAttribute('aria-invalid'),null);await session(page,'Reset session edits');
    await edit(page,'Width','10000px');add(run,'Width large value accepted',await css(page,'width'),'10000px');await session(page,'Reset session edits');
    await section(page,'Border');await edit(page,'Border width','1px 2px 3px 4px');add(run,'Border shorthand multi-side token retained',await f(page,'Border width').inputValue(),'1px 2px 3px 4px');
    add(run,'Border shorthand multi-side native result',await page.locator('#audit-target').evaluate(node=>{const css=getComputedStyle(node);return [css.borderTopWidth,css.borderRightWidth,css.borderBottomWidth,css.borderLeftWidth];}),['1px','2px','3px','4px']);
    await edit(page,'Border radius','1px 2px 3px 4px');add(run,'Radius shorthand multi-corner token retained',await f(page,'Border radius').inputValue(),'1px 2px 3px 4px');add(run,'Radius geometry shared shorthand sync',await f(page,'Geometry radius').inputValue(),'1px 2px 3px 4px');await shot(page,run,'supplement-border-shorthand');
    await session(page,'Reset session edits');
    for(const item of [{label:'Font family',section:'Typography'},{label:'Font weight',section:'Typography'},{label:'Text decoration',section:'Typography'},{label:'Text transform',section:'Typography'},{label:'Display mode',section:'Display'},{label:'Border style',section:'Border'},{label:'Position',section:'Positioning'}]){
      await section(page,item.section);const trigger=page.getByRole('button',{name:item.label,exact:true});await trigger.focus();await page.keyboard.press('ArrowDown');const menu=page.getByRole('dialog',{name:item.label,exact:true});
      add(run,`${item.label}: ArrowDown opens keyboard menu`,await menu.isVisible(),true);if(await menu.evaluate(node=>(node.getRootNode() as ShadowRoot).activeElement?.tagName==='INPUT'))await page.keyboard.press('Tab');await page.keyboard.press('End');await page.keyboard.press('Home');
      add(run,`${item.label}: Home focuses first enabled option`,await menu.evaluate(node=>{const first=node.querySelector('button:not(:disabled)');return first===(node.getRootNode() as ShadowRoot).activeElement;}),true);
      await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');add(run,`${item.label}: Tab then Shift+Tab returns option focus`,await menu.evaluate(node=>node.contains((node.getRootNode() as ShadowRoot).activeElement)),true);await page.keyboard.press('Escape');
      add(run,`${item.label}: keyboard Escape returns trigger focus`,await trigger.evaluate(node=>node===(node.getRootNode() as ShadowRoot).activeElement),true);
    }
    await pick(page,'#audit-percent-proven');await section(page,'');const widthMenu=page.getByRole('dialog',{name:'Width unit',exact:true});await page.getByRole('button',{name:'Width unit',exact:true}).click();
    add(run,'Proven width percentage conversion is enabled',await widthMenu.getByRole('button',{name:'%',exact:true}).isEnabled(),true);await widthMenu.getByRole('button',{name:'%',exact:true}).click();add(run,'Proven width percent conversion preserves size',await css(page,'width','#audit-percent-proven'),'200px');add(run,'Proven width percent authored UI token',await page.getByRole('button',{name:'Width unit',exact:true}).innerText(),'%');await session(page,'Reset session edits');
    await section(page,'Border');await page.getByRole('button',{name:'Border radius unit',exact:true}).click();const radiusMenu=page.getByRole('dialog',{name:'Border radius unit',exact:true});
    add(run,'Square box radius percentage conversion is enabled',await radiusMenu.getByRole('button',{name:'%',exact:true}).isEnabled(),true);await radiusMenu.getByRole('button',{name:'%',exact:true}).click();add(run,'Square box radius percentage token',await css(page,'border-radius','#audit-percent-proven'),'5%');await session(page,'Reset session edits');
  } finally {run.errors=errors;await save(run);await context.close();}
});

test('current UI design audit — native viewport zoom captures',async({},info)=>{
  test.setTimeout(90000);
  const run:Run={name:'native-zoom',observations:[],errors:[],screenshots:[]};
  const {page,context,worker,tabId,errors}=await setup(info,auditFixture);
  const cdp=await context.newCDPSession(page);
  try {
    await mkdir(out,{recursive:true});await pick(page,'#audit-target');
    for(const zoom of [1.25,1.5,2]){
      await worker.evaluate(async({id,zoom})=>{await(globalThis as any).chrome.tabs.setZoom(id,zoom);},{id:tabId,zoom});await page.waitForTimeout(150);
      add(run,`Chrome ${zoom*100}% zoom applied`,await worker.evaluate(async id=>(globalThis as any).chrome.tabs.getZoom(id),tabId),zoom);
      for(const name of ['Spacing','Typography','Display','Border','Positioning']){
        await section(page,name);const geometry=await inspector(page).evaluate(node=>{const rect=node.getBoundingClientRect();const root=node.getRootNode() as ShadowRoot;const hit=root.elementFromPoint(rect.x+20,rect.y+20);return {rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},viewport:{width:innerWidth,height:innerHeight},overflow:node.scrollWidth-node.clientWidth,headerHitIsInspector:!!hit&&node.contains(hit),scrollY};});
        add(run,`${name} at ${zoom*100}%: native viewport bounds and pointer hit`,geometry.rect.x>=0&&geometry.rect.y>=0&&geometry.rect.x+geometry.rect.width<=geometry.viewport.width+1&&geometry.rect.y+geometry.rect.height<=geometry.viewport.height+1&&geometry.overflow<=1&&geometry.headerHitIsInspector,true);
        add(run,`${name} at ${zoom*100}%: native viewport geometry`,geometry);
        const capture=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});const file=`${out}/native-zoom-${zoom*100}-${name.toLowerCase()}.png`;await writeFile(file,Buffer.from(capture.data,'base64'));run.screenshots.push(file);
      }
    }
    await worker.evaluate(async id=>{await(globalThis as any).chrome.tabs.setZoom(id,1);},tabId);
  } finally {run.errors=errors;await save(run);await context.close();}
});
