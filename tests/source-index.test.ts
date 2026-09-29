import { describe, expect, it } from 'vitest';
import { createSourceIndex } from '../src/engine/sources';
import { presentSource } from '../src/editing/readable';
import { discoverMedia } from '../src/editing/contexts';

// CSSOM-shaped objects isolate index/cache behavior; browser tests cover native CSSOM serialization.
function style(values: Record<string, string>, important: string[] = []) {
  return { cssText: Object.entries(values).map(([key, value]) => `${key}: ${value}${important.includes(key) ? ' !important' : ''};`).join(' '), getPropertyValue: (key: string) => values[key] ?? '', getPropertyPriority: (key: string) => important.includes(key) ? 'important' : '' } as CSSStyleDeclaration;
}
function rule(selector: string, values: Record<string, string> = {}) {
  return { type: 1, selectorText: selector, style: style(values), cssText: `${selector} {}`, cssRules: [] } as unknown as CSSStyleRule;
}
function group(header: string, rules: CSSRule[], condition?: string) {
  return { type: 0, cssText: `${header} {}`, conditionText: condition, cssRules: rules } as unknown as CSSRule;
}
function sheet(rules: CSSRule[], extra = {}) { return { href: null, disabled: false, ownerNode: null, cssRules: rules, ...extra } as unknown as CSSStyleSheet; }
function fixture(sheets: CSSStyleSheet[] = [], inline = style({})) {
  const doc = { nodeType: 9, styleSheets: sheets, adoptedStyleSheets: [], defaultView: { matchMedia: (query: string) => ({ matches: !query.includes('9999') }), CSS: { supports: () => true } } } as unknown as Document;
  const element = { getRootNode: () => doc, matches: (selector: string) => selector === '.card', style: inline } as unknown as Element;
  return { doc, element, index: createSourceIndex(doc) };
}

describe('central CSS source index', () => {
  it('preserves inline order, important, custom properties and authored functions/units with ownership', () => {
    const { index, element } = fixture([], style({ '--token': '12px', 'font-size': '2rem', color: 'var(--text)', width: 'calc(100% - 2rem)', padding: '1em 2em', height: '50%' }, ['color']));
    const source = index.read(element), inline = source.inline;
    expect(inline.kind).toBe('inline');
    const values = inline.rules[0].declarations;
    expect(values.map(item => item.value)).toEqual(['12px', '2rem', 'var(--text)', 'calc(100% - 2rem)', '1em 2em', '50%']);
    expect(values.map(item => item.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(values[2]).toMatchObject({ important: true, priority: 'important', sourceId: inline.id, ruleId: inline.rules[0].id, contexts: [] });
  });
  it('distinguishes style, linked and adopted sheets and deduplicates repeated sheet objects', () => {
    const embedded = sheet([rule('.card')]), linked = sheet([rule('.card')], { href: 'https://site.test/main.css' }), adopted = sheet([rule('.card')]);
    const { doc, element, index } = fixture([embedded, linked, embedded]);
    Object.assign(doc, { adoptedStyleSheets: [adopted, adopted] });
    expect(index.read(element).sheets.map(item => item.kind)).toEqual(['style', 'linked', 'adopted']);
    expect(index.read(element).matches).toHaveLength(3);
  });
  it('retains nested media/supports/layer/container context and never invents unsupported condition matches', () => {
    const nested = group('@media (min-width: 9999px)', [group('@supports (display: grid)', [group('@layer theme', [group('@container card (width > 20px)', [rule('.card:hover', { color: 'red' })], '(width > 20px)')])], '(display: grid)')], '(min-width: 9999px)');
    const { index, element } = fixture([sheet([nested])]);
    const match = index.read(element).matches[0];
    expect(match.rule.selectorText).toBe('.card:hover');
    expect(match.rule.path).toEqual([0, 0, 0, 0, 0]);
    expect(match.rule.contexts.map(item => [item.kind, item.matches])).toEqual([['media', false], ['supports', true], ['layer', null], ['container', null]]);
    expect(match.context).toEqual({ media: ['(min-width: 9999px)'], pseudo: ':hover' });
    expect(match.editable).toBe(false);
    expect(match.rule.declarations[0].contexts).toBe(match.rule.contexts);
    expect(discoverMedia(index.read(element)).contexts).toEqual([]);
  });
  it('keeps media-only pseudo contexts editable without activating states', () => {
    const { index, element } = fixture([sheet([group('@media print', [rule('.card::before')], 'print')])]);
    expect(index.read(element).matches[0]).toMatchObject({ editable: true, context: { media: ['print'], pseudo: '::before' } });
    expect(discoverMedia(index.read(element)).contexts).toEqual([{ queries: ['print'], source: 'readable rule' }]);
  });
  it('records access failure as first-class data without fabricating rules', () => {
    const locked = sheet([]); Object.defineProperty(locked, 'cssRules', { get() { throw Object.assign(new Error('Denied'), { name: 'SecurityError' }); } });
    const { index, element } = fixture([locked]);
    expect(index.read(element).sheets[0]).toMatchObject({ accessibility: { readable: false, reason: 'security' }, rules: [] });
    expect(presentSource(index.read(element)).notices).toContain('Inaccessible stylesheet: <style>');
  });
  it('shares cached discovery, refreshes CSSOM changes, and keeps identities stable as rule paths change', () => {
    const native = rule('.card', { width: '10px' }), rules = [native];
    const { index, element } = fixture([sheet(rules)]);
    const first = index.read(element), match = first.matches[0];
    rules.unshift(rule('.other')); Object.assign(native, { style: style({ width: '20px' }) });
    expect(index.read(element)).toBe(first); expect(index.getStats().scopeScans).toBe(1);
    index.invalidate(); const next = index.read(element);
    expect(next).not.toBe(first); expect(index.getStats().scopeScans).toBe(2);
    expect(next.matches[0].rule.path).toEqual([1]);
    expect(next.matches[0].rule.id).toBe(match.rule.id);
    expect(next.matches[0].source.id).toBe(match.source.id);
    expect(next.matches[0].rule.declarations[0]).toMatchObject({ id: match.rule.declarations[0].id, value: '20px' });
  });
  it('indexes shadow/adopted sources but only matches the selected scope and excludes owned/closed scopes', () => {
    const { doc } = fixture([sheet([rule('.card', { color: 'red' })])]);
    const host = { getRootNode: () => doc } as unknown as Element;
    const shadow = { nodeType: 11, mode: 'open', host, querySelectorAll: () => [{ sheet: sheet([rule('.card', { color: 'blue' })]) }], adoptedStyleSheets: [sheet([rule('.card', { width: '2rem' })])] } as unknown as ShadowRoot;
    const element = { getRootNode: () => shadow, matches: () => true, style: style({}) } as unknown as Element;
    const index = createSourceIndex(doc);
    expect(index.read(element).sheets).toHaveLength(3);
    expect(index.read(element).matches.map(item => item.rule.declarations[0].value)).toEqual(['blue', '2rem']);
    expect(createSourceIndex(doc, node => node === host).read(element).sheets).toEqual([]);
    Object.assign(shadow, { mode: 'closed' }); expect(createSourceIndex(doc).read(element).sheets).toEqual([]);
  });
  it('excludes generated override styles and models current enabled/disabled session data separately without scans', () => {
    const owned = sheet([rule('.card')], { ownerNode: { hasAttribute: () => true } });
    const { element, index } = fixture([owned]);
    expect(index.read(element).sheets).toEqual([]);
    const groups = [{ context: { media: ['print'], pseudo: ':hover' as const }, declarations: [{ property: 'color', value: 'red', enabled: false }] }];
    const session = index.overrides(element, groups);
    expect(session.kind).toBe('override');
    expect(session.rules[0].declarations[0]).toMatchObject({ value: 'red', enabled: false, important: true, sourceId: session.id });
    expect(index.overrides(element, groups).rules[0].id).toBe(session.rules[0].id);
    expect(index.getStats().scopeScans).toBe(1);
  });
  it('indexes all readable keyframes and projects only referenced frames with their contexts', () => {
    const frame = { type: 8, keyText: '50%', style: style({ opacity: '.5' }), cssText: '50% { opacity: .5; }' } as unknown as CSSRule;
    const keyframes = { type: 7, name: 'gentle', cssText: '@keyframes gentle {50% {opacity: .5}}', cssRules: [frame] } as unknown as CSSRule;
    const { index, element } = fixture([sheet([group('@media screen', [keyframes], 'screen')])], style({ 'animation-name': 'gentle' }));
    const source = index.read(element);
    expect(source.keyframes[0].children[0]).toMatchObject({ kind: 'keyframe', keyText: '50%', declarations: [{ property: 'opacity', value: '.5' }] });
    expect(source.keyframes[0].contexts[0].condition).toBe('screen');
    expect(presentSource(source).keyframes[0].css).toContain('@media screen {');
  });
  it('retains nested style ancestry without falsely matching a relative selector', () => {
    const parent = rule('.card'); Object.assign(parent, { cssRules: [rule('&:hover', { color: 'red' })] });
    const { index, element } = fixture([sheet([parent])]);
    const source = index.read(element);
    expect(source.matches).toHaveLength(1);
    expect(source.sheets[0].rules[0].children[0].contexts[0]).toMatchObject({ kind: 'style', text: '.card' });
    expect(source.notices.join()).toContain('relative selector matching');
  });
  it('bounds indexing and makes truncation explicit', () => {
    const { index, element } = fixture([sheet(Array.from({ length: 2100 }, () => rule('.other')))]);
    expect(index.read(element).sheets[0].rules).toHaveLength(2000);
    expect(index.read(element).notices.join()).toContain('Rule inspection limit');
  });
});
