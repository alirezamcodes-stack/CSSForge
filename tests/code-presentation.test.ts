import { describe, it, expect } from 'vitest';
import { adjacentSourceRuns } from '../src/ui/code/sourcePresentation';
import type { SourceGroup } from '../src/editing/readable';
const group = (patch: Partial<SourceGroup> = {}): SourceGroup => ({ label: '<style>', selector: '.target', context: { media: ['print'], pseudo: '' }, conditions: ['@media print'], editable: true, declarations: [{ sourceId: 'sheet-a', ruleId: 'rule-a', property: 'color', value: 'red', priority: '' }], ...patch });
describe('adjacent source metadata presentation', () => {
  it('shares metadata while retaining the exact original ordered records', () => {
    const records = [group(), group({ selector: '.target::before', context: { media: ['print'], pseudo: '::before' } }), group({ selector: '.target::after', context: { media: ['print'], pseudo: '::after' } })];
    const original = structuredClone(records), runs = adjacentSourceRuns(records);
    expect(runs).toHaveLength(1); expect(runs[0].groups.map(item => item.group)).toEqual(original);
    runs[0].groups.forEach((item, index) => { expect(item.index).toBe(index); expect(item.group).toBe(records[index]); });
    expect(records).toEqual(original);
  });
  it('never infers a shared source from an identical source label', () => {
    const a = group(), b = group({ declarations: [{ ...a.declarations[0], sourceId: 'sheet-b' }] });
    expect(adjacentSourceRuns([a, b])).toHaveLength(2);
  });
  it('retains context and editability boundaries and never regroups nonadjacent rules', () => {
    const a = group(), b = group({ conditions: ['@supports (display: grid)', '@media print'] });
    expect(adjacentSourceRuns([a, b, a, group({ editable: false })])).toHaveLength(4);
    expect(adjacentSourceRuns([a, group({ context: { media: ['screen'], pseudo: '' } })])).toHaveLength(2);
  });
  it('keeps empty or unknown identity records separate', () => {
    const empty = group({ declarations: [] }), unknown = group({ declarations: [{ property: 'color', value: 'red', priority: '' }] });
    expect(adjacentSourceRuns([empty, empty, unknown, unknown])).toHaveLength(4);
  });
  it('rejects internally inconsistent source identity', () => {
    const a = group(), mixed = group({ declarations: [...a.declarations, { ...a.declarations[0], sourceId: 'sheet-b' }] });
    expect(adjacentSourceRuns([mixed, mixed])).toHaveLength(2);
  });
});
