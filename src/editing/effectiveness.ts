import type { CascadeResult } from '../engine/cascade/model';
import type { Declaration } from '../engine/sources/model';
import type { EditContext } from './contexts';
import { selectorSpecificities } from '../engine/cascade/specificity';

export type EditEffect = {
  context: EditContext; property: string; requested: string; computed?: string;
  state: 'effective' | 'blocked' | 'pending' | 'unknown'; reason: string;
};
export type ContextActivity = 'active' | 'inactive-media' | 'inactive-pseudo' | 'unverified-pseudo';

/** Explicit inspection excludes other branches. Native activity can expose a competitor outside that model. */
export function hasActiveOutsideContext(result: CascadeResult, declarationId: string, element: Element): boolean {
  const related = Object.values(result.properties).filter(property => [...property.matched, ...property.inactive, ...property.unresolved].some(candidate => candidate.declaration.id === declarationId));
  return related.some(property => [...property.matched, ...property.inactive].some(candidate => {
    if (!candidate.declaration.enabled || candidate.source.disabled || candidate.rule.contexts.some(condition => condition.matches === false)) return false;
    if (candidate.state === 'inactive' && candidate.issues.length) return true;
    const rule = candidate.rule;
    try {
      const nativeMatch = rule.editContext
        ? !rule.editContext.pseudo || (!rule.editContext.pseudo.startsWith('::') && element.matches(rule.editContext.pseudo))
        : rule.selectorText && element.matches(rule.selectorText);
      if (!nativeMatch) return false;
      if (candidate.state === 'inactive' && ['pseudo', 'media'].includes(candidate.inactiveReason ?? '')) return true;
      // A selector list may also contain a higher-weight active branch excluded by the chosen state.
      return !!rule.selectorText && selectorSpecificities(rule.selectorText).some(item => {
        const state = item.selector.match(/(:hover|:focus|:active)$/)?.[0];
        return state && state !== result.context.pseudo && element.matches(item.selector);
      });
    } catch { return true; } // CSSOM-valid namespace/relative selectors may be unavailable to DOM matching.
  }));
}

/** Contribution evidence, never string equality between requested CSS and a computed serialization. */
export function editEffect(declaration: Declaration, context: EditContext, result: CascadeResult, activity: ContextActivity, computed?: string, activeOutsideContext = false): EditEffect {
  const effect = (state: EditEffect['state'], reason: string): EditEffect => ({ context, property: declaration.property, requested: declaration.value, computed, state, reason });
  if (!declaration.enabled) return effect('pending', 'Override disabled');
  if (activity === 'inactive-media') return effect('pending', 'Media query inactive');
  if (activity === 'inactive-pseudo') return effect('pending', `${context.pseudo} inactive`);
  if (activity === 'unverified-pseudo') return effect('unknown', 'Generated pseudo-element not verified');
  if (activeOutsideContext) return effect('unknown', 'Active competing state or media branch outside this inspection context');
  const properties = Object.values(result.properties).filter(property => [...property.matched, ...property.inactive, ...property.unresolved].some(candidate => candidate.declaration.id === declaration.id));
  if (!properties.length || properties.some(property => property.confidence !== 'resolved')) return effect('unknown', 'Cascade evidence incomplete or unsupported');
  if (properties.some(property => property.inactive.some(candidate => candidate.declaration.id === declaration.id))) return effect('pending', 'Declaration inactive in this context');
  if (properties.every(property => property.winner?.declaration.id === declaration.id)) return effect('effective', 'Wins supported author cascade');
  const loss = properties.flatMap(property => property.overridden).find(item => item.candidate.declaration.id === declaration.id);
  const reason = loss?.reason;
  return effect('blocked', reason === 'specificity' ? 'Higher specificity wins' : reason === 'layer-order' ? 'Important layer wins' : reason === 'inline' ? 'Inline declaration wins' : reason === 'important' ? 'Important declaration wins' : reason === 'source-order' ? 'Later declaration wins' : 'Another declaration wins');
}
