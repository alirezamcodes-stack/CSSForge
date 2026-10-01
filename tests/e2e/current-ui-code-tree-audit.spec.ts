import { test, expect, type Page, type Locator, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setup, pick, identity, inspector, dock } from './extensionHarness';

// Diagnostic only: product observations never assert a known issue or prevent
// later controls being exercised. All user edits go through the shipped UI.
const directory = path.resolve('artifacts/diagnostics/current-ui-audit/code-tree');
const fixture = `<!doctype html><html><head><meta charset="utf-8"><title>CSSForge current UI audit</title><style id="author">
*{box-sizing:border-box}body{margin:0;background:#f1eee6;color:#243b32;font:17px Arial;min-height:20000px}header{padding:28px 40px;border-bottom:1px solid #bbc9bd}main{padding:32px 40px;max-width:900px}h1{font:38px Georgia;margin:0 0 18px}.card{padding:24px;background:#fffdf7;border:1px solid #c4cec2;border-radius:14px;margin:22px 0}.primary{font-size:18px;color:rgb(255,255,255);background-color:#294c3b;border:0;padding:16px 24px;border-radius:6px;letter-spacing:1px}.primary::before{content:"↗ ";color:gold}.primary::after{content:" ✓";color:cyan}.primary:hover{color:rgb(220,120,40)}.primary:focus{outline:3px solid #e0a141}.primary:active{transform:translateY(1px)}
@media (min-width:1000px){.primary{letter-spacing:2px}.primary:hover{background-color:rgb(42,94,62)}@media (prefers-reduced-motion:no-preference){.primary{line-height:1.4}}}
@media (max-width:700px){.primary{font-size:15px;color:rgb(200,230,210)}}
.primary{animation-name:steady;animation-duration:5s;animation-play-state:paused}@keyframes steady{from{opacity:.99}to{opacity:1}}
.card:has(.primary){outline-offset:3px}.card .primary > span{display:inline-block}
svg{width:110px;height:55px;display:block}#open-host,#closed-host{padding:12px;margin:12px 0;border:1px solid #b4c8bc}#large-branch{margin-top:20px}#large-branch span{display:block}a{color:#294c3b}
</style><link rel="stylesheet" href="http://styles.test/ui-audit.css"></head><body><header>FIELDNOTES / CSSFORGE UI DIAGNOSTIC</header><main><h1>Everyday objects</h1><p id="intro">A realistic page with editable author CSS, nested tree boundaries and changing content.</p><section id="collection" class="card"><h2 id="headline">The collection</h2><p id="description">Considered materials. Useful shapes.</p><button id="target" class="primary" style="font-size:18px; border-radius:6px"><span id="target-label">Explore the collection</span></button><button id="other" class="primary">View details</button></section><div id="open-host"><strong id="slotted-label" slot="label">Slotted label</strong></div><div id="closed-host"></div><svg id="scene" viewBox="0 0 110 55"><g id="svg-group"><rect id="svg-rect" x="5" y="5" width="90" height="40" fill="#537b67"/></g></svg><a id="host-link" href="#below">Read more</a><div id="large-branch"></div><p id="below">Page tail</p></main><script>
const root=document.querySelector('#open-host').attachShadow({mode:'open'});root.innerHTML='<style>button{font:18px Arial;color:purple;padding:12px}#nested-host{padding:8px}</style><section id="shadow-section"><slot name="label"></slot><button id="shadow-target">Open shadow button</button><div id="nested-host"></div></section>';root.querySelector('#nested-host').attachShadow({mode:'open'}).innerHTML='<button id="deep-shadow">Nested shadow button</button>';document.querySelector('#closed-host').attachShadow({mode:'closed'}).innerHTML='<button>Closed boundary</button>';
const branch=document.querySelector('#large-branch');for(let i=0;i<600;i++){const s=document.createElement('span');s.id='lazy-'+i;s.textContent='Lazy item '+i;branch.append(s)}
window.hostEvents={click:0};document.querySelector('#target').addEventListener('click',()=>window.hostEvents.click++);
</script></body></html>`;

type Observation = { id: string; action: string; expected: string; actual?: unknown; actionError?: string };
type Finding = { id: string; category: string; severity: string; title: string; repro: string[]; expected: string; actual: unknown; likelyRootCause: string; moduleEvidence: string[]; priority: string; nextFixPhase: string; screenshots?: string[] };
const code = (page: Page) => page.getByTestId('live-code');
const own = (page: Page) => code(page).getByRole('region', { name: 'CSSForge overrides', exact: true });
async function pickTarget(page: Page) {
  const start = dock(page).getByRole('button', { name: 'Pick page element', exact: true });
  if (await start.count()) await start.click();
  // Hit the button's padding: its text is a separate selectable span.
  await page.locator('#target').click({ position: { x: 4, y: 4 } });
  await expect(identity(page)).toHaveText('button#target.primary');
}

async function launch(info: TestInfo) {
  await mkdir(directory, { recursive: true });
  const runtime = await setup(info, fixture, async page => {
    await page.route('http://styles.test/ui-audit.css', route => route.fulfill({ contentType: 'text/css', body: '.primary{outline-offset:2px}' }));
  });
  runtime.page.setDefaultTimeout(3500);
  const version = runtime.context.browser()!.version();
  expect(version).toMatch(/^154\./); // Infrastructure: current production Chrome.
  const cdp = await runtime.context.newCDPSession(runtime.page);
  const worlds: { id: number; origin: string }[] = [];
  cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context));
  await cdp.send('Runtime.enable');
  const world = worlds.find(item => item.origin.startsWith('chrome-extension://'));
  expect(world).toBeTruthy();
  const state = async () => {
    const result = await cdp.send('Runtime.evaluate', { contextId: world!.id, returnByValue: true, expression: `(()=>{const n=document.querySelector('cssforge-ui')?.shadowRoot?.querySelector('[data-cssforge]');if(!n)return null;let f=n[Object.getOwnPropertyNames(n).find(k=>k.startsWith('__reactFiber$'))];let p;for(let d=0;f&&d<32;d++,f=f.return){p=f.memoizedProps?.picker??f.memoizedProps?.value?.picker;if(p)break}if(!p)return null;const s=p.editor.getSnapshot();return {selection:p.getSnapshot().selection?.identity,design:s.design?{targetId:s.design.targetId,bindingGeneration:s.design.bindingGeneration}:null,context:s.context,mutationPolicy:s.mutationPolicy,lastMutation:s.lastMutation?{state:s.lastMutation.state,reason:s.lastMutation.reason}:null,undo:s.undoCount,edited:s.editedCount,error:s.error,overrides:s.overrides,reconciliation:p.reconciliation(),source:p.source()};})()` });
    return result.result.value;
  };
  return { ...runtime, version, state };
}

async function native(page: Page, selector = '#target') {
  return page.locator(selector).evaluate(node => {
    const s = getComputedStyle(node); const el = node as HTMLElement;
    return { identity: node.localName + '#' + node.id, inline: el.style?.cssText, fontSize: s.fontSize, color: s.color, background: s.backgroundColor, letterSpacing: s.letterSpacing, opacity: s.opacity, transform: s.transform, before: { color: getComputedStyle(node, '::before').color, content: getComputedStyle(node, '::before').content }, after: { color: getComputedStyle(node, '::after').color, content: getComputedStyle(node, '::after').content }, attributes: node.getAttributeNames().map(name => [name, node.getAttribute(name)]), layers: [...document.querySelectorAll('style[data-cssforge-edit-layer]')].map(n => [...((n as HTMLStyleElement).sheet?.cssRules ?? [])].map(r => r.cssText)) };
  });
}
async function ui(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('cssforge-ui')?.shadowRoot;
    const focused = root?.activeElement as HTMLElement | null;
    return { identity: root?.querySelector('[data-testid=selected-identity]')?.textContent, alerts: [...(root?.querySelectorAll('[role=alert]') ?? [])].map(n => n.textContent), focused: focused ? { tag: focused.localName, label: focused.getAttribute('aria-label'), text: focused.textContent?.slice(0,120) } : null, declarations: [...(root?.querySelectorAll('[data-property]') ?? [])].map(n => ({ property: n.getAttribute('data-property'), owned: n.getAttribute('data-owned'), source: n.getAttribute('data-source-state'), cascade: n.getAttribute('data-cascade-status'), text: n.textContent, editor: !!n.querySelector('.cm-content') })), tree: [...(root?.querySelectorAll('[role=treeitem]') ?? [])].map(n => ({ label: n.getAttribute('aria-label'), level: n.getAttribute('aria-level'), selected: n.getAttribute('aria-selected'), expanded: n.getAttribute('aria-expanded'), tabIndex: (n as HTMLElement).tabIndex })), dialogs: [...(root?.querySelectorAll('[role=dialog]') ?? [])].map(n => ({ label: n.getAttribute('aria-label'), modal: n.getAttribute('aria-modal'), bounds: n.getBoundingClientRect().toJSON(), scrollWidth: n.scrollWidth, clientWidth: n.clientWidth })) };
  });
}
async function edit(row: Locator, property: string, value: string) {
  await row.getByRole('button', { name: `Edit ${property}`, exact: true }).click();
  const input = row.getByRole('textbox', { name: `CSS value ${property}`, exact: true });
  await input.fill(value); await input.press('Enter');
}
async function choose(page: Page, menu: string, option: string | RegExp) {
  await page.getByRole('button', { name: menu, exact: true }).click();
  await page.getByRole('button', { name: option, exact: typeof option === 'string' }).click();
  await page.keyboard.press('Escape');
}
async function save(info: TestInfo, name: string, payload: unknown) {
  const file = path.join(directory, name + '.json');
  await writeFile(file, JSON.stringify(payload, null, 2));
  await info.attach(name, { path: file, contentType: 'application/json' });
}
async function shot(page: Page, name: string) {
  await page.mouse.move(0,0);
  const file = path.join(directory, name + '.png');
  await page.screenshot({ path: file, animations: 'disabled' });
  return file;
}
async function step(observations: Observation[], id: string, action: string, expected: string, work: () => Promise<unknown>) {
  try { observations.push({ id, action, expected, actual: await work() }); }
  catch (e) { observations.push({ id, action, expected, actionError: String(e) }); }
}

test('current UI diagnostic — Code attribution, editing, validation, refresh and migration', async ({}, info) => {
  test.setTimeout(150000);
  const r = await launch(info), { page } = r, observations: Observation[] = [], findings: Finding[] = [];
  try {
    await pickTarget(page); await page.getByRole('tab', { name: 'Code', exact: true }).click();
    await expect(code(page)).toBeVisible();
    const inline = code(page).getByRole('region', { name: 'Inline authored CSS' });
    await step(observations,'CT01','Inspect shipped Code sources and every visible declaration state','Authored CSS is distinct from session overrides; unavailable author toggles and sources are explained.',async()=>({engine:await r.state(),ui:await ui(page),text:await code(page).innerText(),native:await native(page),authorButtons:await code(page).getByRole('checkbox',{name:/Authored declaration/}).evaluateAll(nodes=>nodes.map(n=>({label:n.getAttribute('aria-label'),disabled:(n as HTMLInputElement).disabled}))),screenshot:await shot(page,'01-code-baseline')}));
    await step(observations,'CT02','Edit inline authored font-size to 26px through Code','A session override appears; original inline CSS remains intact.',async()=>{await edit(inline,'font-size','26px');return {ui:await ui(page),native:await native(page),engine:await r.state()}});
    await step(observations,'CT03','Replace override with invalid CSS and press Enter','The page retains 26px, editor preserves draft/focus, and a useful validation error appears.',async()=>{await edit(own(page),'font-size','broken-value');return {ui:await ui(page),native:await native(page),screenshot:await shot(page,'02-code-invalid')}});
    await step(observations,'CT04','Correct invalid draft to 30px and apply repeatedly','Valid edit clears feedback, applies 30px, and leaves a predictable keyboard focus.',async()=>{const input=own(page).getByRole('textbox',{name:'CSS value font-size',exact:true});await input.fill('30px');await input.press('Enter');return {ui:await ui(page),native:await native(page),engine:await r.state()}});
    await step(observations,'CT05','Toggle font-size override off, Undo, off and on','Only the session declaration toggles; Undo restores it without changing authored CSS.',async()=>{const toggle=own(page).getByRole('checkbox',{name:'Toggle override font-size',exact:true});await toggle.uncheck();const off=await native(page);await own(page).getByRole('button',{name:'Undo last edit',exact:true}).click();const undone=await native(page);await toggle.uncheck();await toggle.check();return {off,undone,on:await native(page),ui:await ui(page)}});
    await step(observations,'CT06','Open an override value editor, type 33px, Escape','Escape cancels the unfinished draft and returns to the value button without changing the page.',async()=>{await own(page).getByRole('button',{name:'Edit font-size',exact:true}).click();const input=own(page).getByRole('textbox',{name:'CSS value font-size',exact:true});await input.fill('33px');await input.press('Escape');const snapshot={ui:await ui(page),native:await native(page),screenshot:await shot(page,'03-code-escape-draft')};if(await own(page).getByRole('button',{name:'Cancel',exact:true}).count())await own(page).getByRole('button',{name:'Cancel',exact:true}).click();return snapshot});
    await step(observations,'CT07','Cancel a value draft using its visible Cancel button','Draft is discarded and keyboard focus returns to a useful Code control.',async()=>{await own(page).getByRole('button',{name:'Edit font-size',exact:true}).click();await own(page).getByRole('textbox',{name:'CSS value font-size',exact:true}).fill('34px');await own(page).getByRole('button',{name:'Cancel',exact:true}).click();return {ui:await ui(page),native:await native(page)}});
    await step(observations,'CT08','Reset session edits from Code','All current session declarations are removed and authored 18px is restored.',async()=>{await own(page).getByRole('button',{name:'Reset session edits',exact:true}).click();return {ui:await ui(page),native:await native(page),engine:await r.state()}});
    await step(observations,'CT09','Add an unsupported declaration, then correct to color:red','Unsupported property shows a useful error; correcting succeeds and removes stale error.',async()=>{await own(page).getByRole('button',{name:'Add session declaration',exact:true}).click();await own(page).getByRole('textbox',{name:'CSS property',exact:true}).fill('unsupported-property');await own(page).getByRole('textbox',{name:'New CSS value',exact:true}).fill('red');await own(page).getByRole('button',{name:'Apply',exact:true}).click();const invalid=await ui(page);await own(page).getByRole('textbox',{name:'CSS property',exact:true}).fill('color');await own(page).getByRole('button',{name:'Apply',exact:true}).click();return {invalid,valid:await ui(page),native:await native(page)}});
    await step(observations,'CT10','Change external CSSOM and inline CSS, compare before and after Refresh sources','Code follows its explicit refresh contract; Refresh shows both new author declarations and updated cascade.',async()=>{await page.evaluate(()=>{const s=(document.querySelector('#author') as HTMLStyleElement).sheet!;s.insertRule('#target{letter-spacing:7px}',s.cssRules.length);(document.querySelector('#target') as HTMLElement).style.setProperty('text-align','left')});const stale=await ui(page);await code(page).getByRole('button',{name:'Refresh sources',exact:true}).click();return {stale,refreshed:await ui(page),native:await native(page),engine:await r.state(),screenshot:await shot(page,'04-code-refreshed')}});
    await step(observations,'CT11','Edit color with visible Code swatch','Native color input creates the same session declaration as text editing.',async()=>{const swatch=own(page).getByRole('textbox',{name:'Code color color',exact:true});const input=own(page).locator('input[type=color]');if(await input.count()){await input.fill('#334455');return {ui:await ui(page),native:await native(page)}}return {swatchCount:await swatch.count(),reason:'No native swatch for CSS color keyword red; inspect authored RGB swatch separately',authoredSwatches:await code(page).locator('input[type=color]').count()}});
    await step(observations,'CT12','Draft an override, replace selected target with same stable identity, and inspect UI','Migration preserves applied session edits, remounts stale Code draft, and exposes current sources.',async()=>{await own(page).getByRole('button',{name:'Edit color',exact:true}).click();await own(page).getByRole('textbox',{name:'CSS value color',exact:true}).fill('#225544');await page.locator('#target').evaluate(n=>n.outerHTML='<button id="target" class="primary" style="font-size:21px; border-radius:8px"><span id="target-label">Replacement collection</span></button>');await page.waitForTimeout(250);return {ui:await ui(page),native:await native(page),engine:await r.state(),screenshot:await shot(page,'05-code-migrated')}});
    await step(observations,'CT13','Reset migrated session edits and remove target','Reset restores replacement authored values; removal clears invalid editable selection.',async()=>{if(await own(page).getByRole('button',{name:'Reset session edits',exact:true}).count())await own(page).getByRole('button',{name:'Reset session edits',exact:true}).click();const reset=await native(page);await page.locator('#target').evaluate(n=>n.remove());await page.waitForTimeout(250);return {reset,ui:await ui(page),engine:await r.state()}});
    await save(info,'code-observations',{runtime:{chrome:r.version,build:'.output/chrome-mv3',editing:'UI only; engine/source snapshots are read-only'},observations,findings,pageErrors:r.errors});
  } finally { await r.context.close(); }
});

test('current UI diagnostic — existing Media and state contexts with Code and Undo integration', async ({}, info) => {
  test.setTimeout(150000);
  const r=await launch(info),{page}=r,observations:Observation[]=[];
  try {
    await pickTarget(page);
    await step(observations,'CX01','Open existing Media control and inspect every offered context','Only readable relevant contexts appear; active/inactive viewport and bounded limitations are explained.',async()=>{await page.getByRole('button',{name:'Media',exact:true}).click();const items=await page.getByRole('dialog',{name:'Media',exact:true}).innerText();const screenshot=await shot(page,'06-media-options');await page.keyboard.press('Escape');return {items,screenshot,engine:await r.state()}});
    await step(observations,'CX02','Select inactive max-width media and edit Font size to 29px','Media selection scopes CSS without forcing viewport; browser keeps current 18px until viewport matches.',async()=>{await choose(page,'Media',/\(max-width: 700px\)/);const input=page.getByRole('textbox',{name:'Font size',exact:true});await input.fill('29px');await input.press('Enter');return {ui:await ui(page),native:await native(page),engine:await r.state()}});
    await step(observations,'CX03','Narrow viewport to 640px, then return to 1440px','Conditional edit activates and deactivates with actual viewport; media context remains distinct.',async()=>{await page.setViewportSize({width:640,height:900});const narrow=await native(page);await page.setViewportSize({width:1440,height:900});return {narrow,wide:await native(page),engine:await r.state()}});
    await step(observations,'CX04','Select nested min-width + reduced-motion media','Existing nested media retains both conditions and accurately states viewport activity.',async()=>{await choose(page,'Media',/prefers-reduced-motion/);return {ui:await ui(page),engine:await r.state(),note:await page.getByTestId('context-note').innerText()}});
    await choose(page,'Media','Base · all viewports');
    await step(observations,'CX05','Open State or pseudo and inspect every existing choice','Current, hover, focus, active, before and after are named, and no forcing is explained.',async()=>{await page.getByRole('button',{name:'State or pseudo',exact:true}).click();const items=await page.getByRole('dialog',{name:'State or pseudo',exact:true}).innerText();const screenshot=await shot(page,'07-state-options');await page.keyboard.press('Escape');return {items,screenshot}});
    for(const [pseudo,property,value,computed] of [[':hover','color','#aabbcc','color'],[':focus','opacity','0.6','opacity'],[':active','opacity','0.7','opacity'],['::before','color','#123456','before'],['::after','color','#654321','after']] as const){
      await step(observations,'CX-'+pseudo,`Select ${pseudo} and add ${property}:${value} through Code`,'Rule context changes without forcing an interactive state; pseudo-element edits style existing generated content.',async()=>{await page.getByRole('tab',{name:'Design',exact:true}).click();await choose(page,'State or pseudo',pseudo);await page.getByRole('tab',{name:'Code',exact:true}).click();await own(page).getByRole('button',{name:'Add session declaration',exact:true}).click();await own(page).getByRole('textbox',{name:'CSS property',exact:true}).fill(property);await own(page).getByRole('textbox',{name:'New CSS value',exact:true}).fill(value);await own(page).getByRole('button',{name:'Apply',exact:true}).click();await page.mouse.move(0,0);const inactive=await native(page);if(pseudo===':hover')await page.locator('#target').hover();if(pseudo===':focus')await page.locator('#target').focus();if(pseudo===':active'){await page.locator('#target').hover();await page.mouse.down()}const actual=await native(page);if(pseudo===':active')await page.mouse.up();return {inactive,actual,computed,ui:await ui(page),engine:await r.state()}});
    }
    await step(observations,'CX06','Undo last contextual edit, then Reset all contexts from Code','Undo affects only the last declaration; Reset removes every media and pseudo session edit.',async()=>{await own(page).getByRole('button',{name:'Undo last edit',exact:true}).click();const undone={native:await native(page),engine:await r.state()};await own(page).getByRole('button',{name:'Reset session edits',exact:true}).click();await page.mouse.move(0,0);return {undone,reset:{native:await native(page),engine:await r.state()},ui:await ui(page),screenshot:await shot(page,'08-context-reset')}});
    await save(info,'context-observations',{runtime:{chrome:r.version},observations,pageErrors:r.errors});
  } finally {await r.context.close()}
});

test('current UI diagnostic — HTML and Navigator tree, boundaries, lazy branches, keyboard and lifecycle',async({},info)=>{
  test.setTimeout(180000);
  const r=await launch(info),{page}=r,observations:Observation[]=[];
  try{
    await pickTarget(page);await page.getByRole('tab',{name:'HTML',exact:true}).click();
    await expect(page.getByRole('tree',{name:'Page DOM tree'})).toBeVisible();
    await step(observations,'TR01','Inspect HTML tree, selected path and all navigation controls','The selected real node appears once; parent/child/previous/next reflect actual DOM; extension UI is excluded.',async()=>({ui:await ui(page),text:await page.getByRole('tabpanel',{name:'HTML',exact:true}).innerText(),screenshot:await shot(page,'09-html-baseline')}));
    for(const control of ['Previous sibling','Next sibling','Parent','Child'] as const)await step(observations,'TR-nav-'+control,`Activate ${control} DOM navigation`,'Selection, inspector identity and outline follow the actual DOM relationship.',async()=>{const before=await identity(page).innerText();await page.getByRole('button',{name:control,exact:true}).click();return {before,ui:await ui(page),engine:await r.state()}});
    await pickTarget(page);
    await step(observations,'TR02','Move tree focus with arrows, Home/End and Enter','Keyboard moves among treeitems, Enter selects, and current node retains one roving tab stop.',async()=>{const selected=page.getByRole('treeitem',{selected:true});await selected.focus();await selected.press('ArrowDown');const arrow=await ui(page);await page.keyboard.press('Enter');const enter=await ui(page);await page.getByRole('treeitem',{selected:true}).focus();await page.keyboard.press('Home');const home=await ui(page);await page.keyboard.press('End');return {arrow,enter,home,end:await ui(page)}});
    await step(observations,'TR03','Open Navigator; select a page node, close with Escape','Modal contains real tree, synchronizes selection with page/HTML, traps focus, and restores opener.',async()=>{await page.getByRole('button',{name:'Open Navigator',exact:true}).first().click();const dialog=page.getByRole('dialog',{name:'Navigator',exact:true});const baseline=await ui(page);await dialog.getByRole('treeitem',{name:'h2#headline',exact:true}).click();const selected=await ui(page);const screenshot=await shot(page,'10-navigator-selected');await page.keyboard.press('Escape');return {baseline,selected,closed:await ui(page),screenshot}});
    await step(observations,'TR04','Navigate nested open shadow roots and their parent boundaries','Nested shadow node is selectable; Parent follows composed inspectable ancestry and boundaries are named.',async()=>{await pick(page,'#deep-shadow');const deep=await ui(page);await page.getByRole('button',{name:'Parent',exact:true}).click();const parent=await ui(page);await page.getByRole('button',{name:'Parent',exact:true}).click();return {deep,parent,ancestor:await ui(page),screenshot:await shot(page,'11-html-nested-shadow')}});
    await step(observations,'TR05','Select a slotted label; inspect parent and child tree behavior','Slot boundaries do not duplicate or lose assigned nodes; real selection remains consistent.',async()=>{await pick(page,'#slotted-label');const selected=await ui(page);await page.getByRole('button',{name:'Parent',exact:true}).click();return {selected,parent:await ui(page),engine:await r.state()}});
    await step(observations,'TR06','Select closed shadow host and inspect child availability','Closed content is unavailable and Child is disabled; visible boundary note explains limitation.',async()=>{await pick(page,'#closed-host');return {ui:await ui(page),childDisabled:await page.getByRole('button',{name:'Child',exact:true}).isDisabled(),text:await page.getByRole('tabpanel',{name:'HTML',exact:true}).innerText()}});
    await step(observations,'TR07','Pick SVG rectangle and navigate its parent','SVG is an actual selected element; tree identifies rect, group and SVG ancestry.',async()=>{await pick(page,'#svg-rect');const rect=await ui(page);await page.getByRole('button',{name:'Parent',exact:true}).click();return {rect,parent:await ui(page)}});
    await step(observations,'TR08','Pick late lazy item and collapse/expand its branch','Bounded branch keeps selected late sibling in view and explains truncation; expansion controls work.',async()=>{await pick(page,'#lazy-550');const lazy=await ui(page);const tree=page.getByRole('tree',{name:'Page DOM tree'});await page.getByRole('button',{name:'Collapse div#large-branch',exact:true}).click();const collapsed=await ui(page);await page.getByRole('button',{name:'Expand div#large-branch',exact:true}).click();return {lazy,collapsed,expanded:await ui(page),count:await tree.getByRole('treeitem').count(),text:await page.getByRole('tabpanel',{name:'HTML',exact:true}).innerText(),screenshot:await shot(page,'12-html-lazy-branch')}});
    await pickTarget(page);
    await step(observations,'TR09','Append a sibling, compare stale tree, then Refresh tree','Tree follows its explicit refresh contract and new page nodes become selectable after refresh.',async()=>{await page.locator('#target').evaluate(n=>n.insertAdjacentHTML('afterend','<button id="fresh-sibling">New sibling</button>'));const before=await ui(page);await page.getByRole('button',{name:'Refresh tree',exact:true}).click();const refreshed=await ui(page);await page.getByRole('treeitem',{name:'button#fresh-sibling',exact:true}).click();return {before,refreshed,selected:await ui(page)}});
    await step(observations,'TR10','Replace selected node and remove it while Navigator is open','Replacement migrates identity and selected row; removal clears both modal and inspector selection safely.',async()=>{await page.getByRole('button',{name:'Open Navigator',exact:true}).first().click();await page.locator('#fresh-sibling').evaluate(n=>n.outerHTML='<button id="fresh-sibling">Replacement sibling</button>');await page.waitForTimeout(250);const migrated={ui:await ui(page),engine:await r.state()};await page.locator('#fresh-sibling').evaluate(n=>n.remove());await page.waitForTimeout(250);const removed={ui:await ui(page),engine:await r.state()};const screenshot=await shot(page,'13-navigator-removed-selection');await page.getByRole('dialog',{name:'Navigator',exact:true}).getByRole('button',{name:'Back to canvas',exact:true}).click();return {migrated,removed,screenshot}});
    await step(observations,'TR11','Navigator Pick element returns to page picker and selects target','Modal closes, picking activates, and page selection resumes without host interaction.',async()=>{await page.getByRole('button',{name:'Open Navigator',exact:true}).first().click();await page.getByRole('dialog',{name:'Navigator',exact:true}).getByRole('button',{name:'Pick element',exact:true}).click();await page.locator('#target').click({position:{x:4,y:4}});return {ui:await ui(page),hostEvents:await page.evaluate(()=>(window as any).hostEvents)}});
    await step(observations,'TR12','Inspect Code and HTML/Navigator at 390px and actual 200% tab zoom','Panels fit viewport; long CSS/tree labels remain usable; modal content remains scrollable.',async()=>{await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'Code',exact:true}).click();const codeBounds=await code(page).evaluate(n=>({bounds:n.getBoundingClientRect().toJSON(),scrollWidth:n.scrollWidth,clientWidth:n.clientWidth}));const narrowCode=await shot(page,'14-code-narrow');await page.getByRole('tab',{name:'HTML',exact:true}).click();await page.getByRole('button',{name:'Open Navigator',exact:true}).first().click();const narrow=await ui(page);const narrowNavigator=await shot(page,'15-navigator-narrow');await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:1000});await r.worker.evaluate(id=>(globalThis as any).chrome.tabs.setZoom(id,2),r.tabId);await page.waitForTimeout(150);await page.getByRole('button',{name:'Open Navigator',exact:true}).first().click();return {codeBounds,narrow,zoom:await ui(page),viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight})),screenshots:[narrowCode,narrowNavigator,await shot(page,'16-navigator-200pct')]}});
    await save(info,'tree-observations',{runtime:{chrome:r.version},observations,pageErrors:r.errors});
  }finally{await r.context.close()}
});

test('current UI diagnostic — focused follow-up evidence for Code keyboard, swatches and slot ancestry',async({},info)=>{
  test.setTimeout(90000);
  const r=await launch(info),{page}=r,observations:Observation[]=[];
  try{
    await pickTarget(page);await page.getByRole('tab',{name:'Code',exact:true}).click();
    await step(observations,'FU01','Apply inline authored font-size in Code using only the keyboard, then Tab','Success returns focus to the edited value and Tab continues within its Code row.',async()=>{await edit(code(page).getByRole('region',{name:'Inline authored CSS'}),'font-size','25px');const afterApply=await ui(page);const documentFocus=await page.evaluate(()=>({tag:document.activeElement?.localName,id:document.activeElement?.id}));await page.keyboard.press('Tab');return {afterApply,documentFocus,afterTab:await ui(page),native:await native(page)}});
    await step(observations,'FU02','Escape a new Code draft, then Cancel it and Tab','Escape or Cancel discards the draft and returns focus to the value control.',async()=>{await own(page).getByRole('button',{name:'Edit font-size',exact:true}).click();await own(page).getByRole('textbox',{name:'CSS value font-size',exact:true}).fill('33px');await page.keyboard.press('Escape');const afterEscape=await ui(page);const screenshot=await shot(page,'17-code-escape-followup');await own(page).getByRole('button',{name:'Cancel',exact:true}).click();const afterCancel=await ui(page);const documentFocus=await page.evaluate(()=>({tag:document.activeElement?.localName,id:document.activeElement?.id}));await page.keyboard.press('Tab');return {afterEscape,afterCancel,documentFocus,afterTab:await ui(page),screenshot}});
    await step(observations,'FU03','Apply native RGB authored Code color swatch','A native color edit creates an attributed session override, leaves authored source intact and participates in Undo.',async()=>{const swatch=code(page).getByRole('region',{name:'Readable matching CSS'}).locator('input[type=color]').first();await swatch.fill('#334455');const applied={ui:await ui(page),native:await native(page),engine:await r.state()};await own(page).getByRole('button',{name:'Undo last edit',exact:true}).click();return {applied,undone:await native(page)}});
    await own(page).getByRole('button',{name:'Reset session edits',exact:true}).click();
    await page.getByRole('tab',{name:'HTML',exact:true}).click();
    await step(observations,'FU04','ArrowRight on expanded selected button, then ArrowLeft on its leaf child','Tree keys navigate expanded child/parent relationships as well as toggling branches.',async()=>{const selected=page.getByRole('treeitem',{name:'button#target.primary',exact:true});await selected.focus();await selected.press('ArrowRight');const right=await ui(page);const leaf=page.getByRole('treeitem',{name:'span#target-label',exact:true});await leaf.focus();await leaf.press('ArrowLeft');const left=await ui(page);return {right,left,screenshot:await shot(page,'18-tree-keyboard')}});
    await step(observations,'FU05','Pick slotted light-DOM label, inspect HTML, then open Navigator and refresh','The selected assigned node remains visible exactly once and its slot ancestry is traversable in both trees.',async()=>{await pick(page,'#slotted-label');const html=await ui(page);const htmlScreenshot=await shot(page,'19-html-slotted-selected');await page.getByRole('button',{name:'Open Navigator',exact:true}).first().click();const navigator=await ui(page);await page.getByRole('dialog',{name:'Navigator',exact:true}).getByRole('button',{name:'Refresh tree',exact:true}).click();const refreshed=await ui(page);return {html,navigator,refreshed,screenshots:[htmlScreenshot,await shot(page,'20-navigator-slotted-selected')]}});
    await page.keyboard.press('Escape');
    await step(observations,'FU06','Use actual HTML tree to select slot and Child to select assigned node','Visible slot nodes can navigate assigned content even when picked-node ancestry initially omitted it.',async()=>{await pick(page,'#shadow-target');const section=page.getByRole('button',{name:'Expand section#shadow-section',exact:true});if(await section.count())await section.click();await page.getByRole('treeitem',{name:'slot',exact:true}).click();const slot=await ui(page);await page.getByRole('button',{name:'Child',exact:true}).click();return {slot,child:await ui(page),screenshot:await shot(page,'21-html-slot-child')}});
    await save(info,'followup-observations',{runtime:{chrome:r.version},observations,pageErrors:r.errors});
  }finally{await r.context.close()}
});
