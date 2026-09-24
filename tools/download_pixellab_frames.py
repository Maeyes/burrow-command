from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen
import json
import sys


def download(task):
    direction, job_id, index, root = task
    target = root / direction / f"source_{index:03d}.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size > 0:
        return str(target)
    url = f"https://api.pixellab.ai/mcp/images/{job_id}/download?index={index}"
    with urlopen(url, timeout=30) as response:
        target.write_bytes(response.read())
    return str(target)


if __name__ == "__main__":
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    output_root = Path(sys.argv[2])
    frame_count = int(sys.argv[3])
    tasks = [
        (direction, job_id, index, output_root)
        for direction, job_id in jobs.items()
        for index in range(frame_count)
    ]
    with ThreadPoolExecutor(max_workers=12) as executor:
        results = list(executor.map(download, tasks))
    print(f"downloaded {len(results)} frames to {output_root}")
