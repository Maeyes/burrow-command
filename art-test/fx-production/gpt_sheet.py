"""Turn a GPT animation grid (e.g. 4x2 frames on white or green) into a runtime FX sheet.

usage: python gpt_sheet.py <src.png> <fxId> <cols>x<rows> [cell=96] [colors=24]
Output: skills/<fxId>/sheet.png + meta.json (9 frames in a row, like the PixelLab sheets).
The existing sheet is kept as sheet.old.png. Frames keep their position inside their grid cell
(GPT draws them roughly centred), all scaled by the same factor so the effect grows as drawn.
"""
import sys, os, json
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
OUTLINE = (20, 14, 34, 255)
FRAMES = 9


def is_background(r, g, b):
    white = r > 225 and g > 225 and b > 225 and max(r, g, b) - min(r, g, b) < 26
    green = g > 150 and g > r * 1.35 and g > b * 1.35
    return white or green


def key(im):
    im = im.convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 20 or is_background(r, g, b):
                px[x, y] = (0, 0, 0, 0)
    return im


def harden(im):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255 if a >= 128 else 0)
    return im


def outline(im):
    src = im.load()
    out = im.copy()
    px = out.load()
    for y in range(im.height):
        for x in range(im.width):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < im.width and 0 <= ny < im.height and src[nx, ny][3]:
                    px[x, y] = OUTLINE
                    break
    return out


def main():
    src, fx_id, grid = sys.argv[1], sys.argv[2], sys.argv[3]
    cell = int(sys.argv[4]) if len(sys.argv) > 4 else 96
    colors = int(sys.argv[5]) if len(sys.argv) > 5 else 24
    cols, rows = map(int, grid.lower().split('x'))
    im = key(Image.open(src))
    cw, ch = im.width // cols, im.height // rows
    cells = [im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)) for r in range(rows) for c in range(cols)]
    # One shared crop square (union of every frame's bbox, relative to its cell) keeps motion consistent.
    boxes = [c.getbbox() for c in cells if c.getbbox()]
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    side = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    square = (int(cx - side / 2), int(cy - side / 2), int(cx + side / 2), int(cy + side / 2))
    frames = []
    for c in cells:
        f = c.crop(square).resize((cell, cell), Image.LANCZOS)
        f = harden(f)
        alpha = f.getchannel('A')
        f = f.convert('RGB').quantize(colors, method=Image.Quantize.MEDIANCUT).convert('RGBA')
        f.putalpha(alpha)
        frames.append(outline(f))
    while len(frames) < FRAMES:  # pad with an empty frame so the effect ends cleanly
        frames.append(Image.new('RGBA', (cell, cell), (0, 0, 0, 0)))
    frames = frames[:FRAMES]
    sheet = Image.new('RGBA', (cell * FRAMES, cell), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.alpha_composite(f, (i * cell, 0))
    out = os.path.join(ROOT, 'skills', fx_id)
    os.makedirs(out, exist_ok=True)
    cur = os.path.join(out, 'sheet.png')
    if os.path.exists(cur) and not os.path.exists(os.path.join(out, 'sheet.old.png')):
        os.replace(cur, os.path.join(out, 'sheet.old.png'))
    sheet.save(cur)
    with open(os.path.join(out, 'meta.json'), 'w') as fh:
        json.dump({'frames': FRAMES, 'cell': cell, 'source': os.path.basename(src), 'tool': 'gpt_sheet.py', 'grid': grid}, fh, indent=1)
    print('wrote', fx_id, 'from', len(cells), 'GPT frames')


if __name__ == '__main__':
    main()
