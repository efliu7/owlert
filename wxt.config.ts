import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  webExt: { disabled: true },
  dev: {
    server: {
      port: 3000,
      strictPort: true,
    },
  },
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Owlert',
    description: 'Your courses change. Stay ahead.',
    minimum_chrome_version: '116',
    permissions: ['storage', 'sidePanel'],
    host_permissions: ['https://westernu.brightspace.com/*'],
    action: { default_title: 'Open Owlert' },
  },
});
