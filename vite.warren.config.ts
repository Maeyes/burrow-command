import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Standalone build of the Burrow Command prototype (art-test/dimraeth-slice/warren.html),
// for sharing with friends. Output: dist-warren/. Serve it with `npx vite preview --config vite.warren.config.ts`.
// Monster rosters load their frames by absolute URL (not through the asset graph), so the
// forest roster folder is copied in as-is.
const COPY = ['art-test/monster-generation/pixellab-forest-roster-2026-09-21/objects'];

function copyRosterFrames(): Plugin {
  return {
    name: 'warren-copy-roster-frames',
    apply: 'build',
    closeBundle() {
      for (const rel of COPY) fs.cpSync(path.resolve(__dirname, rel), path.resolve(__dirname, 'dist-warren', rel), { recursive: true });
      // site root opens the game (GitHub Pages serves index.html); .nojekyll = publish files as-is
      const out = path.resolve(__dirname, 'dist-warren');
      fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Burrow Command</title><meta http-equiv="refresh" content="0;url=art-test/dimraeth-slice/warren.html"><a href="art-test/dimraeth-slice/warren.html">Play Burrow Command</a>');
      fs.writeFileSync(path.join(out, '.nojekyll'), '');
    },
  };
}

// WARREN_BASE=/<repo>/ for a GitHub Pages project site; default '/' (tunnel / root hosting).
export default defineConfig({
  base: process.env.WARREN_BASE || '/',
  plugins: [copyRosterFrames()],
  publicDir: false, // public/ holds the main game's assets (incl. art we may not redistribute); the prototype needs none of it
  build: {
    outDir: 'dist-warren',
    emptyOutDir: true,
    target: 'es2022', // the prototype uses top-level await
    rollupOptions: { input: { warren: path.resolve(__dirname, 'art-test/dimraeth-slice/warren.html') } },
  },
  preview: { port: 4174, strictPort: true, allowedHosts: ['.trycloudflare.com'] }, // quick-tunnel links only
});
