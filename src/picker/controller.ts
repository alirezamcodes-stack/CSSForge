import { frameGate } from './frame';
import { identityOf, rectOf, type TargetRect } from './identity';
import { createOverlay } from './overlay';
import { createEditSession } from '../editing/session';
import { presentSource, type SourceSnapshot } from '../editing/readable';
import { createSourceIndex } from '../engine/sources';
import type { SessionGroup } from '../engine/sources/model';
import { createTree } from './tree';

export type Selection = {
  identity: string; tag: string; id: string; classes: string[];
  rect: TargetRect; fontFamily: string; fontSize: string;
  hasParent: boolean; hasChild: boolean; hasPrevious: boolean; hasNext: boolean;
};
export type PickerState = { active: boolean; selection: Selection | null };
const nonTargets = new Set(['script', 'style', 'link', 'meta', 'head', 'title', 'template', 'noscript']);

/** DOM references and transient pointer state live here, never in UI/persisted state. */
export function createPicker(doc: Document, uiHost: HTMLElement, onSelection: () => void) {
  const win = doc.defaultView!;
  const overlay = createOverlay(doc);
  const owned = new Set<Element>([uiHost, overlay.host]);
  const subscribers = new Set<() => void>();
  let state: PickerState = { active: false, selection: null };
  let hovered: Element | null = null;
  let selected: Element | null = null;
  let source: SourceSnapshot | null = null;
  let destroyed = false;
  let suspended = false;
  const publish = (next: PickerState) => { state = next; subscribers.forEach(notify => notify()); };
  const owns = (node: EventTarget | null): boolean => {
    if (!(node instanceof win.Node)) return false;
    if (owned.has(node as Element)) return true;
    const root = node.getRootNode();
    return root instanceof win.ShadowRoot ? owns(root.host) : false;
  };
  const valid = (element: Element | null): element is Element => !!element && element.isConnected && !owns(element) && !element.hasAttribute('hidden') && !nonTargets.has(element.localName);
  const sources = createSourceIndex(doc, owns);
  const editor = createEditSession(doc, owns, () => {
    if (selected && valid(selected)) {
      const computed = win.getComputedStyle(selected);
      editor.inspect(selected, computed);
      if (state.selection) publish({ ...state, selection: { ...state.selection, rect: rectOf(selected.getBoundingClientRect()), fontFamily: computed.fontFamily, fontSize: computed.fontSize } });
    } else editor.inspect(null);
    frame.schedule();
  }, sources);
  const parentOf = (element: Element) => {
    const root = element.getRootNode();
    const parent = element.parentElement ?? (root instanceof win.ShadowRoot && root.mode === 'open' ? root.host : null);
    return valid(parent) ? parent : null;
  };
  const childOf = (element: Element) => {
    const children = element.shadowRoot?.children ?? element.children;
    for (let i = 0; i < Math.min(children.length, 100); i++) if (valid(children[i])) return children[i];
    return null;
  };
  const siblingOf = (element: Element, direction: 'previousElementSibling' | 'nextElementSibling') => {
    let node = element[direction], count = 0;
    while (node && count++ < 100) { if (valid(node)) return node; node = node[direction]; }
    return null;
  };
  const candidate = (event: Event): Element | null => {
    const path = event.composedPath();
    if (path.some(owns)) return null;
    const element = path.find(node => node instanceof win.Element) as Element | undefined;
    return valid(element ?? null) ? element! : null;
  };
  const paint = () => {
    if (destroyed) return;
    if (selected && !valid(selected)) {
      selected = null; observer?.disconnect();
      editor.inspect(null);
      publish({ ...state, selection: null });
    }
    const target = state.active && valid(hovered) ? hovered : selected;
    if (!target) { overlay.hide(); return; }
    const rect = rectOf(target.getBoundingClientRect());
    const snapshot = state.selection;
    const label = target === selected && snapshot ? snapshot.identity : identityOf(target);
    overlay.paint(rect, label, target === hovered && state.active ? 'hover' : 'selected');
    if (target === selected && snapshot && JSON.stringify(snapshot.rect) !== JSON.stringify(rect)) {
      publish({ ...state, selection: { ...snapshot, rect } });
    }
  };
  const frame = frameGate(paint, win.requestAnimationFrame.bind(win), win.cancelAnimationFrame.bind(win));
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => frame.schedule());
  const select = (element: Element | null) => {
    if (destroyed || !valid(element)) return;
    selected = element; hovered = null; source = null; sources.invalidate();
    const computed = win.getComputedStyle(element);
    editor.inspect(element, computed, true);
    publish({ active: false, selection: {
      identity: identityOf(element), tag: element.localName, id: element.id,
      classes: Array.from(element.classList), rect: rectOf(element.getBoundingClientRect()),
      fontFamily: computed.fontFamily, fontSize: computed.fontSize,
      hasParent: !!parentOf(element), hasChild: !!childOf(element),
      hasPrevious: !!siblingOf(element, 'previousElementSibling'), hasNext: !!siblingOf(element, 'nextElementSibling'),
    } });
    observer?.disconnect(); observer?.observe(element);
    onSelection(); frame.schedule();
  };
  const tree = createTree(valid, parentOf, select);
  const move = (event: Event) => {
    if (!state.active || suspended) return;
    const next = candidate(event);
    if (next === hovered) return;
    hovered = next; frame.schedule();
  };
  const leave = () => { if (hovered) { hovered = null; frame.schedule(); } };
  const intercept = (event: Event) => {
    if (!state.active || suspended || (event as MouseEvent).button !== 0) return;
    const target = candidate(event);
    if (!target) return;
    // Capture only the explicit picking gesture. Normal inspection leaves the page interactive.
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.type === 'click') select(target);
  };
  const refresh = () => frame.schedule();
  win.addEventListener('pointermove', move, true);
  doc.addEventListener('pointerleave', leave);
  win.addEventListener('blur', leave);
  const clickEvents = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'];
  for (const type of clickEvents) win.addEventListener(type, intercept, { capture: true, passive: false });
  win.addEventListener('scroll', refresh, true);
  win.addEventListener('resize', refresh);
  win.visualViewport?.addEventListener('resize', refresh);
  win.visualViewport?.addEventListener('scroll', refresh);
  return {
    editor,
    source(force = false) { if (!valid(selected)) return null; if (!source || force) { if (force) sources.invalidate(); source = presentSource(sources.read(selected)); editor.inspect(selected, undefined, true); } return source; },
    sourceOverrides(groups: SessionGroup[]) { return valid(selected) ? sources.overrides(selected, groups).rules : []; },
    sourceStats: sources.getStats,
    tree() { return tree.read(selected); },
    toggleNode(id: string) { tree.toggle(id); },
    selectNode(id: string) { tree.select(id); },
    subscribe(notify: () => void) { subscribers.add(notify); return () => { subscribers.delete(notify); }; },
    getSnapshot: () => state,
    start() { if (destroyed || state.active) return; hovered = null; publish({ ...state, active: true }); frame.schedule(); },
    cancel() { if (!state.active) return false; hovered = null; publish({ ...state, active: false }); frame.schedule(); return true; },
    setSuspended(value: boolean) { suspended = value; if (value) leave(); },
    parent() { if (selected) select(parentOf(selected)); },
    child() { if (selected) select(childOf(selected)); },
    previous() { if (selected) select(siblingOf(selected, 'previousElementSibling')); },
    next() { if (selected) select(siblingOf(selected, 'nextElementSibling')); },
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true; frame.cancel(); observer?.disconnect();
      editor.destroy(); tree.destroy(); sources.destroy(); source = null;
      win.removeEventListener('pointermove', move, true);
      doc.removeEventListener('pointerleave', leave); win.removeEventListener('blur', leave);
      for (const type of clickEvents) win.removeEventListener(type, intercept, true);
      win.removeEventListener('scroll', refresh, true); win.removeEventListener('resize', refresh);
      win.visualViewport?.removeEventListener('resize', refresh); win.visualViewport?.removeEventListener('scroll', refresh);
      hovered = selected = null; subscribers.clear(); state = { active: false, selection: null }; overlay.destroy();
    },
  };
}
export type Picker = ReturnType<typeof createPicker>;
