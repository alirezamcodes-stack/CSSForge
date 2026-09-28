import { useEditing, useInspection } from '../../picker/context';
import { Section } from './Controls';
import { LiveSpacingEditor } from './SpacingEditor';
import { EditField, EditSelect, SessionActions } from './EditControls';
import { Icon, IconButton, type IconName } from '../shared/Icon';
import { Popover } from '../popovers/Popover';
import { TargetNavigation } from '../inspector/LiveInspection';
import s from '../ui.module.css';

export function LiveDesignView() {
  const { design, editor } = useEditing();
  const { selection } = useInspection();
  if (!design || !selection) return null;
  return <div className={s.design} key={design.targetId} data-testid="live-design">
    <Popover id="Media" label={<span><span className={s.contextLabel}><Icon name="screen" />Media</span><strong>Current viewport</strong></span>} className={s.media}><p className={s.menuNote}>Session overrides apply at all viewport sizes. Media editing is not connected.</p></Popover>
    <Popover id="State or pseudo" label={<span className={s.inline}><Icon name="target" />State or pseudo <strong>Current state</strong></span>} className={s.pseudo}><p className={s.menuNote}>The browser's current state is shown. Pseudo forcing is not connected.</p></Popover>
    <div className={`${s.geometry} ${s.editGeometry}`}><span><i>X</i>{Math.round(selection.rect.x)}</span><span><i>Y</i>{Math.round(selection.rect.y)}</span><span title="Border radius"><i>▢</i><EditField property="border-radius" label="Border radius" /></span><span><i>W</i><EditField property="width" label="Width" disabled={!design.canSize} /></span><span><i>H</i><EditField property="height" label="Height" disabled={!design.canSize} /></span><span className={s.muted}>Computed</span></div>
    <LiveSpacingEditor />
    <Section name="Typography"><div className={s.typography}>
      <EditSelect property="font-family" label="Font family" options={['Arial', 'Georgia', 'Verdana', 'system-ui', 'serif', 'sans-serif', 'monospace']} />
      <div className={s.twoColumns}><EditSelect property="font-weight" label="Font weight" options={['100', '200', '300', '400', '500', '600', '700', '800', '900', 'normal', 'bold']} /><div className={s.inline}><span className={s.muted}>Aᴀ</span><EditField property="font-size" label="Font size" /></div></div>
      <div className={s.twoColumns}><EditField color property="color" label="Text color" /><div className={s.inline}><span className={s.lineHeight}>A</span><EditField property="line-height" label="Line height" /></div></div>
      <div className={s.twoColumns}><div className={s.segmented}>{['left', 'center', 'right', 'justify'].map(align => <IconButton key={align} icon={`align${align[0].toUpperCase()}${align.slice(1)}` as IconName} label={`Align ${align}`} active={design.values['text-align'].computed === align} onClick={() => editor!.apply(design.targetId, 'text-align', align)} />)}</div><div className={s.inline}><span className={s.muted}>|A|</span><EditField property="letter-spacing" label="Letter spacing" /></div></div>
    </div></Section>
    <Section name="Background"><div className={s.layer}><EditField color property="background-color" label="Background color" /></div></Section>
    <Section name="Display"><div className={s.twoColumns}><EditSelect property="display" label="Display mode" options={['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'flow-root', 'contents', 'none']} /><div className={s.inline}><Icon name="eye" /><EditField property="opacity" label="Opacity" /></div></div></Section>
    <Section name="Border"><div className={s.stack}><EditField color property="border-color" label="Border color" /><div className={s.twoColumns}><div className={s.inline}><span className={s.muted}>☰</span><EditField property="border-width" label="Border width" /></div><EditSelect property="border-style" label="Border style" options={['none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset']} /></div></div></Section>
    <Section name="Positioning"><EditSelect property="position" label="Position" options={['static', 'relative', 'absolute', 'fixed', 'sticky']} /></Section>
    {['Box shadow', 'Text shadow', 'Filters'].map(name => <Section name={name} key={name}><p className={s.fixtureNote}>Editing not connected yet.</p></Section>)}
    <SessionActions /><TargetNavigation /><p className={s.fixtureNote}>Browser values with session overrides. Hover a field for its computed value. Reset or deactivate to restore the page.</p>
  </div>;
}
