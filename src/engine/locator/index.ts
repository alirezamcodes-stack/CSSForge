import type { TargetIdentity, TargetLifecycle } from '../../picker/targetLifecycle';
import { captureEvidence, evidenceKeys, incompatibilities } from './evidence';
import type { AncestorEvidence, ElementEvidence, EvidenceKey, LocatorLimits, LocatorResolution, ResolveRequest, RootBoundary, TargetLocator } from './model';
export type { TargetLocator, LocatorResolution, ResolveRequest } from './model';

/** Evidence capture on explicit selection; bounded read-only resolution on loss/request only. */
export function createTargetLocator(doc: Document, lifecycle: TargetLifecycle, options: Partial<LocatorLimits> = {}) {
  const limits: LocatorLimits = { candidates: 64, ancestors: 8, queries: 24, shadowDepth: 12, ...options };
  const win = doc.defaultView!;
  let cache = new WeakMap<TargetIdentity, TargetLocator>(), generation = 0, destroyed = false;
  const stats = { captures: 0, requests: 0, searches: 0, queries: 0, candidates: 0 };
  const attributeQuery = (attributes: EvidenceKey['attributes']) => attributes.map(item => `[${win.CSS.escape(item.name)}="${win.CSS.escape(item.value)}"]`).join('');
  const targetQuery = (evidence: ElementEvidence) => win.CSS.escape(evidence.tag) + (evidence.id ? attributeQuery([{ name: 'id', value: evidence.id }]) : '') + attributeQuery(evidence.attributes) + evidence.classes.slice(0, 3).map(value => `[class~="${win.CSS.escape(value)}"]`).join('');
  function search(scope: Document | ShadowRoot | Element, query: string, budget: { remaining: number }) {
    if (--budget.remaining < 0) return { nodes: [] as Element[], count: 0, truncated: true };
    stats.queries++;
    const nodes = scope.querySelectorAll(query);
    if (nodes.length > limits.candidates) return { nodes: [] as Element[], count: nodes.length, truncated: true };
    const result = Array.from(nodes); stats.candidates += result.length;
    return { nodes: result, count: result.length, truncated: false };
  }
  function capture(identity: TargetIdentity, refresh = false): TargetLocator {
    if (destroyed || !lifecycle.safe(identity)) throw new Error('Only a valid explicit target can create a locator.');
    const cached = cache.get(identity); if (cached && !refresh) return cached;
    stats.captures++;
    const budget = { remaining: limits.queries }, evidence = captureEvidence(identity.element);
    const root = identity.root, boundaries: RootBoundary[] = [];
    let current: Node = root, unsupportedRoot = false, truncated = false;
    while (current !== doc) {
      if (!(current instanceof win.ShadowRoot) || current.mode !== 'open') { unsupportedRoot = true; break; }
      if (boundaries.length >= limits.shadowDepth) { truncated = true; break; }
      boundaries.unshift({ root: current, host: current.host, evidence: captureEvidence(current.host) });
      current = current.host.getRootNode();
    }
    const verify = (key: EvidenceKey, element: Element): EvidenceKey => {
      const found = search(root, attributeQuery(key.attributes), budget);
      return Object.freeze({ ...key, attributes: Object.freeze(key.attributes.map(item => Object.freeze({ name: item.name, value: item.value }))), uniqueAtCapture: !found.truncated && found.count === 1 && found.nodes[0] === element });
    };
    const keys = evidenceKeys(evidence).map(key => verify(key, identity.element));
    const ancestors: AncestorEvidence[] = [];
    let ancestor = identity.element.parentElement;
    for (let depth = 0; ancestor && depth < limits.ancestors; depth++, ancestor = ancestor.parentElement) {
      const ancestorEvidence = captureEvidence(ancestor);
      for (const rawKey of evidenceKeys(ancestorEvidence).slice(0, 2)) {
        const key = verify(rawKey, ancestor);
        if (!key.uniqueAtCapture) continue;
        const children = search(ancestor, targetQuery(evidence), budget);
        ancestors.push(Object.freeze({ evidence: ancestorEvidence, key, targetUniqueAtCapture: !children.truncated && children.count === 1 && children.nodes[0] === identity.element })); break;
      }
    }
    truncated ||= budget.remaining < 0;
    const locator: TargetLocator = Object.freeze({ version: 1, generation: ++generation, identity, document: doc, frame: Object.freeze({ kind: 'top-document', identity: null }), root, boundaries: Object.freeze(boundaries.map(item => Object.freeze(item))), evidence, keys: Object.freeze(keys), ancestors: Object.freeze(ancestors), truncated, unsupportedRoot });
    cache.set(identity, locator); return locator;
  }
  function resolve(locator: TargetLocator, request: ResolveRequest = {}): LocatorResolution {
    stats.requests++;
    const result = (state: LocatorResolution['state'], reason: string, candidateCount = 0, evidenceUsed: string[] = [], element: Element | null = null, rejected: LocatorResolution['rejected'] = []): LocatorResolution => ({ state, reason, candidateCount, evidenceUsed, element, rejected, confidence: state === 'original-valid' ? 'original' : state === 'resolved-unique' ? 'strong' : state === 'ambiguous' || state === 'unsafe' ? 'insufficient' : 'none' });
    if (destroyed || cache.get(locator.identity) !== locator) return result('unsafe', 'Locator is not current in this session.');
    if (request.frame === 'interior') return result('unsupported-frame', 'Frame-local targeting is not implemented.');
    if (locator.document !== doc || (request.document && request.document !== doc) || locator.identity.element.ownerDocument !== doc || (win.document && win.document !== doc)) return result('document-mismatch', 'The owning document changed.');
    if (request.candidate?.ownerDocument !== undefined && request.candidate.ownerDocument !== doc) return result('document-mismatch', 'Candidate belongs to another document.');
    if (locator.unsupportedRoot) return result('unsafe', 'Closed or inaccessible root boundary.');
    for (const boundary of locator.boundaries) {
      const expectedParent = locator.boundaries[locator.boundaries.indexOf(boundary) - 1]?.root ?? doc;
      if (!boundary.host.isConnected || boundary.host.ownerDocument !== doc || boundary.host.shadowRoot !== boundary.root || boundary.host.getRootNode() !== expectedParent) return result('root-mismatch', 'Captured open root/host chain is no longer available.');
    }
    const original = locator.identity.element;
    if ((original.isConnected && original.getRootNode() !== locator.root) || (request.candidate && request.candidate.getRootNode() !== locator.root)) return result('root-mismatch', 'Target or proposed candidate moved to another root.');
    if (lifecycle.safe(locator.identity)) return result('original-valid', 'Original DOM object remains authoritative.', 1, ['DOM object', 'lifecycle binding'], original);
    if (original.isConnected) return result('unsafe', 'Connected original no longer has a valid lifecycle binding.');
    if (locator.truncated) return result('truncated', 'Capture exceeded the evidence budget.');
    stats.searches++;
    const budget = { remaining: limits.queries };
    const root = locator.root;
    const ancestorMatches = (element: Element, anchor: AncestorEvidence) => {
      let parent = element.parentElement;
      for (let depth = 0; parent && depth < limits.ancestors; depth++, parent = parent.parentElement) {
        if (parent.namespaceURI === anchor.evidence.namespace && parent.localName === anchor.evidence.tag && anchor.key.attributes.every(item => parent!.getAttribute(item.name) === item.value)) return true;
      }
      return false;
    };
    const evaluate = (found: ReturnType<typeof search>, authorized: boolean, used: string[], duplicateIsAmbiguous = false): LocatorResolution => {
      if (found.truncated) return result('truncated', 'Candidate/query cap exceeded; uniqueness cannot be established.', found.count, used);
      if (duplicateIsAmbiguous && found.count > 1) return result('ambiguous', 'Duplicate identity evidence.', found.count, used);
      const accepted: Element[] = [], rejected: { element: Element; reasons: string[] }[] = [];
      for (const element of found.nodes) {
        const reasons = incompatibilities(locator.evidence, captureEvidence(element));
        if (!lifecycle.admissible(element) || element.getRootNode() !== root) reasons.push('unsupported lifecycle/root');
        if (locator.ancestors.some(anchor => !ancestorMatches(element, anchor))) reasons.push('stable ancestor changed');
        if (reasons.length) rejected.push({ element, reasons }); else accepted.push(element);
      }
      if (accepted.length > 1) return result('ambiguous', 'Multiple plausible compatible replacements.', accepted.length, used, null, rejected);
      if (!accepted.length) return result(found.count ? 'unsafe' : 'missing', found.count ? 'Candidates failed compatibility checks.' : 'No same-root candidate.', found.count, used, null, rejected);
      if (!authorized) return result('unsafe', 'Evidence was weak or not unique at capture.', accepted.length, used, null, rejected);
      const element = accepted[0]; // Only reachable after both uniqueness and authorization checks.
      if (request.candidate && request.candidate !== element) return result('unsafe', 'Proposed candidate does not match the proven replacement.', accepted.length, used, null, rejected);
      return result('resolved-unique', 'Strong captured evidence proves one compatible same-root replacement.', 1, used, element, rejected);
    };
    // Duplicate IDs are a hard veto. Non-unique data labels are corroboration;
    // prefer proven unique application keys before narrowing via a stable ancestor.
    const direct = locator.keys.filter(key => key.kind === 'id' || key.uniqueAtCapture);
    for (const key of direct) {
      const found = search(root, attributeQuery(key.attributes), budget);
      if (found.count || found.truncated) return evaluate(found, key.uniqueAtCapture, [key.kind === 'id' ? 'unique ID' : key.kind === 'data' ? `stable ${key.attributes[0].name}` : 'semantic combination'], key.kind === 'id');
    }
    for (const anchor of locator.ancestors) {
      const found = search(root, attributeQuery(anchor.key.attributes), budget);
      if (found.truncated) return result('truncated', 'Ancestor query exceeded cap.', found.count);
      if (found.count > 1) return result('ambiguous', 'Stable ancestor is duplicated.', found.count);
      if (!found.count) continue;
      if (incompatibilities(anchor.evidence, captureEvidence(found.nodes[0])).length) return result('unsafe', 'Stable ancestor became incompatible.', 1);
      const target = search(found.nodes[0], targetQuery(locator.evidence), budget);
      const corroborated = locator.evidence.attributes.length > 0 || locator.evidence.classes.length > 0;
      return evaluate(target, anchor.targetUniqueAtCapture && corroborated, [`stable ancestor ${anchor.key.attributes[0].name}`, 'target attributes/classes']);
    }
    for (const key of locator.keys.filter(key => key.kind !== 'id' && !key.uniqueAtCapture)) {
      const found = search(root, attributeQuery(key.attributes), budget);
      if (found.count || found.truncated) return evaluate(found, false, ['non-unique attribute at capture']);
    }
    return evaluate(search(root, targetQuery(locator.evidence), budget), false, ['weak tag/classes/attributes']);
  }
  return { capture, resolve, getStats: () => ({ ...stats }), destroy() { destroyed = true; cache = new WeakMap(); } };
}
