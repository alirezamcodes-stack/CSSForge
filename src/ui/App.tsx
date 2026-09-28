import { useUI } from '../state/ui';
import { InspectorShell } from './inspector/InspectorShell';
import { BottomDock } from './dock/BottomDock';
import { Navigator } from './navigator/Navigator';
import { ChangesSurface } from './changes/ChangesSurface';
import s from './ui.module.css';
import { useLayoutEffect, useRef } from 'react';
import { useEscapePolicy } from './interactions/useEscapePolicy';
import { registerUIRoot } from './interactions/focus';
import { InspectionContext, useInspection } from '../picker/context';
import type { Picker } from '../picker/controller';
import { LiveSurface } from './inspector/LiveInspection';
export function App({ preview = false, picker, deactivate }: { preview?: boolean; picker?: Picker; deactivate?: () => void }) {
  return <InspectionContext.Provider value={{ preview, picker, deactivate }}><AppShell /></InspectionContext.Provider>;
}
function AppShell() {
  const { preview, picker } = useInspection();
  const surface = useUI(state => state.surface);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { registerUIRoot(ref.current); return () => registerUIRoot(null); }, []);
  useLayoutEffect(() => { picker?.setSuspended(!!surface); }, [surface, picker]);
  useEscapePolicy(ref);
  return <div ref={ref} className={s.app} data-cssforge={preview ? 'preview' : 'phase-05'} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}><div className={s.baseUI} inert={surface !== null}><InspectorShell /><BottomDock /></div>{preview ? <>{surface === 'navigator' && <Navigator />}{surface === 'changes' && <ChangesSurface />}</> : surface && <LiveSurface surface={surface} />}</div>;
}
