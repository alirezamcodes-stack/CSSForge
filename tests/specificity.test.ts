import { expect, it } from 'vitest';
import { compareSpecificity, selectorSpecificities, specificity } from '../src/engine/cascade/specificity';

it.each([
  ['*', [0, 0, 0]], ['button', [0, 0, 1]], ['.card', [0, 1, 0]], ['#checkout', [1, 0, 0]],
  ['main#app .card.primary[data-mode="x"] > button:hover', [1, 4, 2]],
  [':is(.card, #app) button', [1, 0, 1]], [':not(.a, section#app)', [1, 0, 1]],
  [':where(#app .card):hover', [0, 1, 0]], ['article:has(> #target, .other)', [1, 0, 1]],
  ['.card::before', [0, 1, 1]], ['p:before', [0, 0, 2]],
  [':is(:where(#x), :not(.a, .b))', [0, 1, 0]],
  [':nth-child(2n + 1 of .a, #b)', [1, 1, 0]], [':nth-last-child(odd of :is(#x, .a))', [1, 1, 0]],
  [':nth-child(2n+1)', [0, 1, 0]], ['svg|a[*|href]', [0, 1, 1]], ['*|*', [0, 0, 0]], ['|button', [0, 0, 1]],
  ['[data-text="x,):is(#x)"]', [0, 1, 0]], ['.foo\\:bar', [0, 1, 0]], ['#\\31 23', [1, 0, 0]],
  ['::slotted(.card)', [0, 1, 1]], [':host(.card)', [0, 2, 0]], ['div/* ignored */.a', [0, 1, 1]],
] as const)('calculates structured specificity for %s', (selector, expected) => expect(specificity(selector)).toEqual(expected));
it('keeps selector-list branch weights distinct, including attribute commas', () => {
  expect(selectorSpecificities('p, .card[data-x="a,b"], #app').map(item => item.specificity)).toEqual([[0, 0, 1], [0, 2, 0], [1, 0, 0]]);
});
it('compares lexicographically without decimal-score collisions', () => {
  expect(compareSpecificity([1, 0, 0], [0, 100, 100])).toBeGreaterThan(0);
  expect(compareSpecificity([0, 1, 0], [0, 0, 100])).toBeGreaterThan(0);
});
it.each(['& .card', ':unknown-function(.a)', ':is(.a', '', '#', 'p, .card'])('does not guess for unsupported or incomplete selector %s', selector => expect(specificity(selector)).toBeNull());
