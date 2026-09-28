import { useUI } from '../state/ui';
import { InspectorShell } from './inspector/InspectorShell';
import { BottomDock } from './dock/BottomDock';
import { Navigator } from './navigator/Navigator';
import { ChangesSurface } from './changes/ChangesSurface';
import s from './ui.module.css';
export function App() {
  const inspector = useUI(state => state.inspectorOpen);
  const surface = useUI(state => state.surface);
  return <div className={s.app} data-cssforge="phase-01">{inspector && <InspectorShell />}<BottomDock />{surface === 'navigator' && <Navigator />}{surface === 'changes' && <ChangesSurface />}</div>;
}
