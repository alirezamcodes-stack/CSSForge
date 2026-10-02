import type { EditContext } from '../../editing/contexts';
import type { RuleContext, SourceSheet } from '../sources/model';
import type { SourceIndex } from '../sources';

export type MutationPolicy = { mode: 'SESSION_OVERRIDE' | 'SAFE_AUTHOR_MUTATION'; allowShared?: boolean };
export type DeclarationSnapshot = { exists: boolean; value: string; priority: string };
export type MutationScope = { kind: 'target-specific' | 'shared-rule' | 'unknown'; matchedCount: number; bounded: boolean; risk: 'local' | 'shared' | 'unknown' };
export type NativeBinding = NonNullable<ReturnType<SourceIndex['binding']>>;
export type MutationTarget = Readonly<{
  sourceId: string; ruleId: string; declarationId: string; property: string;
  sourceKind: SourceSheet['kind']; authoredValue: string; priority: string;
  root: Document | ShadowRoot; binding: NativeBinding; context: EditContext; ancestry: RuleContext[];
  writable: 'unverified' | 'accepted' | 'rejected'; strategy: 'inline-declaration' | 'cssom-declaration';
  certainty: 'certain-local-author'; scope: MutationScope; rollback: DeclarationSnapshot;
  cssText: string; selector: string | null; generation: number;
}>;
export type MutationRequest = { element: Element; property: string; value: string; context: EditContext; allowShared?: boolean; priority?: '' | 'important'; sourceId?: string; ruleId?: string; declarationId?: string; inline?: boolean };
export type AuthorRecordState = 'applied' | 'partial-write' | 'blocked' | 'resolved' | 'retired';
type AuthorRecord = {
  readonly target: MutationTarget; readonly before: DeclarationSnapshot; readonly after: DeclarationSnapshot;
  readonly attempted: DeclarationSnapshot; current: DeclarationSnapshot;
  readonly beforeCSS: string; readonly afterCSS: string; readonly generation: number;
  readonly session: object; readonly strategy: MutationTarget['strategy']; state: AuthorRecordState; reason?: string;
  owner?: { session: object; targetId: string; order?: number };
};
export type AppliedAuthorChange = AuthorRecord & { readonly kind: 'applied' };
export type PartialAuthorChange = AuthorRecord & { readonly kind: 'partial' };
export type AuthorChange = AppliedAuthorChange | PartialAuthorChange;
export type MutationResult = { state: 'mutated'; change: AppliedAuthorChange; target: MutationTarget } | { state: 'unchanged'; target: MutationTarget } | { state: 'fallback' | 'rejected'; reason: string; safeFallback: boolean; target?: MutationTarget; scope?: MutationScope; change?: PartialAuthorChange };
export const mutationLimits = { scopeElements: 512, scopeBranches: 80, scopeSelectorLength: 8000, authorRecords: 256 } as const;
