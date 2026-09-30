import { splitCSS } from '../../editing/rich';
import { createCascade } from '../cascade';
import type { SourceIndex } from '../sources';
import type { TargetLifecycle } from '../../picker/targetLifecycle';
import type { SourceRule } from '../sources/model';
import { selectorMatch } from '../cascade/matching';
import { mutationLimits, type AuthorChange, type DeclarationSnapshot, type MutationRequest, type MutationResult, type MutationScope, type MutationTarget, type NativeBinding } from './model';
export * from './model';

export const declarationNames = (style: CSSStyleDeclaration) => splitCSS(style.cssText, ';').map(item => item.slice(0, item.indexOf(':')).trim()).filter(Boolean);
const snapshot = (style: CSSStyleDeclaration, property: string): DeclarationSnapshot => ({ exists: declarationNames(style).includes(property), value: style.getPropertyValue(property), priority: style.getPropertyPriority(property) });
const equal = (a: DeclarationSnapshot, b: DeclarationSnapshot) => a.exists === b.exists && a.value === b.value && a.priority === b.priority;
const sameDeclarations = (a: CSSStyleDeclaration, b: CSSStyleDeclaration) => {
  const names = declarationNames(a), other = declarationNames(b);
  return names.length === other.length && names.every(name => other.includes(name) && equal(snapshot(a, name), snapshot(b, name)));
};
const header = (rule: CSSRule) => rule.cssText.slice(0, rule.cssText.indexOf('{')).trim();
const flatten = (rules: SourceRule[]): SourceRule[] => rules.flatMap(rule => [rule, ...flatten(rule.children)]);

/** Explicit, reversible live CSSOM writes. No pointer listeners, observers, polling or selector generation. */
export function createAuthorMutation(doc: Document, sources: SourceIndex, lifecycle: TargetLifecycle, changed: () => void, authorized: (request: MutationRequest) => boolean = () => true) {
  const cascade = createCascade(doc, sources);
  const issued = new WeakMap<MutationTarget, { request: MutationRequest; headers: string[]; sheetMedia: string; parent: Node | null }>();
  const active = new Set<AuthorChange>(); let generation = 0, destroyed = false;
  const stats = { analyses: 0, capabilityChecks: 0, writes: 0, rollbacks: 0, rejections: 0 };
  const reject = (reason: string, safeFallback = true, target?: MutationTarget): MutationResult => { stats.rejections++; return { state: safeFallback ? 'fallback' : 'rejected', reason, safeFallback, target }; };
  const refresh = (element: Element) => { sources.invalidate(element); cascade.invalidate(); };
  // An author rule can govern other cached targets, including a replacement DOM object.
  // Drop associations lazily; discovery still runs only on explicit consumer requests.
  const authorChanged = () => { sources.invalidate(); cascade.invalidate(); changed(); };
  function scope(binding: NativeBinding, selector: string | null, context: MutationRequest['context'], adopted: boolean): MutationScope {
    if (!selector) return { kind: 'target-specific', matchedCount: 1, bounded: true, risk: 'local' };
    let matchedCount = 0, visited = 0;
    const walker = doc.createTreeWalker(binding.root, 1);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (++visited > mutationLimits.scopeElements) return { kind: 'unknown', matchedCount, bounded: false, risk: 'unknown' };
      if (selectorMatch(node as Element, selector, context).state === 'matched') matchedCount++;
    }
    // Constructable sheets can be shared with roots/documents outside our inspectable scope.
    return adopted ? { kind: 'unknown', matchedCount, bounded: false, risk: 'unknown' } : { kind: matchedCount > 1 ? 'shared-rule' : 'target-specific', matchedCount, bounded: true, risk: matchedCount > 1 ? 'shared' : 'local' };
  }
  function prepare(request: MutationRequest): MutationTarget | MutationResult {
    stats.analyses++;
    const { element, property, context } = request;
    if (destroyed || !lifecycle.valid(element) || !authorized(request) || !/^(?:--[\w-]+|[a-z][a-z-]*)$/.test(property)) return reject('Unsupported or changed target, context or property.');
    refresh(element); const source = sources.read(element), result = cascade.read(element, context, [property]), provenance = result.properties[property];
    if (!provenance) return reject('Missing author provenance.');
    const inline = source.inline.rules[0];
    const inlineAdd = request.inline && !context.pseudo && !context.media.length && inline && !declarationNames((element as HTMLElement).style).includes(property);
    const localShadow = element.getRootNode() !== doc && !source.sheets.filter(sheet => sheet.scopeId === source.scopeId).some(sheet => flatten(sheet.rules).some(rule => /:host\b|::slotted\b|::part\b/.test(rule.selectorText ?? '')));
    const issues = provenance.issues.filter(issue => !(localShadow && issue === 'shadow-scope'));
    if (issues.length || provenance.confidence === 'unresolved' || provenance.unresolved.length || (provenance.inherited && !inlineAdd)) return reject('Author cascade is incomplete, inherited or uncertain.');
    const candidate = provenance.winner ?? (localShadow && !issues.length ? provenance.readableWinner : undefined);
    if (!candidate && !inlineAdd) return reject('No exact authored declaration.');
    if (candidate && candidate.declaration.property !== property) return reject('The authored winner is a shorthand; use a session override.');
    const rule = inlineAdd ? inline : candidate!.rule, owner = inlineAdd ? source.inline : candidate!.source;
    if (owner.url) {
      try { if (new URL(owner.url, doc.URL).origin !== new URL(doc.URL).origin) return reject('Cross-origin author sheets are not writable in this phase.'); }
      catch { return reject('Stylesheet origin is unavailable.'); }
    }
    const declaration = rule.declarations.find(item => item.property === property);
    if (!inlineAdd && !declaration) return reject('No exact authored declaration.');
    if ((request.sourceId && request.sourceId !== owner.id) || (request.ruleId && request.ruleId !== rule.id) || (request.declarationId && request.declarationId !== declaration?.id)) return reject('The requested declaration is not the certain winner.');
    const media = rule.contexts.filter(item => item.kind === 'media').map(item => item.condition!);
    if (JSON.stringify(media) !== JSON.stringify(context.media) || rule.contexts.some(item => !['media', 'supports', 'layer'].includes(item.kind))) return reject('Selected context does not exactly match the authored context.');
    if (rule.selectorText) {
      const match = selectorMatch(element, rule.selectorText, context);
      const suffix = match.selector?.match(/(::before|::after|:hover|:focus|:active)$/)?.[0] ?? '';
      if (match.state !== 'matched' || suffix !== context.pseudo) return reject('Selected pseudo/state differs from the author rule.');
    } else if (context.pseudo || context.media.length) return reject('Inline declarations only support base context.');
    const binding = sources.binding(element, owner.id, rule.id); if (!binding) return reject('Native source identity is unavailable.');
    const scopeInfo = scope(binding, rule.selectorText ?? null, context, owner.kind === 'adopted');
    if ((scopeInfo.kind !== 'target-specific' || !scopeInfo.bounded) && !request.allowShared) return { ...reject('Shared or unknown rule scope requires explicit authorization.'), scope: scopeInfo } as MutationResult;
    if (scopeInfo.matchedCount < 1) return reject('The authored rule has no proven target in this root.');
    const before = Object.freeze(snapshot(binding.style, property));
    Object.freeze(binding.ancestry); Object.freeze(binding);
    const target: MutationTarget = Object.freeze({ sourceId: owner.id, ruleId: rule.id, declarationId: declaration?.id ?? `${rule.id}:declaration:${property}`, property, sourceKind: owner.kind,
      authoredValue: before.value, priority: before.priority, root: binding.root, binding, context: Object.freeze({ media: Object.freeze([...context.media]) as unknown as string[], pseudo: context.pseudo }), ancestry: Object.freeze(rule.contexts.map(item => Object.freeze({ ...item }))) as unknown as MutationTarget['ancestry'], writable: 'unverified', strategy: binding.rule ? 'cssom-declaration' : 'inline-declaration', certainty: 'certain-local-author', scope: Object.freeze(scopeInfo), rollback: before,
      cssText: binding.style.cssText, selector: rule.selectorText ?? null, generation });
    issued.set(target, { request: { ...request, context: target.context }, headers: binding.ancestry.map(header), sheetMedia: binding.sheet?.media.mediaText ?? '', parent: binding.sheet?.ownerNode?.parentNode ?? null });
    return target;
  }
  function valid(target: MutationTarget, rollback = false) {
    const record = issued.get(target); if (!record || destroyed || (!rollback && (target.generation !== generation || !authorized(record.request)))) return false;
    const { binding } = target;
    if (binding.element) {
      const sameRoot = binding.element.getRootNode() === target.root;
      return binding.element.ownerDocument === doc && (binding.element as HTMLElement).style === binding.style && (rollback ? !binding.element.isConnected || sameRoot : lifecycle.valid(binding.element) && sameRoot);
    }
    if (!binding.sheet || !binding.rule || binding.rule.style !== binding.style || binding.rule.selectorText !== target.selector || binding.sheet.disabled || binding.sheet.media.mediaText !== record.sheetMedia || target.root.ownerDocument !== (target.root === doc ? null : doc) || (target.root !== doc && !(target.root as ShadowRoot).host.isConnected)) return false;
    try {
      const root = target.root;
      const regular = root === doc ? [...doc.styleSheets] : [...root.querySelectorAll('style,link')].map(node => (node as HTMLStyleElement).sheet);
      if (![...regular, ...(root.adoptedStyleSheets ?? [])].includes(binding.sheet)) return false;
      if (binding.sheet.ownerNode && binding.sheet.ownerNode.parentNode !== record.parent) return false;
      let list = binding.sheet.cssRules;
      for (const [index, native] of [...binding.ancestry, binding.rule].entries()) {
        if (!Array.from(list).includes(native) || (index < binding.ancestry.length && header(native) !== record.headers[index])) return false;
        list = (native as CSSGroupingRule).cssRules;
      }
      return true;
    } catch { return false; }
  }
  function apply(target: MutationTarget, value: string, priority?: '' | 'important'): MutationResult {
    const record = issued.get(target);
    if (!record || !valid(target) || target.binding.style.cssText !== target.cssText || !equal(snapshot(target.binding.style, target.property), target.rollback)) return reject('Source identity or declaration changed before mutation.', true, target);
    const request = { ...record.request, value, priority };
    if (priority !== undefined && priority !== '' && priority !== 'important') return reject('Invalid CSS priority.', true, target);
    const fresh = prepare(request);
    if ('state' in fresh) return fresh;
    if (fresh.sourceId !== target.sourceId || fresh.ruleId !== target.ruleId || fresh.binding.style !== target.binding.style || fresh.cssText !== target.cssText) return reject('Fresh provenance no longer confirms this source.', true, target);
    if (!value.trim() || value.length > 8000 || /[;{}\u0000-\u001f]/.test(value) || /!\s*important/i.test(value) || (!target.property.startsWith('--') && !doc.defaultView!.CSS.supports(target.property, value))) return reject('Invalid CSS value.', true, target);
    const style = target.binding.style, before = target.rollback, beforeCSS = style.cssText, chosenPriority = priority ?? before.priority;
    const scratch = doc.createElement('div').style; scratch.cssText = beforeCSS; scratch.setProperty(target.property, value, chosenPriority);
    const original = doc.createElement('div').style; original.cssText = beforeCSS;
    const restoreOwnDeclaration = () => {
      const names = new Set([...declarationNames(style), ...declarationNames(original)]);
      if ([...names].some(name => name !== target.property && !equal(snapshot(style, name), snapshot(original, name)))) return false;
      try { if (before.exists) style.setProperty(target.property, before.value, before.priority); else style.removeProperty(target.property); } catch { /* Verify even if a wrapper threw after accepting restoration. */ }
      return style.cssText === beforeCSS && equal(snapshot(style, target.property), before);
    };
    const expected = snapshot(scratch, target.property);
    if (!expected.exists || !expected.value || declarationNames(style).some(name => name !== target.property && !equal(snapshot(style, name), snapshot(scratch, name)))) return reject('Unsafe shorthand interaction or CSSOM value rejection.', true, target);
    if (equal(before, expected)) return { state: 'unchanged', target };
    // Probe with the exact existing declaration (or a nonexistent remove for explicit inline addition).
    stats.capabilityChecks++;
    try {
      if (before.exists) style.setProperty(target.property, before.value, before.priority); else style.removeProperty(target.property);
      if (style.cssText !== beforeCSS || !valid(target)) { const restored = restoreOwnDeclaration(); authorChanged(); return reject('Capability probe changed the source.', restored, target); }
      style.setProperty(target.property, value, chosenPriority);
    } catch {
      if (style.cssText === beforeCSS) return reject('CSSOM rejected the mutation; source unchanged.', true, target);
      const restored = restoreOwnDeclaration(); authorChanged();
      return reject(restored ? 'CSSOM failed; intended declaration was restored.' : 'CSSOM failed after changing the source; fallback is unsafe.', restored, target);
    }
    if (!sameDeclarations(style, scratch) || !equal(snapshot(style, target.property), expected) || !valid(target)) {
      // Restore only our intended declaration, and only when no unrelated state changed.
      const restored = restoreOwnDeclaration();
      authorChanged();
      return reject('CSSOM mutation could not be verified.', restored, target);
    }
    const accepted = Object.freeze({ ...target, writable: 'accepted' as const }); issued.set(accepted, record);
    const change: AuthorChange = { target: accepted, before, after: expected, beforeCSS, afterCSS: style.cssText, generation, strategy: target.strategy };
    active.add(change); stats.writes++; authorChanged();
    return { state: 'mutated', target: accepted, change };
  }
  function rollback(change: AuthorChange): boolean {
    if (!active.has(change) || !valid(change.target, true)) return false;
    const { style } = change.target.binding, property = change.target.property;
    // Any external CSSOM change is a conflict. Never overwrite page changes to get a cosmetically exact reset.
    if (style.cssText !== change.afterCSS || !equal(snapshot(style, property), change.after)) return false;
    try { if (change.before.exists) style.setProperty(property, change.before.value, change.before.priority); else style.removeProperty(property); } catch { /* An accepted restoration is verified below, even when a wrapper throws afterward. */ }
    if (style.cssText !== change.beforeCSS || !equal(snapshot(style, property), change.before)) return false;
    active.delete(change); stats.rollbacks++; authorChanged(); return true;
  }
  return {
    prepare, apply, rollback,
    mutate(request: MutationRequest): MutationResult { const target = prepare(request); return 'state' in target ? target : apply(target, request.value, request.priority); },
    active: () => [...active],
    declarationState(id?: string) { return id && [...active].some(change => change.target.declarationId === id) ? 'cssforge-mutated-author' : 'authored'; },
    getStats: () => ({ ...stats }),
    resetGeneration() { generation++; },
    destroy() { for (const change of [...active].reverse()) rollback(change); destroyed = true; active.clear(); cascade.destroy(); },
  };
}
export type AuthorMutation = ReturnType<typeof createAuthorMutation>;
