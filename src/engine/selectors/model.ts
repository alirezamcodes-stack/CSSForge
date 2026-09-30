import type { RuleContext } from '../sources/model';

export type SelectorState = 'unique' | 'non-unique' | 'invalid' | 'unsupported' | 'truncated';
export type SelectorStrategy = 'stable-id' | 'id' | 'stable-attribute' | 'semantic' | 'class-based' | 'ancestor-assisted' | 'structural' | 'authored';
export type SelectorContext = Readonly<{ pseudo?: string; media?: readonly string[]; groups?: readonly RuleContext[] }>;
export type SelectorValidation = Readonly<{ state: SelectorState; count: number | null; matchesTarget: boolean }>;
export type SelectorSegment = Readonly<{
  root: Document | ShadowRoot; scope: 'document' | 'shadow-root'; target: Element;
  selector: string; strategy: SelectorStrategy; stability: 'high' | 'medium' | 'low';
  validation: SelectorValidation; boundary: 'open-shadow' | null;
}>;
export type SelectorResult = Readonly<{
  selector: string | null; origin: 'generated' | 'authored'; strategy: SelectorStrategy | null;
  root: Document | ShadowRoot; scope: 'document' | 'shadow-root'; state: SelectorState;
  validation: SelectorValidation; stability: 'high' | 'medium' | 'low'; risks: readonly string[];
  /** Document-to-leaf segments. Each host is queried in its parent root, never across a boundary. */
  path: readonly SelectorSegment[];
  frame: Readonly<{ kind: 'top-document' | 'unsupported-interior'; path: null }>;
  context: SelectorContext; limitations: readonly string[];
}>;
export type SelectorRequest = { refresh?: boolean; context?: SelectorContext; frame?: 'top-document' | 'interior' };
export const selectorLimits = Object.freeze({ ancestors: 8, shadowDepth: 8, classes: 6, attributes: 6, combinations: 24, attempts: 96, validations: 96, siblings: 128, length: 2048 });
