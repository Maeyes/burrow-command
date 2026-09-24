from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT = Path(r"C:\bunny-world")
TARGETS = [
    ROOT / "art-test/isometric-player",
    ROOT / "art-test/Cute_chibi_anthropomorph-with_dual_daggers",
    ROOT / "art-test/iso-arena-draft",
]
OUT = ROOT / "artifacts/hero-combat-audit"
OUT.mkdir(parents=True, exist_ok=True)


def image_stats(path: Path):
    with Image.open(path) as im:
        rgba = im.convert("RGBA")
        alpha = rgba.getchannel("A")
        bbox = alpha.getbbox()
        alpha_extrema = alpha.getextrema()
        opaque = sum(1 for value in alpha.getdata() if value == 255)
        transparent = sum(1 for value in alpha.getdata() if value == 0)
        partial = rgba.width * rgba.height - opaque - transparent
        bottom = None if bbox is None else bbox[3] - 1
        return {
            "path": str(path.relative_to(ROOT)).replace("\\", "/"),
            "width": rgba.width,
            "height": rgba.height,
            "mode": im.mode,
            "alphaExtrema": list(alpha_extrema),
            "bbox": list(bbox) if bbox else None,
            "bottomOpaqueY": bottom,
            "opaquePixels": opaque,
            "transparentPixels": transparent,
            "partialAlphaPixels": partial,
        }


pngs = sorted({p for target in TARGETS for p in target.rglob("*.png")})
stats = [image_stats(path) for path in pngs]
(OUT / "png-audit.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")

dagger_root = ROOT / "art-test/Cute_chibi_anthropomorph-with_dual_daggers/with_dual_daggers/animations/Use_the_existing_Bunny_World_hero_as_the_exact_cha"
directions = ["south", "south-east", "east", "north-east", "north"]
scale = 4
cell_w = 96 * scale
cell_h = 96 * scale
label_h = 20
frames = 9
sheet = Image.new("RGBA", (frames * cell_w, len(directions) * (cell_h + label_h)), (32, 32, 32, 255))
draw = ImageDraw.Draw(sheet)
for row, direction in enumerate(directions):
    y = row * (cell_h + label_h)
    draw.text((4, y + 3), direction, fill=(255, 255, 255, 255))
    for frame in range(frames):
        path = dagger_root / direction / f"frame_{frame:03d}.png"
        with Image.open(path) as im:
            rgba = im.convert("RGBA")
            enlarged = rgba.resize((rgba.width * scale, rgba.height * scale), Image.Resampling.NEAREST)
        sheet.alpha_composite(enlarged, (frame * cell_w, y + label_h))
        draw.text((frame * cell_w + 3, y + label_h + 3), str(frame), fill=(255, 220, 64, 255))
sheet.save(OUT / "dual-dagger-custom-contact-sheet.png")

sword_state_root = OUT / "sword-shield-state"
if sword_state_root.exists():
    rotation_directions = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
    state_sheet = Image.new("RGBA", (4 * 64 * scale, 2 * (64 * scale + label_h)), (32, 32, 32, 255))
    state_draw = ImageDraw.Draw(state_sheet)
    for index, direction in enumerate(rotation_directions):
        col, row = index % 4, index // 4
        x, y = col * 64 * scale, row * (64 * scale + label_h)
        state_draw.text((x + 4, y + 3), direction, fill=(255, 255, 255, 255))
        with Image.open(sword_state_root / f"{direction}.png") as im:
            enlarged = im.convert("RGBA").resize((64 * scale, 64 * scale), Image.Resampling.NEAREST)
        state_sheet.alpha_composite(enlarged, (x, y + label_h))
    state_sheet.save(OUT / "sword-shield-state-contact-sheet.png")

rejected_sword_root = OUT / "sword-shield-download/sword_and_shield/animations/diagonal-slash"
if rejected_sword_root.exists():
    rotation_directions = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
    source_paths = sorted((rejected_sword_root / "south").glob("frame_*.png"))
    with Image.open(source_paths[0]) as sample:
        source_w, source_h = sample.size
    preview_scale = 2
    preview_cell_w = source_w * preview_scale
    preview_cell_h = source_h * preview_scale
    rejected_sheet = Image.new("RGBA", (len(source_paths) * preview_cell_w, len(rotation_directions) * (preview_cell_h + label_h)), (32, 32, 32, 255))
    rejected_draw = ImageDraw.Draw(rejected_sheet)
    for row, direction in enumerate(rotation_directions):
        y = row * (preview_cell_h + label_h)
        rejected_draw.text((4, y + 3), direction, fill=(255, 255, 255, 255))
        for frame, path in enumerate(sorted((rejected_sword_root / direction).glob("frame_*.png"))):
            with Image.open(path) as im:
                enlarged = im.convert("RGBA").resize((im.width * preview_scale, im.height * preview_scale), Image.Resampling.NEAREST)
            rejected_sheet.alpha_composite(enlarged, (frame * preview_cell_w, y + label_h))
            rejected_draw.text((frame * preview_cell_w + 3, y + label_h + 3), str(frame), fill=(255, 220, 64, 255))
    rejected_sheet.save(OUT / "rejected-sword-diagonal-slash-contact-sheet.png")

loose_sword_root = OUT / "sword-diagonal-loose"
if loose_sword_root.exists():
    loose_directions = [direction for direction in ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"] if (loose_sword_root / direction).exists()]
    loose_paths = sorted((loose_sword_root / loose_directions[0]).glob("source_*.png"))
    loose_scale = 3
    loose_sheet = Image.new("RGBA", (len(loose_paths) * 64 * loose_scale, len(loose_directions) * (64 * loose_scale + label_h)), (32, 32, 32, 255))
    loose_draw = ImageDraw.Draw(loose_sheet)
    for row, direction in enumerate(loose_directions):
        y = row * (64 * loose_scale + label_h)
        loose_draw.text((4, y + 3), direction, fill=(255, 255, 255, 255))
        for frame, path in enumerate(sorted((loose_sword_root / direction).glob("source_*.png"))):
            with Image.open(path) as im:
                enlarged = im.convert("RGBA").resize((im.width * loose_scale, im.height * loose_scale), Image.Resampling.NEAREST)
            loose_sheet.alpha_composite(enlarged, (frame * 64 * loose_scale, y + label_h))
            loose_draw.text((frame * 64 * loose_scale + 3, y + label_h + 3), str(frame), fill=(255, 220, 64, 255))
    loose_sheet.save(OUT / "sword-diagonal-loose-contact-sheet.png")

skeleton_sword_root = OUT / "sword-diagonal-skeleton"
if skeleton_sword_root.exists():
    skeleton_directions = [direction for direction in ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"] if (skeleton_sword_root / direction).exists()]
    skeleton_paths = sorted((skeleton_sword_root / skeleton_directions[0]).glob("source_*.png"))
    skeleton_scale = 6
    skeleton_sheet = Image.new("RGBA", (len(skeleton_paths) * 64 * skeleton_scale, len(skeleton_directions) * (64 * skeleton_scale + label_h)), (32, 32, 32, 255))
    skeleton_draw = ImageDraw.Draw(skeleton_sheet)
    for row, direction in enumerate(skeleton_directions):
        y = row * (64 * skeleton_scale + label_h)
        skeleton_draw.text((4, y + 3), direction, fill=(255, 255, 255, 255))
        for frame, path in enumerate(sorted((skeleton_sword_root / direction).glob("source_*.png"))):
            with Image.open(path) as im:
                enlarged = im.convert("RGBA").resize((im.width * skeleton_scale, im.height * skeleton_scale), Image.Resampling.NEAREST)
            skeleton_sheet.alpha_composite(enlarged, (frame * 64 * skeleton_scale, y + label_h))
            skeleton_draw.text((frame * 64 * skeleton_scale + 3, y + label_h + 3), str(frame), fill=(255, 220, 64, 255))
    skeleton_sheet.save(OUT / "sword-diagonal-skeleton-south-contact-sheet.png")

reroll_root = OUT / "sword-diagonal-reroll"
if reroll_root.exists():
    reroll_directions = sorted(path.name for path in reroll_root.iterdir() if path.is_dir())
    reroll_paths = sorted((reroll_root / reroll_directions[0]).glob("source_*.png"))
    reroll_scale = 6
    reroll_sheet = Image.new("RGBA", (len(reroll_paths) * 64 * reroll_scale, len(reroll_directions) * (64 * reroll_scale + label_h)), (32, 32, 32, 255))
    reroll_draw = ImageDraw.Draw(reroll_sheet)
    for row, direction in enumerate(reroll_directions):
        y = row * (64 * reroll_scale + label_h)
        reroll_draw.text((4, y + 3), direction, fill=(255, 255, 255, 255))
        for frame, path in enumerate(sorted((reroll_root / direction).glob("source_*.png"))):
            with Image.open(path) as im:
                enlarged = im.convert("RGBA").resize((im.width * reroll_scale, im.height * reroll_scale), Image.Resampling.NEAREST)
            reroll_sheet.alpha_composite(enlarged, (frame * 64 * reroll_scale, y + label_h))
            reroll_draw.text((frame * 64 * reroll_scale + 3, y + label_h + 3), str(frame), fill=(255, 220, 64, 255))
    reroll_sheet.save(OUT / "sword-diagonal-reroll-contact-sheet.png")

idle_proof_root = OUT / "sword-idle-proof/south"
if idle_proof_root.exists():
    idle_paths = sorted(idle_proof_root.glob("source_*.png"))
    idle_scale = 8
    idle_sheet = Image.new("RGBA", (len(idle_paths) * 64 * idle_scale, 64 * idle_scale + label_h), (32, 32, 32, 255))
    idle_draw = ImageDraw.Draw(idle_sheet)
    for frame, path in enumerate(idle_paths):
        with Image.open(path) as im:
            enlarged = im.convert("RGBA").resize((im.width * idle_scale, im.height * idle_scale), Image.Resampling.NEAREST)
        idle_sheet.alpha_composite(enlarged, (frame * 64 * idle_scale, label_h))
        idle_draw.text((frame * 64 * idle_scale + 3, 3), str(frame), fill=(255, 220, 64, 255))
    idle_sheet.save(OUT / "sword-idle-proof-contact-sheet.png")

idle_full_root = OUT / "sword-idle-full"
if idle_full_root.exists():
    idle_directions = [direction for direction in ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"] if (idle_full_root / direction).exists()]
    idle_paths = sorted((idle_full_root / idle_directions[0]).glob("source_*.png"))
    idle_scale = 4
    idle_full_sheet = Image.new("RGBA", (len(idle_paths) * 64 * idle_scale, len(idle_directions) * (64 * idle_scale + label_h)), (32, 32, 32, 255))
    idle_full_draw = ImageDraw.Draw(idle_full_sheet)
    for row, direction in enumerate(idle_directions):
        y = row * (64 * idle_scale + label_h)
        idle_full_draw.text((4, y + 3), direction, fill=(255, 255, 255, 255))
        for frame, path in enumerate(sorted((idle_full_root / direction).glob("source_*.png"))):
            with Image.open(path) as im:
                enlarged = im.convert("RGBA").resize((im.width * idle_scale, im.height * idle_scale), Image.Resampling.NEAREST)
            idle_full_sheet.alpha_composite(enlarged, (frame * 64 * idle_scale, y + label_h))
            idle_full_draw.text((frame * 64 * idle_scale + 3, y + label_h + 3), str(frame), fill=(255, 220, 64, 255))
    idle_full_sheet.save(OUT / "sword-idle-full-contact-sheet.png")

dagger_idle_proof_root = OUT / "dagger-idle-proof/south"
if dagger_idle_proof_root.exists():
    dagger_idle_paths = sorted(dagger_idle_proof_root.glob("source_*.png"))
    dagger_idle_scale = 8
    dagger_idle_sheet = Image.new("RGBA", (len(dagger_idle_paths) * 64 * dagger_idle_scale, 64 * dagger_idle_scale + label_h), (32, 32, 32, 255))
    dagger_idle_draw = ImageDraw.Draw(dagger_idle_sheet)
    for frame, path in enumerate(dagger_idle_paths):
        with Image.open(path) as im:
            enlarged = im.convert("RGBA").resize((im.width * dagger_idle_scale, im.height * dagger_idle_scale), Image.Resampling.NEAREST)
        dagger_idle_sheet.alpha_composite(enlarged, (frame * 64 * dagger_idle_scale, label_h))
        dagger_idle_draw.text((frame * 64 * dagger_idle_scale + 3, 3), str(frame), fill=(255, 220, 64, 255))
    dagger_idle_sheet.save(OUT / "dagger-idle-proof-contact-sheet.png")

dagger_idle_full_root = OUT / "dagger-idle-full"
if dagger_idle_full_root.exists():
    dagger_idle_directions = [direction for direction in ["south", "south-east", "east", "north-east", "north"] if (dagger_idle_full_root / direction).exists()]
    dagger_idle_paths = sorted((dagger_idle_full_root / dagger_idle_directions[0]).glob("source_*.png"))
    dagger_idle_scale = 4
    dagger_idle_full_sheet = Image.new("RGBA", (len(dagger_idle_paths) * 64 * dagger_idle_scale, len(dagger_idle_directions) * (64 * dagger_idle_scale + label_h)), (32, 32, 32, 255))
    dagger_idle_full_draw = ImageDraw.Draw(dagger_idle_full_sheet)
    for row, direction in enumerate(dagger_idle_directions):
        y = row * (64 * dagger_idle_scale + label_h)
        dagger_idle_full_draw.text((4, y + 3), direction, fill=(255, 255, 255, 255))
        for frame, path in enumerate(sorted((dagger_idle_full_root / direction).glob("source_*.png"))):
            with Image.open(path) as im:
                enlarged = im.convert("RGBA").resize((im.width * dagger_idle_scale, im.height * dagger_idle_scale), Image.Resampling.NEAREST)
            dagger_idle_full_sheet.alpha_composite(enlarged, (frame * 64 * dagger_idle_scale, y + label_h))
            dagger_idle_full_draw.text((frame * 64 * dagger_idle_scale + 3, y + label_h + 3), str(frame), fill=(255, 220, 64, 255))
    dagger_idle_full_sheet.save(OUT / "dagger-idle-full-contact-sheet.png")

dagger_cross_proof_root = OUT / "dagger-cross-slash-proof/south"
if dagger_cross_proof_root.exists():
    dagger_cross_paths = sorted(dagger_cross_proof_root.glob("source_*.png"))
    dagger_cross_scale = 8
    dagger_cross_sheet = Image.new("RGBA", (len(dagger_cross_paths) * 64 * dagger_cross_scale, 64 * dagger_cross_scale + label_h), (32, 32, 32, 255))
    dagger_cross_draw = ImageDraw.Draw(dagger_cross_sheet)
    for frame, path in enumerate(dagger_cross_paths):
        with Image.open(path) as im:
            enlarged = im.convert("RGBA").resize((im.width * dagger_cross_scale, im.height * dagger_cross_scale), Image.Resampling.NEAREST)
        dagger_cross_sheet.alpha_composite(enlarged, (frame * 64 * dagger_cross_scale, label_h))
        dagger_cross_draw.text((frame * 64 * dagger_cross_scale + 3, 3), str(frame), fill=(255, 220, 64, 255))
    dagger_cross_sheet.save(OUT / "dagger-cross-slash-proof-contact-sheet.png")

dagger_cross_loose_root = OUT / "dagger-cross-slash-loose-proof/south"
if dagger_cross_loose_root.exists():
    dagger_cross_loose_paths = sorted(dagger_cross_loose_root.glob("source_*.png"))
    dagger_cross_loose_scale = 8
    dagger_cross_loose_sheet = Image.new("RGBA", (len(dagger_cross_loose_paths) * 64 * dagger_cross_loose_scale, 64 * dagger_cross_loose_scale + label_h), (32, 32, 32, 255))
    dagger_cross_loose_draw = ImageDraw.Draw(dagger_cross_loose_sheet)
    for frame, path in enumerate(dagger_cross_loose_paths):
        with Image.open(path) as im:
            enlarged = im.convert("RGBA").resize((im.width * dagger_cross_loose_scale, im.height * dagger_cross_loose_scale), Image.Resampling.NEAREST)
        dagger_cross_loose_sheet.alpha_composite(enlarged, (frame * 64 * dagger_cross_loose_scale, label_h))
        dagger_cross_loose_draw.text((frame * 64 * dagger_cross_loose_scale + 3, 3), str(frame), fill=(255, 220, 64, 255))
    dagger_cross_loose_sheet.save(OUT / "dagger-cross-slash-loose-proof-contact-sheet.png")

dagger_cross_full_root = OUT / "dagger-cross-slash-full"
if dagger_cross_full_root.exists():
    dagger_cross_directions = [direction for direction in ["south", "south-east", "east", "north-east", "north"] if (dagger_cross_full_root / direction).exists()]
    dagger_cross_paths = sorted((dagger_cross_full_root / dagger_cross_directions[0]).glob("source_*.png"))
    dagger_cross_scale = 4
    dagger_cross_full_sheet = Image.new("RGBA", (len(dagger_cross_paths) * 64 * dagger_cross_scale, len(dagger_cross_directions) * (64 * dagger_cross_scale + label_h)), (32, 32, 32, 255))
    dagger_cross_full_draw = ImageDraw.Draw(dagger_cross_full_sheet)
    for row, direction in enumerate(dagger_cross_directions):
        y = row * (64 * dagger_cross_scale + label_h)
        dagger_cross_full_draw.text((4, y + 3), direction, fill=(255, 255, 255, 255))
        for frame, path in enumerate(sorted((dagger_cross_full_root / direction).glob("source_*.png"))):
            with Image.open(path) as im:
                enlarged = im.convert("RGBA").resize((im.width * dagger_cross_scale, im.height * dagger_cross_scale), Image.Resampling.NEAREST)
            dagger_cross_full_sheet.alpha_composite(enlarged, (frame * 64 * dagger_cross_scale, y + label_h))
            dagger_cross_full_draw.text((frame * 64 * dagger_cross_scale + 3, y + label_h + 3), str(frame), fill=(255, 220, 64, 255))
    dagger_cross_full_sheet.save(OUT / "dagger-cross-slash-full-contact-sheet.png")

greatsword_state_root = OUT / "greatsword-state"
if greatsword_state_root.exists():
    greatsword_directions = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
    greatsword_scale = 6
    greatsword_sheet = Image.new("RGBA", (4 * 64 * greatsword_scale, 2 * (64 * greatsword_scale + label_h)), (32, 32, 32, 255))
    greatsword_draw = ImageDraw.Draw(greatsword_sheet)
    for index, direction in enumerate(greatsword_directions):
        row, column = divmod(index, 4)
        x = column * 64 * greatsword_scale
        y = row * (64 * greatsword_scale + label_h)
        with Image.open(greatsword_state_root / f"{direction}.png") as im:
            enlarged = im.convert("RGBA").resize((64 * greatsword_scale, 64 * greatsword_scale), Image.Resampling.NEAREST)
        greatsword_sheet.alpha_composite(enlarged, (x, y + label_h))
        greatsword_draw.text((x + 3, y + 3), direction, fill=(255, 220, 64, 255))
    greatsword_sheet.save(OUT / "greatsword-state-contact-sheet.png")

greatsword_idle_proof_root = OUT / "greatsword-idle-proof/south"
if greatsword_idle_proof_root.exists():
    greatsword_idle_paths = sorted(greatsword_idle_proof_root.glob("source_*.png"))
    greatsword_idle_scale = 8
    greatsword_idle_sheet = Image.new("RGBA", (len(greatsword_idle_paths) * 64 * greatsword_idle_scale, 64 * greatsword_idle_scale + label_h), (32, 32, 32, 255))
    greatsword_idle_draw = ImageDraw.Draw(greatsword_idle_sheet)
    for frame, path in enumerate(greatsword_idle_paths):
        with Image.open(path) as im:
            enlarged = im.convert("RGBA").resize((im.width * greatsword_idle_scale, im.height * greatsword_idle_scale), Image.Resampling.NEAREST)
        greatsword_idle_sheet.alpha_composite(enlarged, (frame * 64 * greatsword_idle_scale, label_h))
        greatsword_idle_draw.text((frame * 64 * greatsword_idle_scale + 3, 3), str(frame), fill=(255, 220, 64, 255))
    greatsword_idle_sheet.save(OUT / "greatsword-idle-proof-contact-sheet.png")

greatsword_idle_full_root = OUT / "greatsword-idle-full"
if greatsword_idle_full_root.exists():
    greatsword_idle_directions = [direction for direction in ["south", "south-east", "east", "north-east", "north"] if (greatsword_idle_full_root / direction).exists()]
    greatsword_idle_paths = sorted((greatsword_idle_full_root / greatsword_idle_directions[0]).glob("source_*.png"))
    greatsword_idle_scale = 4
    greatsword_idle_full_sheet = Image.new("RGBA", (len(greatsword_idle_paths) * 64 * greatsword_idle_scale, len(greatsword_idle_directions) * (64 * greatsword_idle_scale + label_h)), (32, 32, 32, 255))
    greatsword_idle_full_draw = ImageDraw.Draw(greatsword_idle_full_sheet)
    for row, direction in enumerate(greatsword_idle_directions):
        y = row * (64 * greatsword_idle_scale + label_h)
        greatsword_idle_full_draw.text((4, y + 3), direction, fill=(255, 255, 255, 255))
        for frame, path in enumerate(sorted((greatsword_idle_full_root / direction).glob("source_*.png"))):
            with Image.open(path) as im:
                enlarged = im.convert("RGBA").resize((im.width * greatsword_idle_scale, im.height * greatsword_idle_scale), Image.Resampling.NEAREST)
            greatsword_idle_full_sheet.alpha_composite(enlarged, (frame * 64 * greatsword_idle_scale, y + label_h))
            greatsword_idle_full_draw.text((frame * 64 * greatsword_idle_scale + 3, y + label_h + 3), str(frame), fill=(255, 220, 64, 255))
    greatsword_idle_full_sheet.save(OUT / "greatsword-idle-full-contact-sheet.png")

greatsword_attack_proof_root = OUT / "greatsword-diagonal-slash-proof/south"
if greatsword_attack_proof_root.exists():
    greatsword_attack_paths = sorted(greatsword_attack_proof_root.glob("source_*.png"))
    greatsword_attack_scale = 6
    greatsword_attack_sheet = Image.new("RGBA", (len(greatsword_attack_paths) * 64 * greatsword_attack_scale, 64 * greatsword_attack_scale + label_h), (32, 32, 32, 255))
    greatsword_attack_draw = ImageDraw.Draw(greatsword_attack_sheet)
    for frame, path in enumerate(greatsword_attack_paths):
        with Image.open(path) as im:
            enlarged = im.convert("RGBA").resize((im.width * greatsword_attack_scale, im.height * greatsword_attack_scale), Image.Resampling.NEAREST)
        greatsword_attack_sheet.alpha_composite(enlarged, (frame * 64 * greatsword_attack_scale, label_h))
        greatsword_attack_draw.text((frame * 64 * greatsword_attack_scale + 3, 3), str(frame), fill=(255, 220, 64, 255))
    greatsword_attack_sheet.save(OUT / "greatsword-diagonal-slash-proof-contact-sheet.png")

greatsword_attack_reroll_root = OUT / "greatsword-diagonal-slash-reroll/south"
if greatsword_attack_reroll_root.exists():
    greatsword_attack_reroll_paths = sorted(greatsword_attack_reroll_root.glob("source_*.png"))
    greatsword_attack_reroll_scale = 7
    greatsword_attack_reroll_sheet = Image.new("RGBA", (len(greatsword_attack_reroll_paths) * 64 * greatsword_attack_reroll_scale, 64 * greatsword_attack_reroll_scale + label_h), (32, 32, 32, 255))
    greatsword_attack_reroll_draw = ImageDraw.Draw(greatsword_attack_reroll_sheet)
    for frame, path in enumerate(greatsword_attack_reroll_paths):
        with Image.open(path) as im:
            enlarged = im.convert("RGBA").resize((im.width * greatsword_attack_reroll_scale, im.height * greatsword_attack_reroll_scale), Image.Resampling.NEAREST)
        greatsword_attack_reroll_sheet.alpha_composite(enlarged, (frame * 64 * greatsword_attack_reroll_scale, label_h))
        greatsword_attack_reroll_draw.text((frame * 64 * greatsword_attack_reroll_scale + 3, 3), str(frame), fill=(255, 220, 64, 255))
    greatsword_attack_reroll_sheet.save(OUT / "greatsword-diagonal-slash-reroll-contact-sheet.png")

summary = {
    "pngCount": len(stats),
    "size64x64": sum(1 for row in stats if row["width"] == 64 and row["height"] == 64),
    "hasAlphaChannel": sum(1 for row in stats if "A" in row["mode"]),
    "fullyOpaque": [row["path"] for row in stats if row["alphaExtrema"] == [255, 255]],
    "unexpectedSizes": [row for row in stats if (row["width"], row["height"]) != (64, 64)],
}
(OUT / "combat-relevant-summary.json").write_text(json.dumps({
    "canonicalCombatTreePngs": [row for row in stats if row["path"].startswith("art-test/isometric-player/combat/")],
    "legacyDaggerCombatPngs": [row for row in stats if "/with_dual_daggers/animations/Use_the_existing" in row["path"]],
    "legacyDaggerRotations": [row for row in stats if "/with_dual_daggers/rotations/" in row["path"]],
}, indent=2), encoding="utf-8")
(OUT / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
print(json.dumps(summary, indent=2))
