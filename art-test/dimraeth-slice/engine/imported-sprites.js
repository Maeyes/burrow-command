// Prototype image assets share a ground anchor between editor and runtime.
export const BURROW_ART = {
  url: new URL('../../../artifacts/burrow-assets/rabbit-burrow-concept-v1.png', import.meta.url).href,
  width: 288, height: 192, ox: 144, oy: 139,
};
let pending;
export function loadBurrowArt() {
  return pending ||= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { pending = null; reject(new Error('Cannot load rabbit burrow prototype')); };
    img.src = BURROW_ART.url;
  });
}
export let burrowImage = null;
export async function prepareImportedSprites(scene) {
  if (scene.props?.some(p => p.type === 'rabbitBurrow')) burrowImage = await loadBurrowArt();
}
