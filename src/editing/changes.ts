import { contextKey, type EditContext } from './contexts';
import type { EditEffect } from './effectiveness';
import type { TextChangeRow } from './dom';
import type { StructureRow } from './dom/structure';

export type Baseline = { kind: 'computed' | 'authored' | 'unknown'; value?: string };
export type ChangeDeclaration = { property:string; value:string; enabled:boolean; priority:string; baseline:Baseline; provenance:'session'|'author-recovery'; effect?:EditEffect };
export type ChangeTarget = { targetId:string; label:string; bindingGeneration:number; available:boolean; root:'document'|'shadow-root'; texts?:TextChangeRow[]; structures?:StructureRow[]; contexts:{context:EditContext; declarations:ChangeDeclaration[]}[] };
export type ChangeOwner = Omit<ChangeTarget,'contexts'> & { scopes:{context:EditContext; declarations:{property:string;value:string;enabled:boolean}[]}[]; effects:EditEffect[] };
type HistoryEntry = { targetId:string; context:EditContext; changes:{property:string;baseline?:Baseline}[] };

/** Read-only net projection. Current owned scopes, not event count, determine the rows. */
export function deriveChanges(owners:ChangeOwner[],history:HistoryEntry[]):ChangeTarget[] {
  const originals=new Map<string,Baseline>();
  for(const entry of history) for(const change of entry.changes) {
    const key=JSON.stringify([entry.targetId,contextKey(entry.context),change.property]);
    if(!originals.has(key)) originals.set(key,change.baseline ?? {kind:'unknown'});
  }
  return owners.map(owner=>({targetId:owner.targetId,label:owner.label,bindingGeneration:owner.bindingGeneration,available:owner.available,root:owner.root,
    contexts:owner.scopes.filter(scope=>scope.declarations.length).map(scope=>({context:{...scope.context,media:[...scope.context.media]},declarations:scope.declarations.map(declaration=>({
      ...declaration,priority:'important',provenance:'session' as const,
      baseline:originals.get(JSON.stringify([owner.targetId,contextKey(scope.context),declaration.property])) ?? {kind:'unknown' as const},
      effect:owner.effects.find(effect=>contextKey(effect.context)===contextKey(scope.context)&&effect.property===declaration.property&&effect.requested===declaration.value),
    }))})).sort((a,b)=>a.context.media.length-b.context.media.length),
  })).filter(target=>target.contexts.length);
}

export const declarationCount=(targets:ChangeTarget[])=>targets.reduce((sum,target)=>sum+target.contexts.reduce((count,scope)=>count+scope.declarations.length,0),0);
export const textChangeCount=(targets:ChangeTarget[])=>targets.reduce((sum,target)=>sum+(target.texts?.length??0),0);
export const structureChangeCount=(targets:ChangeTarget[])=>targets.reduce((sum,target)=>sum+(target.structures?.length??0),0);
export const domChangeCount=(targets:ChangeTarget[])=>textChangeCount(targets)+structureChangeCount(targets);
export const contextLabel=(context:EditContext)=>[...context.media.map(query=>`@media ${query}`),context.pseudo||(!context.media.length?'Base':'')].filter(Boolean).join(' · ');
