import { numericToken, type ConversionContext, type ValueProperty, type ValueReference } from './values';
import { properties, type Property } from './properties';
import { parseShadow, parseGradient, splitCSS } from './rich';

/** Read only on unit-menu open or explicit conversion; never in hover/scrub loops. */
export function readConversionContext(element: Element, property: ValueProperty, reference?: ValueReference): ConversionContext {
  const doc = element.ownerDocument, win = doc.defaultView!;
  const css = win.getComputedStyle(element), root = win.getComputedStyle(doc.documentElement);
  const parent = element.parentElement, parentCSS = parent ? win.getComputedStyle(parent) : null;
  const px = (value: string) => { const token = numericToken(value); return token?.unit === 'px' && token.amount > 0 ? token.amount : undefined; };
  const context: ConversionContext = { rootFont:element === doc.documentElement && property === 'font-size' ? undefined : px(root.fontSize), parentFont:parentCSS ? px(parentCSS.fontSize) : undefined, elementFont:px(css.fontSize), percentReason:'This percentage reference is ambiguous; enter a percentage manually if intended.' };
  if (properties.includes(property as Property)) context.referenceValue = css.getPropertyValue(property);
  if (reference?.kind === 'shadow') context.referenceValue = parseShadow(splitCSS(css.getPropertyValue(reference.property))[reference.index] ?? '',reference.property === 'text-shadow')?.[reference.component] ?? '';
  if (reference?.kind === 'gradient') {
    const gradient = parseGradient(splitCSS(css.backgroundImage)[reference.index] ?? '');
    context.referenceValue = reference.stop === undefined ? gradient?.direction ?? '' : gradient?.stops[reference.stop]?.position ?? '';
  }
  if (root.overflowX !== 'scroll' && root.overflowY !== 'scroll' && root.scrollbarGutter === 'auto') { context.viewportWidth = win.innerWidth; context.viewportHeight = win.innerHeight; }
  // No pseudo/state, vertical writing, SVG or size-container assumptions here.
  if (!(element instanceof win.HTMLElement) || css.writingMode !== 'horizontal-tb') return context;
  const borderBox = (style: CSSStyleDeclaration, axis: 'width' | 'height') => {
    const size = px(style[axis]); if (size === undefined) return undefined;
    return size + (style.boxSizing === 'border-box' ? 0 : axis === 'width' ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth) : parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth));
  };
  if (property === 'border-radius') {
    const width = borderBox(css,'width'), height = borderBox(css,'height');
    // A scalar % radius uses BOTH axes. It can match a scalar length only on a square.
    if (width && height && Math.abs(width-height) < .001 && !['inline','contents','none'].includes(css.display)) context.percentBasis = width;
    else context.percentReason = 'A single % radius cannot preserve both axes on a non-square box.';
  }
  // Proof deliberately limited to an immediate normal-flow block container with
  // a definite inline width. No inferred cascade winners or generic parentWidth rule.
  const grandparentCSS = parent?.parentElement ? win.getComputedStyle(parent.parentElement) : null;
  if (parent instanceof win.HTMLElement && parentCSS && grandparentCSS && ['block','flow-root'].includes(grandparentCSS.display) && ['static','relative'].includes(parentCSS.position) && parentCSS.cssFloat === 'none' && ['block','flow-root'].includes(parentCSS.display) && parentCSS.writingMode === 'horizontal-tb' && ['static','relative'].includes(css.position) && !['inline','contents','none'].includes(css.display)) {
    const declared = numericToken(parent.style.width);
    if (declared && parent.style.getPropertyPriority('width') === 'important' && ['px','em','rem','vw','vh','vmin','vmax'].includes(declared.unit) && ['auto','1'].includes(parentCSS.columnCount) && parentCSS.columnWidth === 'auto' && parentCSS.transitionDuration.split(',').every(time => parseFloat(time) === 0) && parentCSS.animationName.split(',').every(name => name.trim() === 'none')) {
      let basis = px(parentCSS.width);
      if (basis && parentCSS.boxSizing === 'border-box') basis -= parseFloat(parentCSS.paddingLeft) + parseFloat(parentCSS.paddingRight) + parseFloat(parentCSS.borderLeftWidth) + parseFloat(parentCSS.borderRightWidth);
      if (basis && basis > 0 && (property === 'width' || /^(margin|padding)-/.test(property))) context.percentBasis = basis;
    }
  }
  return context;
}
