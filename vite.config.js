import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// `npm run staging` runs this local web app against the hosted staging server. The browser only ever
// talks to localhost: Vite passes API calls and live connections on to staging, so sign-in cookies work.
const STAGING_SERVER = 'https://staging.api.filesystem.one';
const STAGING_SITE = 'https://staging.filesystem.one';
const toStaging = { target: STAGING_SERVER, changeOrigin: true, headers: { origin: STAGING_SITE } };
// Live connections share their paths with pages, so only connection upgrades are passed on.
const liveToStaging = { ...toStaging, ws: true, bypass: (req) => (req.headers.upgrade ? undefined : req.url) };
const stagingProxy = { '/api': toStaging, '/notifications': liveToStaging, '/yjs': liveToStaging };
const stagingValues = {
  'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api/v1'),
  'import.meta.env.VITE_WS_BASE_URL': JSON.stringify('ws://localhost:8083')
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 8083,
    proxy: mode === 'staging' ? stagingProxy : undefined
  },
  define: mode === 'staging' ? stagingValues : {},
  optimizeDeps: {
    // Exclude the PDF.js worker from Vite's pre-bundling so the
    // `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`
    // pattern in PdfViewer resolves correctly at runtime.
    exclude: ['pdfjs-dist']
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
      // y-monaco@0.1.6 imports monaco-editor's pre-exports-map deep path.
      // monaco-editor >=0.52 maps "./*" to "./esm/vs/*.js", so the legacy
      // specifier resolves to a doubled esm/vs/ path. Rollup enforces the
      // exports map where esbuild did not, so rewrite it to the supported
      // subpath. Remove once y-monaco ships a fixed import.
      'monaco-editor/esm/vs/editor/editor.api.js': 'monaco-editor/editor/editor.api.js',
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
}));
