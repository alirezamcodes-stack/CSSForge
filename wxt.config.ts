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
    name: 'CSSForge',
    description: 'Inspect page elements and edit core Design properties with reversible, local session overrides.',
    permissions: ['activeTab', 'scripting'],
    action: { default_title: 'Toggle CSSForge' },
  },
});
