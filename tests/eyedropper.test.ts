import { afterEach, describe, expect, it, vi } from 'vitest';
import { isEyeDropperPending, normalizeSample, sampleNativeColor, supportsEyeDropper } from '../src/platform/eyedropper';
import { colorToken } from '../src/ui/shared/ColorControl';

afterEach(() => vi.unstubAllGlobals());
describe('native platform boundary', () => {
  it.each([undefined, null, {}, {sRGBHex: '#fff'}, {sRGBHex:'#123456ff'}, {sRGBHex:'rgb(1,2,3)'}, {sRGBHex:'#123456;'}, {sRGBHex:123}, {sRGBHex:' #123456'}])('rejects malformed result %j', value => expect(normalizeSample(value)).toBeNull());
  it('normalizes only the opaque sRGB result', () => {
    expect(normalizeSample({sRGBHex:'#AB12EF', alpha:.2, sourceElement:'ignored'})).toBe('#ab12ef');
    expect(colorToken('#ab12ef','HEX')).toBe('#ab12efff');
    expect(colorToken('#ab12ef','RGB')).toBe('rgb(171, 18, 239)');
    expect(colorToken('#ab12ef','HSL')).toMatch(/^hsl\(/);
  });
  it('feature detects absent and nonconstructing globals without opening', async () => {
    vi.stubGlobal('EyeDropper',undefined); expect(supportsEyeDropper()).toBe(false);
    expect(await sampleNativeColor(new AbortController().signal)).toEqual({state:'unsupported'});
    vi.stubGlobal('EyeDropper',{}); expect(supportsEyeDropper()).toBe(false);
  });
  it('calls native open synchronously and forwards the exact abort signal', async () => {
    let calls=0; const abort=new AbortController();
    vi.stubGlobal('EyeDropper',class {open(options:{signal:AbortSignal}) {calls++; expect(options.signal).toBe(abort.signal); return Promise.resolve({sRGBHex:'#123ABC'});}});
    const result=sampleNativeColor(abort.signal); expect(calls).toBe(1); expect(isEyeDropperPending()).toBe(true);
    expect(await result).toEqual({state:'success',color:'#123abc'}); expect(isEyeDropperPending()).toBe(false);
  });
  it.each(['AbortError','NotAllowedError','InvalidStateError','OperationError'])('classifies %s without leaking raw error text', async name => {
    vi.stubGlobal('EyeDropper',class {open() {return Promise.reject(new DOMException('raw implementation detail',name));}});
    expect(await sampleNativeColor(new AbortController().signal)).toEqual({state:name==='AbortError'?'cancelled':'failed'});
    expect(isEyeDropperPending()).toBe(false);
  });
  it('handles synchronous construction failure and releases ownership', async () => {
    vi.stubGlobal('EyeDropper',class {constructor(){throw Error('private')}});
    expect(await sampleNativeColor(new AbortController().signal)).toEqual({state:'failed'}); expect(isEyeDropperPending()).toBe(false);
  });
  it('rejects malformed native success',async()=>{
    vi.stubGlobal('EyeDropper',class {open(){return Promise.resolve({sRGBHex:'#12345680'});}});
    expect(await sampleNativeColor(new AbortController().signal)).toEqual({state:'failed'});
  });
  it('bounds overlap, aborts ownership and ignores late older success without releasing a newer request',async()=>{
    const resolves:Array<(value:unknown)=>void>=[];
    vi.stubGlobal('EyeDropper',class {open(){return new Promise(resolve=>resolves.push(resolve));}});
    const first=new AbortController(), second=new AbortController();
    const old=sampleNativeColor(first.signal); expect(await sampleNativeColor(second.signal)).toEqual({state:'busy'}); expect(resolves).toHaveLength(1);
    first.abort(); const next=sampleNativeColor(second.signal); expect(resolves).toHaveLength(2);
    resolves[0]({sRGBHex:'#ffffff'}); expect(await old).toEqual({state:'cancelled'}); expect(isEyeDropperPending()).toBe(true);
    resolves[1]({sRGBHex:'#123456'}); expect(await next).toEqual({state:'success',color:'#123456'}); expect(isEyeDropperPending()).toBe(false);
    expect(await sampleNativeColor(first.signal)).toEqual({state:'cancelled'});
  });
});
