import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    proxy: {
      '/contacts': 'http://localhost:8003',
      '/jobs': 'http://localhost:8003',
      '/templates': 'http://localhost:8003',
      '/health': 'http://localhost:8003'
    }
  }
});
