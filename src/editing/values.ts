import type { Property } from './properties';

export type ValueProperty = Property | 'shadow-length' | 'gradient-angle' | 'gradient-stop' | 'rotate' | 'time';
export type ConversionContext = { rootFont?: number; parentFont?: number; elementFont?: number; viewportWidth?: number; viewportHeight?: number; percentBasis?: number; percentReason?: string; referenceValue?: string };
export type NumericValue = { amount: number; unit: string };
export type ValueReference = { kind:'shadow'; property:'box-shadow' | 'text-shadow'; index:number; component:'x' | 'y' | 'blur' | 'spread' } | { kind:'gradient'; index:number; stop?:number };
export function numericToken(value: string): NumericValue | null {
  const match = value.trim().match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)([a-z%]*)$/i);
  return match && Number.isFinite(Number(match[1])) ? { amount:Number(match[1]), unit:match[2].toLowerCase() } : null;
}
const length = ['px','em','rem','vw','vh','vmin','vmax','ch'];
export function unitsFor(property: ValueProperty): string[] {
  if (['gradient-angle','rotate'].includes(property)) return ['deg','rad','turn'];
  if (property === 'time') return ['ms','s'];
  if (property === 'gradient-stop') return ['%','px','em','rem'];
  if (property === 'shadow-length' || property === 'border-width' || property === 'letter-spacing') return ['px','em','rem'];
  if (property === 'border-radius') return ['px','%','em','rem'];
  if (property === 'line-height') return ['','px','%','em','rem'];
  if (property === 'opacity') return ['','%'];
  if (property === 'z-index' || property === 'font-weight') return [''];
  if (property === 'width' || property === 'height') return ['px','%',...length.slice(1)];
  if (property === 'font-size' || /^(margin|padding)-/.test(property) || ['top','right','bottom','left'].includes(property)) return ['px','%','em','rem','vw','vh'];
  return [];
}
export function formatNumber(value: number, unit = '') { return String(Number(value.toFixed(unit === 'px' ? 4 : 6))); }
export function unitStep(property: ValueProperty | undefined, unit: string) {
  if (unit === 'turn') return .01;
  if (['em','rem','ch','rad','s'].includes(unit) || !unit && (property === 'line-height' || property === 'opacity')) return .1;
  return 1;
}
export function stepNumeric(value: string, delta: number, fallbackUnit = '', minimum = -Infinity, maximum = Infinity) {
  const token = numericToken(value); if (!token) return null;
  return `${formatNumber(Math.max(minimum, Math.min(maximum, token.amount + delta)),token.unit || fallbackUnit)}${token.unit || fallbackUnit}`;
}
const isLength = (property: ValueProperty) => !['opacity','font-weight','z-index','gradient-angle','rotate','time'].includes(property) && unitsFor(property).includes('px');
export function validNumeric(property: ValueProperty, token: NumericValue) {
  return unitsFor(property).includes(token.unit) || isLength(property) && token.amount === 0 && token.unit === '';
}
export function valueModel(property: ValueProperty, editorValue: string, computedValue?: string) {
  const numeric = numericToken(editorValue);
  return { property, editorValue, computedValue, numeric, kind: numeric ? 'numeric' : /(?:calc|min|max|clamp|var|env)\(/i.test(editorValue) ? 'expression' : 'keyword', canConvert: !!numeric && validNumeric(property, numeric) };
}
function factor(property: ValueProperty, unit: string, context: ConversionContext): number | undefined {
  if (['gradient-angle','rotate'].includes(property)) return ({deg:1,rad:180 / Math.PI,turn:360} as Record<string,number>)[unit];
  if (property === 'time') return ({ms:1,s:1000} as Record<string,number>)[unit];
  if (property === 'opacity') return unit === '%' ? .01 : unit === '' ? 1 : undefined;
  if (unit === 'px') return 1;
  if (unit === 'rem') return context.rootFont;
  if (unit === 'em') return property === 'font-size' ? context.parentFont : context.elementFont;
  if (unit === '' && property === 'line-height') return context.elementFont;
  if (unit === '%') {
    const basis = property === 'font-size' ? context.parentFont : property === 'line-height' ? context.elementFont : context.percentBasis;
    return basis === undefined ? undefined : basis / 100;
  }
  if (unit === 'vw') return context.viewportWidth === undefined ? undefined : context.viewportWidth / 100;
  if (unit === 'vh') return context.viewportHeight === undefined ? undefined : context.viewportHeight / 100;
  if (unit === 'vmin' || unit === 'vmax') return context.viewportWidth && context.viewportHeight ? Math[unit === 'vmin' ? 'min' : 'max'](context.viewportWidth,context.viewportHeight) / 100 : undefined;
  // ch needs actual font metrics. Manual entry is supported, conversion is not guessed.
  return undefined;
}
export type Conversion = { ok:true; value:string } | { ok:false; reason:string };
export function convertValue(property: ValueProperty, value: string, unit: string, context: ConversionContext = {}): Conversion {
  const token = numericToken(value);
  if (!token || !validNumeric(property,token) || !validNumeric(property,{amount:token.amount,unit})) return {ok:false,reason:'This value or unit is not a supported scalar for this property.'};
  if (unit === token.unit) return {ok:true,value};
  if (context.referenceValue !== undefined) {
    const reference = numericToken(context.referenceValue), from = factor(property,token.unit,context), referenceFactor = reference && factor(property,reference.unit,context);
    const sourceSize = token.amount === 0 && isLength(property) ? 0 : from && token.amount * from;
    const actualSize = reference?.amount === 0 && isLength(property) ? 0 : reference && referenceFactor ? reference.amount * referenceFactor : undefined;
    if (sourceSize === undefined || actualSize === undefined || !Number.isFinite(sourceSize) || Math.abs(sourceSize-actualSize) > .02) return {ok:false,reason:'The editor value does not match a known rendered value. Constraints or competing CSS may apply; enter a value manually.'};
  }
  if (token.amount === 0 && isLength(property)) return {ok:true,value:`0${unit}`};
  const from = factor(property,token.unit,context), to = factor(property,unit,context);
  if (!from || !to || from < 0 || to < 0 || !Number.isFinite(from) || !Number.isFinite(to)) return {ok:false,reason:unit === '%' || token.unit === '%' ? context.percentReason ?? 'A definite percentage reference is not available.' : 'The required font or viewport reference is not available.'};
  const amount = token.amount * from / to;
  return Number.isFinite(amount) ? {ok:true,value:`${formatNumber(amount,unit)}${unit}`} : {ok:false,reason:'This conversion exceeds the supported numeric range.'};
}
