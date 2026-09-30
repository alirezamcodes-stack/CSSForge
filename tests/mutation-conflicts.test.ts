import { describe, expect, it } from 'vitest';
import { mutationScope } from '../src/engine/mutation/scope';
import { createAuthorLedger, mutationLimits, type AuthorChange, type MutationTarget } from '../src/engine/mutation';

function scopeFixture(matches: string[][]) {
  const nodes = matches.map(branches => ({ matches: (selector: string) => {
    if (selector === 'invalid[') throw new SyntaxError();
    return branches.includes(selector);
  } }));
  const doc = { createTreeWalker: () => { let index = 0; return { nextNode: () => nodes[index++] ?? null }; } } as unknown as Document;
  return (selector: string, adopted = false) => mutationScope(doc, doc, selector, adopted);
}

describe('whole-rule mutation scope', () => {
  it('unions normal branches and deduplicates recipients', () => {
    const scope = scopeFixture([['#target','.button'],['.button']]);
    expect(scope('#target, .button')).toEqual({kind:'shared-rule',matchedCount:2,bounded:true,risk:'shared'});
    expect(scopeFixture([['#target','.button']])('#target, .button').matchedCount).toBe(1);
  });
  for (const suffix of [':hover',':focus',':active','::before','::after']) it(`bounds ${suffix} potential origins without claiming complete local scope`, () => {
    const scope = scopeFixture([['#target'],['.other']]);
    expect(scope(`#target, .other${suffix}`)).toEqual({kind:'unknown',matchedCount:2,bounded:true,risk:'unknown'});
  });
  it('keeps unsupported and nested state selectors conservative', () => {
    const scope = scopeFixture([['#target']]);
    for (const branch of ['.other:focus-visible','.other:visited','.other::first-line',':is(.other:hover)', 'invalid[']) {
      expect(scope(`#target, ${branch}`)).toMatchObject({kind:'unknown',matchedCount:1,risk:'unknown'});
    }
  });
  it('enumerates universal and descendant terminal-state origins conservatively', () => {
    const scope = scopeFixture([['*','#parent > *'],['*','#parent > *']]);
    expect(scope(':hover')).toMatchObject({kind:'unknown',matchedCount:2});
    expect(scope('#parent > :focus')).toMatchObject({kind:'unknown',matchedCount:2});
  });
  it('preserves adopted scope even when a selector has one local recipient', () => {
    expect(scopeFixture([['#target']])('#target',true)).toMatchObject({kind:'unknown',bounded:false,risk:'unknown'});
  });
  it('reports element scan exhaustion rather than an exact count', () => {
    const scope = scopeFixture(Array.from({length:mutationLimits.scopeElements+1},()=>['.button']));
    expect(scope('.button')).toEqual({kind:'unknown',matchedCount:mutationLimits.scopeElements,bounded:false,risk:'unknown'});
  });
  it('bounds branch count and selector size before enumeration', () => {
    const scope = scopeFixture([['#target']]);
    expect(scope(Array(mutationLimits.scopeBranches+1).fill('#target').join(','))).toMatchObject({kind:'unknown',bounded:false});
    expect(scope('a'.repeat(mutationLimits.scopeSelectorLength+1))).toMatchObject({kind:'unknown',bounded:false});
  });
});

describe('document-scoped recovery lifecycle', () => {
  it('reattaches the same live ownership store without duplicating its records', () => {
    const doc = {documentElement:{}} as Document, ledger = createAuthorLedger(doc);
    const first = ledger.attach(doc), change = {state:'blocked'} as AuthorChange;
    first.changes.add(change); first.advance();
    const next = ledger.attach(doc);
    expect(next.changes).toBe(first.changes); expect(next.issued).toBe(first.issued); expect(next.session).toBe(first.session);
    expect(next.generation()).toBe(1); expect([...next.changes]).toEqual([change]);
  });
  it('explicit document loss retires records and releases native capability references', () => {
    const doc = {documentElement:{}} as Document, ledger = createAuthorLedger(doc), first = ledger.attach(doc);
    const change = {state:'blocked'} as AuthorChange, target = {} as MutationTarget;
    first.changes.add(change); first.issued.set(target, {} as never);
    ledger.retire('Navigation');
    expect(change).toMatchObject({state:'retired',reason:'Navigation'});
    expect(ledger.getSnapshot()).toMatchObject({state:'retired',pending:0,retiredCount:1,reason:'Navigation'});
    const next = ledger.attach(doc);
    expect(next.issued.has(target)).toBe(false); expect(next.session).not.toBe(first.session); expect(ledger.current(first.session)).toBe(false);
  });
  it('detects document.open-style root replacement even when Document identity is unchanged', () => {
    const doc = {documentElement:{}} as Document, ledger = createAuthorLedger(doc), first = ledger.attach(doc);
    first.changes.add({state:'blocked'} as AuthorChange);
    Object.defineProperty(doc,'documentElement',{value:{}});
    expect(ledger.current(first.session)).toBe(false); expect(first.changes.size).toBe(0);
    expect(ledger.getSnapshot()).toMatchObject({state:'retired',reason:'Document tree was replaced.'});
  });
  it('refuses to import records into a different document', () => {
    const doc = {documentElement:{}} as Document, ledger = createAuthorLedger(doc);
    expect(()=>ledger.attach({documentElement:{}} as Document)).toThrow('another document');
  });
});
