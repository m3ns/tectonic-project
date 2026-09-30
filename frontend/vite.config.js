import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Strict CSP is injected into the production build only (dev HMR needs inline scripts).
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";
const cspPlugin = () => ({
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
  ],
});

export default defineConfig({
  plugins: [react(), cspPlugin()],
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', xfwd: true } },
  },
});
