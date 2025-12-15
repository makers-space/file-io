import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8083
  },
  css: {
    // CSS preprocessing
    preprocessorOptions: {
      // Add additional preprocessing options if needed
    },
    // Make sure CSS modules are properly processed
    modules: {
      scopeBehaviour: 'global'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@themes': path.resolve(__dirname, './src/themes'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@service': path.resolve(__dirname, './src/service')
    }
  }
});
