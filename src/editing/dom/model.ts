import type { TargetIdentity } from '../../picker/targetLifecycle';

export type TextFailure = { state: 'UNAVAILABLE' | 'STALE' | 'CONFLICT' | 'FAILED'; reason: string; change?:DOMTextChange };
export type TextPlan = Readonly<{
  targetId: string; bindingGeneration: number; identity: TargetIdentity;
  owner: Element; node: Text; root: Document | ShadowRoot; before: string; label: string;
}>;
export type DOMTextChange = {
  readonly kind: 'DOM_TEXT_MUTATION'; readonly plan: TextPlan;
  readonly before: string; readonly applied: string; readonly order: number;
  readonly transactionId: object; readonly session: object;
  current: string | null; state: 'applied' | 'superseded' | 'resolved' | 'retired' | TextFailure['state']; reason?: string;
};
export type TextResult = TextFailure | { state: 'unchanged' } | { state: 'applied'; change: DOMTextChange };
export type TextChangeRow = { kind: 'DOM_TEXT_MUTATION'; before: string; applied: string; current: string | null; bindingGeneration: number; available: boolean; state: DOMTextChange['state']; reason?: string };
