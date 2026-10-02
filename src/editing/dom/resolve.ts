import type { TargetIdentity } from '../../picker/targetLifecycle';
import type { TextFailure } from './model';

const excluded = new Set(['input','textarea','select','option','optgroup','canvas','iframe','object','embed','script','style','template','noscript']);
export const textLimit = 65536;
/** One direct native Text only. This is invoked at explicit editing boundaries, never hover. */
export function resolveText(identity: TargetIdentity): { state: 'available'; node: Text } | TextFailure {
  const owner = identity.element, doc = identity.document;
  const unavailable = (reason: string): TextFailure => ({ state: 'UNAVAILABLE', reason });
  if (!owner.isConnected || owner.ownerDocument !== doc || owner.getRootNode() !== identity.root)
    return unavailable('The original element is unavailable.');
  if (identity.root !== doc && (!('mode' in identity.root) || identity.root.mode !== 'open'))
    return unavailable('Only this document and open shadow roots are supported.');
  if (owner.namespaceURI !== 'http://www.w3.org/1999/xhtml' || excluded.has(owner.localName) || owner.localName.includes('-') || owner.getAttribute('is'))
    return unavailable('This element has unsupported text or form semantics.');
  let ancestor: Element | null = owner;
  for (let depth = 0; ancestor; depth++) {
    if (depth >= 64) return unavailable('Editable ancestry cannot be verified within the safety limit.');
    if ((ancestor as HTMLElement).isContentEditable || ancestor.getAttribute('contenteditable') !== null && ancestor.getAttribute('contenteditable') !== 'false' || excluded.has(ancestor.localName))
      return unavailable('Form values and editable surfaces are unsupported.');
    const root = ancestor.getRootNode();
    ancestor = ancestor.parentElement ?? ('host' in root ? (root as ShadowRoot).host : null);
  }
  if (owner.childNodes.length !== 1 || !(owner.childNodes[0] instanceof doc.defaultView!.Text))
    return unavailable('Select an element with exactly one direct Text node and no nested markup.');
  const node = owner.childNodes[0] as Text;
  if (node.data.length > textLimit) return unavailable('Text exceeds the 65,536 character editing limit.');
  return { state: 'available', node };
}
