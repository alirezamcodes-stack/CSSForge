export type TargetIdentity = Readonly<{ element: Element; document: Document; root: Document | ShadowRoot; session: object }>;

/** Object identity is authoritative. A copied attribute or same ID never rebinds a target. */
export function createTargetLifecycle(doc: Document, owns: (element: Element) => boolean) {
  const session = {}, win = doc.defaultView!;
  let identities = new WeakMap<Element, TargetIdentity>();
  const excluded = new Set(['script', 'style', 'link', 'meta', 'head', 'title', 'template', 'noscript']);
  const admissible = (element: Element | null): element is Element => {
    if (!element || !element.isConnected || element.ownerDocument !== doc || owns(element) || element.hasAttribute('hidden') || excluded.has(element.localName)) return false;
    const root = element.getRootNode();
    return root === doc || (root instanceof win.ShadowRoot && root.mode === 'open' && !owns(root.host));
  };
  const safe = (identity: TargetIdentity) => identity.session === session && identities.get(identity.element) === identity && admissible(identity.element) && identity.element.getRootNode() === identity.root;
  return {
    admissible, safe,
    valid(element: Element | null): element is Element { return admissible(element) && (!identities.has(element) || safe(identities.get(element)!)); },
    bind(element: Element): TargetIdentity {
      const existing = identities.get(element);
      if (existing && safe(existing)) return existing;
      if (!admissible(element)) throw new Error('Target is outside this session scope.');
      const identity = { element, document: doc, root: element.getRootNode() as Document | ShadowRoot, session };
      identities.set(element, identity); return identity;
    },
    forget(identity: TargetIdentity) { if (identities.get(identity.element) === identity) identities.delete(identity.element); },
    destroy() { identities = new WeakMap(); },
  };
}
export type TargetLifecycle = ReturnType<typeof createTargetLifecycle>;
