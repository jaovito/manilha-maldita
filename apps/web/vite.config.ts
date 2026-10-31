import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import deployment from './vercel.json' with { type: 'json' };

const securityHeaders = Object.fromEntries(
  deployment.headers.flatMap((rule) => rule.headers.map(({ key, value }) => [key, value])),
);

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_BUILD_NUMBER': JSON.stringify(String(Math.floor(Date.now() / 1000))),
  },
  server: {
    headers: securityHeaders,
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3001', ws: true } },
  },
  preview: {
    headers: securityHeaders,
    port: 4173,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3001', ws: true } },
  },
});
