import { describe, expect, it, vi } from 'vitest';
import { createDOMMutation, createDOMLedger } from '../src/editing/dom';
import { resolveText } from '../src/editing/dom/resolve';
import { updateTextDraft } from '../src/editing/dom/draft';

class NativeText {
  nodeType = 3; parentNode: unknown; ownerDocument: unknown; isConnected = true;
  value = 'Original';
  get data() { return this.value; }
  set data(value: string) { this.value = value; }
}
function fixture(tag = 'button') {
  const root = {}, doc: any = { documentElement: root, defaultView: { Text: NativeText, CharacterData: NativeText } };
  const text = new NativeText(); text.ownerDocument = doc;
  const owner: any = { localName: tag, namespaceURI: 'http://www.w3.org/1999/xhtml', ownerDocument: doc, isConnected: true, childNodes: [text], parentElement: null, isContentEditable: false, getRootNode: () => doc, getAttribute: () => null };
  text.parentNode = owner;
  const identity: any = { element: owner, root: doc, document: doc, session: {} };
  let selected = true, generation = 0;
  const ledger = createDOMLedger(doc), changed = vi.fn();
  const mutation = createDOMMutation(doc, ledger, () => selected && owner.isConnected, plan => selected && plan.bindingGeneration === generation, changed);
  const prepare = () => mutation.prepare('1', generation, identity, 'button');
  return { doc, text, owner, identity, ledger, mutation, changed, prepare, deselect: () => { selected = false; }, replaceGeneration: () => { generation++; } };
}
describe('exact native text domain, before UI integration', () => {
  it.each([['a\r\nb','a\nb','a\r\nb'],['a\r\nb','A\nb','A\r\nb'],['a\rb\r\nc','a\nb\nC','a\rb\r\nC'],['a','a\nb','a\nb']])('preserves unchanged native newlines in textarea drafts', (before,input,expected)=>{expect(updateTextDraft(before,input)).toBe(expected);});
  it('resolves a single direct Text without touching CSS or markers', () => { const f = fixture(); expect(resolveText(f.identity).state).toBe('available'); });
  it.each(['input','textarea','select','option','canvas','iframe','script','style','x-host'])('refuses unsupported %s', tag => { expect(resolveText(fixture(tag).identity).state).toBe('UNAVAILABLE'); });
  it('refuses nested markup, comments and multiple text nodes', () => { const f=fixture(); for(const children of [[f.text,{}],[{}],[]]){f.owner.childNodes=children;expect(resolveText(f.identity).state).toBe('UNAVAILABLE');} });
  it('refuses editable ancestors and SVG', () => { const f=fixture(); f.owner.isContentEditable=true;expect(resolveText(f.identity).state).toBe('UNAVAILABLE'); f.owner.isContentEditable=false;f.owner.namespaceURI='http://www.w3.org/2000/svg';expect(resolveText(f.identity).state).toBe('UNAVAILABLE'); });
  it.each(['','  spaces  ','line\nline','مرحبا 🧑🏽‍💻 e\u0301','<img src=x onerror=alert(1)>'])('stores exact literal data: %j', value => {const f=fixture(),plan=f.prepare();expect(f.mutation.apply(plan as any,value,1).state).toBe('applied');expect(f.text.data).toBe(value);expect(f.owner.childNodes).toEqual([f.text]);});
  it('Cancel/prepare never writes or records a transaction', () => {const f=fixture();f.prepare();expect(f.text.data).toBe('Original');expect(f.ledger.active()).toHaveLength(0);});
  it('never uses HTML or whole-element text setters and ignores copied CSSForge markers',()=>{
    const f=fixture();f.owner.getAttribute=(name:string)=>name.startsWith('data-cssforge')?'copied-marker':null;
    for(const property of ['innerHTML','outerHTML','textContent'])Object.defineProperty(f.owner,property,{get(){throw Error('Forbidden element read')},set(){throw Error('Forbidden element write')}});
    const result=f.mutation.apply(f.prepare() as any,'<b>Literal</b>',1);expect(result.state).toBe('applied');
    if(result.state==='applied')expect(f.mutation.rollback(result.change)).toBe(true);expect(f.text.data).toBe('Original');
  });
  it('rejects foreign documents, closed roots and changed editable semantics',()=>{
    const f=fixture();f.owner.ownerDocument={};expect(resolveText(f.identity).state).toBe('UNAVAILABLE');f.owner.ownerDocument=f.doc;
    const closed={mode:'closed'};f.owner.getRootNode=()=>closed;expect(resolveText({...f.identity,root:closed} as any).state).toBe('UNAVAILABLE');
    f.owner.getRootNode=()=>f.doc;const p=f.prepare();f.owner.isContentEditable=true;expect(f.mutation.apply(p as any,'bad',1).state).toBe('UNAVAILABLE');expect(f.text.data).toBe('Original');
  });
  it('rejects fabricated/reused plans', () => {const f=fixture();expect(f.mutation.apply({} as any,'bad',1).state).toBe('STALE');const p=f.prepare() as any;f.mutation.apply(p,'new',1);expect(f.mutation.apply(p,'again',2).state).toBe('STALE');});
  it('rejects changed selection and generation', () => {for(const method of ['deselect','replaceGeneration'] as const){const f=fixture(),p=f.prepare();f[method]();expect(f.mutation.apply(p as any,'bad',1).state).toBe('STALE');expect(f.text.data).toBe('Original');}});
  it('rejects changed baseline without overwriting host data', () => {const f=fixture(),p=f.prepare();f.text.data='Host';expect(f.mutation.apply(p as any,'bad',1).state).toBe('CONFLICT');expect(f.text.data).toBe('Host');});
  it('does not transfer authority to an equal-string replacement Text', () => {const f=fixture(),p=f.prepare();f.owner.childNodes=[new NativeText()];f.text.parentNode=null;expect(f.mutation.apply(p as any,'bad',1).state).toBe('UNAVAILABLE');});
  it('restores only an exact owned value', () => {const f=fixture(),r=f.mutation.apply(f.prepare() as any,'New',1);expect(r.state).toBe('applied');if(r.state==='applied'){expect(f.mutation.rollback(r.change)).toBe(true);expect(f.text.data).toBe('Original');expect(f.ledger.active()).toHaveLength(0);}});
  it('retains conflicts for safe Undo/Reset', () => {const f=fixture(),r=f.mutation.apply(f.prepare() as any,'New',1);if(r.state==='applied'){f.text.data='Host';expect(f.mutation.rollback(r.change)).toBe(false);expect(f.text.data).toBe('Host');expect(f.ledger.active()).toHaveLength(1);expect(r.change.state).toBe('CONFLICT');}});
  it('restores stacked text records in reverse order', () => {const f=fixture(),a=f.mutation.apply(f.prepare() as any,'One',1),b=f.mutation.apply(f.prepare() as any,'Two',2);if(a.state==='applied'&&b.state==='applied'){expect(f.mutation.rollback(b.change)).toBe(true);expect(f.text.data).toBe('One');expect(f.mutation.rollback(a.change)).toBe(true);expect(f.text.data).toBe('Original');}});
  it('rejects an older record even when a host value equals its applied text',()=>{const f=fixture(),a=f.mutation.apply(f.prepare() as any,'One',1);f.mutation.apply(f.prepare() as any,'Two',2);f.text.data='One';if(a.state==='applied')expect(f.mutation.rollback(a.change)).toBe(false);expect(f.text.data).toBe('One');});
  it('keeps conflicts through deactivate, retiring document references on navigation', () => {const f=fixture(),r=f.mutation.apply(f.prepare() as any,'New',1);f.text.data='Host';f.mutation.destroy();expect(f.ledger.active()).toHaveLength(1);f.ledger.retire('Navigation');expect(f.ledger.active()).toHaveLength(0);if(r.state==='applied')expect(r.change.state).toBe('retired');});
  it('deactivation restores safely owned text', () => {const f=fixture();f.mutation.apply(f.prepare() as any,'New',1);f.mutation.destroy();expect(f.text.data).toBe('Original');});
  it('reports native write failure without a false success', () => {const f=fixture(),p=f.prepare();Object.defineProperty(f.text,'value',{set(){throw Error('blocked')},get(){return 'Original'}});expect(f.mutation.apply(p as any,'bad',1).state).toBe('FAILED');});
});
