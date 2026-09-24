import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({ root: __dirname, publicDir: resolve(__dirname, '../../public'), server: { port: 4178, strictPort: true, host: '127.0.0.1' } });
