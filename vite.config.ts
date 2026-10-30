import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
  },
});
