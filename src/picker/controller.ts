import { frameGate } from './frame';
import { identityOf, rectOf, type TargetRect } from './identity';
import { createOverlay } from './overlay';
import { createEditSession } from '../editing/session';
import { presentSource, type SourceSnapshot } from '../editing/readable';
import { createSourceIndex } from '../engine/sources';
import type { SessionGroup } from '../engine/sources/model';
import { createCascade } from '../engine/cascade';
import { createTree } from './tree';
import { createTargetLifecycle, type TargetIdentity } from './targetLifecycle';
import { observeTarget } from './invalidation';
import { navigationChildren } from './navigation';
import { collectCandidates, type TargetCandidate } from './candidates';
import { createTargetLocator, type TargetLocator, type LocatorResolution, type ResolveRequest } from '../engine/locator';
import { createSelectorEngine, type SelectorRequest } from '../engine/selectors';

export type Selection = {
  identity: string; tag: string; id: string; classes: string[];
  rect: TargetRect; fontFamily: string; fontSize: string;
  hasParent: boolean; hasChild: boolean; hasPrevious: boolean; hasNext: boolean;
  boundary: 'iframe-interior-unsupported' | null;
};
export type PickerState = { active: boolean; selection: Selection | null };

/** DOM references and transient pointer state live here, never in UI/persisted state. */
export function createPicker(doc: Document, uiHost: HTMLElement, onSelection: () => void) {
  const win = doc.defaultView!;
  const overlay = createOverlay(doc);
  const owned = new Set<Element>([uiHost, overlay.host]);
  const subscribers = new Set<() => void>();
  let state: PickerState = { active: false, selection: null };
  let hovered: Element | null = null;
  let selected: Element | null = null;
  let selectedIdentity: TargetIdentity | null = null;
  let unobserve = () => {};
  let candidates: TargetCandidate[] = [];
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
  const lifecycle = createTargetLifecycle(doc, owns);
  const locators = createTargetLocator(doc, lifecycle);
  const selectors = createSelectorEngine(doc, lifecycle);
  let locator: TargetLocator | null = null, locatorResult: LocatorResolution | null = null;
  const valid = lifecycle.valid;
  const sources = createSourceIndex(doc, owns, lifecycle);
  const editor = createEditSession(doc, owns, () => {
    cascade.invalidate();
    if (selected && selectedIdentity && lifecycle.safe(selectedIdentity)) {
      const computed = win.getComputedStyle(selected);
      editor.inspect(selected, computed);
      if (state.selection) publish({ ...state, selection: { ...state.selection, rect: rectOf(selected.getBoundingClientRect()), fontFamily: computed.fontFamily, fontSize: computed.fontSize } });
    } else clearLostTarget();
    frame.schedule();
  }, sources, lifecycle);
  const cascade = createCascade(doc, sources, element => editor.sourceGroups(element), undefined, element => editor.sourcePosition(element));
  const parentOf = (element: Element) => {
    const root = element.getRootNode();
    const parent = element.parentElement ?? (root instanceof win.ShadowRoot && root.mode === 'open' ? root.host : null);
    return valid(parent) ? parent : null;
  };
  const childOf = (element: Element) => {
    const children = navigationChildren(element);
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
    return lifecycle.admissible(element ?? null) ? element! : null;
  };
  const paint = () => {
    if (destroyed) return;
    clearLostTarget();
    const target = state.active && lifecycle.admissible(hovered) ? hovered : selected;
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
  function clearLostTarget() {
    if (!selected || (selectedIdentity && lifecycle.safe(selectedIdentity))) return;
    if (selectedIdentity) selectors.invalidate(selectedIdentity);
    selected = null; selectedIdentity = null; hovered = null; source = null; candidates = [];
    unobserve(); unobserve = () => {}; observer?.disconnect();
    editor.quarantine(); sources.invalidate(); cascade.invalidate(); overlay.hide();
    if (locator) locatorResult = locators.resolve(locator);
    publish({ ...state, selection: null });
  }
  const select = (element: Element | null) => {
    clearLostTarget();
    if (destroyed || !lifecycle.admissible(element)) return;
    editor.quarantine(); selectedIdentity = lifecycle.bind(element);
    locator = locators.capture(selectedIdentity, true); locatorResult = null;
    selected = element; hovered = null; source = null; sources.invalidate(); cascade.invalidate();
    const computed = win.getComputedStyle(element);
    editor.inspect(element, computed, true);
    publish({ active: false, selection: {
      identity: identityOf(element), tag: element.localName, id: element.id,
      classes: Array.from(element.classList), rect: rectOf(element.getBoundingClientRect()),
      fontFamily: computed.fontFamily, fontSize: computed.fontSize,
      hasParent: !!parentOf(element), hasChild: !!childOf(element),
      hasPrevious: !!siblingOf(element, 'previousElementSibling'), hasNext: !!siblingOf(element, 'nextElementSibling'),
      boundary: element.localName === 'iframe' ? 'iframe-interior-unsupported' : null,
    } });
    observer?.disconnect(); observer?.observe(element);
    function watchSelection() {
      unobserve();
      const observation = observeTarget(element!, () => {
        clearLostTarget();
        if (selected === element && observation.moved()) watchSelection();
        frame.schedule();
      }, owns);
      unobserve = observation.stop;
    }
    watchSelection();
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
    if (event.type === 'click') {
      const pointer = event as MouseEvent;
      candidates = collectCandidates(doc, event.composedPath(), pointer.clientX, pointer.clientY, lifecycle.admissible, owns);
      select(target);
    }
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
    targetLocator: () => locator,
    locatorResult: () => locatorResult,
    locatorStats: locators.getStats,
    selectorStats: selectors.getStats,
    generateSelector(request: SelectorRequest = {}) { clearLostTarget(); return selectedIdentity ? selectors.generate(selectedIdentity, request) : null; },
    validateAuthoredSelector(selectorText: string, request: SelectorRequest = {}) { clearLostTarget(); return selectedIdentity ? selectors.validateAuthored(selectedIdentity, selectorText, request) : null; },
    invalidateSelector() { if (selectedIdentity) selectors.invalidate(selectedIdentity); },
    resolveTarget(request: ResolveRequest = {}) { clearLostTarget(); return locator ? (locatorResult = locators.resolve(locator, request)) : null; },
    candidates: () => candidates.filter(item => lifecycle.admissible(item.element)),
    source(force = false) { clearLostTarget(); if (!valid(selected)) return null; if (!source || force) { if (force) { sources.invalidate(); cascade.invalidate(); } source = presentSource(sources.read(selected)); editor.inspect(selected, undefined, true); } return source; },
    cascade() { clearLostTarget(); return valid(selected) ? cascade.read(selected, editor.getSnapshot().context) : null; },
    cascadeStats: cascade.getStats,
    sourceOverrides(groups: SessionGroup[]) { return valid(selected) ? sources.overrides(selected, groups).rules : []; },
    sourceStats: sources.getStats,
    tree() { clearLostTarget(); return tree.read(selected); },
    toggleNode(id: string) { tree.toggle(id); },
    selectNode(id: string) { tree.select(id); },
    subscribe(notify: () => void) { subscribers.add(notify); return () => { subscribers.delete(notify); }; },
    getSnapshot: () => { clearLostTarget(); return state; },
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
      destroyed = true; frame.cancel(); observer?.disconnect(); unobserve();
      editor.destroy(); tree.destroy(); sources.destroy(); cascade.destroy(); source = null;
      win.removeEventListener('pointermove', move, true);
      doc.removeEventListener('pointerleave', leave); win.removeEventListener('blur', leave);
      for (const type of clickEvents) win.removeEventListener(type, intercept, true);
      win.removeEventListener('scroll', refresh, true); win.removeEventListener('resize', refresh);
      win.visualViewport?.removeEventListener('resize', refresh); win.visualViewport?.removeEventListener('scroll', refresh);
      hovered = selected = null; selectedIdentity = null; candidates = []; locator = locatorResult = null; locators.destroy(); selectors.destroy(); lifecycle.destroy(); subscribers.clear(); state = { active: false, selection: null }; overlay.destroy();
    },
  };
}
export type Picker = ReturnType<typeof createPicker>;
