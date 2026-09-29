import { matchingContexts, walkReadable } from './readable';
export const pseudos = ['', ':hover', ':focus', ':active', '::before', '::after'] as const;
export type Pseudo = typeof pseudos[number];
export type EditContext = { media: string[]; pseudo: Pseudo };
export type MediaContext = { queries: string[]; source: 'readable rule' | 'session override' };
export const baseContext = (): EditContext => ({ media: [], pseudo: '' });
export const contextKey = (context: EditContext) => JSON.stringify([context.media, context.pseudo]);
export function discoverMedia(element: Element): { contexts: MediaContext[]; limited: boolean } {
  const contexts = new Map<string, MediaContext>();
  const notices = walkReadable(element, (rule, media) => {
    if (media.length && matchingContexts(element, rule.selectorText).some(match => match.editable)) contexts.set(JSON.stringify(media), { queries: media, source: 'readable rule' });
  });
  return { contexts: [...contexts.values()], limited: notices.length > 0 };
}
