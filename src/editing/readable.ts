import { splitCSS } from './rich';
import type { EditContext, Pseudo } from './contexts';

export type Declaration = { property: string; value: string; priority: string };
export type SourceGroup = { label: string; selector: string; context: EditContext; editable: boolean; conditions: string[]; declarations: Declaration[] };
export type SourceSnapshot = { inline: Declaration[]; rules: SourceGroup[]; keyframes: { name: string; css: string }[]; notices: string[] };

/** Match only a terminal supported state; do not infer ancestor states or complex pseudo logic. */
export function matchingContexts(element: Element, selectors: string): { context: EditContext; editable: boolean }[] {
  const result: { context: EditContext; editable: boolean }[] = [];
  for (const selector of splitCSS(selectors)) {
    const suffix = selector.match(/(:hover|:focus|:active|::before|::after)$/)?.[0] as Pseudo | undefined;
    const prefix = suffix ? selector.slice(0, -suffix.length) : selector;
    const base = suffix && /[\s>+~]$/.test(prefix) ? `${prefix}*` : prefix;
    try {
      if (element.matches(base || '*')) result.push({ context: { media: [], pseudo: suffix ?? '' }, editable: !base.includes(':') });
    } catch { /* Unsupported/nested selector: no invented match. */ }
  }
  return result.filter((item, index) => result.findIndex(other => other.context.pseudo === item.context.pseudo && other.editable === item.editable) === index);
}

/** Shared bounded CSSOM traversal for Design contexts and explicit Code inspection. */
export function walkReadable(element: Element, visit: (rule: CSSStyleRule, media: string[], conditions: string[], source: string) => void, keyframe?: (rule: CSSKeyframesRule, conditions: string[]) => void) {
  const root = element.getRootNode() as Document | ShadowRoot;
  const sheets = root instanceof Document ? [...root.styleSheets, ...root.adoptedStyleSheets] : [...root.querySelectorAll('style,link')].slice(0, 50).map(node => (node as HTMLStyleElement).sheet).filter((sheet): sheet is CSSStyleSheet => !!sheet).concat(root.adoptedStyleSheets);
  const notices = new Set<string>(); let count = 0;
  const walk = (rules: CSSRuleList, media: string[], conditions: string[], source: string, depth: number) => {
    for (const rule of rules) {
      if (++count > 2000 || depth > 6) { notices.add('Inspection limit reached (50 sheets / 2,000 rules / 6 nested groups).'); return; }
      if (rule instanceof CSSMediaRule) walk(rule.cssRules, [...media, rule.conditionText], [...conditions, `@media ${rule.conditionText}`], source, depth + 1);
      else if (rule instanceof CSSStyleRule) { visit(rule, media, conditions, source); if (rule.cssRules?.length) notices.add('Nested style rules are not expanded.'); }
      else if (rule instanceof CSSSupportsRule) { if (CSS.supports(rule.conditionText)) walk(rule.cssRules, media, [...conditions, `@supports ${rule.conditionText}`], source, depth + 1); }
      else if (rule instanceof CSSKeyframesRule) keyframe?.(rule, conditions);
      else if (rule.type !== CSSRule.FONT_FACE_RULE) notices.add('Imports, layers, containers and other unsupported rule groups are not expanded.');
    }
  };
  for (const [index, sheet] of sheets.slice(0, 50).entries()) {
    if (sheet.disabled || (sheet.ownerNode as Element | null)?.hasAttribute('data-cssforge-edit-layer')) continue;
    const source = sheet.href ?? `Embedded / adopted stylesheet ${index + 1}`;
    try { const media = sheet.media?.mediaText ? [sheet.media.mediaText] : []; walk(sheet.cssRules, media, media.map(query => `@media ${query}`), source, 0); }
    catch { notices.add(`Inaccessible stylesheet: ${source}`); }
    if (count > 2000) break;
  }
  if (sheets.length > 50) notices.add('Stylesheet limit reached (50).');
  return [...notices];
}

export function readSource(element: Element): SourceSnapshot {
  const rules: SourceGroup[] = [], keyframes: SourceSnapshot['keyframes'] = [];
  const names = new Set<string>(); let declarationsLeft = 500, truncated = false;
  const declarations = (style: CSSStyleDeclaration) => {
    const result: Declaration[] = [];
    // CSSOM serialization preserves compact shorthands; indexed access expands them.
    // Values still come from CSSOM, never from computed style or a handwritten parser.
    const serializedNames = new Set(splitCSS(style.cssText, ';').map(item => item.slice(0, item.indexOf(':')).trim()).filter(name => name && style.getPropertyValue(name)));
    for (const property of serializedNames) {
      if (--declarationsLeft < 0) { truncated = true; break; }
      const value = style.getPropertyValue(property);
      if (value.length > 8000) { truncated = true; continue; }
      result.push({ property, value, priority: style.getPropertyPriority(property) });
    }
    for (const name of splitCSS(style.getPropertyValue('animation-name'))) names.add(name.replace(/^['"]|['"]$/g, ''));
    return result;
  };
  const inline = element instanceof HTMLElement || element instanceof SVGElement ? declarations(element.style) : [];
  const candidates: { name: string; css: string }[] = [];
  const notices = walkReadable(element, (rule, media, conditions, label) => {
    for (const match of matchingContexts(element, rule.selectorText)) {
      if (rules.length >= 80) { truncated = true; return; }
      rules.push({ label, selector: rule.selectorText, context: { ...match.context, media }, editable: match.editable, conditions, declarations: declarations(rule.style) });
    }
  }, (rule, conditions) => {
    if (candidates.length < 30 && rule.cssText.length <= 12000) candidates.push({ name: rule.name, css: [...conditions, rule.cssText].join('\n') });
    else truncated = true;
  });
  for (const candidate of candidates) if (names.has(candidate.name)) keyframes.push(candidate);
  if (truncated) notices.push('Source display limited to 80 matching groups, 500 declarations and bounded keyframes.');
  return { inline, rules, keyframes, notices };
}
