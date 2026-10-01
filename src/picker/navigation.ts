/** Parent and children follow the same open composed-tree policy. */
export function navigationParent(element: Element): Element | null {
  const win = element.ownerDocument.defaultView!;
  const slot = element.assignedSlot;
  if (slot) {
    const slotRoot = slot.getRootNode();
    if (slotRoot instanceof win.ShadowRoot && slotRoot.mode === 'open') return slot;
  }
  const root = element.getRootNode();
  return element.parentElement ?? (root instanceof win.ShadowRoot && root.mode === 'open' ? root.host : null);
}

export function navigationChildren(element: Element, around?: Element): Element[] {
  if (element.localName === 'slot' && 'assignedElements' in element) {
    const assigned = (element as HTMLSlotElement).assignedElements();
    if (assigned.length) return assigned.slice(Math.max(0, around ? assigned.indexOf(around) - 8 : 0), Math.max(0, around ? assigned.indexOf(around) - 8 : 0) + 100);
  }
  const parent = element.shadowRoot ?? element;
  let next = around?.parentNode === parent ? around : parent.firstElementChild;
  if (around?.parentNode === parent) for (let i = 0; i < 8 && next?.previousElementSibling; i++) next = next.previousElementSibling;
  const result: Element[] = [];
  while (next && result.length < 100) { result.push(next); next = next.nextElementSibling; }
  return result;
}
