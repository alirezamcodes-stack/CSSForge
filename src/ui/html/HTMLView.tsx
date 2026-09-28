import { useState } from 'react';
import { dom, type FixtureNode } from '../../fixtures/selected';
import { useUI } from '../../state/ui';
import { Icon } from '../shared/Icon';
import s from '../ui.module.css';
function TreeNode({ node, depth, selected, onSelect }: { node: FixtureNode; depth: number; selected: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  return <div><div className={`${s.treeRow} ${selected === node.id ? s.selectedNode : ''}`} style={{ paddingLeft: depth * 13 + 4 }}>
    {node.children ? <button aria-label={`${open ? 'Collapse' : 'Expand'} ${node.tag}${node.name ? '.' + node.name : ''}`} aria-expanded={open} className={!open ? s.rotated : ''} onClick={() => setOpen(!open)}><Icon name="chevron" /></button> : <span className={s.treeIndent} />}
    <button className={s.nodeButton} aria-pressed={selected === node.id} onClick={() => onSelect(node.id)}><span className={s.property}>&lt;{node.tag}</span>{node.name && <><span className={s.muted}> class=</span><span className={s.attribute}>"{node.name}"</span></>}<span className={s.property}>&gt;</span></button>
  </div>{open && <>{node.text && <div className={s.treeText} style={{ paddingLeft: depth * 13 + 30 }}>"{node.text}"</div>}{node.children?.map(child => <TreeNode key={child.id} node={child} depth={depth + 1} {...{ selected, onSelect }} />)}{node.children && <div className={s.treeClosing} style={{ paddingLeft: depth * 13 + 28 }}>&lt;/{node.tag}&gt;</div>}</>}</div>;
}
export function DOMTree() {
  const selected = useUI(state => state.selectedFixtureNode);
  const setSelected = useUI(state => state.selectNode);
  return <div className={s.tree} aria-label="Fixture element hierarchy"><TreeNode node={dom} depth={0} selected={selected} onSelect={setSelected} /></div>;
}
export function HTMLView() {
  return <div className={s.htmlView}><div className={s.breadcrumb}>body <span>›</span> main <span>›</span> .hero</div><DOMTree /><button className={s.outlineButton} onClick={() => useUI.getState().setSurface('navigator')}><Icon name="layers" />Open Navigator</button><p className={s.fixtureNote}>Fixture DOM · select nodes to explore the tree</p></div>;
}
