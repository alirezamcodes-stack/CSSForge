import { beforeEach, describe, expect, it } from 'vitest';
import { useUI } from '../src/state/ui';

beforeEach(() => useUI.setState(useUI.getInitialState(), true));
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
  it('dismisses one layer per Escape and leaves the base inspector open', () => {
    useUI.getState().setSurface('changes');
    useUI.getState().setPopover('Nested menu');
    expect(useUI.getState().dismissTopLayer()).toBe(true);
    expect(useUI.getState()).toMatchObject({ activePopover: null, surface: 'changes' });
    expect(useUI.getState().dismissTopLayer()).toBe(true);
    expect(useUI.getState()).toMatchObject({ surface: null, inspectorOpen: true });
    expect(useUI.getState().dismissTopLayer()).toBe(false);
  });
  it('keeps dock states exclusive and clears temporary tools on dismissal', () => {
    useUI.getState().setPopover('Measurement tools');
    expect(useUI.getState().activeDockTool).toBe('Measurement tools');
    useUI.getState().setPopover('Color tools');
    expect(useUI.getState().activeDockTool).toBe('Color tools');
    useUI.getState().dismissTopLayer();
    expect(useUI.getState().activeDockTool).toBeNull();
    useUI.getState().setPopover('Font family');
    expect(useUI.getState().activeDockTool).toBeNull();
  });
  it('validates fixture choices and preserves them through task and visibility changes', () => {
    useUI.getState().selectFixture('Font', 'Arial, sans-serif');
    useUI.getState().selectFixture('Font', 'not a fixture');
    useUI.getState().selectFixture('Pseudo', ':hover');
    useUI.getState().setTask('HTML');
    useUI.getState().setInspector(false);
    useUI.getState().setInspector(true);
    expect(useUI.getState()).toMatchObject({ selectedFixtureFont: 'Arial, sans-serif', selectedFixturePseudo: ':hover' });
  });
  it('showing an inspector clears the paused state', () => {
    useUI.getState().togglePause();
    expect(useUI.getState()).toMatchObject({ previewPaused: true, inspectorOpen: false });
    useUI.getState().setInspector(true);
    expect(useUI.getState()).toMatchObject({ previewPaused: false, inspectorOpen: true });
  });
});
