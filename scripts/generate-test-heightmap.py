#!/usr/bin/env python3
"""
Generates the heightmap PNG for data/courses/test-course-a/holes/hole-01.json

This is a one-off authoring tool, not part of the game's runtime code —
run it once to produce the PNG, then the game just loads that PNG like
any other asset. Written in Python (PIL/numpy) rather than JS because
asset generation doesn't need to run in the browser/game runtime.

Elevation values here are hand-tuned to match specific features called
out in hole-01.json (tee, green plateau, bunker lip, water hollow) —
if you change one, check the other.

Usage: python3 scripts/generate-test-heightmap.py
"""

import numpy as np
from PIL import Image

RESOLUTION = 256          # pixels per side
WORLD_SIZE_METERS = 300   # must match heightmap.worldSizeMeters in hole-01.json
MIN_ELEV = -3             # must match heightmap.minElevation in hole-01.json
MAX_ELEV = 12             # must match heightmap.maxElevation in hole-01.json

# Key feature positions, in the same local meter-space (0..WORLD_SIZE_METERS)
# used by hole-01.json. Keep these in sync with the JSON's tee/pin/hazard coords.
TEE = (30, 30)
PIN = (245, 255)
WATER_CENTER = (150, 90)
WATER_RADIUS = 28
BUNKER_CENTER = (215, 235)
BUNKER_RADIUS = 12
GREEN_CENTER = PIN
GREEN_RADIUS = 15


def meters_to_px(x, z):
    return (x / WORLD_SIZE_METERS) * RESOLUTION, (z / WORLD_SIZE_METERS) * RESOLUTION


def build_elevation():
    xs = np.linspace(0, WORLD_SIZE_METERS, RESOLUTION)
    zs = np.linspace(0, WORLD_SIZE_METERS, RESOLUTION)
    X, Z = np.meshgrid(xs, zs)

    # Gentle overall rise from tee toward green (a slight uphill par 4)
    tee_to_pin = np.array(PIN) - np.array(TEE)
    dist_along = ((X - TEE[0]) * tee_to_pin[0] + (Z - TEE[1]) * tee_to_pin[1]) / np.linalg.norm(tee_to_pin)
    elevation = 4.0 * (dist_along / np.linalg.norm(tee_to_pin))

    # Soft rolling texture so it doesn't look like a flat ramp
    elevation += 0.6 * np.sin(X / 22.0) * np.cos(Z / 27.0)

    # Green plateau: gentle raised, slightly domed putting surface
    dist_green = np.sqrt((X - GREEN_CENTER[0]) ** 2 + (Z - GREEN_CENTER[1]) ** 2)
    green_bump = np.clip(1.0 - dist_green / (GREEN_RADIUS * 1.4), 0, 1)
    elevation += green_bump * 1.8
    # subtle undulation on the green itself for putting-slope interest
    elevation += green_bump * 0.4 * np.sin(X / 6.0) * np.sin(Z / 5.0)

    # Bunker: shallow depression short of the green
    dist_bunker = np.sqrt((X - BUNKER_CENTER[0]) ** 2 + (Z - BUNKER_CENTER[1]) ** 2)
    bunker_dip = np.clip(1.0 - dist_bunker / (BUNKER_RADIUS * 1.3), 0, 1)
    elevation -= bunker_dip * 1.2

    # Water hazard: a proper hollow so it reads as a pond, not just a flat patch
    dist_water = np.sqrt((X - WATER_CENTER[0]) ** 2 + (Z - WATER_CENTER[1]) ** 2)
    water_dip = np.clip(1.0 - dist_water / (WATER_RADIUS * 1.3), 0, 1)
    elevation -= water_dip * 3.0

    return np.clip(elevation, MIN_ELEV, MAX_ELEV)


def main():
    elevation = build_elevation()
    normalized = (elevation - MIN_ELEV) / (MAX_ELEV - MIN_ELEV)  # 0..1
    pixels = np.clip(normalized * 255, 0, 255).astype(np.uint8)

    img = Image.fromarray(pixels, mode="L")
    out_path = "data/courses/test-course-a/heightmaps/hole-01.png"
    img.save(out_path)
    print(f"Wrote {out_path} ({RESOLUTION}x{RESOLUTION}, "
          f"elevation range {MIN_ELEV} to {MAX_ELEV} meters)")


if __name__ == "__main__":
    main()
