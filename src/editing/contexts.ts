import type { SelectedSources } from '../engine/sources/model';
export const pseudos = ['', ':hover', ':focus', ':active', '::before', '::after'] as const;
export type Pseudo = typeof pseudos[number];
export type EditContext = { media: string[]; pseudo: Pseudo };
export type MediaContext = { queries: string[]; source: 'readable rule' | 'session override' };
export const baseContext = (): EditContext => ({ media: [], pseudo: '' });
export const contextKey = (context: EditContext) => JSON.stringify([context.media, context.pseudo]);
export function discoverMedia(source: SelectedSources): { contexts: MediaContext[]; limited: boolean } {
  const contexts = new Map<string, MediaContext>();
  for (const match of source.matches) {
    const media = match.context.media;
    if (media.length && match.editable) contexts.set(JSON.stringify(media), { queries: media, source: 'readable rule' });
  }
  return { contexts: [...contexts.values()], limited: source.notices.length > 0 };
}
