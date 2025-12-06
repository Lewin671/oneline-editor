import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  server: {
    port: 5173,
    proxy: {
      '/lsp': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  optimizeDeps: {
    include: ['monaco-editor']
  },
  define: {
    'process.env': {},
    'process.pid': 0,
    'process.platform': '"browser"'
  }
});
