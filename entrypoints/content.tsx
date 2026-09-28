import { createRoot } from 'react-dom/client';
import { App } from '../src/ui/App';
import '../src/styles/tokens.css';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  registration: 'runtime',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'cssforge-ui', position: 'inline', anchor: 'body', isolateEvents: true,
      onMount(container) {
        const root = createRoot(container);
        root.render(<App />);
        return root;
      },
      onRemove(root) { root?.unmount(); },
    });
    ui.mount();
    let mounted = true;
    const listener = (message: { type?: string }) => {
      if (message.type !== 'cssforge:toggle') return;
      if (mounted) ui.remove(); else ui.mount();
      mounted = !mounted;
    };
    browser.runtime.onMessage.addListener(listener);
    ctx.onInvalidated(() => { browser.runtime.onMessage.removeListener(listener); ui.remove(); });
  },
});
