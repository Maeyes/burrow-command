from pathlib import Path
from PIL import Image
import argparse
import json
import re
import sys


FRAME_RE = re.compile(r"frame_(\d{3})\.png$")


def validate_action(root: Path, expected_frames: int, expected_directions: list[str]):
    errors = []
    warnings = []
    results = {}
    actual_directions = sorted(path.name for path in root.iterdir() if path.is_dir()) if root.exists() else []
    missing_directions = sorted(set(expected_directions) - set(actual_directions))
    unexpected_directions = sorted(set(actual_directions) - set(expected_directions))
    if missing_directions:
        errors.append(f"missing directions: {', '.join(missing_directions)}")
    if unexpected_directions:
        errors.append(f"unexpected directions: {', '.join(unexpected_directions)}")

    for direction in expected_directions:
        direction_root = root / direction
        if not direction_root.exists():
            continue
        files = sorted(direction_root.glob("frame_*.png"))
        numbers = []
        bottoms = []
        boxes = []
        for path in files:
            match = FRAME_RE.match(path.name)
            if not match:
                errors.append(f"{direction}: invalid filename {path.name}")
                continue
            numbers.append(int(match.group(1)))
            with Image.open(path) as image:
                if image.size != (64, 64):
                    errors.append(f"{direction}/{path.name}: canvas {image.width}x{image.height}, expected 64x64")
                if "A" not in image.mode:
                    errors.append(f"{direction}/{path.name}: no alpha channel")
                    continue
                alpha = image.getchannel("A")
                extrema = alpha.getextrema()
                if extrema[0] != 0:
                    errors.append(f"{direction}/{path.name}: no fully transparent pixels")
                bbox = alpha.getbbox()
                if bbox is None:
                    errors.append(f"{direction}/{path.name}: fully transparent frame")
                else:
                    boxes.append(bbox)
                    bottoms.append(bbox[3] - 1)
        expected_numbers = list(range(expected_frames))
        if numbers != expected_numbers:
            errors.append(f"{direction}: frame numbers {numbers}, expected {expected_numbers}")
        if bottoms and max(bottoms) - min(bottoms) > 2:
            errors.append(f"{direction}: root/bottom drift {min(bottoms)}..{max(bottoms)} (>2px)")
        elif bottoms and max(bottoms) - min(bottoms) > 1:
            warnings.append(f"{direction}: root/bottom drift {min(bottoms)}..{max(bottoms)}")
        results[direction] = {"frames": len(files), "bottomOpaqueY": bottoms, "alphaBoxes": boxes}

    warnings.append("Accidental text, character identity, weapon continuity, and impact readability require contact-sheet visual QA.")
    return {"ok": not errors, "root": str(root), "errors": errors, "warnings": warnings, "directions": results}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("--frames", type=int, required=True)
    parser.add_argument("--directions", nargs="+", required=True)
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()
    report = validate_action(args.root, args.frames, args.directions)
    rendered = json.dumps(report, indent=2)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(rendered, encoding="utf-8")
    print(rendered)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
