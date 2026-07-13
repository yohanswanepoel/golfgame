# Skill: Course Data Schema

Defines "a course" as portable data, separate from any rendering code.
Both hand-authored test courses (Phase 3) and editor-exported courses
(Phase 5) must conform to this schema. Treat this as the contract between
the editor and the game — don't let either side improvise fields.

## Top-level structure

A course is a collection of holes. Each hole is mostly self-contained
(its own heightmap and geometry) rather than one giant shared terrain —
this keeps files smaller and makes editor loading/testing per-hole much
easier.

```json
{
  "schemaVersion": 1,
  "courseName": "Pine Hollow",
  "holes": [
    { "$ref": "holes/hole-01.json" },
    { "$ref": "holes/hole-02.json" }
  ]
}
```

`schemaVersion` exists from day one, even though it's always `1` right
now — you will change this schema, and future-you will thank present-you
for not having to guess whether an old save file is compatible.

## Per-hole structure

```json
{
  "schemaVersion": 1,
  "id": "hole-01",
  "par": 4,
  "yardage": 385,

  "heightmap": {
    "width": 256,
    "height": 256,
    "worldSizeMeters": 300,
    "minElevation": -5,
    "maxElevation": 20,
    "dataFile": "heightmaps/hole-01.png"
  },

  "tee": { "x": 10, "z": 20, "facing": 180 },
  "pin": { "x": 240, "z": 260 },

  "surfaces": [
    {
      "type": "fairway",
      "shape": "polygon",
      "points": [[10,10],[50,10],[50,200],[10,200]]
    },
    {
      "type": "green",
      "shape": "circle",
      "center": [240, 260],
      "radius": 15
    },
    {
      "type": "sand",
      "shape": "polygon",
      "points": [[200,220],[220,220],[220,240],[200,240]]
    },
    { "type": "rough", "shape": "polygon", "points": [ "...everything else, or explicit fill polygons" ] }
  ],

  "hazards": [
    { "type": "water", "shape": "polygon", "points": [[100,100],[130,100],[130,140],[100,140]] }
  ],

  "objects": [
    { "type": "tree", "model": "pine_01", "position": [30, 60], "scale": 1.2, "rotation": 45 },
    { "type": "bunker_lip", "position": [200, 220] }
  ]
}
```

### Field notes

- **`heightmap.dataFile`**: store the actual elevation data as a grayscale
  PNG (one file per hole), not inline JSON numbers — a 256×256 heightmap
  as inline JSON is enormous and slow to parse; as a PNG it's a normal
  image asset. `minElevation`/`maxElevation` map the 0–255 pixel value
  range back to real-world meters.
- **`surfaces[].shape`**: support `polygon` and `circle` at minimum.
  Rendering/physics code samples a surface-type lookup at any (x,z)
  point by testing which polygon/circle contains it. Later surfaces in
  the array override earlier ones if they overlap (bunker inside fairway,
  etc.) — document this precedence rule in code, it's a common source of
  "why is this bunker acting like fairway" bugs.
- **`tee.facing`**: degrees, so the game can orient the initial camera/
  aim direction without the player having to manually turn first.
- **Coordinates** are in the heightmap's local 2D grid space (x, z in
  meters from hole origin), not world/scene space — the loader is
  responsible for placing the whole hole into the scene. This makes each
  hole file independently testable.

## Versioning discipline

When you change this schema:
1. Bump `schemaVersion`.
2. Write a small migration function (`migrateV1toV2`) rather than
   requiring all old course files to be hand-edited.
3. Keep migrations chained (v1→v2→v3) rather than writing a v1→v3
   special case — simpler to reason about even if slightly more code.

## Validation

Write a `validateCourse(courseJson)` function early (Phase 3) that
checks required fields, that tee/pin fall within heightmap bounds, and
that surface polygons are valid (closed, non-self-intersecting). Run it
both when the game loads a course AND when the editor exports one — this
is the single most useful bug-prevention tool for this project, since
"malformed course data" will otherwise manifest as confusing runtime
errors far from the actual cause.
