import { useEditing, useInspection } from '../../picker/context';
import { Section } from './Controls';
import { LiveSpacingEditor } from './SpacingEditor';
import { EditField, EditSelect, SessionActions } from './EditControls';
import { Icon, IconButton, type IconName } from '../shared/Icon';
import { TargetNavigation } from '../inspector/LiveInspection';
import s from '../ui.module.css';
import { RichContextControls, contextKey } from './RichControls';
import { RichBackground } from './RichBackground';
import { RichShadow, RichFilters } from './RichEffects';

export function LiveDesignView() {
  const { design, editor, context } = useEditing();
  const { selection } = useInspection();
  if (!design || !selection) return null;
  return <div className={s.design} key={design.targetId + contextKey(context)} data-testid="live-design">
    <RichContextControls />
    <div className={`${s.geometry} ${s.editGeometry}`}><span><i>X</i>{Math.round(selection.rect.x)}</span><span><i>Y</i>{Math.round(selection.rect.y)}</span><span title="Border radius"><Icon name="radius" /><EditField compact property="border-radius" label="Geometry radius" /></span><span><i>W</i><EditField compact property="width" label="Width" disabled={!design.canSize} /></span><span><i>H</i><EditField compact property="height" label="Height" disabled={!design.canSize} /></span><span className={s.muted}>Computed</span></div>
    <LiveSpacingEditor />
    <Section name="Typography"><div className={s.typography}>
      <EditSelect property="font-family" label="Font family" options={['Arial', 'Georgia', 'Verdana', 'system-ui', 'serif', 'sans-serif', 'monospace']} />
      <label className={s.fieldLabel}><span>Weight</span><EditSelect property="font-weight" label="Font weight" options={['100', '200', '300', '400', '500', '600', '700', '800', '900', 'normal', 'bold']} /></label>
      <div className={s.twoColumns}><label className={s.fieldLabel}><span>Size</span><EditField property="font-size" label="Font size" /></label><label className={s.fieldLabel}><span>Line height</span><EditField property="line-height" label="Line height" /></label></div>
      <EditField color property="color" label="Text color" />
      <div className={s.segmented}>{['left', 'center', 'right', 'justify'].map(align => <IconButton key={align} icon={`align${align[0].toUpperCase()}${align.slice(1)}` as IconName} label={`Align ${align}`} active={design.values['text-align'].computed === align} onClick={() => editor!.apply(design.targetId, 'text-align', align)} />)}</div>
      <div className={s.twoColumns}><label className={s.fieldLabel}><span>Letter spacing</span><EditField property="letter-spacing" label="Letter spacing" /></label><label className={s.fieldLabel}><span>Decoration</span><EditSelect property="text-decoration-line" label="Text decoration" options={['none', 'underline', 'line-through', 'overline']} /></label></div>
      <label className={s.fieldLabel}><span>Text transform</span><EditSelect property="text-transform" label="Text transform" options={['none', 'uppercase', 'lowercase', 'capitalize']} /></label>
    </div></Section>
    <RichBackground />
    <Section name="Display"><div className={s.twoColumns}><EditSelect property="display" label="Display mode" options={['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'flow-root', 'contents', 'none']} /><div className={s.inline}><Icon name="eye" /><EditField property="opacity" label="Opacity" /></div></div></Section>
    <Section name="Border"><div className={s.stack}><EditField color property="border-color" label="Border color" /><div className={s.twoColumns}><label className={s.fieldLabel}><span>Width</span><EditField property="border-width" label="Border width" /></label><label className={s.fieldLabel}><span>Style</span><EditSelect property="border-style" label="Border style" options={['none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset']} /></label></div><label className={s.fieldLabel}><span>Radius</span><EditField property="border-radius" label="Border radius" /></label></div></Section>
    <Section name="Positioning"><EditSelect property="position" label="Position" options={['static', 'relative', 'absolute', 'fixed', 'sticky']} />{design.values.position.presented !== 'static' && <div className={s.richDetails}><div className={s.twoColumns}>{(['top', 'right', 'bottom', 'left'] as const).map(property => <label className={s.fieldLabel} key={property}><span>{property[0].toUpperCase() + property.slice(1)}</span><EditField property={property} label={`Position ${property}`} /></label>)}</div><label className={s.fieldLabel}><span>Z-index</span><EditField property="z-index" label="Z-index" /></label></div>}</Section>
    <RichShadow /><RichShadow text /><RichFilters />
    <SessionActions /><TargetNavigation /><p className={s.fixtureNote}>Browser values with session overrides. Hover a field for its computed value. Reset or deactivate to restore the page.</p>
  </div>;
}
