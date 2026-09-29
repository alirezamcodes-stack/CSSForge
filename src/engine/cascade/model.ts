import type { EditContext } from '../../editing/contexts';
import type { Declaration, SourceRule, SourceSheet } from '../sources/model';
import type { Specificity } from './specificity';

export type Issue = 'inaccessible-source' | 'source-limit' | 'unsupported-context' | 'unsupported-selector' | 'unsupported-layer-order' | 'unsupported-source-order' | 'unsupported-shorthand' | 'unsupported-keyword' | 'unknown-inheritance' | 'registered-custom-property' | 'shadow-scope' | 'unindexed-origin' | 'animation-or-transition' | 'logical-property';
export type LossReason = 'important' | 'inline' | 'layer-order' | 'specificity' | 'source-order' | 'session-edit';
export type Candidate = {
  declaration: Declaration; rule: SourceRule; source: SourceSheet;
  property: string; value: string; selector?: string; specificity: Specificity;
  order: readonly [number, number, number]; layer: number | null;
  state: 'matched' | 'inactive' | 'unresolved'; inactiveReason?: 'media' | 'supports' | 'pseudo' | 'disabled' | 'selector'; issues: Issue[];
};
export type PropertyCascade = {
  property: string; confidence: 'resolved' | 'incomplete' | 'unresolved';
  /** Only certain within the declared readable-author scope; never a computed value. */
  winner?: Candidate; readableWinner?: Candidate;
  matched: Candidate[]; inactive: Candidate[]; unresolved: Candidate[];
  overridden: { candidate: Candidate; reason: LossReason; bySessionEdit: boolean }[];
  importantAffected: boolean;
  inherited?: { from: Element; declaration?: Candidate };
  cssforge: Candidate[]; defaulting?: 'initial' | 'inherit'; issues: Issue[];
};
export type CascadeResult = {
  context: EditContext; properties: Record<string, PropertyCascade>;
  scope: 'readable-author'; browserEquivalent: false; issues: Issue[];
};
