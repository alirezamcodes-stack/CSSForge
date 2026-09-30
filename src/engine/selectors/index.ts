import type { TargetIdentity, TargetLifecycle } from '../../picker/targetLifecycle';
import { captureEvidence, stableID } from '../locator/evidence';
import { escapeIdentifier, escapeString } from './escape';
import { selectorLimits as limits, type SelectorRequest, type SelectorResult, type SelectorSegment, type SelectorStrategy, type SelectorValidation } from './model';
export * from './model';

type Candidate = { selector: string; strategy: SelectorStrategy; stability: SelectorSegment['stability'] };
type Budget = { attempts: number; queries: number; exhausted: boolean };
const blocked = (value: string) => /^cssforge(?:[-_]|$)/i.test(value);

/** Export selectors are descriptions, never identity/reconciliation authority. No observers or eager work. */
export function createSelectorEngine(doc: Document, lifecycle: TargetLifecycle) {
  const win = doc.defaultView!;
  const escape = (value: string) => win.CSS?.escape ? win.CSS.escape(value) : escapeIdentifier(value);
  const attribute = (name: string, value: string) => `[${escape(name)}="${escapeString(value)}"]`;
  let cache = new WeakMap<TargetIdentity, SelectorResult>();
  let destroyed = false;
  const stats = { requests: 0, generations: 0, validations: 0, cacheHits: 0 };
  const scope = (root: Document | ShadowRoot) => root === doc || root.nodeType === 9 ? 'document' as const : 'shadow-root' as const;
  function validate(root: Document | ShadowRoot, selector: string, target: Element, budget: Budget): SelectorValidation {
    if (budget.queries >= limits.validations || selector.length > limits.length) { budget.exhausted = true; return { state: 'truncated', count: null, matchesTarget: false }; }
    budget.queries++; stats.validations++;
    try {
      const matches = root.querySelectorAll(selector), matchesTarget = matches.length === 1 && matches[0] === target;
      return { state: matchesTarget ? 'unique' : 'non-unique', count: matches.length, matchesTarget };
    } catch { return { state: 'invalid', count: null, matchesTarget: false }; }
  }
  function candidates(element: Element, strongOnly = false): { list: Candidate[]; clipped: boolean } {
    const evidence = captureEvidence(element), list: Candidate[] = [];
    const add = (selector: string, strategy: SelectorStrategy, stability: Candidate['stability']) => list.push({ selector, strategy, stability });
    const id = element.getAttribute('id');
    if (id && id.length <= 160 && !blocked(id) && (!strongOnly || stableID(id))) add(`#${escape(id)}`, stableID(id) ? 'stable-id' : 'id', stableID(id) ? 'high' : 'low');
    const attributes = [...evidence.attributes].filter(item => item.name.length <= 160).sort((a, b) => Number(a.kind !== 'stable') - Number(b.kind !== 'stable') || a.name.localeCompare(b.name)).slice(0, limits.attributes);
    for (const item of attributes) add(attribute(item.name, item.value), item.kind === 'stable' ? 'stable-attribute' : 'semantic', item.kind === 'stable' ? 'high' : 'medium');
    let combinations = 0;
    for (let i = 0; i < attributes.length; i++) for (let j = i + 1; j < attributes.length && combinations < limits.combinations; j++, combinations++) {
      add(attribute(attributes[i].name, attributes[i].value) + attribute(attributes[j].name, attributes[j].value), attributes[i].kind === 'stable' && attributes[j].kind === 'stable' ? 'stable-attribute' : 'semantic', 'medium');
    }
    if (!strongOnly) {
      const classes = evidence.classes.filter(value => !blocked(value)).slice(0, limits.classes);
      for (const value of classes) add(`.${escape(value)}`, 'class-based', 'medium');
      combinations = 0;
      for (let i = 0; i < classes.length; i++) for (let j = i + 1; j < classes.length && combinations < limits.combinations; j++, combinations++) add(`.${escape(classes[i])}.${escape(classes[j])}`, 'class-based', 'medium');
      // Three meaningful classes are the final bounded combination tier.
      for (let i = 0; i < classes.length; i++) for (let j = i + 1; j < classes.length; j++) for (let k = j + 1; k < classes.length && combinations < limits.combinations; k++, combinations++) add(`.${escape(classes[i])}.${escape(classes[j])}.${escape(classes[k])}`, 'class-based', 'medium');
    }
    return { list, clipped: element.attributes.length > 32 || element.classList.length > 32 || evidence.attributes.length > limits.attributes || evidence.classes.length > limits.classes };
  }
  function generateSegment(target: Element, root: Document | ShadowRoot, budget: Budget, boundary: SelectorSegment['boundary']): SelectorSegment | null {
    if (target.localName.length > 160) { budget.exhausted = true; return null; }
    const seen = new Set<string>(), choices = candidates(target);
    function attempt(candidate: Candidate): SelectorSegment | null {
      if (seen.has(candidate.selector) || budget.exhausted) return null;
      if (budget.attempts >= limits.attempts) { budget.exhausted = true; return null; }
      seen.add(candidate.selector); budget.attempts++;
      const validation = validate(root, candidate.selector, target, budget);
      return validation.state === 'unique' ? { ...candidate, root, scope: scope(root), target, validation, boundary } : null;
    }
    for (const candidate of choices.list) { const found = attempt(candidate); if (found) return found; }
    let ancestor = target.parentElement;
    for (let depth = 0; ancestor && depth < limits.ancestors && !budget.exhausted; depth++, ancestor = ancestor.parentElement) {
      for (const anchor of candidates(ancestor, true).list) {
        if (validate(root, anchor.selector, ancestor, budget).state !== 'unique') continue;
        // The target search is bounded independently; tag is useful when target evidence is absent.
        for (const tail of [...choices.list.slice(0, 6), { selector: escape(target.localName), strategy: 'structural' as const, stability: 'low' as const }]) {
          const found = attempt({ selector: `${anchor.selector} ${tail.selector}`, strategy: 'ancestor-assisted', stability: tail.stability === 'low' && tail.strategy !== 'structural' ? 'low' : tail.strategy === 'structural' || anchor.stability === 'medium' || tail.stability === 'medium' ? 'medium' : 'high' });
          if (found) return found;
        }
      }
    }
    let node: Element | null = target, chain = '';
    for (let depth = 0; node && depth <= limits.ancestors && !budget.exhausted; depth++, node = node.parentElement) {
      if (node.localName.length > 160) { budget.exhausted = true; return null; }
      const tag = escape(node.localName);
      if (!chain) { const found = attempt({ selector: tag, strategy: 'structural', stability: 'low' }); if (found) return found; }
      let index = 1, typeIndex = 1, sibling = node.previousElementSibling;
      while (sibling && index <= limits.siblings) { index++; if (sibling.localName === node.localName && sibling.namespaceURI === node.namespaceURI) typeIndex++; sibling = sibling.previousElementSibling; }
      if (sibling || index > limits.siblings) { budget.exhausted = true; return null; }
      for (const part of [`${tag}:nth-of-type(${typeIndex})`, `${tag}:nth-child(${index})`]) {
        const found = attempt({ selector: chain ? `${part} > ${chain}` : part, strategy: 'structural', stability: 'low' }); if (found) return found;
      }
      chain = `${tag}:nth-child(${index})${chain ? ` > ${chain}` : ''}`;
    }
    budget.exhausted = budget.exhausted || choices.clipped || !!node || !!ancestor;
    return null;
  }
  function result(identity: TargetIdentity, request: SelectorRequest, origin: SelectorResult['origin'], path: SelectorSegment[], validation: SelectorValidation, selector: string | null = path.at(-1)?.selector ?? null): SelectorResult {
    const low = path.some(segment => segment.stability === 'low');
    return Object.freeze({ selector, origin, strategy: origin === 'authored' ? 'authored' : path.at(-1)?.strategy ?? null,
      root: identity.root, scope: scope(identity.root), state: validation.state, validation: Object.freeze(validation),
      stability: origin === 'authored' || !path.length || low ? 'low' : path.every(segment => segment.stability === 'high') ? 'high' : 'medium',
      risks: Object.freeze(origin === 'authored' ? ['authored-selector-stability-unassessed'] : path.filter(segment => segment.stability !== 'high').map(segment => segment.strategy === 'structural' ? 'position-dependent' : segment.stability === 'low' ? 'generated-id-may-change' : 'attributes-or-classes-may-change')),
      path: Object.freeze(path.map(segment => Object.freeze({ ...segment, validation: Object.freeze(segment.validation) }))),
      frame: Object.freeze({ kind: request.frame === 'interior' ? 'unsupported-interior' : 'top-document', path: null }), context: Object.freeze({ ...request.context, media: request.context?.media && Object.freeze([...request.context.media]), groups: request.context?.groups && Object.freeze(request.context.groups.map(group => Object.freeze({ ...group }))) }),
      limitations: Object.freeze([...(identity.root !== doc ? ['Selectors are root-local; traverse each open shadow boundary separately.'] : []), ...(validation.state === 'truncated' ? ['Search or validation budget exceeded.'] : []), 'Iframe interiors and closed shadow roots are unsupported.']),
    });
  }
  const unsupported = (identity: TargetIdentity, request: SelectorRequest, origin: SelectorResult['origin'], selector: string | null = null) => result(identity, request, origin, [], { state: 'unsupported', count: null, matchesTarget: false }, selector);
  return {
    generate(identity: TargetIdentity, request: SelectorRequest = {}): SelectorResult {
      stats.requests++;
      if (destroyed || request.frame === 'interior' || identity.document !== doc || !lifecycle.safe(identity)) { cache.delete(identity); return unsupported(identity, request, 'generated'); }
      const budget: Budget = { attempts: 0, queries: 0, exhausted: false }, cached = request.refresh ? undefined : cache.get(identity);
      if (cached?.state === 'unique') {
        const path = cached.path.map((segment, index) => ({ ...segment, validation: segment.target.getRootNode() === segment.root && (segment.boundary !== 'open-shadow' || segment.target.shadowRoot === cached.path[index + 1]?.root) ? validate(segment.root, segment.selector, segment.target, budget) : { state: 'unsupported' as const, count: null, matchesTarget: false } }));
        if (path.every(segment => segment.validation.state === 'unique')) { stats.cacheHits++; return result(identity, request, 'generated', path, path.at(-1)!.validation); }
      }
      stats.generations++;
      const targets: { target: Element; root: Document | ShadowRoot; boundary: SelectorSegment['boundary'] }[] = [{ target: identity.element, root: identity.root, boundary: null }];
      let root = identity.root;
      while (root !== doc) {
        if (!(root instanceof win.ShadowRoot) || root.mode !== 'open') return unsupported(identity, request, 'generated');
        if (targets.length > limits.shadowDepth) return result(identity, request, 'generated', [], { state: 'truncated', count: null, matchesTarget: false });
        const host = root.host, parentRoot = host.getRootNode();
        if (parentRoot !== doc && !(parentRoot instanceof win.ShadowRoot)) return unsupported(identity, request, 'generated');
        targets.unshift({ target: host, root: parentRoot as Document | ShadowRoot, boundary: 'open-shadow' }); root = parentRoot as Document | ShadowRoot;
      }
      const path: SelectorSegment[] = [];
      for (const item of targets) {
        const segment = generateSegment(item.target, item.root, budget, item.boundary);
        if (!segment) return result(identity, request, 'generated', path, { state: budget.exhausted ? 'truncated' : 'non-unique', count: null, matchesTarget: false }, null);
        path.push(segment);
      }
      const found = result(identity, request, 'generated', path, path.at(-1)!.validation); cache.set(identity, found); return found;
    },
    /** Exact authored text is retained, including pseudo selectors; context is separate and never inferred. */
    validateAuthored(identity: TargetIdentity, selectorText: string, request: SelectorRequest = {}): SelectorResult {
      stats.requests++;
      if (destroyed || request.frame === 'interior' || identity.document !== doc || !lifecycle.safe(identity)) return unsupported(identity, request, 'authored', selectorText);
      return result(identity, request, 'authored', [], validate(identity.root, selectorText, identity.element, { attempts: 0, queries: 0, exhausted: false }), selectorText);
    },
    invalidate(identity?: TargetIdentity) { if (identity) cache.delete(identity); else cache = new WeakMap(); },
    getStats: () => ({ ...stats }),
    destroy() { destroyed = true; cache = new WeakMap(); },
  };
}
