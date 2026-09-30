/** Only existing width/height controls; no SVG promotion or geometry editor. */
export function supportsSize(element: Pick<Element, 'namespaceURI' | 'localName'>, display: string): boolean {
  if (display === 'none' || display === 'contents') return false;
  if (element.namespaceURI === 'http://www.w3.org/2000/svg') return ['svg', 'rect', 'image', 'foreignObject'].includes(element.localName);
  return display !== 'inline' || ['img', 'input', 'textarea', 'select', 'button', 'video', 'canvas', 'iframe', 'object', 'embed'].includes(element.localName);
}
