# Phase 1 Spec — Swing Mechanic (tightened)

Replaces the Phase 1 entry in `00-ROADMAP.md` with something concrete
enough to hand directly to a coding agent. Same goal, no ambiguity left
for the agent to invent answers to.

## Scope

Flat plane only (`src/scenes/drivingRange.js`, already exists). No
terrain, no course data, no game loop. Just: aim → swing → ball flies →
ball rolls to a stop.

## Files to create/modify

- `src/core/swing.js` — **new.** Swing meter state machine + input
  handling.
- `src/core/clubs.js` — **new.** Club stat definitions
  (`golf-swing-physics.md` §2 has the shape).
- `src/core/ballPhysics.js` — **new.** Applies launch velocity to the
  Havok body, handles the airborne→rolling state transition, applies
  the Magnus-effect curve/lift forces during flight (`golf-swing-physics.md`
  §4–5).
- `src/core/constants.js` — **modify.** Add a `SWING` block for meter
  timing and a `FLIGHT` block for `LIFT_CONST`/`CURVE_CONST`/
  `DISTANCE_TO_VELOCITY_CONST` — start all of these at placeholder
  values, they get tuned by playtesting, not derived analytically.
- `src/scenes/drivingRange.js` — **modify.** Wire up swing input, club
  selection, camera follow behavior, and the debug HUD (see below).

## Input scheme (fixed — don't let the agent invent a different one)

- **Spacebar**: drives the swing meter. First press starts the
  power-fill; second press locks power and starts the accuracy sweep;
  third press locks accuracy and triggers the swing.
- **Number keys 1 / 2 / 3**: select Driver / 7-Iron / Putter. Can only
  change club when the ball is at rest and no swing is in progress.
- **Left/Right arrow keys**: adjust aim direction before starting a
  swing. Aim locks once the power-fill starts.

If you want a different scheme later (mouse-drag power bar, on-screen
buttons for mobile, etc.), that's a deliberate follow-up change — not
something to leave open now.

## Camera behavior (fixed)

- **At rest / aiming**: camera sits behind the ball, facing the aim
  direction, at a fixed distance/height (reuse the existing
  ArcRotateCamera, just reposition its target/alpha to match aim).
- **During flight**: camera target tracks the ball's position every
  frame. Don't chase rotation aggressively — smooth/lerp the camera
  target position rather than snapping, or it'll feel nauseating.
- **On landing/rolling to a stop**: once `ballPhysics` reports the shot
  as "resolved" (see `golf-swing-physics.md` §5), camera transitions
  back to the "at rest" behind-ball position for the next shot.

## Debug HUD (required for this phase — remove or hide later)

A simple on-screen overlay (plain DOM `<div>` over the canvas is fine,
no need for a Babylon GUI) showing, updated live:
- Current swing meter stage and value (power % / accuracy offset)
- Last shot's actual launch speed, angle, and spin values applied
- Current ball velocity while airborne/rolling

This exists so tuning `constants.js` values is a matter of watching
numbers change, not guessing from how the trajectory *looks*. Per
`golf-swing-physics.md`'s tuning workflow — don't skip this to save
time, it'll cost more time later.

## Acceptance checklist (Definition of Done)

- [ ] Full swing cycle works via spacebar (3 presses: power lock,
      accuracy lock, swing)
- [ ] Switching between all 3 clubs changes launch distance/angle
      noticeably and correctly (Driver > 7-Iron > Putter in distance;
      Putter never leaves the ground)
- [ ] A poorly-timed accuracy click visibly curves the shot left/right
      (not just an offset straight-line launch — must curve *during*
      flight per §4)
- [ ] Ball transitions cleanly from airborne → rolling → fully stopped,
      with no infinite micro-creep (see §5's velocity-threshold snap)
- [ ] Camera follows correctly through all three states (aim / flight /
      rest) without jarring snaps
- [ ] Debug HUD shows accurate live values matching what you'd expect
      from the swing input given
- [ ] Putter produces a believable putt: no airborne phase, starts
      rolling immediately, responds to... (no slope yet — flat plane —
      but confirm friction alone gives it reasonable roll distance)

Do not move to Phase 2 until every box above is checked by actually
playing it, not just by the code compiling/running without errors.




# Phase 1 Implementation Plan — Swing Mechanic (Bite-Sized Tasks)

This document breaks down Phase 1 into 4 sequential, independent sub-tasks designed specifically for execution by local AI coding agents.

---

## Task 1: Create Club Definitions & Core Constants

**Goal:** Establish the underlying data structures for clubs and swing constants before writing logic.

```markdown
# Prompt for Local Agent — Task 1

Please create two files for a Babylon.js golf project:

1. `src/core/constants.js`:
   - Create an exportable `SWING` object containing timing/speed variables for power fill and accuracy sweep.
   - Create an exportable `FLIGHT` object containing placeholder multiplier values:
     - `LIFT_CONST`
     - `CURVE_CONST`
     - `DISTANCE_TO_VELOCITY_CONST`
     - `STOP_VELOCITY_THRESHOLD` (to prevent infinite micro-creep when rolling)

2. `src/core/clubs.js`:
   - Export an array or dictionary of club stat definitions for three clubs: `DRIVER`, `SEVEN_IRON`, and `PUTTER`.
   - Each club must specify base launch velocity multiplier, launch angle (degrees), spin factor, and a flag indicating if it can go airborne (`isAirborneCapable`).
   - `PUTTER` must have a 0-degree launch angle and `isAirborneCapable: false`.
```

---

## Task 2: Implement Swing Input & State Machine

**Goal:** Handle user input and swing mechanics in isolation without worrying about physics or rendering yet.

```markdown
# Prompt for Local Agent — Task 2

Create `src/core/swing.js` to manage swing input state using standard keyboard events:

1. **State Machine Stages**:
   - `IDLE` -> `POWER_FILL` -> `ACCURACY_SWEEP` -> `LOCKED` -> `IDLE`

2. **Input Scheme**:
   - **Spacebar**:
     - 1st press: Starts power fill (0 to 100%).
     - 2nd press: Locks power, starts accuracy sweep (-100% to +100%, where 0 is perfect).
     - 3rd press: Locks accuracy, calculates final swing output, and triggers a callback/event with `{ power, accuracyOffset }`. Reset state back to IDLE afterwards.
   - **Number keys 1 / 2 / 3**: Select active club (Driver, 7-Iron, Putter). Selection is blocked if a swing is currently active.
   - **Left / Right arrow keys**: Adjust aim angle (in radians/degrees). Aiming is locked while a swing is active.

3. Provide getter methods or state properties so external code/HUD can read the active stage, power %, accuracy %, aim angle, and current club.
```

---

## Task 3: Implement Ball Physics & Magnus Curve

**Goal:** Apply Havok physics, spin curves, and the airborne-to-rolling transition.

```markdown
# Prompt for Local Agent — Task 3

Create `src/core/ballPhysics.js` using standard Havok physics for Babylon.js:

1. **Launch Method**:
   - Accepts active club stats, calculated `power`, `accuracyOffset`, and `aimAngle`.
   - Calculates initial 3D velocity vector (combining aim direction, launch angle, and power multiplier from `constants.js`).
   - Applies linear velocity to the Havok rigid body.

2. **Flight & Motion Update (Runs every frame)**:
   - Apply side-curve force (Magnus effect) based on `accuracyOffset` and `FLIGHT.CURVE_CONST`.
   - Apply extra lift force while airborne based on `FLIGHT.LIFT_CONST`.
   - Detect transition from `AIRBORNE` to `ROLLING` when vertical position/velocity drops below contact thresholds.
   - For `PUTTER`, skip the airborne phase completely and initialize directly into `ROLLING`.

3. **Rest & Stop Condition**:
   - Monitor total linear velocity while rolling.
   - When total velocity falls below `FLIGHT.STOP_VELOCITY_THRESHOLD`, set velocity to absolute 0 and report the shot as "RESOLVED".
```

---

## Task 4: Scene Integration, Camera Tracking, & Debug Overlay

**Goal:** Connect all the modules together inside the scene, configure camera tracking, and build the DOM overlay.

```markdown
# Prompt for Local Agent — Task 4

Modify `src/scenes/drivingRange.js` to bring together `swing.js`, `clubs.js`, `ballPhysics.js`, and `constants.js`:

1. **Camera Behavior (ArcRotateCamera)**:
   - **Aiming / At Rest**: Position camera behind the ball aligned with `aimAngle`.
   - **Flight / Rolling**: Smoothly lerp camera target position to track the ball without rotating jarringly.
   - **Resolved**: Transition camera target back behind the ball at its new resting position.

2. **Debug HUD (DOM Overlay)**:
   - Create a simple HTML `<div>` overlay positioned over the canvas displaying real-time values:
     - Active swing stage, power %, and accuracy offset.
     - Active club name.
     - Last shot's launch speed, angle, height and calculated spin curve.
     - Current live ball velocity vector and state (`AIRBORNE`, `ROLLING`, or `AT_REST`).

3. **Wiring**:
   - Ensure input events drive the swing meter, calculating launch parameters and triggering `ballPhysics`.
   - Verify spacebar sequence, club swapping (1/2/3), and arrow-key aiming work reliably.
```

---

## Definition of Done Checklist

Run through this checklist after executing Task 4 to confirm Phase 1 complete:

- [ ] Full swing cycle works via spacebar (3 presses: power lock, accuracy lock, swing)
- [ ] Switching between all 3 clubs changes launch distance/angle noticeably and correctly (Driver > 7-Iron > Putter; Putter never leaves ground)
- [ ] A poorly-timed accuracy click visibly curves the shot left/right during flight
- [ ] Ball transitions cleanly from airborne → rolling → fully stopped, with no infinite micro-creep
- [ ] Camera follows correctly through all three states (aim / flight / rest) without jarring snaps
- [ ] Debug HUD displays live values matching input and physics state
