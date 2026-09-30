import type { TargetLifecycle } from '../../picker/targetLifecycle';
import type { TargetLocator, LocatorResolution } from '../locator';
import { reconciliationLimits as limits, type ReconciliationResult, type ReconciliationState } from './model';
export * from './model';

type Hooks<T> = {
  resolve: (locator: TargetLocator) => LocatorResolution;
  migrate: (ticket: T, resolution: LocatorResolution, generation: number) => boolean;
  reject: (ticket: T) => void;
  owns: (element: Element) => boolean;
};
/** Bounded, temporary loss reconciliation. Locator proof alone authorizes candidates; CSS strings never do. */
export function createReconciliation<T>(doc: Document, lifecycle: TargetLifecycle, hooks: Hooks<T>) {
  const win = doc.defaultView!;
  let generation = 0, destroyed = false, observer: MutationObserver | null = null, timer: number | null = null;
  let pending: { locator: TargetLocator; ticket: T; region: Element | Document | ShadowRoot; deadline: number; records: number; nodes: number } | null = null;
  let state: ReconciliationResult = { state: 'retired', generation: 0, attempts: 0, reason: 'No active target.', locator: null, resolution: null, element: null };
  const stats = { starts: 0, resolutions: 0, retries: 0, migrations: 0, deliveries: 0, records: 0, candidateNodes: 0 };
  const cleanup = () => { observer?.disconnect(); observer = null; if (timer !== null) win.clearTimeout(timer); timer = null; };
  const finish = (next: ReconciliationState, reason: string, resolution = state.resolution) => {
    const ticket = pending?.ticket; pending = null; cleanup();
    state = { ...state, state: next, reason, resolution, element: next === 'migrated' ? resolution?.element ?? null : null };
    if (ticket) hooks.reject(ticket);
  };
  const cancel = (reason = 'Reconciliation retired.') => { generation++; finish('retired', reason); state = { ...state, generation }; };
  function attempt(token: number) {
    if (destroyed || token !== generation || !pending) return;
    if (win.performance.now() >= pending.deadline || state.attempts >= limits.retries) { finish('missing', 'Reconciliation window/retry limit expired.'); return; }
    const run = pending;
    stats.resolutions++; if (state.attempts) stats.retries++;
    const resolution = hooks.resolve(run.locator);
    state = { ...state, attempts: state.attempts + 1, resolution, reason: resolution.reason };
    if (win.performance.now() >= run.deadline) { finish('missing', 'Reconciliation window expired during resolution.', resolution); return; }
    if (resolution.state === 'resolved-unique') {
      const replacement = resolution.element;
      state = { ...state, state: 'replacement-resolved', element: replacement };
      if (token !== generation || pending !== run || !replacement || resolution.confidence !== 'strong' || resolution.candidateCount !== 1 || !lifecycle.admissible(replacement) || replacement.ownerDocument !== doc || replacement.getRootNode() !== run.locator.root || replacement.namespaceURI !== run.locator.evidence.namespace || replacement.localName !== run.locator.evidence.tag) {
        finish('migration-rejected', 'Migration preconditions no longer hold.'); return;
      }
      // Retire observer/timer before ownership transfer. No queued delivery can act on a later binding.
      cleanup();
      if (hooks.migrate(run.ticket, resolution, token)) {
        if (token !== generation || pending !== run) return;
        stats.migrations++; pending = null; state = { ...state, state: 'migrated', reason: 'Strong same-root replacement migrated.', element: replacement };
      } else finish('migration-rejected', 'Session ownership transfer rejected.');
      return;
    }
    if (resolution.state === 'missing') {
      if (state.attempts >= limits.retries) finish('missing', 'Resolver retry budget exhausted.', resolution);
      else state = { ...state, state: 'waiting-for-replacement', element: null };
      return;
    }
    const next: ReconciliationState = resolution.state === 'ambiguous' ? 'ambiguous' : resolution.state === 'root-mismatch' ? 'root-mismatch' : resolution.state === 'document-mismatch' || resolution.state === 'unsupported-frame' ? 'unsupported' : 'migration-rejected';
    finish(next, resolution.reason, resolution);
  }
  return {
    /** Selection-time references only; no observers, searches or hot-path reconciliation work. */
    arm(locator: TargetLocator) { cancel('New explicit target binding.'); state = { state: 'active-original', generation, attempts: 0, reason: 'Original target active.', locator, resolution: null, element: locator.identity.element }; },
    start(locator: TargetLocator, ticket: T, regions: readonly Element[]) {
      if (destroyed) { hooks.reject(ticket); return; }
      cancel('Starting new loss generation.'); stats.starts++;
      const token = generation;
      const region = regions.find(element => element.isConnected && element.getRootNode() === locator.root && !hooks.owns(element)) ?? locator.root;
      pending = { locator, ticket, region, deadline: win.performance.now() + limits.windowMs, records: 0, nodes: 0 };
      state = { state: 'waiting-for-replacement', generation: token, attempts: 0, reason: 'Original styling quarantined.', locator, resolution: null, element: null };
      // Observe before the loss-time query so a later microtask cannot fall through a registration gap.
      observer = new win.MutationObserver(records => {
        if (token !== generation || !pending || destroyed) return;
        stats.deliveries++; stats.records += records.length; pending.records += records.length;
        if (records.length > limits.recordsPerDelivery || pending.records > limits.recordsTotal) { finish('migration-rejected', 'Mutation record budget exceeded.'); return; }
        let plausible = ('isConnected' in region && !region.isConnected) || locator.boundaries.some(boundary => !boundary.host.isConnected || boundary.host.shadowRoot !== boundary.root);
        let inspected = 0;
        const inspect = (node: Node): boolean => {
          if (++inspected > limits.nodesPerDelivery || ++pending!.nodes > limits.nodesTotal) return false;
          stats.candidateNodes++;
          if (!(node instanceof win.Element) || hooks.owns(node) || node.hasAttribute('data-cssforge-edit-layer')) return true;
          if (node.localName === locator.evidence.tag && node.namespaceURI === locator.evidence.namespace) plausible = true;
          for (let child = node.firstElementChild; child; child = child.nextElementSibling) if (!inspect(child)) return false;
          return true;
        };
        for (const record of records) {
          if (record.target instanceof win.Element && (hooks.owns(record.target) || record.target.hasAttribute('data-cssforge-edit-layer'))) continue;
          if (record.type === 'attributes') { if (!inspect(record.target)) { finish('migration-rejected', 'Candidate node budget exceeded.'); return; } }
          else for (const node of record.addedNodes) if (!inspect(node)) { finish('migration-rejected', 'Candidate node budget exceeded.'); return; }
        }
        if (plausible) attempt(token);
      });
      const attributes = [...new Set(['id', ...(locator.ancestors.length ? ['class'] : []), ...locator.evidence.attributes.map(item => item.name)])].slice(0, 16);
      observer.observe(region, { childList: true, subtree: region instanceof win.Element, attributes: true, attributeFilter: attributes });
      // Boundary parent child lists catch host/root loss without watching an entire ancestor subtree.
      for (const boundary of locator.boundaries) if (boundary.host.parentNode) observer.observe(boundary.host.parentNode, { childList: true });
      timer = win.setTimeout(() => { if (token === generation && pending) finish('missing', 'Reconciliation window expired.'); }, limits.windowMs);
      attempt(token);
    },
    cancel,
    isCurrent: (token: number) => !destroyed && generation === token && !!pending && win.performance.now() < pending.deadline,
    getSnapshot: () => state,
    getStats: () => ({ ...stats }),
    destroy() { if (destroyed) return; cancel('Extension deactivated.'); destroyed = true; },
  };
}
