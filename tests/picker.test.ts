import { describe, expect, it, vi } from 'vitest';
import { identityOf, dimensions, fontSummary } from '../src/picker/identity';
import { frameGate } from '../src/picker/frame';
import { supportedPage } from '../src/picker/supportedPage';

describe('picker display data', () => {
  const element = (tag: string, id: string, classes: string[]) => ({ localName: tag, id, classList: classes as unknown as DOMTokenList });
  it('provides compact identity without claiming a unique selector', () => {
    expect(identityOf(element('button', 'checkout', ['primary', 'wide', 'third']))).toBe('button#checkout.primary.wide');
    expect(identityOf(element('svg', '', []))).toBe('svg');
  });
  it('bounds pathological labels and neutralizes directional/control characters', () => {
    const text = identityOf(element('div', '\u202eunsafe\u0000', ['x'.repeat(500)]));
    expect(text).not.toMatch(/[\u202e\u0000]/);
    expect(text.length).toBeLessThanOrEqual(85);
    expect(text).toContain('…');
    expect(identityOf(element('div', '<img>', ['a:b']))).toBe('div#<img>.a:b'); // text, never innerHTML
  });
  it('formats fractional dimensions and computed font stacks', () => {
    expect(dimensions({ x: -20, y: 0, width: 993, height: 585.876 })).toBe('993 × 585.88');
    expect(fontSummary('"Times New Roman", serif')).toBe('Times New Roman');
  });
});
describe('frame gating', () => {
  it('coalesces a thousand updates into one paint and permits a later frame', () => {
    const paint = vi.fn(); let callback: FrameRequestCallback = () => {};
    const request = vi.fn((cb: FrameRequestCallback) => { callback = cb; return 1; });
    const gate = frameGate(paint, request, vi.fn());
    for (let i = 0; i < 1000; i++) gate.schedule();
    expect(request).toHaveBeenCalledTimes(1); expect(paint).not.toHaveBeenCalled();
    callback(0); expect(paint).toHaveBeenCalledTimes(1);
    gate.schedule(); expect(request).toHaveBeenCalledTimes(2);
  });
  it('cancels pending work idempotently', () => {
    const cancel = vi.fn(); const gate = frameGate(vi.fn(), () => 42, cancel);
    gate.schedule(); gate.cancel(); gate.cancel();
    expect(cancel).toHaveBeenCalledExactlyOnceWith(42);
  });
});
describe('supported pages', () => {
  it('allows ordinary HTTP(S) without broad host access', () => {
    expect(supportedPage('https://example.org/page')).toBe(true);
    expect(supportedPage('http://localhost:5173')).toBe(true);
  });
  it('rejects browser pages, malformed URLs and both Chrome store addresses', () => {
    for (const url of ['chrome://extensions', 'about:blank', 'file:///test.html', 'not a url', 'https://chromewebstore.google.com/detail/id', 'https://chrome.google.com/webstore/detail/id']) expect(supportedPage(url)).toBe(false);
  });
});
