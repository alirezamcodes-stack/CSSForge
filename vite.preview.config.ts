import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { port: 5173, strictPort: true,
  // Audit Chrome profiles contain locked cookie files; they are not preview sources.
  watch: { ignored: ['**/.preview/**', '**/test-results/**', '**/artifacts/**'] },
} });
