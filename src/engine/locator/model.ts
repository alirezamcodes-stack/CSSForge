import type { TargetIdentity } from '../../picker/targetLifecycle';

export type AttributeEvidence = Readonly<{ name: string; value: string; kind: 'stable' | 'semantic' }>;
export type ElementEvidence = Readonly<{ namespace: string | null; tag: string; id?: string; attributes: readonly AttributeEvidence[]; classes: readonly string[]; sibling: Readonly<{ index: number; truncated: boolean }> }>;
export type EvidenceKey = Readonly<{ kind: 'id' | 'data' | 'semantic'; attributes: readonly { name: string; value: string }[]; uniqueAtCapture: boolean }>;
export type AncestorEvidence = Readonly<{ evidence: ElementEvidence; key: EvidenceKey; targetUniqueAtCapture: boolean }>;
export type RootBoundary = Readonly<{ host: Element; root: ShadowRoot; evidence: ElementEvidence }>;
/** Runtime handles stay inside the engine. This is neither a display label nor an export selector. */
export type TargetLocator = Readonly<{
  version: 1; generation: number; identity: TargetIdentity; document: Document;
  frame: Readonly<{ kind: 'top-document'; identity: null }>;
  root: Document | ShadowRoot; boundaries: readonly RootBoundary[];
  evidence: ElementEvidence; keys: readonly EvidenceKey[]; ancestors: readonly AncestorEvidence[];
  truncated: boolean; unsupportedRoot: boolean;
}>;
export type ResolutionState = 'original-valid' | 'resolved-unique' | 'ambiguous' | 'missing' | 'root-mismatch' | 'document-mismatch' | 'unsupported-frame' | 'unsafe' | 'truncated';
export type LocatorResolution = Readonly<{
  state: ResolutionState; element: Element | null; candidateCount: number;
  confidence: 'original' | 'strong' | 'insufficient' | 'none'; evidenceUsed: readonly string[];
  reason: string; rejected: readonly { element: Element; reasons: readonly string[] }[];
}>;
export type ResolveRequest = { document?: Document; frame?: 'top-document' | 'interior'; candidate?: Element };
export type LocatorLimits = { candidates: number; ancestors: number; queries: number; shadowDepth: number };
