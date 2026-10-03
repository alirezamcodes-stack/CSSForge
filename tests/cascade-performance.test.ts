import { expect, it, vi } from 'vitest';
import { createCascade } from '../src/engine/cascade';
import type { CascadeResult } from '../src/engine/cascade/model';
import type { Expand } from '../src/engine/cascade/properties';
import type { SourceIndex } from '../src/engine/sources';
import type { Declaration, RuleContext, SelectedSources, SessionGroup, SourceRule, SourceSheet } from '../src/engine/sources/model';
import { baseContext, contextKey, type EditContext } from '../src/editing/contexts';
import { editEffect, hasActiveOutsideContext } from '../src/editing/effectiveness';

let sequence = 0;
const readable = { readable: true } as const;
const expand: Expand = (property, value) => {
  const names = property === 'margin' || property === 'padding' ? ['top', 'right', 'bottom', 'left'].map(side => `${property}-${side}`)
    : property === 'border-color' ? ['top', 'right', 'bottom', 'left'].map(side => `border-${side}-color`)
    : property === 'background' ? ['background-color', 'background-image']
    : property === 'font' ? ['font-size', 'font-family', 'line-height'] : [property];
  return names.map(name => ({ property: name, value, ...(value.includes('var(') ? { uncertain: true } : {}) }));
};
function rule(properties: Record<string, string>, options: Partial<SourceRule> = {}, important = false): SourceRule {
  const id = `rule-${++sequence}`;
  return { id, sourceId: 'author', path: [sequence], order: sequence, kind: 'style', selectorText: '*', cssText: '', contexts: [], children: [], animationNames: [], accessibility: readable,
    declarations: Object.entries(properties).map(([property, value], order) => ({ id: `${id}:${property}`, sourceId: 'author', ruleId: id, contexts: [], property, value, order, priority: important ? 'important' : '', important, enabled: true })), ...options };
}
function sheet(rules: SourceRule[], options: Partial<SourceSheet> = {}): SourceSheet {
  return { id: `sheet-${++sequence}`, scopeId: 'doc', kind: 'style', label: '<style>', url: null, order: sequence, disabled: false, accessibility: readable, rules, ...options };
}
function fixture(author: SourceSheet[], childGroups: SessionGroup[] = []) {
  const doc = {} as Document;
  const matches = { enabled: true, focus: false };
  const element = (id: string, parentElement: Element | null) => ({ id, parentElement, getRootNode: () => doc, matches(selector: string) {
    if (selector === ':focus' || selector.endsWith(':focus')) return matches.focus && id === 'child';
    return matches.enabled && (selector === '*' || selector === `.${id}` || selector === '#child' && id === 'child');
  } }) as unknown as Element;
  const root = element('root', null), parent = element('parent', root), child = element('child', parent);
  const emptyInline = sheet([], { id: 'inline', kind: 'inline', order: 0 });
  const snapshots = new Map<Element, SelectedSources>([root, parent, child].map(node => [node, { scopeId: 'doc', sheets: author, inline: emptyInline, matches: [], keyframes: [], notices: [] }]));
  const groups = new Map<Element, SessionGroup[]>([[child, childGroups]]);
  let position: number | undefined = 1000;
  const sources: Pick<SourceIndex, 'read' | 'overrides'> = {
    read: node => snapshots.get(node)!,
    overrides(node, items) {
      const source = sheet([], { id: `${node.id}:override`, kind: 'override', order: 0 });
      source.rules = items.map((group, order) => {
        const id = `${source.id}:${contextKey(group.context)}`;
        const contexts = group.context.media.map((condition, index): RuleContext => ({ id: `${id}:${index}`, kind: 'media', text: `@media ${condition}`, condition, matches: condition !== 'inactive' }));
        return rule({}, { id, sourceId: source.id, kind: 'override', selectorText: undefined, contexts, editContext: group.context, path: [order], order,
          declarations: group.declarations.map((item, index) => ({ ...item, id: `${id}:${item.property}`, sourceId: source.id, ruleId: id, contexts, order: index, priority: 'important', important: true })) });
      });
      return source;
    },
  };
  const expansion = vi.fn(expand), cascade = createCascade(doc, sources, node => groups.get(node) ?? [], expansion, () => position);
  // The fallback records the old full-read behavior before this API exists,
  // so the first work-bound test fails on actual excess results, not TypeError.
  const scoped = (context: EditContext, declarations: readonly Pick<Declaration, 'property' | 'value'>[]) => {
    const scopedReader = (cascade as typeof cascade & { readProperties?: (node: Element, context: EditContext, declarations: readonly Pick<Declaration, 'property' | 'value'>[]) => CascadeResult }).readProperties;
    return scopedReader ? scopedReader(child, context, declarations) : cascade.read(child, context);
  };
  const equivalent = (context = baseContext(), declarations = childGroups.flatMap(group => group.declarations)) => {
    const restricted = scoped(context, declarations), full = cascade.read(child, context);
    for (const [property, evidence] of Object.entries(restricted.properties)) expect(evidence, property).toEqual(full.properties[property]);
    expect(restricted.issues).toEqual(full.issues);
    const own = sources.overrides(child, childGroups).rules.flatMap(item => item.declarations);
    for (const declaration of own.filter(item => declarations.some(request => request.property === item.property && request.value === item.value))) {
      expect(editEffect(declaration, context, restricted, 'active', undefined, hasActiveOutsideContext(restricted, declaration.id, child))).toEqual(editEffect(declaration, context, full, 'active', undefined, hasActiveOutsideContext(full, declaration.id, child)));
    }
    return restricted;
  };
  return { cascade, scoped, equivalent, expansion, root, parent, child, matches, groups, snapshots, position: (next: number | undefined) => { position = next; } };
}
const group = (declarations: Record<string, string>, context = baseContext()): SessionGroup => ({ context, declarations: Object.entries(declarations).map(([property, value]) => ({ property, value, enabled: true })) });

it('bounds a width effectiveness read to one contribution while retaining the full provenance read', () => {
  const unrelated = Object.fromEntries(Array.from({ length: 180 }, (_, index) => [`--unrelated-${index}`, `${index}px`]));
  const own = group({ width: '512px' }), f = fixture([sheet([rule({ ...unrelated, width: '480px', color: 'red' })])], [own]);
  const restricted = f.scoped(baseContext(), own.declarations);
  expect(Object.keys(restricted.properties)).toEqual(['width']);
  expect(restricted.properties.width.cssforge).toHaveLength(1);
  const full = f.cascade.read(f.child);
  expect(Object.keys(full.properties).length).toBeGreaterThan(180);
  expect(full.properties['--unrelated-179']).toBeDefined();
  f.equivalent();
});

it.each(['margin', 'padding', 'border-color', 'background', 'font'])('retains every actual expanded %s contribution and its effectiveness', property => {
  const own = group({ [property]: 'var(--pending)' }), f = fixture([sheet([rule({ width: '10px', color: 'red' })])], [own]);
  const restricted = f.equivalent();
  expect(Object.keys(restricted.properties).sort()).toEqual(expand(property, 'var(--pending)').map(item => item.property).sort());
  expect(f.expansion).toHaveBeenCalledWith(property, 'var(--pending)');
  expect(Object.values(restricted.properties).every(item => item.confidence === 'unresolved')).toBe(true);
});

it('combines all requested declaration contributions and separates full, scoped and context caches', () => {
  const own = group({ width: '512px', color: 'inherit', margin: '2px' });
  const hover = group({ width: '520px' }, { media: [], pseudo: ':hover' });
  const f = fixture([sheet([rule({ color: 'blue', width: '480px' })])], [own, hover]);
  const first = f.scoped(baseContext(), own.declarations);
  expect(f.scoped(baseContext(), own.declarations)).toBe(first);
  expect(f.scoped(baseContext(), [{ property: 'width', value: '512px' }])).not.toBe(first);
  expect(f.cascade.read(f.child)).not.toBe(first);
  expect(f.scoped(hover.context, hover.declarations)).not.toBe(first);
  f.equivalent(); f.equivalent(hover.context, hover.declarations);
});

it.each(['inherit', 'unset', 'initial', 'revert', 'revert-layer'])('preserves parent evidence and defaulting for %s', value => {
  const own = group({ color: value, width: value, '--token': value });
  const f = fixture([sheet([rule({ color: 'blue', width: '12px', '--token': '3rem' }, { selectorText: '.parent' })])], [own]);
  const result = f.equivalent();
  if (value === 'inherit') expect(result.properties.width.inherited?.declaration?.value).toBe('12px');
  if (value === 'unset') { expect(result.properties.color.inherited?.declaration?.value).toBe('blue'); expect(result.properties.width.defaulting).toBe('initial'); }
});

it.each(['all', 'logical', 'motion', 'registered', 'inaccessible', 'limit', 'layer', 'container'])('retains global and property uncertainty from unrelated %s evidence', kind => {
  const unrelated = kind === 'all' ? rule({ all: 'unset' }) : kind === 'logical' ? rule({ 'margin-inline-start': '2px' }) : kind === 'motion' ? rule({ transition: 'width 1s' })
    : kind === 'registered' ? rule({}, { kind: 'other', cssText: '@property --token { syntax: "<length>"; inherits: true; initial-value: 0px; }' })
    : kind === 'layer' ? rule({ opacity: '1' }, { cssText: '@layer { opacity:1; }', contexts: [{ id: 'layer', kind: 'layer', text: '@layer', matches: null }] })
    : kind === 'container' ? rule({ width: '3px' }, { contexts: [{ id: 'container', kind: 'container', text: '@container (width>2px)', matches: null }] }) : rule({ opacity: '1' });
  const source = sheet([unrelated], kind === 'inaccessible' ? { accessibility: { readable: false, reason: 'security', message: 'blocked' } } : {});
  const own = group({ width: '512px', '--token': '2rem' }), f = fixture([source], [own]);
  if (kind === 'limit') f.snapshots.get(f.child)!.notices.push('Rule inspection limit reached');
  const result = f.equivalent();
  if (kind === 'registered') expect(result.properties['--token'].issues).toContain('registered-custom-property');
  else expect(result.properties.width.confidence).not.toBe('resolved');
});

it('re-evaluates live selector matching and session position after global invalidation', () => {
  const own = group({ width: '512px' }), author = sheet([rule({ width: '600px' }, { selectorText: '.child' }, true)], { order: 500 });
  const f = fixture([author], [own]);
  f.position(1000); expect(f.equivalent().properties.width.winner?.source.kind).toBe('override');
  f.position(100); f.cascade.invalidate(); expect(f.equivalent().properties.width.winner?.source.kind).toBe('style');
  f.matches.enabled = false; f.cascade.invalidate(); expect(f.equivalent().properties.width.winner?.source.kind).toBe('override');
  f.position(undefined); f.cascade.invalidate(); expect(f.equivalent().properties.width.issues).toContain('unsupported-source-order');
});

it('keeps active outside-context media and pseudo competitors in contribution evidence', () => {
  const own = group({ width: '512px' }, { media: ['chosen'], pseudo: '' });
  const outside = rule({ width: '600px' }, { selectorText: '#child:focus', contexts: [{ id: 'media', kind: 'media', text: '@media other', condition: 'other', matches: true }] }, true);
  const f = fixture([sheet([outside])], [own]); f.matches.focus = true;
  const result = f.equivalent(own.context);
  const declaration = result.properties.width.cssforge[0].declaration;
  expect(hasActiveOutsideContext(result, declaration.id, f.child)).toBe(true);
});

it('retains disabled overrides and inactive media without upgrading their evidence', () => {
  const own = group({ width: '512px', padding: '2px' }, { media: ['inactive'], pseudo: '' }); own.declarations[1].enabled = false;
  const f = fixture([sheet([rule({ width: '600px' })])], [own]);
  const result = f.equivalent(own.context);
  expect(result.properties.width.cssforge[0].state).toBe('inactive');
  expect(result.properties['padding-left'].cssforge[0].inactiveReason).toBe('disabled');
});

it.each(['nested inaccessible', 'import', 'unknown supports', 'relative selector', 'functional state selector'])('preserves uncertainty from %s while restricting contributions', kind => {
  const evidence = kind === 'nested inaccessible' ? rule({}, { kind: 'group', children: [rule({ opacity: '1' }, { accessibility: { readable: false, reason: 'security', message: 'blocked group' } })] })
    : kind === 'import' ? rule({}, { kind: 'other', cssText: '@import url("unreadable.css");' })
    : kind === 'unknown supports' ? rule({ width: '600px' }, { contexts: [{ id: 'supports', kind: 'supports', text: '@supports unknown', condition: 'unknown', matches: null }] })
    : rule({ width: '600px' }, { selectorText: kind === 'relative selector' ? '& > .child' : ':is(.child:hover, #other)' });
  const own = group({ width: '512px' }), f = fixture([sheet([evidence])], [own]);
  const result = f.equivalent();
  expect(Object.keys(result.properties)).toEqual(['width']);
  expect(result.properties.width.confidence).toBe(kind === 'import' || kind === 'nested inaccessible' ? 'incomplete' : 'unresolved');
});

it('retains inherited depth-limit uncertainty through the same bounded ancestor chain', () => {
  const own = group({ color: 'inherit' }), f = fixture([sheet([rule({ color: 'inherit' })])], [own]);
  const doc = f.root.getRootNode(), snapshot = f.snapshots.get(f.root)!;
  let previous = f.root;
  for (let index = 0; index < 65; index++) {
    const ancestor = { id: `deep-${index}`, parentElement: null, getRootNode: () => doc, matches: () => true } as unknown as Element;
    Object.assign(previous, { parentElement: ancestor }); f.snapshots.set(ancestor, snapshot); previous = ancestor;
  }
  const result = f.equivalent();
  expect(Object.keys(result.properties)).toEqual(['color']);
  expect(result.properties.color.issues).toContain('source-limit');
  expect(result.properties.color.confidence).toBe('incomplete');
});
