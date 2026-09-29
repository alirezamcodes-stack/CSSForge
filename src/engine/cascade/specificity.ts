export type Specificity = readonly [number, number, number];
export const compareSpecificity = (a: Specificity, b: Specificity) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const max = (values: Specificity[]): Specificity => values.reduce((a, b) => compareSpecificity(a, b) >= 0 ? a : b, [0, 0, 0]);
const ident = /^(?:[\w\u0080-\uffff-]|\\(?:[\da-fA-F]{1,6}\s?|[^\r\n]))+/;

/** Token-aware boundaries: commas/parentheses inside attributes, strings and escapes are inert. */
export function selectorList(text: string): string[] {
  const parts: string[] = []; let start = 0, depth = 0, quote = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') { i++; continue; }
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (c === ',' && depth === 0) { parts.push(text.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(text.slice(start).trim()); return parts;
}
function closing(text: string, start: number): number {
  let depth = 1, quote = ''; const open = text[start], end = open === '(' ? ')' : ']';
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i]; if (c === '\\') { i++; continue; }
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === open) depth++;
    if (c === end) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Selectors 4 tuples; null means unsupported syntax, never a guessed score. */
export function specificity(selector: string): Specificity | null {
  const selectors = selectorList(selector); if (selectors.length !== 1) return null;
  const text = selector.replace(/\/\*[\s\S]*?\*\//g, ''); let i = 0;
  const total = [0, 0, 0];
  const add = (value: Specificity) => value.forEach((n, index) => { total[index] += n; });
  const listWeight = (value: string): Specificity | null => {
    const weights = selectorList(value).map(specificity); return weights.some(item => item === null) ? null : max(weights as Specificity[]);
  };
  while (i < text.length) {
    const c = text[i];
    if (/\s|[>+~]/.test(c)) { i++; continue; }
    if (c === '[') { const end = closing(text, i); if (end < 0) return null; total[1]++; i = end + 1; continue; }
    if (c === '#' || c === '.') { const name = text.slice(i + 1).match(ident)?.[0]; if (!name) return null; total[c === '#' ? 0 : 1]++; i += name.length + 1; continue; }
    if (c === ':') {
      const double = text[i + 1] === ':'; i += double ? 2 : 1;
      const name = text.slice(i).match(ident)?.[0]?.toLowerCase(); if (!name || name.includes('\\')) return null; i += name.length;
      const pseudoElement = double || ['before', 'after', 'first-line', 'first-letter'].includes(name);
      if (text[i] !== '(') { total[pseudoElement ? 2 : 1]++; continue; }
      const end = closing(text, i); if (end < 0) return null;
      const args = text.slice(i + 1, end); i = end + 1;
      if (name === 'where' && !pseudoElement) continue;
      if (['is', 'not', 'has'].includes(name) && !pseudoElement) { const weight = listWeight(args); if (!weight) return null; add(weight); continue; }
      if (pseudoElement) {
        total[2]++;
        if (name === 'slotted') { const weight = listWeight(args); if (!weight) return null; add(weight); }
        else if (name !== 'part') return null;
        continue;
      }
      total[1]++;
      if (name === 'nth-child' || name === 'nth-last-child') {
        // The An+B prefix cannot contain nested syntax; everything after `of` is a selector list.
        const of = args.match(/^\s*(?:even|odd|[+-]?\d*n(?:\s*[+-]\s*\d+)?|[+-]?\d+)\s+of\s+([\s\S]+)$/i);
        if (of) { const weight = listWeight(of[1]); if (!weight) return null; add(weight); }
        else if (!/^\s*(?:even|odd|[+-]?\d*n(?:\s*[+-]\s*\d+)?|[+-]?\d+)\s*$/i.test(args)) return null;
      } else if (name === 'host' || name === 'host-context') { const weight = listWeight(args); if (!weight) return null; add(weight); }
      else if (!['lang', 'dir', 'nth-of-type', 'nth-last-of-type', 'state'].includes(name)) return null;
      continue;
    }
    // Namespace prefixes have no weight; the local type alone contributes.
    const token = c === '*' || c === '|' ? c : text.slice(i).match(ident)?.[0];
    if (!token) return null; i += token.length;
    if (text[i] === '|' && text[i + 1] !== '|') {
      i++; const local = text[i] === '*' ? '*' : text.slice(i).match(ident)?.[0]; if (!local) return null;
      if (local !== '*') total[2]++; i += local.length;
    } else if (token === '|') { const local = text[i] === '*' ? '*' : text.slice(i).match(ident)?.[0]; if (!local) return null; if (local !== '*') total[2]++; i += local.length; }
    else if (token !== '*') total[2]++;
  }
  return text.trim() ? total as unknown as Specificity : null;
}
export const selectorSpecificities = (text: string) => selectorList(text).map(selector => ({ selector, specificity: specificity(selector) }));
