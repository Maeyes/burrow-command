"""Export the white Blessed Bunny PixelLab package into the runtime layout used by poc.js.

Usage: python export_blessed_bunny.py <extracted_pkg_dir>
Writes art-test/isometric-player/blessed-bunny/<anim>/<dir>/frame_NNN.png and manifest.json
({anim: {dir: {frames, w, h, footY}}}). Only the 5 authored directions are exported;
west-side directions are mirrored at runtime.
"""
import json, shutil, sys
from pathlib import Path
from PIL import Image

PKG = Path(sys.argv[1]) / 'Idle' / 'animations'
OUT = Path(__file__).resolve().parents[1] / 'isometric-player' / 'blessed-bunny'
DIRS = ['south', 'south-east', 'east', 'north-east', 'north']

# anim -> default (source animation, frame indices or None for all)
# Frame 0 of every v3 attack is the unarmed reference pose, so attacks start at 1.
PLAN = {
    'idle': ('idle', None),
    'walk': ('walk', None),
    'run': ('run', None),
    'hurt': ('hurt', None),
    'death': ('death', None),
    'atk_greatsword': ('atk_greatsword_v2', range(1, 9)),
    'atk_dagger': ('atk_dagger_v2', range(1, 9)),
    'atk_axe': ('atk_axe', range(1, 9)),
    'atk_hammer': ('atk_hammer', range(1, 7)),      # drop the long rest-on-ground tail
    'atk_bow': ('atk_bow', range(1, 9)),
    'atk_swordShield': ('atk_swordshield_v2', range(3, 9)),  # shield pops in at frame 3
}
# (anim, dir) -> (source animation, frames) overrides for re-rolls and fixes
OVERRIDES = {
    ('run', 'south'): ('Running', None),
    ('atk_greatsword', 'north'): ('atk_greatsword_fix', range(1, 9)),
    ('atk_bow', 'south'): ('atk_bow_fix', range(1, 9)),
    ('atk_bow', 'east'): ('atk_bow', [1, 2, 3, 4, 5, 7, 8]),  # frame 6 fires the arrow backwards
    ('atk_hammer', 'south-east'): ('atk_hammer_fix', range(1, 7)),
    ('atk_axe', 'south-east'): ('atk_axe_fix', range(1, 9)),
    ('atk_axe', 'north-east'): ('atk_axe_fix', range(1, 9)),
    # Side views of atk_dagger_v2 showed a single flickering blade; these show both daggers.
    ('atk_dagger', 'east'): ('atk_dagger_x2', range(1, 9)),
    ('atk_dagger', 'north-east'): ('atk_dagger_x1', range(1, 9)),
}
SKIP = set(a for a in sys.argv[2:])  # optional: override keys to ignore, e.g. atk_axe:south-east


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    manifest = {}
    for anim, default in PLAN.items():
        manifest[anim] = {}
        for d in DIRS:
            src, idx = OVERRIDES.get((anim, d), default)
            if f'{anim}:{d}' in SKIP:
                src, idx = default
            files = sorted((PKG / src / d).glob('frame_*.png'))
            if not files:
                raise SystemExit(f'missing {src}/{d}')
            picked = [files[i] for i in idx] if idx is not None else files
            dest = OUT / anim / d
            dest.mkdir(parents=True)
            for n, f in enumerate(picked):
                Image.open(f).convert('RGBA').save(dest / f'frame_{n:03d}.png')
            # Feet come from the source's frame 0 (the plain reference pose): attack frames
            # carry arcs and dust that can extend below the feet.
            foot = Image.open(files[0]).convert('RGBA').getbbox()[3]
            w, h = Image.open(picked[0]).size
            manifest[anim][d] = {'frames': len(picked), 'w': w, 'h': h, 'footY': foot, 'source': src}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1))
    for anim, dirs in manifest.items():
        print(anim, {d: (v['frames'], v['w'], v['footY']) for d, v in dirs.items()})


main()
