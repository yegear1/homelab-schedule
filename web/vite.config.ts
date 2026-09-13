import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/contacts': {
        target: 'http://192.168.0.201:8003',
        changeOrigin: true,
      },
      '/jobs': {
        target: 'http://192.168.0.201:8003',
        changeOrigin: true,
      },
      '/templates': {
        target: 'http://192.168.0.201:8003',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://192.168.0.201:8003',
        changeOrigin: true,
      },
    }
  }
});
