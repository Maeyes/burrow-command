"""Procedural 64px pixel icons for items/skills without generated art (PixelLab credits ran out).

usage: python icon_procedural.py            -> writes output/B19/<id>.png, then run `node tools/sync-icons.mjs`
Style follows the generated set: chunky shapes, 3-tone shading (dark / base / light + white glint),
1px near-black outline, transparent background.
"""
import os, math
from PIL import Image, ImageDraw

S = 64
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'output', 'B19')
OUTLINE = (22, 16, 30, 255)


def col(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def new():
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def finish(im):
    px = im.load()
    for y in range(S):
        for x in range(S):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255 if a >= 110 else 0)
    out = im.copy()
    o = out.load()
    for y in range(S):
        for x in range(S):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < S and 0 <= ny < S and px[nx, ny][3]:
                    o[x, y] = OUTLINE
                    break
    return out


def gem(d, pts, dark, base, light):
    """Faceted crystal: full polygon dark, inner-left facet base, a light facet and a glint."""
    d.polygon(pts, fill=dark)
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    inner = [(lerp(p[0], cx, .25) - 1, lerp(p[1], cy, .25)) for p in pts]
    d.polygon(inner, fill=base)
    top = min(pts, key=lambda p: p[1])
    d.polygon([top, (cx - 2, cy), (lerp(top[0], cx, .5) - 4, lerp(top[1], cy, .6))], fill=light)
    d.point((top[0] - 1, top[1] + 4), fill=(255, 255, 255, 255))
    d.point((top[0] - 1, top[1] + 5), fill=(255, 255, 255, 255))


def lerp(a, b, t):
    return a + (b - a) * t


def sparkle(d, x, y, r, c):
    d.line((x - r, y, x + r, y), fill=c)
    d.line((x, y - r, x, y + r), fill=c)


# ------------------------------------------------------------------ icons
def core_shard():
    im, d = new()
    dark, base, light = col('#1f4f9e'), col('#4d9ff0'), col('#b8e6ff')
    gem(d, [(30, 8), (40, 22), (36, 44), (26, 46), (22, 24)], dark, base, light)
    gem(d, [(14, 26), (22, 34), (20, 50), (12, 52), (8, 38)], dark, base, light)
    gem(d, [(46, 30), (54, 38), (52, 54), (44, 56), (40, 42)], dark, base, light)
    sparkle(d, 50, 16, 3, col('#ffffff'))
    sparkle(d, 10, 18, 2, col('#b8e6ff'))
    return finish(im)


def mod_shard():
    im, d = new()
    dark, base, light = col('#8a1f2e'), col('#e0485a'), col('#ffb3bc')
    gold, gdark = col('#ffd35a'), col('#b07a1a')
    gem(d, [(32, 10), (42, 24), (38, 46), (26, 46), (22, 24)], dark, base, light)
    gem(d, [(15, 30), (22, 38), (19, 52), (10, 50), (8, 38)], gdark, gold, col('#fff1b0'))
    gem(d, [(48, 32), (55, 40), (52, 54), (43, 54), (42, 42)], gdark, gold, col('#fff1b0'))
    sparkle(d, 50, 16, 3, col('#ffffff'))
    return finish(im)


def tidal_wave():
    im, d = new()
    deep, mid, light, foam = col('#1d4fa8'), col('#2f8fe0'), col('#7fd4ff'), col('#f2fbff')
    d.pieslice((6, 10, 58, 62), 180, 360, fill=deep)
    d.rectangle((6, 36, 58, 54), fill=deep)
    d.pieslice((12, 16, 52, 56), 180, 360, fill=mid)
    d.rectangle((12, 36, 52, 54), fill=mid)
    d.pieslice((20, 24, 44, 48), 180, 360, fill=light)
    d.ellipse((24, 26, 42, 42), fill=deep)  # the curl's hollow
    d.ellipse((28, 30, 40, 42), fill=mid)
    for x, y, r in ((10, 12, 3), (16, 8, 3), (24, 8, 2), (8, 20, 2), (30, 10, 2)):
        d.ellipse((x - r, y - r, x + r, y + r), fill=foam)
    d.rectangle((6, 50, 58, 54), fill=light)
    return finish(im)


def abyssal_grasp():
    im, d = new()
    void, purple, violet, glow = col('#120a24'), col('#3b1a6b'), col('#7a3fc4'), col('#c89bff')
    d.ellipse((8, 34, 56, 58), fill=purple)
    d.ellipse((14, 38, 50, 54), fill=void)
    for k, (x0, bend) in enumerate(((16, -1), (26, 1), (38, -1), (48, 1))):
        pts = [(x0 + math.sin(t / 3) * 4 * bend, 46 - t * 1.6) for t in range(0, 20)]
        for i in range(len(pts) - 1):
            w = max(2, 6 - i // 4)
            d.line((pts[i], pts[i + 1]), fill=violet, width=w)
        d.line((pts[0], pts[-1]), fill=violet, width=1)
        tx, ty = pts[-1]
        d.ellipse((tx - 2, ty - 2, tx + 2, ty + 2), fill=glow)
    for x in (18, 30, 42):
        d.point((x, 47), fill=glow)
    return finish(im)


def siphon_soul():
    im, d = new()
    dark, green, mint, white = col('#2a1450'), col('#3fd18a'), col('#a8ffcf'), col('#f4fff8')
    # a skull-ish soul wisp flowing down into a spiral
    for i in range(3):
        a0 = i * 2.1
        pts = [(32 + math.cos(a0 + t * .35) * (22 - t), 36 + math.sin(a0 + t * .35) * (16 - t * .6)) for t in range(0, 18)]
        d.line(pts, fill=(dark, green, mint)[i], width=(6, 4, 2)[i])
    d.ellipse((22, 8, 42, 28), fill=mint)
    d.polygon([(24, 22), (40, 22), (36, 32), (28, 32)], fill=mint)
    d.ellipse((26, 14, 31, 19), fill=dark)
    d.ellipse((33, 14, 38, 19), fill=dark)
    d.point((32, 24), fill=dark)
    d.ellipse((24, 10, 28, 13), fill=white)
    return finish(im)


def mjolnir_strike():
    im, d = new()
    steel, pale, dark, grip, wrap, bolt = col('#8e9bb3'), col('#dfe6f2'), col('#4b566b'), col('#6b4a2a'), col('#a0703a'), col('#7fd0ff')
    # handle (diagonal) then head
    d.line((40, 28, 54, 58), fill=grip, width=6)
    for t in range(4):
        y = 36 + t * 5
        x = 40 + (y - 28) * 14 / 30
        d.line((x - 3, y, x + 3, y - 1), fill=wrap, width=2)
    d.polygon([(10, 16), (40, 4), (48, 22), (18, 34)], fill=dark)
    d.polygon([(12, 16), (40, 6), (44, 16), (16, 26)], fill=steel)
    d.polygon([(14, 16), (40, 7), (41, 10), (15, 19)], fill=pale)
    # lightning crackle
    for pts in (((8, 34), (14, 42), (9, 46), (16, 58)), ((56, 2), (51, 12), (58, 16), (52, 30))):
        d.line(pts, fill=bolt, width=3)
        d.line(pts, fill=(255, 255, 255, 255), width=1)
    return finish(im)


def thors_judgement():
    im, d = new()
    gold, amber, blue, white = col('#ffd35a'), col('#b07a1a'), col('#7fd0ff'), col('#fffbe8')
    d.ellipse((6, 6, 58, 58), fill=amber)
    d.ellipse((9, 9, 55, 55), fill=col('#2a2240'))
    d.ellipse((14, 14, 50, 50), outline=blue, width=2)
    for k in range(8):
        a = k / 8 * math.tau
        x, y = 32 + math.cos(a) * 20, 32 + math.sin(a) * 20
        d.rectangle((x - 1, y - 2, x + 1, y + 2), fill=gold)
    d.rectangle((22, 20, 42, 30), fill=gold)
    d.rectangle((22, 20, 42, 22), fill=white)
    d.rectangle((30, 30, 34, 44), fill=amber)
    d.line((38, 36, 44, 32, 42, 40, 48, 38), fill=blue, width=2)
    return finish(im)


def valkyries_call():
    im, d = new()
    gold, pale, white, amber = col('#ffd35a'), col('#fff1b0'), col('#ffffff'), col('#b07a1a')
    for side in (-1, 1):
        for f in range(5):
            ang = math.radians(-90 + side * (20 + f * 17))
            L = 18 + f * 3
            x0, y0 = 32 + side * 3, 34
            x1, y1 = x0 + math.cos(ang) * L, y0 + math.sin(ang) * L
            d.line((x0, y0, x1, y1), fill=amber, width=6)
            d.line((x0, y0, x1, y1), fill=gold if f % 2 else pale, width=4)
    # winged helm centre
    d.ellipse((24, 30, 40, 48), fill=col('#c9d6e8'))
    d.rectangle((24, 40, 40, 50), fill=col('#c9d6e8'))
    d.rectangle((30, 40, 34, 50), fill=col('#4b566b'))
    d.rectangle((26, 38, 38, 40), fill=col('#4b566b'))
    d.ellipse((27, 32, 32, 36), fill=white)
    return finish(im)


def ragnarok():
    im, d = new()
    red, orange, yellow, white, blue, char = col('#c2261a'), col('#ff7a1f'), col('#ffd84a'), col('#fffbe8'), col('#7fd0ff'), col('#3a1410')
    d.ellipse((8, 40, 56, 60), fill=char)
    d.ellipse((12, 42, 52, 58), fill=red)
    d.ellipse((20, 45, 44, 55), fill=orange)
    # meteor from the upper right
    d.line((56, 6, 36, 34), fill=orange, width=8)
    d.line((56, 6, 36, 34), fill=yellow, width=4)
    d.ellipse((28, 28, 42, 42), fill=red)
    d.ellipse((30, 30, 40, 40), fill=yellow)
    d.ellipse((32, 31, 36, 35), fill=white)
    # lightning from the upper left
    d.line((10, 4, 18, 18, 12, 22, 22, 44), fill=blue, width=3)
    d.line((10, 4, 18, 18, 12, 22, 22, 44), fill=white, width=1)
    return finish(im)


ICONS = {
    'coreShard': core_shard, 'modShard': mod_shard,
    'tidalWave': tidal_wave, 'abyssalGrasp': abyssal_grasp, 'siphonSoul': siphon_soul,
    'mjolnirStrike': mjolnir_strike, 'thorsJudgement': thors_judgement,
    'valkyriesCall': valkyries_call, 'ragnarok': ragnarok,
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for k, fn in ICONS.items():
        fn().save(os.path.join(OUT, k + '.png'))
        print('wrote', k)
