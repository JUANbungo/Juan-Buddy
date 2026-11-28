#!/usr/bin/env python3
"""Build Nila v2-style sprite sheets (8x 192px frames) + gifs from the baked pixel grids."""
import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "pets" / "sprites" / "nila"
GRID = json.loads((SRC / "nila_grid.json").read_text())

SCALE = 6  # 32px art -> 192px frames
FRAME = 192

data = SRC / "nila_grid.json"
data.unlink()


def parse_color(c: str):
    if c.startswith("#"):
        c = c[1:]
        if len(c) == 3:
            c = "".join(ch * 2 for ch in c)
        return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)
    m = re.match(r"rgba?\(([^)]+)\)", c)
    if m:
        parts = [p.strip() for p in m.group(1).split(",")]
        r, g, b = (int(float(p)) for p in parts[:3])
        a = int(float(parts[3]) * 255) if len(parts) > 3 else 255
        return (r, g, b, a)
    raise ValueError(f"unknown color {c}")


def frame_image(grid):
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(grid):
        for x, col in enumerate(row):
            if col:
                px[x, y] = parse_color(col)
    return im.resize((FRAME, FRAME), Image.NEAREST)


for anim, blob in GRID.items():
    frames = [frame_image(g) for g in blob["grid"]]
    sheet = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * FRAME, 0))
    sheet.save(SRC / f"nila_{anim}_sheet.png")
    frames[0].save(
        SRC / f"nila_{anim}.gif",
        save_all=True,
        append_images=frames[1:],
        duration=110,
        loop=0,
        disposal=2,
    )
    print(f"nila_{anim}_sheet.png  frames={len(frames)}")
