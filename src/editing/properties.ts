export const properties = [
  'width', 'height', 'opacity',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'font-family', 'font-weight', 'font-size', 'line-height', 'color', 'text-align', 'letter-spacing',
  'background-color', 'display', 'border-width', 'border-style', 'border-color', 'border-radius', 'position',
  'background-image', 'background-position', 'background-size', 'background-repeat', 'box-shadow', 'text-shadow', 'filter',
  'top', 'right', 'bottom', 'left', 'z-index', 'text-decoration-line', 'text-transform',
] as const;
export type Property = typeof properties[number];
const lengths = new Set<Property>(['width', 'height', 'font-size', 'letter-spacing', 'border-width', 'border-radius', 'top', 'right', 'bottom', 'left', ...properties.filter(p => p.startsWith('margin-') || p.startsWith('padding-'))]);
export function normalizeValue(property: Property, input: string) {
  const value = input.trim();
  // Bare lengths are px. Preserve explicitly supplied units/keywords/functions.
  return lengths.has(property) && /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(value) ? `${value}px` : value;
}
export function validateValue(property: string, value: string, supports: (property: string, value: string) => boolean) {
  return properties.includes(property as Property) && value.length > 0 && value.length <= 8000
    && !/[;{}\u0000-\u001f]/.test(value) && !/!\s*important/i.test(value) && supports(property, value);
}
export function editorValue(property: Property, computed: string, inline: string, override?: string) {
  // Inline tokens are known browser declarations; never claim to recover stylesheet source.
  return override ?? (inline && !inline.includes('var(') ? inline : computed);
}
