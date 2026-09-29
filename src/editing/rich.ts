import { numericToken, validNumeric } from './values';
/** Split CSS lists without damaging commas/spaces inside functions or quoted URLs. */
export function splitCSS(value: string, separator = ',') {
  const result: string[] = []; let start = 0, depth = 0, quote = '', escaped = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && (separator === ' ' ? /\s/.test(c) : c === separator)) { const token = value.slice(start, i).trim(); if (token) result.push(token); start = i + 1; }
  }
  const tail = value.slice(start).trim(); if (tail) result.push(tail);
  return result;
}
export type Gradient = { type: 'linear' | 'radial'; direction: string; stops: { color: string; position: string }[] };
export function parseGradient(value: string): Gradient | null {
  const match = value.match(/^(linear|radial)-gradient\((.*)\)$/s); if (!match) return null;
  const args = splitCSS(match[2]); let direction = match[1] === 'linear' ? '180deg' : 'ellipse at center';
  if (/^(to |[-+\d.]+(?:deg|turn|rad|grad)$|circle|ellipse|at |closest-|farthest-)/.test(args[0])) direction = args.shift()!;
  const stops = args.map(arg => {
    const tokens = splitCSS(arg, ' '); const position = tokens.length > 1 && /^[-+\d.]+(?:%|px|em|rem)$/.test(tokens.at(-1)!) ? tokens.pop()! : '';
    return { color: tokens.join(' '), position };
  });
  return stops.length >= 2 ? { type: match[1] as Gradient['type'], direction, stops } : null;
}
export const serializeGradient = (gradient: Gradient) => `${gradient.type}-gradient(${gradient.direction}, ${gradient.stops.map(stop => `${stop.color}${stop.position ? ` ${stop.position}` : ''}`).join(', ')})`;
export type Shadow = { x: string; y: string; blur: string; spread: string; color: string; inset: boolean };
export function parseShadow(value: string, text = false): Shadow | null {
  const tokens = splitCSS(value, ' '); const lengths: string[] = []; const colors: string[] = []; let inset = false;
  for (const token of tokens) {
    if (token === 'inset') inset = true;
    else if (numericToken(token) && validNumeric('shadow-length',numericToken(token)!)) lengths.push(token);
    else colors.push(token);
  }
  if (lengths.length < 2 || lengths.length > (text ? 3 : 4) || colors.length > 1) return null;
  return { x: lengths[0], y: lengths[1], blur: lengths[2] ?? '0px', spread: lengths[3] ?? '0px', color: colors[0] ?? 'currentColor', inset };
}
const length = (value: string) => /^[-+]?(?:\d*\.)?\d+$/.test(value) ? `${value}px` : value;
export const serializeShadow = (shadow: Shadow, text = false) => `${!text && shadow.inset ? 'inset ' : ''}${[shadow.x, shadow.y, shadow.blur, ...(!text ? [shadow.spread] : [])].map(length).join(' ')} ${shadow.color}`;
export const filterSpecs = [
  { name: 'blur', label: 'Blur', unit: 'px', initial: 0, max: 30 },
  { name: 'contrast', label: 'Contrast', unit: '%', initial: 100, max: 200 },
  { name: 'brightness', label: 'Brightness', unit: '%', initial: 100, max: 200 },
  { name: 'saturate', label: 'Saturate', unit: '%', initial: 100, max: 200 },
  { name: 'hue-rotate', label: 'Hue rotate', unit: 'deg', initial: 0, max: 360 },
  { name: 'invert', label: 'Invert', unit: '%', initial: 0, max: 100 },
  { name: 'grayscale', label: 'Grayscale', unit: '%', initial: 0, max: 100 },
  { name: 'sepia', label: 'Sepia', unit: '%', initial: 0, max: 100 },
];
export function readFilter(value: string, name: string, initial: number, unit: string) {
  const tokens = splitCSS(value, ' ').filter(token => token.startsWith(`${name}(`));
  if (!tokens.length) return { value: initial, editable: true };
  const arg = tokens[0].slice(name.length + 1, -1);
  if (tokens.length !== 1 || !/^-?\d*\.?\d+(?:%|px|deg)?$/.test(arg)) return { value: initial, editable: false };
  return { value: parseFloat(arg) * (unit === '%' && !arg.endsWith('%') ? 100 : 1), editable: true };
}
export function updateFilter(value: string, name: string, amount: number, unit: string) {
  const tokens = value === 'none' ? [] : splitCSS(value, ' '); const index = tokens.findIndex(token => token.startsWith(`${name}(`));
  const next = `${name}(${amount}${unit})`;
  if (index < 0) tokens.push(next); else tokens[index] = next;
  return tokens.join(' ');
}
export function safeImageURL(input: string, base: string) {
  if (!input.trim()) return null;
  try { const url = new URL(input, base); return ['http:', 'https:'].includes(url.protocol) ? `url(${JSON.stringify(url.href)})` : null; } catch { return null; }
}
export type BackgroundLayer = { image: string; position: string; size: string; repeat: string };
export function backgroundLayers(values: { image: string; position: string; size: string; repeat: string }): BackgroundLayer[] {
  const images = values.image === 'none' ? [] : splitCSS(values.image);
  const position = splitCSS(values.position), size = splitCSS(values.size), repeat = splitCSS(values.repeat);
  return images.map((image, i) => ({ image, position: position[i % position.length] ?? '0% 0%', size: size[i % size.length] ?? 'auto', repeat: repeat[i % repeat.length] ?? 'repeat' }));
}
// Hidden images are carried in a valid zero-alpha gradient with a CSS comment. The
// original is recoverable from the override token, so hide/show participates in undo.
export function hiddenImage(image: string) { return `linear-gradient(transparent, transparent) /*cssforge-hidden:${encodeURIComponent(image)}*/`; }
export function originalImage(image: string) { const match = image.match(/\/\*cssforge-hidden:([^*]+)\*\//); try { return match ? decodeURIComponent(match[1]) : null; } catch { return null; } }
export function hiddenShadow(value: string) { return `0px 0px 0px transparent /*cssforge-shadow:${encodeURIComponent(value)}*/`; }
export function originalShadow(value: string) { const match = value.match(/\/\*cssforge-shadow:([^*]+)\*\//); try { return match ? decodeURIComponent(match[1]) : null; } catch { return null; } }
