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
export type AuthorChange = { target: MutationTarget; before: DeclarationSnapshot; after: DeclarationSnapshot; beforeCSS: string; afterCSS: string; generation: number; strategy: MutationTarget['strategy'] };
export type MutationResult = { state: 'mutated'; change: AuthorChange; target: MutationTarget } | { state: 'unchanged'; target: MutationTarget } | { state: 'fallback' | 'rejected'; reason: string; safeFallback: boolean; target?: MutationTarget; scope?: MutationScope };
export const mutationLimits = { scopeElements: 512 } as const;
