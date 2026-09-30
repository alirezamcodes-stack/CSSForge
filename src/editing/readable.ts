import type { EditContext } from './contexts';
import type { SelectedSources } from '../engine/sources/model';
export { matchingContexts } from '../engine/sources/matching';

export type Declaration = { id?: string; sourceId?: string; ruleId?: string; property: string; value: string; priority: string; mutationState?: 'authored' | 'cssforge-mutated-author' };
export type SourceGroup = { label: string; selector: string; context: EditContext; editable: boolean; conditions: string[]; declarations: Declaration[] };
export type SourceSnapshot = { inline: Declaration[]; rules: SourceGroup[]; keyframes: { name: string; css: string }[]; notices: string[] };

/** Bounded presentation adapter only. All source discovery lives in the engine. */
export function presentSource(source: SelectedSources, mutationState: (id?: string, declaration?: Declaration) => 'authored' | 'cssforge-mutated-author' = () => 'authored'): SourceSnapshot {
  let remaining = 500, limited = source.matches.length > 80;
  const declarations = (items: Declaration[]) => items.filter(item => {
    if (remaining-- <= 0 || item.value.length > 8000) { limited = true; return false; } return true;
  }).map(item => ({ ...item, mutationState: mutationState(item.id, item) }));
  const inline = declarations(source.inline.rules.flatMap(rule => rule.declarations));
  const rules = source.matches.slice(0, 80).map(match => ({
    label: match.source.label + (match.source.disabled ? ' (disabled)' : ''), selector: match.rule.selectorText!, context: match.context, editable: match.editable,
    conditions: match.rule.contexts.map(item => item.text), declarations: declarations(match.rule.declarations),
  }));
  const names = new Set([...source.inline.rules, ...source.matches.map(match => match.rule)].flatMap(rule => rule.animationNames));
  const keyframes = source.keyframes.filter(rule => names.has(rule.name!)).filter((rule, index) => {
    if (index >= 30 || rule.cssText.length > 12000) { limited = true; return false; } return true;
  }).map(rule => ({ name: rule.name!, css: [...rule.contexts.map(item => `${item.text} {`), rule.cssText, ...rule.contexts.map(() => '}')].join('\n') }));
  return { inline, rules, keyframes, notices: [...source.notices, ...(limited ? ['Source display limited to 80 matching groups, 500 declarations and bounded keyframes.'] : [])] };
}
