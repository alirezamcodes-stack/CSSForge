import { describe, expect, it, vi } from 'vitest';
import { createAuthorMutation, declarationNames, type MutationTarget } from '../src/engine/mutation';
import type { SourceIndex } from '../src/engine/sources';
import type { TargetLifecycle } from '../src/picker/targetLifecycle';

function engine(valid = false) {
  const read = vi.fn(), changed = vi.fn();
  const doc = { createElement: () => ({ style: {} }) } as unknown as Document;
  const mutation = createAuthorMutation(doc, { read } as unknown as SourceIndex, { valid: () => valid } as unknown as TargetLifecycle, changed);
  return { mutation, read, changed };
}
describe('author mutation authorization boundary', () => {
  it('rejects fabricated mutation targets before touching native CSSOM or source analysis', () => {
    const { mutation, read, changed } = engine();
    const style = { setProperty: vi.fn() };
    const result = mutation.apply({ binding: { style } } as unknown as MutationTarget, '32px');
    expect(result.state).toBe('fallback'); expect(style.setProperty).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
  });
  it('rejects invalid roots/targets before reading authored sources', () => {
    const { mutation, read } = engine();
    expect(mutation.mutate({ element: {} as Element, property: 'color', value: 'red', context: {media:[],pseudo:''} }).state).toBe('fallback');
    expect(read).not.toHaveBeenCalled();
  });
  it('rejects property injection before native CSSOM/provenance reads', () => {
    const { mutation, read } = engine(true);
    for (const property of ['color;display', 'font-size}', '--token\n', 'COLOR']) expect(mutation.mutate({element:{} as Element,property,value:'red',context:{media:[],pseudo:''}}).state).toBe('fallback');
    expect(read).not.toHaveBeenCalled();
  });
  it('retains exact declaration names instead of fabricating expanded longhand provenance', () => {
    const style = { cssText: 'margin: 1px 2px; --token: "a;b:c"; color: var(--token);' } as CSSStyleDeclaration;
    expect(declarationNames(style)).toEqual(['margin','--token','color']);
    expect(declarationNames(style)).not.toContain('margin-top');
  });
  it('cannot roll back a transaction from a different mutation engine', () => {
    const { mutation, read, changed } = engine();
    expect(mutation.rollback({} as never)).toBe(false); expect(read).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
  });
});
