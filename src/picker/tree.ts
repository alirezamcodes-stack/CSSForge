import { identityOf } from './identity';
import { navigationChildren } from './navigation';
export type TreeRow = { id: string; label: string; tag: string; elementId: string; classes: string; depth: number; selected: boolean; expanded: boolean; expandable: boolean; boundary: string; text: string };
export type TreeSnapshot = { rows: TreeRow[]; limited: boolean };

/** Only visible branches are read. DOM handles stay here, outside React state. */
export function createTree(valid: (node: Element | null) => node is Element, parent: (node: Element) => Element | null, select: (node: Element) => void) {
  let ids = new WeakMap<Element, string>(), sequence = 0;
  const handles = new Map<string, Element>(), expanded = new Set<string>();
  let current: Element | null = null;
  const id = (node: Element) => { let value = ids.get(node); if (!value) { value = String(++sequence); ids.set(node, value); } return value; };
  const child = (node: Element) => {
    return navigationChildren(node).find(valid) ?? null;
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
      const children = navigationChildren(node, pathChild);
      let offset = 0;
      // Keep the selected path in view even when it is far down a large sibling list.
      if (path.includes(node) && pathChild && pathChild !== node) {
        offset = Math.max(0, children.indexOf(pathChild) - 8);
        if (offset || children[0] !== child(node)) limited = true;
      }
      let shown = 0;
      for (; offset < children.length && shown < 32; offset++) if (valid(children[offset])) { visit(children[offset], depth + 1); shown++; }
      if (offset < children.length) limited = true;
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
