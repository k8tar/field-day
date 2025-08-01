import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [
    vue({
      // Explicitly configure Vue plugin for better Docker compatibility
      template: {
        compilerOptions: {
          // Ensure proper Vue template compilation in Docker
          isCustomElement: (tag) => false
        }
      }
    }),
    // No API middleware - all API calls handled by backend service on port 3030
  ],
  base: './', // Use relative paths for assets - needed for Electron
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    // Ensure proper build configuration for Docker
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false
  },
  server: {
    host: '0.0.0.0', // Listen on all interfaces, not just localhost
    port: 8080,
    strictPort: true, // Force port 8080, fail if unavailable
    cors: true,
    // Frontend only serves UI - all API calls go to backend service on port 3030
  },
});