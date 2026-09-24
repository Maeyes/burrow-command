import os, glob
from PIL import Image, ImageDraw

ROOT = r"C:\bunny-world\art-test\icon-production"
OUT = os.path.join(ROOT, "qa")
SCALE = 4
CELL = 64 * SCALE
LABEL_H = 18
COLS = 5

for batch in ["MASTERY"]:
    files = sorted(glob.glob(os.path.join(ROOT, "output", batch, "*.png")))
    if not files:
        continue
    rows = (len(files) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * CELL, rows * (CELL + LABEL_H)), (70, 70, 80))
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(files):
        im = Image.open(f).convert("RGBA")
        assert im.size == (64, 64), (f, im.size)
        im = im.resize((CELL, CELL), Image.NEAREST)
        x, y = (i % COLS) * CELL, (i // COLS) * (CELL + LABEL_H)
        tile = Image.new("RGB", (CELL, CELL), (70, 70, 80))
        tile.paste(im, (0, 0), im)
        sheet.paste(tile, (x, y + LABEL_H))
        d.text((x + 4, y + 3), os.path.basename(f)[:-4], fill=(255, 255, 255))
    sheet.save(os.path.join(OUT, f"{batch}.png"))
    print(batch, len(files))
