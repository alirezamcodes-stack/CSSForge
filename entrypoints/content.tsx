import { createRoot } from 'react-dom/client';
import { App } from '../src/ui/App';
import '../src/styles/tokens.css';
import { createPicker, type Picker } from '../src/picker/controller';
import { useUI } from '../src/state/ui';
import { createAuthorLedger } from '../src/engine/mutation';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  registration: 'runtime',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const authorLedger = createAuthorLedger(document);
    let picker: Picker | undefined;
    let mounted = false;
    let unsubscribe: (() => void) | undefined;
    const deactivate = () => {
      if (!mounted) return;
      mounted = false; unsubscribe?.(); unsubscribe = undefined;
      picker?.destroy(); picker = undefined; ui.remove();
    };
    const ui = await createShadowRootUi(ctx, {
      name: 'cssforge-ui', position: 'inline', anchor: 'body', isolateEvents: true,
      css: ':host::backdrop{display:none!important;pointer-events:none!important}',
      onMount(container) {
        const host = (container.getRootNode() as ShadowRoot).host as HTMLElement;
        // A manual top-layer host has a viewport containing block, independent of
        // page transforms and stacking. Only existing UI controls receive input.
        for (const [property, value] of Object.entries({ position: 'fixed', inset: '0', margin: '0', padding: '0', border: '0', width: '100%', height: '100%', overflow: 'visible', 'pointer-events': 'none' })) host.style.setProperty(property, value, 'important');
        host.setAttribute('popover', 'manual');
        picker = createPicker(document, host, () => useUI.getState().setInspector(true), authorLedger);
        // The picker mounts its noninteractive feedback first. The shell is the
        // next top-layer entry, so all its controls paint above that feedback.
        host.showPopover();
        // UI flags stay in Zustand; target Elements remain owned by the controller.
        useUI.setState({ activePopover: null, surface: null, activeTooltip: null, activeDockTool: null, inspectorOpen: true });
        unsubscribe = useUI.subscribe((next, previous) => {
          picker?.setSuspended(!!next.surface);
          if (next.inspectorPosition !== previous.inspectorPosition) picker?.refresh();
        });
        const root = createRoot(container);
        root.render(<App picker={picker} deactivate={deactivate} />);
        picker.start();
        return root;
      },
      onRemove(root) { root?.unmount(); },
    });
    ui.mount();
    mounted = true;
    const listener = (message: { type?: string }) => {
      if (message.type !== 'cssforge:toggle') return;
      if (mounted) deactivate(); else { ui.mount(); mounted = true; }
    };
    browser.runtime.onMessage.addListener(listener);
    const pageLost = () => { deactivate(); authorLedger.retire('Document navigation or replacement.'); };
    window.addEventListener('pagehide', pageLost);
    ctx.onInvalidated(() => { browser.runtime.onMessage.removeListener(listener); window.removeEventListener('pagehide', pageLost); pageLost(); });
  },
});
