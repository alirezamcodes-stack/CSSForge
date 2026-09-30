/** Bounded selected-target/ancestor observers. No polling, subtree scan or source work. */
export function observeTarget(element: Element, invalidate: () => void, owns: (element: Element) => boolean = () => false) {
  const win = element.ownerDocument.defaultView!;
  const mutations = new win.MutationObserver(invalidate);
  const sizes = new win.ResizeObserver(invalidate);
  const watched = new Set<Node>();
  let nearby = 0;
  const watch = (node: Node) => {
    if (watched.has(node) || (node instanceof win.Element && (owns(node) || node.hasAttribute('data-cssforge-edit-layer')))) return;
    watched.add(node);
    mutations.observe(node, { attributes: node instanceof win.Element, childList: true, characterData: true });
    if (node instanceof win.Element) sizes.observe(node);
  };
  let node: Node | null = element;
  const lineage: { node: Node; parent: Node | null }[] = [];
  for (let depth = 0; node && depth < 64; depth++) {
    lineage.push({ node, parent: node.parentNode });
    watch(node);
    // Nearby layout siblings can reposition the target without resizing its parent.
    if (node.parentNode) {
      let sibling: ChildNode | null = node.parentNode.firstChild;
      for (let count = 0; sibling && count < 64 && nearby < 128; count++, sibling = sibling.nextSibling) {
        if (sibling !== node) { nearby++; watch(sibling); }
      }
    }
    node = node.parentNode ?? (node instanceof win.ShadowRoot ? node.host : null);
  }
  // Rebind the bounded chain if the same Element is reparented inside its valid root.
  return { moved: () => lineage.some(item => item.node.parentNode !== item.parent), stop: () => { mutations.disconnect(); sizes.disconnect(); } };
}
