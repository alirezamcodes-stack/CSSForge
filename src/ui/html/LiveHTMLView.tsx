import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEditing, useInspection } from '../../picker/context';
import { useUI } from '../../state/ui';
import { Surface } from '../shared/Surface';
import { Icon } from '../shared/Icon';
import s from '../ui.module.css';
import t from './liveTree.module.css';

export function DOMNavigation() {
  const { picker, selection } = useInspection();
  return <nav className={t.navigation} aria-label="DOM navigation">{([
    ['Parent', selection?.hasParent, () => picker?.parent()], ['Child', selection?.hasChild, () => picker?.child()],
    ['Previous sibling', selection?.hasPrevious, () => picker?.previous()], ['Next sibling', selection?.hasNext, () => picker?.next()],
  ] as const).map(([label, enabled, action], index) => <button key={label} disabled={!enabled} onClick={action}><Icon name={(['parent', 'child', 'left', 'right'] as const)[index]} />{label}</button>)}</nav>;
}
export function LiveDOMTree() {
  const { picker } = useInspection(), { design } = useEditing();
  const [revision, setRevision] = useState(0);
  const treeRoot = useRef<HTMLDivElement>(null);
  const snapshot = useMemo(() => picker!.tree(), [picker, design?.targetId, revision]);
  useLayoutEffect(() => { treeRoot.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' }); }, [design?.targetId]);
  return <><div className={t.toolbar}><span>DOM around selection</span><button onClick={() => setRevision(value => value + 1)}>Refresh tree</button></div><div ref={treeRoot} className={t.tree} role="tree" aria-label="Page DOM tree">{snapshot.rows.map((row, index) => <div key={row.id} className={`${t.row} ${row.selected ? t.selected : ''}`} style={{ paddingLeft: 12 + Math.min(row.depth, 7) * 12 }}>
    <button className={t.expand} tabIndex={-1} disabled={!row.expandable} aria-label={`${row.expanded ? 'Collapse' : 'Expand'} ${row.label}`} onClick={() => { picker!.toggleNode(row.id); setRevision(value => value + 1); }}>{row.expandable && <Icon name={row.expanded ? 'chevron' : 'chevronRight'} />}</button>
    <button role="treeitem" aria-label={row.label} aria-level={row.depth + 1} aria-selected={row.selected} aria-expanded={row.expandable ? row.expanded : undefined} tabIndex={row.selected || !snapshot.rows.some(item => item.selected) && index === 0 ? 0 : -1} className={t.node} title={row.label} onClick={() => picker!.selectNode(row.id)} onKeyDown={event => {
      const items = Array.from(event.currentTarget.closest('[role=tree]')!.querySelectorAll<HTMLButtonElement>('[role=treeitem]'));
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus(); }
      if (event.key === 'ArrowRight' && row.expandable && !row.expanded || event.key === 'ArrowLeft' && row.expanded) { event.preventDefault(); picker!.toggleNode(row.id); setRevision(value => value + 1); }
    }}><span className={t.tag}>&lt;{row.tag}{row.elementId && <span className={t.attribute}> id="{row.elementId}"</span>}{row.classes && <span className={t.attribute}> class="{row.classes}"</span>}&gt;</span>{row.boundary && <small>{row.boundary}</small>}{row.text && <span className={t.text}>{row.text}</span>}</button>
  </div>)}</div>{snapshot.limited && <p className={t.note}>Showing a bounded branch around selection. Select a node to inspect its nearby siblings and children.</p>}<p className={t.note}>Open shadow roots are marked. Closed roots and frame contents are unavailable. CSSForge UI is excluded.</p></>;
}
export function LiveHTMLView() { return <div><DOMNavigation /><LiveDOMTree /></div>; }
export function LiveNavigator() {
  const { picker, selection } = useInspection();
  return <Surface title="Navigator" subtitle={selection?.identity ?? 'Select an element'}><DOMNavigation /><div className={s.navigatorTree}><LiveDOMTree /></div><footer className={s.surfaceFooter}><button className={s.outlineButton} onClick={() => useUI.getState().setSurface(null)}><Icon name="back" />Back to canvas</button><button className={s.outlineButton} onClick={() => { useUI.getState().setSurface(null); picker?.start(); }}><Icon name="cursor" />Pick element</button></footer></Surface>;
}
