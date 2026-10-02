import { expect, it } from 'vitest';
import { createCascade, resolveCandidates } from '../src/engine/cascade';
import { selectorMatch } from '../src/engine/cascade/matching';
import { layerOrder } from '../src/engine/cascade/layers';
import type { Candidate } from '../src/engine/cascade/model';
import type { SelectedSources, SourceRule, SourceSheet } from '../src/engine/sources/model';
import type { SourceIndex } from '../src/engine/sources';
import { declarationStatus } from '../src/engine/cascade/status';
import type { CascadeResult } from '../src/engine/cascade/model';
import { editEffect, hasActiveOutsideContext } from '../src/editing/effectiveness';

let serial = 0;
function candidate(value: string, options: Partial<Candidate> & { important?: boolean; kind?: SourceSheet['kind'] } = {}): Candidate {
  const id = String(++serial), sourceId = `sheet-${id}`, property = options.property ?? 'color';
  const declaration = { id, sourceId, ruleId: id, contexts: [], property, value, priority: options.important ? 'important' : '', important: options.important ?? false, order: 0, enabled: true };
  const rule: SourceRule = { id, sourceId, path: [0], order: 0, kind: 'style', selectorText: '.card', cssText: `.card { ${property}: ${value}; }`, contexts: [], declarations: [declaration], children: [], animationNames: [], accessibility: { readable: true } };
  const source: SourceSheet = { id: sourceId, scopeId: 'doc', kind: options.kind ?? 'style', label: '<style>', url: null, order: 0, disabled: false, rules: [rule], accessibility: { readable: true } };
  return { declaration, rule, source, property, value, specificity: [0, 1, 0], order: [0, 0, 0], layer: null, state: 'matched', issues: [], ...options };
}
it('edit effectiveness requires every expanded shorthand contribution to win with certain evidence', () => {
  const own = candidate('blue', { important: true, kind: 'override', property: 'border-top-color' });
  own.declaration.property = 'border-color';
  const bottom = { ...own, property: 'border-bottom-color' };
  const author = candidate('red', { important: true, property: 'border-top-color', specificity: [1, 0, 0] });
  const context = { media: [], pseudo: '' } as const;
  const result = (top = resolveCandidates('border-top-color', [own]), other = resolveCandidates('border-bottom-color', [bottom])): CascadeResult => ({ context: { media: [], pseudo: '' }, properties: { 'border-top-color': top, 'border-bottom-color': other }, scope: 'readable-author', browserEquivalent: false, issues: [] });
  expect(editEffect(own.declaration, { ...context, media: [] }, result(), 'active', 'rgb(0, 0, 255)').state).toBe('effective');
  expect(editEffect(own.declaration, { ...context, media: [] }, result(resolveCandidates('border-top-color', [own, author])), 'active').state).toBe('blocked');
  expect(editEffect(own.declaration, { ...context, media: [] }, result(resolveCandidates('border-top-color', [own, author], ['inaccessible-source'])), 'active').state).toBe('unknown');
});
it('edit effectiveness keeps accepted inactive and unverified contexts distinct from known cascade losses', () => {
  const own = candidate('calc(100px + 30px)', { important: true, kind: 'override', property: 'width' });
  const context = { media: [], pseudo: '' } as const;
  const result: CascadeResult = { context: { media: [], pseudo: '' }, properties: { width: resolveCandidates('width', [own]) }, scope: 'readable-author', browserEquivalent: false, issues: [] };
  const state = (activity: Parameters<typeof editEffect>[3]) => editEffect(own.declaration, { ...context, media: [] }, result, activity, '130px').state;
  expect(state('active')).toBe('effective'); expect(state('inactive-media')).toBe('pending'); expect(state('inactive-pseudo')).toBe('pending'); expect(state('unverified-pseudo')).toBe('unknown');
  expect(editEffect(own.declaration, { ...context, media: [] }, result, 'active', '130px', true).state).toBe('unknown');
});
it('outside-context selector errors and unsupported candidates withhold certainty after an accepted edit', () => {
  const own = candidate('32px', { important: true, kind: 'override', property: 'font-size' });
  const outside = candidate('20px', { important: true, property: 'font-size', state: 'inactive', inactiveReason: 'media' });
  outside.rule.selectorText = 'h|button';
  const result: CascadeResult = { context: { media: ['(min-width: 1000px)'], pseudo: '' }, properties: { 'font-size': resolveCandidates('font-size', [own, outside]) }, scope: 'readable-author', browserEquivalent: false, issues: [] };
  const element = { matches() { throw new DOMException('Unresolvable stylesheet namespace', 'SyntaxError'); } } as unknown as Element;
  expect(hasActiveOutsideContext(result, own.declaration.id, element)).toBe(true);
  outside.issues = ['unsupported-selector'];
  expect(hasActiveOutsideContext(result, own.declaration.id, { matches() { return false; } } as unknown as Element)).toBe(true);
});
it('resolves specificity and source-order ties with structured loss reasons', () => {
  const early = candidate('red'), late = candidate('blue', { order: [1, 0, 0] });
  const tie = resolveCandidates('color', [early, late]); expect(tie.winner).toBe(late); expect(tie.overridden[0].reason).toBe('source-order');
  const specific = candidate('gold', { specificity: [1, 0, 0] });
  const result = resolveCandidates('color', [early, late, specific]); expect(result.winner).toBe(specific); expect(result.overridden[0].reason).toBe('specificity');
});
it('compares rule and declaration order after sheet order', () => {
  const a = candidate('a', { order: [0, 5, 0] }), b = candidate('b', { order: [0, 5, 1] }), c = candidate('c', { order: [0, 6, 0] });
  expect(resolveCandidates('color', [a, b]).winner).toBe(b); expect(resolveCandidates('color', [a, b, c]).winner).toBe(c);
});
it('honors important then inline precedence without treating inline as selector specificity', () => {
  const inline = candidate('red', { kind: 'inline', specificity: [0, 0, 0] }), author = candidate('blue', { important: true });
  expect(resolveCandidates('color', [inline, author])).toMatchObject({ winner: author, importantAffected: true, overridden: [{ reason: 'important' }] });
  const importantInline = candidate('green', { important: true, kind: 'inline', specificity: [0, 0, 0] });
  expect(resolveCandidates('color', [importantInline, author]).winner).toBe(importantInline);
});
it('models CSSForge as author-important with its real selector weight, not an unbeatable origin', () => {
  const own = candidate('blue', { important: true, kind: 'override', order: [2, 0, 0] });
  const normal = candidate('red', { kind: 'inline' });
  expect(resolveCandidates('color', [normal, own]).overridden[0]).toMatchObject({ reason: 'important', bySessionEdit: true });
  const id = candidate('gold', { important: true, specificity: [1, 0, 0] });
  expect(resolveCandidates('color', [own, id]).winner).toBe(id);
});
it('orders named layers and reverses precedence for important, with inline important above layers', () => {
  const first = candidate('red', { layer: 0 }), last = candidate('blue', { layer: 1 }), unlayered = candidate('gold');
  expect(resolveCandidates('color', [first, last]).winner).toBe(last);
  expect(resolveCandidates('color', [first, last, unlayered]).winner).toBe(unlayered);
  const a = candidate('red', { layer: 0, important: true }), b = candidate('blue', { layer: 1, important: true }), c = candidate('gold', { important: true });
  expect(resolveCandidates('color', [a, b, c]).winner).toBe(a);
  const inline = candidate('green', { important: true, kind: 'inline' }); expect(resolveCandidates('color', [a, inline]).winner).toBe(inline);
});
it('keeps readable leaders tentative when sources are inaccessible or contexts unsupported', () => {
  const a = candidate('red');
  expect(resolveCandidates('color', [a], ['inaccessible-source'])).toMatchObject({ confidence: 'incomplete', winner: undefined, readableWinner: a });
  expect(resolveCandidates('color', [a, candidate('blue', { state: 'unresolved', issues: ['unsupported-context'] })])).toMatchObject({ confidence: 'unresolved', winner: undefined });
});
it('uses only the specificity of actually matching selector-list branches', () => {
  const el = { matches: (selector: string) => selector === '.card' } as unknown as Element;
  expect(selectorMatch(el, '#other, .card', { media: [], pseudo: '' }).weight).toEqual([0, 1, 0]);
  expect(selectorMatch(el, '.card:hover', { media: [], pseudo: '' }).state).toBe('inactive');
  expect(selectorMatch(el, '.card:hover', { media: [], pseudo: ':hover' }).weight).toEqual([0, 2, 0]);
  expect(selectorMatch(el, '.card::before', { media: [], pseudo: '::after' }).state).toBe('inactive');
  expect(selectorMatch(el, ':is(.card:hover, #other)', { media: [], pseudo: ':hover' }).state).toBe('unresolved');
});

function fixture(childCandidates: Candidate[], parentCandidates: Candidate[] = []) {
  const doc = {} as Document;
  const parent = { parentElement: null, getRootNode: () => doc, matches: () => true } as unknown as Element;
  const child = { parentElement: parent, getRootNode: () => doc, matches: () => true } as unknown as Element;
  const snapshot = (items: Candidate[]): SelectedSources => ({ scopeId: 'doc', sheets: items.map(item => item.source), inline: { ...candidate('').source, kind: 'inline', rules: [] }, matches: [], keyframes: [], notices: [] });
  const snapshots = new Map([[child, snapshot(childCandidates)], [parent, snapshot(parentCandidates)]]);
  const sources = { read: (el: Element) => snapshots.get(el)!, overrides: () => ({ ...candidate('').source, kind: 'override', rules: [] }) } as Pick<SourceIndex, 'read' | 'overrides'>;
  const cascade = createCascade(doc, sources, () => [], (property, value) => [{ property, value }]);
  return { cascade, child, parent, sources };
}
it('inherits supported properties and custom tokens, not arbitrary computed or non-inherited values', () => {
  const { cascade, child, parent } = fixture([], [candidate('red'), candidate('10px', { property: 'width' }), candidate('2rem', { property: '--token' })]);
  const result = cascade.read(child);
  expect(result.properties.color.inherited).toMatchObject({ from: parent, declaration: { value: 'red' } });
  expect(result.properties.width.inherited).toBeUndefined(); expect(result.properties.width.defaulting).toBe('initial');
  expect(result.properties['--token'].inherited?.declaration?.value).toBe('2rem');
});
it.each(['inherit', 'unset'])('resolves %s for an inherited property', value => {
  const { cascade, child } = fixture([candidate(value)], [candidate('blue')]);
  const result = cascade.read(child).properties.color;
  expect(result.winner?.value).toBe(value); expect(result.inherited?.declaration?.value).toBe('blue'); expect(result.confidence).toBe('resolved');
});
it('supports explicit inheritance for a non-inherited property, and initial/unset defaulting', () => {
  const inherited = fixture([candidate('inherit', { property: 'width' })], [candidate('12px', { property: 'width' })]);
  expect(inherited.cascade.read(inherited.child).properties.width.inherited?.declaration?.value).toBe('12px');
  for (const value of ['unset', 'initial']) {
    const f = fixture([candidate(value, { property: 'width' })]); expect(f.cascade.read(f.child).properties.width.defaulting).toBe('initial');
  }
});
it.each(['revert', 'revert-layer'])('marks %s unsupported instead of falling back to a guessed declaration', value => {
  const f = fixture([candidate(value)]); expect(f.cascade.read(f.child).properties.color).toMatchObject({ confidence: 'unresolved', winner: undefined, issues: ['unsupported-keyword'] });
});
it('does not let an important parent declaration compete with a local normal declaration', () => {
  const f = fixture([candidate('blue')], [candidate('red', { important: true })]); expect(f.cascade.read(f.child).properties.color.winner?.value).toBe('blue');
});
it('retains inactive media/supports and disabled declarations without letting them win', () => {
  for (const kind of ['media', 'supports'] as const) {
    const a = candidate('red'); a.rule.contexts = [{ id: 'condition', kind, text: '@condition', condition: '(test)', matches: false }];
    const f = fixture([a, candidate('blue')]); expect(f.cascade.read(f.child).properties.color).toMatchObject({ winner: { value: 'blue' }, inactive: [{ inactiveReason: kind }] });
  }
});
it('preserves active supports, excludes unrelated selected media and does not force inactive queries', () => {
  const a = candidate('red'); a.rule.contexts = [{ id: 's', kind: 'supports', text: '@supports (display:grid)', condition: '(display:grid)', matches: true }];
  const b = candidate('blue'); b.rule.contexts = [{ id: 'm', kind: 'media', text: '@media screen', condition: 'screen', matches: true }];
  const f = fixture([a, b]); expect(f.cascade.read(f.child, { pseudo: '', media: ['print'] }).properties.color).toMatchObject({ winner: { value: 'red' }, inactive: [{ inactiveReason: 'media' }] });
});
it('reconstructs flat named layer statements and marks nested/anonymous ordering uncertain', () => {
  const a = candidate('red'); a.rule.cssText = '@layer reset, theme;';
  const b = candidate('blue'); b.rule.cssText = '@layer theme { }';
  expect(layerOrder([a.source, b.source])).toEqual({ names: ['reset', 'theme'], uncertain: false });
  b.rule.cssText = '@layer { }'; expect(layerOrder([b.source]).uncertain).toBe(true);
});
it('caches selected cascade reads and rebuilds after explicit invalidation', () => {
  const f = fixture([candidate('red')]), first = f.cascade.read(f.child), before = f.cascade.getStats();
  expect(f.cascade.read(f.child)).toBe(first); expect(f.cascade.getStats()).toEqual(before);
  f.cascade.invalidate(); expect(f.cascade.read(f.child)).not.toBe(first); expect(f.cascade.getStats().resolutions).toBeGreaterThan(before.resolutions);
});
it.each([
  ['margin', 'margin-top', '1px', '7px'], ['padding', 'padding-left', '2px', '9px'],
  ['border', 'border-left-width', '1px', '5px'], ['background', 'background-color', 'red', 'blue'],
  ['font', 'font-size', '16px', '22px'],
])('compares normalized %s longhands without losing original provenance', (shorthand, property, initial, replacement) => {
  // Inputs represent the browser-normalized longhands; native CSSOM expansion is verified in Chrome.
  const expanded = candidate(initial, { property }), direct = candidate(replacement, { property, order: [0, 1, 0] });
  expanded.declaration.property = shorthand;
  const resolved = resolveCandidates(property, [expanded, direct]);
  expect(resolved.winner).toBe(direct); expect(resolved.overridden[0].candidate.declaration.property).toBe(shorthand);
  expanded.declaration.important = true;
  expect(resolveCandidates(property, [expanded, direct]).winner).toBe(expanded);
});
it('shows a mixed shorthand status instead of claiming every longhand wins', () => {
  const a = candidate('1px', { property: 'margin-top' }), b = candidate('2px', { property: 'margin-left' });
  b.declaration.id = a.declaration.id;
  const top = resolveCandidates('margin-top', [a, candidate('7px', { property: 'margin-top', specificity: [1, 0, 0] })]);
  const left = resolveCandidates('margin-left', [b]);
  const result: CascadeResult = { context: { media: [], pseudo: '' }, scope: 'readable-author', browserEquivalent: false, issues: [], properties: { 'margin-top': top, 'margin-left': left } };
  expect(declarationStatus(result, a.declaration.id)).toBe('mixed');
});
it('does not assert inherited provenance when an unresolved local context could override it', () => {
  const a = candidate('blue'); a.rule.contexts = [{ id: 'container', kind: 'container', text: '@container (width > 20px)', matches: null }];
  const f = fixture([a], [candidate('red')]), result = f.cascade.read(f.child).properties.color;
  expect(result.confidence).toBe('unresolved'); expect(result.winner).toBeUndefined(); expect(result.inherited?.declaration).toBeUndefined();
});
