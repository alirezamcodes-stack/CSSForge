import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Picker, PickerState } from './controller';
import { emptyEditState } from '../editing/session';

export const InspectionContext = createContext<{ preview: boolean; picker?: Picker; deactivate?: () => void }>({ preview: false });
const empty: PickerState = { active: false, selection: null };
const subscribe = () => () => {};
const getEmpty = () => empty;
const emptyEdits = emptyEditState();
const getEmptyEdits = () => emptyEdits;
export function useEditing() {
  const { picker } = useContext(InspectionContext);
  const editor = picker?.editor;
  const state = useSyncExternalStore(editor?.subscribe ?? subscribe, editor?.getSnapshot ?? getEmptyEdits);
  return { editor, ...state };
}
export function useInspection() {
  const runtime = useContext(InspectionContext);
  const state = useSyncExternalStore(runtime.picker?.subscribe ?? subscribe, runtime.picker?.getSnapshot ?? getEmpty);
  return { ...runtime, ...state };
}
