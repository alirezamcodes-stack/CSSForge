import { describe, it, expect } from 'vitest';
import { numericToken, valueModel, convertValue, unitsFor, stepNumeric, unitStep, formatNumber, type ValueProperty } from '../src/editing/values';
import { editorValue } from '../src/editing/properties';
const context = { rootFont:16,parentFont:20,elementFont:32,viewportWidth:1000,viewportHeight:800 };
describe('shared CSS value model', () => {
  it.each(['px','%','em','rem','vw','vh','vmin','vmax','ch','deg','rad','turn','ms','s',''])('parses %s and retains its representation', unit => {
    expect(numericToken(`-1.25${unit}`)).toEqual({amount:-1.25,unit});
  });
  it.each(['2rem','50%','calc(100% - 2rem)','var(--size)','auto','normal','inherit','initial','unset','revert','fit-content','min-content','max-content'])('preserves editor value %s separately from browser reference', value => {
    const model = valueModel('width',editorValue('width','32px',value),'32px');
    expect(model.editorValue).toBe(value); expect(model.computedValue).toBe('32px');
    if (!numericToken(value)) { expect(model.canConvert).toBe(false); expect(stepNumeric(value,1)).toBeNull(); }
  });
  it.each([
    ['width','32px','rem','2rem'], ['width','2rem','px','32px'],
    ['width','32px','em','1em'], ['width','1em','px','32px'],
    ['font-size','20px','em','1em'], ['font-size','1em','px','20px'],
    ['width','500px','vw','50vw'], ['width','50vw','px','500px'],
    ['height','400px','vh','50vh'], ['height','50vh','px','400px'],
    ['width','400px','vmin','50vmin'], ['width','500px','vmax','50vmax'],
    ['gradient-angle','180deg','rad','3.141593rad'], ['gradient-angle',`${Math.PI}rad`,'deg','180deg'],
    ['gradient-angle','180deg','turn','0.5turn'], ['gradient-angle','0.5turn','deg','180deg'],
    ['time','1000ms','s','1s'], ['time','1s','ms','1000ms'],
    ['line-height','1.5','px','48px'], ['line-height','48px','','1.5'],
    ['line-height','48px','%','150%'], ['font-size','20px','%','100%'],
    ['opacity','0.5','%','50%'], ['opacity','50%','','0.5'],
  ])('converts %s %s to %s with a known basis', (property,value,unit,expected) => {
    expect(convertValue(property as ValueProperty,value,unit,context)).toEqual({ok:true,value:expected});
  });
  it('rejects ambiguous, unsupported and non-scalar conversions without fabricating numbers', () => {
    for (const [property,value,unit] of [['width','32px','%'],['width','1ch','px'],['border-width','1px','%'],['width','calc(100% - 1px)','rem'],['width','var(--w)','px'],['width','auto','px'],['time','1s','px']]) expect(convertValue(property as ValueProperty,value,unit,context).ok).toBe(false);
    expect(convertValue('width','16px','rem').ok).toBe(false);
    expect(convertValue('width','1e308rem','px',context).ok).toBe(false);
    expect(convertValue('width','16px','rem',{rootFont:-16}).ok).toBe(false);
    expect(convertValue('width','16px','rem',{...context,referenceValue:'200px'}).ok).toBe(false);
    expect(convertValue('width','16px','rem',{...context,referenceValue:'16px'})).toEqual({ok:true,value:'1rem'});
    expect(convertValue('width','32px','%',{...context,percentBasis:400})).toEqual({ok:true,value:'8%'});
  });
  it('maps units by property and keeps zero and sensible step precision', () => {
    expect(unitsFor('shadow-length')).toEqual(['px','em','rem']);
    expect(unitsFor('border-radius')).toEqual(['px','%','em','rem']);
    expect(unitsFor('letter-spacing')).not.toContain('%'); expect(unitsFor('padding-top')).not.toContain('deg');
    expect(unitsFor('width')).toContain('ch'); expect(unitsFor('z-index')).toEqual(['']);
    expect(convertValue('width','0','rem')).toEqual({ok:true,value:'0rem'});
    expect(convertValue('width','0px','')).toEqual({ok:true,value:'0'});
    expect(convertValue('width','0px','px')).toEqual({ok:true,value:'0px'});
    expect(stepNumeric('2rem',unitStep('width','rem'))).toBe('2.1rem');
    expect(stepNumeric('40%',unitStep('width','%'))).toBe('41%');
    expect(stepNumeric('1.5em',unitStep('width','em'))).toBe('1.6em');
    expect(formatNumber(1.0000000003)).toBe('1'); expect(numericToken('1e2px')).toEqual({amount:100,unit:'px'});
    expect(formatNumber(200.000002,'px')).toBe('200');
  });
});
