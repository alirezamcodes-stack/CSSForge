import { editorValue, normalizeValue, properties, validateValue, type Property } from './properties';
import { baseContext, contextKey, discoverMedia, pseudos, type EditContext, type MediaContext } from './contexts';
import { readConversionContext } from './conversionContext';
import type { ValueProperty, ConversionContext, ValueReference } from './values';
import type { SourceIndex } from '../engine/sources';

export type FieldValue = { computed: string; presented: string; authored?: string; override?: string };
export type DesignSnapshot = { targetId: string; values: Record<Property, FieldValue>; canSize: boolean };
export type OverrideGroup = { context: EditContext; declarations: { property: Property; value: string; enabled: boolean }[] };
export type EditState = { design: DesignSnapshot | null; overrides: OverrideGroup[]; undoCount: number; editedCount: number; error: string | null; context: EditContext; mediaContexts: MediaContext[]; mediaLimited: boolean };
type Values = Partial<Record<Property, string>>;
type Scope = { context: EditContext; values: Values; disabled?: Values };
type Target = { id: string; element: HTMLElement | SVGElement; root: Document | ShadowRoot; attribute: string; scopes: Map<string, Scope>; layer?: HTMLStyleElement; media: ReturnType<typeof discoverMedia> };
export type Transaction = { targetId: string; context: EditContext; changes: { property: Property; previous?: string; previousDisabled?: string; value?: string }[]; order: number; gesture?: string };
export const emptyEditState = (): EditState => ({ design: null, overrides: [], undoCount: 0, editedCount: 0, error: null, context: baseContext(), mediaContexts: [], mediaLimited: false });

/** One session controller for core and rich editing. No author declarations are rewritten. */
export function createEditSession(doc: Document, owns: (element: Element) => boolean, onChange: () => void, sources: SourceIndex) {
  const win = doc.defaultView!;
  const prefix = `data-cssforge-target-${crypto.randomUUID().replaceAll('-', '')}`;
  const targets = new Map<string, Target>(); let byElement = new WeakMap<Element, Target>();
  const listeners = new Set<() => void>(), history: Transaction[] = [];
  let sequence = 0, order = 0, destroyed = false, state = emptyEditState();
  const edited = (target: Target) => [...target.scopes.values()].some(scope => Object.keys(scope.values).length || Object.keys(scope.disabled ?? {}).length);
  const publish = (patch: Partial<EditState> = {}) => {
    state = { ...state, undoCount: history.length, editedCount: [...targets.values()].filter(edited).length, ...patch };
    const target = state.design && targets.get(state.design.targetId);
    state.overrides = target ? [...target.scopes.values()].map(scope => ({ context: scope.context, declarations: [
      ...Object.entries(scope.values).map(([property, value]) => ({ property: property as Property, value, enabled: true })),
      ...Object.entries(scope.disabled ?? {}).map(([property, value]) => ({ property: property as Property, value, enabled: false })),
    ] })).filter(group => group.declarations.length) : [];
    listeners.forEach(listener => listener());
  };
  const safe = (target: Target) => target.element.isConnected && target.element.ownerDocument === doc && target.element.getRootNode() === target.root && !owns(target.element);
  function inspect(element: Element | null, computed?: CSSStyleDeclaration, discover = false) {
    if (destroyed) return;
    if (!element || owns(element) || !element.isConnected || !(element instanceof win.HTMLElement || element instanceof win.SVGElement)) { publish({ design: null, error: null }); return; }
    const root = element.getRootNode();
    if (root !== doc && !(root instanceof win.ShadowRoot && root.mode === 'open')) { publish({ design: null }); return; }
    let target = byElement.get(element);
    if (!target) {
      const id = String(++sequence); let attribute = prefix; while (element.hasAttribute(attribute)) attribute += '-x';
      target = { id, element, root: root as Document | ShadowRoot, attribute, scopes: new Map(), media: { contexts: [], limited: false } };
      targets.set(id, target); byElement.set(element, target);
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
    const replaced = ['img', 'input', 'textarea', 'select', 'button', 'video', 'canvas', 'svg', 'iframe', 'object', 'embed'].includes(element.localName);
    publish({ design: { targetId: target.id, values, canSize: css.display !== 'contents' && (css.display !== 'inline' || replaced) }, mediaContexts, mediaLimited: target.media.limited, error: changed ? null : state.error });
  }
  const release = (target: Target) => {
    target.layer?.remove(); target.layer = undefined;
    if (target.element.getAttribute(target.attribute) === target.id) target.element.removeAttribute(target.attribute);
    for (const copy of target.root.querySelectorAll(`[${target.attribute}="${target.id}"]`)) copy.removeAttribute(target.attribute);
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
  };
  const applyBatch = (targetId: string, inputs: Values, gesture?: string, expectedContext = contextKey(state.context)) => {
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
  return {
    inspect, applyBatch,
    conversionContext(targetId: string, property: ValueProperty, reference?: ValueReference): ConversionContext {
      const target = targets.get(targetId);
      if (destroyed || !target || state.design?.targetId !== targetId || !safe(target) || state.context.pseudo || state.context.media.length) return {};
      return readConversionContext(target.element, property, reference);
    },
    toggle(targetId: string, context: EditContext, property: Property) {
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
    },
    apply(targetId: string, property: Property, value: string, gesture?: string) { return applyBatch(targetId, { [property]: value }, gesture); },
    setContext(context: EditContext) {
      if (destroyed || !state.design || !pseudos.includes(context.pseudo)) return;
      if (context.media.length && !state.mediaContexts.some(item => JSON.stringify(item.queries) === JSON.stringify(context.media))) return;
      publish({ context: { media: [...context.media], pseudo: context.pseudo }, error: null }); onChange();
    },
    getSnapshot: () => state,
    cancelGesture(gesture: string) { if (gesture && history.at(-1)?.gesture === gesture) { this.undo(); return true; } return false; },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    undo() {
      if (destroyed) return;
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
    },
    reset() {
      if (destroyed) return;
      for (const target of targets.values()) release(target);
      targets.clear(); byElement = new WeakMap(); history.length = 0;
      publish({ error: null, context: baseContext() }); onChange();
    },
    destroy() {
      if (destroyed) return; destroyed = true;
      for (const target of targets.values()) release(target);
      targets.clear(); history.length = 0; listeners.clear(); state = emptyEditState();
    },
  };
}
export type EditSession = ReturnType<typeof createEditSession>;
