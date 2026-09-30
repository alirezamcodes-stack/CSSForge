import { selectorList } from '../cascade/specificity';
import { mutationLimits, type MutationScope } from './model';
const staticPseudos = new Set(['is', 'where', 'not', 'has', 'root', 'empty', 'first-child', 'last-child', 'only-child', 'nth-child', 'nth-last-child', 'first-of-type', 'last-of-type', 'only-of-type', 'nth-of-type', 'nth-last-of-type']);

/** Potential whole-rule recipients, independent of selected cascade context. Never activates a state. */
export function mutationScope(doc: Document, root: Document | ShadowRoot, selector: string | null, adopted: boolean): MutationScope {
  if (!selector) return { kind: 'target-specific', matchedCount: 1, bounded: true, risk: 'local' };
  const unknown = (matchedCount: number, bounded: boolean): MutationScope => ({ kind: 'unknown', matchedCount, bounded, risk: 'unknown' });
  if (selector.length > mutationLimits.scopeSelectorLength) return unknown(0, false);
  const branches = selectorList(selector);
  if (branches.length > mutationLimits.scopeBranches) return unknown(0, false);
  let uncertain = adopted;
  const candidates: string[] = [];
  for (const branch of branches) {
    // A supported terminal state/pseudo-element can be bounded by its originating elements.
    // State branches remain unknown even when their present base happens to have one recipient.
    const suffix = branch.match(/(::before|::after|:hover|:focus|:active)$/)?.[0];
    const prefix = suffix ? branch.slice(0, -suffix.length) : branch;
    const base = suffix ? (!prefix ? '*' : /[\s>+~]$/.test(prefix) ? `${prefix}*` : prefix) : branch;
    if (suffix) uncertain = true;
    // Static structural/function selectors can use native matches. Every other state,
    // pseudo-element, shadow/namespace or escaped construction stays conservative.
    const pseudos = [...base.matchAll(/:([\w-]+)/g)].map(match => match[1]);
    if (!base || /[\\&|]|::/.test(base) || pseudos.some(name => !staticPseudos.has(name))) { uncertain = true; continue; }
    candidates.push(base);
  }
  let matchedCount = 0, visited = 0;
  const walker = doc.createTreeWalker(root, 1);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (++visited > mutationLimits.scopeElements) return unknown(matchedCount, false);
    let matches = false;
    for (const branch of candidates) {
      try { if ((node as Element).matches(branch)) matches = true; }
      catch { uncertain = true; }
    }
    // Count each element once even if several authored branches match it.
    if (matches) matchedCount++;
  }
  if (uncertain) return unknown(matchedCount, !adopted);
  return { kind: matchedCount > 1 ? 'shared-rule' : 'target-specific', matchedCount, bounded: true, risk: matchedCount > 1 ? 'shared' : 'local' };
}
