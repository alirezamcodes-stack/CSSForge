import { expect, it, vi } from 'vitest';
import { matchingContexts } from '../src/editing/readable';

it('reads terminal states without requiring hover activation', () => {
  const element = { matches: vi.fn((selector: string) => selector === '.primary') } as unknown as Element;
  expect(matchingContexts(element, '.primary:hover, .primary::before').map(match => match.context.pseudo)).toEqual([':hover', '::before']);
  expect(matchingContexts(element, '.other:hover')).toEqual([]);
});
it('does not reinterpret descendant state selectors as states on their ancestor', () => {
  const matches = vi.fn((_selector: string) => false);
  matchingContexts({ matches } as unknown as Element, '.card :hover, .card > ::before');
  expect(matches.mock.calls.map(call => call[0])).toEqual(['.card *', '.card > *']);
});
it('keeps complex selector matches read-only and catches unsupported selectors', () => {
  const element = { matches: (selector: string) => { if (selector === '&broken') throw new Error('selector'); return true; } } as unknown as Element;
  expect(matchingContexts(element, ':is(.primary, .secondary):hover')[0].editable).toBe(false);
  expect(matchingContexts(element, '&broken')).toEqual([]);
});
