import type { TargetIdentity } from '../../picker/targetLifecycle';
import type { DOMLedger } from './index';

export type StructureOperation = 'insert' | 'duplicate' | 'delete' | 'up' | 'down';
export type InsertPosition = 'before' | 'after' | 'first' | 'last';
export const insertTags = ['div', 'span', 'p', 'button', 'section'] as const;
export const structureLimits = { nodes: 128, depth: 8, text: 32768, attributes: 256, attributeText: 16384, ancestry: 64 } as const;
type Gap = Readonly<{ parent: Element | ShadowRoot; previous: Node | null; next: Node | null }>;
type Snapshot = readonly Readonly<{ node: Node; parent: Node | null; data: string | null; attributes: string }>[];
export type StructureFailure = { state: 'UNSUPPORTED' | 'UNAVAILABLE' | 'STALE' | 'CONFLICT' | 'FAILED'; reason: string };
export type StructurePlan = Readonly<{
  targetId: string; bindingGeneration: number; identity: TargetIdentity; owner: Element;
  root: Document | ShadowRoot; label: string; operation: StructureOperation; position: InsertPosition;
  before: Gap; destination: Gap; snapshot: Snapshot;
}>;
export type DOMStructureChange = {
  kind: 'DOM_INSERT' | 'DOM_DUPLICATE' | 'DOM_DELETE' | 'DOM_REORDER'; plan: StructurePlan;
  node: Element; before: Gap; after: Gap; snapshot: Snapshot; order: number; session: object;
  label: string; location: string; state: 'applied' | 'superseded' | 'resolved' | 'retired' | StructureFailure['state']; reason?: string;
};
export type StructureRow = Pick<DOMStructureChange, 'kind' | 'label' | 'location' | 'state' | 'reason'>;
export type StructureResult = StructureFailure | { state: 'applied'; change: DOMStructureChange };
const critical = new Set(['html', 'head', 'body']);
const excluded = new Set(['script','style','link','meta','base','template','noscript','iframe','object','embed','canvas','input','textarea','select','option','optgroup','form','img','picture','source','video','audio','track','slot']);
const idrefs = new Set(['id','for','form','list','headers','aria-labelledby','aria-describedby','aria-controls','aria-owns','aria-activedescendant','aria-flowto','aria-details','aria-errormessage']);
const htmlNamespace = 'http://www.w3.org/1999/xhtml';
const failure = (state: StructureFailure['state'], reason: string): StructureFailure => ({ state, reason });
const neighbor = (node: Node, direction: 'previousSibling'|'nextSibling', ignored: (node:Node)=>boolean):Node|null => {
  let current=node[direction];while(current&&ignored(current))current=current[direction];return current;
};
const gapAt = (node: Node, ignored:(node:Node)=>boolean): Gap => Object.freeze({ parent: node.parentNode as Element | ShadowRoot, previous: neighbor(node,'previousSibling',ignored), next: neighbor(node,'nextSibling',ignored) });
// Conceptually exclude only the exact moving node. No child-index reconstruction.
export function exactGap(gap: Gap, excluding?: Node, ignored:(node:Node)=>boolean=()=>false): boolean {
  const { parent, previous, next } = gap;
  if (previous && previous.parentNode !== parent || next && next.parentNode !== parent) return false;
  let following = previous ? previous.nextSibling : parent.firstChild;
  while(following&&(following===excluding||ignored(following)))following=following.nextSibling;
  return following === next;
}
function positioned(node: Node, gap: Gap, ignored:(node:Node)=>boolean) {
  return node.parentNode === gap.parent && neighbor(node,'previousSibling',ignored) === gap.previous && neighbor(node,'nextSibling',ignored) === gap.next;
}
function ordinary(element: Element, container = false): string | null {
  if (element.namespaceURI !== htmlNamespace || excluded.has(element.localName) || !container && critical.has(element.localName)) return 'This element has unsupported platform or form semantics.';
  if (element.localName.includes('-') || element.hasAttribute('is') || element.shadowRoot) return 'Custom elements and shadow hosts are unsupported structural owners.';
  return null;
}
function ancestry(element: Element, doc: Document): string | null {
  let current: Element | null = element;
  for (let depth = 0; current; depth++) {
    if (depth >= structureLimits.ancestry) return 'Ancestry exceeds the structural safety limit.';
    if (current.ownerDocument !== doc || excluded.has(current.localName) || (current as HTMLElement).isContentEditable || current.hasAttribute('contenteditable') && current.getAttribute('contenteditable') !== 'false') return 'Editable surfaces, forms and cross-document ancestors are unsupported.';
    const root = current.getRootNode();
    current = current.parentElement ?? ('host' in root ? (root as ShadowRoot).host : null);
  }
  return null;
}
function containerReason(parent: Element | ShadowRoot, doc: Document) {
  if(parent.nodeType===11)return (parent as ShadowRoot).mode==='open'?ancestry((parent as ShadowRoot).host,doc):'Closed shadow roots are unsupported.';
  return ordinary(parent as Element,true)??ancestry(parent as Element,doc);
}
type MarkerOwned = (element: Element, name: string, value: string) => boolean;
function snapshot(node: Element, duplicate: boolean, markerOwned: MarkerOwned, count: () => void): Snapshot | StructureFailure {
  count();
  const rows: { node: Node; parent: Node | null; data: string | null; attributes: string }[] = [];
  let text = 0, attributes = 0, attributeText = 0;
  const visit = (current: Node, depth: number): StructureFailure | null => {
    if (rows.length >= structureLimits.nodes || depth > structureLimits.depth) return failure('UNSUPPORTED', 'Subtree exceeds 128 nodes or depth 8; the whole operation was refused.');
    let data: string | null = null, attrs: string[] = [];
    if (current.nodeType === 1) {
      const element = current as Element, reason = ordinary(element);
      if (reason) return failure('UNSUPPORTED', reason);
      if (element.hasAttribute('contenteditable') && element.getAttribute('contenteditable') !== 'false') return failure('UNSUPPORTED', 'Editable descendants are unsupported.');
      for (const attribute of Array.from(element.attributes)) {
        if (markerOwned(element, attribute.name, attribute.value)) continue;
        if (++attributes > structureLimits.attributes || (attributeText += attribute.name.length + attribute.value.length) > structureLimits.attributeText) return failure('UNSUPPORTED', 'Subtree attributes exceed the structural safety limit.');
        if (duplicate && (idrefs.has(attribute.name) || attribute.name.startsWith('on') || ['src','srcset','srcdoc','action','formaction','href','xlink:href'].includes(attribute.name) || attribute.name==='style'&&/url\s*\(/i.test(attribute.value))) return failure('UNSUPPORTED', 'Duplicate refuses IDs, ID references, inline handlers and resource attributes.');
        attrs.push(JSON.stringify([attribute.name, attribute.value]));
      }
    } else if (current.nodeType === 3 || current.nodeType === 8) {
      data = (current as CharacterData).data;
      if ((text += data.length) > structureLimits.text) return failure('UNSUPPORTED', 'Subtree text exceeds 32,768 characters.');
    } else return failure('UNSUPPORTED', 'Unsupported native node in the subtree.');
    rows.push(Object.freeze({ node: current, parent: current === node ? null : current.parentNode, data, attributes: attrs.sort().join('|') }));
    for (const child of Array.from(current.childNodes)) { const error = visit(child, depth + 1); if (error) return error; }
    return null;
  };
  const error = visit(node, 0);
  return error ?? Object.freeze(rows);
}
function sameSnapshot(before: Snapshot, current: Snapshot | StructureFailure): boolean {
  return Array.isArray(current) && before.length === current.length && before.every((row, index) => {
    const other = current[index];
    return row.node === other.node && row.parent === other.parent && row.data === other.data && row.attributes === other.attributes;
  });
}

/** Native ownership only. Transaction order belongs exclusively to editing/session.ts. */
export function createStructureMutation(doc: Document, ledger: DOMLedger, safe: (identity: TargetIdentity) => boolean,
  authorized: (plan: StructurePlan) => boolean, markerOwned: MarkerOwned, changed: () => void, session: object,
  deferred: (record: DOMStructureChange) => boolean = () => false, willWrite: (record: DOMStructureChange) => void = () => {}, ignored:(node:Node)=>boolean=()=>false) {
  const records = ledger.structures(), plans = new WeakSet<StructurePlan>();
  const win = doc.defaultView!, native = win.Node.prototype;
  const insert = (parent: Node, node: Node, next: Node | null) => { native.insertBefore.call(parent, node, next); stats.writes++; };
  const remove = (node: Node) => { native.removeChild.call(node.parentNode!, node); stats.writes++; };
  const stats = { eligibility: 0, preparations: 0, snapshots: 0, ownershipChecks: 0, writes: 0, rollbacks: 0, projections: 0 };
  const observers = new Map<Node, MutationObserver>();
  let destroyed = false, writing = false;
  const capture = (node: Element, duplicate = false) => snapshot(node, duplicate, markerOwned, () => stats.snapshots++);
  const currentRoot = (plan: StructurePlan) => ledger.current() && plan.destination.parent.isConnected && plan.destination.parent.ownerDocument === doc && plan.destination.parent.getRootNode() === plan.root;
  function check(record: DOMStructureChange, strict = false): boolean {
    stats.ownershipChecks++;
    ledger.current();
    if (record.state === 'retired') return false;
    const plan = record.plan;
    let error: StructureFailure | null = null;
    if (!strict && deferred(record)) { record.state = 'superseded'; record.reason = 'Later session edits must be reversed first.'; return true; }
    if (!currentRoot(plan) || record.node.ownerDocument !== doc || record.kind!=='DOM_DELETE'&&(!record.node.isConnected||record.node.getRootNode()!==plan.root)) error = failure('UNAVAILABLE', 'The original native node, parent or root is unavailable. No replacement is inferred.');
    else if (record.kind === 'DOM_DELETE' ? record.node.parentNode !== null || !exactGap(record.before,undefined,ignored) : !positioned(record.node, record.after,ignored)) error = failure('CONFLICT', 'The page changed the exact node position or sibling anchors.');
    else if (containerReason(plan.destination.parent, doc)) error = failure('UNSUPPORTED', 'The original container is no longer eligible.');
    else if (!sameSnapshot(record.snapshot, capture(record.node))) error = failure('CONFLICT', 'The page changed the exact owned subtree. Its changes are preserved.');
    record.state = error?.state ?? 'applied'; record.reason = error?.reason;
    return !error;
  }
  function refresh(notify = false) {
    let different = false;
    for (const record of records) {
      const previous = `${record.state}:${record.reason}`;
      check(record); different ||= previous !== `${record.state}:${record.reason}`;
    }
    if (notify && different) changed();
  }
  function watch(node: Node, subtree: boolean) {
    if (observers.has(node)) return;
    const observer = new win.MutationObserver(() => { if (!destroyed && !writing) refresh(true); });
    observer.observe(node, { childList: true, subtree, attributes: subtree, characterData: subtree });
    observers.set(node, observer);
  }
  const drain = () => { for (const observer of observers.values()) observer.takeRecords(); };
  for (const record of records) { watch(record.before.parent, false); watch(record.node, true); }
  function prepare(targetId: string, bindingGeneration: number, identity: TargetIdentity, label: string,
    operation: StructureOperation, position: InsertPosition = 'after'): StructurePlan | StructureFailure {
    stats.preparations++; stats.eligibility++;
    if (destroyed || !safe(identity)) return failure('UNAVAILABLE', 'Select an available element first.');
    const owner = identity.element, root = identity.root;
    if (root !== doc && (!('mode' in root) || root.mode !== 'open')) return failure('UNSUPPORTED', 'Only the current document and accessible open shadow roots are supported.');
    const reason = ordinary(owner) ?? ancestry(owner, doc);
    if (reason) return failure('UNSUPPORTED', reason);
    const parent = owner.parentNode as Element | ShadowRoot | null;
    if (!parent || ![1,11].includes(parent.nodeType) || parent.getRootNode() !== root || containerReason(parent,doc)) return failure('UNSUPPORTED', 'An ordinary parent or accessible open shadow root in this exact root is required.');
    const before = gapAt(owner,ignored);
    let destination: Gap = before;
    if (operation === 'insert') {
      if (!['before','after','first','last'].includes(position)) return failure('UNSUPPORTED', 'Unsupported insert placement.');
      const inside = position === 'first' || position === 'last';
      if (inside && ['br','hr','wbr','area','col','param'].includes(owner.localName)) return failure('UNSUPPORTED', 'Void elements cannot contain children.');
      destination = Object.freeze(inside ? { parent: owner, previous: position === 'first' ? null : owner.lastChild, next: position === 'first' ? owner.firstChild : null }
        : { parent, previous: position === 'before' ? before.previous : owner, next: position === 'before' ? owner : before.next });
    } else if (operation === 'duplicate') destination = Object.freeze({ parent, previous: owner, next: before.next });
    else if (operation === 'up' || operation === 'down') {
      let adjacent = operation === 'up' ? owner.previousElementSibling : owner.nextElementSibling;
      while(adjacent&&ignored(adjacent))adjacent=operation==='up'?adjacent.previousElementSibling:adjacent.nextElementSibling;
      if (!adjacent) return failure('UNAVAILABLE', `Already at the ${operation === 'up' ? 'first' : 'last'} element-sibling boundary.`);
      if (ordinary(adjacent)) return failure('UNSUPPORTED', 'The adjacent element is an unsupported platform boundary.');
      destination = Object.freeze(operation === 'up' ? { parent, previous: neighbor(adjacent,'previousSibling',ignored), next: adjacent } : { parent, previous: adjacent, next: neighbor(adjacent,'nextSibling',ignored) });
    } else if (operation !== 'delete') return failure('UNSUPPORTED', 'Unsupported structural operation.');
    const captured = operation === 'insert' ? Object.freeze([]) : capture(owner, operation === 'duplicate');
    if (!Array.isArray(captured)) return captured as StructureFailure;
    const plan = Object.freeze({ targetId, bindingGeneration, identity, owner, root, label, operation, position, before, destination, snapshot: captured });
    plans.add(plan); return plan;
  }
  function apply(plan: StructurePlan, order: number, tag = 'div', text = ''): StructureResult {
    if (destroyed || writing || !plans.has(plan) || !authorized(plan) || !safe(plan.identity)) return failure('STALE', 'The selected target or binding changed. Reopen the action.');
    if (!positioned(plan.owner, plan.before,ignored) || !currentRoot(plan) || !exactGap(plan.destination, ['up','down','delete'].includes(plan.operation) ? plan.owner : undefined,ignored)) return failure('CONFLICT', 'The parent or exact insertion anchors changed.');
    const resolved = prepare(plan.targetId, plan.bindingGeneration, plan.identity, plan.label, plan.operation, plan.position);
    if ('state' in resolved) return resolved;
    plans.delete(resolved);
    if (plan.operation !== 'insert' && !sameSnapshot(plan.snapshot, capture(plan.owner))) return failure('CONFLICT', 'The subtree changed after this action was prepared.');
    if (plan.operation === 'insert' && (!(insertTags as readonly string[]).includes(tag) || typeof text !== 'string' || text.length > structureLimits.text)) return failure('UNSUPPORTED', 'Choose an allowed element type and at most 32,768 text characters.');
    plans.delete(plan); writing = true;
    let record: DOMStructureChange | undefined;
    try {
      let node = plan.owner;
      if (plan.operation === 'insert') {
        node = win.Document.prototype.createElement.call(doc, tag);
        if (tag === 'button') node.setAttribute('type', 'button');
        if (text) native.appendChild.call(node, win.Document.prototype.createTextNode.call(doc, text));
      } else if (plan.operation === 'duplicate') {
        node = native.cloneNode.call(plan.owner, true) as Element;
        // Parallel native clone topology; remove only metadata proven owned on the source node.
        const strip = (source: Node, clone: Node) => {
          if (source.nodeType === 1) for (const attribute of Array.from((source as Element).attributes)) if (markerOwned(source as Element, attribute.name, attribute.value)) (clone as Element).removeAttribute(attribute.name);
          Array.from(source.childNodes).forEach((child, index) => strip(child, clone.childNodes[index]));
        };
        strip(plan.owner, node);
      }
      const captured = capture(node);
      if (!Array.isArray(captured)) return captured as StructureFailure;
      const kind = plan.operation === 'insert' ? 'DOM_INSERT' : plan.operation === 'duplicate' ? 'DOM_DUPLICATE' : plan.operation === 'delete' ? 'DOM_DELETE' : 'DOM_REORDER';
      record = { kind, plan, node, before: plan.before, after: plan.destination, snapshot: captured, order, session,
        label: `<${node.localName}>`, location: kind === 'DOM_DELETE' ? 'Detached from original parent' : kind === 'DOM_REORDER' ? `Move ${plan.operation} within original parent` : `${plan.operation === 'duplicate' ? 'after' : plan.position} selected ${plan.label.slice(0, 100)}`, state: 'applied' };
      // Retain evidence even when the host reacts during the native call.
      records.add(record);
      willWrite(record);
      if (kind === 'DOM_DELETE') remove(node); else insert(plan.destination.parent, node, plan.destination.next);
      drain(); check(record); watch(record.before.parent, false); watch(node, true);
      return { state: 'applied', change: record };
    } catch {
      if (record) { record.state = 'FAILED'; record.reason = 'Native operation failed or host reaction blocked it; recovery retained.'; return { state: 'applied', change: record }; }
      return failure('FAILED', 'Native node creation failed; no transaction was committed.');
    } finally { writing = false; }
  }
  function rollback(record: DOMStructureChange) {
    if (destroyed || writing || !records.has(record) || !check(record, true)) return false;
    if (record.kind === 'DOM_DELETE' || record.kind === 'DOM_REORDER') {
      if (!exactGap(record.before, record.kind === 'DOM_REORDER' ? record.node : undefined,ignored)) { record.state = 'CONFLICT'; record.reason = 'Original sibling gap changed; no position is guessed.'; return false; }
    }
    writing = true;
    try {
      if (record.kind === 'DOM_INSERT' || record.kind === 'DOM_DUPLICATE') remove(record.node);
      else insert(record.before.parent, record.node, record.before.next);
      drain();
      const restored = record.kind === 'DOM_INSERT' || record.kind === 'DOM_DUPLICATE' ? record.node.parentNode === null : positioned(record.node, record.before,ignored);
      if (!restored || !sameSnapshot(record.snapshot, capture(record.node))) { record.state = 'CONFLICT'; record.reason = 'Host reaction changed native rollback; no further write was attempted.'; return false; }
      records.delete(record); record.state = 'resolved'; record.reason = undefined; stats.rollbacks++;
      for(const [node,observer] of observers)if(![...records].some(active=>active.node===node||active.before.parent===node)){observer.disconnect();observers.delete(node);}
      return true;
    } catch { record.state = 'FAILED'; record.reason = 'Native structural rollback failed.'; return false; }
    finally { writing = false; }
  }
  return { prepare, apply, rollback, refresh, active: () => ledger.activeStructures(), getStats: () => ({ ...stats }),
    rows(history: DOMStructureChange[]) {
      stats.projections++;
      // Exact native net projection: creations subsequently deleted and reorders back to their original gap vanish.
      const hidden = new Set<DOMStructureChange>(), firstMoves = new Map<Element, DOMStructureChange>();
      for (const record of history) {
        if (record.kind === 'DOM_DELETE' && record.state === 'applied') {
          const creation = history.find(other => other.node === record.node && ['DOM_INSERT','DOM_DUPLICATE'].includes(other.kind));
          if (creation) { hidden.add(creation); hidden.add(record); }
        }
        if (record.kind === 'DOM_REORDER') { if (!firstMoves.has(record.node)) firstMoves.set(record.node, record); }
      }
      for (const [node, first] of firstMoves) {
        const moves = history.filter(record => record.node === node && record.kind === 'DOM_REORDER');
        if (positioned(node, first.before,ignored) && moves.at(-1)?.state === 'applied') for (const move of moves) hidden.add(move);
        else for (const move of moves.slice(0, -1)) hidden.add(move);
      }
      return history.filter(record => !hidden.has(record));
    },
    destroy() { destroyed = true; for (const observer of observers.values()) observer.disconnect(); observers.clear(); },
  };
}
