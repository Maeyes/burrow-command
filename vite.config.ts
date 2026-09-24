import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Dev-only endpoint for the Dimraeth map editor: saves/lists painted maps as JSON files in
// art-test/dimraeth-slice/maps so they can be committed and loaded by the game.
function mapEditorFiles(): Plugin {
  const dir = path.resolve(__dirname, 'art-test/dimraeth-slice/maps');
  const safe = (n: string) => /^[a-z0-9_-]{1,40}$/.test(n);
  return {
    name: 'dimraeth-map-editor-files',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__maps', (req, res) => {
        fs.mkdirSync(dir, { recursive: true });
        const url = new URL(req.url || '/', 'http://x');
        const send = (code: number, body: unknown) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
        if (req.method === 'GET' && url.pathname === '/list') {
          return send(200, fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort());
        }
        if (req.method === 'POST' && url.pathname === '/save') {
          let raw = '';
          req.on('data', c => { raw += c; if (raw.length > 5e6) req.destroy(); });
          req.on('end', () => {
            try {
              const data = JSON.parse(raw);
              if (!safe(data.name)) return send(400, { error: 'name must be a-z, 0-9, - or _' });
              fs.writeFileSync(path.join(dir, `${data.name}.json`), JSON.stringify(data));
              send(200, { ok: true, name: data.name });
            } catch (e) { send(400, { error: String(e) }); }
          });
          return;
        }
        send(404, { error: 'not found' });
      });
    },
  };
}

export default defineConfig({
  plugins: [mapEditorFiles()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: !!process.env.PORT,
  },
});
