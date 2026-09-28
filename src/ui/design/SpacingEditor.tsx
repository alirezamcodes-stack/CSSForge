import { Section, Value } from './Controls';
import s from '../ui.module.css';
import { EditField } from './EditControls';
export function LiveSpacingEditor() {
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  const slots = { top: s.marginTop, right: s.marginRight, bottom: s.marginBottom, left: s.marginLeft };
  return <Section name="Spacing"><div className={s.boxModel} aria-label="Box model"><span className={s.marginLabel}>Margin</span>{sides.map(side => <div className={slots[side]} key={side}><EditField property={`margin-${side}`} label={`Margin ${side}`} /></div>)}<div className={s.paddingBox}><span>Padding</span>{sides.map(side => <div className={slots[side]} key={side}><EditField property={`padding-${side}`} label={`Padding ${side}`} /></div>)}</div></div></Section>;
}
export function SpacingEditor() {
  return <Section name="Spacing"><div className={s.boxModel} aria-label="Box model"><span className={s.marginLabel}>Margin</span><div className={s.marginTop}><Value label="Margin top" initial={0} unit="px" /></div><div className={s.marginRight}><Value label="Margin right" initial={0} unit="px" /></div><div className={s.marginBottom}><Value label="Margin bottom" initial={0} unit="px" /></div><div className={s.marginLeft}><Value label="Margin left" initial={0} unit="px" /></div><div className={s.paddingBox}><span>Padding</span><div className={s.marginTop}><Value label="Padding top" initial={32} unit="px" /></div><div className={s.marginRight}><Value label="Padding right" initial={32} unit="px" /></div><div className={s.marginBottom}><Value label="Padding bottom" initial={32} unit="px" /></div><div className={s.marginLeft}><Value label="Padding left" initial={32} unit="px" /></div></div></div></Section>;
}
