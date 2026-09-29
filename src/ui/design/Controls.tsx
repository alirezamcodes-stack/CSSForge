import { useId, useState, type ReactNode } from 'react';
import { useUI } from '../../state/ui';
import { Icon } from '../shared/Icon';
import { Popover, Options } from '../popovers/Popover';
import s from '../ui.module.css';
import { useEditing } from '../../picker/context';

export function Section({ name, children }: { name: string; children: ReactNode }) {
  const open = useUI(state => !state.collapsed.includes(name));
  const id = useId();
  const { overrides } = useEditing();
  const prefixes: Record<string, string[]> = { Spacing: ['margin', 'padding'], Typography: ['font', 'line-height', 'color', 'text-align', 'letter-spacing', 'text-decoration', 'text-transform'], Background: ['background'], Display: ['display', 'opacity'], Border: ['border'], Positioning: ['position', 'top', 'left', 'right', 'bottom', 'z-index'], 'Box shadow': ['box-shadow'], 'Text shadow': ['text-shadow'], Filters: ['filter'] };
  const dirty = overrides.some(group => group.declarations.some(item => item.enabled && prefixes[name]?.some(prefix => item.property === prefix || item.property.startsWith(prefix + '-'))));
  return <section className={s.section} data-section={name}><button className={s.sectionTitle} type="button" aria-expanded={open} aria-controls={id} title={dirty ? 'Contains CSSForge session overrides' : undefined} onClick={() => useUI.getState().toggleSection(name)}><span>{name}</span><span className={s.sectionIndicators}>{dirty && <i className={s.dirtyDot} aria-hidden="true" />}<span className={!open ? s.rotated : ''}><Icon name="chevron" /></span></span></button><div id={id} hidden={!open}>{children}</div></section>;
}
export function Value({ label, initial, unit = '' }: { label: string; initial: string | number; unit?: string }) {
  const [value, setValue] = useState(String(initial));
  return <label className={s.value}><span className={s.srOnly}>{label}</span><input aria-label={label} value={value} onChange={event => setValue(event.target.value)} spellCheck={false}/>{unit && <span>{unit}</span>}</label>;
}
export function Select({ label, options, initial, className = '', selected, onSelect }: { label: string; options: string[]; initial?: string; className?: string; selected?: string; onSelect?: (value: string) => void }) {
  const [local, setLocal] = useState(initial ?? options[0]);
  const value = selected ?? local;
  const setValue = onSelect ?? setLocal;
  return <Popover id={label} label={value} className={className}><div className={s.menuCaption}>{label}</div><Options values={options} value={value} onChange={setValue} /></Popover>;
}
export function Color({ label = 'Text color', initial = '#ffffff' }: { label?: string; initial?: string }) {
  const [value, setValue] = useState(initial);
  return <label className={s.color}><input aria-label={label} type="color" value={value} onChange={e => setValue(e.target.value)} /><span>{value.toUpperCase()}</span></label>;
}
