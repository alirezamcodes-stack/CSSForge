import { beforeEach, describe, expect, it } from 'vitest';
import { useUI } from '../src/state/ui';

beforeEach(() => useUI.setState({ activeTask: 'Design', collapsed: [], activePopover: null, surface: null, inspectorOpen: true }));
describe('UI transitions', () => {
  it('closes transient menus when the task changes', () => {
    useUI.getState().setPopover('Font family');
    useUI.getState().setTask('Code');
    expect(useUI.getState()).toMatchObject({ activeTask: 'Code', activePopover: null });
  });
  it('toggles sections independently', () => {
    useUI.getState().toggleSection('Spacing');
    useUI.getState().toggleSection('Filters');
    useUI.getState().toggleSection('Spacing');
    expect(useUI.getState().collapsed).toEqual(['Filters']);
  });
  it('allows only one dedicated surface and closes its triggering popover', () => {
    useUI.getState().setSurface('navigator');
    useUI.getState().setPopover('More tools');
    useUI.getState().setSurface('changes');
    expect(useUI.getState()).toMatchObject({ surface: 'changes', activePopover: null });
  });
});
