import { describe, it, expect, vi } from 'vitest';
import { editorValue, normalizeValue, validateValue } from '../src/editing/properties';

describe('Design value boundary', () => {
  it('adds px to nonzero bare lengths and preserves unitless zero', () => {
    expect(normalizeValue('padding-left', ' 0 ')).toBe('0');
    expect(normalizeValue('margin-top', '-12.5')).toBe('-12.5px');
    expect(normalizeValue('width', '.5')).toBe('.5px');
  });
  it('preserves explicit units, functions and keywords', () => {
    for (const value of ['2em', '15%', 'auto', 'calc(100% - 2rem)']) expect(normalizeValue('width', value)).toBe(value);
    expect(normalizeValue('line-height', '1.5')).toBe('1.5');
    expect(normalizeValue('font-weight', '700')).toBe('700');
  });
  it('keeps computed, inline editor tokens and overrides conceptually separate', () => {
    expect(editorValue('padding-left', '32px', '2em')).toBe('2em');
    expect(editorValue('padding-left', '32px', '2em', '3rem')).toBe('3rem');
    expect(editorValue('padding-left', '32px', '')).toBe('32px');
    expect(editorValue('color', 'rgb(0, 0, 0)', 'var(--text)')).toBe('var(--text)');
  });
  it('rejects property and declaration injection before asking CSS.supports', () => {
    const supports = vi.fn(() => true);
    for (const [property, value] of [['behavior', 'url(https://example.com)'], ['color', 'red; display:none'], ['width', '20px !important'], ['color', 'red}body{display:none'], ['color', ''], ['width', '1\npx']]) expect(validateValue(property, value, supports)).toBe(false);
    expect(supports).not.toHaveBeenCalled();
  });
  it('uses browser validation and retains valid CSS color syntax', () => {
    expect(validateValue('color', 'oklch(70% 0.1 150)', () => true)).toBe(true);
    expect(validateValue('padding-top', '-4px', () => false)).toBe(false);
  });
});
