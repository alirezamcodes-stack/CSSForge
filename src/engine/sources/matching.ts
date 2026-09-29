import { splitCSS } from '../../editing/rich';
import type { EditContext, Pseudo } from '../../editing/contexts';

/** Candidate contexts, not cascade winners. Never activate a browser pseudo state. */
export function matchingContexts(element: Element, selectors: string): { context: EditContext; editable: boolean }[] {
  const result: { context: EditContext; editable: boolean }[] = [];
  for (const selector of splitCSS(selectors)) {
    const suffix = selector.match(/(:hover|:focus|:active|::before|::after)$/)?.[0] as Pseudo | undefined;
    const prefix = suffix ? selector.slice(0, -suffix.length) : selector;
    const base = suffix && /[\s>+~]$/.test(prefix) ? `${prefix}*` : prefix;
    try {
      if (element.matches(base || '*')) result.push({ context: { media: [], pseudo: suffix ?? '' }, editable: !base.includes(':') });
    } catch { /* Unsupported selector: no invented match. */ }
  }
  return result.filter((item, index) => result.findIndex(other => other.context.pseudo === item.context.pseudo && other.editable === item.editable) === index);
}
