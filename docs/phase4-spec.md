# Phase 4 Spec — Game Loop (tightened)

Replaces the Phase 4 entry in `00-ROADMAP.md`. This is where "hit ball,
watch physics" becomes an actual game with rules, scoring, and
progression between holes. Builds directly on Phase 3's loader — no
changes needed to terrain/surface/swing code, this phase adds a rules
layer on top.

## Scope

Stroke counting, hole-in detection, penalty/re-drop rules for hazards
and out-of-bounds, hole-to-hole progression, and a scorecard. Playable
end-to-end for a short round (2 holes is enough to prove progression
works — doesn't need to be 18).

## One schema gap to close first

The course schema (`course-data-schema.md`) has a `pin` position but no
explicit "cup" concept. Add a `CUP_RADIUS` constant (not per-hole data —
real golf cups are a fixed size) and treat "ball within `CUP_RADIUS` of
`pin` AND ball speed near zero" as holed. Don't add cup size to the
schema unless you have an actual reason to vary it later.

## Files to create/modify

- `src/game/gameState.js` — **new.** Single source of truth for: current
  hole index, strokes taken this hole, running total score, current game
  phase (`aiming` / `ball-in-motion` / `holed` / `round-complete`). Other
  modules read/write this rather than tracking their own copies of
  "strokes so far."
- `src/game/rules.js` — **new.**
  - Increments `gameState` stroke count exactly once per swing release
    (hook into the same swing-trigger event Phase 1 already fires — not
    a new one).
  - Hazard/OOB penalty: **stroke-and-distance** rule for both — ball
    that enters a water hazard or leaves the heightmap bounds gets a
    1-stroke penalty and re-drops at the position the previous stroke
    was played from. (This is the simplest correct-ish golf rule and
    avoids the added complexity of real golf's lateral-hazard drop
    zones — note that as a known simplification, not an oversight.)
  - Hole-complete check: run each tick while `ball-in-motion`, using the
    cup-radius check above.
- `src/game/scorecard.js` — **new.** Per-hole record of `{ holeId, par,
  strokes }`. Exposes a running total and score-relative-to-par. Pure
  data + formatting functions — no rendering logic here.
- `src/game/hud.js` — **new** (or extend Phase 1's debug HUD if that
  file structure fits better). Adds: current hole number, par, stroke
  count this hole, distance to pin, and a scorecard view shown between
  holes.
- `src/core/hazards.js` — **modify.** Phase 2 deferred actual penalty
  logic here — wire the existing hazard-trigger detection into
  `rules.js`'s stroke-and-distance handling now.
- `data/courses/test-course-a/holes/hole-02.json` — **new,
  hand-authored.** A second hole for `test-course-a` so hole-to-hole
  progression has something real to test (reuse the Phase 3 heightmap
  script with different parameters). `test-course-a/course.json` needs
  its `holes` array updated to include it.
- `src/scenes/roundTest.js` — **new.** Loads `test-course-a` as a full
  2-hole round via `gameState`/`rules.js`, handling the transition from
  hole 1 complete → hole 2 tee-off automatically.

## Explicitly out of scope for this phase

- Out-of-bounds detection beyond "outside heightmap bounds" — no
  fairway-adjacent OB markers or anything more nuanced yet.
- Any UI polish beyond a functional scorecard — that's Phase 6.
- Multiple rounds / persistent scores across sessions — that's Phase 7.

## Acceptance checklist (Definition of Done)

- [ ] Stroke count increments exactly once per swing — verify by
      deliberately taking several swings and confirming the HUD count
      matches your actual swing count, not a multiple of it (a common
      bug is incrementing on every meter click instead of on release)
- [ ] Hitting the ball into the water hazard on `test-course-a/hole-01`
      applies a 1-stroke penalty and re-drops the ball at the previous
      stroke's position
- [ ] Hitting the ball out of the heightmap bounds does the same
- [ ] Ball resting within `CUP_RADIUS` of the pin ends the hole and
      records the correct final stroke count on the scorecard
- [ ] Completing hole 1 correctly transitions to hole 2 — new terrain/
      surfaces load, ball/camera reset to hole 2's tee, stroke counter
      resets for the new hole while total score carries over
- [ ] Completing both holes shows a correct final scorecard: per-hole
      strokes, per-hole par, and total score relative to total par
- [ ] HUD shows accurate live stroke count, current hole, par, and
      distance-to-pin throughout play

Don't move to Phase 5 until a full 2-hole round can be played start to
finish, including at least one deliberate hazard shot, with a correct
final scorecard — not just "the code runs," actually verify the score
math by hand against what you did.
