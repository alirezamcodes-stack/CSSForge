import { isEditLayer } from './layerOwnership';

type Owner = { element: Element; attribute: string; id: string; quarantine: () => void };

/** Marker hygiene only: no replacement matching or document traversal. Active editing roots
 * watch additions/the session attribute, inspect at most 256 nodes per delivery, and fail
 * closed on overflow. MutationObserver runs before the next browser paint. */
export function createMarkerContainment(doc: Document, owns: (element: Element) => boolean) {
  const win = doc.defaultView!;
  const roots = new Map<Document | ShadowRoot, { observer: MutationObserver; owners: Set<Owner> }>();
  const removeCopies = (node: Element, owners: Set<Owner>) => {
    for (const owner of owners) {
      if (node !== owner.element && node.getAttribute(owner.attribute) === owner.id) node.removeAttribute(owner.attribute);
      else if (node === owner.element && node.getAttribute(owner.attribute) !== owner.id) owner.quarantine();
    }
  };
  return {
    add(root: Document | ShadowRoot, owner: Owner) {
      let entry = roots.get(root);
      if (!entry) {
        const owners = new Set<Owner>();
        const observer = new win.MutationObserver(records => {
          let budget = 256;
          if (records.length > 128) { [...owners].forEach(item => item.quarantine()); return; }
          for (const record of records) {
            if (record.type === 'attributes') { removeCopies(record.target as Element, owners); continue; }
            if (record.addedNodes.length > budget) { [...owners].forEach(item => item.quarantine()); return; }
            const pending = Array.from(record.addedNodes);
            while (pending.length) {
              if (--budget < 0) { [...owners].forEach(item => item.quarantine()); return; }
              const node = pending.pop()!;
              if (!(node instanceof win.Element)) continue;
              if (isEditLayer(node) || owns(node)) continue;
              removeCopies(node, owners);
              // Only the added subtree, with a shared delivery budget; never query the root.
              for (let child = node.firstElementChild; child; child = child.nextElementSibling) {
                if (pending.length >= budget) { [...owners].forEach(item => item.quarantine()); return; }
                pending.push(child);
              }
            }
          }
        });
        entry = { observer, owners }; roots.set(root, entry);
      }
      // Bound owner work as well as added-node work. Excess layers fail closed.
      if (entry.owners.size >= 128) { owner.quarantine(); return () => {}; }
      entry.owners.add(owner);
      entry.observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: [...new Set([...entry.owners].map(item => item.attribute))] });
      return () => {
        entry!.owners.delete(owner);
        if (!entry!.owners.size) { entry!.observer.disconnect(); roots.delete(root); }
      };
    },
    destroy() { roots.forEach(entry => entry.observer.disconnect()); roots.clear(); },
  };
}
