# Skill: Terrain & Surface Physics

Covers turning heightmap data into a physical, walkable/rollable course,
and making surface type (fairway/rough/sand/green/water) meaningfully
affect the ball.

## 1. Building the terrain mesh

Babylon has built-in heightmap-to-ground helpers
(`MeshBuilder.CreateGroundFromHeightMap` or the newer terrain APIs) —
use one of these rather than hand-writing a mesh generator. Feed it the
PNG from `course-data-schema.md`, with `minHeight`/`maxHeight` matching
the hole's `minElevation`/`maxElevation`.

For physics, generate a Havok heightfield collider from the SAME
heightmap data — don't let the visual mesh and the physics collider
drift out of sync by building them from different sources.

## 2. Surface type lookup

At any (x, z) position, you need to answer "what surface is the ball
currently on?" Implement this as a pure function:

```js
function getSurfaceAt(x, z, hole) {
  // iterate hole.surfaces in order, later entries win on overlap
  let result = 'rough'; // default fallback
  for (const s of hole.surfaces) {
    if (pointInShape(x, z, s)) result = s.type;
  }
  return result;
}
```

Call this whenever the ball needs a physics response (landing, rolling,
each tick while rolling) — don't cache it across a shot, since the ball
moves between surface zones mid-roll.

## 3. Per-surface physics properties

Maintain a lookup table, tune empirically:

```js
const SURFACE_PROPS = {
  fairway: { friction: 0.35, restitution: 0.35 },
  rough:   { friction: 0.65, restitution: 0.15 }, // ball dies faster, doesn't bounce much
  sand:    { friction: 0.85, restitution: 0.05 }, // ball plugs, barely rolls
  green:   { friction: 0.15, restitution: 0.25 }, // fast roll, slope-sensitive
  water:   { friction: null, restitution: null }, // not a rolling surface — see hazards below
};
```

Apply `friction` by damping horizontal velocity each tick while the ball
is in "rolling" state (see `golf-swing-physics.md` §5). Apply
`restitution` to the Havok body's material properties for the bounce
on landing.

## 4. Slope affecting roll (critical for greens)

Sample the heightmap gradient at the ball's current position and use it
to bend rolling velocity downhill:

```js
function getSlopeVector(x, z, heightmapData) {
  const h = sampleHeight; // your heightmap sampling function
  const dx = h(x + 1, z) - h(x - 1, z);
  const dz = h(x, z + 1) - h(x, z - 1);
  return { x: -dx, z: -dz }; // points downhill
}
```

Each tick while rolling:
```js
const slope = getSlopeVector(ball.x, ball.z, heightmap);
velocity.x += slope.x * SLOPE_INFLUENCE * deltaTime;
velocity.z += slope.z * SLOPE_INFLUENCE * deltaTime;
```

`SLOPE_INFLUENCE` should be much stronger on `green` than on `fairway`/
`rough` in practice — real greens are mowed short enough that even
gentle slope visibly bends a putt, while a shot resting in the rough
barely reacts to slope at all. You can implement this either by scaling
`SLOPE_INFLUENCE` by surface type, or keeping one constant and letting
the higher friction on rough naturally kill the ball's speed before
slope has time to act — the friction approach is more physically
honest and less fiddly to tune.

## 5. Hazards (water, out of bounds)

Hazards aren't a "surface with physics properties" — they're a trigger
zone. When the ball's position enters a hazard polygon (check this
every physics tick during flight AND rolling, not just on landing):

1. Stop the ball immediately (don't let it keep resolving physics in
   the hazard).
2. Apply the rules-appropriate penalty (see Phase 4 in the roadmap —
   this is game-loop logic, not physics logic, so keep it out of this
   layer).
3. Trigger a splash/OB visual/sound cue.

Keep hazard-detection as its own check, separate from `getSurfaceAt`,
even though both do point-in-polygon tests — they answer different
questions (visual/friction surface vs. rules event) and conflating them
makes the rules logic harder to reason about later.

## 6. Performance note

Point-in-polygon testing against every surface every physics tick is
fine for a single ball (this is not a bottleneck at that scale) — don't
prematurely optimize with spatial partitioning until you actually have a
reason to (e.g., multiplayer with many balls, or very complex surface
polygon counts). Get it working simply first.
