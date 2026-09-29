import type { EditContext } from '../../editing/contexts';

/** Session identities are bookkeeping, not original file locations. */
export type SourceIdentity = string;
export type SourceAccessibility = { readable: true } | { readable: false; reason: 'security' | 'unavailable'; message: string };
export type RuleContext = {
  id: SourceIdentity; kind: 'media' | 'supports' | 'layer' | 'container' | 'style' | 'group';
  text: string; condition?: string; name?: string; matches: boolean | null;
};
export type Declaration = {
  id: SourceIdentity; sourceId: SourceIdentity; ruleId: SourceIdentity; contexts: RuleContext[];
  property: string; value: string; priority: string; important: boolean; order: number; enabled: boolean;
};
export type SourceRule = {
  id: SourceIdentity; sourceId: SourceIdentity; path: number[]; order: number;
  kind: 'style' | 'group' | 'keyframes' | 'keyframe' | 'other' | 'inline' | 'override';
  selectorText?: string; name?: string; keyText?: string; cssText: string;
  contexts: RuleContext[]; declarations: Declaration[]; children: SourceRule[]; animationNames: string[];
  accessibility: SourceAccessibility;
  /** Only session override rules have an editable session context. */
  editContext?: EditContext;
};
export type SourceSheet = {
  id: SourceIdentity; scopeId: SourceIdentity;
  kind: 'style' | 'linked' | 'adopted' | 'inline' | 'override';
  label: string; url: string | null; order: number; disabled: boolean;
  accessibility: SourceAccessibility; rules: SourceRule[];
};
export type RuleMatch = { rule: SourceRule; source: SourceSheet; context: EditContext; editable: boolean };
export type SelectedSources = {
  scopeId: SourceIdentity; sheets: SourceSheet[]; inline: SourceSheet;
  matches: RuleMatch[]; keyframes: SourceRule[]; notices: string[];
};
export type SessionGroup = { context: EditContext; declarations: { property: string; value: string; enabled: boolean }[] };
