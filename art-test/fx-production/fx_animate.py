"""Turn one still VFX image (GPT, green #00FF00 background) into a 9-frame pixel sprite sheet.

usage: python fx_animate.py <src.png> <fxId> <mode> [cell=128]
modes: spin, spinOut, sweepAngle, sweepX, sweepY, cross, pop, burst
Output: art-test/fx-production/skills/<fxId>/sheet.png + meta.json (same format as PixelLab sheets).
The artwork itself is never redrawn: frames only reveal, move, rotate, scale and fade its pixels.
"""
import sys, os, json, math, random
from PIL import Image, ImageChops

FRAMES = 9
ROOT = os.path.dirname(os.path.abspath(__file__))


def key_green(im):
    """Remove the green screen and green spill, keep hard pixel edges."""
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if g > 140 and g > r * 1.35 and g > b * 1.35:
                px[x, y] = (0, 0, 0, 0)
            elif g > r and g > b:  # spill on the edge: pull green down to the brighter of r/b
                px[x, y] = (r, max(r, b), b, a)
    return im


def to_pixels(im, cell):
    """Downscale to the sprite cell: box-average colour, hard alpha, reduced palette."""
    bbox = im.getbbox()
    im = im.crop(bbox)
    side = max(im.size)
    sq = Image.new('RGBA', (side, side))
    sq.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
    inner = int(cell * .86)
    small = sq.resize((inner, inner), Image.BOX)
    a = small.getchannel('A').point(lambda v: 255 if v > 110 else 0)
    rgb = small.convert('RGB').quantize(colors=40, method=Image.Quantize.MEDIANCUT).convert('RGB')
    small = Image.merge('RGBA', (*rgb.split(), a))
    out = Image.new('RGBA', (cell, cell))
    out.alpha_composite(small, ((cell - inner) // 2, (cell - inner) // 2))
    return out


def ease_out(t):
    return 1 - (1 - t) ** 3


BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def fade(im, k):
    """Pixel-art fade: drop pixels on an ordered 4x4 Bayer pattern instead of lowering alpha,
    so what remains stays fully opaque (no see-through cores)."""
    if k >= 1:
        return im
    if k <= 0:
        return Image.new('RGBA', im.size)
    out = im.copy()
    px = out.load()
    cut = k * 16
    for y in range(out.height):
        row = BAYER4[y % 4]
        for x in range(out.width):
            if px[x, y][3] and row[x % 4] >= cut:
                px[x, y] = (0, 0, 0, 0)
    return out


def scale_about(im, s, cx=None, cy=None):
    c = im.width
    cx = c / 2 if cx is None else cx
    cy = c / 2 if cy is None else cy
    n = max(1, round(c * s))
    big = im.resize((n, n), Image.NEAREST)
    out = Image.new('RGBA', (c, c))
    out.paste(big, (round(cx - cx * s), round(cy - cy * s)), big)  # paste clips negative offsets
    return out


def rotate(im, deg):
    return im.rotate(deg, resample=Image.NEAREST, center=(im.width / 2, im.height / 2))


def masked(im, keep):
    """Keep pixels where keep(x, y) is True; brighten the leading edge a little."""
    out = Image.new('RGBA', im.size)
    src, dst = im.load(), out.load()
    for y in range(im.height):
        for x in range(im.width):
            p = src[x, y]
            if p[3] and keep(x, y):
                dst[x, y] = p
    return out


def components(im, pred):
    """4-connected components of pixels satisfying pred(r,g,b,a)."""
    w, h = im.size
    px = im.load()
    seen = [[False] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if seen[y][x] or not pred(*px[x, y]):
                continue
            stack, pts = [(x, y)], []
            seen[y][x] = True
            while stack:
                a, b = stack.pop()
                pts.append((a, b))
                for na, nb in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= na < w and 0 <= nb < h and not seen[nb][na] and pred(*px[na, nb]):
                        seen[nb][na] = True
                        stack.append((na, nb))
            comps.append(pts)
    return comps


def layer_from(im, pts):
    out = Image.new('RGBA', im.size)
    src, dst = im.load(), out.load()
    for x, y in pts:
        dst[x, y] = src[x, y]
    return out


# ---------------------------------------------------------------- modes
def mode_spin(base, i, t, total=-120, grow=True):
    s = .75 + .25 * ease_out(min(1, t * 2)) if grow else 1
    return fade(scale_about(rotate(base, total * ease_out(t)), s), 1.6 * (1 - t) + .2 if t > .5 else 1)


def mode_spin_out(base, i, t):
    # spin in place, then expand outward while fading (phantom blades)
    ang = -200 * t
    s = 1 if t < .6 else 1 + (t - .6) * 1.2
    return fade(scale_about(rotate(base, ang), s), 1 if t < .6 else 1 - (t - .6) / .4)


def angle_param(x, y, c, start_deg, direction=-1):
    a = math.degrees(math.atan2(y - c / 2, x - c / 2))
    return ((a - start_deg) * direction) % 360 / 360


def mode_sweep_angle(base, i, t, start=200, span=1.0, direction=-1):
    c = base.width
    reveal = min(1, t / .45) * span
    img = masked(base, lambda x, y: angle_param(x, y, c, start, direction) <= reveal)
    return fade(img, 1 if t < .55 else 1 - (t - .55) / .45)


def mode_sweep_axis(base, i, t, axis='x'):
    c = base.width
    bb = base.getbbox()
    lo, hi = (bb[0], bb[2]) if axis == 'x' else (bb[1], bb[3])
    edge = lo + (hi - lo) * min(1, t / .4)
    img = masked(base, (lambda x, y: x <= edge) if axis == 'x' else (lambda x, y: y <= edge))
    return fade(img, 1 if t < .5 else 1 - (t - .5) / .5)


def mode_cross(base, i, t):
    c = base.width
    # stroke 1 along the "\" diagonal, stroke 2 along "/": each pixel belongs to the closer line
    def stroke(x, y):
        d1, d2 = abs((x - c / 2) - (y - c / 2)), abs((x - c / 2) + (y - c / 2))
        return 1 if d1 <= d2 else 2
    p1, p2 = min(1, t / .22), max(0, min(1, (t - .18) / .22))
    def keep(x, y):
        s = stroke(x, y)
        u = ((x + y) / (2 * c)) if s == 1 else ((x + (c - y)) / (2 * c))
        return u <= (p1 if s == 1 else p2)
    return fade(masked(base, keep), 1 if t < .55 else 1 - (t - .55) / .45)


def mode_pop(base, i, t, order=None):
    comps = order
    n = len(comps)
    shown = int(n * min(1, t / .5)) + 1
    out = Image.new('RGBA', base.size)
    for k, pts in enumerate(comps[:shown]):
        out.alpha_composite(layer_from(base, pts))
    return fade(out, 1 if t < .6 else 1 - (t - .6) / .4)


def split_burst(base):
    """Ground (largest brownish blob), flash (bright warm pixels), rocks (other brownish blobs)."""
    def brownish(r, g, b, a):
        return a and r >= g >= b - 10 and r < 215 and (r - b) > 25 and not (r > 200 and g > 150)
    def bright(r, g, b, a):
        return a and r > 200 and g > 120
    comps = sorted(components(base, brownish), key=len, reverse=True)
    ground_pts = comps[0] if comps else []
    rocks = [p for p in comps[1:] if len(p) >= 6]
    flash_pts = [pt for pts in components(base, bright) for pt in pts]
    used = set(ground_pts) | set(flash_pts) | {pt for r in rocks for pt in r}
    px = base.load()
    rest = [(x, y) for y in range(base.height) for x in range(base.width) if px[x, y][3] and (x, y) not in used]
    return layer_from(base, ground_pts + rest), layer_from(base, flash_pts), rocks


def mode_burst(base, i, t, parts=None):
    ground, flash, rocks = parts
    c = base.width
    out = Image.new('RGBA', base.size)
    out.alpha_composite(fade(ground, min(1, t * 5) * (1 if t < .7 else 1 - (t - .7) / .3)))
    fs = .35 + .8 * ease_out(min(1, t / .3)) if t < .45 else 1.15 - (t - .45) * 1.2
    cy = c * .62
    out.alpha_composite(fade(scale_about(flash, max(.05, fs), c / 2, cy), 1 if t < .45 else max(0, 1 - (t - .45) / .35)))
    rnd = random.Random(7)
    for pts in rocks:
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        rx, ry = sum(xs) / len(xs), sum(ys) / len(ys)
        # rocks start near the impact centre and fly back to (and past) where the artist drew them
        dx, dy = rx - c / 2, ry - cy
        k = .15 + 1.25 * ease_out(min(1, t / .5))
        gy = 60 * max(0, t - .35) ** 2 * 4
        ox, oy = round(c / 2 + dx * k - rx), round(cy + dy * k - ry + gy)
        piece = layer_from(base, pts)
        moved = Image.new('RGBA', base.size)
        moved.alpha_composite(piece, (0, 0))
        moved = ImageChops.offset(moved, ox, oy)
        out.alpha_composite(fade(moved, 1 if t < .6 else 1 - (t - .6) / .4))
    return out


def mode_grow(base, i, t):
    s = .35 + .75 * ease_out(min(1, t / .35)) if t < .35 else 1.1 - (t - .35) * .15
    return fade(scale_about(base, s), 1 if t < .55 else 1 - (t - .55) / .45)


def mode_pulse_in(base, i, t):
    # pulled inward: starts wide, contracts toward the centre while fading
    s = 1.25 - .5 * ease_out(t)
    return fade(scale_about(base, s), min(1, t * 6) * (1 if t < .6 else 1 - (t - .6) / .4))


def mode_fall(base, i, t):
    # upper part falls diagonally down-right onto a ground band that fades in
    c = base.width
    bb = base.getbbox()
    cut = bb[1] + (bb[3] - bb[1]) * .68
    top = masked(base, lambda x, y: y < cut)
    ground = masked(base, lambda x, y: y >= cut)
    k = 1 - ease_out(min(1, t / .45))
    moved = ImageChops.offset(top, round(-c * .22 * k), round(-c * .30 * k))
    out = Image.new('RGBA', base.size)
    out.alpha_composite(fade(ground, min(1, t / .35)))
    out.alpha_composite(fade(moved, min(1, t * 5)))
    return fade(out, 1 if t < .65 else 1 - (t - .65) / .35)


def mode_projectile(base, i, t):
    # looping flight: tiny scale pulse and a 1px vertical shimmer, no fade
    s = 1 + .04 * math.sin(t * math.pi * 2)
    return ImageChops.offset(scale_about(base, s), 0, round(math.sin(t * math.pi * 4)))


def main():
    src, fx, mode = sys.argv[1], sys.argv[2], sys.argv[3]
    cell = int(sys.argv[4]) if len(sys.argv) > 4 else 128
    base = to_pixels(key_green(Image.open(src)), cell)
    extra = {}
    if mode == 'pop':
        comps = [p for p in components(base, lambda r, g, b, a: a) if len(p) >= 3]
        random.Random(3).shuffle(comps)
        extra['order'] = comps
    if mode == 'burst':
        extra['parts'] = split_burst(base)
    fn = {'spin': mode_spin, 'spinOut': mode_spin_out, 'sweepAngle': mode_sweep_angle, 'sweepX': lambda b, i, t: mode_sweep_axis(b, i, t, 'x'),
          'sweepY': lambda b, i, t: mode_sweep_axis(b, i, t, 'y'), 'cross': mode_cross, 'pop': mode_pop, 'burst': mode_burst,
          'ring': lambda b, i, t: mode_sweep_angle(b, i, t, start=180, span=1.0), 'grow': mode_grow, 'pulseIn': mode_pulse_in,
          'fall': mode_fall, 'projectile': mode_projectile}[mode]
    sheet = Image.new('RGBA', (cell * FRAMES, cell))
    for i in range(FRAMES):
        t = i / (FRAMES - 1)
        sheet.alpha_composite(fn(base, i, t, **extra), (i * cell, 0))
    d = os.path.join(ROOT, 'skills', fx)
    os.makedirs(d, exist_ok=True)
    sheet.save(os.path.join(d, 'sheet.png'))
    json.dump({'frames': FRAMES, 'cell': cell, 'source': os.path.basename(src), 'mode': mode, 'tool': 'fx_animate.py'}, open(os.path.join(d, 'meta.json'), 'w'), indent=1)
    print(fx, mode, 'ok')


if __name__ == '__main__':
    main()
