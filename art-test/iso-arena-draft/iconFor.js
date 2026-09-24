import { ICON_ROOT, ICON_MANIFEST } from './iconManifest.generated.js';

const SETS = Object.fromEntries(Object.entries(ICON_MANIFEST).map(([folder, ids]) => [folder, new Set(ids)]));
const FOLDERS_BY_KIND = {
  equipment: ['equipment'],
  item: ['items', 'skills'],
  skill: ['skills'],
  mastery: ['mastery'],
  drop: ['items', 'skills', 'equipment'],
  ui: ['ui'],
  family: ['family'],
};

export function iconFor(id, kind) {
  for (const folder of FOLDERS_BY_KIND[kind] ?? []) {
    if (SETS[folder]?.has(id)) return `${ICON_ROOT}/${folder}/${id}.png`;
  }
  return null;
}

export function iconHtml(id, kind, fallbackHtml = '', cls = 'pixel-icon') {
  const url = iconFor(id, kind);
  return url ? `<img class="${cls}" src="${url}" alt="" draggable="false">` : fallbackHtml;
}
