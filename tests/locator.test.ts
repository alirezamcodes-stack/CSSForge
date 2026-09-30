import { describe, expect, it } from 'vitest';
import { createTargetLocator } from '../src/engine/locator';
import { createTargetLifecycle } from '../src/picker/targetLifecycle';
import { stableData, stableID } from '../src/engine/locator/evidence';

// Small DOM double for policy tests; actual CSS queries/shadow boundaries are verified in built Chrome.
class Scope {
  children: NodeElement[] = [];
  append(node: NodeElement) { node.remove(); node.parent = this; this.children.push(node); }
  querySelectorAll(query: string): Element[] {
    const all: NodeElement[] = [];
    const walk = (scope: Scope) => { for (const child of scope.children) { all.push(child); walk(child); } }; walk(this);
    const tag = query.match(/^[a-zA-Z][\w-]*/)?.[0];
    const attributes = [...query.matchAll(/\[([\w-]+)(~?)="([^"]*)"\]/g)];
    return all.filter(node => (!tag || node.localName === tag) && attributes.every(([, name, token, value]) => token ? (node.getAttribute(name) ?? '').split(' ').includes(value) : node.getAttribute(name) === value)) as unknown as Element[];
  }
}
class Doc extends Scope {
  defaultView = { ShadowRoot: Shadow, CSS: { escape: (value: string) => value }, document: this };
}
class Shadow extends Scope { mode = 'open'; constructor(public host: NodeElement) { super(); } }
class NodeElement extends Scope {
  parent: Scope | null = null; shadowRoot: Shadow | null = null;
  attrs = new Map<string, string>(); namespaceURI = 'http://www.w3.org/1999/xhtml';
  constructor(public ownerDocument: Doc, public localName = 'button', attributes: Record<string, string> = {}) { super(); Object.entries(attributes).forEach(([name, value]) => this.attrs.set(name, value)); }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  get classList() { return (this.getAttribute('class') ?? '').split(' ').filter(Boolean); }
  get parentElement(): NodeElement | null { return this.parent instanceof NodeElement ? this.parent : null; }
  get previousElementSibling() { const siblings = this.parent?.children ?? []; return siblings[siblings.indexOf(this) - 1] ?? null; }
  getRootNode(): Scope { return this.parentElement ? this.parentElement.getRootNode() : this.parent ?? this; }
  get isConnected(): boolean { const root = this.getRootNode(); return root instanceof Doc || (root instanceof Shadow && root.host.isConnected); }
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
  hasAttribute(name: string) { return this.attrs.has(name); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
  shadow() { return (this.shadowRoot = new Shadow(this)); }
}
const element = (node: NodeElement) => node as unknown as Element;
const document = (doc: Doc) => doc as unknown as Document;
function fixture(attributes: Record<string, string> = {}, options = {}) {
  const doc = new Doc(), old = new NodeElement(doc, 'button', attributes); doc.append(old);
  const lifecycle = createTargetLifecycle(document(doc), () => false), engine = createTargetLocator(document(doc), lifecycle, options);
  const locator = engine.capture(lifecycle.bind(element(old)));
  const replacement = (attrs = attributes, tag = 'button') => { const next = new NodeElement(doc, tag, attrs); old.remove(); doc.append(next); return next; };
  return { doc, old, lifecycle, engine, locator, replacement };
}
describe('internal target locator policy', () => {
  it('uses the connected original without searching and caches intentional capture', () => {
    const { old, engine, locator } = fixture({ id: 'save' }); const before = engine.getStats();
    const result = engine.resolve(locator); expect(result.state).toBe('original-valid'); expect(result.element).toBe(element(old));
    expect(engine.getStats().queries).toBe(before.queries); expect(engine.getStats().searches).toBe(0);
    expect(engine.capture(locator.identity)).toBe(locator); expect(engine.getStats().captures).toBe(1);
  });
  it('resolves a unique same-root ID with compatible attributes without rebinding', () => {
    const { engine, locator, replacement, lifecycle } = fixture({ id: 'save', type: 'button' }); const next = replacement();
    const result = engine.resolve(locator); expect(result.state).toBe('resolved-unique'); expect(result.element).toBe(element(next));
    expect(lifecycle.safe(locator.identity)).toBe(false);
  });
  it('refuses duplicate IDs even when a first compatible candidate exists', () => {
    const { doc, engine, locator, replacement } = fixture({ id: 'save' }); replacement(); doc.append(new NodeElement(doc, 'button', { id: 'save' }));
    expect(engine.resolve(locator)).toMatchObject({ state: 'ambiguous', element: null, candidateCount: 2 });
  });
  it('does not upgrade ID evidence that was duplicated at capture', () => {
    const { doc, old, lifecycle, engine } = fixture({ id: 'save' }); const duplicate = new NodeElement(doc, 'button', { id: 'save' }); doc.append(duplicate);
    const locator = engine.capture(lifecycle.bind(element(old)), true); old.remove();
    expect(engine.resolve(locator).state).toBe('unsafe');
  });
  it.each(['a', 'input'])('rejects incompatible tag %s with the same ID', tag => {
    const { engine, locator, replacement } = fixture({ id: 'save' }); replacement({ id: 'save' }, tag);
    expect(engine.resolve(locator).state).toBe('unsafe');
  });
  it('rejects incompatible namespace and stable data evidence', () => {
    const { engine, locator, replacement } = fixture({ id: 'save', 'data-key': '42' }); const next = replacement({ id: 'save', 'data-key': '43' }); next.namespaceURI = 'http://www.w3.org/2000/svg';
    const result = engine.resolve(locator); expect(result.state).toBe('unsafe'); expect(result.rejected[0].reasons).toContain('namespace changed');
  });
  it('resolves a unique application data identifier and rejects duplicate data', () => {
    const { doc, engine, locator, replacement } = fixture({ 'data-product-id': '42' }); replacement(); expect(engine.resolve(locator).state).toBe('resolved-unique');
    doc.append(new NodeElement(doc, 'button', { 'data-product-id': '42' })); expect(engine.resolve(locator).state).toBe('ambiguous');
  });
  it('supports a unique semantic combination, but not a single semantic label', () => {
    const strong = fixture({ name: 'submit-order', type: 'button' }); strong.replacement(); expect(strong.engine.resolve(strong.locator).state).toBe('resolved-unique');
    const weak = fixture({ 'aria-label': 'Save' }); weak.replacement(); expect(weak.engine.resolve(weak.locator).state).toBe('unsafe');
  });
  it('prefers a unique application key over a repeated testing label', () => {
    const { doc, old, lifecycle, engine, replacement } = fixture({ 'data-testid': 'buy', 'data-product-id': '42' });
    doc.append(new NodeElement(doc, 'button', { 'data-testid': 'buy', 'data-product-id': '43' }));
    const locator = engine.capture(lifecycle.bind(element(old)), true), next = replacement();
    expect(engine.resolve(locator)).toMatchObject({ state: 'resolved-unique', element: element(next) });
  });
  it('refreshes evidence only explicitly and retires the older generation', () => {
    const { old, engine, locator } = fixture({ id: 'save' }); old.attrs.set('id', 'new-save');
    expect(engine.capture(locator.identity)).toBe(locator);
    const updated = engine.capture(locator.identity, true); expect(updated.evidence.id).toBe('new-save');
    expect(engine.resolve(locator).state).toBe('unsafe'); expect(engine.resolve(updated).state).toBe('original-valid');
  });
  it.each(['primary buy', 'buy primary active', 'primary buy loading'])('tolerates class order/state changes: %s', classes => {
    const { engine, locator, replacement } = fixture({ id: 'save', class: 'buy primary active' }); replacement({ id: 'save', class: classes });
    expect(engine.resolve(locator).state).toBe('resolved-unique');
  });
  it('never authorizes class-only or copied-marker-only evidence', () => {
    const { doc, engine, locator, replacement } = fixture({ class: 'primary', 'data-cssforge-target-copy': '7' }); replacement();
    expect(locator.evidence.attributes).toEqual([]); expect(engine.resolve(locator).state).toBe('unsafe');
    doc.append(new NodeElement(doc, 'button', { class: 'primary' })); expect(engine.resolve(locator).state).toBe('ambiguous');
  });
  it('uses stable card ancestry through list reordering and sibling insertion', () => {
    const doc = new Doc(), cards = ['1', '2', '3'].map(id => new NodeElement(doc, 'article', { 'data-id': id }));
    cards.forEach(card => { doc.append(card); card.append(new NodeElement(doc, 'button', { class: 'buy' })); });
    const lifecycle = createTargetLifecycle(document(doc), () => false), engine = createTargetLocator(document(doc), lifecycle);
    const old = cards[1].children[0], locator = engine.capture(lifecycle.bind(element(old))); old.remove();
    const next = new NodeElement(doc, 'button', { class: 'buy active' }); cards[1].append(new NodeElement(doc, 'span')); cards[1].append(next); doc.children.reverse();
    expect(engine.resolve(locator)).toMatchObject({ state: 'resolved-unique', element: element(next) });
  });
  it('does not use an old index to select the remaining indistinguishable sibling', () => {
    const doc = new Doc(), parent = new NodeElement(doc, 'article', { 'data-id': '2' }); doc.append(parent);
    const old = new NodeElement(doc, 'button', { class: 'buy' }), other = new NodeElement(doc, 'button', { class: 'buy' }); parent.append(old); parent.append(other);
    const lifecycle = createTargetLifecycle(document(doc), () => false), engine = createTargetLocator(document(doc), lifecycle), locator = engine.capture(lifecycle.bind(element(old)));
    old.remove(); expect(engine.resolve(locator).state).toBe('unsafe');
  });
  it('keeps nested open roots distinct and rejects wrong-root proposals', () => {
    const doc = new Doc(), host = new NodeElement(doc, 'div'); doc.append(host); const outer = host.shadow();
    const innerHost = new NodeElement(doc, 'section'); outer.append(innerHost); const inner = innerHost.shadow();
    const old = new NodeElement(doc, 'button', { id: 'same' }); inner.append(old);
    const elsewhere = new NodeElement(doc, 'button', { id: 'same' }); outer.append(elsewhere); doc.append(new NodeElement(doc, 'button', { id: 'same' }));
    const lifecycle = createTargetLifecycle(document(doc), () => false), engine = createTargetLocator(document(doc), lifecycle), locator = engine.capture(lifecycle.bind(element(old)));
    expect(locator.boundaries).toHaveLength(2); old.remove(); expect(engine.resolve(locator).state).toBe('missing');
    expect(engine.resolve(locator, { candidate: element(elsewhere) }).state).toBe('root-mismatch');
    const next = new NodeElement(doc, 'button', { id: 'same' }); inner.append(next); expect(engine.resolve(locator).element).toBe(element(next));
    host.remove(); expect(engine.resolve(locator).state).toBe('root-mismatch');
  });
  it('reports moved original roots, document mismatch, unsupported frames, and expired sessions', () => {
    const { doc, old, engine, locator } = fixture({ id: 'save' }); const host = new NodeElement(doc, 'div'); doc.append(host); host.shadow().append(old);
    expect(engine.resolve(locator).state).toBe('root-mismatch');
    expect(engine.resolve(locator, { document: document(new Doc()) }).state).toBe('document-mismatch');
    expect(engine.resolve(locator, { frame: 'interior' }).state).toBe('unsupported-frame');
    engine.destroy(); expect(engine.resolve(locator).state).toBe('unsafe');
  });
  it('reports a quarantined connected binding as unsafe rather than resurrecting it', () => {
    const { lifecycle, engine, locator } = fixture({ id: 'save' }); lifecycle.forget(locator.identity); expect(engine.resolve(locator).state).toBe('unsafe');
  });
  it('returns missing without a replacement and truncated rather than guessing over the cap', () => {
    const missing = fixture({ id: 'save' }); missing.old.remove(); expect(missing.engine.resolve(missing.locator).state).toBe('missing');
    const limited = fixture({ class: 'buy' }, { candidates: 2 }); limited.old.remove();
    for (let i = 0; i < 3; i++) limited.doc.append(new NodeElement(limited.doc, 'button', { class: 'buy' }));
    expect(limited.engine.resolve(limited.locator)).toMatchObject({ state: 'truncated', element: null });
  });
  it('never searches after an incomplete capture, but retains valid-original authority', () => {
    const { old, engine, locator } = fixture({ id: 'save' }, { queries: 0 });
    expect(engine.resolve(locator).state).toBe('original-valid'); old.remove();
    expect(engine.resolve(locator).state).toBe('truncated'); expect(engine.getStats().searches).toBe(0);
  });
  it('does not claim access through a closed ancestor root', () => {
    const doc = new Doc(), host = new NodeElement(doc, 'div'); doc.append(host); const closed = host.shadow(); closed.mode = 'closed';
    const childHost = new NodeElement(doc, 'section'); closed.append(childHost); const nested = childHost.shadow(), target = new NodeElement(doc, 'button', { id: 'save' }); nested.append(target);
    const lifecycle = createTargetLifecycle(document(doc), () => false), engine = createTargetLocator(document(doc), lifecycle), locator = engine.capture(lifecycle.bind(element(target)));
    expect(locator.unsupportedRoot).toBe(true); expect(engine.resolve(locator).state).toBe('unsafe');
  });
  it('excludes random/framework IDs, generic data and transient marker/state attributes', () => {
    expect(stableID('12345678-abcd-abcd-abcd-123456789abc')).toBe(false); expect(stableID(':r3:')).toBe(false);
    expect(stableData('data-state', 'open')).toBe(false); expect(stableData('data-cssforge-target-x', '42')).toBe(false);
    expect(stableData('data-react-key', '42')).toBe(false); expect(stableData('data-v-key', '42')).toBe(false);
    expect(stableData('data-product-id', '42')).toBe(true);
  });
});
