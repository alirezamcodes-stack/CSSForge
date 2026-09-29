import type { CascadeResult } from './model';

/** A shorthand can win some expanded longhands and lose others. Do not collapse that into 'winning'. */
export function declarationStatus(result: CascadeResult | null, id?: string) {
  if (!result || !id) return undefined;
  const statuses = new Set<string>();
  for (const property of Object.values(result.properties)) {
    if (property.inactive.some(item => item.declaration.id === id)) statuses.add('inactive');
    if (property.matched.some(item => item.declaration.id === id) || property.unresolved.some(item => item.declaration.id === id)) {
      statuses.add(property.confidence !== 'resolved' ? 'unresolved' : property.winner?.declaration.id === id ? 'winning' : 'overridden');
    }
  }
  return statuses.size === 1 ? [...statuses][0] : statuses.size ? 'mixed' : undefined;
}
