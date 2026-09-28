export const pseudos = ['', ':hover', ':focus', ':active', '::before', '::after'] as const;
export type Pseudo = typeof pseudos[number];
export type EditContext = { media: string[]; pseudo: Pseudo };
export type MediaContext = { queries: string[]; source: 'readable rule' | 'session override' };
export const baseContext = (): EditContext => ({ media: [], pseudo: '' });
export const contextKey = (context: EditContext) => JSON.stringify([context.media, context.pseudo]);

/** Bounded, selection-time discovery only. No declaration extraction, index, or cascade claims. */
export function discoverMedia(element: Element): { contexts: MediaContext[]; limited: boolean } {
  const root = element.getRootNode() as Document | ShadowRoot;
  const sheets = root instanceof Document ? [...root.styleSheets, ...root.adoptedStyleSheets] : [...root.querySelectorAll('style,link')].map(node => (node as HTMLStyleElement).sheet).filter(Boolean).concat(root.adoptedStyleSheets);
  const contexts = new Map<string, MediaContext>();
  let count = 0, limited = false;
  const walk = (rules: CSSRuleList, media: string[], depth: number) => {
    for (const rule of rules) {
      if (++count > 2000 || depth > 6) { limited = true; return; }
      if (rule instanceof CSSMediaRule) walk(rule.cssRules, [...media, rule.conditionText], depth + 1);
      else if (rule instanceof CSSStyleRule && media.length) {
        // Only selectors that the browser can directly prove match the current element.
        try { if (element.matches(rule.selectorText)) contexts.set(JSON.stringify(media), { queries: media, source: 'readable rule' }); } catch { /* nesting/unsupported selectors are not inferred */ }
      } else if (rule instanceof CSSSupportsRule) {
        if (CSS.supports(rule.conditionText)) walk(rule.cssRules, media, depth + 1);
      } else if (rule.type !== CSSRule.STYLE_RULE && rule.type !== CSSRule.FONT_FACE_RULE) limited = true;
    }
  };
  for (const sheet of sheets.slice(0, 50)) {
    if (!sheet || sheet.disabled || (sheet.ownerNode as HTMLElement | null)?.hasAttribute('data-cssforge-edit-layer')) continue;
    try { walk(sheet.cssRules, sheet.media?.mediaText ? [sheet.media.mediaText] : [], 0); } catch { limited = true; }
    if (count > 2000) break;
  }
  return { contexts: [...contexts.values()], limited: limited || sheets.length > 50 };
}
