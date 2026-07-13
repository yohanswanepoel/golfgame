# Phase 3 Spec — Course Data & Loading (tightened)

Replaces the Phase 3 entry in `00-ROADMAP.md`. This phase doesn't add
new gameplay — it takes everything Phase 1 (swing) and Phase 2 (terrain/
surfaces) already do with hardcoded test data, and makes it driven by
real course data files instead. If this phase is done right, Phases 1–2
gameplay code shouldn't need to change at all.

## Scope

Implement the schema, build a loader that turns a course JSON file +
heightmap into a playable scene, and hand-author two small test courses
to prove the loader isn't secretly hardcoded to one of them.

**Don't build the course editor yet** (Phase 5) — these test courses are
written by hand.

## Asset note

You still don't need real art here. Two things need generating without
an artist:

1. **Heightmap PNGs** — write a small one-off Node script
   (`scripts/generate-test-heightmap.js`) that reuses the same noise
   function from Phase 2's procedural terrain to bake out a grayscale
   PNG. Run it twice with different parameters to produce two distinct
   test heightmaps. This is a script you run once, not app code.
2. **Trees/objects** — render as simple primitive placeholders (a cone
   on a cylinder is a perfectly readable "tree" at this stage) rather
   than sourcing models. Swap in real assets later without touching
   loader logic — the loader just needs `object.type` mapped to
   *something* renderable.

## Files to create/modify

- `src/course/schema.js` — **new.** Implements the structure from
  `course-data-schema.md`: field shape (JSDoc types are enough, no need
  for a TS build step) and `validateCourse(courseJson)`. Write this
  first — the loader and your hand-authored test files both need to
  agree with it.
- `src/course/loader.js` — **new.** `loadCourse(courseJson, heightmapImageData, scene)`:
  - Loads the heightmap PNG into a numeric elevation array (canvas
    `getImageData`, or an image-loading equivalent), then calls Phase
    2's `src/course/terrain.js` to build mesh + collider from it —
    reuse that function, don't reimplement heightmap→mesh here.
  - Builds `surfaces`/`hazards` zone data directly from the JSON
    (replacing Phase 2's hardcoded test polygons) and feeds it into the
    existing `getSurfaceAt`/hazard-check functions from
    `src/core/surfaces.js` / `src/core/hazards.js` — those functions
    shouldn't need to change, only what data they're given.
  - Places tee/pin/objects at the positions specified in the JSON.
- `scripts/generate-test-heightmap.js` — **new.** One-off Node script,
  not part of the app bundle. Outputs a PNG file.
- `data/courses/test-course-a/` — **new**, hand-authored: `course.json`,
  `holes/hole-01.json`, `heightmaps/hole-01.png` (from the script).
- `data/courses/test-course-b/` — **new**, hand-authored: a second,
  meaningfully different hole (different par, different hazard
  placement, different heightmap) — this is what actually tests the
  loader is generic.
- `src/scenes/courseTest.js` — **new.** Loads a course by path (hardcode
  which one for now, e.g. a constant at the top of the file you swap
  manually) via `loader.js` and drops the player in with the existing
  swing/camera/HUD code from Phase 1–2, unchanged.

## Deliberately-broken validation test

Before wiring up the happy path, write one intentionally malformed test
hole JSON (missing `tee`, or a `pin` positioned outside the heightmap
bounds, or a self-intersecting surface polygon) and confirm
`validateCourse()` rejects it with a clear error — not a silent failure
or a confusing runtime crash three layers deep in the loader.

## Acceptance checklist (Definition of Done)

- [ ] `validateCourse()` rejects the deliberately-broken test file with
      a clear, specific error message
- [ ] `validateCourse()` accepts both `test-course-a` and
      `test-course-b` hole files without complaint
- [ ] Loading `test-course-a/hole-01` produces a scene with correct
      terrain, correct surface zones, correct tee/pin placement, and a
      working hazard
- [ ] Loading `test-course-b/hole-01` instead produces a **visibly
      different** hole — different terrain shape, different hazard
      layout — using the exact same loader code path
- [ ] Swinging, rolling, surface-dependent friction, and slope-based
      curve all behave the same as Phase 2 when playing through the
      loader — confirms Phase 1–2 code wasn't quietly coupled to the
      old hardcoded test data
- [ ] Placeholder tree objects render at the correct positions specified
      in the JSON

Don't move to Phase 4 until both test courses load and play correctly
through the same loader — if you find yourself special-casing anything
based on which course is loaded, the schema or loader has a gap that
needs fixing now, not papered over.
