/** Supported inheritance metadata. Unknown properties remain unknown rather than assumed non-inherited. */
const inherited = new Set(('color cursor direction font-family font-size font-style font-weight font-stretch font-variant font-kerning font-feature-settings font-variation-settings line-height letter-spacing word-spacing text-align text-indent text-transform text-shadow white-space word-break overflow-wrap visibility list-style-type list-style-position list-style-image border-collapse border-spacing caption-side empty-cells orphans widows quotes writing-mode text-orientation fill stroke stroke-width').split(' '));
const local = new Set(('width height min-width max-width min-height max-height display position top right bottom left z-index opacity box-shadow filter transform transform-origin box-sizing overflow overflow-x overflow-y float clear vertical-align text-decoration-line text-decoration-color text-decoration-style text-decoration-thickness background-color background-image background-position-x background-position-y background-size background-repeat background-attachment background-origin background-clip border-image-source border-image-slice border-image-width border-image-outset border-image-repeat animation-name animation-duration animation-delay animation-play-state animation-timing-function animation-fill-mode animation-direction animation-iteration-count animation-composition animation-timeline transition-property transition-duration transition-delay transition-timing-function content isolation outline-color outline-width outline-style outline-offset').split(' '));
for (const side of ['top', 'right', 'bottom', 'left']) {
  local.add(`margin-${side}`); local.add(`padding-${side}`);
  for (const part of ['width', 'style', 'color']) local.add(`border-${side}-${part}`);
}
for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) local.add(`border-${corner}-radius`);
export function isInherited(property: string): boolean | null { return property.startsWith('--') || inherited.has(property) ? true : local.has(property) ? false : null; }
export const inheritedProperties = [...inherited];

/** Browser CSSOM expands individual declarations; the original source declaration stays attached. */
export function createExpander(doc: Document) {
  const scratch = doc.createElement('div').style;
  const cache = new Map<string, { property: string; value: string; uncertain?: boolean }[]>();
  return (property: string, value: string) => {
    const key = JSON.stringify([property, value]); const cached = cache.get(key); if (cached) return cached;
    scratch.cssText = ''; scratch.setProperty(property, value);
    const result = Array.from(scratch).map(name => ({ property: name, value: scratch.getPropertyValue(name), uncertain: !scratch.getPropertyValue(name) }));
    if (!result.length) result.push({ property, value, uncertain: true });
    // Pending-substitution shorthands expose empty longhands. Keep uncertainty, not empty authored values.
    for (const item of result) if (item.uncertain) item.value = value;
    if (cache.size >= 2000) cache.clear(); cache.set(key, result); return result;
  };
}
export type Expand = ReturnType<typeof createExpander>;
