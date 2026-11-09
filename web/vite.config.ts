import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const target = env.SCHEDULE_DEV_API_URL || 'http://localhost:8003';
  const proxy: Record<string, ProxyOptions> = {};
  for (const prefix of ['/contacts', '/jobs', '/templates', '/health', '/backup', '/routines', '/housekeeping']) {
    proxy[prefix] = {
      target,
      changeOrigin: true,
      // Browser document navigation belongs to the SPA, even on shared API paths.
      bypass(request: { method?: string; headers: { accept?: string } }) {
        if (request.method === 'GET' && request.headers.accept?.includes('text/html')) {
          return '/index.html';
        }
      },
    };
  }
  return {
    plugins: [react(), tailwindcss()],
    server: { host: '127.0.0.1', port: 5173, proxy },
  };
});
