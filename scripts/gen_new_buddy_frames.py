#!/usr/bin/env python3
"""Generate standard-pattern 4-frame anim PNGs for the 5 new buddies.

Source: assets/sprites/pusa/<name>/frames/<name>_frame_NN.png (8 or 12 frames, 128x128)
Output: assets/sprites/<species>_<state>_<0..3>.png where species ids match the
engine roster: pusa (Muning), agila (Banog), uwak (Gagak), ahas (Ran), dragon (Dragon).

Frames stay pixel-crisp (nearest-neighbor), bottom-anchored, with subtle
squash/stretch/bob/tilt so no buddy ever renders as a frozen static image.
"""
import glob
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..", "assets", "sprites")

BUDDIES = {
    "pusa": "pusa",
    "agila": "agila",
    "uwak": "uwak",
    "ahas": "ahas",
    "dragon": "dragon_flame",
}

# (scaleY, rot, dy) — dy positive = down. Bottom edge stays anchored.
STATES = {
    "idle": [(1.00, 0, 0), (0.97, 0, 1), (1.00, 0, -1), (0.98, 0, 0)],
    "walk": [(1.00, -3, -2), (0.93, 0, 0), (1.00, 3, -2), (0.95, 0, -1)],
    "happy": [(1.00, 0, -3), (1.04, 0, -4), (1.00, 0, -2), (1.03, -2, -3)],
    "eat": [(0.92, 0, 2), (0.88, 1, 3), (0.92, 0, 2), (0.90, -1, 3)],
    "sleep": [(0.84, 0, 3), (0.86, 1, 3), (0.83, 0, 4), (0.855, -1, 3)],
}


def transform(im, sy, rot, dy):
    im = im.convert("RGBA")
    w, h = im.size
    if sy != 1.0:
        nh = max(1, int(round(h * sy)))
        im = im.resize((w, nh), Image.NEAREST)
    if rot:
        im = im.rotate(rot, resample=Image.NEAREST, expand=False)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    y = h - im.size[1] - dy
    out.paste(im, (0, y), im)
    return out


for species, folder in BUDDIES.items():
    frame_paths = sorted(glob.glob(os.path.join(ROOT, "pusa", folder, "frames", "*.png")))
    if not frame_paths:
        raise SystemExit(f"no frames found for {species} ({folder})")
    base = Image.open(frame_paths[0])
    w, h = base.size
    walk_pool = [Image.open(p).convert("RGBA") for p in frame_paths[1:]]
    if len(walk_pool) < 4:
        walk_pool = [base]
    picks = {
        "walk": [walk_pool[(i * len(walk_pool)) // 4] if (i * len(walk_pool)) // 4 < len(walk_pool) else walk_pool[-1] for i in range(4)],
        "idle": [base] * 4,
        "happy": [base] * 4,
        "eat": [base] * 4,
        "sleep": [base] * 4,
    }
    for state, params in STATES.items():
        for i, (sy, rot, dy) in enumerate(params):
            src = picks[state][i]
            transform(src, sy, rot, dy).save(
                os.path.join(ROOT, f"{species}_{state}_{i}.png"),
            )
    print(f"{species}: 5 states x 4 frames written from {folder} ({len(frame_paths)} source frames)")

print("OK")
