import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Standalone build of the Burrow Command prototype (art-test/dimraeth-slice/warren.html),
// for sharing with friends. Output: dist-warren/. Serve it with `npx vite preview --config vite.warren.config.ts`.
// Monster rosters load their frames by absolute URL (not through the asset graph), so the
// forest roster folder is copied in as-is.
const COPY = [
  'art-test/monster-generation/pixellab-forest-roster-2026-09-21/objects',
  'art-test/monster-generation/pixellab-desert-roster-2026-09-21/objects',
  // UI-built relic URLs are runtime strings; Vite does not discover these as imports.
  'art-test/dimraeth-slice/assets/relics',
];
// Explicit UI-icon allowlist. Never copy public/ wholesale into the standalone game.
const UI_ICON_FOLDERS=['equipment','items','family'];
const UI_ICON_NAMES=['gear','craft','skill','home'];

function copyRosterFrames(): Plugin {
  return {
    name: 'warren-copy-roster-frames',
    apply: 'build',
    closeBundle() {
      for (const rel of COPY) fs.cpSync(path.resolve(__dirname, rel), path.resolve(__dirname, 'dist-warren', rel), { recursive: true });
      // Bring along only the main-game item/family icons used by the RPG modals (no unrelated public assets).
      const srcIcons=path.resolve(__dirname,'public/assets/icons'),destIcons=path.resolve(__dirname,'dist-warren/assets/icons');
      for(const folder of UI_ICON_FOLDERS){
        const src=path.join(srcIcons,folder),dest=path.join(destIcons,folder);
        if(!fs.existsSync(src))continue;
        fs.mkdirSync(dest,{recursive:true});
        for(const file of fs.readdirSync(src))if(file.endsWith('.png'))fs.copyFileSync(path.join(src,file),path.join(dest,file));
      }
      fs.mkdirSync(path.join(destIcons,'ui'),{recursive:true});
      for(const name of UI_ICON_NAMES){const src=path.join(srcIcons,'ui',name+'.png');if(fs.existsSync(src))fs.copyFileSync(src,path.join(destIcons,'ui',name+'.png'));}
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
