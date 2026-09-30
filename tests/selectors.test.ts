import { describe, expect, it } from 'vitest';
import { escapeIdentifier, escapeString } from '../src/engine/selectors/escape';
import { createSelectorEngine, selectorLimits } from '../src/engine/selectors';
import type { TargetIdentity, TargetLifecycle } from '../src/picker/targetLifecycle';

describe('selector serialization', () => {
  it.each([
    ['checkout', 'checkout'], ['123buy', '\\31 23buy'], ['-1buy', '-\\31 buy'],
    ['a:b.c#d', 'a\\:b\\.c\\#d'], ['a b', 'a\\ b'], ['日本語', '日本語'],
    ['-', '\\-'], ['a\u0000b', 'a\uFFFDb'], ['a\nb', 'a\\a b'], ['x\\y', 'x\\\\y'],
  ])('serializes identifier %j', (input, expected) => expect(escapeIdentifier(input)).toBe(expected));
  it.each([
    ['a"b\\c', 'a\\"b\\\\c'], ['a\nb', 'a\\a b'], ['\t', '\\9 '], ['\u0000', '\uFFFD'], ['日本語', '日本語'],
  ])('serializes quoted attribute string %j', (input, expected) => expect(escapeString(input)).toBe(expected));
});

// Validation/ownership policy double only. Native CSS semantics are independently tested in built Chrome.
function fixture() {
  let safe = true, queries = 0, matches: Element[] = [], throws = false;
  const root = { defaultView: { CSS: { escape: escapeIdentifier } }, querySelectorAll: () => { queries++; if (throws) throw new Error('syntax'); return matches; } } as unknown as Document;
  const target = { attributes: [{ name: 'id', value: 'save' }], classList: [], localName: 'button', namespaceURI: 'html',
    getAttribute: (name: string) => name === 'id' ? 'save' : null, getRootNode: () => root, parentElement: null, previousElementSibling: null } as unknown as Element;
  const identity = { element: target, document: root, root, session: {} } as TargetIdentity;
  const lifecycle = { safe: () => safe } as unknown as TargetLifecycle;
  const engine = createSelectorEngine(root, lifecycle);
  matches = [target];
  return { engine, target, identity, root, queries: () => queries, safe: (value: boolean) => safe = value, matches: (value: Element[]) => matches = value, throws: () => throws = true };
}
describe('selector validation policy', () => {
  it('performs no work until explicitly requested', () => {
    const f = fixture(); expect(f.engine.getStats()).toEqual({ requests: 0, generations: 0, validations: 0, cacheHits: 0 }); expect(f.queries()).toBe(0);
  });
  it('requires exactly one match that is the original target', () => {
    const f = fixture(); expect(f.engine.generate(f.identity)).toMatchObject({ selector: '#save', state: 'unique', origin: 'generated', stability: 'high' });
    f.matches([{} as Element]); expect(f.engine.generate(f.identity).state).toBe('non-unique');
    f.matches([f.target, f.target]); expect(f.engine.validateAuthored(f.identity, '#save').state).toBe('non-unique');
    f.matches([]); expect(f.engine.validateAuthored(f.identity, '#save')).toMatchObject({ state: 'non-unique', validation: { count: 0, matchesTarget: false } });
  });
  it('revalidates a cached result and supports deliberate invalidation/refresh', () => {
    const f = fixture(); f.engine.generate(f.identity); f.engine.generate(f.identity);
    expect(f.queries()).toBe(2); expect(f.engine.getStats()).toMatchObject({ generations: 1, cacheHits: 1 });
    f.engine.invalidate(f.identity); f.engine.generate(f.identity); f.engine.generate(f.identity, { refresh: true });
    expect(f.engine.getStats().generations).toBe(3);
    f.engine.destroy(); expect(f.engine.generate(f.identity).state).toBe('unsupported'); expect(f.engine.getStats().generations).toBe(3);
  });
  it('does not query unsafe bindings or iframe interiors', () => {
    const f = fixture(); f.safe(false); expect(f.engine.generate(f.identity).state).toBe('unsupported');
    f.safe(true); expect(f.engine.generate(f.identity, { frame: 'interior' }).state).toBe('unsupported');
    expect(f.engine.validateAuthored(f.identity, 'button', { frame: 'interior' }).state).toBe('unsupported'); expect(f.queries()).toBe(0);
  });
  it('keeps authored text and group/pseudo context separate, immutable, and unassessed', () => {
    const f = fixture(), media = ['(min-width: 800px)'];
    const generated = f.engine.generate(f.identity, { context: { pseudo: ':hover', media } });
    expect(generated.selector).toBe('#save'); expect(generated.context.pseudo).toBe(':hover');
    const authored = f.engine.validateAuthored(f.identity, ' button:hover, .primary ', { context: { media } });
    expect(authored.selector).toBe(' button:hover, .primary '); expect(authored.origin).toBe('authored'); expect(authored.stability).toBe('low');
    media.push('print'); expect(authored.context.media).toHaveLength(1);
  });
  it('reports parse failures and length bounds truthfully', () => {
    const f = fixture(); f.throws(); expect(f.engine.validateAuthored(f.identity, '[').state).toBe('invalid');
    expect(f.engine.validateAuthored(f.identity, 'x'.repeat(selectorLimits.length + 1)).state).toBe('truncated'); expect(f.queries()).toBe(1);
  });
  it('bounds ancestor queries globally instead of multiplying per ancestor', () => {
    const f = fixture(); f.matches([]);
    let parent: Element | null = null;
    const attributes = ['data-id', 'data-key', 'data-testid', 'name', 'type', 'role'].map(name => ({ name, value: 'same' }));
    for (let i = 0; i < 12; i++) parent = { ...f.target, attributes, getAttribute: () => null, parentElement: parent } as unknown as Element;
    Object.assign(f.target, { parentElement: parent });
    expect(f.engine.generate(f.identity).state).toBe('truncated'); expect(f.queries()).toBe(selectorLimits.validations);
  });
  it('labels a foreign Document accurately while refusing its binding', () => {
    const f = fixture(), foreignRoot = { nodeType: 9 } as Document;
    const foreign = { ...f.identity, document: foreignRoot, root: foreignRoot };
    expect(f.engine.generate(foreign)).toMatchObject({ state: 'unsupported', scope: 'document', root: foreignRoot }); expect(f.queries()).toBe(0);
  });
  it('bounds oversized tag names before serialization or validation', () => {
    const f = fixture(); Object.assign(f.target, { localName: 'x'.repeat(161) });
    expect(f.engine.generate(f.identity).state).toBe('truncated'); expect(f.queries()).toBe(0);
  });
  it('does not label a known generated ID as stable evidence', () => {
    const f = fixture(); Object.assign(f.target, { attributes: [{ name: 'id', value: 'react-random' }], getAttribute: () => 'react-random' });
    expect(f.engine.generate(f.identity)).toMatchObject({ state: 'unique', strategy: 'id', stability: 'low', risks: ['generated-id-may-change'] });
  });
});
