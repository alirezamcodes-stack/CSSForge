import { editorValue, normalizeValue, properties, validateValue, type Property } from './properties';

export type FieldValue = { computed: string; presented: string; override?: string };
export type DesignSnapshot = { targetId: string; values: Record<Property, FieldValue>; canSize: boolean };
export type EditState = { design: DesignSnapshot | null; undoCount: number; editedCount: number; error: string | null };
type Target = { id: string; element: HTMLElement | SVGElement; root: Document | ShadowRoot; attribute: string; overrides: Partial<Record<Property, string>>; layer?: HTMLStyleElement; rule?: CSSStyleRule };
export type Transaction = { targetId: string; property: Property; previous: string | undefined; value: string; order: number; gesture?: string };

/** Only this module writes page edits. Author styles and style attributes remain untouched. */
export function createEditSession(doc: Document, owns: (element: Element) => boolean, onChange: () => void) {
  const win = doc.defaultView!;
  const prefix = `data-cssforge-target-${crypto.randomUUID().replaceAll('-', '')}`;
  const targets = new Map<string, Target>();
  let byElement = new WeakMap<Element, Target>();
  const listeners = new Set<() => void>();
  const history: Transaction[] = [];
  let sequence = 0, order = 0, destroyed = false;
  let state: EditState = { design: null, undoCount: 0, editedCount: 0, error: null };
  const publish = (patch: Partial<EditState> = {}) => {
    state = { ...state, undoCount: history.length, editedCount: [...targets.values()].filter(target => Object.keys(target.overrides).length).length, ...patch };
    listeners.forEach(listener => listener());
  };
  const safe = (target: Target) => target.element.isConnected && target.element.ownerDocument === doc && target.element.getRootNode() === target.root && !owns(target.element);
  function inspect(element: Element | null, computed?: CSSStyleDeclaration) {
    if (destroyed) return;
    if (!element || owns(element) || !element.isConnected || !(element instanceof win.HTMLElement || element instanceof win.SVGElement)) { publish({ design: null, error: null }); return; }
    const root = element.getRootNode();
    if (root !== doc && !(root instanceof win.ShadowRoot && root.mode === 'open')) { publish({ design: null }); return; }
    let target = byElement.get(element);
    if (!target) {
      const id = String(++sequence);
      let attribute = prefix;
      while (element.hasAttribute(attribute)) attribute += '-x';
      target = { id, element, root: root as Document | ShadowRoot, attribute, overrides: {} };
      targets.set(id, target); byElement.set(element, target);
    }
    // A moved target is never silently retargeted into another tree.
    if (!safe(target)) { publish({ design: null, error: 'This element moved to another document tree. Reset session edits before inspecting it again.' }); return; }
    const css = computed ?? win.getComputedStyle(element);
    const values = Object.fromEntries(properties.map(property => {
      const browserValue = css.getPropertyValue(property);
      const override = target!.overrides[property];
      return [property, { computed: browserValue, presented: editorValue(property, browserValue, element.style.getPropertyValue(property), override), override }];
    })) as Record<Property, FieldValue>;
    const replaced = ['img', 'input', 'textarea', 'select', 'button', 'video', 'canvas', 'svg', 'iframe', 'object', 'embed'].includes(element.localName);
    publish({ design: { targetId: target.id, values, canSize: css.display !== 'contents' && (css.display !== 'inline' || replaced) }, error: state.design?.targetId === target.id ? state.error : null });
  }
  const release = (target: Target) => {
    target.layer?.remove(); target.layer = undefined; target.rule = undefined;
    if (target.element.getAttribute(target.attribute) === target.id) target.element.removeAttribute(target.attribute);
    // Remove copied ownership markers too; never use them to recover an Element reference.
    for (const copy of target.root.querySelectorAll(`[${target.attribute}="${target.id}"]`)) copy.removeAttribute(target.attribute);
  };
  const write = (target: Target, property: Property, value?: string) => {
    if (!value) {
      delete target.overrides[property]; target.rule?.style.removeProperty(property);
      if (!Object.keys(target.overrides).length) release(target);
      return;
    }
    // Remove accidental copied markers before writing; edits always use the stored DOM reference.
    for (const copy of target.root.querySelectorAll(`[${target.attribute}="${target.id}"]`)) if (copy !== target.element) copy.removeAttribute(target.attribute);
    if (!target.layer?.isConnected || !target.rule) {
      release(target);
      const layer = doc.createElement('style'); layer.dataset.cssforgeEditLayer = target.id;
      (target.root === doc ? doc.head ?? doc.documentElement : target.root).appendChild(layer);
      try {
        if (!layer.sheet) throw new Error('Style layer unavailable');
        layer.sheet.insertRule(`[${target.attribute}="${target.id}"] {}`, 0);
        target.layer = layer; target.rule = layer.sheet.cssRules[0] as CSSStyleRule;
        for (const [name, existing] of Object.entries(target.overrides)) target.rule.style.setProperty(name, existing, 'important');
      } catch (error) { layer.remove(); throw error; }
    }
    target.element.setAttribute(target.attribute, target.id);
    target.rule.style.setProperty(property, value, 'important');
    target.overrides[property] = value;
  };
  return {
    inspect,
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    apply(targetId: string, property: Property, input: string, gesture?: string) {
      const target = targets.get(targetId);
      const fail = (error: string) => { publish({ error }); return false; };
      if (destroyed || !target || state.design?.targetId !== targetId || !safe(target)) return fail('The selected element is no longer available. Pick it again.');
      if (target.element.hasAttribute(target.attribute) && target.element.getAttribute(target.attribute) !== target.id) return fail('The page changed the edit marker. Reset session edits before continuing.');
      const value = normalizeValue(property, input);
      if (!validateValue(property, value, win.CSS.supports.bind(win.CSS))) return fail(`Enter a valid ${property} value.`);
      if (target.element.style.getPropertyPriority(property) === 'important') return fail('An inline !important declaration prevents this override. Original page styles are preserved.');
      if ((property === 'width' || property === 'height') && !state.design.canSize) return fail('This display mode does not provide an editable size box.');
      const previous = target.overrides[property];
      if (previous === value) { publish({ error: null }); return true; }
      try { write(target, property, value); } catch { return fail('This page blocked the CSSForge style layer. No edit was applied.'); }
      const last = history.at(-1);
      if (gesture && last?.gesture === gesture && last.targetId === targetId && last.property === property) last.value = value;
      else history.push({ targetId, property, previous, value, order: ++order, gesture });
      publish({ error: null }); onChange(); return true;
    },
    undo() {
      if (destroyed) return;
      const transaction = history.pop(); if (!transaction) return;
      const target = targets.get(transaction.targetId)!;
      if (!safe(target)) { release(target); target.overrides = {}; }
      else {
        try { write(target, transaction.property, transaction.previous); }
        catch { history.push(transaction); publish({ error: 'The page blocked undo. Reset session edits to remove the CSSForge layer.' }); return; }
      }
      publish({ error: null }); onChange();
    },
    reset() {
      if (destroyed) return;
      for (const target of targets.values()) { release(target); target.overrides = {}; }
      targets.clear(); byElement = new WeakMap();
      history.length = 0; publish({ error: null }); onChange();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const target of targets.values()) release(target);
      targets.clear(); history.length = 0; listeners.clear(); state = { design: null, undoCount: 0, editedCount: 0, error: null };
    },
  };
}
export type EditSession = ReturnType<typeof createEditSession>;
