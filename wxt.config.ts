import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      // The toolbar invocation supplies activeTab; all-site access is unneeded.
      delete manifest.host_permissions;
    },
  },
  manifest: {
    name: 'CSSForge — UI Foundation',
    description: 'Phase 01 visual playground. Fixture controls do not edit the inspected page.',
    permissions: ['activeTab', 'scripting'],
    action: { default_title: 'Toggle CSSForge fixture inspector' },
  },
});
