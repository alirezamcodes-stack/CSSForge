import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReconciliation, reconciliationLimits } from '../src/engine/reconciliation';
import type { LocatorResolution, TargetLocator } from '../src/engine/locator';
import type { TargetLifecycle } from '../src/picker/targetLifecycle';

class NodeElement {
  namespaceURI = 'html'; localName = 'button'; isConnected = true; parentNode = null; firstElementChild = null; nextElementSibling = null;
  constructor(public ownerDocument: Document) {}
  getRootNode() { return this.ownerDocument; }
  hasAttribute() { return false; }
}
function fixture() {
  vi.useFakeTimers();
  let callback: MutationCallback = () => {}, disconnected = 0, resultState: LocatorResolution['state'] = 'missing';
  const observer = { observe: vi.fn(), disconnect: () => disconnected++ };
  const doc = { defaultView: { Element: NodeElement, MutationObserver: class { constructor(fn: MutationCallback) { callback = fn; return observer; } }, performance: { now: () => Date.now() }, setTimeout, clearTimeout } } as unknown as Document;
  const replacement = new NodeElement(doc) as unknown as Element;
  const locator = { root: doc, identity: { element: new NodeElement(doc) }, evidence: { tag: 'button', namespace: 'html', attributes: [] }, boundaries: [], ancestors: [] } as unknown as TargetLocator;
  const resolution = (): LocatorResolution => ({ state: resultState, confidence: resultState === 'resolved-unique' ? 'strong' : 'none', element: resultState === 'resolved-unique' ? replacement : null, candidateCount: resultState === 'resolved-unique' ? 1 : 0, reason: resultState, evidenceUsed: [], rejected: [] });
  const migrate = vi.fn(() => true), reject = vi.fn(), resolve = vi.fn(resolution);
  const lifecycle = { admissible: () => true } as unknown as TargetLifecycle;
  const engine = createReconciliation(doc, lifecycle, { migrate, reject, resolve, owns: () => false });
  const ticket = {};
  const delivery = (records = [{ type: 'childList', target: doc, addedNodes: [replacement] }]) => callback(records as unknown as MutationRecord[], observer as unknown as MutationObserver);
  return { engine, locator, ticket, migrate, reject, resolve, observer, doc, replacement, delivery, state: (value: typeof resultState) => resultState = value, disconnected: () => disconnected };
}
afterEach(() => vi.useRealTimers());
describe('bounded reconciliation generations and authorization', () => {
  it('does no reconciliation work while the original is active', () => {
    const f = fixture(); f.engine.arm(f.locator); expect(f.engine.getSnapshot().state).toBe('active-original'); expect(f.resolve).not.toHaveBeenCalled(); expect(f.observer.observe).not.toHaveBeenCalled(); expect(f.engine.getStats().starts).toBe(0);
  });
  it('separates resolution from migration and retires observer/timer before transfer', () => {
    const f = fixture(); f.state('resolved-unique');
    f.migrate.mockImplementation(() => { expect(f.engine.getSnapshot().state).toBe('replacement-resolved'); expect(f.disconnected()).toBeGreaterThan(0); return true; });
    f.engine.start(f.locator, f.ticket, []); expect(f.engine.getSnapshot().state).toBe('migrated'); expect(f.migrate).toHaveBeenCalledOnce(); expect(f.reject).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000); f.delivery(); expect(f.migrate).toHaveBeenCalledOnce();
  });
  it.each(['ambiguous', 'unsafe', 'truncated', 'root-mismatch', 'document-mismatch', 'unsupported-frame'] as const)('never migrates %s and cannot be revived by later deliveries', state => {
    const f = fixture(); f.state(state); f.engine.start(f.locator, f.ticket, []); expect(f.migrate).not.toHaveBeenCalled(); expect(f.reject).toHaveBeenCalledWith(f.ticket);
    f.state('resolved-unique'); f.delivery(); expect(f.migrate).not.toHaveBeenCalled();
  });
  it('retries only plausible bounded mutation opportunities', () => {
    const f = fixture(); f.engine.start(f.locator, f.ticket, []);
    const irrelevant = new NodeElement(f.doc); irrelevant.localName = 'span'; f.delivery([{ type: 'childList', target: f.doc, addedNodes: [irrelevant as unknown as Element] }]); expect(f.resolve).toHaveBeenCalledOnce();
    f.state('resolved-unique'); f.delivery(); expect(f.engine.getSnapshot().state).toBe('migrated'); expect(f.resolve).toHaveBeenCalledTimes(2);
  });
  it.each(['childList', 'attributes'])('does not trust a layer lookalike during %s delivery', type => {
    const f = fixture(); f.engine.start(f.locator, f.ticket, []);
    const lookalike = new NodeElement(f.doc); lookalike.hasAttribute = () => true;
    f.state('resolved-unique');
    f.delivery([{ type, target: lookalike as unknown as Document, addedNodes: [lookalike as unknown as Element] }]);
    expect(f.engine.getSnapshot().state).toBe('migrated');
    expect(f.resolve).toHaveBeenCalledTimes(2);
  });
  it('expires without polling or resurrection', () => {
    const f = fixture(); f.engine.start(f.locator, f.ticket, []); vi.advanceTimersByTime(reconciliationLimits.windowMs + 1);
    expect(f.engine.getSnapshot().state).toBe('missing'); expect(f.resolve).toHaveBeenCalledOnce(); f.state('resolved-unique'); f.delivery(); expect(f.migrate).not.toHaveBeenCalled();
  });
  it('cancels stale observers/results when a new binding is armed', () => {
    const f = fixture(); f.engine.start(f.locator, f.ticket, []); const old = f.engine.getSnapshot().generation;
    f.engine.arm(f.locator); expect(f.engine.isCurrent(old)).toBe(false); f.state('resolved-unique'); f.delivery(); expect(f.migrate).not.toHaveBeenCalled(); expect(f.reject).toHaveBeenCalledWith(f.ticket);
  });
  it('fails closed at record and retry bounds', () => {
    const f = fixture(); f.engine.start(f.locator, f.ticket, []);
    for (let i = 0; i < reconciliationLimits.retries; i++) f.delivery(); expect(f.resolve).toHaveBeenCalledTimes(reconciliationLimits.retries); expect(f.engine.getSnapshot().state).toBe('missing');
    f.engine.start(f.locator, f.ticket, []); f.delivery(Array.from({ length: reconciliationLimits.recordsPerDelivery + 1 }, () => ({ type: 'childList', target: f.doc, addedNodes: [] })));
    expect(f.engine.getSnapshot().state).toBe('migration-rejected'); expect(f.migrate).not.toHaveBeenCalled();
  });
  it('rejects a candidate when session transfer rejects or root changed', () => {
    const f = fixture(); f.state('resolved-unique'); f.migrate.mockReturnValue(false); f.engine.start(f.locator, f.ticket, []); expect(f.engine.getSnapshot().state).toBe('migration-rejected');
    f.migrate.mockClear(); (f.replacement as unknown as NodeElement).getRootNode = () => ({} as Document); f.engine.start(f.locator, f.ticket, []); expect(f.migrate).not.toHaveBeenCalled();
  });
  it('destroy cancels all later work', () => {
    const f = fixture(); f.engine.start(f.locator, f.ticket, []); f.engine.destroy(); f.state('resolved-unique'); f.delivery(); vi.advanceTimersByTime(5000); expect(f.migrate).not.toHaveBeenCalled(); expect(f.engine.getSnapshot().state).toBe('retired');
  });
  it('never migrates when resolution itself runs beyond the window', () => {
    const f = fixture(); f.state('resolved-unique'); const original = f.resolve.getMockImplementation()!;
    f.resolve.mockImplementation(() => { const result = original(); vi.setSystemTime(Date.now() + reconciliationLimits.windowMs + 1); return result; });
    f.engine.start(f.locator, f.ticket, []); expect(f.engine.getSnapshot().state).toBe('missing'); expect(f.migrate).not.toHaveBeenCalled(); expect(f.reject).toHaveBeenCalledWith(f.ticket);
  });
});
