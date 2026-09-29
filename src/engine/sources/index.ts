import { splitCSS } from '../../editing/rich';
import { matchingContexts } from './matching';
import type { Declaration, RuleContext, SelectedSources, SessionGroup, SourceAccessibility, SourceRule, SourceSheet } from './model';

type Scope = Document | ShadowRoot;
const readable = { readable: true } as const;
const failure = (error: unknown): SourceAccessibility => ({ readable: false, reason: (error as Error)?.name === 'SecurityError' ? 'security' : 'unavailable', message: error instanceof Error ? error.message : String(error) });
const animationNames = (style: CSSStyleDeclaration) => splitCSS(style.getPropertyValue('animation-name')).map(name => name.replace(/^['"]|['"]$/g, ''));

/** One session-owned CSSOM index. No observers, polling, computed-style reads or UI dependencies. */
export function createSourceIndex(doc: Document, owns: (element: Element) => boolean = () => false) {
  let identities = new WeakMap<object, string>(), sequence = 0, scans = 0;
  let scopes = new WeakMap<Scope, { sheets: SourceSheet[]; notices: string[] }>();
  let selected = new WeakMap<Element, SelectedSources>();
  const id = (object: object, prefix: string) => {
    let value = identities.get(object);
    if (!value) { value = `${prefix}-${++sequence}`; identities.set(object, value); }
    return value;
  };
  const queryMatches = (query: string): boolean | null => { try { return doc.defaultView?.matchMedia(query).matches ?? null; } catch { return null; } };
  const context = (key: string, kind: RuleContext['kind'], text: string, condition?: string, name?: string): RuleContext => ({
    id: `${key}:context`, kind, text, condition, name,
    matches: kind === 'media' && condition ? queryMatches(condition) : kind === 'supports' && condition ? (() => { try { return doc.defaultView?.CSS.supports(condition) ?? null; } catch { return null; } })() : null,
  });
  function declarations(style: CSSStyleDeclaration, sourceId: string, ruleId: string, contexts: RuleContext[], budget: { left: number }, notices: Set<string>): Declaration[] {
    // CSSOM serialization retains shorthands; indexed property access expands them.
    // CSSOM has already normalized spelling/formatting/order and discarded duplicate declarations.
    const names = new Set(splitCSS(style.cssText, ';').map(item => item.slice(0, item.indexOf(':')).trim()).filter(Boolean));
    const result: Declaration[] = [];
    for (const property of names) {
      if (budget.left-- <= 0) { notices.add('Declaration inspection limit reached (10,000).'); break; }
      const priority = style.getPropertyPriority(property);
      result.push({ id: `${ruleId}:declaration:${property}`, sourceId, ruleId, contexts, property, value: style.getPropertyValue(property), priority, important: priority === 'important', order: result.length, enabled: true });
    }
    return result;
  }
  function scopeSources(root: Scope) {
    const cached = scopes.get(root); if (cached) return cached;
    scans++;
    const notices = new Set<string>(), sheets: SourceSheet[] = [], seen = new Set<CSSStyleSheet>();
    const budget = { left: 10000 }; let ruleCount = 0;
    const adopted = new Set(root.adoptedStyleSheets ?? []);
    const regular = root.nodeType === 9 ? [...(root as Document).styleSheets] : [...root.querySelectorAll('style,link')].map(node => (node as HTMLStyleElement).sheet).filter((sheet): sheet is CSSStyleSheet => !!sheet);
    for (const sheet of [...regular, ...adopted]) {
      if (seen.has(sheet)) continue; seen.add(sheet);
      const owner = sheet.ownerNode as Element | null;
      if (owner && (owns(owner) || owner.hasAttribute?.('data-cssforge-edit-layer'))) continue;
      if (sheets.length >= 50) { notices.add('Stylesheet inspection limit reached (50 per scope).'); break; }
      const sourceId = id(sheet, 'sheet');
      const source: SourceSheet = { id: sourceId, scopeId: id(root, 'scope'), kind: adopted.has(sheet) ? 'adopted' : sheet.href ? 'linked' : 'style', label: sheet.href ?? (adopted.has(sheet) ? 'adopted stylesheet' : '<style>'), url: sheet.href, order: sheets.length, disabled: sheet.disabled, accessibility: readable, rules: [] };
      const walk = (list: CSSRuleList, ancestry: RuleContext[], path: number[], depth: number): SourceRule[] => {
        const result: SourceRule[] = [];
        for (const [index, native] of Array.from(list).entries()) {
          if (ruleCount++ >= 2000 || depth > 12) { notices.add('Rule inspection limit reached (2,000 rules / 12 nested groups per scope).'); break; }
          const ruleId = id(native, 'rule');
          const raw = native as CSSRule & { style?: CSSStyleDeclaration; cssRules?: CSSRuleList; selectorText?: string; conditionText?: string; name?: string; keyText?: string };
          const header = raw.cssText.slice(0, raw.cssText.indexOf('{')).trim();
          const kind = native.type === 1 ? 'style' : native.type === 7 ? 'keyframes' : native.type === 8 ? 'keyframe' : 'cssRules' in raw ? 'group' : 'other';
          const rule: SourceRule = { id: ruleId, sourceId, path: [...path, index], order: ruleCount - 1, kind, selectorText: raw.selectorText, name: raw.name, keyText: raw.keyText, cssText: raw.cssText, contexts: ancestry, declarations: raw.style ? declarations(raw.style, sourceId, ruleId, ancestry, budget, notices) : [], children: [], animationNames: raw.style ? animationNames(raw.style) : [], accessibility: readable };
          result.push(rule);
          if (native.type === 3) notices.add('Imported stylesheets are recorded as @import rules; their contents are not expanded.');
          if (kind === 'style' || kind === 'group' || kind === 'keyframes') {
            let chain = ancestry;
            if (kind !== 'keyframes') {
              const contextKind = kind === 'style' ? 'style' : /^@media\b/.test(header) ? 'media' : /^@supports\b/.test(header) ? 'supports' : /^@layer\b/.test(header) ? 'layer' : /^@container\b/.test(header) ? 'container' : 'group';
              chain = [...ancestry, context(ruleId, contextKind, kind === 'style' ? raw.selectorText! : header, raw.conditionText, raw.name)];
            }
            try { if (raw.cssRules?.length) rule.children = walk(raw.cssRules, chain, rule.path, depth + 1); }
            catch (error) { rule.accessibility = failure(error); notices.add(`Inaccessible rule group in ${source.label}.`); }
          }
        }
        return result;
      };
      try {
        const media = sheet.media?.mediaText;
        source.rules = walk(sheet.cssRules, media ? [context(sourceId, 'media', `@media ${media}`, media)] : [], [], 0);
      } catch (error) { source.accessibility = failure(error); notices.add(`Inaccessible stylesheet: ${source.label}`); }
      sheets.push(source);
    }
    const snapshot = { sheets, notices: [...notices] }; scopes.set(root, snapshot); return snapshot;
  }
  function read(element: Element): SelectedSources {
    const cached = selected.get(element); if (cached) return cached;
    const root = element.getRootNode() as Scope;
    const scopeId = id(root, 'scope'), elementId = id(element, 'element');
    const inlineId = `${elementId}:inline`, inlineRuleId = `${inlineId}:rule`;
    const notices = new Set<string>();
    const allowed = !owns(element) && (root === doc || ('mode' in root && root.mode === 'open' && !owns(root.host)));
    const inline: SourceSheet = { id: inlineId, scopeId, kind: 'inline', label: 'inline style', url: null, order: 0, disabled: false, accessibility: readable, rules: [] };
    const snapshot: SelectedSources = { scopeId, sheets: [], inline, matches: [], keyframes: [], notices: [] };
    if (!allowed) { snapshot.notices.push('Closed or CSSForge-owned scopes are not inspected.'); return snapshot; }
    const roots: Scope[] = [root]; let ancestor: Scope = root;
    while ('host' in ancestor) {
      ancestor = ancestor.host.getRootNode() as Scope;
      if (ancestor !== doc && (!('mode' in ancestor) || ancestor.mode !== 'open' || owns(ancestor.host))) break;
      roots.push(ancestor);
    }
    for (const scope of roots) { const indexed = scopeSources(scope); snapshot.sheets.push(...indexed.sheets); indexed.notices.forEach(item => notices.add(item)); }
    if (root !== doc) notices.add('Shadow-host, slotted and inherited styles are not resolved. Closed shadow roots are unsupported.');
    const style = (element as HTMLElement | SVGElement).style;
    if (style) inline.rules.push({ id: inlineRuleId, sourceId: inlineId, path: [], order: 0, kind: 'inline', cssText: style.cssText, contexts: [], declarations: declarations(style, inlineId, inlineRuleId, [], { left: 10000 }, notices), children: [], animationNames: animationNames(style), accessibility: readable });
    const visit = (rule: SourceRule, source: SourceSheet) => {
      if (rule.kind === 'keyframes') snapshot.keyframes.push(rule);
      if (rule.kind === 'style' && !rule.contexts.some(item => item.kind === 'style')) {
        for (const match of matchingContexts(element, rule.selectorText!)) snapshot.matches.push({ rule, source, context: { ...match.context, media: rule.contexts.filter(item => item.kind === 'media').map(item => item.condition!) }, editable: !source.disabled && match.editable && rule.contexts.every(item => item.kind === 'media') });
      }
      if (rule.contexts.some(item => item.kind === 'style')) notices.add('Nested selectors are indexed with their ancestry; relative selector matching is not resolved.');
      rule.children.forEach(child => visit(child, source));
    };
    // Ordinary document selectors must never be matched against elements inside a shadow scope.
    snapshot.sheets.filter(source => source.scopeId === scopeId).forEach(source => source.rules.forEach(rule => visit(rule, source)));
    snapshot.notices = [...notices]; selected.set(element, snapshot); return snapshot;
  }
  function overrides(element: Element, groups: SessionGroup[]): SourceSheet {
    const sourceId = `${id(element, 'element')}:overrides`, scopeId = id(element.getRootNode(), 'scope');
    return { id: sourceId, scopeId, kind: 'override', label: 'CSSForge session overrides', url: null, order: 0, disabled: false, accessibility: readable, rules: groups.map((group, order) => {
      const ruleId = `${sourceId}:${JSON.stringify([group.context.media, group.context.pseudo])}`;
      const contexts = group.context.media.map((query, index) => context(`${ruleId}:${index}`, 'media', `@media ${query}`, query));
      return { id: ruleId, sourceId, path: [order], order, kind: 'override', cssText: '', contexts, editContext: group.context, children: [], animationNames: [], accessibility: readable, declarations: group.declarations.map((item, index) => ({ ...item, id: `${ruleId}:declaration:${item.property}`, sourceId, ruleId, contexts, order: index, priority: 'important', important: true })) };
    }) };
  }
  return {
    read, overrides,
    /** Selection / Code activation / explicit Refresh. CSSOM insertRule is not observable reliably. */
    invalidate() { scopes = new WeakMap(); selected = new WeakMap(); },
    getStats: () => ({ scopeScans: scans }),
    destroy() { scopes = new WeakMap(); selected = new WeakMap(); identities = new WeakMap(); },
  };
}
export type SourceIndex = ReturnType<typeof createSourceIndex>;
