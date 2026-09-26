"""Procedural pixel FX for Skill Cores that have no generated art (PixelLab credits ran out).

usage: python fx_procedural.py [id ...]     (no args = all)
Output: skills/<id>/sheet.png + meta.json, same 9-frame x 96px format as the PixelLab sheets.
Each frame is drawn at 96px with hard edges, then gets a 1px dark selective outline.
"""
import sys, os, json, math, random
from PIL import Image, ImageDraw

FRAMES, CELL = 9, 96
ROOT = os.path.dirname(os.path.abspath(__file__))
C = CELL / 2


def lerp(a, b, t):
    return a + (b - a) * t


def col(hexs, a=255):
    h = hexs.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def outline(im, color=(20, 14, 34, 255)):
    """1px outline around opaque pixels (selective: only where the neighbour is empty)."""
    src = im.load()
    out = im.copy()
    px = out.load()
    for y in range(CELL):
        for x in range(CELL):
            if src[x, y][3] > 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < CELL and 0 <= ny < CELL and src[nx, ny][3] > 160:
                    px[x, y] = color
                    break
    return out


def harden(im):
    """Pixel-art alpha: no soft edges."""
    px = im.load()
    for y in range(CELL):
        for x in range(CELL):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255 if a >= 110 else 0)
    return im


def frame():
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def disc(d, x, y, r, c):
    d.ellipse((x - r, y - r, x + r, y + r), fill=c)


def ring(d, x, y, r, w, c, sy=1.0):
    if r < 1:
        return
    d.ellipse((x - r, y - r * sy, x + r, y + r * sy), outline=c, width=max(1, int(w)))


def bolt(d, x0, y0, x1, y1, rng, c, w=3, segs=7, jag=7):
    pts = [(x0, y0)]
    for i in range(1, segs):
        t = i / segs
        pts.append((lerp(x0, x1, t) + rng.uniform(-jag, jag), lerp(y0, y1, t) + rng.uniform(-jag * .4, jag * .4)))
    pts.append((x1, y1))
    d.line(pts, fill=c, width=w)
    return pts


# ---------------------------------------------------------------- effects
def tidal_wave(i, rng):
    im, d = frame()
    t = i / (FRAMES - 1)
    rise = math.sin(min(1, t * 1.4) * math.pi / 2)
    fall = max(0, (t - .55) / .45)
    h = 58 * rise * (1 - fall * .8)
    base = 78
    deep, mid, light, foam = col('#1d4fa8'), col('#2f8fe0'), col('#7fd4ff'), col('#f2fbff')
    # body of the wave: stacked arcs leaning right, curling at the top
    for k, c in ((0, deep), (6, mid), (12, light)):
        pts = []
        for s in range(0, 21):
            u = s / 20
            x = 10 + u * 76
            y = base - h * math.sin(u * math.pi) * (1 - .35 * u) + k * .5
            pts.append((x, y + k))
        pts += [(86, base + 6), (10, base + 6)]
        d.polygon(pts, fill=c)
    # curl + foam crest
    cx, cy = 10 + .62 * 76, base - h * .92
    if h > 8:
        d.arc((cx - 12, cy - 10, cx + 12, cy + 12), 180, 40, fill=foam, width=4)
        for _ in range(10):
            disc(d, cx + rng.uniform(-14, 14), cy + rng.uniform(-8, 6), rng.choice((1, 2, 2, 3)), foam)
    # spray as it collapses
    for _ in range(int(22 * fall)):
        a = rng.uniform(math.pi * 1.05, math.pi * 1.95)
        r = rng.uniform(10, 40) * (0.4 + fall)
        disc(d, 50 + math.cos(a) * r, base - 6 + math.sin(a) * r * .7, rng.choice((1, 2)), rng.choice((foam, light)))
    d.rectangle((6, base + 2, 90, base + 8), fill=col('#2f8fe0', int(255 * (1 - fall * .7))))
    return im


def abyssal_grasp(i, rng):
    im, d = frame()
    t = i / (FRAMES - 1)
    grow = math.sin(min(1, t * 1.6) * math.pi / 2)
    fade = max(0, (t - .7) / .3)
    void, purple, violet, glow = col('#120a24'), col('#3b1a6b'), col('#7a3fc4'), col('#c89bff')
    # portal (drawn round; runtime flattens it)
    r = 12 + 30 * grow
    disc(d, C, C, r, purple)
    disc(d, C, C, r * .72, void)
    ring(d, C, C, r, 2, glow)
    # tentacles: from the rim, curling toward the centre
    n = 7
    for k in range(n):
        a0 = k / n * math.tau + t * .8
        length = (26 + 10 * math.sin(k * 1.7)) * grow * (1 - fade * .9)
        pts = []
        for s in range(9):
            u = s / 8
            rad = r * (1.02 - u * .15) + u * 4
            a = a0 + u * 1.3 * (1 if k % 2 else -1)
            lift = u * length
            pts.append((C + math.cos(a) * (rad - lift * .9), C + math.sin(a) * (rad - lift * .9)))
        for s in range(len(pts) - 1):
            w = max(1, int(5 * (1 - s / len(pts))))
            d.line((pts[s], pts[s + 1]), fill=violet, width=w)
        disc(d, *pts[-1], 1.5, glow)
    for _ in range(8):
        a, rr = rng.uniform(0, math.tau), rng.uniform(0, r * .6)
        d.point((C + math.cos(a) * rr, C + math.sin(a) * rr), fill=glow)
    return im


def siphon_soul(i, rng):
    """Beam art: horizontal, points right (hero on the left, target on the right)."""
    im, d = frame()
    t = i / (FRAMES - 1)
    dark, green, mint, white = col('#2a1450'), col('#3fd18a'), col('#a8ffcf'), col('#f4fff8')
    for strand in range(3):
        ph = strand * math.tau / 3 + t * math.tau * 1.5
        pts = [(x, C + math.sin(x / 96 * math.tau * 1.5 + ph) * (8 + strand * 3)) for x in range(4, 93, 2)]
        d.line(pts, fill=(dark, green, mint)[strand], width=(4, 3, 2)[strand])
    # soul wisps flowing from the target (right) back to the caster (left)
    for k in range(6):
        u = ((k / 6) - t * 1.2) % 1
        x = 90 - u * 84
        y = C + math.sin(u * 9 + k) * 10
        disc(d, x, y, 3, mint)
        disc(d, x - 1, y - 1, 1.5, white)
        d.line((x, y, x + 7, y + rng.uniform(-2, 2)), fill=green, width=2)
    return im


def mjolnir_strike(i, rng):
    """Anchored at the bottom: bolt + hammer come down on the target."""
    im, d = frame()
    t = i / (FRAMES - 1)
    white, pale, blue, deep, steel, grip = col('#ffffff'), col('#dff3ff'), col('#6fc3ff'), col('#2b5fd9'), col('#b8c3d6'), col('#6b4a2a')
    ground = 86
    drop = min(1, t / .35)
    hy = lerp(-10, ground - 22, drop * drop)
    if t < .5:
        # hammer head + handle
        d.rectangle((C - 13, hy, C + 13, hy + 14), fill=steel)
        d.rectangle((C - 13, hy, C + 13, hy + 3), fill=pale)
        d.rectangle((C - 2, hy - 16, C + 2, hy), fill=grip)
        bolt(d, C, 0, C, hy, rng, blue, 3, 5, 5)
        bolt(d, C, 0, C, hy, rng, white, 1, 5, 5)
    if t >= .3:
        k = (t - .3) / .7
        # impact flash + expanding shock ring + side bolts
        ring(d, C, ground, 10 + 36 * k, 3 * (1 - k) + 1, blue, .35)
        if k < .55:
            disc(d, C, ground - 6, 14 * (1 - k), pale)
            disc(d, C, ground - 6, 8 * (1 - k), white)
            for _ in range(4):
                a = rng.uniform(math.pi * 1.1, math.pi * 1.9)
                L = rng.uniform(18, 36)
                bolt(d, C, ground - 6, C + math.cos(a) * L, ground - 6 + math.sin(a) * L, rng, blue, 2, 4, 4)
        d.line((C - 2, 0, C - 2, ground), fill=col('#dff3ff', int(255 * max(0, 1 - k * 2))), width=3)
    return im


def thors_judgement(i, rng):
    """A rune sigil stamped on the target: forms, holds, then flares."""
    im, d = frame()
    t = i / (FRAMES - 1)
    gold, amber, blue, white = col('#ffd35a'), col('#c98a1c'), col('#7fd0ff'), col('#fffbe8')
    form = min(1, t / .45)
    r = 34
    ring(d, C, C, r * form, 3, amber)
    ring(d, C, C, r * form - 3, 1, gold)
    ring(d, C, C, r * .55 * form, 2, blue)
    # six runes rotating on the ring
    for k in range(6):
        a = k / 6 * math.tau + t * 1.2
        x, y = C + math.cos(a) * (r - 1) * form, C + math.sin(a) * (r - 1) * form
        if form > .3:
            d.line((x - 3, y - 4, x + 3, y + 4), fill=white, width=1)
            d.line((x + 3, y - 4, x - 1, y), fill=gold, width=1)
    # hammer glyph in the middle
    if form > .6:
        d.rectangle((C - 8, C - 9, C + 8, C - 3), fill=gold)
        d.rectangle((C - 1, C - 3, C + 1, C + 9), fill=amber)
    if t > .7:
        k = (t - .7) / .3
        disc(d, C, C, 10 + 22 * k, col('#fffbe8', int(255 * (1 - k))))
        for _ in range(3):
            a = rng.uniform(0, math.tau)
            bolt(d, C, C, C + math.cos(a) * 40, C + math.sin(a) * 40, rng, blue, 2, 4, 4)
    return im


def valkyries_call(i, rng):
    """Golden wings spread behind the hero with rising light rays."""
    im, d = frame()
    t = i / (FRAMES - 1)
    spread = math.sin(min(1, t * 1.5) * math.pi / 2)
    fade = max(0, (t - .65) / .35)
    gold, pale, white, amber = col('#ffd35a'), col('#fff1b0'), col('#ffffff'), col('#d69a2a')
    for side in (-1, 1):
        for f in range(6):
            ang = math.radians(-100 + side * (18 + f * 15) * spread) if side > 0 else math.radians(-80 - (18 + f * 15) * spread)
            L = (22 + f * 4) * spread * (1 - fade * .4)
            x0, y0 = C + side * 4, C - 2
            x1, y1 = x0 + math.cos(ang) * L, y0 + math.sin(ang) * L
            d.line((x0, y0, x1, y1), fill=(gold if f % 2 else pale), width=4)
            d.line((x0, y0, x1, y1), fill=amber, width=1)
    for k in range(5):
        x = C + (k - 2) * 12
        top = 90 - 80 * t - k % 2 * 10
        if fade < 1:
            d.line((x, top, x, top + 14), fill=col('#fff1b0', int(255 * (1 - fade))), width=2)
    disc(d, C, C - 2, 6 * (1 - fade) + 2, white)
    return im


def ragnarok(i, rng):
    """Ground AoE: meteors of fire and lightning strikes on a burning ring."""
    im, d = frame()
    t = i / (FRAMES - 1)
    red, orange, yellow, white, blue, char = col('#c2261a'), col('#ff7a1f'), col('#ffd84a'), col('#fffbe8'), col('#7fd0ff'), col('#3a1410')
    ring(d, C, C, 40, 3, char)
    ring(d, C, C, 38, 2, red)
    spots = [(C - 22, C - 14), (C + 18, C - 20), (C + 4, C + 18), (C - 16, C + 16), (C + 26, C + 8), (C - 4, C - 4)]
    for k, (x, y) in enumerate(spots):
        local = t * 6 - k * .7
        if local < 0 or local > 2.2:
            continue
        if k % 2 == 0:  # fire meteor
            if local < 1:
                mx, my = x + 18 * (1 - local), y - 34 * (1 - local)
                d.line((mx, my, mx + 8, my - 12), fill=orange, width=3)
                disc(d, mx, my, 4, yellow)
            else:
                k2 = local - 1
                disc(d, x, y, 12 * (1 - k2 / 1.2) + 2, red)
                disc(d, x, y, 8 * (1 - k2 / 1.2) + 1, orange)
                disc(d, x, y, 4 * (1 - k2 / 1.2), yellow)
        else:  # lightning strike
            if local < 1.2:
                bolt(d, x + rng.uniform(-4, 4), 0, x, y, rng, blue, 3, 5, 5)
                bolt(d, x, 0, x, y, rng, white, 1, 5, 5)
                disc(d, x, y, 6, white)
    for _ in range(10):
        a, rr = rng.uniform(0, math.tau), rng.uniform(4, 38)
        d.point((C + math.cos(a) * rr, C + math.sin(a) * rr), fill=rng.choice((orange, yellow)))
    return im


def bowling_bash(i, rng):
    """Greatsword: a heavy horizontal sweep, then a ground shockwave that scatters debris outward."""
    im, d = frame()
    t = i / (FRAMES - 1)
    steel, white, pale, dust, dark, rock = col('#c9d6e8'), col('#ffffff'), col('#fff1d6'), col('#d8b98a'), col('#8a6a45'), col('#6b5238')
    gy = C + 18  # ground line of the impact
    # 1) sweep: a thick tapered crescent that travels round from left to right (frames 0-4)
    if t < .6:
        k = t / .6
        head = math.radians(160 + 250 * k)
        span = math.radians(40 + 120 * min(1, k * 2))
        R, ry = 52, .62
        def crescent(width, shrink, c):
            outer, inner = [], []
            for s_ in range(25):
                u = s_ / 24
                a = head - span * (1 - u)
                w = width * math.sin(u * math.pi * .5) ** 1.5
                outer.append((C + math.cos(a) * R, C + math.sin(a) * R * ry))
                inner.append((C + math.cos(a) * (R - w), C + math.sin(a) * (R - w) * ry))
            d.polygon(outer + inner[::-1], fill=c)
        crescent(22, 0, dust)
        crescent(16, 0, steel)
        crescent(9, 0, pale)
        crescent(4, 0, white)
        for _ in range(6):  # speed streaks trailing the blade
            a = head - span * rng.uniform(.2, 1)
            rr = R - rng.uniform(4, 20)
            d.line((C + math.cos(a) * rr, C + math.sin(a) * rr * ry, C + math.cos(a - .25) * rr, C + math.sin(a - .25) * rr * ry), fill=pale, width=1)
    # 2) impact: flash, flattened shockwave rings, cracks
    if t >= .3:
        k = (t - .3) / .7
        if k < .4:
            disc(d, C, gy, 26 * (1 - k * 2.5) + 4, pale)
            disc(d, C, gy, 16 * (1 - k * 2.5) + 2, white)
        ring(d, C, gy, 14 + 46 * k, 4 * (1 - k) + 1, dust, .38)
        ring(d, C, gy, 6 + 34 * k, 2, pale if k < .5 else dust, .38)
        for c_ in range(5):
            a = c_ / 5 * math.tau + .4
            L = 12 + 22 * min(1, k * 2)
            x1, y1 = C + math.cos(a) * L, gy + math.sin(a) * L * .38
            d.line((C, gy, (C + x1) / 2 + rng.uniform(-2, 2), (gy + y1) / 2, x1, y1), fill=dark, width=2)
        # 3) debris: rocks and dust thrown outward on an arc, falling back
        for r_ in range(14):
            a = (r_ / 14) * math.tau
            v = 30 + (r_ * 7 % 13) * 2
            x = C + math.cos(a) * v * k
            y = gy + math.sin(a) * v * k * .38 - (40 * k - 55 * k * k) * (0.6 + (r_ % 3) * .2)
            size = 3 if r_ % 3 == 0 else 2
            d.rectangle((x - size, y - size, x + size, y + size), fill=rock if r_ % 2 else dust)
        for p_ in range(int(10 * (1 - k))):
            a = rng.uniform(0, math.tau)
            rr = rng.uniform(10, 50) * k
            d.point((C + math.cos(a) * rr, gy + math.sin(a) * rr * .38 - rng.uniform(0, 10)), fill=pale)
    return im


def crescent_at(d, cx, cy, R, ry, head, span, width, c, rot=0.0):
    """Tapered crescent: thin tail -> thick head, along an ellipse (R, R*ry), optionally rotated."""
    outer, inner = [], []
    cr, sr = math.cos(rot), math.sin(rot)
    def P(a, r):
        x, y = math.cos(a) * r, math.sin(a) * r * ry
        return (cx + x * cr - y * sr, cy + x * sr + y * cr)
    for s_ in range(25):
        u = s_ / 24
        a = head - span * (1 - u)
        w = width * math.sin(u * math.pi * .5) ** 1.5
        outer.append(P(a, R))
        inner.append(P(a, R - w))
    d.polygon(outer + inner[::-1], fill=c)


def sparkle(d, x, y, r, c):
    d.line((x - r, y, x + r, y), fill=c)
    d.line((x, y - r, x, y + r), fill=c)


def crescent_break(i, rng):
    """One huge white-gold crescent sweeping in (faces right), flash, thins, fades."""
    im, d = frame()
    t = i / (FRAMES - 1)
    gold, pale, white, amber = col('#ffd35a'), col('#fff1b0'), col('#ffffff'), col('#d69a2a')
    k = min(1, t / .4)
    thin = max(0, (t - .45) / .55)
    span = math.radians(30 + 140 * k)
    head = math.radians(-80 + 160 * k)
    W = 26 * (1 - thin * .85)
    if thin < 1:
        crescent_at(d, C - 18, C, 54, 1.0, head, span, W, amber)
        crescent_at(d, C - 18, C, 54, 1.0, head, span, W * .75, gold)
        crescent_at(d, C - 18, C, 54, 1.0, head, span, W * .45, pale)
        crescent_at(d, C - 18, C, 54, 1.0, head, span, W * .2, white)
    if .35 < t < .6:
        disc(d, C + 34, C, 8, white)
    for n in range(int(8 * (1 - thin * .7))):
        a = head - span * rng.uniform(0, 1)
        r = 54 + rng.uniform(-4, 8)
        sparkle(d, C - 18 + math.cos(a) * r, C + math.sin(a) * r, rng.choice((2, 3)), rng.choice((white, gold)))
    return im


def vanguard_tempest(i, rng):
    """Mint-white wind blades orbiting a centre: speed up, expand, dissipate."""
    im, d = frame()
    t = i / (FRAMES - 1)
    mint, pale, white, teal = col('#7fe8c4'), col('#d6fff0'), col('#ffffff'), col('#2fa98a')
    spin = t * t * 9
    R = 18 + 36 * t
    fade = max(0, (t - .7) / .3)
    for k in range(6):
        head = k / 6 * math.tau + spin
        w = 12 * (1 - fade * .8)
        rr = R * (0.75 + .25 * (k % 2))
        crescent_at(d, C, C, rr, .6, head, math.radians(70), w, teal)
        crescent_at(d, C, C, rr, .6, head, math.radians(70), w * .6, mint)
        crescent_at(d, C, C, rr, .6, head, math.radians(50), w * .3, white)
    ring(d, C, C, R * .5, 2, pale, .6)
    for _ in range(int(14 * (1 - fade))):
        a, r = rng.uniform(0, math.tau), rng.uniform(R * .4, R * 1.1)
        d.point((C + math.cos(a) * r, C + math.sin(a) * r * .6), fill=pale)
    return im


def cross_slash(i, rng):
    """X-shaped double slash, white with hot-pink edges: stroke, stroke, flash, fade."""
    im, d = frame()
    t = i / (FRAMES - 1)
    pink, hot, white = col('#ff9ad5'), col('#ff3fa4'), col('#ffffff')
    def stroke(x0, y0, x1, y1, k, w):
        x, y = lerp(x0, x1, k), lerp(y0, y1, k)
        d.line((x0, y0, x, y), fill=hot, width=w + 4)
        d.line((x0, y0, x, y), fill=pink, width=w + 2)
        d.line((x0, y0, x, y), fill=white, width=w)
    thin = max(0, (t - .55) / .45)
    w = max(1, int(4 * (1 - thin)))
    stroke(C - 34, C - 34, C + 34, C + 34, min(1, t / .25), w)
    if t > .2:
        stroke(C - 34, C + 34, C + 34, C - 34, min(1, (t - .2) / .25), w)
    if .4 < t < .7:
        disc(d, C, C, 9, white)
        for _ in range(8):
            a = rng.uniform(0, math.tau)
            r = rng.uniform(8, 20)
            d.point((C + math.cos(a) * r, C + math.sin(a) * r), fill=pink)
    return im


def shadow_flurry(i, rng):
    """Many small dark-violet slash marks popping in one by one, then scattering."""
    im, d = frame()
    t = i / (FRAMES - 1)
    black, violet, magenta, white = col('#1a0f2a'), col('#5b2d91'), col('#e04fd0'), col('#fbe6ff')
    r0 = random.Random('flurry')
    marks = [(r0.uniform(-30, 30), r0.uniform(-26, 26), r0.uniform(0, math.pi), r0.uniform(14, 24)) for _ in range(9)]
    scatter = max(0, (t - .6) / .4)
    for n, (x, y, a, L) in enumerate(marks):
        born = n / 9 * .6
        if t < born:
            continue
        x, y = C + x * (1 + scatter * .8), C + y * (1 + scatter * .8)
        L *= 1 - scatter * .7
        dx, dy = math.cos(a) * L / 2, math.sin(a) * L / 2
        d.line((x - dx, y - dy, x + dx, y + dy), fill=black, width=5)
        d.line((x - dx, y - dy, x + dx, y + dy), fill=violet, width=3)
        d.line((x - dx * .6, y - dy * .6, x + dx * .6, y + dy * .6), fill=magenta, width=1)
        if t - born < .12:
            sparkle(d, x + dx, y + dy, 2, white)
    for _ in range(int(10 * scatter)):
        a, r = rng.uniform(0, math.tau), rng.uniform(10, 44)
        disc(d, C + math.cos(a) * r, C + math.sin(a) * r, 1.5, violet)
    return im


def phantom_blades(i, rng):
    """Ring of 6 ghostly lilac blades spinning around a centre, then flying outward."""
    im, d = frame()
    t = i / (FRAMES - 1)
    lilac, pale, white, deep = col('#c3a6ff'), col('#ece2ff'), col('#ffffff'), col('#6b4fb8')
    out = max(0, (t - .55) / .45)
    R = 28 + 34 * out * out
    spin = t * 7
    for k in range(6):
        a = k / 6 * math.tau + spin
        bx, by = C + math.cos(a) * R, C + math.sin(a) * R * .6
        ta = a + math.pi / 2  # blade tangent to the ring
        L = 14 * (1 - out * .4)
        tip = (bx + math.cos(ta) * L, by + math.sin(ta) * L * .6)
        tail = (bx - math.cos(ta) * L, by - math.sin(ta) * L * .6)
        nx, ny = -math.sin(ta) * 3, math.cos(ta) * 3 * .6
        d.polygon([tip, (bx + nx, by + ny), tail, (bx - nx, by - ny)], fill=deep)
        d.polygon([tip, (bx + nx * .5, by + ny * .5), tail, (bx - nx * .5, by - ny * .5)], fill=lilac)
        d.line((tail, tip), fill=pale if out < .6 else lilac, width=1)
        for g in range(1, 3):  # ghost trail
            ga = a - g * .25
            disc(d, C + math.cos(ga) * R, C + math.sin(ga) * R * .6, 2 - g * .5, pale)
    if t < .3:
        disc(d, C, C, 5, white)
    return im


def glow_star(d, x, y, r, rays, rot, cols):
    """GPT-style burst: stacked star polygons, dark rim -> bright core (stepped, no blur)."""
    for k, c in enumerate(cols):
        rr = r * (1 - k / (len(cols) + .5))
        pts = []
        for n in range(rays * 2):
            a = rot + n * math.pi / rays
            pts.append((x + math.cos(a) * (rr if n % 2 == 0 else rr * .32), y + math.sin(a) * (rr if n % 2 == 0 else rr * .32)))
        d.polygon(pts, fill=c)


def shard(d, x, y, L, a, cols):
    """Small diamond crystal/blade chip pointing along angle a."""
    for k, c in enumerate(cols):
        l = L * (1 - k * .3)
        w = max(1, l * .28)
        ca, sa = math.cos(a), math.sin(a)
        d.polygon([(x + ca * l, y + sa * l), (x - sa * w, y + ca * w), (x - ca * l, y - sa * l), (x + sa * w, y - ca * w)], fill=c)


def vanguard_tempest2(i, rng):
    """Dense hurricane: layered spiral arms of wind blades + debris, a bright eye, then it tears apart."""
    im, d = frame()
    t = i / (FRAMES - 1)
    cols = (col('#1f7a66'), col('#3fc9a0'), col('#9ff5d8'), col('#ffffff'))
    grow = min(1, t / .35)
    tear = max(0, (t - .7) / .3)
    spin = t * 5.5
    R = (30 + 30 * grow) * (1 + tear * .15)
    for arm in range(5):
        base = arm / 5 * math.tau + spin
        for seg in range(7):
            u = seg / 6
            a = base + u * 2.4
            r = R * (.25 + u * .8)
            x, y = C + math.cos(a) * r, C + math.sin(a) * r * .85
            L = (6 + u * 11) * (1 - tear * .6)
            shard(d, x, y, L, a + math.pi / 2, cols[:3] if seg % 2 else cols[1:])
    if tear < 1:
        glow_star(d, C, C, 10 * (1 - tear), 4, spin, (cols[1], cols[2], cols[3]))
    for n in range(int(26 * (1 - tear * .5))):
        a, r = rng.uniform(0, math.tau), rng.uniform(R * .3, R * (1.1 + tear))
        d.rectangle((C + math.cos(a) * r, C + math.sin(a) * r * .85, C + math.cos(a) * r + 1, C + math.sin(a) * r * .85 + 1), fill=rng.choice(cols[1:]))
    return im


def shadow_flurry2(i, rng):
    """Barrage of thick violet slash crescents stacking on the target, magenta sparks, then a dark burst."""
    im, d = frame()
    t = i / (FRAMES - 1)
    rim, dark, violet, mag, white = col('#0d0718'), col('#3a1a66'), col('#8a3fd6'), col('#ff5ad8'), col('#fbe6ff')
    r0 = random.Random('flurry2')
    marks = [(r0.uniform(-24, 24), r0.uniform(-22, 22), r0.uniform(0, math.tau)) for _ in range(7)]
    end = max(0, (t - .72) / .28)
    for n, (ox, oy, rot) in enumerate(marks):
        born = n / 7 * .62
        age = t - born
        if age < 0 or age > .5:
            continue
        k = age / .5
        cx, cy = C + ox, C + oy
        span = math.radians(60 + 70 * min(1, k * 3))
        w = 15 * (1 - k * .8)
        for width, c in ((w, rim), (w * .75, dark), (w * .5, violet), (w * .22, mag)):
            if width >= 1:
                crescent_at(d, cx, cy, 40, .6, rot + span / 2, span, width, c, rot=rot * .3)
        if k < .2:
            glow_star(d, cx, cy, 7, 4, rot, (mag, white))
    if end > 0:
        glow_star(d, C, C, 34 * end, 6, .3, (rim, dark, violet, mag))
        for n in range(14):
            a = n / 14 * math.tau
            shard(d, C + math.cos(a) * 40 * end, C + math.sin(a) * 40 * end, 5, a, (dark, violet, mag))
    for _ in range(10):
        a, r = rng.uniform(0, math.tau), rng.uniform(6, 42)
        sparkle(d, C + math.cos(a) * r, C + math.sin(a) * r, 1, rng.choice((mag, white)))
    return im


def phantom_blades2(i, rng):
    """Six big spectral swords (hilt + blade) circling, leaving ghost copies, then launching outward."""
    im, d = frame()
    t = i / (FRAMES - 1)
    rim, deep, lilac, pale, white, gold = col('#2a1b52'), col('#6b4fb8'), col('#b79cff'), col('#e8dcff'), col('#ffffff'), col('#e8c86a')
    out = max(0, (t - .55) / .45)
    R = 40 + 12 * out * out
    spin = t * 6
    def sword(bx, by, a, s, cols):
        ca, sa = math.cos(a), math.sin(a)
        P = lambda u, v: (bx + ca * u * s - sa * v * s, by + sa * u * s + ca * v * s)
        d.polygon([P(18, 0), P(4, 3.2), P(-6, 3.2), P(-6, -3.2), P(4, -3.2)], fill=cols[0])
        d.polygon([P(16, 0), P(4, 2), P(-5, 2), P(-5, -2), P(4, -2)], fill=cols[1])
        d.line((P(-5, 0), P(15, 0)), fill=cols[2], width=1)
        d.line((P(-6, -5), P(-6, 5)), fill=gold, width=2)
        d.line((P(-7, 0), P(-11, 0)), fill=deep, width=2)
    for k in range(6):
        a = k / 6 * math.tau + spin
        for g, c in ((2, (rim, deep, lilac)), (1, (deep, lilac, pale))):  # ghosts behind
            ga = a - g * .22
            gx, gy = C + math.cos(ga) * R, C + math.sin(ga) * R * .8
            sword(gx, gy, ga + math.pi / 2 + out * -math.pi / 2, 1.1, c)
        bx, by = C + math.cos(a) * R, C + math.sin(a) * R * .8
        sword(bx, by, a + math.pi / 2 + out * -math.pi / 2, 1.5, (rim, lilac, white))
    if t < .45:
        glow_star(d, C, C, 12 * (1 - t), 4, spin, (deep, lilac, white))
    return im


EFFECTS = {
    'tidalWave': tidal_wave, 'abyssalGrasp': abyssal_grasp, 'siphonSoul': siphon_soul,
    'mjolnirStrike': mjolnir_strike, 'thorsJudgement': thors_judgement,
    'valkyriesCall': valkyries_call, 'ragnarok': ragnarok, 'bowlingBash': bowling_bash,
    'crescentBreak': crescent_break, 'vanguardTempest': vanguard_tempest2, 'crossSlash': cross_slash,
    'shadowFlurry': shadow_flurry2, 'phantomBlades': phantom_blades2,
}
# Cell size per effect when it replaces an existing sheet with another size.
EFFECT_CELL = {k: 128 for k in ('bowlingBash', 'crescentBreak', 'vanguardTempest', 'crossSlash', 'shadowFlurry', 'phantomBlades')}


def build(fx_id):
    global CELL, C
    CELL = EFFECT_CELL.get(fx_id, 96)
    C = CELL / 2
    sheet = Image.new('RGBA', (CELL * FRAMES, CELL), (0, 0, 0, 0))
    for i in range(FRAMES):
        rng = random.Random(f"{fx_id}:{i}")
        im = outline(harden(EFFECTS[fx_id](i, rng)))
        sheet.paste(im, (i * CELL, 0))
    out = os.path.join(ROOT, 'skills', fx_id)
    os.makedirs(out, exist_ok=True)
    sheet.save(os.path.join(out, 'sheet.png'))
    with open(os.path.join(out, 'meta.json'), 'w') as f:
        json.dump({'frames': FRAMES, 'cell': CELL, 'source': 'fx_procedural.py'}, f, indent=1)
    print('wrote', fx_id)


if __name__ == '__main__':
    for fx_id in (sys.argv[1:] or EFFECTS):
        build(fx_id)
