export type TargetRect = { x: number; y: number; width: number; height: number };
export const rectOf = ({ x, y, width, height }: DOMRect): TargetRect => ({ x, y, width, height });
export const dimensions = (rect: TargetRect) => `${Number(rect.width.toFixed(2))} × ${Number(rect.height.toFixed(2))}`;

// A display label, deliberately not a selector (and never used as HTML).
const compact = (text: string, limit: number) => {
  const clean = text.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '�');
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
};
export function identityOf(element: Pick<Element, 'localName' | 'id' | 'classList'>) {
  const id = element.id ? `#${compact(element.id, 30)}` : '';
  const classes = Array.from(element.classList).slice(0, 2).map(name => `.${compact(name, 24)}`).join('');
  return compact(`${element.localName}${id}${classes}`, 85);
}
export const fontSummary = (family: string) => family.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
