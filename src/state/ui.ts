import { create } from 'zustand';

export type Task = 'Design' | 'Code' | 'HTML';
export type Surface = 'navigator' | 'changes' | null;
type UIState = {
  activeTask: Task;
  collapsed: string[];
  activePopover: string | null;
  surface: Surface;
  inspectorOpen: boolean;
  setTask: (task: Task) => void;
  toggleSection: (name: string) => void;
  setPopover: (id: string | null) => void;
  setSurface: (surface: Surface) => void;
  setInspector: (open: boolean) => void;
};
export const useUI = create<UIState>((set) => ({
  activeTask: 'Design', collapsed: [], activePopover: null, surface: null, inspectorOpen: true,
  setTask: (activeTask) => set({ activeTask, activePopover: null }),
  toggleSection: (name) => set(({ collapsed }) => ({ collapsed: collapsed.includes(name) ? collapsed.filter(x => x !== name) : [...collapsed, name] })),
  setPopover: (activePopover) => set({ activePopover }),
  setSurface: (surface) => set({ surface, activePopover: null }),
  setInspector: (inspectorOpen) => set({ inspectorOpen, activePopover: null }),
}));
