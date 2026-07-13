# Phase 2 Spec — Terrain & Surface Physics (tightened)

Replaces the Phase 2 entry in `00-ROADMAP.md`. Builds on Phase 1's swing
mechanic — the swing/launch code shouldn't need to change here, only
what happens once the ball is airborne/rolling over real terrain instead
of a flat plane.

## Scope

Real heightmap terrain with elevation, plus surface zones
(fairway/rough/sand/green/water) that change ball behavior. Still no
course data model (that's Phase 3) — terrain and surface zones for this
phase are hardcoded test data, not loaded from a schema file.

**Important:** don't touch `src/scenes/drivingRange.js`. That's the flat
test bed Phase 1 was tuned against — keep it working as a baseline you
can always drop back to if terrain-related changes make swing feel
different than expected. Build this phase in a new scene file instead.

## Asset note (you don't need an artist for this)

Don't source or hand-paint a heightmap image for this phase. Generate
one procedurally in code — a simple noise function (Perlin/simplex, or
even just a few overlapping sine waves) producing a handful of gentle
hills is enough to prove the physics out. Real, designed heightmaps come
from the course editor in Phase 5. Same for surface zones: hardcode 3–4
simple polygons/circles directly in the test scene file rather than
sourcing any external data.

## Files to create/modify

- `src/scenes/terrainTest.js` — **new.** Test scene: procedural
  heightmap terrain + hardcoded surface zones (one strip each of
  fairway, rough, sand, green, and one water hazard zone). Reuses the
  swing/camera/HUD code from Phase 1 unchanged — only the ground and
  surface layer are new.
- `src/course/terrain.js` — **new.** Heightmap array → visual mesh +
  matching Havok heightfield collider, built from the same data source
  (`terrain-and-surfaces.md` §1 — don't generate mesh and collider from
  different data, they must match).
- `src/core/surfaces.js` — **new.** `getSurfaceAt(x, z)` lookup and the
  `SURFACE_PROPS` table (friction/restitution per surface type),
  `terrain-and-surfaces.md` §2–3.
- `src/core/hazards.js` — **new.** Point-in-hazard-polygon check,
  separate from `getSurfaceAt` (§5). For this phase, a hazard only needs
  to **stop the ball and log which hazard was entered** — actual stroke
  penalty rules are Phase 4's job, don't build them here.
- `src/core/ballPhysics.js` — **modify.** During the rolling state, look
  up current surface each tick and apply its friction; apply slope-based
  velocity bending using the heightmap gradient (§4); check hazard
  triggers each tick during flight and rolling, not just on landing.
- `src/core/constants.js` — **modify.** Add `SURFACE_PROPS` (or move it
  into `surfaces.js` if that reads cleaner) and a `SLOPE_INFLUENCE`
  constant, stronger effect on green than fairway/rough per
  `terrain-and-surfaces.md` §4.

## Debug HUD additions

Extend the Phase 1 HUD with:
- Current surface type under the ball, live
- Current slope vector at the ball's position, live
- Which hazard (if any) was last triggered

## Acceptance checklist (Definition of Done)

- [ ] Terrain renders with visible elevation — a few distinct hills/
      slopes, not flat
- [ ] Ball's physics collider matches the visual terrain — no clipping
      through hills, no floating above the surface
- [ ] Same swing (same power/accuracy) travels a visibly different
      distance on fairway vs. rough vs. sand — confirm by watching the
      debug HUD's surface readout alongside final resting distance
- [ ] A ball rolling across a sloped green visibly curves toward the
      downhill direction, not just rolling in a straight line
- [ ] Sand zone: ball lands and stops quickly, minimal bounce
- [ ] Ball entering the water hazard zone (either in flight or while
      rolling) stops immediately and the HUD/console confirms which
      hazard fired
- [ ] `drivingRange.js` (Phase 1's flat scene) still works unchanged —
      confirms swing code wasn't accidentally coupled to terrain code

Don't move to Phase 3 until each box is verified by actually playing
shots into each surface type and the hazard, not just by confirming the
code runs without errors.
