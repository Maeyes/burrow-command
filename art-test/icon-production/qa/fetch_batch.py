import json, os, sys, time, urllib.request
from PIL import Image, ImageDraw

jobs_file, outdir = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
jobs = json.load(open(jobs_file))
os.makedirs(outdir, exist_ok=True)
failed = []
for name, job in jobs.items():
    dest = os.path.join(outdir, f"{name}.png")
    ok = False
    for _ in range(6):
        try:
            req = urllib.request.Request(f"https://api.pixellab.ai/mcp/images/{job}/download", headers={"User-Agent": "curl/8"})
            open(dest, "wb").write(urllib.request.urlopen(req).read())
            im = Image.open(dest)
            ok = im.size == (64, 64)
            if ok: break
        except Exception:
            time.sleep(4)
    if not ok: failed.append(name)
print("failed:", failed)

names = [n for n in jobs if n not in failed]
S = 4; C = 64 * S; L = 16
rows = (len(names) + cols - 1) // cols
sheet = Image.new("RGB", (cols * C, rows * (C + L)), (60, 62, 74))
d = ImageDraw.Draw(sheet)
report = []
for i, n in enumerate(names):
    im = Image.open(os.path.join(outdir, f"{n}.png")).convert("RGBA")
    px = im.load()
    a = [px[x, y][3] for y in range(64) for x in range(64)]
    border = sum(1 for x in range(64) for y in (0, 63) if px[x, y][3]) + sum(1 for y in range(64) for x in (0, 63) if px[x, y][3])
    semi = sum(1 for v in a if 0 < v < 255)
    transp = sum(1 for v in a if v == 0) / len(a) * 100
    flags = []
    if im.mode != "RGBA": flags.append("mode")
    if transp < 25: flags.append("lowTransp")
    if border > 6: flags.append(f"border{border}")
    if semi: flags.append(f"semi{semi}")
    report.append((n, round(transp, 1), flags))
    big = im.resize((C, C), Image.NEAREST)
    x, y = (i % cols) * C, (i // cols) * (C + L)
    sheet.paste(big, (x, y + L), big)
    d.text((x + 4, y + 2), n, fill=(255, 255, 255))
sheet.save(outdir.rstrip("/\\") + "_sheet.png")
for r in report:
    if r[2]: print(r)
print(len(names), "ok ->", outdir.rstrip("/\\") + "_sheet.png")
