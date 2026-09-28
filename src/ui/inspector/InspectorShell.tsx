import { useRef } from 'react';
import { selected } from '../../fixtures/selected';
import { useUI, type Task } from '../../state/ui';
import { Icon, IconButton } from '../shared/Icon';
import { Popover } from '../popovers/Popover';
import { DesignView } from '../design/DesignView';
import { CodeView } from '../code/CodeView';
import { HTMLView } from '../html/HTMLView';
import s from '../ui.module.css';
import { useInspectorDrag } from '../interactions/useInspectorDrag';
import { useInspection } from '../../picker/context';
import { LiveHeader, LiveTask } from './LiveInspection';
import { LiveDesignView } from '../design/LiveDesignView';
function InspectorHeader({ handleProps }: { handleProps: ReturnType<typeof useInspectorDrag>["handleProps"] }) {
  return <header className={s.inspectorHeader} {...handleProps}><div className={s.identityRow}><strong>{selected.selector}</strong><div className={s.headerActions}><IconButton icon="layers" label="Open Navigator" onClick={() => useUI.getState().setSurface('navigator')} /><Popover id="Inspector menu" iconOnly label={<Icon name="more" />}><div className={s.menuCaption}>CSSForge · Phase 01</div><button className={s.menuOption} onClick={() => useUI.getState().setSurface('changes')}>Review fixture changes<Icon name="changes" /></button><button className={s.menuOption} onClick={() => useUI.getState().setInspector(false)}>Hide inspector<Icon name="close" /></button><p className={s.menuNote}>Visual foundation. Controls do not edit this webpage.</p></Popover><IconButton icon="close" label="Hide inspector" onClick={() => useUI.getState().setInspector(false)} /></div></div><div className={s.metadata}><span><Icon name="ruler" />{selected.dimensions}</span><span><Icon name="font" /><u>{selected.font}</u> {selected.size}px</span></div></header>;
}
function TaskTabs() {
  const active = useUI(state => state.activeTask);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const tasks: Task[] = ['Design', 'Code', 'HTML'];
  return <div className={s.tabs} role="tablist" aria-label="Inspector task">{tasks.map((task, index) => <button ref={el => { refs.current[index] = el; }} key={task} id={`tab-${task}`} role="tab" aria-selected={active === task} aria-controls={`panel-${task}`} tabIndex={active === task ? 0 : -1} onClick={() => useUI.getState().setTask(task)} onKeyDown={event => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3;
    useUI.getState().setTask(tasks[next]); refs.current[next]?.focus();
  }}>{task}</button>)}</div>;
}
export function InspectorShell() {
  const { preview, selection } = useInspection();
  const active = useUI(state => state.activeTask);
  const open = useUI(state => state.inspectorOpen);
  const { panel, handleProps } = useInspectorDrag(open);
  return <aside ref={panel} hidden={!open} className={s.inspector} aria-label="Selected element inspector">{preview ? <InspectorHeader handleProps={handleProps} /> : <LiveHeader handleProps={handleProps} />}<TaskTabs />{(['Design', 'Code', 'HTML'] as Task[]).map(task => <div key={task} hidden={active !== task} id={`panel-${task}`} role="tabpanel" aria-labelledby={`tab-${task}`} className={s.inspectorScroll} tabIndex={0}>{!preview ? task === 'Design' && selection ? <LiveDesignView /> : <LiveTask task={task} /> : task === 'Design' ? <DesignView /> : task === 'Code' ? <CodeView /> : <HTMLView />}</div>)}</aside>;
}
