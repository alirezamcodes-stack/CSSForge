import { useId, useState } from 'react';
import { useEditing } from '../../picker/context';
import { useUI } from '../../state/ui';
import { insertTags, structureLimits, type InsertPosition, type StructureFailure, type StructureOperation } from '../../editing/dom/structure';
import { Surface } from '../shared/Surface';
import s from './inlineText.module.css';
import common from '../ui.module.css';

const actions: [StructureOperation, string][] = [['insert','Insert element'],['duplicate','Duplicate'],['delete','Delete'],['up','Move up'],['down','Move down']];
export function StructureActions() {
  return <>{actions.map(([operation,label])=><StructureAction key={operation} operation={operation} label={label}/>)}</>;
}
function StructureAction({operation,label}:{operation:StructureOperation;label:string}) {
  const {editor,design}=useEditing(),id=useId();
  const [prepared]=useState(()=>editor?.prepareStructure(operation));
  const plan=prepared&&'owner' in prepared?prepared:null;
  const available=!!plan&&design?.targetId===plan.targetId&&design.bindingGeneration===plan.bindingGeneration;
  const reason=prepared&&'reason' in prepared?prepared.reason:'The selected target changed. Reopen the menu.';
  return <><button className={common.menuOption} disabled={!available} aria-describedby={!available?id:undefined} onClick={()=>{
    if(operation==='insert')useUI.getState().setSurface('insert');
    else if(editor&&plan){editor.applyStructure(plan);useUI.getState().setPopover(null);}
  }}>{label}</button>{!available&&<p id={id} className={s.reason}>{label}: {reason}</p>}</>;
}
export function InsertElementEditor() {
  const {editor,design}=useEditing(),id=useId();
  const [position,setPosition]=useState<InsertPosition>('after'),[tag,setTag]=useState<string>('div'),[text,setText]=useState('');
  const [prepared,setPrepared]=useState(()=>editor?.prepareStructure('insert','after'));
  const [error,setError]=useState<StructureFailure|null>(null);
  const plan=prepared&&'owner' in prepared?prepared:null;
  const stale=!!plan&&(!design||design.targetId!==plan.targetId||design.bindingGeneration!==plan.bindingGeneration);
  const reason=stale?'STALE · The selected target changed. Cancel and reopen.':error?`${error.state} · ${error.reason}`:prepared&&'reason' in prepared?`${prepared.state} · ${prepared.reason}`:'';
  const close=()=>useUI.getState().setSurface(null);
  return <Surface title="Insert element" subtitle="One native element · optional literal text" compact><div className={s.editor}>
    <label htmlFor={`${id}-type`}>Element type</label><select id={`${id}-type`} value={tag} onChange={event=>setTag(event.target.value)}>{insertTags.map(name=><option key={name} value={name}>{name}</option>)}</select>
    <label htmlFor={`${id}-position`}>Position</label><select id={`${id}-position`} value={position} disabled={stale} onChange={event=>{
      const next=event.target.value as InsertPosition;setPosition(next);setPrepared(editor?.prepareStructure('insert',next));setError(null);
    }}>{([['before','Before selected element'],['after','After selected element'],['first','First child'],['last','Last child']] as const).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    <label htmlFor={`${id}-text`}>Optional text</label><textarea id={`${id}-text`} value={text} maxLength={structureLimits.text} dir="auto" spellCheck={false} aria-describedby={`${id}-hint ${id}-error`} onChange={event=>setText(event.target.value)}/>
    <p id={`${id}-hint`}>Text is literal. Insert keeps the current selection; pick the new element to edit it. Escape cancels. Structure is excluded from CSS export.</p>
    <p id={`${id}-error`} role="status" aria-live="polite">{reason}</p>
    <div className={s.actions}><button type="button" onClick={close}>Cancel</button><button type="button" disabled={!plan||stale} onClick={()=>{
      if(!editor||!plan)return;const result=editor.applyStructure(plan,tag,text);if(result.state==='applied')close();else setError(result);
    }}>Insert</button></div>
  </div></Surface>;
}
