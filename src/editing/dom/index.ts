import type { TargetIdentity } from '../../picker/targetLifecycle';
import { resolveText, textLimit } from './resolve';
import type { DOMTextChange, TextFailure, TextPlan, TextResult } from './model';
import type { DOMStructureChange } from './structure';
export type { DOMTextChange, TextFailure, TextPlan, TextResult, TextChangeRow } from './model';

/** Ownership ledger, not a history stack. The editing session owns transaction order. */
export function createDOMLedger(doc: Document) {
  let root = doc.documentElement, retired = false;
  const records = new Set<DOMTextChange>();
  const structureRecords = new Set<DOMStructureChange>();
  const retire = (reason: string) => { for (const record of [...records,...structureRecords]) { record.state = 'retired'; record.reason = reason; } records.clear(); structureRecords.clear(); retired = true; };
  return {
    retire,
    current() { if (root !== doc.documentElement) retire('Document tree was replaced.'); return !retired; },
    attach() { this.current(); if (retired) { root = doc.documentElement; retired = false; } return records; },
    active() { this.current(); return [...records]; },
    structures() { this.attach(); return structureRecords; },
    activeStructures() { this.current(); return [...structureRecords]; },
  };
}
export type DOMLedger = ReturnType<typeof createDOMLedger>;

export function createDOMMutation(doc: Document, ledger: DOMLedger, safe: (identity: TargetIdentity) => boolean, authorized: (plan: TextPlan) => boolean, changed: () => void, session:object={}) {
  const records = ledger.attach(), plans = new WeakSet<TextPlan>();
  const observers = new Map<Element, MutationObserver>();
  let destroyed = false, writing = false;
  const stats = { resolutions: 0, preparations: 0, writes: 0, rollbacks: 0, rejections: 0 };
  const descriptor = Object.getOwnPropertyDescriptor(doc.defaultView!.CharacterData.prototype, 'data')!;
  const read = (node: Text): string => descriptor.get!.call(node);
  const write = (node: Text, value: string) => { descriptor.set!.call(node, value); stats.writes++; };
  const failure = (state: TextFailure['state'], reason: string): TextFailure => { stats.rejections++; return { state, reason }; };
  const resolve=(identity:TargetIdentity)=>{stats.resolutions++;return resolveText(identity);};
  // Recovery checks use exact native anchors, not a newly issued UI lifecycle identity.
  const anchored = (plan: TextPlan) => ledger.current() && plan.owner.isConnected && plan.node.isConnected && plan.owner.ownerDocument === doc && plan.owner.getRootNode() === plan.root && plan.node.parentNode === plan.owner && plan.owner.childNodes.length === 1 && plan.owner.childNodes[0] === plan.node;
  function check(record: DOMTextChange) {
    if (!anchored(record.plan)) { record.current = null; record.state = 'UNAVAILABLE'; record.reason = 'The exact original Text or owner is unavailable; replacement text is never inferred.'; }
    else {
      record.current = read(record.plan.node);
      const eligibility = resolve(record.plan.identity);
      if (eligibility.state !== 'available') { record.state = 'UNAVAILABLE'; record.reason = eligibility.reason; }
      else if (record.current !== record.applied) { record.state = 'CONFLICT'; record.reason = 'The page changed this text. Its current value is preserved.'; }
      else { record.state = 'applied'; record.reason = undefined; }
    }
    return record.state === 'applied';
  }
  function latest() {
    const result = new Map<Text, DOMTextChange>();
    for (const record of records) { const previous = result.get(record.plan.node); if (!previous || previous.order < record.order) result.set(record.plan.node, record); }
    return result;
  }
  function watch(owner: Element) {
    if (observers.has(owner) || !doc.defaultView!.MutationObserver) return;
    const observer = new doc.defaultView!.MutationObserver(() => {
      if (destroyed || writing) return;
      let different = false;
      for (const record of latest().values()) if (record.plan.owner === owner) {
        const beforeState=record.state,beforeCurrent=record.current,beforeReason=record.reason;check(record);
        different ||= beforeState!==record.state||beforeCurrent!==record.current||beforeReason!==record.reason;
      }
      if (different) changed();
    });
    observer.observe(owner, { characterData: true, childList: true, attributes: true, subtree: true });
    observers.set(owner, observer);
  }
  for (const record of records) watch(record.plan.owner);
  const drain = () => { for (const observer of observers.values()) observer.takeRecords(); };
  function rollback(record: DOMTextChange) {
    if(records.has(record)&&latest().get(record.plan.node)!==record){record.state='superseded';record.reason='A later text transaction must be reversed first.';return false;}
    if (destroyed || writing || !records.has(record) || !check(record)) return false;
    writing = true;
    try {
      write(record.plan.node, record.before); drain();
      if (!anchored(record.plan) || read(record.plan.node) !== record.before) { check(record); record.reason = 'The page blocked or changed rollback.'; return false; }
      records.delete(record); record.current = record.before; record.state = 'resolved'; stats.rollbacks++;
      if (![...records].some(item => item.plan.owner === record.plan.owner)) { observers.get(record.plan.owner)?.disconnect(); observers.delete(record.plan.owner); }
      return true;
    } catch { record.state = 'FAILED'; record.reason = 'Native text rollback failed.'; return false; }
    finally { writing = false; }
  }
  return {
    prepare(targetId: string, bindingGeneration: number, identity: TargetIdentity, label: string): TextPlan | TextFailure {
      stats.preparations++;
      if (destroyed || !safe(identity)) return failure('UNAVAILABLE','Select an available element first.');
      const resolved = resolve(identity); if (resolved.state !== 'available') return resolved;
      const plan = Object.freeze({ targetId,bindingGeneration,identity,owner:identity.element,node:resolved.node,root:identity.root,before:read(resolved.node),label }); plans.add(plan); return plan;
    },
    apply(plan: TextPlan, value: string, order: number): TextResult {
      if (destroyed || writing || !plans.has(plan) || !authorized(plan) || !safe(plan.identity)) return failure('STALE','The selected target or binding changed. Cancel and reopen the editor.');
      if (!anchored(plan)) return failure('UNAVAILABLE','The exact original Text node is unavailable.');
      const resolved = resolve(plan.identity); if (resolved.state !== 'available' || resolved.node !== plan.node) return failure('UNAVAILABLE','The original text target is no longer eligible.');
      if (read(plan.node) !== plan.before) return failure('CONFLICT','The page changed the draft baseline. Cancel and reopen to review its current text.');
      if (typeof value !== 'string' || value.length > textLimit) return failure('FAILED','Text exceeds the 65,536 character editing limit.');
      plans.delete(plan);
      if (value === plan.before) return { state: 'unchanged' };
      writing = true;
      const change: DOMTextChange = { kind:'DOM_TEXT_MUTATION',plan,before:plan.before,applied:value,current:value,order,transactionId:{},session,state:'applied' };
      try {
        write(plan.node,value); drain();
        // A native reaction may have changed ownership on the same synchronous stack.
        if (!anchored(plan) || read(plan.node) !== value) { records.add(change); check(change); watch(plan.owner); return {...failure('FAILED','The native write lost its exact owner or value. Pending recovery retained.'),change}; }
        records.add(change); watch(plan.owner); return { state:'applied',change };
      } catch {
        if (anchored(plan) && read(plan.node) !== plan.before) { records.add(change);check(change);watch(plan.owner);return {...failure('FAILED','The native write partially changed text. Pending recovery retained.'),change}; }
        return failure('FAILED','Native text write failed; no transaction was committed.');
      } finally { writing = false; }
    },
    rollback,
    refresh() {
      const current=latest();for(const record of current.values())check(record);
      for(const record of records){const top=current.get(record.plan.node)!;if(top!==record){record.current=top.current;record.state='superseded';record.reason=top.state==='applied'?'A later text transaction owns this exact Text. Undo it first.':'A newer text rollback is blocked; this earlier record remains pending.';}}
    },
    getStats: () => ({ ...stats }),
    active: () => ledger.active(),
    destroy() {
      if (destroyed) return;
      const blocked = new Set<Text>();
      for (const record of [...records].sort((a,b)=>b.order-a.order)) {
        if (blocked.has(record.plan.node) || !rollback(record)) blocked.add(record.plan.node);
      }
      destroyed = true; for (const observer of observers.values()) observer.disconnect(); observers.clear();
    },
  };
}
