import type { AuthorChange, MutationRequest, MutationTarget } from './model';

type Proof = { request: MutationRequest; headers: string[]; sheetMedia: string; parent: Node | null };

/** Live-document ownership only. No storage API, observers, timers or source discovery. */
export function createAuthorLedger(doc: Document) {
  let root = doc.documentElement, session = {}, generation = 0;
  let issued = new WeakMap<MutationTarget, Proof>();
  const changes = new Set<AuthorChange>();
  let retired = false, retiredCount = 0, reason: string | undefined;
  const retire = (why: string) => {
    for (const change of changes) { change.state = 'retired'; change.reason = why; }
    retiredCount += changes.size; changes.clear(); issued = new WeakMap();
    generation++; retired = true; reason = why;
  };
  const current = (token: object) => {
    if (root !== doc.documentElement && !retired) retire('Document tree was replaced.');
    return !retired && token === session;
  };
  return {
    retire, current,
    attach(document: Document) {
      if (document !== doc) throw new Error('Author recovery belongs to another document.');
      current(session);
      if (retired) { root = doc.documentElement; session = {}; retired = false; }
      return { changes, issued, session, generation: () => generation, advance: () => { generation++; } };
    },
    getSnapshot: () => ({ state: retired ? 'retired' as const : 'live' as const, pending: changes.size, retiredCount, reason }),
  };
}
export type AuthorLedger = ReturnType<typeof createAuthorLedger>;
