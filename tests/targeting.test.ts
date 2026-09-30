import { describe, expect, it } from 'vitest';
import { createTargetLifecycle } from '../src/picker/targetLifecycle';
import { supportsSize } from '../src/editing/capabilities';

describe('session target identity', () => {
  function fixture() {
    const doc = { defaultView: { ShadowRoot: class {} } } as unknown as Document;
    const element = { isConnected: true, ownerDocument: doc, localName: 'div', hasAttribute: () => false, getRootNode: () => doc } as unknown as Element;
    return { doc, element, lifecycle: createTargetLifecycle(doc, () => false) };
  }
  it('rejects disconnected targets and same-ID object substitutes', () => {
    const { element, lifecycle } = fixture(), identity = lifecycle.bind(element);
    expect(lifecycle.safe(identity)).toBe(true);
    expect(lifecycle.safe({ ...identity, element: { ...element } as Element })).toBe(false);
    Object.assign(element, { isConnected: false });
    expect(lifecycle.safe(identity)).toBe(false); expect(lifecycle.valid(element)).toBe(false);
  });
  it('rejects a changed document/root and another editing session', () => {
    const { doc, element, lifecycle } = fixture(), identity = lifecycle.bind(element);
    expect(createTargetLifecycle(doc, () => false).safe(identity)).toBe(false);
    Object.assign(element, { getRootNode: () => ({}) }); expect(lifecycle.safe(identity)).toBe(false);
    Object.assign(element, { getRootNode: () => doc, ownerDocument: {} }); expect(lifecycle.safe(identity)).toBe(false);
  });
  it('requires a new explicit binding after quarantine and invalidates on destroy', () => {
    const { element, lifecycle } = fixture(), identity = lifecycle.bind(element);
    lifecycle.forget(identity); expect(lifecycle.safe(identity)).toBe(false);
    const next = lifecycle.bind(element); expect(next).not.toBe(identity); expect(lifecycle.safe(next)).toBe(true);
    lifecycle.destroy(); expect(lifecycle.safe(next)).toBe(false);
  });
});
describe('conservative existing size capabilities', () => {
  const svg = (localName: string) => ({ localName, namespaceURI: 'http://www.w3.org/2000/svg' });
  it('allows rect and svg sizing without enabling unrelated SVG shapes', () => {
    for (const tag of ['svg', 'rect', 'image', 'foreignObject']) expect(supportsSize(svg(tag), 'inline')).toBe(true);
    for (const tag of ['circle', 'path', 'use', 'text']) expect(supportsSize(svg(tag), 'inline')).toBe(false);
  });
  it('preserves HTML inline/replaced rules and rejects non-rendered boxes', () => {
    const html = (localName: string) => ({ localName, namespaceURI: 'http://www.w3.org/1999/xhtml' });
    expect(supportsSize(html('span'), 'inline')).toBe(false); expect(supportsSize(html('button'), 'inline')).toBe(true);
    expect(supportsSize(html('div'), 'block')).toBe(true);
    expect(supportsSize(svg('rect'), 'none')).toBe(false); expect(supportsSize(html('div'), 'contents')).toBe(false);
  });
});
