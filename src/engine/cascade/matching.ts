import type { EditContext } from '../../editing/contexts';
import { matchingContexts } from '../sources/matching';
import { compareSpecificity, selectorSpecificities, type Specificity } from './specificity';

/** Inspect an explicit context without changing browser state. Complex state logic is unresolved. */
export function selectorMatch(element: Element, selectorText: string, context: EditContext) {
  let weight: Specificity = [0, 0, 0], selector: string | undefined, unknown = false, candidate = false;
  for (const item of selectorSpecificities(selectorText)) {
    const suffix = item.selector.match(/(::before|::after|:hover|:focus|:active)$/)?.[0] ?? '';
    const base = suffix ? item.selector.slice(0, -suffix.length) : item.selector;
    // Unsupported ancestor/functional states cannot borrow the target's chosen state.
    if (/(?:\\|&|\||:(?:hover|focus|active|visited|host|host-context|scope|before|after|first-line|first-letter)\b|::)/.test(base)) { unknown = true; continue; }
    const matches = matchingContexts(element, item.selector);
    if (!matches.length) continue;
    candidate = true;
    const applicable = context.pseudo.startsWith('::') ? suffix === context.pseudo : !suffix || suffix === context.pseudo;
    if (!applicable) continue;
    if (!item.specificity) { unknown = true; continue; }
    if (!selector || compareSpecificity(item.specificity, weight) > 0) { weight = item.specificity; selector = item.selector; }
  }
  return { weight, selector, state: unknown ? 'unresolved' as const : selector ? 'matched' as const : 'inactive' as const, reason: candidate ? 'pseudo' as const : 'selector' as const };
}
