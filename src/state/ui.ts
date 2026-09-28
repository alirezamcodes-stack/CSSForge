import { create } from 'zustand';
import { captureSurfaceOrigin, restorePopoverFocus } from '../ui/interactions/focus';
import { fixtureMedia, fixturePseudo, fixtureFonts } from '../fixtures/options';

export type Task = 'Design' | 'Code' | 'HTML';
export type Surface = 'navigator' | 'changes' | null;
export type Position = { x: number; y: number };
const dockPopovers = ['Background tools', 'Measurement tools', 'Color tools', 'Eyedropper information', 'More tools'] as const;
export type DockTool = typeof dockPopovers[number] | Exclude<Surface, null>;
const dockToolFor = (id: string | null): DockTool | null => dockPopovers.includes(id as typeof dockPopovers[number]) ? id as DockTool : null;
type UIState = {
  activeTask: Task;
  collapsed: string[];
  activePopover: string | null;
  surface: Surface;
  inspectorOpen: boolean;
  inspectorPosition: Position | null;
  selectedFixtureMedia: string;
  selectedFixturePseudo: string;
  selectedFixtureFont: string;
  selectedFixtureNode: string;
  activeDockTool: DockTool | null;
  previewPaused: boolean;
  activeTooltip: string | null;
  setTask: (task: Task) => void;
  toggleSection: (name: string) => void;
  setPopover: (id: string | null) => void;
  setSurface: (surface: Surface) => void;
  setInspector: (open: boolean) => void;
  setPosition: (position: Position | null) => void;
  selectFixture: (kind: 'Media' | 'Pseudo' | 'Font', value: string) => void;
  selectNode: (id: string) => void;
  togglePause: () => void;
  setTooltip: (id: string | null) => void;
  dismissTopLayer: () => boolean;
};
export const useUI = create<UIState>((set, get) => ({
  activeTask: 'Design', collapsed: [], activePopover: null, surface: null, inspectorOpen: true,
  inspectorPosition: null, selectedFixtureMedia: fixtureMedia[0], selectedFixturePseudo: fixturePseudo[0], selectedFixtureFont: fixtureFonts[0], selectedFixtureNode: 'card', activeDockTool: null, previewPaused: false, activeTooltip: null,
  setTask: (activeTask) => set({ activeTask, activePopover: null, activeDockTool: get().surface, activeTooltip: null }),
  toggleSection: (name) => set(({ collapsed }) => ({ collapsed: collapsed.includes(name) ? collapsed.filter(x => x !== name) : [...collapsed, name] })),
  setPopover: (activePopover) => set({ activePopover, activeDockTool: get().surface ?? dockToolFor(activePopover), activeTooltip: null }),
  setSurface: (surface) => {
    if (surface && !get().surface) captureSurfaceOrigin(get().activePopover);
    set({ surface, activePopover: null, activeDockTool: surface, activeTooltip: null });
  },
  setInspector: (inspectorOpen) => set({ inspectorOpen, activePopover: null, activeTooltip: null, activeDockTool: get().surface, previewPaused: false }),
  setPosition: (inspectorPosition) => set({ inspectorPosition }),
  selectFixture: (kind, value) => {
    const options = { Media: fixtureMedia, Pseudo: fixturePseudo, Font: fixtureFonts };
    if (!options[kind].includes(value)) return;
    set({ [`selectedFixture${kind}`]: value });
  },
  selectNode: (selectedFixtureNode) => set({ selectedFixtureNode }),
  togglePause: () => set(state => ({ previewPaused: !state.previewPaused, inspectorOpen: state.previewPaused, activePopover: null, activeTooltip: null, activeDockTool: state.surface })),
  setTooltip: (activeTooltip) => set({ activeTooltip }),
  dismissTopLayer: () => {
    const { activePopover, surface, activeTooltip } = get();
    if (activePopover) { get().setPopover(null); restorePopoverFocus(activePopover); return true; }
    if (surface) { get().setSurface(null); return true; }
    if (activeTooltip) { set({ activeTooltip: null }); return true; }
    return false;
  },
}));
