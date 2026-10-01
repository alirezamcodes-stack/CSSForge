import { useInspection } from '../../picker/context';
import { dimensions } from '../../picker/identity';
import { useUI } from '../../state/ui';
import { Icon, IconButton } from '../shared/Icon';
import { Popover } from '../popovers/Popover';
import s from '../ui.module.css';

export function LiveDock() {
  const { picker, active, selection, deactivate } = useInspection();
  const open = useUI(state => state.inspectorOpen);
  const surface = useUI(state => state.surface);
  return <nav className={s.dock} aria-label="CSSForge tools"><div className={s.dockCircle}><IconButton icon="cursor" label={active ? 'Cancel element picking' : 'Pick page element'} active={active} onClick={() => { useUI.getState().setPopover(null); active ? picker?.cancel() : picker?.start(); }} /></div><div className={s.dockCircle}><IconButton icon="changes" label="Open Changes" active={surface === 'changes'} onClick={() => useUI.getState().setSurface('changes')} /></div><div className={s.dockCapsule}><IconButton icon="layers" label="Open Navigator" active={surface === 'navigator'} onClick={() => useUI.getState().setSurface('navigator')} /><Popover id="Measurement tools" label={<Icon name="ruler" />} iconOnly><div className={s.menuCaption}>Selected dimensions</div><p className={s.menuNote}>{selection ? `${dimensions(selection.rect)} px` : 'Select an element first.'}</p></Popover><Popover id="More tools" label={<Icon name="more" />} iconOnly><div className={s.menuCaption}>CSSForge</div><button className={s.menuOption} onClick={() => useUI.getState().setSurface('changes')}>Review changes<Icon name="changes" /></button><button className={s.menuOption} onClick={() => useUI.getState().setSurface('navigator')}>Open Navigator<Icon name="layers" /></button></Popover></div><div className={s.dockCircle}><IconButton icon="screen" label={open ? 'Hide inspector panel' : 'Show inspector panel'} active={open} onClick={() => useUI.getState().setInspector(!open)} /></div><div className={s.dockCircle}><IconButton icon="power" label="Deactivate CSSForge" onClick={deactivate} /></div></nav>;
}
