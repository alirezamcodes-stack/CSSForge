import { useEditing } from '../../picker/context';
import type { Property } from '../../editing/properties';
import { Popover, Options } from '../popovers/Popover';
import { NumericScrubber } from '../shared/NumericScrubber';
import { ColorControl } from '../shared/ColorControl';
import { Icon } from '../shared/Icon';
import { TokenInput } from './RichControls';
import s from '../ui.module.css';

export function EditField({ property, label, disabled = false, color = false, compact = false }: { property: Property; label: string; disabled?: boolean; color?: boolean; compact?: boolean }) {
  const { editor, design } = useEditing(); const field = design!.values[property];
  const title = `Browser: ${field.computed}\n${field.override ? `Session override: ${field.override}` : 'No session override'}\nDrag horizontally or use arrows. Escape reverts the current gesture.`;
  const apply = (value: string, gesture?: string) => editor!.apply(design!.targetId, property, value, gesture);
  if (color) return <ColorControl label={label} value={field.presented} onChange={apply} title={title} overridden={!!field.override} />;
  if (property === 'font-family') return <TokenInput label={label} value={field.presented} onChange={apply} />;
  const unitless = ['z-index', 'font-weight', 'line-height'].includes(property);
  const spacing = compact || property.startsWith('padding-') || property.startsWith('margin-');
  const value = property === 'opacity' ? field.presented.endsWith('%') ? field.presented.slice(0, -1) : Number.isFinite(Number(field.presented)) ? String(Number((Number(field.presented) * 100).toFixed(3))) : field.presented : field.presented;
  return <NumericScrubber label={label} value={value} onChange={apply} stripPx={property !== 'line-height'} unitlessInput={unitless} defaultUnit={property === 'opacity' ? '%' : unitless ? '' : 'px'} units={property === 'opacity' ? ['%'] : spacing || property === 'z-index' || property === 'font-weight' ? [] : property === 'line-height' ? ['', 'px', '%', 'em', 'rem'] : undefined} min={property.startsWith('padding') || ['width', 'height', 'font-size', 'border-width', 'border-radius', 'opacity'].includes(property) ? 0 : -Infinity} max={property === 'opacity' ? 100 : Infinity} disabled={disabled} title={title} overridden={!!field.override} />;
}
export function EditSelect({ property, label, options }: { property: Property; label: string; options: string[] }) {
  const { editor, design } = useEditing(); const value = design!.values[property].presented;
  const values = options.includes(value) ? options : [value, ...options].filter(Boolean);
  return <Popover id={label} label={value}><div className={s.menuCaption}>{label}</div>{property === 'font-family' && <EditField property="font-family" label="Custom font family" />}<Options values={values} value={value} onChange={next => editor!.apply(design!.targetId, property, next)} /></Popover>;
}
export function SessionActions() {
  const { editor, undoCount, editedCount, error } = useEditing();
  return <><div className={s.sessionActions}><button className={s.outlineButton} disabled={!undoCount} onClick={() => editor?.undo()}><Icon name="undo" />Undo last edit</button><button className={s.outlineButton} disabled={!editedCount} onClick={() => editor?.reset()}><Icon name="reset" />Reset session edits</button></div>{error && <p className={s.editError} role="alert">{error}</p>}</>;
}
