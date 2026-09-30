import type { TargetLocator, LocatorResolution } from '../locator';

export type ReconciliationState = 'active-original' | 'waiting-for-replacement' | 'replacement-resolved' | 'migrated' | 'ambiguous' | 'missing' | 'root-mismatch' | 'unsupported' | 'migration-rejected' | 'retired';
export type ReconciliationResult = Readonly<{
  state: ReconciliationState; generation: number; attempts: number; reason: string;
  locator: TargetLocator | null; resolution: LocatorResolution | null; element: Element | null;
}>;
export const reconciliationLimits = Object.freeze({ windowMs: 1200, retries: 6, recordsPerDelivery: 64, recordsTotal: 192, nodesPerDelivery: 64, nodesTotal: 192, regionAncestors: 8, migrationsPerTarget: 16 });
