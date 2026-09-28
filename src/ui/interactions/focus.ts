// Transient DOM handles belong outside serializable UI state.
let root: HTMLElement | null = null;
let surfaceOrigin: HTMLElement | null = null;
const popoverTriggers = new Map<string, HTMLElement>();
let cancelDrag: (() => void) | null = null;

export function registerUIRoot(element: HTMLElement | null) { root = element; }
export function registerPopoverTrigger(id: string, element: HTMLElement | null) {
  if (element) popoverTriggers.set(id, element); else popoverTriggers.delete(id);
}
export function captureSurfaceOrigin(popover: string | null) {
  if (!root) { surfaceOrigin = null; return; }
  const tree = root?.getRootNode() as ShadowRoot | undefined;
  const active = tree?.activeElement;
  surfaceOrigin = (popover && popoverTriggers.get(popover)) || (active instanceof HTMLElement ? active : null);
}
export function getSurfaceOrigin() { return surfaceOrigin; }
export function restorePopoverFocus(id: string) {
  const trigger = popoverTriggers.get(id);
  if (trigger?.isConnected && !trigger.closest('[inert], [hidden]')) trigger.focus({ preventScroll: true });
}
export function registerDragCancellation(cancel: (() => void) | null) { cancelDrag = cancel; }
export function cancelActiveDrag() { if (!cancelDrag) return false; cancelDrag(); return true; }
