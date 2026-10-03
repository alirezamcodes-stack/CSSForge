import { expect, it } from 'vitest';
import { backgroundLayers, hiddenImage, originalImage, parseGradient, parseShadow, readFilter, safeImageURL, serializeGradient, serializeShadow, splitCSS, updateFilter } from '../src/editing/rich';
import { contextKey } from '../src/editing/contexts';

it('splits layers without splitting colors, gradients or quoted URLs', () => {
  expect(splitCSS('linear-gradient(90deg, rgb(0, 0, 0), white), url("/a,b.png")')).toHaveLength(2);
  expect(splitCSS('drop-shadow(0 2px 4px rgb(0, 0, 0)) blur(2px)', ' ')).toHaveLength(2);
});
it('round trips linear and radial stops with explicit positions', () => {
  for (const value of ['linear-gradient(90deg, rgb(0, 0, 0) 0%, white 100%)', 'radial-gradient(circle at center, red 10%, blue 90%)']) expect(serializeGradient(parseGradient(value)!)).toBe(value);
  expect(parseGradient('url("a.png")')).toBeNull();
  expect(parseGradient('linear-gradient(90deg, red 0% 20%, 45%, blue 100%)')).toBeNull();
  expect(parseGradient('linear-gradient(90deg, red 0%, 45%, blue 100%)')).toBeNull();
  expect(parseGradient('linear-gradient(90deg, red 0% 20%, blue 100%)')).toBeNull();
});
it('preserves background lists with cycling companion values', () => {
  const layers = backgroundLayers({ image: 'url("a.png"), linear-gradient(red, blue)', position: 'center', size: 'cover, 50%', repeat: 'no-repeat' });
  expect(layers[1]).toEqual({ image: 'linear-gradient(red, blue)', position: 'center', size: '50%', repeat: 'no-repeat' });
});
it('preserves color-space interpolation gradients outside the simple stop editor', () => {
  for (const value of ['linear-gradient(in oklab, red, blue)', 'linear-gradient(45deg in hsl longer hue, red, blue)', 'radial-gradient(circle at center in srgb, red, blue)']) expect(parseGradient(value)).toBeNull();
});
it('hidden layer tokens retain the exact original image for undo and showing', () => {
  const original = 'linear-gradient(135deg, rgb(1, 2, 3), #abc)';
  expect(originalImage(hiddenImage(original))).toBe(original);
  expect(splitCSS(`${hiddenImage(original)}, url("x,y.png")`)).toHaveLength(2);
});
it('parses browser and authored shadows without dropping inset/spread/colors', () => {
  const shadow = parseShadow('rgba(0, 0, 0, 0.2) 1px 2px 3px 4px inset')!;
  expect(shadow).toEqual({ x: '1px', y: '2px', blur: '3px', spread: '4px', color: 'rgba(0, 0, 0, 0.2)', inset: true });
  expect(serializeShadow(shadow)).toBe('inset 1px 2px 3px 4px rgba(0, 0, 0, 0.2)');
  expect(parseShadow('0 4px 3px #0005', true)?.color).toBe('#0005');
});
it('updating a filter preserves function order and unsupported functions', () => {
  expect(updateFilter('hue-rotate(30deg) drop-shadow(0 1px 2px red) contrast(1.2)', 'contrast', 150, '%')).toBe('hue-rotate(30deg) drop-shadow(0 1px 2px red) contrast(150%)');
  expect(updateFilter('blur(2px)', 'sepia', 20, '%')).toBe('blur(2px) sepia(20%)');
  expect(readFilter('contrast(1.2)', 'contrast', 100, '%').value).toBe(120);
  expect(readFilter('blur(1px) blur(2px)', 'blur', 0, 'px').editable).toBe(false);
});
it('accepts only explicit HTTP(S) image destinations', () => {
  expect(safeImageURL('/image.png', 'https://example.com/path')).toBe('url("https://example.com/image.png")');
  for (const input of ['', 'javascript:alert(1)', 'file:///secret', 'data:text/html,abc']) expect(safeImageURL(input, 'https://example.com')).toBeNull();
});
it('context identities distinguish base, media, state and their combinations', () => {
  const keys = [{ media: [], pseudo: '' }, { media: ['(min-width: 1000px)'], pseudo: '' }, { media: [], pseudo: ':hover' }, { media: ['(min-width: 1000px)'], pseudo: ':hover' }].map(context => contextKey(context as Parameters<typeof contextKey>[0]));
  expect(new Set(keys).size).toBe(4);
});
