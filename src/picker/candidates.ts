import { identityOf } from './identity';
export type TargetCandidate = { element: Element; identity: string; origin: 'event' | 'point' | 'ancestor'; interactive: boolean; boundary: 'iframe-interior-unsupported' | null };

/** Called on an explicit pick only. Raw hover keeps the event-path fast path. */
export function collectCandidates(doc: Document, path: EventTarget[], x: number, y: number, valid: (element: Element | null) => element is Element, owns: (node: EventTarget | null) => boolean): TargetCandidate[] {
  const win = doc.defaultView!, result: TargetCandidate[] = [], seen = new Set<Element>(), roots = new Set<Document | ShadowRoot>();
  if (path.some(owns)) return result;
  const add = (element: Element, origin: TargetCandidate['origin']) => {
    if (result.length >= 64 || seen.has(element) || !valid(element)) return;
    seen.add(element); result.push({ element, identity: identityOf(element), origin, interactive: ['button', 'a', 'input', 'select', 'textarea', 'summary'].includes(element.localName), boundary: element.localName === 'iframe' ? 'iframe-interior-unsupported' : null });
  };
  const raw = path.find(node => node instanceof win.Element) as Element | undefined;
  if (raw) add(raw, 'event'); // Conservative normalization: never silently promote SVG/span.
  const points = (root: Document | ShadowRoot, depth: number) => {
    if (roots.size >= 12 || depth > 8 || roots.has(root)) return;
    roots.add(root);
    for (const element of root.elementsFromPoint(x, y).slice(0, 64)) {
      if (owns(element)) continue;
      if (element.shadowRoot?.mode === 'open') points(element.shadowRoot, depth + 1);
      add(element, 'point');
      if (result.length >= 64) break;
    }
  };
  if (Number.isFinite(x) && Number.isFinite(y)) points(doc, 0);
  for (const node of path.slice(0, 64)) if (node instanceof win.Element) add(node, 'event');
  for (const entry of [...result]) {
    let ancestor: Element | null = entry.element.parentElement;
    for (let depth = 0; ancestor && depth < 16 && result.length < 64; depth++) {
      add(ancestor, 'ancestor'); const root = ancestor.getRootNode();
      ancestor = ancestor.parentElement ?? (root instanceof win.ShadowRoot && root.mode === 'open' ? root.host : null);
    }
  }
  return result;
}
