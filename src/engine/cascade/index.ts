import { properties as editorProperties } from '../../editing/properties';
import { baseContext, contextKey, type EditContext } from '../../editing/contexts';
import type { SourceIndex } from '../sources';
import type { SessionGroup, SourceRule, SourceSheet } from '../sources/model';
import type { Candidate, CascadeResult, Issue, LossReason, PropertyCascade } from './model';
import { compareSpecificity } from './specificity';
import { selectorMatch } from './matching';
import { layerOrder } from './layers';
import { createExpander, inheritedProperties, isInherited, type Expand } from './properties';

const unique = <T,>(items: T[]) => [...new Set(items)];
function precedence(a: Candidate, b: Candidate): { difference: number; reason: LossReason } {
  if (a.declaration.important !== b.declaration.important) return { difference: Number(a.declaration.important) - Number(b.declaration.important), reason: 'important' };
  if ((a.source.kind === 'inline') !== (b.source.kind === 'inline')) return { difference: Number(a.source.kind === 'inline') - Number(b.source.kind === 'inline'), reason: 'inline' };
  const layerA = a.layer ?? Infinity, layerB = b.layer ?? Infinity;
  if (layerA !== layerB) return { difference: (layerA > layerB ? 1 : -1) * (a.declaration.important ? -1 : 1), reason: 'layer-order' };
  const specificity = compareSpecificity(a.specificity, b.specificity);
  if (specificity) return { difference: specificity, reason: 'specificity' };
  return { difference: a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2], reason: 'source-order' };
}

/** Pure author-cascade ordering. Browser/user origins and computed-value substitution are separate. */
export function resolveCandidates(property: string, candidates: Candidate[], issues: Issue[] = []): PropertyCascade {
  const matched = candidates.filter(item => item.state === 'matched');
  const unresolved = candidates.filter(item => item.state === 'unresolved');
  const sorted = [...matched].sort((a, b) => precedence(b, a).difference);
  const readableWinner = sorted[0];
  const allIssues = unique([...issues, ...unresolved.flatMap(item => item.issues)]);
  const confidence = unresolved.length || allIssues.some(item => !['inaccessible-source', 'source-limit', 'unindexed-origin', 'shadow-scope', 'animation-or-transition'].includes(item)) ? 'unresolved' : allIssues.length ? 'incomplete' : 'resolved';
  return {
    property, confidence, readableWinner, winner: confidence === 'resolved' ? readableWinner : undefined,
    matched, inactive: candidates.filter(item => item.state === 'inactive'), unresolved,
    overridden: sorted.slice(1).map(candidate => ({ candidate, reason: precedence(readableWinner, candidate).reason, bySessionEdit: readableWinner.source.kind === 'override' })),
    importantAffected: !!readableWinner?.declaration.important && sorted.some(item => !item.declaration.important),
    cssforge: candidates.filter(item => item.source.kind === 'override'), issues: allIssues,
  };
}

export function createCascade(doc: Document, sources: Pick<SourceIndex, 'read' | 'overrides'>, sessionGroups: (element: Element) => SessionGroup[] = () => [], expand: Expand = createExpander(doc), sessionPosition?: (element: Element) => number | undefined) {
  let cache = new WeakMap<Element, Map<string, { source: ReturnType<SourceIndex['read']>; result: CascadeResult }>>(), resolutions = 0;
  function read(element: Element, context: EditContext = baseContext(), requested: readonly string[] = editorProperties, depth = 0): CascadeResult {
    const snapshot = sources.read(element), key = JSON.stringify([contextKey(context), requested]);
    const previous = cache.get(element)?.get(key); if (previous?.source === snapshot) return previous.result;
    resolutions++;
    const globalIssues: Issue[] = [];
    const scopeSheets = snapshot.sheets.filter(sheet => sheet.scopeId === snapshot.scopeId);
    if (scopeSheets.some(sheet => !sheet.disabled && !sheet.accessibility.readable)) globalIssues.push('inaccessible-source');
    if (snapshot.notices.some(notice => /limit/i.test(notice))) globalIssues.push('source-limit');
    if (element.getRootNode() !== doc) globalIssues.push('shadow-scope');
    const layers = layerOrder(scopeSheets);
    const candidates = new Map<string, Candidate[]>(); const uncertainProperties = new Map<string, Issue[]>();
    const registered = new Set<string>(); let allReset = false, motion = false;
    const note = (property: string, issue: Issue) => uncertainProperties.set(property, unique([...(uncertainProperties.get(property) ?? []), issue]));
    function collect(rule: SourceRule, source: SourceSheet) {
      if (!source.accessibility.readable || !rule.accessibility.readable) { if (!source.disabled) globalIssues.push('inaccessible-source'); return; }
      if (/^@import\b/.test(rule.cssText) && !source.disabled) globalIssues.push('inaccessible-source');
      if (/^@property\b/.test(rule.cssText)) { const name = rule.cssText.match(/^@property\s+(--[^\s{]+)/)?.[1]; if (name) registered.add(name); }
      if (rule.kind === 'keyframes' || rule.kind === 'keyframe') return;
      if (rule.kind === 'style' || rule.kind === 'inline' || rule.kind === 'override' || rule.contexts.some(item => item.kind === 'style')) {
        const match = rule.kind === 'inline' ? { weight: [0, 0, 0] as const, state: context.pseudo.startsWith('::') ? 'inactive' as const : 'matched' as const, reason: 'pseudo' as const, selector: undefined }
          : rule.kind === 'override' ? { weight: [0, 1 + (rule.editContext!.pseudo.startsWith(':') && !rule.editContext!.pseudo.startsWith('::') ? 1 : 0), rule.editContext!.pseudo.startsWith('::') ? 1 : 0] as const, state: (context.pseudo.startsWith('::') ? rule.editContext!.pseudo === context.pseudo : !rule.editContext!.pseudo || rule.editContext!.pseudo === context.pseudo) ? 'matched' as const : 'inactive' as const, reason: 'pseudo' as const, selector: undefined }
          : selectorMatch(element, rule.selectorText ?? '&', context);
        let state: Candidate['state'] = match.state, inactiveReason: Candidate['inactiveReason'] = state === 'inactive' ? match.reason : undefined;
        const issues: Issue[] = state === 'unresolved' ? ['unsupported-selector'] : [];
        if (source.disabled) { state = 'inactive'; inactiveReason = 'disabled'; }
        for (const condition of rule.contexts) {
          if (condition.kind === 'media' || condition.kind === 'supports') {
            if (condition.matches === false) { state = 'inactive'; inactiveReason = condition.kind; }
            else if (condition.matches === null) issues.push('unsupported-context');
          } else if (condition.kind !== 'layer') issues.push('unsupported-context');
        }
        // Choosing media never forces an inactive query, and excludes other conditional branches.
        const media = rule.contexts.filter(item => item.kind === 'media').map(item => item.condition);
        if (context.media.length && media.some(query => !context.media.includes(query!))) { state = 'inactive'; inactiveReason = 'media'; }
        const layer = rule.contexts.find(item => item.kind === 'layer');
        const layerName = layer?.name ?? layer?.text.replace(/^@layer\s*/, '');
        const layerIndex = layerName ? layers.names.indexOf(layerName) : -1;
        if (layers.uncertain || (layer && layerIndex < 0)) issues.push('unsupported-layer-order');
        if (issues.length && state !== 'inactive') state = 'unresolved';
        for (const declaration of rule.declarations) {
          const activeState = declaration.enabled ? state : 'inactive';
          if (declaration.property === 'all' && activeState !== 'inactive') { allReset = true; continue; }
          if (activeState !== 'inactive' && /^(animation|transition)(-|$)/.test(declaration.property) && !/^(none|0s|0)$/.test(declaration.value)) motion = true;
          const expanded = expand(declaration.property, declaration.value);
          for (const item of expanded) {
            const issue = item.uncertain ? ['unsupported-shorthand' as const] : [];
            // Physical/logical mapping depends on writing mode, which this engine does not resolve.
            if (activeState !== 'inactive' && /(?:^|-)(?:inline|block)(?:-|$)/.test(item.property)) globalIssues.push('logical-property');
            const candidate: Candidate = { declaration, rule, source, property: item.property, value: item.value, selector: match.selector, specificity: match.weight,
              order: [source.order, rule.order, declaration.order], layer: layer ? layerIndex : null,
              state: item.uncertain && activeState !== 'inactive' ? 'unresolved' : activeState,
              inactiveReason: !declaration.enabled ? 'disabled' : inactiveReason, issues: unique([...issues, ...issue]) };
            const list = candidates.get(item.property) ?? []; list.push(candidate); candidates.set(item.property, list);
          }
        }
      }
      rule.children.forEach(child => collect(child, source));
    }
    scopeSheets.forEach(sheet => sheet.rules.forEach(rule => collect(rule, sheet)));
    snapshot.inline.rules.forEach(rule => collect(rule, snapshot.inline));
    const overrides = sources.overrides(element, [...sessionGroups(element)].sort((a, b) => a.context.media.length - b.context.media.length));
    // Position is between indexed author sheets, from the live session layer's location.
    // Later page-inserted sheets can follow the session layer; session edits are not always last.
    const position = sessionPosition?.(element);
    if (overrides.rules.some(rule => rule.declarations.some(declaration => declaration.enabled)) && position === undefined) globalIssues.push('unsupported-source-order');
    overrides.order = position ?? 0;
    overrides.rules.forEach(rule => collect(rule, overrides));
    if (allReset) globalIssues.push('unsupported-shorthand');
    if (motion) globalIssues.push('animation-or-transition');
    registered.forEach(property => note(property, 'registered-custom-property'));

    const root = element.getRootNode();
    const parent = context.pseudo.startsWith('::') ? element : element.parentElement ?? ('host' in root && (root as ShadowRoot).mode === 'open' ? (root as ShadowRoot).host : null);
    const parentRequested = unique([...requested, ...candidates.keys()]);
    const parentResult = parent && depth < 64 ? read(parent, baseContext(), parentRequested, depth + 1) : null;
    if (parent && depth >= 64) globalIssues.push('source-limit');
    const names = new Set([...requested.flatMap(property => expand(property, 'initial').map(item => item.property)), ...inheritedProperties, ...candidates.keys(), ...Object.keys(parentResult?.properties ?? {}).filter(property => property.startsWith('--'))]);
    const result: CascadeResult = { context, scope: 'readable-author', browserEquivalent: false, properties: {}, issues: unique(['unindexed-origin', ...globalIssues]) };
    for (const property of names) {
      const resolved = resolveCandidates(property, candidates.get(property) ?? [], [...globalIssues, ...(uncertainProperties.get(property) ?? [])]);
      const chosen = resolved.readableWinner, value = chosen?.value.trim().toLowerCase();
      const inheritance = isInherited(property);
      if (value === 'revert' || value === 'revert-layer') {
        resolved.confidence = 'unresolved'; resolved.winner = undefined; resolved.issues.push('unsupported-keyword');
      } else if (value === 'initial' || (value === 'unset' && inheritance === false)) resolved.defaulting = 'initial';
      else if (value === 'inherit' || (inheritance === true && (!chosen || value === 'unset'))) {
        resolved.defaulting = parent ? 'inherit' : 'initial';
        const inherited = parentResult?.properties[property];
        if (parent && inherited) {
          resolved.inherited = { from: inherited.inherited?.from ?? parent, declaration: resolved.confidence === 'resolved' && inherited.confidence === 'resolved' ? inherited.inherited?.declaration ?? inherited.winner : undefined };
          if (inherited.confidence !== 'resolved') {
            resolved.confidence = inherited.confidence === 'unresolved' ? 'unresolved' : resolved.confidence === 'resolved' ? 'incomplete' : resolved.confidence;
            resolved.issues = unique([...resolved.issues, ...inherited.issues]); resolved.winner = undefined;
          }
        }
      } else if ((!chosen || value === 'unset') && inheritance === null) {
        resolved.confidence = 'unresolved'; resolved.winner = undefined; resolved.issues.push('unknown-inheritance');
      } else if (!chosen) resolved.defaulting = 'initial';
      result.properties[property] = resolved;
    }
    const entries = cache.get(element) ?? new Map(); entries.set(key, { source: snapshot, result }); cache.set(element, entries); return result;
  }
  return { read, invalidate(element?: Element) {
    if (!element) { cache = new WeakMap(); return; }
    let node: Element | null = element;
    for (let depth = 0; node && depth < 64; depth++) { cache.delete(node); const root = node.getRootNode(); node = node.parentElement ?? ('host' in root ? (root as ShadowRoot).host : null); }
  }, getStats: () => ({ resolutions }), destroy() { cache = new WeakMap(); } };
}
export type Cascade = ReturnType<typeof createCascade>;
