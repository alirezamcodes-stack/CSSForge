import type { EditEffect } from '../../editing/effectiveness';
import s from './editEffectiveness.module.css';

const labels = { effective: 'Applied', blocked: 'Applied · blocked', pending: 'Pending / inactive', unknown: 'Applied · unverified' };
export function EditEffectiveness({ effect }: { effect: EditEffect }) {
  return <small className={s.effect} data-edit-property={effect.property} data-edit-effect={effect.state}>
    <strong>{effect.property}: {labels[effect.state]}</strong>
    <span>{effect.reason} · requested {effect.requested}{effect.state === 'blocked' && effect.computed ? ` · browser ${effect.computed}` : ''}</span>
  </small>;
}
