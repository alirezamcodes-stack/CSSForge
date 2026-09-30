import { splitCSS } from '../../editing/rich';
import { createCascade } from '../cascade';
import type { SourceIndex } from '../sources';
import type { TargetLifecycle } from '../../picker/targetLifecycle';
import type { SourceRule } from '../sources/model';
import { selectorMatch } from '../cascade/matching';
import { mutationLimits, type AuthorChange, type AppliedAuthorChange, type PartialAuthorChange, type DeclarationSnapshot, type MutationRequest, type MutationResult, type MutationTarget } from './model';
import { createAuthorLedger, type AuthorLedger } from './ledger';
import { mutationScope } from './scope';
export * from './model';
export { createAuthorLedger, type AuthorLedger } from './ledger';

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
export function createAuthorMutation(doc: Document, sources: SourceIndex, lifecycle: TargetLifecycle, changed: () => void, authorized: (request: MutationRequest) => boolean = () => true, ledger: AuthorLedger = createAuthorLedger(doc)) {
  const cascade = createCascade(doc, sources);
  const store = ledger.attach(doc), { issued, changes: active, session } = store;
  let destroyed = false, writing = false, destroying = false, destroyRequested = false;
  const stats = { analyses: 0, capabilityChecks: 0, writes: 0, rollbacks: 0, rejections: 0 };
  const reject = (reason: string, safeFallback = true, target?: MutationTarget): Extract<MutationResult, { state: 'fallback' | 'rejected' }> => { stats.rejections++; return { state: safeFallback ? 'fallback' : 'rejected', reason, safeFallback, target }; };
  const refresh = (element: Element) => { sources.invalidate(element); cascade.invalidate(); };
  // An author rule can govern other cached targets, including a replacement DOM object.
  // Drop associations lazily; discovery still runs only on explicit consumer requests.
  const authorChanged = () => { sources.invalidate(); cascade.invalidate(); changed(); };
  function prepare(request: MutationRequest): MutationTarget | MutationResult {
    stats.analyses++;
    const { element, property, context } = request;
    if (destroyed || !ledger.current(session) || !lifecycle.valid(element) || !authorized(request) || !/^(?:--[\w-]+|[a-z][a-z-]*)$/.test(property)) return reject('Unsupported or changed target, context or property.');
    refresh(element); const source = sources.read(element), result = cascade.read(element, context, [property]), provenance = result.properties[property];
    if (!provenance) return reject('Missing author provenance.');
    const inline = source.inline.rules[0];
    const inlineAdd = request.inline && !context.pseudo && !context.media.length && inline && !declarationNames((element as HTMLElement).style).includes(property);
    const localShadow = element.getRootNode() !== doc && !source.sheets.filter(sheet => sheet.scopeId === source.scopeId).some(sheet => flatten(sheet.rules).some(rule => /:host\b|::slotted\b|::part\b/.test(rule.selectorText ?? '')));
    const issues = provenance.issues.filter(issue => !(localShadow && issue === 'shadow-scope'));
    if (issues.length || provenance.confidence === 'unresolved' || provenance.unresolved.length || (provenance.inherited && !inlineAdd)) return { ...reject('Author cascade is incomplete, inherited or uncertain.'), scope: { kind: 'unknown', matchedCount: 0, bounded: false, risk: 'unknown' } };
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
    const scopeInfo = mutationScope(doc, binding.root, rule.selectorText ?? null, owner.kind === 'adopted');
    if ((scopeInfo.kind !== 'target-specific' || !scopeInfo.bounded) && !request.allowShared) return { ...reject('Shared or unknown rule scope requires explicit authorization.'), scope: scopeInfo } as MutationResult;
    if (scopeInfo.matchedCount < 1) return reject('The authored rule has no proven target in this root.');
    const before = Object.freeze(snapshot(binding.style, property));
    Object.freeze(binding.ancestry); Object.freeze(binding);
    const target: MutationTarget = Object.freeze({ sourceId: owner.id, ruleId: rule.id, declarationId: declaration?.id ?? `${rule.id}:declaration:${property}`, property, sourceKind: owner.kind,
      authoredValue: before.value, priority: before.priority, root: binding.root, binding, context: Object.freeze({ media: Object.freeze([...context.media]) as unknown as string[], pseudo: context.pseudo }), ancestry: Object.freeze(rule.contexts.map(item => Object.freeze({ ...item }))) as unknown as MutationTarget['ancestry'], writable: 'unverified', strategy: binding.rule ? 'cssom-declaration' : 'inline-declaration', certainty: 'certain-local-author', scope: Object.freeze(scopeInfo), rollback: before,
      cssText: binding.style.cssText, selector: rule.selectorText ?? null, generation: store.generation() });
    issued.set(target, { request: { ...request, context: target.context }, headers: binding.ancestry.map(header), sheetMedia: binding.sheet?.media.mediaText ?? '', parent: binding.sheet?.ownerNode?.parentNode ?? null });
    return target;
  }
  function valid(target: MutationTarget, rollback = false) {
    const record = issued.get(target); if (!record || destroyed || !ledger.current(session) || (!rollback && (target.generation !== store.generation() || !authorized(record.request)))) return false;
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
    if (writing || destroying) return reject('A native author transaction is already in progress.', false, target);
    writing = true;
    try { return applyNative(target, value, priority); }
    finally { writing = false; if (destroyRequested) destroy(); }
  }
  function applyNative(target: MutationTarget, value: string, priority?: '' | 'important'): MutationResult {
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
    const expected = Object.freeze(snapshot(scratch, target.property));
    if (!expected.exists || !expected.value || declarationNames(style).some(name => name !== target.property && !equal(snapshot(style, name), snapshot(scratch, name)))) return reject('Unsafe shorthand interaction or CSSOM value rejection.', true, target);
    if (equal(before, expected)) return { state: 'unchanged', target };
    // Reserve recovery capacity before any native write; unresolved records are never evicted.
    if (active.size >= mutationLimits.authorRecords) return reject('Author recovery history limit reached.', true, target);
    const failedWrite = (reason: string, attempted = expected): MutationResult => {
      const current = snapshot(style, target.property);
      authorChanged();
      // No intended property remains to recover. Page-only reactions are not our transactions.
      if (equal(current, before)) return reject(`${reason} Intended property unchanged.`, style.cssText === beforeCSS, target);
      // Retain the existing clean failure/fallback path only when ownership is exact and
      // no unrelated declaration has changed. Never restore a newer external property value.
      if (valid(target, true) && equal(current, attempted) && restoreOwnDeclaration()) return reject(`${reason} Intended declaration restored.`, true, target);
      const observed = snapshot(style, target.property);
      const change: PartialAuthorChange = { kind: 'partial', target, before, after: attempted, attempted, current: observed,
        beforeCSS, afterCSS: style.cssText, generation: store.generation(), session, strategy: target.strategy,
        state: equal(observed, attempted) ? 'partial-write' : 'blocked', reason };
      active.add(change);
      return { ...reject(`${reason} Pending author recovery retained.`, false, target), change };
    };
    // Probe with the exact existing declaration (or a nonexistent remove for explicit inline addition).
    stats.capabilityChecks++;
    try {
      if (before.exists) style.setProperty(target.property, before.value, before.priority); else style.removeProperty(target.property);
      if (style.cssText !== beforeCSS || !valid(target)) return failedWrite('Capability probe changed the source.', before);
      style.setProperty(target.property, value, chosenPriority);
    } catch {
      if (style.cssText === beforeCSS) return reject('CSSOM rejected the mutation; source unchanged.', true, target);
      return failedWrite('CSSOM failed after changing the source.');
    }
    if (!sameDeclarations(style, scratch) || !equal(snapshot(style, target.property), expected) || !valid(target)) {
      return failedWrite('CSSOM mutation could not be verified.');
    }
    const accepted = Object.freeze({ ...target, writable: 'accepted' as const }); issued.set(accepted, record);
    const change: AppliedAuthorChange = { kind: 'applied', target: accepted, before, after: expected, attempted: expected, current: expected,
      beforeCSS, afterCSS: style.cssText, generation: store.generation(), session, strategy: target.strategy, state: 'applied' };
    active.add(change); stats.writes++; authorChanged();
    return { state: 'mutated', target: accepted, change };
  }
  function rollback(change: AuthorChange): boolean {
    if (writing) return false;
    writing = true;
    try { return rollbackNative(change); }
    finally { writing = false; if (destroyRequested && !destroying) destroy(); }
  }
  function rollbackNative(change: AuthorChange): boolean {
    if (destroyed || !ledger.current(session) || !active.has(change) || change.session !== session) return false;
    const block = (reason: string) => { change.state = 'blocked'; change.reason = reason; return false; };
    if (!valid(change.target, true)) { change.reason = 'Exact native source identity is unavailable.'; change.state = 'retired'; return false; }
    const { style } = change.target.binding, property = change.target.property;
    change.current = snapshot(style, property);
    // Any external CSSOM change is a conflict. Never overwrite page changes to get a cosmetically exact reset.
    // A partial write has a narrower ownership proof: only the exact attempted property.
    if (!equal(change.current, change.after) || (change.kind === 'applied' && style.cssText !== change.afterCSS)) return block('Author declaration changed externally.');
    const scratch = doc.createElement('div').style; scratch.cssText = style.cssText;
    if (change.before.exists) scratch.setProperty(property, change.before.value, change.before.priority); else scratch.removeProperty(property);
    const unrelated = new Set([...declarationNames(style), ...declarationNames(scratch)]);
    if ([...unrelated].some(name => name !== property && !equal(snapshot(style, name), snapshot(scratch, name)))) return block('Restoration would change an unrelated declaration.');
    try { if (change.before.exists) style.setProperty(property, change.before.value, change.before.priority); else style.removeProperty(property); } catch { /* An accepted restoration is verified below, even when a wrapper throws afterward. */ }
    change.current = snapshot(style, property);
    authorChanged();
    if (!valid(change.target, true)) { change.state = 'retired'; change.reason = 'Source identity changed during rollback.'; return false; }
    if (!equal(change.current, change.before)) return block('Native page reaction prevented restoration.');
    // Our property was restored; synchronous unrelated page reactions remain untouched.
    change.state = 'resolved'; change.reason = undefined;
    active.delete(change); stats.rollbacks++; return true;
  }
  function destroy() {
    if (destroyed || destroying) return;
    if (writing) { destroyRequested = true; return; }
    destroying = true; destroyRequested = false;
    try { for (const change of [...active].reverse()) rollback(change); }
    finally { store.advance(); destroyed = true; destroying = false; cascade.destroy(); }
  }
  return {
    prepare, apply, rollback,
    mutate(request: MutationRequest): MutationResult { const target = prepare(request); return 'state' in target ? target : apply(target, request.value, request.priority); },
    active: () => [...active],
    declarationState(id?: string, declaration?: { sourceId?: string; ruleId?: string; property: string; value: string; priority: string }, element?: Element) {
      if (!id || destroyed || !ledger.current(session)) return 'authored' as const;
      const binding = declaration?.sourceId && declaration.ruleId && element ? sources.binding(element, declaration.sourceId, declaration.ruleId) : null;
      const owned = [...active].some(change => {
        const target = change.target;
        if (declaration) {
          if (!binding || id !== `${declaration.ruleId}:declaration:${declaration.property}` || target.property !== declaration.property || binding.style !== target.binding.style || binding.sheet !== target.binding.sheet || binding.rule !== target.binding.rule || binding.root !== target.root) return false;
        } else if (target.declarationId !== id) return false;
        if (!valid(target, true)) return false;
        change.current = snapshot(target.binding.style, target.property);
        if (declaration && (declaration.value !== change.after.value || declaration.priority !== change.after.priority)) return false;
        return equal(change.current, change.after);
      });
      return owned ? 'cssforge-mutated-author' as const : 'authored' as const;
    },
    getStats: () => ({ ...stats }),
    busy: () => writing || destroying,
    resetGeneration() { if (!writing && !destroying) store.advance(); },
    destroy,
  };
}
export type AuthorMutation = ReturnType<typeof createAuthorMutation>;
