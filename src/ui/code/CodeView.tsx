import { useState } from 'react';
import { declarations } from '../../fixtures/selected';
import s from '../ui.module.css';
function Declaration({ property, value }: { property: string; value: string }) {
  const [enabled, setEnabled] = useState(true);
  return <label className={`${s.declaration} ${enabled ? '' : s.disabledDeclaration}`}><input type="checkbox" checked={enabled} aria-label={`Enable ${property}`} onChange={event => setEnabled(event.target.checked)} /><span><span className={s.property}>{property}</span>: <span className={s.cssValue}>{value}</span>;</span></label>;
}
export function CodeView() {
  return <div className={s.code}><div className={s.codeCaption}>Fixture stylesheet <span>CSS</span></div>{declarations.map(([property, value]) => <Declaration key={property} {...{ property, value }} />)}<div className={s.atRule}><strong>@media (min-width: 768px) <span>{'{'}</span></strong><div className={s.brace}>.hero-card {'{'}</div><Declaration property="padding" value="32px" /><Declaration property="max-width" value="993px" /><div className={s.brace}>{'}'}</div><div className={s.ruleEnd}>{'}'}</div></div><div className={s.atRule}><strong>@keyframes appear <span>{'{'}</span></strong><div className={s.brace}>from {'{'}</div><Declaration property="opacity" value="0" /><Declaration property="transform" value="translateY(12px)" /><div className={s.brace}>{'}'} to {'{'}</div><Declaration property="opacity" value="1" /><Declaration property="transform" value="translateY(0)" /><div className={s.brace}>{'}'}</div><div className={s.ruleEnd}>{'}'}</div></div><p className={s.fixtureNote}>Declaration toggles affect this preview only.</p></div>;
}
