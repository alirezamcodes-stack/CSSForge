import { describe, expect, it, vi } from 'vitest';
import { createDOMLedger } from '../src/editing/dom';
import { createStructureMutation, structureLimits, type StructurePlan, type StructureOperation, type DOMStructureChange } from '../src/editing/dom/structure';

// Native graph substitute: tests exercise identity/gaps, never HTML string fixtures.
class NativeNode {
  childNodes: NativeNode[] = []; parentNode: NativeNode | null = null; ownerDocument: any; nodeType = 1; data = '';
  constructor(public localName = 'div', doc?: any) { this.ownerDocument = doc; }
  get parentElement(): any { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild(): NativeNode | null { return this.childNodes.at(-1) ?? null; }
  get previousSibling(): NativeNode | null { return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) - 1] ?? null; }
  get nextSibling(): NativeNode | null { return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) + 1] ?? null; }
  get previousElementSibling(): any { let node = this.previousSibling; while (node && node.nodeType !== 1) node = node.previousSibling; return node; }
  get nextElementSibling(): any { let node = this.nextSibling; while (node && node.nodeType !== 1) node = node.nextSibling; return node; }
  getRootNode(): any { return this.parentNode?.getRootNode() ?? this; }
  get isConnected(): boolean { return this.getRootNode().nodeType === 9; }
  insertBefore(node: NativeNode, next: NativeNode | null) {
    if (next && next.parentNode !== this) throw Error('Not an anchor');
    if (node.parentNode) node.parentNode.removeChild(node);
    const index = next ? this.childNodes.indexOf(next) : this.childNodes.length;
    this.childNodes.splice(index, 0, node); node.parentNode = this; return node;
  }
  appendChild(node: NativeNode) { return this.insertBefore(node, null); }
  removeChild(node: NativeNode) { const index = this.childNodes.indexOf(node); if (index < 0) throw Error('Not owned'); this.childNodes.splice(index, 1); node.parentNode = null; return node; }
  contains(node: NativeNode): boolean { return node === this || this.childNodes.some(child => child.contains(node)); }
  cloneNode(deep: boolean): NativeNode {
    const clone = this.nodeType === 1 ? new NativeElement(this.localName, this.ownerDocument) : new NativeNode('', this.ownerDocument);
    clone.nodeType = this.nodeType; clone.data = this.data;
    if (this instanceof NativeElement) for (const attr of this.attributes) (clone as NativeElement).setAttribute(attr.name, attr.value);
    if (deep) for (const child of this.childNodes) clone.appendChild(child.cloneNode(true)); return clone;
  }
}
class NativeElement extends NativeNode {
  namespaceURI = 'http://www.w3.org/1999/xhtml'; shadowRoot: any = null; isContentEditable = false;
  values = new Map<string, string>();
  get attributes() { return [...this.values].map(([name, value]) => ({ name, value })); }
  getAttribute(name: string) { return this.values.get(name) ?? null; }
  hasAttribute(name: string) { return this.values.has(name); }
  setAttribute(name: string, value: string) { this.values.set(name, value); }
  removeAttribute(name: string) { this.values.delete(name); }
}
class NativeDocument extends NativeNode {
  nodeType = 9;
  defaultView = { Node: NativeNode, Document: NativeDocument, MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } } };
  documentElement = new NativeElement('html', this);
  constructor() { super(''); this.ownerDocument = this; this.appendChild(this.documentElement); }
  createElement(tag: string) { return new NativeElement(tag, this); }
  createTextNode(data: string) { const node = new NativeNode('', this); node.nodeType = 3; node.data = data; return node; }
}
function fixture(ignored=new Set<NativeNode>()) {
  const doc = new NativeDocument(), parent = doc.createElement('section'); doc.documentElement.appendChild(parent);
  const before = doc.createElement('span'), owner = doc.createElement('button'), after = doc.createElement('p');
  owner.appendChild(doc.createTextNode('Original')); parent.appendChild(before); parent.appendChild(owner); parent.appendChild(after);
  const identity: any = { element: owner, root: doc, document: doc, session: {} };
  let selected = true, generation = 0;
  const ledger = createDOMLedger(doc as any), changed = vi.fn();
  const mutation = createStructureMutation(doc as any, ledger, () => selected && owner.isConnected, plan => selected && plan.bindingGeneration === generation,
    (element, name, value) => element === owner as any && name === 'data-cssforge-target-owned' && value === '1', changed, {},()=>false,()=>{},node=>ignored.has(node as any));
  const prepare = (operation: StructureOperation, position: any = 'after') => mutation.prepare('1', generation, identity, 'button', operation, position) as StructurePlan;
  const apply = (operation: StructureOperation) => mutation.apply(prepare(operation), 1);
  return { doc, parent, before, owner, after, identity, ledger, mutation, prepare, apply, generation: () => generation++, deselect: () => { selected = false; } };
}
describe('exact native structure domain before UI integration', () => {
  it.each(['before','after','first','last'] as const)('inserts literal text at exact %s anchors and reverses only its own node', position => {
    const f = fixture(), result = f.mutation.apply(f.prepare('insert', position), 1, 'div', '<b>literal</b>');
    expect(result.state).toBe('applied'); if (result.state !== 'applied') return;
    expect(result.change.node.firstChild?.nodeValue ?? (result.change.node.firstChild as any)?.data).toBe('<b>literal</b>');
    expect(f.mutation.rollback(result.change)).toBe(true); expect(f.parent.childNodes).toEqual([f.before, f.owner, f.after]);
  });
  it('preparation/cancel never writes and uses no HTML APIs', () => {
    const f = fixture(); for (const key of ['innerHTML','outerHTML','textContent']) Object.defineProperty(f.owner, key, { get() { throw Error('Forbidden'); }, set() { throw Error('Forbidden'); } });
    f.prepare('insert'); expect(f.mutation.getStats().writes).toBe(0); expect(f.ledger.activeStructures()).toEqual([]);
    const result = f.apply('duplicate'); expect(result.state).toBe('applied');
  });
  it('duplicates a fresh native subtree and removes only known owned metadata', () => {
    const f = fixture(); f.owner.setAttribute('data-cssforge-target-owned', '1'); f.owner.setAttribute('data-cssforge-host-like', 'host');
    const r = f.apply('duplicate'); expect(r.state).toBe('applied'); if (r.state !== 'applied') return;
    expect(r.change.node).not.toBe(f.owner); expect(r.change.node.firstChild).not.toBe(f.owner.firstChild);
    expect(r.change.node.hasAttribute('data-cssforge-target-owned')).toBe(false); expect(r.change.node.getAttribute('data-cssforge-host-like')).toBe('host');
    expect(f.mutation.rollback(r.change)).toBe(true);
  });
  it.each(['id','for','aria-labelledby','aria-describedby','aria-controls','href','onclick','src'])('refuses duplicate unsafe %s without a transaction', name => {
    const f = fixture(); f.owner.setAttribute(name, name === 'href' ? '#target' : 'value'); expect((f.prepare('duplicate') as any).state).toBe('UNSUPPORTED'); expect(f.ledger.activeStructures()).toEqual([]);
  });
  it.each(['script','style','iframe','canvas','input','form','x-host','svg'])('refuses unsafe %s descendants as a whole', tag => {
    const f = fixture(), child = f.doc.createElement(tag); if (tag === 'svg') child.namespaceURI = 'svg'; f.owner.appendChild(child);
    expect((f.prepare('duplicate') as any).state).toBe('UNSUPPORTED'); expect((f.prepare('delete') as any).state).toBe('UNSUPPORTED');
  });
  it('rejects custom hosts but permits ordinary light descendants with ordinary parents', () => {
    const f = fixture(), custom = f.doc.createElement('x-host'); f.doc.documentElement.appendChild(custom); custom.appendChild(f.parent);
    expect((f.prepare('delete') as any).state).toBeUndefined(); f.owner.localName = 'x-host'; expect((f.prepare('delete') as any).state).toBe('UNSUPPORTED');
  });
  it('enforces bounded descendants, depth, text and attributes without truncation', () => {
    const nodes = fixture(); for (let i = 0; i < structureLimits.nodes; i++) nodes.owner.appendChild(nodes.doc.createElement('span'));
    expect((nodes.prepare('delete') as any).state).toBe('UNSUPPORTED');
    const deep = fixture(); let parent = deep.owner; for (let i = 0; i <= structureLimits.depth; i++) { const child = deep.doc.createElement('div'); parent.appendChild(child); parent = child; } expect((deep.prepare('duplicate') as any).state).toBe('UNSUPPORTED');
    const text = fixture(); text.owner.firstChild!.data = 'a'.repeat(structureLimits.text + 1); expect((text.prepare('delete') as any).state).toBe('UNSUPPORTED');
    const attrs = fixture(); for (let i = 0; i <= structureLimits.attributes; i++) attrs.owner.setAttribute(`data-${i}`, 'v'); expect((attrs.prepare('delete') as any).state).toBe('UNSUPPORTED');
  });
  it('Delete restores the exact detached node and listener/data identity', () => {
    const f = fixture(), text = f.owner.firstChild, r = f.apply('delete'); expect(r.state).toBe('applied'); if (r.state !== 'applied') return;
    expect(f.owner.parentNode).toBeNull(); expect(f.mutation.rollback(r.change)).toBe(true); expect(f.owner.firstChild).toBe(text); expect(f.parent.childNodes).toEqual([f.before, f.owner, f.after]);
  });
  it('Delete rollback refuses changed anchors or changed detached content', () => {
    for (const mode of ['anchor','content']) { const f = fixture(), r = f.apply('delete'); if (r.state !== 'applied') throw Error('not applied');
      if (mode === 'anchor') f.parent.insertBefore(f.doc.createElement('div'), f.after); else f.owner.firstChild!.data = 'Host';
      expect(f.mutation.rollback(r.change)).toBe(false); expect(f.owner.parentNode).toBeNull(); expect(f.ledger.activeStructures()).toHaveLength(1);
    }
  });
  it.each(['up','down'] as const)('moves %s within the same parent and reverses exact anchors', operation => {
    const f = fixture(), r = f.apply(operation); expect(r.state).toBe('applied'); if (r.state !== 'applied') return;
    expect(f.owner.parentNode).toBe(f.parent); expect(f.mutation.rollback(r.change)).toBe(true); expect(f.parent.childNodes).toEqual([f.before, f.owner, f.after]);
  });
  it('preserves the relative order of non-element siblings', () => {
    const f = fixture(), text = f.doc.createTextNode('gap'), comment = f.doc.createTextNode('comment'); comment.nodeType = 8;
    f.parent.insertBefore(text, f.owner); f.parent.insertBefore(comment, f.after); const r = f.apply('down'); if (r.state !== 'applied') throw Error('not applied');
    expect(f.parent.childNodes.filter(n => n.nodeType !== 1)).toEqual([text, comment]); expect(f.mutation.rollback(r.change)).toBe(true);
    expect(f.parent.childNodes).toEqual([f.before, text, f.owner, comment, f.after]);
  });
  it('boundary attempts and fabricated/reused/stale plans make no extra writes', () => {
    const f = fixture(); f.parent.removeChild(f.before); expect((f.prepare('up') as any).state).toBe('UNAVAILABLE');
    expect(f.mutation.apply({} as any, 1).state).toBe('STALE'); const plan = f.prepare('delete'); f.generation(); expect(f.mutation.apply(plan, 1).state).toBe('STALE'); expect(f.mutation.getStats().writes).toBe(0);
    const g = fixture(), p = g.prepare('insert'); g.mutation.apply(p, 1); expect(g.mutation.apply(p, 2).state).toBe('STALE');
  });
  it('rejects a host-modified created subtree and exact-node replacement', () => {
    const f = fixture(), r = f.apply('insert'); if (r.state !== 'applied') throw Error('not applied'); (r.change.node as any).setAttribute('data-host', 'new');
    expect(f.mutation.rollback(r.change)).toBe(false); expect(r.change.node.isConnected).toBe(true);
    const g = fixture(), p = g.prepare('delete'); g.parent.removeChild(g.owner); g.parent.insertBefore(g.doc.createElement('button'), g.after); expect(g.mutation.apply(p, 1).state).not.toBe('applied');
  });
  it('root replacement retires structural evidence and never writes old or new trees', () => {
    const f = fixture(), r = f.apply('insert'); if (r.state !== 'applied') throw Error('not applied'); f.doc.documentElement = f.doc.createElement('html');
    expect(f.mutation.rollback(r.change)).toBe(false); expect(f.ledger.activeStructures()).toEqual([]); expect(r.change.state).toBe('retired');
  });
  it('projects exact creation/deletion and reorder-back net zero without changing history ownership', () => {
    const f = fixture(), creation = f.apply('insert'); if (creation.state !== 'applied') throw Error('not applied');
    const id: any = { ...f.identity, element: creation.change.node }, plan = f.mutation.prepare('1', 0, id, 'div', 'delete') as StructurePlan;
    const deletion = f.mutation.apply(plan, 2); if (deletion.state !== 'applied') throw Error('not applied');
    f.mutation.refresh(); expect(f.mutation.rows([creation.change, deletion.change])).toEqual([]); expect(f.ledger.activeStructures()).toHaveLength(2);
    const g = fixture(), up = g.apply('up'); if (up.state !== 'applied') throw Error('not applied'); const down = g.mutation.apply(g.prepare('down'), 2); if (down.state !== 'applied') throw Error('not applied');
    g.mutation.refresh(); expect(g.mutation.rows([up.change, down.change])).toEqual([]);
  });
  it('proven native CSS layer metadata never becomes a page restoration anchor',()=>{
    const ignored=new Set<NativeNode>(),f=fixture(ignored),layer=f.doc.createElement('style');ignored.add(layer);
    f.parent.removeChild(f.before);f.parent.removeChild(f.after);f.parent.appendChild(layer);
    const plan=f.prepare('delete');expect(plan.before.next).toBeNull();const result=f.mutation.apply(plan,1);if(result.state!=='applied')throw Error('not applied');
    expect(result.change.state).toBe('applied');f.parent.removeChild(layer);expect(f.mutation.rollback(result.change)).toBe(true);expect(f.parent.childNodes).toEqual([f.owner]);
  });
  it('host stylesheet lookalikes remain real anchors and cannot be ignored by attribute name',()=>{
    const f=fixture(),layer=f.doc.createElement('style');layer.setAttribute('data-cssforge-edit-layer','host');f.parent.removeChild(f.after);f.parent.appendChild(layer);
    const plan=f.prepare('delete');expect(plan.before.next).toBe(layer);const result=f.mutation.apply(plan,1);if(result.state!=='applied')throw Error('not applied');f.parent.removeChild(layer);
    expect(f.mutation.rollback(result.change)).toBe(false);expect(f.owner.parentNode).toBeNull();
  });
});
