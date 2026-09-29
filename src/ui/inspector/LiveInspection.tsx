import { useInspection, useEditing } from '../../picker/context';
import { dimensions, fontSummary } from '../../picker/identity';
import { useUI, type Task } from '../../state/ui';
import { Icon, IconButton } from '../shared/Icon';
import { Popover } from '../popovers/Popover';
import { Surface } from '../shared/Surface';
import type { useInspectorDrag } from '../interactions/useInspectorDrag';
import s from '../ui.module.css';
import { SessionActions } from '../design/EditControls';
import { LiveNavigator } from '../html/LiveHTMLView';

export function TargetNavigation() {
  const { picker, selection } = useInspection();
  return <div className={s.targetNavigation}><button className={s.outlineButton} disabled={!selection?.hasParent} onClick={() => picker?.parent()}><Icon name="back" />Select parent</button><button className={s.outlineButton} disabled={!selection?.hasChild} onClick={() => picker?.child()}>Select child<Icon name="chevron" /></button></div>;
}
export function LiveHeader({ handleProps }: { handleProps: ReturnType<typeof useInspectorDrag>['handleProps'] }) {
  const { selection, active, picker } = useInspection();
  return <header className={s.inspectorHeader} {...handleProps}><div className={s.identityRow}><strong className={s.liveIdentity} data-testid="selected-identity">{selection?.identity ?? (active ? 'Pick an element' : 'No element selected')}</strong><div className={s.headerActions}><IconButton icon="layers" label="Open Navigator" onClick={() => useUI.getState().setSurface('navigator')} /><Popover id="Inspector menu" iconOnly label={<Icon name="more" />}><div className={s.menuCaption}>Element inspection</div><button className={s.menuOption} onClick={() => { useUI.getState().setPopover(null); picker?.start(); }}>Pick an element<Icon name="cursor" /></button><TargetNavigation /><SessionActions /><button className={s.menuOption} onClick={() => useUI.getState().setInspector(false)}>Hide inspector<Icon name="close" /></button></Popover><IconButton icon="close" label="Hide inspector" onClick={() => useUI.getState().setInspector(false)} /></div></div><div className={s.metadata}>{selection ? <><span data-testid="selected-dimensions"><Icon name="ruler" />{dimensions(selection.rect)}</span><span className={s.liveFont} data-testid="selected-font"><Icon name="font" /><u>{fontSummary(selection.fontFamily)}</u> {selection.fontSize}</span></> : <span>Point to the page, then click to inspect.</span>}</div></header>;
}
export function LiveTask({ task }: { task: Task }) {
  const { selection, active, picker } = useInspection();
  return <div className={s.liveContent}>
    <p className={s.fixtureNote} role="status">{active ? 'Picking · click an element. Escape cancels.' : selection ? 'Element selected · page interactions are enabled.' : 'Select an element to see its dimensions and font.'}</p>
    <button className={s.outlineButton} onClick={() => active ? picker?.cancel() : picker?.start()}><Icon name="cursor" />{active ? 'Cancel picking' : 'Pick an element'}</button>
    {selection && <><TargetNavigation />{task === 'Design' && <dl className={s.selectionFacts}><dt>Element</dt><dd>{selection.tag}</dd><dt>Dimensions</dt><dd>{dimensions(selection.rect)} px</dd><dt>Font family</dt><dd>{selection.fontFamily}</dd><dt>Font size</dt><dd>{selection.fontSize}</dd></dl>}</>}
    <p className={s.fixtureNote}>{task === 'Design' ? 'Pick an element to edit its core Design properties.' : task === 'Code' ? 'Authored CSS inspection and editing are not connected yet.' : 'Use parent and child selection above. The document tree is not connected yet.'}</p>
  </div>;
}
export function LiveSurface({ surface }: { surface: 'navigator' | 'changes' }) {
  const { selection } = useInspection();
  const { editedCount } = useEditing();
  if (surface === 'changes') return <Surface title="Changes" subtitle={`${editedCount} edited elements · current session`} wide><SessionActions /><p className={s.fixtureNote}>Core Design edits are active for this session. Detailed change review and export are not connected yet.</p></Surface>;
  return <LiveNavigator />;
}
