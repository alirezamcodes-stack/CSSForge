import { editorValue, normalizeValue, properties, validateValue, type Property } from './properties';
import { baseContext, contextKey, discoverMedia, pseudos, type EditContext, type MediaContext } from './contexts';
import { readConversionContext } from './conversionContext';
import type { ValueProperty, ConversionContext, ValueReference } from './values';
import type { SourceIndex } from '../engine/sources';
import { createTargetLifecycle, type TargetIdentity } from '../picker/targetLifecycle';
import { observeTarget } from '../picker/invalidation';
import { supportsSize } from './capabilities';
import { createMarkerContainment } from './markerContainment';
import type { LocatorResolution } from '../engine/locator';
import { reconciliationLimits } from '../engine/reconciliation/model';
import { createAuthorMutation, type AuthorChange, type AuthorLedger, type MutationPolicy, type MutationRequest, type MutationResult } from '../engine/mutation';

export type FieldValue = { computed: string; presented: string; authored?: string; override?: string };
export type DesignSnapshot = { targetId: string; bindingGeneration: number; values: Record<Property, FieldValue>; canSize: boolean };
export type OverrideGroup = { context: EditContext; declarations: { property: Property; value: string; enabled: boolean }[] };
export type EditState = { design: DesignSnapshot | null; overrides: OverrideGroup[]; undoCount: number; editedCount: number; error: string | null; context: EditContext; mediaContexts: MediaContext[]; mediaLimited: boolean; authorRevision: number; mutationPolicy: MutationPolicy; lastMutation: MutationResult | null };
type Values = Partial<Record<Property, string>>;
type Scope = { context: EditContext; values: Values; disabled?: Values };
export type MigrationTicket = Readonly<{ targetId: string; identity: TargetIdentity; session: object; generation: number }>;
type Target = { id: string; bindingGeneration: number; identity: TargetIdentity; element: HTMLElement | SVGElement; root: Document | ShadowRoot; attribute: string; retiredAttributes: string[]; scopes: Map<string, Scope>; layer?: HTMLStyleElement; stop?: () => void; guard?: () => void; retired?: boolean; staging?: boolean; pending?: MigrationTicket; media: ReturnType<typeof discoverMedia> };
// Editing ownership only, never replacement identity evidence. Shared factory instances cannot claim one node twice.
const editOwners = new WeakMap<Element, Target>();
export type Transaction = { targetId: string; context: EditContext; changes: { property: Property; previous?: string; previousDisabled?: string; value?: string }[]; order: number; gesture?: string; author?: AuthorChange };
export const emptyEditState = (): EditState => ({ design: null, overrides: [], undoCount: 0, editedCount: 0, error: null, context: baseContext(), mediaContexts: [], mediaLimited: false, authorRevision: 0, mutationPolicy: { mode: 'SESSION_OVERRIDE' }, lastMutation: null });

/** One transaction controller. Session overrides remain default; author mutation requires explicit policy. */
export function createEditSession(doc: Document, owns: (element: Element) => boolean, onChange: () => void, sources: SourceIndex, lifecycle = createTargetLifecycle(doc, owns), authorLedger?: AuthorLedger) {
  const win = doc.defaultView!;
  const prefix = `data-cssforge-target-${crypto.randomUUID().replaceAll('-', '')}`;
  const targets = new Map<string, Target>(); let byElement = new WeakMap<Element, Target>();
  let byBinding = new WeakMap<TargetIdentity, Target>();
  const sessionToken = {}; let migrationGeneration = 0;
  let lossHandler: ((identity: TargetIdentity) => boolean) | undefined, cancelReconciliation: (() => void) | undefined;
  const listeners = new Set<() => void>(), history: Transaction[] = [];
  let sequence = 0, order = 0, destroyed = false, transactionBusy = false, destroyRequested = false, state = emptyEditState();
  const containment = createMarkerContainment(doc, owns);
  const authorMutation = createAuthorMutation(doc, sources, lifecycle, () => {}, request => {
    const target = state.design && targets.get(state.design.targetId);
    return !!target && safe(target) && target.element === request.element && contextKey(state.context) === contextKey(request.context);
  }, authorLedger);
  // Only unresolved author records cross UI lifecycles. Session layers/gestures never do.
  const recoveredOwners = new WeakMap<object, Map<string, string>>(); let recoverySequence = 0;
  for (const author of authorMutation.active()) {
    let targetId: string;
    if (author.owner) {
      const group = recoveredOwners.get(author.owner.session) ?? new Map<string, string>();
      targetId = group.get(author.owner.targetId) ?? `recovery-${++recoverySequence}`;
      group.set(author.owner.targetId, targetId); recoveredOwners.set(author.owner.session, group);
    } else targetId = `recovery-${++recoverySequence}`;
    history.push({ targetId, context: author.target.context, changes: [], order: ++order, author });
  }
  if (history.length) state = { ...state, undoCount: history.length, editedCount: recoverySequence, error: 'Pending author rollback retained; page changes were preserved.' };
  const edited = (target: Target) => history.some(transaction => transaction.targetId === target.id && transaction.author) || [...target.scopes.values()].some(scope => Object.keys(scope.values).length || Object.keys(scope.disabled ?? {}).length);
  const publish = (patch: Partial<EditState> = {}) => {
    const editedIds = new Set([...targets.values()].filter(edited).map(target => target.id));
    // Pending recovery remains session-wide and Reset must stay usable after reactivation.
    for (const transaction of history) if (transaction.author) editedIds.add(transaction.targetId);
    state = { ...state, undoCount: history.length, editedCount: editedIds.size, ...patch };
    const target = state.design && targets.get(state.design.targetId);
    state.overrides = target ? [...target.scopes.values()].map(scope => ({ context: scope.context, declarations: [
      ...Object.entries(scope.values).map(([property, value]) => ({ property: property as Property, value, enabled: true })),
      ...Object.entries(scope.disabled ?? {}).map(([property, value]) => ({ property: property as Property, value, enabled: false })),
    ] })).filter(group => group.declarations.length) : [];
    listeners.forEach(listener => listener());
  };
  const safe = (target: Target) => !target.retired && lifecycle.safe(target.identity);
  const quarantine = (target = state.design ? targets.get(state.design.targetId) : undefined) => {
    if (target && targets.get(target.id) === target && !target.retired && !safe(target)) {
      const retain = state.design?.targetId === target.id && edited(target) && target.retiredAttributes.length < reconciliationLimits.migrationsPerTarget && lossHandler?.(target.identity) === true;
      target.retired = true; release(target, false);
      if (retain) target.pending = Object.freeze({ targetId: target.id, identity: target.identity, session: sessionToken, generation: ++migrationGeneration });
      else target.scopes.clear();
      if (editOwners.get(target.element) === target) editOwners.delete(target.element);
      if (byElement.get(target.element) === target) byElement.delete(target.element);
      publish(state.design?.targetId === target.id ? { design: null, error: 'The editing target changed. Pick it again.' } : {});
    }
  };
  function inspect(element: Element | null, computed?: CSSStyleDeclaration, discover = false) {
    if (destroyed) return;
    quarantine();
    if (!element || !lifecycle.valid(element) || !(element instanceof win.HTMLElement || element instanceof win.SVGElement)) { publish({ design: null, error: null }); return; }
    const root = element.getRootNode();
    if (root !== doc && !(root instanceof win.ShadowRoot && root.mode === 'open')) { publish({ design: null }); return; }
    quarantine(byElement.get(element));
    let target = byElement.get(element);
    if (!target) {
      if (editOwners.has(element)) { publish({ design: null, error: 'Another CSSForge session owns this editing target.' }); return; }
      const id = String(++sequence); let attribute = prefix; while (element.hasAttribute(attribute)) attribute += '-x';
      target = { id, bindingGeneration: 0, identity: lifecycle.bind(element), element, root: root as Document | ShadowRoot, attribute, retiredAttributes: [], scopes: new Map(), media: { contexts: [], limited: false } };
      targets.set(id, target); byElement.set(element, target); byBinding.set(target.identity, target); editOwners.set(element, target);
    }
    if (!safe(target)) { publish({ design: null, error: 'This element moved to another document tree. Reset session edits before inspecting it again.' }); return; }
    const changed = state.design?.targetId !== target.id;
    if (changed) state = { ...state, context: baseContext() };
    if (discover || changed) target.media = discoverMedia(sources.read(element));
    const context = state.context, pseudoElement = context.pseudo.startsWith('::');
    const css = pseudoElement ? win.getComputedStyle(element, context.pseudo) : computed ?? win.getComputedStyle(element);
    const scope = target.scopes.get(contextKey(context));
    const values = Object.fromEntries(properties.map(property => {
      const browserValue = css.getPropertyValue(property), override = scope?.values[property];
      const inline = !context.media.length && !context.pseudo ? element.style.getPropertyValue(property) : '';
      return [property, { computed: browserValue, presented: editorValue(property, browserValue, inline, override), authored: inline || undefined, override }];
    })) as Record<Property, FieldValue>;
    const mediaContexts = [...target.media.contexts];
    for (const scope of target.scopes.values()) if (scope.context.media.length && !mediaContexts.some(item => JSON.stringify(item.queries) === JSON.stringify(scope.context.media))) mediaContexts.push({ queries: scope.context.media, source: 'session override' });
    publish({ design: { targetId: target.id, bindingGeneration: target.bindingGeneration, values, canSize: supportsSize(element, css.display) }, mediaContexts, mediaLimited: target.media.limited, error: changed ? null : state.error });
  }
  const release = (target: Target, cleanCopies = true) => {
    target.stop?.(); target.stop = undefined; target.guard?.(); target.guard = undefined;
    target.layer?.remove(); target.layer = undefined;
    if (target.element.getAttribute(target.attribute) === target.id) target.element.removeAttribute(target.attribute);
    if (cleanCopies) for (const attribute of [target.attribute, ...target.retiredAttributes]) for (const copy of target.root.querySelectorAll(`[${attribute}="${target.id}"]`)) copy.removeAttribute(attribute);
  };
  const render = (target: Target) => {
    if (![...target.scopes.values()].some(scope => Object.keys(scope.values).length)) { release(target); return; }
    const layer = doc.createElement('style'); layer.dataset.cssforgeEditLayer = target.id;
    (target.root === doc ? doc.head ?? doc.documentElement : target.root).appendChild(layer);
    try {
      if (!layer.sheet) throw new Error('Style layer unavailable');
      // Base before conditional rules; media order follows proven context discovery.
      const scopes = [...target.scopes.values()].filter(scope => Object.keys(scope.values).length).sort((a, b) => a.context.media.length - b.context.media.length);
      for (const scope of scopes) {
        let sheet: CSSStyleSheet | CSSMediaRule = layer.sheet;
        for (const query of scope.context.media) { const i = sheet.insertRule(`@media ${query} {}`, sheet.cssRules.length); sheet = sheet.cssRules[i] as CSSMediaRule; }
        const i = sheet.insertRule(`[${target.attribute}="${target.id}"]${scope.context.pseudo} {}`, sheet.cssRules.length);
        const rule = sheet.cssRules[i] as CSSStyleRule;
        for (const [property, value] of Object.entries(scope.values)) rule.style.setProperty(property, value, 'important');
      }
    } catch (error) { layer.remove(); throw error; }
    for (const copy of target.root.querySelectorAll(`[${target.attribute}="${target.id}"]`)) if (copy !== target.element) copy.removeAttribute(target.attribute);
    target.element.setAttribute(target.attribute, target.id); target.layer?.remove(); target.layer = layer;
    if (!target.stop) {
      const watch = () => {
        target.stop?.();
        const observation = observeTarget(target.element, () => {
          if (targets.get(target.id) !== target || target.retired) return;
          if (!safe(target)) { quarantine(target); if (targets.get(target.id) === target) onChange(); }
          else if (observation.moved()) watch();
        }, owns);
        target.stop = observation.stop;
      };
      watch();
    }
    if (!target.guard) target.guard = containment.add(target.root, { element: target.element, attribute: target.attribute, id: target.id, quarantine: () => {
      if (target.retired || targets.get(target.id) !== target) { if (target.staging) throw new Error('Staged marker ownership was rejected.'); return; }
      lifecycle.forget(target.identity); quarantine(target); if (targets.get(target.id) === target) onChange();
    } });
  };
  const applySession = (targetId: string, inputs: Values, gesture?: string, expectedContext = contextKey(state.context)) => {
    quarantine();
    const target = targets.get(targetId); const fail = (error: string) => { publish({ error }); return false; };
    if (destroyed || !target || state.design?.targetId !== targetId || !safe(target) || expectedContext !== contextKey(state.context)) return fail('The editing target or context changed. Pick it again.');
    if (target.element.hasAttribute(target.attribute) && target.element.getAttribute(target.attribute) !== target.id) return fail('The page changed the edit marker. Reset session edits before continuing.');
    const key = contextKey(state.context), scope = target.scopes.get(key) ?? { context: { ...state.context, media: [...state.context.media] }, values: {} };
    const changes: Transaction['changes'] = [];
    for (const [name, input] of Object.entries(inputs)) {
      const property = name as Property, value = normalizeValue(property, input);
      if (!validateValue(property, value, win.CSS.supports.bind(win.CSS))) return fail(`Enter a valid ${property} value.`);
      if (!state.context.pseudo.startsWith('::') && target.element.style.getPropertyPriority(property) === 'important') return fail('An inline !important declaration prevents this override. Original page styles are preserved.');
      if ((property === 'width' || property === 'height') && !state.design!.canSize) return fail('This display mode does not provide an editable size box.');
      if (scope.values[property] !== value) changes.push({ property, previous: scope.values[property], previousDisabled: scope.disabled?.[property], value });
    }
    if (!changes.length) { publish({ error: null }); return true; }
    const previousValues = { ...scope.values }, previousDisabled = { ...scope.disabled };
    changes.forEach(change => { scope.values[change.property] = change.value; if (scope.disabled) delete scope.disabled[change.property]; }); target.scopes.set(key, scope);
    try { render(target); } catch { scope.values = previousValues; scope.disabled = previousDisabled; return fail('This page blocked the CSSForge style layer. No edit was applied.'); }
    const last = history.at(-1);
    if (gesture && last?.gesture === gesture && last.targetId === targetId && contextKey(last.context) === key) {
      for (const change of changes) { const existing = last.changes.find(item => item.property === change.property); if (existing) existing.value = change.value; else last.changes.push(change); }
    } else history.push({ targetId, context: scope.context, changes, order: ++order, gesture });
    publish({ error: null }); onChange(); return true;
  };
  const applyAuthor = (targetId: string, property: string, input: string, options: Partial<Omit<MutationRequest, 'element' | 'property' | 'value' | 'context'>> = {}, expectedContext = contextKey(state.context)) => {
    quarantine(); const target = targets.get(targetId);
    if (destroyed || !target || state.design?.targetId !== targetId || !safe(target) || expectedContext !== contextKey(state.context)) { publish({ error: 'The editing target or context changed. Pick it again.' }); return false; }
    const value = properties.includes(property as Property) ? normalizeValue(property as Property, input) : input.trim();
    const scope = target.scopes.get(expectedContext);
    const result: MutationResult = scope?.values[property as Property] !== undefined || scope?.disabled?.[property as Property] !== undefined
      ? { state: 'fallback', safeFallback: true, reason: 'An existing session declaration owns this property.' }
      : authorMutation.mutate({ ...options, element: target.element, property, value, context: state.context });
    if (result.state === 'mutated') {
      result.change.owner = { session: sessionToken, targetId };
      history.push({ targetId, context: { ...state.context, media: [...state.context.media] }, changes: [], order: ++order, author: result.change });
      publish({ error: null, lastMutation: result, authorRevision: state.authorRevision + 1 }); onChange(); return true;
    }
    if (result.state === 'unchanged') { publish({ error: null, lastMutation: result }); return true; }
    if (result.change) {
      result.change.owner = { session: sessionToken, targetId };
      history.push({ targetId, context: { ...state.context, media: [...state.context.media] }, changes: [], order: ++order, author: result.change });
      publish({ error: result.reason, lastMutation: result, authorRevision: state.authorRevision + 1 }); onChange(); return false;
    }
    publish({ lastMutation: result });
    if (result.safeFallback && properties.includes(property as Property)) return applySession(targetId, { [property]: value }, undefined, expectedContext);
    publish({ error: result.reason }); return false;
  };
  const applyBatch = (targetId: string, inputs: Values, gesture?: string, expectedContext = contextKey(state.context)) => {
    const entries = Object.entries(inputs);
    return state.mutationPolicy.mode === 'SAFE_AUTHOR_MUTATION' && entries.length === 1
      ? applyAuthor(targetId, entries[0][0], entries[0][1], { allowShared: state.mutationPolicy.allowShared }, expectedContext)
      : applySession(targetId, inputs, gesture, expectedContext);
  };
  // Native reactions may synchronously dispatch UI actions before history is committed.
  // Exclude overlapping edits; teardown waits only until this synchronous stack unwinds.
  const exclusive = <T,>(action: () => T, blocked: T, migration = false): T => {
    // Loss handling may migrate after native verification/history commit, inside onChange.
    // It still excludes UI writes during staging and cannot enter a native author write.
    if ((transactionBusy && !migration) || authorMutation.busy()) return blocked;
    const previousBusy = transactionBusy;
    transactionBusy = true;
    try { return action(); }
    finally { transactionBusy = previousBusy; if (destroyRequested && !transactionBusy) destroy(); }
  };
  function destroy() {
    if (destroyed) return;
    if (transactionBusy) { destroyRequested = true; return; }
    destroyed = true; destroyRequested = false;
    authorMutation.destroy();
    for (const target of targets.values()) { release(target); if (editOwners.get(target.element) === target) editOwners.delete(target.element); }
    containment.destroy();
    targets.clear(); byElement = new WeakMap(); byBinding = new WeakMap(); history.length = 0; listeners.clear(); lossHandler = cancelReconciliation = undefined; state = emptyEditState();
  }
  return {
    inspect, quarantine, authorMutation,
    applyBatch: (...args: Parameters<typeof applyBatch>) => exclusive(() => applyBatch(...args), false),
    applyAuthor: (...args: Parameters<typeof applyAuthor>) => exclusive(() => applyAuthor(...args), false),
    setMutationPolicy(policy: MutationPolicy) { if (!destroyed) publish({ mutationPolicy: { mode: policy.mode, allowShared: policy.allowShared }, error: null }); },
    setReconciliationHooks(lost: (identity: TargetIdentity) => boolean, cancel: () => void) { lossHandler = lost; cancelReconciliation = cancel; },
    prepareMigration(identity: TargetIdentity): MigrationTicket | null { const target = byBinding.get(identity); if (destroyed || !target) return null; quarantine(target); return targets.get(target.id) === target ? target.pending ?? null : null; },
    retireMigration(ticket: MigrationTicket) {
      const target = targets.get(ticket.targetId);
      if (target?.pending !== ticket || ticket.session !== sessionToken) return;
      target.pending = undefined; release(target); target.scopes.clear();
      publish();
    },
    migrate(ticket: MigrationTicket, resolution: LocatorResolution, authorize: () => boolean): TargetIdentity | null {
      return exclusive(() => {
        const target = targets.get(ticket.targetId), replacement = resolution.element;
        if (destroyed || ticket.session !== sessionToken || !target || target.pending !== ticket || target.identity !== ticket.identity || !target.retired || resolution.state !== 'resolved-unique' || resolution.confidence !== 'strong' || resolution.candidateCount !== 1 || !replacement || !lifecycle.admissible(replacement) || replacement.ownerDocument !== doc || replacement.getRootNode() !== target.root || replacement.namespaceURI !== target.element.namespaceURI || replacement.localName !== target.element.localName || editOwners.has(replacement) || byElement.has(replacement) || !(replacement instanceof win.HTMLElement || replacement instanceof win.SVGElement)) return null;
        const identity = lifecycle.bind(replacement);
        let attribute = `${prefix}-m${ticket.generation}`; while (replacement.hasAttribute(attribute)) attribute += '-x';
        const next: Target = { ...target, bindingGeneration: ticket.generation, element: replacement, identity, attribute, retiredAttributes: [...target.retiredAttributes, target.attribute], retired: false, staging: true, pending: undefined, layer: undefined, stop: undefined, guard: undefined };
        // Old layer/marker/guards are already quarantined. Stage one fresh layer before publishing the new owner.
        release(target);
        try { render(next); } catch { next.staging = false; release(next); lifecycle.forget(identity); return null; }
        if (!lifecycle.safe(identity) || (next.layer && replacement.getAttribute(attribute) !== target.id) || editOwners.has(replacement) || !authorize()) { next.staging = false; release(next); lifecycle.forget(identity); return null; }
        next.staging = false;
        lifecycle.forget(target.identity); byBinding.delete(target.identity); target.pending = undefined;
        targets.set(target.id, next); byElement.set(replacement, next); byBinding.set(identity, next); editOwners.set(replacement, next);
        // Retain logical targetId and context, so history addresses the replacement without synthetic edits.
        state = { ...state, design: { targetId: next.id, bindingGeneration: next.bindingGeneration, values: {} as Record<Property, FieldValue>, canSize: false }, error: null };
        return identity;
      }, null, true);
    },
    sourcePosition(element: Element): number | undefined {
      const target = byElement.get(element);
      if (!target?.layer?.sheet || !safe(target)) return undefined;
      // Read only sheet ordering, never contents. Count the same author sheets retained by the index.
      const sheets = target.root === doc ? [...doc.styleSheets] : [...target.root.querySelectorAll('style,link')].map(node => (node as HTMLStyleElement).sheet).filter((sheet): sheet is CSSStyleSheet => !!sheet);
      let authorsBefore = 0;
      for (const sheet of sheets) {
        if (sheet === target.layer.sheet) return authorsBefore - 0.5;
        const owner = sheet.ownerNode as Element | null;
        if (!owner || (!owns(owner) && !owner.hasAttribute?.('data-cssforge-edit-layer'))) authorsBefore++;
      }
      return undefined;
    },
    sourceGroups(element: Element): OverrideGroup[] {
      const target = byElement.get(element);
      return target && safe(target) ? [...target.scopes.values()].map(scope => ({ context: scope.context, declarations: [
        ...Object.entries(scope.values).map(([property, value]) => ({ property: property as Property, value, enabled: true })),
        ...Object.entries(scope.disabled ?? {}).map(([property, value]) => ({ property: property as Property, value, enabled: false })),
      ] })).filter(group => group.declarations.length) : [];
    },
    conversionContext(targetId: string, property: ValueProperty, reference?: ValueReference): ConversionContext {
      const target = targets.get(targetId);
      if (destroyed || !target || state.design?.targetId !== targetId || !safe(target) || state.context.pseudo || state.context.media.length) return {};
      return readConversionContext(target.element, property, reference);
    },
    toggle(targetId: string, context: EditContext, property: Property) {
      return exclusive(() => {
        const target = targets.get(targetId), scope = target?.scopes.get(contextKey(context));
        if (destroyed || !target || !scope || state.design?.targetId !== targetId || !safe(target)) return false;
        if (target.element.hasAttribute(target.attribute) && target.element.getAttribute(target.attribute) !== target.id) { publish({ error: 'The page changed the edit marker. Reset session edits before continuing.' }); return false; }
        const previous = scope.values[property], previousDisabled = scope.disabled?.[property];
        if (previous === undefined && previousDisabled === undefined) return false;
        const oldValues = { ...scope.values }, oldDisabled = { ...scope.disabled };
        scope.disabled ??= {};
        if (previous !== undefined) { scope.disabled[property] = previous; delete scope.values[property]; }
        else { scope.values[property] = previousDisabled; delete scope.disabled[property]; }
        try { render(target); } catch { scope.values = oldValues; scope.disabled = oldDisabled; publish({ error: 'The page blocked this toggle.' }); return false; }
        history.push({ targetId, context: scope.context, changes: [{ property, previous, previousDisabled, value: scope.values[property] }], order: ++order });
        publish({ error: null }); onChange(); return true;
      }, false);
    },
    apply(targetId: string, property: Property, value: string, gesture?: string) { return exclusive(() => applyBatch(targetId, { [property]: value }, gesture), false); },
    setContext(context: EditContext) {
      if (destroyed || transactionBusy || authorMutation.busy() || !state.design || !pseudos.includes(context.pseudo)) return;
      if (context.media.length && !state.mediaContexts.some(item => JSON.stringify(item.queries) === JSON.stringify(context.media))) return;
      publish({ context: { media: [...context.media], pseudo: context.pseudo }, error: null }); onChange();
    },
    getSnapshot: () => { quarantine(); return state; },
    cancelGesture(gesture: string) { if (gesture && history.at(-1)?.gesture === gesture) { this.undo(); return true; } return false; },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    undo() {
      return exclusive(() => {
        if (destroyed) return;
        if (history.at(-1)?.author) {
          const transaction = history.at(-1)!;
          if (!authorMutation.rollback(transaction.author!)) { publish({ error: 'Author source changed or blocked rollback. Undo retained; page changes were preserved.' }); return; }
          history.pop(); publish({ error: null, authorRevision: state.authorRevision + 1, lastMutation: null }); onChange(); return;
        }
        if (history.at(-1) && targets.get(history.at(-1)!.targetId)?.pending) { publish({ error: 'The editing target is waiting for a proven replacement.' }); return; }
        const transaction = history.pop(); if (!transaction) return;
        const target = targets.get(transaction.targetId)!;
        const key = contextKey(transaction.context), scope = target.scopes.get(key) ?? { context: transaction.context, values: {} };
        target.scopes.set(key, scope);
        if (!safe(target)) { release(target); target.scopes.clear(); }
        else {
          const previousValues = { ...scope.values }, previousDisabled = { ...scope.disabled };
          scope.disabled ??= {};
          for (const change of transaction.changes) {
            if (change.previous === undefined) delete scope.values[change.property]; else scope.values[change.property] = change.previous;
            if (change.previousDisabled === undefined) delete scope.disabled[change.property]; else scope.disabled[change.property] = change.previousDisabled;
          }
          try { render(target); } catch { scope.values = previousValues; scope.disabled = previousDisabled; history.push(transaction); publish({ error: 'The page blocked undo. Reset session edits to remove the CSSForge layer.' }); return; }
        }
        publish({ error: null }); onChange();
      }, undefined);
    },
    reset() {
      return exclusive(() => {
        if (destroyed) return;
        cancelReconciliation?.();
        authorMutation.resetGeneration();
        // Restore author changes in reverse history order. Conflicts remain recoverable and are never overwritten.
        let conflict = false;
        for (let index = history.length - 1; index >= 0; index--) {
          const transaction = history[index];
          if (!transaction.author) { history.splice(index, 1); continue; }
          if (!authorMutation.rollback(transaction.author)) { conflict = true; continue; }
          history.splice(index, 1);
        }
        for (let index = history.length - 1; index >= 0; index--) if (!history[index].author) history.splice(index, 1);
        for (const target of targets.values()) { release(target); if (editOwners.get(target.element) === target) editOwners.delete(target.element); }
        containment.destroy();
        for (const target of targets.values()) target.scopes.clear();
        targets.clear(); byElement = new WeakMap(); byBinding = new WeakMap();
        if (!conflict) history.length = 0;
        const resetError = conflict ? 'Author source changed or blocked reset. Pending author rollback retained; page changes were preserved.' : null;
        publish({ error: resetError, context: baseContext(), authorRevision: state.authorRevision + 1, lastMutation: null, mutationPolicy: { mode: 'SESSION_OVERRIDE' } }); onChange();
        if (conflict) publish({ error: resetError });
      }, undefined);
    },
    destroy,
  };
}
export type EditSession = ReturnType<typeof createEditSession>;
