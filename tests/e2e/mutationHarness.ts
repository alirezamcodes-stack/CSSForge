import { expect, type TestInfo } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { setup, pick, dock, inspector } from './extensionHarness';

const template = await readFile('tests/e2e/fixtures/mutation-audit.html', 'utf8');
export const html = (css = '#target{font-size:18px;color:purple}', scene = '<button id="target">Target</button>', extra = '') => template.replace('/* audit css */', css).replace('<!-- scene -->', scene).replace('<!-- extra -->', extra);
export async function launch(info: TestInfo, fixture = html()) {
  const runtime = await setup(info, fixture), cdp = await runtime.context.newCDPSession(runtime.page);
  const worlds: { id: number; origin: string }[] = [];
  cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context)); await cdp.send('Runtime.enable');
  let world = worlds.find(item => item.origin.startsWith('chrome-extension://'))!;
  const read = async <T = any>(expression: string): Promise<T> => {
    const result = await cdp.send('Runtime.evaluate', { contextId: world.id, expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value;
  };
  const bind = async () => {
    world = worlds.filter(item => item.origin.startsWith('chrome-extension://')).at(-1)!;
    await read(`globalThis.__p=(()=>{const n=document.querySelector('cssforge-ui').shadowRoot.querySelector('[data-cssforge]');let f=n[Object.getOwnPropertyNames(n).find(k=>k.startsWith('__reactFiber$'))];for(let d=0;f&&d<32;d++,f=f.return){if(f.memoizedProps?.picker)return f.memoizedProps.picker;if(f.memoizedProps?.value?.picker)return f.memoizedProps.value.picker;}throw Error('Built picker missing');})();true`);
  };
  await bind();
  const status = () => read(`(()=>{const e=__p.editor,s=e.getSnapshot(),r=s.lastMutation,t=r?.target;return {target:s.design?.targetId,undo:s.undoCount,error:s.error,context:s.context,state:r?.state,reason:r?.reason,scope:r?.scope??t?.scope,sourceId:t?.sourceId,ruleId:t?.ruleId,declarationId:t?.declarationId,active:e.authorMutation.active().map(c=>({kind:c.kind,state:c.state,reason:c.reason,sourceId:c.target.sourceId,ruleId:c.target.ruleId,property:c.target.property,before:c.before,after:c.after,attempted:c.attempted,current:c.current,generation:c.generation})),overrides:s.overrides,reconciliation:__p.reconciliation().state,reconciliationStats:__p.reconciliationStats(),mutation:e.authorMutation.getStats()};})()`);
  const author = (property: string, value: string, options = {}) => read(`__p.editor.applyAuthor(__p.editor.getSnapshot().design.targetId,${JSON.stringify(property)},${JSON.stringify(value)},${JSON.stringify(options)})`);
  const css = () => runtime.page.locator('#author').evaluate(node => [...(node as HTMLStyleElement).sheet!.cssRules].map(rule => rule.cssText));
  const prepare = (property = 'font-size', options = {}) => read(`globalThis.__plan=__p.editor.authorMutation.prepare({element:__p.targetLocator().identity.element,property:${JSON.stringify(property)},value:'24px',context:__p.editor.getSnapshot().context,...${JSON.stringify(options)}});!('state' in __plan)`);
  const applyPlan = () => read(`(()=>{const r=__p.editor.authorMutation.apply(__plan,'24px');globalThis.__planResult=r;return {state:r.state,reason:r.reason,sourceId:r.target?.sourceId,ruleId:r.target?.ruleId};})()`);
  return { ...runtime, read, bind, status, author, css, prepare, applyPlan };
}
type Outcome = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export async function evidence(info: TestInfo, outcomes: Outcome[], actual: unknown, expectedPolicy: string, defect = false) {
  const directory = 'artifacts/diagnostics/mutation-conflict-fixes'; await mkdir(directory, { recursive: true });
  const file = `${directory}/${info.title.split(' ')[0]}.json`;
  await writeFile(file, JSON.stringify({ case: info.title, outcomes, defect, expectedPolicy, actual }, null, 2)); await info.attach('conflict-audit', { path: file, contentType: 'application/json' });
}

export const nativeCallback = (replace = false, sideEffect = true) => `<script>customElements.define('audit-button',class extends HTMLButtonElement{static get observedAttributes(){return ['style']}attributeChangedCallback(){if(this.style.fontSize!=='24px'||this.once)return;this.once=true;${sideEffect ? "this.style.color='green';" : ''}${replace ? "window.retired=this;this.outerHTML='<button id=target style=font-size:21px>Replacement</button>';" : ''}}},{extends:'button'});</script>`;
