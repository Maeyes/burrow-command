/**
 * Combat FX Module
 * Approved raster FX only. Combat/AI/damage remain authoritative in ArenaV2Adapter.
 * FX instances are exposed as runtime actors so Dimraeth owns depth sorting + terrain occlusion.
 */
import fxManifest from '../../iso-arena-draft/fx/manifest.json';

const APPROVED_FRAME_URLS = import.meta.glob('../../iso-arena-draft/fx/approved/**/*.png', {
  query: '?url',
  import: 'default',
});

const approvedEntries = Array.isArray(fxManifest?.approved) ? fxManifest.approved : [];
const entryById = new Map(approvedEntries.map(entry => [entry.id, entry]));

function cleanApprovedDir(path = '') {
  return String(path).replace(/^\.\/approved\//, '').replace(/\/$/, '');
}
function frameKey(entry, index) {
  return `../../iso-arena-draft/fx/approved/${cleanApprovedDir(entry.path)}/frame_${String(index).padStart(3, '0')}.png`;
}
function sourceGroup(entry) {
  return cleanApprovedDir(entry.path).split('/')[0] || 'global';
}
function integerScale(value) {
  return Math.max(1, Math.round(Number(value) || 1));
}

class CombatFX {
  constructor() {
    this.fxQueue = [];
    this.fxAssets = new Map();
    this.loading = false;
    this.ready = false;
    this.selection = { biome: '', mapId: '' };
  }

  selectEntries({ biome = '', mapId = '' } = {}) {
    const normalizedMap = String(mapId || '').toLowerCase();
    const normalizedBiome = String(biome || '').toLowerCase();
    const globals = approvedEntries.filter(entry => sourceGroup(entry) === 'global');

    const exact = approvedEntries.filter(entry => sourceGroup(entry).toLowerCase() === normalizedMap);
    if (exact.length) return [...globals, ...exact];

    const biomeGroup = normalizedBiome === 'mine'
      ? 'mine'
      : normalizedMap.startsWith('forest')
        ? normalizedMap
        : normalizedMap.startsWith('desert')
          ? normalizedMap
          : normalizedBiome;

    const biomeSpecific = approvedEntries.filter(entry => sourceGroup(entry).toLowerCase() === biomeGroup);
    return [...globals, ...biomeSpecific];
  }

  async init(context = {}) {
    if (this.loading) return;
    this.loading = true;
    this.ready = false;
    this.selection = { biome: context.biome || '', mapId: context.mapId || '' };
    this.fxAssets.clear();
    try {
      const selected = this.selectEntries(this.selection);
      await Promise.all(selected.map(entry => this.loadFXSequence(entry)));
      this.ready = true;
    } catch (error) {
      console.warn('[combat-fx] approved FX load failed:', error);
    } finally {
      this.loading = false;
    }
  }

  async loadFXSequence(entry) {
    if (!entry || !approvedEntries.includes(entry)) throw new Error('FX entry is not approved by manifest.json');
    const frames = [];
    for (let i = 0; i < entry.frameCount; i++) {
      const key = frameKey(entry, i);
      const resolveUrl = APPROVED_FRAME_URLS[key];
      if (!resolveUrl) throw new Error(`Approved FX frame missing from Vite asset graph: ${key}`);
      const src = await resolveUrl();
      frames.push(await this.loadImage(src));
    }
    this.fxAssets.set(entry.id, { entry, frames });
    return frames;
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load FX image: ${src}`));
      img.src = src;
    });
  }

  getRuntimeActors() {
    return this.fxQueue;
  }

  play(id, x, y, options = {}) {
    const asset = this.fxAssets.get(id);
    if (!asset?.frames?.length) return null;

    const { entry, frames } = asset;
    const first = frames[0];
    const scale = integerScale(options.scale ?? options.visualScale ?? 1);
    const anchor = entry.anchor || 'center';
    let ox = first.width / 2;
    let oy = first.height / 2;
    if (anchor === 'ground-center') oy = first.height;
    else if (anchor === 'left-ground-origin') { ox = 0; oy = first.height; }

    const frameMs = Math.max(1, Number(options.frameMs ?? entry.suggestedFrameMs ?? 50));
    const duration = Math.max(frameMs, Number(options.durationMs ?? frameMs * frames.length));
    const actor = {
      kind: 'actor',
      fx: true,
      fxId: id,
      x, y,
      z: 0,
      zOffset: Number(options.zOffset ?? 0),
      r: Math.max(1, Number(options.r ?? 2)),
      shadow: false,
      terrainOcclusion: true,
      visualScale: scale,
      ox,
      oy,
      frames,
      frameIndex: 0,
      ageMs: 0,
      frameMs,
      durationMs: duration,
      dead: false,
      getImage() { return this.frames[Math.min(this.frames.length - 1, this.frameIndex)] || null; },
    };
    this.fxQueue.push(actor);
    return actor;
  }

  playHitSpark(x, y, options = {}) {
    return this.play('global_hit_spark', x, y, { zOffset: options.zOffset ?? 34, ...options });
  }

  playTackle(x, y, options = {}) {
    return this.play('global_tackle_fx', x, y, options);
  }

  playNormalDeath(x, y, options = {}) {
    return this.play('global_normal_death', x, y, { zOffset: options.zOffset ?? 28, ...options });
  }

  playBossDeath(x, y, options = {}) {
    return this.play('global_boss_death_burst', x, y, { zOffset: options.zOffset ?? 42, ...options });
  }

  update(dt) {
    const deltaMs = Math.max(0, Number(dt) || 0) * 1000;
    for (let i = this.fxQueue.length - 1; i >= 0; i--) {
      const fx = this.fxQueue[i];
      fx.ageMs += deltaMs;
      if (fx.ageMs >= fx.durationMs) {
        this.fxQueue.splice(i, 1);
        continue;
      }
      fx.frameIndex = Math.min(fx.frames.length - 1, Math.floor(fx.ageMs / fx.frameMs));
    }
  }

  clear() {
    this.fxQueue.length = 0;
  }

  teardown() {
    this.clear();
    this.fxAssets.clear();
    this.ready = false;
    this.loading = false;
    this.selection = { biome: '', mapId: '' };
  }
}

export const combatFX = new CombatFX();
