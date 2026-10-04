import { defineConfig } from '@playwright/test';
import { evidencePath } from './tests/e2e/evidence';
// Share one fresh root across workers. An explicit root must also stay in .preview.
process.env.CSSFORGE_EVIDENCE_DIR ??= `.preview/verification/${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  outputDir: evidencePath('results'),
  retries: 0,
  // Observational collectors and historical comparisons are explicit commands.
  grepInvert: /@diagnostic|@historical/,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 1100 }, trace: 'retain-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js --config vite.preview.config.ts --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
