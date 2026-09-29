import { identityOf } from './identity';
export type TreeRow = { id: string; label: string; tag: string; elementId: string; classes: string; depth: number; selected: boolean; expanded: boolean; expandable: boolean; boundary: string; text: string };
export type TreeSnapshot = { rows: TreeRow[]; limited: boolean };

/** Only visible branches are read. DOM handles stay here, outside React state. */
export function createTree(valid: (node: Element | null) => node is Element, parent: (node: Element) => Element | null, select: (node: Element) => void) {
  let ids = new WeakMap<Element, string>(), sequence = 0;
  const handles = new Map<string, Element>(), expanded = new Set<string>();
  let current: Element | null = null;
  const id = (node: Element) => { let value = ids.get(node); if (!value) { value = String(++sequence); ids.set(node, value); } return value; };
  const child = (node: Element) => {
    let next = (node.shadowRoot ?? node).firstElementChild, count = 0;
    while (next && count++ < 100) { const sibling = next.nextElementSibling; if (valid(next)) return next; next = sibling; }
    return null;
  };
  const read = (selected: Element | null): TreeSnapshot => {
    handles.clear(); const rows: TreeRow[] = []; let limited = false;
    if (!valid(selected)) return { rows, limited };
    const path: Element[] = [selected]; let ancestor = parent(selected);
    while (ancestor && path.length < 12) { path.unshift(ancestor); ancestor = parent(ancestor); }
    if (ancestor) limited = true;
    if (current !== selected) { expanded.clear(); path.forEach(node => expanded.add(id(node))); current = selected; }
    const visit = (node: Element, depth: number) => {
      if (rows.length >= 180 || depth > 16) { limited = true; return; }
      const key = id(node), expandable = !!child(node), isExpanded = expanded.has(key);
      handles.set(key, node);
      let text = ''; for (let i = 0; i < Math.min(node.childNodes.length, 8); i++) if (node.childNodes[i].nodeType === 3) { text = node.childNodes[i].textContent?.trim().slice(0, 80) ?? ''; if (text) break; }
      const compact = (value: string) => value.length > 100 ? `${value.slice(0, 99)}…` : value;
      rows.push({ id: key, label: identityOf(node), tag: node.localName, elementId: compact(node.id), classes: compact(node.getAttribute('class') ?? ''), depth, selected: node === selected, expanded: isExpanded, expandable, boundary: node.shadowRoot ? '#shadow-root (open)' : node.localName === 'iframe' ? 'Frame contents unavailable' : '', text });
      if (!expandable || !isExpanded) return;
      const pathChild = path[path.indexOf(node) + 1];
      let next: Element | null = child(node);
      // Keep the selected path in view even when it is far down a large sibling list.
      if (path.includes(node) && pathChild && pathChild !== node) {
        next = pathChild; for (let i = 0; i < 8 && next.previousElementSibling; i++) next = next.previousElementSibling;
        if (next.previousElementSibling) limited = true;
      }
      let scanned = 0, shown = 0;
      while (next && scanned++ < 100 && shown < 32) { if (valid(next)) { visit(next, depth + 1); shown++; } next = next.nextElementSibling; }
      if (next) limited = true;
    };
    visit(path[0], 0); return { rows, limited };
  };
  return {
    read,
    toggle(key: string) { if (handles.has(key)) { if (expanded.has(key)) expanded.delete(key); else expanded.add(key); } },
    select(key: string) { const node = handles.get(key); if (valid(node ?? null)) select(node!); },
    destroy() { handles.clear(); expanded.clear(); ids = new WeakMap(); current = null; },
  };
}
