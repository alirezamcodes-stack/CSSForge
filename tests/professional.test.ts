import { it, expect } from 'vitest';
import { numericToken, stepNumeric } from '../src/ui/shared/NumericScrubber';
import { colorToken } from '../src/ui/shared/ColorControl';
import { boxPresets, textPresets, backgroundPresets } from '../src/editing/presets';
import { hiddenShadow, originalShadow, readFilter, updateFilter } from '../src/editing/rich';
it('numeric stepping retains authored units, fine precision and limits', () => {
  expect(stepNumeric('2em', .1)).toBe('2.1em'); expect(stepNumeric('14px', 10)).toBe('24px');
  expect(stepNumeric('0px', -1, '', 0)).toBe('0px'); expect(stepNumeric('99%', 10, '', 0, 100)).toBe('100%');
  expect(stepNumeric('calc(100% - 2px)', 1)).toBeNull(); expect(numericToken('-0.2rem')).toEqual({ amount:-.2, unit:'rem' });
});
it('color formats preserve alpha and reject malformed tokens', () => {
  expect(colorToken('#ff000080')).toBe('#ff000080'); expect(colorToken('rgb(255 0 0 / 50%)', 'RGB')).toBe('rgba(255, 0, 0, 0.5)');
  expect(colorToken('hsl(120 100% 50% / 50%)')).toBe('#00ff0080'); expect(colorToken('broken-color')).toBeNull();
});
it('curated presets have descriptive unique names and bounded useful collections', () => {
  expect(backgroundPresets).toHaveLength(28); expect(boxPresets).toHaveLength(15); expect(textPresets).toHaveLength(8);
  for (const presets of [backgroundPresets,boxPresets,textPresets]) { expect(new Set(presets.map(item => item.name)).size).toBe(presets.length); expect(presets.every(item => !/^#|preset \d/i.test(item.name) && item.css.length > 0)).toBe(true); }
});
it('hidden shadows round trip exact source and hue edits preserve other functions', () => {
  const shadow = 'inset 1px -2px 4px 3px rgba(1, 2, 3, .4)'; expect(originalShadow(hiddenShadow(shadow))).toBe(shadow);
  expect(readFilter('blur(2px) hue-rotate(-20deg)', 'hue-rotate', 0, 'deg')).toEqual({ value:-20, editable:true });
  expect(updateFilter('blur(2px) hue-rotate(-20deg) contrast(1.3)', 'hue-rotate', 90, 'deg')).toBe('blur(2px) hue-rotate(90deg) contrast(1.3)');
});
