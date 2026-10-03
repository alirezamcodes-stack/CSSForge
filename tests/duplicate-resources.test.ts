import { describe, expect, it, vi } from 'vitest';
import { inlineStyleHasResourceURL } from '../src/editing/dom/resources';

// CSSOM-shaped oracle isolates token traversal; native browser cases prove acceptance
// and normalization. These are the native URL-name results from the detached CSSOM probe.
function declaration(normalized: string) {
  let text = '', value = '';
  const setProperty = vi.fn((_property: string, input: string) => {
    const name = input.slice(0, input.indexOf('("data:,"'));
    value = new Set(['url', 'URL', 'u\\72l', 'U\\000072 L', '\\75\\72\\6c']).has(name) ? 'url("data:,")' : '';
  });
  const writes: string[] = [];
  return { writes, setProperty, style: {
    get cssText() { return text; },
    set cssText(input: string) { writes.push(input); text = input ? normalized : ''; value = ''; },
    setProperty, getPropertyValue: () => value,
  } as unknown as CSSStyleDeclaration };
}

describe('Duplicate semantic inline CSS resource policy', () => {
  it.each([
    'background-image: url("data:,x");',
    'background-image: URL("data:,x");',
    '--image: u\\72l("data:,x");',
    '--image: U\\000072 L("data:,x");',
    '--image: \\75\\72\\6c("data:,x");',
    'background-image: var(--image, u\\72l("data:,x"));',
    '--image: image-set(url("data:,x") 1x);',
    '--unused: url("data:,x");',
  ])('refuses parsed URL functions in %s', normalized => {
    const d = declaration(normalized);
    expect(inlineStyleHasResourceURL(normalized, d.style)).toBe(true);
    expect(d.setProperty).toHaveBeenCalledWith('background-image', expect.stringContaining('("data:,"'));
  });
  it.each([
    'color: red; font-size: 18px;',
    'content: "url(data:,x)";',
    '--label: "u\\72l(data:,x)";',
    '--label: url ("data:,x");',
    '--label: url/**/("data:,x");',
    '--label: prefixurl("data:,x");',
    '--label: /* url(data:,x) */ red;',
  ])('does not mistake strings, comments or non-URL tokens in %s', normalized => {
    const d = declaration(normalized);
    expect(inlineStyleHasResourceURL(normalized, d.style)).toBe(false);
  });
  it('uses only native accepted declarations, without writing normalization to the source', () => {
    const raw = 'color:url("data:,ignored");color:red', d = declaration('color: red;');
    expect(inlineStyleHasResourceURL(raw, d.style)).toBe(false);
    expect(d.writes[0]).toBe(raw); expect(d.setProperty).not.toHaveBeenCalled();
  });
  it('does not let an ignored declaration mask a different accepted resource declaration', () => {
    const d = declaration('background-image: url("data:,accepted"); color: red;');
    expect(inlineStyleHasResourceURL('color:url("data:,ignored");background-image:u\\72l("data:,accepted")', d.style)).toBe(true);
  });
});
