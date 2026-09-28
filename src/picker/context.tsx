import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Picker, PickerState } from './controller';

export const InspectionContext = createContext<{ preview: boolean; picker?: Picker; deactivate?: () => void }>({ preview: false });
const empty: PickerState = { active: false, selection: null };
const subscribe = () => () => {};
const getEmpty = () => empty;
export function useInspection() {
  const runtime = useContext(InspectionContext);
  const state = useSyncExternalStore(runtime.picker?.subscribe ?? subscribe, runtime.picker?.getSnapshot ?? getEmpty);
  return { ...runtime, ...state };
}
