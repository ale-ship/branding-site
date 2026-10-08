import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The staff back office (docs/BACKEND_RUNBOOK.md, step B4). Served under /admin/ by nginx on the VPS,
// next to /api/, so the staff cookie (Path=/api/staff, SameSite=Strict) is same-origin. In
// development, `npm run admin` serves it on http://localhost:3300 and passes /api to the API on 4300.
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: {
    port: 3300,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:4300' },
  },
  preview: {
    port: 3300,
    proxy: { '/api': 'http://127.0.0.1:4300' },
  },
});
