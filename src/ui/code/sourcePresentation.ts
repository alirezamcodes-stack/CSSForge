import type { SourceGroup } from '../../editing/readable';

/** Shares adjacent metadata only. Original rules, order and editing contexts
 * stay distinct; matching labels never establish stylesheet identity. */
export function adjacentSourceRuns(rules: SourceGroup[]) {
  const runs: { key: string; groups: { group: SourceGroup; index: number }[] }[] = [];
  rules.forEach((group, index) => {
    const sourceId = group.declarations[0]?.sourceId;
    const knownSource = sourceId && group.declarations.every(declaration => declaration.sourceId === sourceId);
    const key = knownSource
      ? JSON.stringify([sourceId, group.label, group.conditions, group.context.media, group.editable])
      : `unverified-${index}`;
    const previous = runs.at(-1);
    if (previous?.key === key && knownSource) previous.groups.push({ group, index });
    else runs.push({ key, groups: [{ group, index }] });
  });
  return runs;
}
